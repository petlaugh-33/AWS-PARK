import { initializeStorage, cleanupStorageData } from './storage.js';
<<<<<<< HEAD
import { initializeUI, loadHistoricalData } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations } from './reservations.js';
import { connect, monitorConnection, manualReconnect, closeConnection } from './websocket.js';
=======
import { updateStatus, initializeWebSocket } from './ui.js';
import { initializeReservationSystem, cancelReservation, loadUserReservations, handleReservationSubmit } from './reservations.js';
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
import { getCurrentUser, redirectToLogin } from './auth.js';
// Add this with your other imports
import { embedQuickSightDashboard, getCurrentDate } from './quicksight.js';

// Make necessary functions available globally
<<<<<<< HEAD
window.manualReconnect = manualReconnect;
window.loadHistoricalData = loadHistoricalData;
window.cancelReservation = cancelReservation;
=======
window.cancelReservation = cancelReservation;
window.handleReservationSubmit = handleReservationSubmit;

// Constants for parking configuration
const SPOTS_PER_FLOOR = 6;
const FLOORS = ['P1', 'P2', 'P3', 'P4'];
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)

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

<<<<<<< HEAD
    // Load user's reservations
=======
    setupFloorSelectionHandlers();
    
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
    loadUserReservations()
        .then(reservations => {
            console.log(`Loaded ${reservations.length} reservations for user`);
        })
        .catch(error => {
            console.error('Error loading reservations:', error);
        });
}

<<<<<<< HEAD
// Initialize WebSocket with user context
function initializeWebSocketWithAuth() {
    const user = getCurrentUser();
    if (user) {
        connect({
            userId: user.sub,
            userEmail: user.email
=======
function setupFloorSelectionHandlers() {
    // Handle floor card clicks
    FLOORS.forEach(floor => {
        const card = document.querySelector(`[data-floor="${floor}"]`);
        if (card) {
            card.addEventListener('click', () => {
                updateFloorSelection(floor);
            });
        }
    });

    // Handle dropdown selections
    const floorSelects = document.querySelectorAll('#floorSelect, #floorSelectReservations');
    floorSelects.forEach(select => {
        select.addEventListener('change', (event) => {
            updateFloorSelection(event.target.value);
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
        });
    });
}

function updateFloorSelection(selectedFloor) {
    console.log(`Updating floor selection: ${selectedFloor}`);
    
    // Update floor cards
    FLOORS.forEach(floor => {
        const card = document.querySelector(`[data-floor="${floor}"]`);
        if (card) {
            if (floor === selectedFloor) {
                card.classList.add('selected-floor', 'border-primary', 'shadow');
            } else {
                card.classList.remove('selected-floor', 'border-primary', 'shadow');
            }
        }
    });

    // Update dropdowns
    const floorSelects = document.querySelectorAll('#floorSelect, #floorSelectReservations');
    floorSelects.forEach(select => {
        if (select) {
            select.value = selectedFloor;
        }
    });
}

function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    const tabsConfig = {
        homeTab: { pageId: 'homePage', handler: () => loadUserReservations() },
        analysisTab: { pageId: 'analysisPage', handler: () => { /* Analysis specific logic */ } },
        ReservationsTab: { pageId: 'ReservationsPage', handler: () => loadUserReservations() }
    };

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

    switchTab('homeTab', 'homePage', tabsConfig.homeTab.handler);
}

function switchTab(tabId, pageId, handler) {
    console.log(`Switching to tab: ${tabId}, page: ${pageId}`);

    ['homePage', 'analysisPage', 'ReservationsPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.style.display = 'none';
        }
    });

    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.style.display = 'block';
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    if (handler) {
        handler();
    }
}

function setupDashboardButtons() {
    const containerDiv = document.getElementById('embedded-dashboard');
    const dailyBtn = document.getElementById('dailyDashboard');
    const weeklyBtn = document.getElementById('weeklyDashboard');
    const dateSpan = document.getElementById('currentDate');

    // Set current date
    if (dateSpan) {
        dateSpan.textContent = getCurrentDate();
    }

    if (dailyBtn && weeklyBtn && containerDiv) {
        dailyBtn.addEventListener('click', function() {
            embedQuickSightDashboard(containerDiv, 'daily');
            dailyBtn.classList.add('active');
            weeklyBtn.classList.remove('active');
        });

        weeklyBtn.addEventListener('click', function() {
            embedQuickSightDashboard(containerDiv, 'weekly');
            weeklyBtn.classList.add('active');
            dailyBtn.classList.remove('active');
        });

        // Load daily dashboard by default
        embedQuickSightDashboard(containerDiv, 'daily');
        dailyBtn.classList.add('active');
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
    initializeReservationSystem();

    // Get the authentication token
    const idToken = localStorage.getItem('idToken');
    console.log('Token available:', !!idToken); // Log if token exists
    
<<<<<<< HEAD
    // Update UI with user info
    updateUserInterface(user);
    
    // Start WebSocket connection with user context
    initializeWebSocketWithAuth();

    // Set up periodic cleanup
    setInterval(cleanupStorageData, 60 * 60 * 1000); // Run every hour

    // Set up tab navigation if it exists
=======
    const ws = initializeWebSocket(idToken);
    ws.addEventListener('open', () => {
        console.log('WebSocket connection established');
    });

    ws.addEventListener('message', (event) => {
        console.log('WebSocket message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'status_update') {
                console.log('Status update received:', data);
                updateStatus(data);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.addEventListener('close', () => {
        console.log('WebSocket connection closed');
    });
    
    const initialState = {
        availableSpaces: 6,
        occupiedSpaces: 0,
        occupancyRate: 0,
        parkingStatus: 'AVAILABLE',
        lastUpdated: new Date().toISOString(),
        floor: 'P1'
    };
    // Add logging here
    console.log('Setting initial state:', initialState);
    updateStatus(initialState);
    updateUserInterface(user);
    
    setInterval(cleanupStorageData, 60 * 60 * 1000);
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
    setupTabNavigation();

    // Add this line
    setupDashboardButtons();

    console.log('Application initialization complete.');
}

<<<<<<< HEAD
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
// Update the switchTab function
function switchTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'homeTab' ? 'block' : 'none';
    document.getElementById('analysisPage').style.display = tabId === 'analysisTab' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Load data for analysis tab if selected
    if (tabId === 'analysisTab') {
        const dashboardContainer = document.getElementById('embedded-dashboard');
        embedQuickSightDashboard(dashboardContainer, 'daily');  // Load daily view by default
    }
}

// Handle errors
=======
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
function handleError(error) {
    console.error('Application error:', error);
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        redirectToLogin();
    }
}

<<<<<<< HEAD
// Global error handler
=======
// Event Listeners
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
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

<<<<<<< HEAD
// Handle unload
window.addEventListener('beforeunload', () => {
    closeConnection();
});

// Check authentication periodically
=======
// Periodic authentication check
>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
setInterval(() => {
    if (!getCurrentUser()) {
        console.log('User session expired');
        redirectToLogin();
    }
}, 5 * 60 * 1000); // Check every 5 minutes

<<<<<<< HEAD
// Export for potential external use
=======
// Make functions available globally
window.switchTab = switchTab;

>>>>>>> parent of e5a7868 (To the previous version before implementing floors)
export {
    initializeApp,
    handleError,
    checkAuthentication,
    switchTab
};