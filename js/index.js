import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation } from './reservations.js';
import { connect, monitorConnection, manualReconnect, closeConnection } from './websocket.js';
import { getCurrentUser } from './auth.js'; // Add this import

// Make necessary functions available globally
window.manualReconnect = manualReconnect;
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;

// Add authentication check
function checkAuthentication() {
    console.log('Checking authentication...');
    const user = getCurrentUser();
    if (!user) {
        console.log('No authenticated user found. Redirecting to login.');
        window.location.href = 'auth.html';
        return false;
    }
    console.log('User authenticated:', user);
    return true;
}

// Modify your initializeApp function
function initializeApp() {
    console.log('Initializing application...');
    
    if (!checkAuthentication()) {
        console.log('Authentication check failed. Stopping initialization.');
        return;
    }

    console.log('Authentication successful. Continuing initialization...');
    // Initialize core systems
    initializeStorage();
    initializeUI();
    initializeReservationSystem();
    
    // Start WebSocket connection
    connect();
    monitorConnection();

    // Set up periodic cleanup
    setInterval(cleanupStorageData, 60 * 60 * 1000); // Run every hour

    console.log('Application initialization complete.');
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

// Make sure this event listener is present
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Starting app initialization...');
    initializeApp();
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

