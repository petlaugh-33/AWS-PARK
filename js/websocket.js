// websocket.js
class WebSocketManager {
    constructor(config) {
        this.WEBSOCKET_URL = 'wss://ocly49pex3.execute-api.us-east-1.amazonaws.com/production';
        this.MAX_RECONNECT_ATTEMPTS = 5;
        this.HEARTBEAT_INTERVAL = 30000;

        this.socket = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;

        // Callbacks
        this.onStatusUpdate = config.onStatusUpdate || (() => {});
        this.onHistoryUpdate = config.onHistoryUpdate || (() => {});
    }

    connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        
        const connectionStatus = document.getElementById('connectionStatus');
        connectionStatus.className = 'alert alert-secondary';
        connectionStatus.textContent = 'Connecting...';

        try {
            this.socket = new WebSocket(this.WEBSOCKET_URL);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.handleConnectionError(error);
        }
    }

    setupEventHandlers() {
        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('success', 'Connected');
            this.startHeartbeat();
        };

        this.socket.onclose = () => {
            this.handleDisconnect();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleConnectionError(error);
        };

        this.socket.onmessage = (event) => {
            this.handleMessage(event);
        };
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received data:', data);
            if (data.type === 'status_update') {
                this.onStatusUpdate(data.data);
                this.onHistoryUpdate(data.data);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log('Sending heartbeat');
                this.socket.send(JSON.stringify({ 
                    action: 'heartbeat',
                    timestamp: new Date().toISOString
    
