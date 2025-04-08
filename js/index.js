import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations, handleReservationSubmit } from './reservations.js';
import { connect, monitorConnection, manualReconnect, closeConnection } from './websocket.js';
import { getCurrentUser, redirectToLogin } from './auth.js';
import './dashboard.js';

// Make necessary functions available globally
window.manualReconnect = manualReconnect;
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;
window.handleReservationSubmit = handleReservationSubmit;

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

function updateUserInterface(user) {
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }

    loadUserReservations()
        .then(reservations => {
            console.log(`Loaded ${reservations.length} reservations for user`);
        })
        .catch(error => {
            console.error('Error loading reservations:', error);
        });
}

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

    initializeStorage();
    initializeUI();
    initializeReservationSystem();
    
    updateUserInterface(user);
    initializeWebSocketWithAuth();

    setInterval(cleanupStorageData, 60 * 60 * 1000); // Run cleanup every hour
    setupTabNavigation();

    console.log('Application initialization complete.');
}

function setupTabNavigation() {
    const homeTab = document.getElementById('homeTab');
    const analysisTab = document.getElementById('analysisTab');
    const reservationsTab = document.getElementById('ReservationsTab');

    if (homeTab && analysisTab && reservationsTab) {
        homeTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('homeTab');
        });

        analysisTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('analysisTab');
        });

        reservationsTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('ReservationsTab');
        });

        switchTab('homeTab'); // Set initial tab
    }
}

function switchTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'homeTab' ? 'block' : 'none';
    document.getElementById('analysisPage').style.display = tabId === 'analysisTab' ? 'block' : 'none';
    document.getElementById('ReservationsPage').style.display = tabId === 'ReservationsTab' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'analysisTab') {
        if (!window.parkingDashboard) {
            window.parkingDashboard = new ParkingDashboard();
        }
    } else if (tabId === 'ReservationsTab') {
        loadUserReservations();
    }
}

function handleError(error) {
    console.error('Application error:', error);
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        redirectToLogin();
    }
}

// Event Listeners
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    handleError(event.error);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Starting app initialization...');
    try {
        initializeApp();
    } catch (error) {
        handleError(error);
    }
});

window.addEventListener('beforeunload', () => {
    closeConnection();
});

// Session check interval
setInterval(() => {
    if (!getCurrentUser()) {
        console.log('User session expired');
        redirectToLogin();
    }
}, 5 * 60 * 1000); // Check every 5 minutes

export {
    initializeApp,
    handleError,
    checkAuthentication
};
