import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations } from './reservations.js';
import { connect, monitorConnection, manualReconnect, closeConnection } from './websocket.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

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
        redirectToLogin();
        return false;
    }
    console.log('User authenticated:', user);
    return true;
}

// Update the user interface with user info
function updateUserInterface(user) {
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }

    // Load user's reservations
    loadUserReservations()
        .then(reservations => {
            console.log(`Loaded ${reservations.length} reservations for user`);
        })
        .catch(error => {
            console.error('Error loading reservations:', error);
        });
}

// Initialize WebSocket with user context
function initializeWebSocketWithAuth() {
    const user = getCurrentUser();
    if (user) {
        connect({
            userId: user.sub,
            userEmail: user.email
        });
        monitorConnection();
    }
}

// Initialize application
function initializeApp() {
    console.log('Initializing application...');
    
    const user = getCurrentUser();
    if (!user) {
        console.log('Authentication check failed. Redirecting to login.');
        redirectToLogin();
        return;
    }

    console.log('Authentication successful. Continuing initialization...');
    console.log('Initializing for user:', user.email);

    // Initialize core systems
    initializeStorage();
    initializeUI();
    initializeReservationSystem();
    
    // Update UI with user info
    updateUserInterface(user);
    
    // Start WebSocket connection with user context
    initializeWebSocketWithAuth();

    // Set up periodic cleanup
    setInterval(cleanupStorageData, 60 * 60 * 1000); // Run every hour

    // Set up tab navigation if it exists
    setupTabNavigation();

    console.log('Application initialization complete.');
}

// Set up tab navigation
function setupTabNavigation() {
    const homeTab = document.getElementById('homeTab');
    const analysisTab = document.getElementById('analysisTab');

    if (homeTab && analysisTab) {
        homeTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('homeTab');
        });

        analysisTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('analysisTab');
        });

        // Set initial tab
        switchTab('homeTab');
    }
}

// Handle tab switching
function switchTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'homeTab' ? 'block' : 'none';
    document.getElementById('analysisPage').style.display = tabId === 'analysisTab' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Load data for analysis tab if selected
    if (tabId === 'analysisTab') {
        loadHistoricalData('daily');
    }
}

// Handle errors
function handleError(error) {
    console.error('Application error:', error);
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        redirectToLogin();
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    handleError(event.error);
});

// Authentication check on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Starting app initialization...');
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

// Check authentication periodically
setInterval(() => {
    if (!getCurrentUser()) {
        console.log('User session expired');
        redirectToLogin();
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Export for potential external use
export {
    initializeApp,
    handleError,
    checkAuthentication
};

    
