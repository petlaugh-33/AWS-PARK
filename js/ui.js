import { STORAGE_KEYS, CHART_TYPES, API_ENDPOINT, MAX_HISTORY } from './constants.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';

function convertToEST(dateString) {
    const date = new Date(dateString);
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Initialize UI
export function initializeUI() {
        try {
            // Add tab event listeners
            const homeTab = document.getElementById('homeTab');
            const analysisTab = document.getElementById('analysisTab');
    
            if (homeTab) {
                homeTab.addEventListener('click', (e) => {
                    e.preventDefault();
                    switchTab('homeTab');
                });
            }
    
            if (analysisTab) {
                analysisTab.addEventListener('click', (e) => {
                    e.preventDefault();
                    switchTab('analysisTab');
                });
            }
    
            // Load initial data
            const savedStatus = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS);
            if (savedStatus) {
                updateStatus(savedStatus);
            }
    
            const savedHistory = loadFromLocalStorage(STORAGE_KEYS.HISTORY);
            if (savedHistory) {
                updateHistoryTable(savedHistory);
            }
    
            // Set initial tab
            switchTab('homeTab');
    
            // Update storage time display
            updateDataStorageTime();
    
            console.log('UI initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing UI:', error);
            return false;
        }
}

// Tab switching functionality
export function switchTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'homeTab' ? 'block' : 'none';
    document.getElementById('analysisPage').style.display = tabId === 'analysisTab' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

// Update parking status
export function updateStatus(data) {
    console.log('Updating status with data:', data);
    const mainStatus = document.getElementById('mainStatus');
    if (!mainStatus) {
        console.warn('Main status element not found');
        return;
    }

    mainStatus.className = `status-card card shadow-sm mb-4 status-${data.parkingStatus}`;

    // Update reservation stats if the function exists
    if (typeof updateReservationStats === 'function') {
        updateReservationStats(data);
    }
    // Safely update elements
    document.getElementById('availableSpaces').textContent = data.availableSpaces;
    document.getElementById('occupiedSpaces').textContent = data.occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${data.occupancyRate}%`;
    document.getElementById('lastUpdated').textContent = formatDateTime(data.lastUpdated);
    
    const bar = document.getElementById('occupancyBar');
    if (bar) {
        bar.style.width = `${data.occupancyRate}%`;
        updateOccupancyBarColor(bar, data.occupancyRate);
    }
    
    if (mainStatus) {
        mainStatus.classList.add('update-animation');
        setTimeout(() => mainStatus.classList.remove('update-animation'), 1000);
    }

    saveToLocalStorage(STORAGE_KEYS.CURRENT_STATUS, data);
    updateDataStorageTime();
}
// Helper function to safely update element content
function safelyUpdateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = content;
    } else {
        console.warn(`Element with id '${id}' not found`);
    }
}
// Add this function to your ui.js
function updateReservationStats(status) {
    if (status) {
        document.getElementById('activeReservations').textContent = status.activeReservations || 0;
        document.getElementById('upcomingReservations').textContent = status.upcomingReservations || 0;
    }
}

// Update occupancy bar color based on rate
function updateOccupancyBarColor(bar, rate) {
    if (rate < 70) {
        bar.className = 'progress-bar bg-success';
    } else if (rate < 90) {
        bar.className = 'progress-bar bg-warning';
    } else {
        bar.className = 'progress-bar bg-danger';
    }
}

// Add data to history
export function addToHistory(data) {
    try {
        if (!validateHistoryData(data)) {
            console.error('Invalid data received:', data);
            return;
        }

        const time = new Date(data.lastUpdated).toLocaleTimeString();
        const history = loadFromLocalStorage(STORAGE_KEYS.HISTORY) || [];
        
        history.unshift({
            time,
            available: data.availableSpaces,
            occupied: data.occupiedSpaces,
            status: data.parkingStatus
        });

        if (history.length > MAX_HISTORY) {
            history.pop();
        }

        saveToLocalStorage(STORAGE_KEYS.HISTORY, history);
        updateHistoryTable(history);
    } catch (error) {
        console.error('Error adding to history:', error);
    }
}

// Validate history data
function validateHistoryData(data) {
    return data &&
           data.lastUpdated &&
           typeof data.availableSpaces === 'number' &&
           typeof data.occupiedSpaces === 'number' &&
           data.parkingStatus;
}

// Update history table
function updateHistoryTable(history) {
    const tbody = document.getElementById('historyTable');
    if (!tbody) return;

    tbody.innerHTML = history
        .filter(entry => entry && entry.lastUpdated) // Validate entry has lastUpdated
        .map(entry => {
            // Format the time in EST
            const time = new Date(entry.lastUpdated).toLocaleString('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            return `
                <tr>
                    <td>${time}</td>
                    <td>${entry.availableSpaces}</td>
                    <td>${entry.occupiedSpaces}</td>
                    <td><span class="badge bg-${getStatusBadgeColor(entry.parkingStatus)}">${entry.parkingStatus}</span></td>
                </tr>
            `;
        })
        .join('');
}

// Helper function for status badge colors
function getStatusBadgeColor(status) {
    switch (status) {
        case 'AVAILABLE':
            return 'success';
        case 'LIMITED':
            return 'warning';
        case 'FULL':
            return 'danger';
        default:
            return 'secondary';
    }
}

// Add this helper function if you don't have it
function validateHistoryEntry(entry) {
    return entry && 
           entry.time && 
           typeof entry.available === 'number' && 
           typeof entry.occupied === 'number' && 
           entry.status;
}

// Create history table row
function createHistoryRow(entry) {
    return `
        <tr>
            <td>${new Date(entry.time).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
            <td>${entry.available}</td>
            <td>${entry.occupied}</td>
            <td><span class="badge bg-${getStatusBadgeColor(entry.status)}">${entry.status}</span></td>
        </tr>
    `;
}


function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return 'Invalid Date';
    }
}

// Show success message
export function showSuccessMessage(message) {
    showMessage(message, 'success');
}

// Show error message
export function showErrorMessage(message) {
    showMessage(message, 'danger');
}

// Show message helper
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} mt-3`;
    messageDiv.textContent = message;
    
    const container = document.querySelector('.table-responsive');
    if (container) {
        container.insertAdjacentElement('beforebegin', messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
    }
}

// Update data storage time
function updateDataStorageTime() {
    const storageTimeElement = document.getElementById('dataStorageTime');
    if (storageTimeElement) {
        const lastUpdated = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS)?.lastUpdated;
        storageTimeElement.textContent = lastUpdated ? 
            new Date(lastUpdated).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 
            'No data stored';
    }
}