import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

// Constants for floor management
const SPOTS_PER_FLOOR = 6;
const FLOORS = ['P1', 'P2', 'P3', 'P4'];

// Cache and state management
let reservationsCache = new Map();
const floorStats = {
    P1: { available: SPOTS_PER_FLOOR, occupied: 0, reservations: new Set() },
    P2: { available: SPOTS_PER_FLOOR, occupied: 0, reservations: new Set() },
    P3: { available: SPOTS_PER_FLOOR, occupied: 0, reservations: new Set() },
    P4: { available: SPOTS_PER_FLOOR, occupied: 0, reservations: new Set() }
};

export function initializeReservationSystem() {
    try {
        console.log('Initializing reservation system...');
        
        // Initialize reservation forms
        const reservationForms = ['reservationForm', 'myReservationsForm'];
        reservationForms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                const startTimeInput = form.querySelector('[id^="startTime"]');
                const endTimeInput = form.querySelector('[id^="endTime"]');
                const floorSelect = form.querySelector('[id*="floorSelect"]');
                
                if (startTimeInput && endTimeInput) {
                    startTimeInput.addEventListener('change', handleStartTimeChange);
                    form.addEventListener('submit', handleReservationSubmit);
                }

                if (floorSelect) {
                    floorSelect.addEventListener('change', (e) => updateFloorStatsDisplay(e.target.value));
                }
            }
        });

        // Initialize all floor stats
        FLOORS.forEach(floor => {
            updateFloorStatsDisplay(floor);
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
    console.log(`Finding available spot for floor ${floor}`);
    
    // Get current reservations for this floor during the specified time period
    const floorReservations = Array.from(reservationsCache.values())
        .filter(r => 
            r.floor === floor && 
            r.status === 'CONFIRMED' &&
            new Date(r.startTime) < new Date(endTime) &&
            new Date(r.endTime) > new Date(startTime)
        );

    console.log(`Current reservations for floor ${floor}:`, floorReservations);

    if (floorReservations.length >= SPOTS_PER_FLOOR) {
        throw new Error(`No spots available on floor ${floor} for the selected time period`);
    }

    // Find first available spot number
    const usedSpots = new Set(floorReservations.map(r => r.spotNumber));
    for (let i = 1; i <= SPOTS_PER_FLOOR; i++) {
        if (!usedSpots.has(i)) {
            console.log(`Selected spot ${i} on floor ${floor}`);
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

        console.log('Creating reservation with data:', requestData);

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
                reservationId: data.reservationId,
                floor: selectedFloor,
                spotNumber: nextSpot,
                status: 'CONFIRMED'
            };
            
            console.log('Storing reservation:', reservation);
            reservationsCache.set(data.reservationId, reservation);

            // Update floor stats
            floorStats[selectedFloor].reservations.add(nextSpot);
            updateFloorStatsDisplay(selectedFloor);

            try {
                await sendConfirmationEmail(data.reservationId, user.email, startTime, endTime);
            } catch (emailError) {
                console.error('Email confirmation error:', emailError);
            }
        }
        
        form.reset();
        showSuccessMessage('Reservation created successfully! Check your email for confirmation.');
        await loadUserReservations();
        updateAllFloorStats();
        
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

        // Update floor stats
        if (reservation.floor) {
            floorStats[reservation.floor].reservations.delete(reservation.spotNumber);
            updateFloorStatsDisplay(reservation.floor);
        }

        reservationsCache.delete(reservationId);
        showSuccessMessage('Reservation cancelled successfully!');
        await loadUserReservations();
        updateAllFloorStats();
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

        // Reset floor stats and cache
        reservationsCache.clear();
        FLOORS.forEach(floor => {
            floorStats[floor].reservations.clear();
            floorStats[floor].occupied = 0;
            floorStats[floor].available = SPOTS_PER_FLOOR;
        });

        // Update cache and floor stats
        reservations.forEach(reservation => {
            const validatedReservation = {
                ...reservation,
                floor: reservation.floor || 'P1', // Default to P1 if floor is missing
                spotNumber: reservation.spotNumber || 1 // Default to 1 if spot number is missing
            };
            reservationsCache.set(reservation.reservationId, validatedReservation);
            if (validatedReservation.floor) {
                floorStats[validatedReservation.floor].reservations.add(validatedReservation.spotNumber);
            }
        });

        // Update all displays
        updateReservationTables(reservations);
        updateReservationStatistics(reservations);
        updateAllFloorStats();
        
        saveToLocalStorage('userReservations', reservations);
        
        return reservations;
    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations. Please try again later.');
        return [];
    }
}

function updateAllFloorStats() {
    FLOORS.forEach(floor => {
        updateFloorStatsDisplay(floor);
    });
}

function updateFloorStatsDisplay(floor) {
    const now = new Date();
    
    // Get active reservations for this floor
    const activeReservations = Array.from(reservationsCache.values())
        .filter(r => 
            r.floor === floor &&
            r.status === 'CONFIRMED' &&
            new Date(r.startTime) <= now &&
            new Date(r.endTime) > now
        );

    const occupied = activeReservations.length;
    const available = SPOTS_PER_FLOOR - occupied;
    const occupancyRate = Math.round((occupied / SPOTS_PER_FLOOR) * 100);

    console.log(`Updating stats for floor ${floor}:`, {
        occupied,
        available,
        occupancyRate
    });

    // Update UI elements
    document.getElementById(`${floor}-availableSpaces`).textContent = available;
    document.getElementById(`${floor}-occupiedSpaces`).textContent = occupied;
    
    const progressBar = document.getElementById(`${floor}-occupancyBar`);
    if (progressBar) {
        progressBar.style.width = `${occupancyRate}%`;
        progressBar.setAttribute('aria-valuenow', occupancyRate);
        
        // Update color based on occupancy
        if (occupancyRate >= 80) {
            progressBar.className = 'progress-bar bg-danger';
        } else if (occupancyRate >= 50) {
            progressBar.className = 'progress-bar bg-warning';
        } else {
            progressBar.className = 'progress-bar bg-success';
        }
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

// Helper functions remain the same
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

function getStatusColor(status) {
    switch (status) {
        case 'CONFIRMED': return 'success';
        case 'PENDING': return 'warning';
        case 'CANCELLED': return 'danger';
        case 'COMPLETED': return 'info';
        default: return 'secondary';
    }
}

function startReservationRefresh() {
    setInterval(loadUserReservations, RESERVATION_REFRESH_INTERVAL);
}

function startPeriodicUpdates() {
    setInterval(async () => {
        await loadUserReservations();
    }, 60000);
}

// Initialize everything
window.cancelReservation = cancelReservation;

document.addEventListener('DOMContentLoaded', initializeReservationSystem);

export { reservationsCache, floorStats };
