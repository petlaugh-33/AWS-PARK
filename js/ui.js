import { STORAGE_KEYS } from './constants.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';

let occupancyChart = null;

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
    mainStatus.className = `status-card card shadow-sm mb-4 status-${data.parkingStatus}`;
    
    document.getElementById('availableSpaces').textContent = data.availableSpaces;
    document.getElementById('occupiedSpaces').textContent = data.occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${data.occupancyRate}%`;
    
    const bar = document.getElementById('occupancyBar');
    bar.style.width = `${data.occupancyRate}%`;
    
    updateOccupancyBarColor(bar, data.occupancyRate);
    
    document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();
    
    mainStatus.classList.add('update-animation');
    setTimeout(() => mainStatus.classList.remove('update-animation'), 1000);

    saveToLocalStorage(STORAGE_KEYS.CURRENT_STATUS, data);
    updateDataStorageTime();
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
export function updateHistoryTable(history) {
    const tbody = document.getElementById('historyTable');
    if (!tbody) return;

    tbody.innerHTML = history
        .filter(validateHistoryEntry)
        .map(entry => createHistoryRow(entry))
        .join('');
}

// Validate history entry
function validateHistoryEntry(entry) {
    return entry.time && 
           typeof entry.available === 'number' && 
           typeof entry.occupied === 'number' && 
           entry.status;
}

// Create history table row
function createHistoryRow(entry) {
    return `
        <tr>
            <td>${entry.time}</td>
            <td>${entry.available}</td>
            <td>${entry.occupied}</td>
            <td><span class="badge bg-${getStatusBadgeColor(entry.status)}">${entry.status}</span></td>
        </tr>
    `;
}

// Get status badge color
function getStatusBadgeColor(status) {
    return status === 'AVAILABLE' ? 'success' : 
           status === 'LIMITED' ? 'warning' : 
           'danger';
}

// Update chart
export function updateChart(data, timeframe) {
    const ctx = document.getElementById('occupancyChart').getContext('2d');
    
    if (occupancyChart) {
        occupancyChart.destroy();
    }
    
    const chartConfig = createChartConfig(data, timeframe);
    occupancyChart = new Chart(ctx, chartConfig);

    updatePeakInfo(data);
    saveToLocalStorage(`chartData_${timeframe}`, data);
}

// Create chart configuration
function createChartConfig(data, timeframe) {
    const labels = getChartLabels(timeframe);
    const chartData = timeframe === 'daily' ? data.hourly : data.daily;
    
    return {
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
        options: getChartOptions(timeframe)
    };
}

// Get chart labels based on timeframe
function getChartLabels(timeframe) {
    return timeframe === 'daily' ?
        Array.from({length: 24}, (_, i) => `${i}:00`) :
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

// Get chart options
function getChartOptions(timeframe) {
    return {
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
    };
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
    container.insertAdjacentElement('beforebegin', messageDiv);
    
    setTimeout(() => messageDiv.remove(), 3000);
}

// Update data storage time
function updateDataStorageTime() {
    const storageTimeElement = document.getElementById('dataStorageTime');
    if (storageTimeElement) {
        const lastUpdated = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS)?.lastUpdated;
        storageTimeElement.textContent = lastUpdated ? 
            new Date(lastUpdated).toLocaleString() : 
            'No data stored';
    }
}

// Initialize UI
export function initializeUI() {
    // Add tab event listeners
    document.getElementById('homeTab').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('homeTab');
    });

    document.getElementById('analysisTab').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('analysisTab');
    });

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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUI);
