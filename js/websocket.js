import { WEBSOCKET_URL, MAX_RECONNECT_ATTEMPTS } from './constants.js';
import { updateStatus, addToHistory } from './ui.js';
import { loadUserReservations } from './reservations.js';

let socket;
let isConnecting = false;
let reconnectAttempts = 0;

export function connect() {
    if (isConnecting) return;
    isConnecting = true;

    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        connectionStatus.className = 'alert alert-secondary';
        connectionStatus.textContent = 'Connecting...';
    }

    try {
        socket = new WebSocket(WEBSOCKET_URL);

        socket.onopen = () => {
            console.log('[WebSocket] ✅ Connected');
            isConnecting = false;
            reconnectAttempts = 0;

            if (connectionStatus) {
                connectionStatus.className = 'alert alert-success';
                connectionStatus.textContent = 'Connected';
            }

            startHeartbeat();
        };

        socket.onclose = () => {
            isConnecting = false;

            if (connectionStatus) {
                connectionStatus.className = 'alert alert-warning';
                connectionStatus.textContent = 'Disconnected - Attempting to reconnect...';
            }

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connect, 2000);
            } else {
                if (connectionStatus) {
                    connectionStatus.className = 'alert alert-danger';
                    connectionStatus.textContent = 'Connection failed - Please refresh the page';
                }
            }
        };

        socket.onerror = (error) => {
            console.error('[WebSocket] ❌ Error:', error);
            isConnecting = false;

            if (connectionStatus) {
                connectionStatus.className = 'alert alert-danger';
                connectionStatus.textContent = 'Connection error - Will attempt to reconnect';
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[WebSocket] Raw message at ${timestamp}:`, data);

                if (data.type === 'status_update') {
                    const statusData = data.data;
                    const isImage = !!statusData?.lastAnalysis;

                    updateStatus(statusData, isImage ? 'image' : 'realtime');

                    if (isImage) addToHistory(statusData);
                } else if (data.type === 'reservation_update') {
                    console.log(`[WebSocket] 📢 Reservation Update: ${data.action}`);
                    loadUserReservations();
                }
            } catch (error) {
                console.error('[WebSocket] ❌ Error processing message:', error);
                console.error('Raw message:', event.data);
            }
        };

    } catch (error) {
        console.error('[WebSocket] ❌ Creation error:', error);
        isConnecting = false;

        if (connectionStatus) {
            connectionStatus.className = 'alert alert-danger';
            connectionStatus.textContent = 'Failed to create connection';
        }
    }
}

export function startHeartbeat() {
    setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'heartbeat' }));
        }
    }, 3000);
}

export function monitorConnection() {
    setInterval(() => {
        if (socket && socket.readyState !== WebSocket.OPEN && !isConnecting) {
            connect();
        }
    }, 5000);
}

export function manualReconnect() {
    console.log('[WebSocket] 🔁 Manual reconnect triggered');
    reconnectAttempts = 0;
    if (socket) socket.close();
    connect();
}

export function closeConnection() {
    if (socket) socket.close();
}

