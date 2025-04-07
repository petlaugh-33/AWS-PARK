import { STORAGE_KEYS, CHART_TYPES, API_ENDPOINT, MAX_HISTORY } from './constants.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';

function convertToEST(dateString) {
    const date = new Date(dateString);
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

export function initializeUI() {
    try {
        setupTabListeners();
        loadInitialData();
        switchTab('homeTab');
        updateDataStorageTime();
        console.log('UI initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing UI:', error);
        return false;
    }
}

function setupTabListeners() {
    ['homeTab', 'analysisTab'].forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(tabId);
            });
        }
    });
}

function loadInitialData() {
    const savedStatus = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS);
    if (savedStatus) updateStatus(savedStatus);

    const savedHistory = loadFromLocalStorage(STORAGE_KEYS.HISTORY);
    if (savedHistory) updateHistoryTable(savedHistory);
}

export function switchTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'homeTab' ? 'block' : 'none';
    document.getElementById('analysisPage').style.display = tabId === 'analysisTab' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

export function updateStatus(data) {
    console.log('Updating status with data:', data);
    
    ['P1', 'P2', 'P3', 'P4'].forEach(floor => updateFloorDisplay(floor, data));
    updateLastUpdated(data.lastUpdated);
    updateReservationStats(data);
}

function updateFloorDisplay(floor, data) {
    try {
        updateElement(`${floor}-availableSpaces`, data.availableSpaces || 6);
        updateElement(`${floor}-occupiedSpaces`, data.occupiedSpaces || 0);
        updateOccupancyBar(`${floor}-occupancyBar`, data.occupiedSpaces);
    } catch (error) {
        console.error(`Error updating floor ${floor}:`, error);
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        element.classList.add('update-animation');
        setTimeout(() => element.classList.remove('update-animation'), 1000);
    }
}

function updateOccupancyBar(id, occupiedSpaces) {
    const bar = document.getElementById(id);
    if (bar) {
        const occupancyRate = (occupiedSpaces / 6) * 100;
        bar.style.width = `${occupancyRate}%`;
        bar.className = `progress-bar ${getOccupancyClass(occupancyRate)}`;
        bar.classList.add('bar-update-animation');
        setTimeout(() => bar.classList.remove('bar-update-animation'), 1000);
    }
}

function getOccupancyClass(rate) {
    if (rate >= 90) return 'bg-danger';
    if (rate >= 70) return 'bg-warning';
    return 'bg-success';
}

function updateLastUpdated(timestamp) {
    updateElement('lastUpdated', formatDateTime(timestamp));
}

export function initializeWebSocket() {
    console.log('Initializing WebSocket connection...');
    const ws = new WebSocket('wss://bt7t18tvag.execute-api.us-east-1.amazonaws.com/production');
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        sendHeartbeat(ws);
    };
    
    ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'status_update') handleStatusUpdate(message);
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };
    
    ws.onerror = (error) => console.error('WebSocket error:', error);
    
    ws.onclose = () => {
        console.log('WebSocket closed. Attempting to reconnect...');
        setTimeout(initializeWebSocket, 3000);
    };

    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) sendHeartbeat(ws);
    }, 30000);

    return ws;
}

function sendHeartbeat(ws) {
    ws.send(JSON.stringify({ action: 'heartbeat' }));
}

function handleStatusUpdate(message) {
    const data = message.floors ? message.floors.P1 : message.data;
    if (data) {
        updateStatus(data);
        addToHistory(data);
    }
}

function updateReservationStats(status) {
    if (status) {
        updateElement('activeReservations', status.activeReservations || 0);
        updateElement('upcomingReservations', status.upcomingReservations || 0);
    }
}

export function addToHistory(data) {
    try {
        if (!validateHistoryData(data)) {
            console.error('Invalid data received:', data);
            return;
        }

        const history = loadFromLocalStorage(STORAGE_KEYS.HISTORY) || [];
        history.unshift({
            time: new Date(data.lastUpdated).toLocaleTimeString(),
            available: data.availableSpaces,
            occupied: data.occupiedSpaces,
            status: data.parkingStatus
        });

        if (history.length > MAX_HISTORY) history.pop();

        saveToLocalStorage(STORAGE_KEYS.HISTORY, history);
        updateHistoryTable(history);
    } catch (error) {
        console.error('Error adding to history:', error);
    }
}

function validateHistoryData(data) {
    return data &&
           data.lastUpdated &&
           typeof data.availableSpaces === 'number' &&
           typeof data.occupiedSpaces === 'number' &&
           data.parkingStatus;
}

function updateHistoryTable(history) {
    const tbody = document.getElementById('historyTable');
    if (!tbody) return;

    tbody.innerHTML = history
        .filter(entry => validateHistoryEntry(entry))
        .map(createHistoryRow)
        .join('');
}

function validateHistoryEntry(entry) {
    return entry && 
           entry.time && 
           typeof entry.available === 'number' && 
           typeof entry.occupied === 'number' && 
           entry.status;
}

function createHistoryRow(entry) {
    return `
        <tr>
            <td>${formatDateTime(entry.time)}</td>
            <td>${entry.available}</td>
            <td>${entry.occupied}</td>
            <td><span class="badge bg-${getStatusBadgeColor(entry.status)}">${entry.status}</span></td>
        </tr>
    `;
}

function getStatusBadgeColor(status) {
    switch (status) {
        case 'AVAILABLE': return 'success';
        case 'LIMITED': return 'warning';
        case 'FULL': return 'danger';
        default: return 'secondary';
    }
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

export function showSuccessMessage(message) {
    showMessage(message, 'success');
}

export function showErrorMessage(message) {
    showMessage(message, 'danger');
}

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

function updateDataStorageTime() {
    const storageTimeElement = document.getElementById('dataStorageTime');
    if (storageTimeElement) {
        const lastUpdated = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STATUS)?.lastUpdated;
        storageTimeElement.textContent = lastUpdated ? 
            formatDateTime(lastUpdated) : 
            'No data stored';
    }
}