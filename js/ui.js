import { STORAGE_KEYS, CHART_TYPES, API_ENDPOINT, MAX_HISTORY } from './constants.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';

let occupancyChart = null;
let lastOccupancyUpdate = null;
let lastValidOccupancy = null;
let lastUpdatedFrom = null;
let lastUpdatedAt = 0;

function convertToEST(dateString) {
    const date = new Date(dateString);
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Initialize UI

export function initializeUI() {
    // Load any last occupancy data (if needed)
    loadLastOccupancy();
    
    // History and chart updates
    const savedHistory = loadFromLocalStorage(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
        updateHistoryTable(savedHistory);
    }
    
    const lastChartType = loadFromLocalStorage(STORAGE_KEYS.LAST_CHART_TYPE) || CHART_TYPES.DAILY;
    loadHistoricalData(lastChartType);

    // Set the initial active tab to 'home'
    switchTab('homeTab');

    // Update the UI element that shows when data was last updated
    updateDataStorageTime();
}

async function initializeApp() {
    console.log('Initializing application...');

    const user = getCurrentUser();
    if (!user) {
        console.log('Authentication check failed. Redirecting to login.');
        redirectToLogin();
        return;
    }
    
    console.log('Authentication successful. Continuing initialization for user:', user.email);
    initializeStorage();
    
    // Load the cached status and apply it immediately
    const cachedStatus = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS);
    if (cachedStatus) {
        console.log('[App] Using cached image status:', cachedStatus);
        updateStatus(cachedStatus, 'local');  // This saves it (if needed) and updates the UI from local storage.
    }
    
    initializeUI();
    initializeWebSocketWithAuth();
    initializeReservationSystem();
    updateUserInterface(user);

    setInterval(cleanupStorageData, 60 * 60 * 1000);
    setupTabNavigation();

    console.log('Application initialization complete.');
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

// Add this function to load the last occupancy on initialization
function loadLastOccupancy() {
    const stored = localStorage.getItem('lastOccupancyUpdate');
    if (stored) {
        lastOccupancyUpdate = JSON.parse(stored);
        console.log('Loaded previous occupancy:', lastOccupancyUpdate);
    }
}

function applyStatusFromLocalStorage() {
    const storedStatus = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS);
    if (!storedStatus) {
        console.warn('No status found in local storage to apply.');
        return;
    }

    // Convert values to numbers if needed
    const statusData = {
        ...storedStatus,
        availableSpaces: Number(storedStatus.availableSpaces),
        occupiedSpaces: Number(storedStatus.occupiedSpaces),
        occupancyRate: Number(storedStatus.occupancyRate)
    };

    console.log('Applying status from local storage:', statusData);

    // Update the UI elements
    document.getElementById('availableSpaces').textContent = statusData.availableSpaces;
    document.getElementById('occupiedSpaces').textContent = statusData.occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${Math.round(statusData.occupancyRate)}%`;
    
    const bar = document.getElementById('occupancyBar');
    bar.style.width = `${statusData.occupancyRate}%`;
    updateOccupancyBarColor(bar, statusData.occupancyRate);
    
    document.getElementById('lastUpdated').textContent = new Date(statusData.lastUpdated)
        .toLocaleString('en-US', { timeZone: 'America/New_York' });

    const mainStatus = document.getElementById('mainStatus');
    mainStatus.className = `status-card card shadow-sm mb-4 status-${statusData.parkingStatus}`;
    mainStatus.classList.add('update-animation');
    setTimeout(() => mainStatus.classList.remove('update-animation'), 1000);
    
    updateDataStorageTime();
}

export function updateStatus(data, source = 'unknown') {
    const now = Date.now();
    const isImageUpdate = data.lastAnalysis !== undefined;

    lastUpdatedFrom = source;
    lastUpdatedAt = now;

    console.log(`[updateStatus] Applying update from ${source}`, data);

    // 💾 Save any status update to localStorage
    const localData = {
        occupiedSpaces: data.occupiedSpaces,
        availableSpaces: data.availableSpaces,
        occupancyRate: data.occupancyRate,
        parkingStatus: data.parkingStatus,
        lastUpdated: data.lastUpdated,
        lotId: data.lotId,
        lastAnalysis: data.lastAnalysis || null
    };
    saveToLocalStorage(STORAGE_KEYS.CURRENT_STATUS, localData);

    // 🛑 Only image-based updates modify the UI
    if (!isImageUpdate) {
        console.log('[updateStatus] Skipping UI update for non-image update');
        return;
    }

    // ✅ Update last known image status
    lastValidOccupancy = {
        occupiedSpaces: data.occupiedSpaces,
        availableSpaces: data.availableSpaces,
        occupancyRate: data.occupancyRate
    };

    // 👷‍♂️ Format UI status data
    const statusData = {
        ...data,
        availableSpaces: Number(data.availableSpaces),
        occupiedSpaces: Number(data.occupiedSpaces),
        occupancyRate: Number(data.occupancyRate)
    };

    console.log('Processed status data:', statusData);

    const mainStatus = document.getElementById('mainStatus');
    mainStatus.className = `status-card card shadow-sm mb-4 status-${statusData.parkingStatus}`;

    updateReservationStats(statusData);

    document.getElementById('availableSpaces').textContent = statusData.availableSpaces;
    document.getElementById('occupiedSpaces').textContent = statusData.occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${statusData.occupancyRate}%`;

    const bar = document.getElementById('occupancyBar');
    bar.style.width = `${statusData.occupancyRate}%`;
    updateOccupancyBarColor(bar, statusData.occupancyRate);

    document.getElementById('lastUpdated').textContent = new Date(statusData.lastUpdated)
        .toLocaleString('en-US', { timeZone: 'America/New_York' });

    mainStatus.classList.add('update-animation');
    setTimeout(() => mainStatus.classList.remove('update-animation'), 1000);

    updateDataStorageTime();
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

// Load historical data
export async function loadHistoricalData(timeframe) {
    try {
        saveToLocalStorage(STORAGE_KEYS.LAST_CHART_TYPE, timeframe);
        const response = await fetch(`${API_ENDPOINT}/historical?type=${timeframe}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        updateChart(data, timeframe);
    } catch (error) {
        console.error('Error loading historical data:', error);
        const chartError = document.getElementById('chartError');
        if (chartError) {
            chartError.textContent = `Failed to load historical data: ${error.message}`;
            chartError.style.display = 'block';
        }
    }
}

// Update chart
export function updateChart(data, timeframe) {
    const ctx = document.getElementById('occupancyChart')?.getContext('2d');
    if (!ctx) return;
    
    if (occupancyChart) {
        occupancyChart.destroy();
    }
    
    const labels = getChartLabels(timeframe);
    const chartData = timeframe === 'daily' ? data.hourly : data.daily;
    
    occupancyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Average Occupancy Rate',
                data: labels.map(label => {
                    const key = timeframe === 'daily' ? 
                        label.split(':')[0] : 
                        labels.indexOf(label).toString();
                    return chartData[key] || 0;
                }),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Occupancy Rate (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: timeframe === 'daily' ? 'Hour of Day' : 'Day of Week'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Parking Occupancy - ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} View`
                }
            }
        }
    });

    updatePeakInfo(data);
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

// Get chart labels
function getChartLabels(timeframe) {
    return timeframe === 'daily' ?
        Array.from({length: 24}, (_, i) => `${i}:00`) :
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

// Update peak information
function updatePeakInfo(data) {
    const peakInfo = document.getElementById('peakInfo');
    if (peakInfo && data.peak) {
        peakInfo.textContent = `Peak: ${data.peak.peak.toFixed(2)}%, Off-Peak: ${data.peak.offPeak.toFixed(2)}%`;
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
