import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI } from './ui.js';
import { initializeReservationSystem } from './reservations.js';
import { connect, monitorConnection, manualReconnect } from './websocket.js';
import { loadHistoricalData } from './ui.js';

// Make necessary functions available globally
window.manualReconnect = manualReconnect;
window.loadHistoricalData = loadHistoricalData;

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
    // You could add more error handling here
}

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
    // Perform any cleanup needed before page unload
});

// Export any functions that need to be accessed globally
export {
    initializeApp,
    handleError
};
