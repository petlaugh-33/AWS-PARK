import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

let reservationsCache = new Map();
const SPOTS_PER_FLOOR = 6;
const FLOORS = ['P1', 'P2', 'P3', 'P4'];

// Track spots per floor
const floorOccupancy = {
    P1: new Set(),
    P2: new Set(),
    P3: new Set(),
    P4: new Set()
};

export function initializeReservationSystem() {
    try {
        const reservationForms = ['reservationForm', 'myReservationsForm'];
        reservationForms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                const startTimeInput = form.querySelector('[id^="startTime"]');
                const endTimeInput = form.querySelector('[id^="endTime"]');
                const floorSelect = form.querySelector('select[id*="floorSelect"]');
                
                if (startTimeInput && endTimeInput) {
                    startTimeInput.addEventListener('change', handleStartTimeChange);
                    form.addEventListener('submit', handleReservationSubmit);
                }

                if (floorSelect) {
                    floorSelect.addEventListener('change', (e) => {
                        updateParkingStatus(e.target.value);
                    });
                }
            }
        });

        loadUserReservations();
        startReservationRefresh();
        startPeriodicUpdates();

        return true;
    } catch (error) {
        console.error('Error initializing reservation system:', error);
        return false;
    }
}

function handleStartTimeChange(event) {
    const startTime = event.target.value;
    if (startTime) {
        const form = event.target.closest('form');
        const endTimeInput = form.querySelector('[id^="endTime"]');
        if (endTimeInput) {
            endTimeInput.min = startTime;
        }
    }
}

function convertToEST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function getNextAvailableSpotForFloor(floor, startTime, endTime) {
    // Get current reservations for this floor during the specified time period
    const floorReservations = Array.from(reservationsCache.values())
        .filter(r => 
            r.floor === floor && 
            r.status === 'CONFIRMED' &&
            new Date(r.startTime) < new Date(endTime) &&
            new Date(r.endTime) > new Date(startTime)
        );

    console.log(`Checking spots for floor ${floor}:`, {
        totalReservations: floorReservations.length,
        maxSpots: SPOTS_PER_FLOOR
    });

    if (floorReservations.length >= SPOTS_PER_FLOOR) {
        throw new Error(`No spots available on floor ${floor} for the selected time period`);
    }

    // Find first available spot number for this floor
    const usedSpots = new Set(floorReservations.map(r => r.spotNumber));
    for (let i = 1; i <= SPOTS_PER_FLOOR; i++) {
        if (!usedSpots.has(i)) {
            console.log(`Found available spot ${i} on floor ${floor}`);
            return i;
        }
    }

    throw new Error(`No spots available on floor ${floor}`);
}
export async function handleReservationSubmit(event) {
    event.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        console.log('No authenticated user');
        return;
    }

    const form = event.target;
    const formId = form.id;
    
    const floorSelect = formId === 'reservationForm' ? 
        document.getElementById('floorSelect') : 
        document.getElementById('floorSelectReservations');

    const startTimeInput = formId === 'reservationForm' ? 
        document.getElementById('startTime') : 
        document.getElementById('startTimeReservations');
    
    const endTimeInput = formId === 'reservationForm' ? 
        document.getElementById('endTime') : 
        document.getElementById('endTimeReservations');

    if (!floorSelect || !floorSelect.value) {
        showErrorMessage('Please select a floor');
        return;
    }

    if (!startTimeInput || !endTimeInput) {
        showErrorMessage('Required form fields not found');
        return;
    }

    const selectedFloor = floorSelect.value;
    const startTime = convertToEST(new Date(startTimeInput.value));
    const endTime = convertToEST(new Date(endTimeInput.value));

    if (!validateReservationTimes(startTime, endTime)) {
        return;
    }
    
    try {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';

        // Get next available spot for the selected floor
        const nextSpot = await getNextAvailableSpotForFloor(selectedFloor, startTime, endTime);

        const requestData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            userId: user.sub,
            userEmail: user.email,
            spotNumber: nextSpot,
            floor: selectedFloor,
            status: 'CONFIRMED'
        };

        console.log('Creating reservation:', requestData);

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            },
            body: JSON.stringify(requestData),
            credentials: 'include'
        });
        
        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to create reservation');
        }

        const data = await response.json();

        if (data.reservationId) {
            const reservation = {
                ...requestData,
                reservationId: data.reservationId
            };
            console.log('Storing reservation in cache:', reservation);
            reservationsCache.set(data.reservationId, reservation);

            // Update floor occupancy
            floorOccupancy[selectedFloor].add(nextSpot);

            try {
                await sendConfirmationEmail(data.reservationId, user.email, startTime, endTime);
            } catch (emailError) {
                console.error('Email confirmation error:', emailError);
            }
        }
        
        form.reset();
        showSuccessMessage('Reservation created successfully! Check your email for confirmation.');
        await loadUserReservations();
        updateParkingStatus(selectedFloor); // Update stats for the selected floor
        
    } catch (error) {
        console.error('Reservation error:', error);
        showErrorMessage(error.message || 'Failed to create reservation');
    } finally {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Make Reservation';
    }
}

