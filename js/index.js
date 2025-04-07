import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations, handleReservationSubmit } from './reservations.js';
import { getCurrentUser, redirectToLogin } from './auth.js';
import './dashboard.js';

// Make necessary functions available globally
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
        .then(reservations => {
            console.log(`Loaded ${reservations.length} reservations for user`);
        })
        .catch(error => {
            console.error('Error loading reservations:', error);
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
    FLOORS.forEach(floor => {
        const card = document.querySelector(`[data-floor="${floor}"]`);
        if (card) {
            card.classList.remove('border-primary', 'shadow');
        }
    });

    const selectedCard = document.querySelector(`[data-floor="${selectedFloor}"]`);
    if (selectedCard) {
        selectedCard.classList.add('border-primary', 'shadow');
    }
}

function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    // Get all tabs and pages
    const tabsConfig = {
        homeTab: { pageId: 'homePage', handler: () => loadUserReservations() },
        analysisTab: { pageId: 'analysisPage', handler: () => { /* Analysis specific logic */ } },
        ReservationsTab: { pageId: 'ReservationsPage', handler: () => loadUserReservations() }
    };

    // Add click handlers for each tab
    Object.entries(tabsConfig).forEach(([tabId, config]) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`${tabId} clicked`);
                switchTab(tabId, config.pageId, config.handler);
            });
        }
    });

    // Set initial tab
    switchTab('homeTab', 'homePage', tabsConfig.homeTab.handler);
}

function switchTab(tabId, pageId, handler) {
    console.log(`Switching to tab: ${tabId}, page: ${pageId}`);

    // Hide all pages
    ['homePage', 'analysisPage', 'ReservationsPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.style.display = 'none';
        }
    });

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.style.display = 'block';
    }

    // Update active state of tabs
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Execute tab-specific handler
    if (handler) {
        handler();
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

// Make functions available globally
window.switchTab = switchTab;

export {
    initializeApp,
    handleError,
    checkAuthentication,
    switchTab
};