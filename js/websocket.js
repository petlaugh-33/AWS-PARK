import { WEBSOCKET_URL, MAX_RECONNECT_ATTEMPTS, STORAGE_KEYS } from './constants.js';
import { updateStatus, addToHistory } from './ui.js';
import { loadFromLocalStorage, saveToLocalStorage } from './storage.js';

let socket;
let isConnecting = false;
let reconnectAttempts = 0;

export function connect() {
    if (isConnecting) return;
    isConnecting = true;

    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.className = 'alert alert-secondary';
    connectionStatus.textContent = 'Connecting...';

    try {
        socket = new WebSocket(WEBSOCKET_URL);

        socket.onopen = () => {
            console.log('WebSocket connected');
            isConnecting = false;
            reconnectAttempts = 0;
            connectionStatus.className = 'alert alert-success';
            connectionStatus.textContent = 'Connected';
            startHeartbeat();
        };

        socket.onclose = () => {
            isConnecting = false;
            connectionStatus.className = 'alert alert-warning';
            connectionStatus.textContent = 'Disconnected - Attempting to reconnect...';

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connect, 2000);
            } else {
                connectionStatus.className = 'alert alert-danger';
                connectionStatus.textContent = 'Connection failed - Please refresh the page';
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            isConnecting = false;
            connectionStatus.className = 'alert alert-danger';
            connectionStatus.textContent = 'Connection error - Will attempt to reconnect';
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const timestamp = new Date().toLocaleTimeString();

                console.log(`[WebSocket] Raw message at ${timestamp}:`, data);

                if (data.type === 'status_update') {
                    const statusData = data.data;
                    const isImageUpdate = statusData?.lastAnalysis !== undefined;

                    console.log('Available:', statusData?.availableSpaces);
                    console.log('Occupied:', statusData?.occupiedSpaces);
                    console.log('Rate:', statusData?.occupancyRate + '%');
                    console.log('Has lastAnalysis?', isImageUpdate);

                    if (isImageUpdate) {
                        console.log('[WebSocket] ✅ Applying image-based status update');
                        updateStatus(statusData, 'image'); // UI update
                    } else {
                        console.log('[WebSocket] 💾 Heartbeat - saving to localStorage only');
                        saveToLocalStorage(STORAGE_KEYS.CURRENT_STATUS, {
                            ...statusData,
                            lastUpdated: new Date().toISOString()
                        });
                    }

                    addToHistory(statusData); // always update history
                }

                else if (data.type === 'reservation_update') {
                    console.log(`[${timestamp}] RESERVATION UPDATE:`);
                    console.log('Action:', data.action);

                    loadUserReservations();
                    if (data.action === 'create' || data.action === 'cancel') {
                        console.log('[Reservation] Triggering parking status update');
                        updateParkingStatus();
                    }
                }

            } catch (error) {
                console.error('Error processing message:', error);
                console.error('Raw message:', event.data);
            }
        };

    } catch (error) {
        console.error('Error creating WebSocket:', error);
        isConnecting = false;
        connectionStatus.className = 'alert alert-danger';
        connectionStatus.textContent = 'Failed to create connection';
    }
}


export function startHeartbeat() {
    setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'heartbeat' }));
        }
    }, 30000); // 30 seconds
}

export function monitorConnection() {
    setInterval(() => {
        if (socket && socket.readyState !== WebSocket.OPEN && !isConnecting) {
            connect();
        }
    }, 5000); // 5 seconds
}

export function manualReconnect() {
    console.log('Manual reconnection requested');
    reconnectAttempts = 0;
    if (socket) {
        socket.close();
    }
    connect();
}

window.manualReconnect = manualReconnect;

export function getConnectionState() {
    if (!socket) return 'CLOSED';

    switch (socket.readyState) {
        case WebSocket.CONNECTING:
            return 'CONNECTING';
        case WebSocket.OPEN:
            return 'OPEN';
        case WebSocket.CLOSING:
            return 'CLOSING';
        case WebSocket.CLOSED:
            return 'CLOSED';
        default:
            return 'UNKNOWN';
    }
}

export function sendMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
    return false;
}

export function closeConnection() {
    if (socket) {
        try {
            socket.close();
            return true;
        } catch (error) {
            console.error('Error closing connection:', error);
            return false;
        }
    }
    return false;
}

export function resetConnectionAttempts() {
    reconnectAttempts = 0;
}

export function isConnected() {
    return socket && socket.readyState === WebSocket.OPEN;
}

export function initializeWebSocket(customHandlers = {}) {
    if (customHandlers.onMessage) {
        const originalOnMessage = socket.onmessage;
        socket.onmessage = (event) => {
            originalOnMessage(event);
            customHandlers.onMessage(event);
        };
    }

    if (customHandlers.onClose) {
        const originalOnClose = socket.onclose;
        socket.onclose = (event) => {
            originalOnClose(event);
            customHandlers.onClose(event);
        };
    }

    if (customHandlers.onError) {
        const originalOnError = socket.onerror;
        socket.onerror = (error) => {
            originalOnError(error);
            customHandlers.onError(error);
        };
    }
}