export async function cancelReservation(reservationId) {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.log('No authenticated user');
            redirectToLogin();
            return false;
        }

        const reservation = reservationsCache.get(reservationId);
        if (!reservation) {
            throw new Error('Reservation not found');
        }

        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
        }

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations/${reservationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            },
            credentials: 'include'
        });

        if (response.status === 401) {
            redirectToLogin();
            return false;
        }

        if (!response.ok) {
            throw new Error('Failed to cancel reservation');
        }

        // Remove from floor occupancy
        floorOccupancy[reservation.floor].delete(reservation.spotNumber);
        reservationsCache.delete(reservationId);
        
        showSuccessMessage('Reservation cancelled successfully!');
        await loadUserReservations();
        updateParkingStatus(reservation.floor); // Update stats for the affected floor
        return true;
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showErrorMessage(`Failed to cancel reservation: ${error.message}`);
        return false;
    } finally {
        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Cancel';
        }
    }
}
export async function loadUserReservations() {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.log('No authenticated user');
            return [];
        }

        const idToken = localStorage.getItem("idToken");
        if (!idToken) {
            console.error('No idToken found');
            return [];
        }

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let reservations = Array.isArray(data) ? data : [];
        
        // Filter active reservations
        reservations = reservations.filter(reservation => 
            (reservation.userId === user.sub || reservation.userEmail === user.email) &&
            reservation.status !== 'CANCELLED'
        );

        console.log('Loaded reservations:', reservations);

        // Clear floor occupancy tracking
        FLOORS.forEach(floor => floorOccupancy[floor].clear());

        // Update cache and floor occupancy
        reservationsCache.clear();
        reservations.forEach(reservation => {
            reservationsCache.set(reservation.reservationId, reservation);
            if (reservation.floor && reservation.spotNumber) {
                floorOccupancy[reservation.floor].add(reservation.spotNumber);
            }
        });

        // Update UI
        updateReservationTables(reservations);
        updateReservationStatistics(reservations);
        
        // Update parking status for all floors
        FLOORS.forEach(floor => {
            updateParkingStatus(floor);
        });
        
        saveToLocalStorage('userReservations', reservations);
        
        return reservations;
    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations. Please try again later.');
        return [];
    }
}

