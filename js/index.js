import { initializeStorage, cleanupStorageData } from './storage.js';
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations, handleReservationSubmit } from './reservations.js';
import { getCurrentUser, redirectToLogin } from './auth.js';
import './dashboard.js';

// Make necessary functions available globally
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;
window.handleReservationSubmit = handleReservationSubmit;

// Constants for parking floors
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
        // Highlight selected floor card
        highlightSelectedFloor(selectedFloor);
        // Update floor availability display
        updateSelectedFloorDisplay(selectedFloor);
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

function updateSelectedFloorDisplay(floor) {
    // Update the floor status display for the selected floor
    const stats = calculateFloorStats(floor);
    updateFloorStatsDisplay(floor, stats);
}

function calculateFloorStats(floor) {
    const now = new Date();
    const reservations = Array.from(document.querySelectorAll(`[data-floor="${floor}"] .reservation-row`));
    
    const occupied = reservations.filter(row => {
        const startTime = new Date(row.dataset.startTime);
        const endTime = new Date(row.dataset.endTime);
        return startTime <= now && endTime > now;
    }).length;

    const available = SPOTS_PER_FLOOR - occupied;
    const occupancyRate = Math.round((occupied / SPOTS_PER_FLOOR) * 100);

    return { available, occupied, occupancyRate };
}

function updateFloorStatsDisplay(floor, stats) {
    const availableElement = document.getElementById(`${floor}-availableSpaces`);
    const occupiedElement = document.getElementById(`${floor}-occupiedSpaces`);
    const progressBar = document.getElementById(`${floor}-occupancyBar`);

    if (availableElement) availableElement.textContent = stats.available;
    if (occupiedElement) occupiedElement.textContent = stats.occupied;
    
    if (progressBar) {
        progressBar.style.width = `${stats.occupancyRate}%`;
        progressBar.setAttribute('aria-valuenow', stats.occupancyRate);
        
        // Update progress bar color based on occupancy
        if (stats.occupancyRate >= 80) {
            progressBar.className = 'progress-bar bg-danger';
        } else if (stats.occupancyRate >= 50) {
            progressBar.className = 'progress-bar bg-warning';
        } else {
            progressBar.className = 'progress-bar bg-success';
        }
    }
}

function updateAllFloorStats() {
    FLOORS.forEach(floor => {
        const stats = calculateFloorStats(floor);
        updateFloorStatsDisplay(floor, stats);
    });
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
            if (homePage) {
                homePage.style.display = 'block';
                updateAllFloorStats();
            }
            break;
        case 'analysisTab':
            if (analysisPage) {
                analysisPage.style.display = 'block';
            }
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

    // Initial update of all floor stats
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
