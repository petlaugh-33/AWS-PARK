import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations, handleReservationSubmit } from './reservations.js';
import { getCurrentUser, redirectToLogin } from './auth.js';
import './dashboard.js';

// Make necessary functions available globally
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;
window.handleReservationSubmit = handleReservationSubmit;

// Constants for parking configuration
const FLOORS = ['P1', 'P2', 'P3', 'P4'];
const SPOTS_PER_FLOOR = 6;

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
            updateFloorAvailability(reservations);
        })
        .catch(error => {
            console.error('Error loading reservations:', error);
        });
}

function updateFloorAvailability(reservations) {
    const now = new Date();
    const floorStatus = {};

    // Initialize status for each floor
    FLOORS.forEach(floor => {
        floorStatus[floor] = {
            total: SPOTS_PER_FLOOR,
            available: SPOTS_PER_FLOOR,
            occupied: 0
        };
    });

    // Calculate occupied spots per floor
    reservations.forEach(reservation => {
        const startTime = new Date(reservation.startTime);
        const endTime = new Date(reservation.endTime);
        if (startTime <= now && endTime > now && reservation.status === 'CONFIRMED') {
            const floor = reservation.floor;
            if (floorStatus[floor]) {
                floorStatus[floor].occupied++;
                floorStatus[floor].available--;
            }
        }
    });

    // Update floor status display if you have one
    updateFloorStatusDisplay(floorStatus);
}

function updateFloorStatusDisplay(floorStatus) {
    // This function can be implemented if you want to show per-floor statistics
    // For now, it's just logging the status
    console.log('Floor Status:', floorStatus);
}

function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    const homeTab = document.getElementById('homeTab');
    const analysisTab = document.getElementById('analysisTab');
    const reservationsTab = document.getElementById('ReservationsTab');

    if (homeTab && analysisTab && reservationsTab) {
        homeTab.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Home tab clicked');
            switchTab('homeTab');
        });

        analysisTab.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Analysis tab clicked');
            switchTab('analysisTab');
        });

        reservationsTab.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Reservations tab clicked');
            switchTab('ReservationsTab');
        });

        switchTab('homeTab');
    } else {
        console.error('One or more tabs not found:', {
            homeTab: !!homeTab,
            analysisTab: !!analysisTab,
            reservationsTab: !!reservationsTab
        });
    }
}

function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    const homePage = document.getElementById('homePage');
    const analysisPage = document.getElementById('analysisPage');
    const reservationsPage = document.getElementById('ReservationsPage');

    // Hide all pages
    if (homePage) homePage.style.display = 'none';
    if (analysisPage) analysisPage.style.display = 'none';
    if (reservationsPage) reservationsPage.style.display = 'none';

    // Show selected page
    switch(tabId) {
        case 'homeTab':
            if (homePage) homePage.style.display = 'block';
            break;
        case 'analysisTab':
            if (analysisPage) analysisPage.style.display = 'block';
            break;
        case 'ReservationsTab':
            if (reservationsPage) {
                reservationsPage.style.display = 'block';
                loadUserReservations();
            }
            break;
    }

    // Update active state of tabs
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
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
    
    setInterval(cleanupStorageData, 60 * 60 * 1000);

    setupTabNavigation();

    console.log('Application initialization complete.');
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

// Periodic authentication check
setInterval(() => {
    if (!getCurrentUser()) {
        console.log('User session expired');
        redirectToLogin();
    }
}, 5 * 60 * 1000);

export {
    initializeApp,
    handleError,
    checkAuthentication
};