function updateParkingStatus(selectedFloor) {
    const now = new Date();
    
    // Get active reservations for the selected floor
    const floorReservations = Array.from(reservationsCache.values())
        .filter(r => 
            r.floor === selectedFloor &&
            r.status === 'CONFIRMED' &&
            new Date(r.startTime) <= now &&
            new Date(r.endTime) > now
        );

    const occupiedSpaces = floorReservations.length;
    const availableSpaces = SPOTS_PER_FLOOR - occupiedSpaces;
    const occupancyRate = Math.round((occupiedSpaces / SPOTS_PER_FLOOR) * 100);

    console.log(`Updating status for floor ${selectedFloor}:`, {
        occupied: occupiedSpaces,
        available: availableSpaces,
        rate: occupancyRate
    });

    // Update UI elements with floor-specific information
    document.getElementById('availableSpaces').textContent = `${availableSpaces}`;
    document.getElementById('occupiedSpaces').textContent = `${occupiedSpaces}`;
    document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;
    
    const occupancyBar = document.getElementById('occupancyBar');
    if (occupancyBar) {
        occupancyBar.style.width = `${occupancyRate}%`;
        occupancyBar.setAttribute('aria-valuenow', occupancyRate);
    }

    // Add floor indicator to the stats
    const statsTitle = document.querySelector('.status-card .card-title');
    if (statsTitle) {
        statsTitle.textContent = `Parking Status - Floor ${selectedFloor}`;
    }

    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

function updateReservationTables(reservations) {
    const now = new Date();
    const upcoming = reservations.filter(r => new Date(r.endTime) > now);
    const past = reservations.filter(r => new Date(r.endTime) <= now);

    updateTable('reservationsTable', upcoming, true);
    updateTable('upcomingReservationsTable', upcoming, true);
    updateTable('pastReservationsTable', past, false);
}

function updateTable(tableId, reservations, includeActions) {
    const table = document.getElementById(tableId);
    if (!table) return;

    table.innerHTML = '';

    if (reservations.length === 0) {
        const colspan = includeActions ? 5 : 4;
        table.innerHTML = `<tr><td colspan="${colspan}" class="text-center">No reservations found</td></tr>`;
        return;
    }

    console.log(`Updating table ${tableId} with reservations:`, reservations);

    reservations
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .forEach(reservation => {
            const row = document.createElement('tr');
            const spotDisplay = `${reservation.floor}-${reservation.spotNumber}`;

            row.innerHTML = `
                <td>${formatDateTime(reservation.startTime)}</td>
                <td>${formatDateTime(reservation.endTime)}</td>
                <td>${spotDisplay}</td>
                <td><span class="badge bg-${getStatusColor(reservation.status)}">${reservation.status}</span></td>
                ${includeActions ? `
                    <td>
                        ${reservation.status === 'CONFIRMED' ? `
                            <button class="btn btn-sm btn-danger" 
                                    onclick="window.cancelReservation('${reservation.reservationId}')">
                                Cancel
                            </button>
                        ` : ''}
                    </td>
                ` : ''}
            `;
            table.appendChild(row);
        });
}
function updateReservationStatistics(reservations) {
    const now = new Date();
    const active = reservations.filter(r => 
        new Date(r.startTime) <= now && new Date(r.endTime) > now
    ).length;
    const upcoming = reservations.filter(r => new Date(r.startTime) > now).length;

    updateStatElement('activeReservations', active);
    updateStatElement('activeReservationsCount', active);
    updateStatElement('upcomingReservations', upcoming);
    updateStatElement('upcomingReservationsCount', upcoming);
}

function updateStatElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function validateReservationTimes(startTime, endTime) {
    const now = new Date();
    const openingHour = 7;
    const closingHour = 23;

    if (startTime < now) {
        showErrorMessage('Start time must be in the future');
        return false;
    }

    if (endTime <= startTime) {
        showErrorMessage('End time must be after start time');
        return false;
    }

    if (startTime.getHours() < openingHour || startTime.getHours() > closingHour ||
        endTime.getHours() < openingHour || endTime.getHours() > closingHour) {
        showErrorMessage('Reservations must be between 7:00 AM and 11:00 PM EST');
        return false;
    }

    const duration = (endTime - startTime) / (1000 * 60 * 60);
    if (duration > 24) {
        showErrorMessage('Reservation cannot exceed 24 hours');
        return false;
    }

    if (duration < 1) {
        showErrorMessage('Reservation must be at least 1 hour');
        return false;
    }

    return true;
}

async function sendConfirmationEmail(reservationId, userEmail, startTime, endTime) {
    const token = localStorage.getItem('idToken');
    const response = await fetch(CONFIRMATION_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            reservationId,
            userEmail,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
        })
    });

    if (!response.ok) {
        throw new Error('Failed to send confirmation email');
    }

    return response.json();
}

function getStatusColor(status) {
    switch (status) {
        case 'CONFIRMED': return 'success';
        case 'PENDING': return 'warning';
        case 'CANCELLED': return 'danger';
        case 'COMPLETED': return 'info';
        default: return 'secondary';
    }
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
    });
}

function startReservationRefresh() {
    setInterval(loadUserReservations, RESERVATION_REFRESH_INTERVAL);
}

function startPeriodicUpdates() {
    setInterval(async () => {
        await loadUserReservations();
    }, 60000);
}

// Function to update stats when floor selection changes
function handleFloorSelection(event) {
    const selectedFloor = event.target.value;
    if (selectedFloor) {
        updateParkingStatus(selectedFloor);
    }
}

// Initialize floor selection handlers
function initializeFloorSelectors() {
    const floorSelects = document.querySelectorAll('#floorSelect, #floorSelectReservations');
    floorSelects.forEach(select => {
        select.addEventListener('change', handleFloorSelection);
    });
}

// Debug function to log floor occupancy
function logFloorOccupancy() {
    console.log('Current floor occupancy:', {
        ...floorOccupancy,
        totalReservations: reservationsCache.size
    });
}

// Initialize event listeners
window.cancelReservation = cancelReservation;

document.addEventListener('DOMContentLoaded', () => {
    initializeReservationSystem();
    initializeFloorSelectors();
    
    // Set initial floor stats if a floor is selected
    const defaultFloorSelect = document.getElementById('floorSelect');
    if (defaultFloorSelect && defaultFloorSelect.value) {
        updateParkingStatus(defaultFloorSelect.value);
    }

    // Add debug logging
    setInterval(logFloorOccupancy, 30000);
});

export { reservationsCache };
