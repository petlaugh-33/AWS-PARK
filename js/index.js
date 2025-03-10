import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation } from './reservations.js';
import { connect, monitorConnection, manualReconnect, closeConnection } from './websocket.js';

// Make necessary functions available globally
window.manualReconnect = manualReconnect;
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;

// Initialize application
function initializeApp() {
    // Initialize core systems
    initializeStorage();
    initializeUI();
    initializeReservationSystem();
    
    // Start WebSocket connection
    connect();
    monitorConnection();

    // Set up periodic cleanup
    setInterval(cleanupStorageData, 60 * 60 * 1000); // Run every hour
}

// Handle errors
function handleError(error) {
    console.error('Application error:', error);
    // Add more error handling as needed
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    handleError(event.error);
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeApp();
    } catch (error) {
        handleError(error);
    }
});

// Handle unload
window.addEventListener('beforeunload', () => {
    closeConnection();
});

// Export for potential external use
export {
    initializeApp,
    handleError
};

