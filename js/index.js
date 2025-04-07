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

    // Initialize floor selection handlers
    setupFloorSelectionHandlers();

    loadUserReservations()
        .then(reservations => {
            console.log(`Loaded ${reservations.length} reservations for user`);
            updateAllFloorStats();
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
        highlightSelectedFloor(selectedFloor);
        updateSelectedFloorDisplay(selectedFloor);
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

        // Set initial tab
        switchTab('homeTab');
    }
}

function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // Hide all pages
    const pages = {
        'homeTab': 'homePage',
        'analysisTab': 'analysisPage',
        'ReservationsTab': 'ReservationsPage'
    };
    
    Object.values(pages).forEach(pageId => {
        const page = document.getElementById(pageId);
        if (page) {
            page.style.display = 'none';
        }
    });

    // Show selected page
    const pageToShow = document.getElementById(pages[tabId]);
    if (pageToShow) {
        pageToShow.style.display = 'block';
    }

    // Handle specific tab actions
    if (tabId === 'ReservationsTab') {
        console.log('Loading reservations for My Reservations tab');
        loadUserReservations();
    } else if (tabId === 'homeTab') {
        console.log('Updating floor stats for Home tab');
        updateAllFloorStats();
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

function updateAllFloorStats() {
    FLOORS.forEach(floor => {
        const stats = calculateFloorStats(floor);
        updateFloorStatsDisplay(floor, stats);
    });
}

function calculateFloorStats(floor) {
    const now = new Date();
    const reservations = Array.from(document.querySelectorAll(`[data-floor="${floor}"] .reservation-row`));
    
    const occupied = reservations.filter(row => {
        const startTime = new Date(row.dataset.startTime);
        const endTime = new Date(row.dataset.endTime);
        return startTime <= now && endTime > now;
    }).length;

    return {
        available: SPOTS_PER_FLOOR - occupied,
        occupied: occupied,
        occupancyRate: Math.round((occupied / SPOTS_PER_FLOOR) * 100)
    };
}

function updateFloorStatsDisplay(floor, stats) {
    const elements = {
        available: document.getElementById(`${floor}-availableSpaces`),
        occupied: document.getElementById(`${floor}-occupiedSpaces`),
        progress: document.getElementById(`${floor}-occupancyBar`)
    };

    if (elements.available) elements.available.textContent = stats.available;
    if (elements.occupied) elements.occupied.textContent = stats.occupied;
    
    if (elements.progress) {
        elements.progress.style.width = `${stats.occupancyRate}%`;
        elements.progress.setAttribute('aria-valuenow', stats.occupancyRate);
        
        // Update progress bar color based on occupancy
        elements.progress.className = 'progress-bar ' + 
            (stats.occupancyRate >= 80 ? 'bg-danger' :
             stats.occupancyRate >= 50 ? 'bg-warning' : 
             'bg-success');
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
    updateAllFloorStats();

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
