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
const SPOTS_PER_FLOOR = 6;
const FLOORS = ['P1', 'P2', 'P3', 'P4'];

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

    setupFloorSelectionHandlers();
    loadUserReservations()
        .then(() => {
            console.log('Initial reservations loaded');
        })
        .catch(error => {
            console.error('Error loading initial reservations:', error);
        });
}

function setupFloorSelectionHandlers() {
    const floorSelects = document.querySelectorAll('#floorSelect, #floorSelectReservations');
    floorSelects.forEach(select => {
        select.addEventListener('change', handleFloorSelection);
    });
}

function handleFloorSelection(event) {
    const selectedFloor = event.target.value;
    if (selectedFloor) {
        console.log(`Floor selected: ${selectedFloor}`);
        highlightSelectedFloor(selectedFloor);
    }
}

function highlightSelectedFloor(selectedFloor) {
    // Remove highlight from all floor cards
    FLOORS.forEach(floor => {
        const card = document.querySelector(`[data-floor="${floor}"]`);
        if (card) {
            card.classList.remove('border-primary', 'shadow');
        }
    });

    // Add highlight to selected floor
    const selectedCard = document.querySelector(`[data-floor="${selectedFloor}"]`);
    if (selectedCard) {
        selectedCard.classList.add('border-primary', 'shadow');
    }
}

function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    const tabs = {
        homeTab: document.getElementById('homeTab'),
        analysisTab: document.getElementById('analysisTab'),
        ReservationsTab: document.getElementById('ReservationsTab')
    };

    Object.entries(tabs).forEach(([id, element]) => {
        if (element) {
            element.addEventListener('click', function(e) {
                e.preventDefault();
                console.log(`${id} clicked`);
                switchTab(id);
            });
        } else {
            console.error(`Tab ${id} not found`);
        }
    });

    // Set initial tab
    switchTab('homeTab');
}

function switchTab(tabId) {
    console.log(`Switching to tab: ${tabId}`);
    
    // Get all pages
    const pages = {
        homeTab: document.getElementById('homePage'),
        analysisTab: document.getElementById('analysisPage'),
        ReservationsTab: document.getElementById('ReservationsPage')
    };

    // Hide all pages
    Object.values(pages).forEach(page => {
        if (page) {
            page.style.display = 'none';
        }
    });

    // Show selected page
    const selectedPage = pages[tabId];
    if (selectedPage) {
        selectedPage.style.display = 'block';
        
        // Perform tab-specific actions
        if (tabId === 'ReservationsTab') {
            console.log('Loading reservations for My Reservations tab');
            loadUserReservations();
        } else if (tabId === 'homeTab') {
            console.log('Updating floor stats for Home tab');
            loadUserReservations();
        }
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

// Make functions available globally if needed
window.switchTab = switchTab;

export {
    initializeApp,
    handleError,
    checkAuthentication,
    switchTab
};
