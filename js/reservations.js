import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

let reservationsCache = new Map();
const TOTAL_PARKING_SPOTS = 6; // Set constant for total parking spots

export function initializeReservationSystem() {
    try {
        const reservationForms = ['reservationForm', 'myReservationsForm'];
        reservationForms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                const startTimeInput = form.querySelector('[id^="startTime"]');
                const endTimeInput = form.querySelector('[id^="endTime"]');
                
                if (startTimeInput && endTimeInput) {
                    startTimeInput.addEventListener('change', handleStartTimeChange);
                    form.addEventListener('submit', handleReservationSubmit);
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

async function getNextAvailableSpot(startTime, endTime) {
    try {
        const currentReservations = Array.from(reservationsCache.values());
        const overlappingReservations = currentReservations.filter(reservation => {
            const reservationStart = new Date(reservation.startTime);
            const reservationEnd = new Date(reservation.endTime);
            return (
                reservation.status === 'CONFIRMED' &&
                ((startTime >= reservationStart && startTime < reservationEnd) ||
                (endTime > reservationStart && endTime <= reservationEnd) ||
                (startTime <= reservationStart && endTime >= reservationEnd))
            );
        });

        // Create a set of occupied spot numbers during the requested time
        const occupiedSpots = new Set(overlappingReservations.map(r => r.spotNumber));

        // Find the first available spot number from 1 to TOTAL_PARKING_SPOTS
        for (let spotNumber = 1; spotNumber <= TOTAL_PARKING_SPOTS; spotNumber++) {
            if (!occupiedSpots.has(spotNumber)) {
                return spotNumber;
            }
        }
        
        throw new Error('No parking spots available for the selected time period');
    } catch (error) {
        console.error('Error getting next available spot:', error);
        throw error;
    }
}

function updateParkingStatus(reservations) {
    const now = new Date();
    
    // Count currently active reservations
    const occupiedSpaces = reservations.filter(reservation => {
        const startTime = new Date(reservation.startTime);
        const endTime = new Date(reservation.endTime);
        return startTime <= now && endTime > now && reservation.status === 'CONFIRMED';
    }).length;

    // Calculate available spaces and ensure it doesn't go below 0
    const availableSpaces = Math.max(0, TOTAL_PARKING_SPOTS - occupiedSpaces);
    
    // Calculate occupancy rate
    const occupancyRate = Math.round((occupiedSpaces / TOTAL_PARKING_SPOTS) * 100);

    // Update UI elements
    document.getElementById('availableSpaces').textContent = availableSpaces;
    document.getElementById('occupiedSpaces').textContent = occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;
    
    // Update progress bar
    const occupancyBar = document.getElementById('occupancyBar');
    if (occupancyBar) {
        occupancyBar.style.width = `${occupancyRate}%`;
        occupancyBar.setAttribute('aria-valuenow', occupancyRate);
        
        // Update color based on occupancy
        if (occupancyRate >= 80) {
            occupancyBar.className = 'progress-bar bg-danger';
        } else if (occupancyRate >= 50) {
            occupancyBar.className = 'progress-bar bg-warning';
        } else {
            occupancyBar.className = 'progress-bar bg-success';
        }
    }

    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

export async function handleReservationSubmit(event) {
    event.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        console.log('No authenticated user');
        return;
    }

    const form = event.target;
    const startTimeInput = form.querySelector('[id^="startTime"]');
    const endTimeInput = form.querySelector('[id^="endTime"]');

    if (!startTimeInput || !endTimeInput) {
        showErrorMessage('Required form fields not found');
        return;
    }

    const startTime = new Date(startTimeInput.value);
    const endTime = new Date(endTimeInput.value);

    if (!validateReservationTimes(startTime, endTime)) {
        return;
    }

    try {
        // Check for available spots
        const nextSpot = await getNextAvailableSpot(startTime, endTime);
        
        const requestData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            userId: user.sub,
            userEmail: user.email,
            spotNumber: nextSpot
        };
        
        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error('Failed to create reservation');
        }

        const data = await response.json();
        
        // Update cache with new reservation
        if (data.reservationId) {
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email,
                spotNumber: nextSpot
            });

            // Send confirmation email
            await sendConfirmationEmail(data.reservationId, user.email, startTime, endTime);
        }

        form.reset();
        showSuccessMessage('Reservation created successfully! Check your email for confirmation.');
        await loadUserReservations();

    } catch (error) {
        console.error('Reservation error:', error);
        showErrorMessage(error.message || 'Failed to create reservation');
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

        // Update button state during cancellation
        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
        }

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations/${reservationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to cancel reservation');
        }

        // Remove from cache and update UI
        reservationsCache.delete(reservationId);
        showSuccessMessage('Reservation cancelled successfully!');
        await loadUserReservations();

        return true;
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showErrorMessage(`Failed to cancel reservation: ${error.message}`);
        return false;
    } finally {
        // Reset button state
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

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let reservations = Array.isArray(data) ? data : [];
        
        // Filter active reservations for current user
        reservations = reservations.filter(reservation => 
            (reservation.userId === user.sub || reservation.userEmail === user.email) &&
            reservation.status !== 'CANCELLED'
        );

        // Update UI components
        updateReservationTables(reservations);
        updateReservationStatistics(reservations);
        updateParkingStatus(reservations);

        // Update cache
        reservationsCache.clear();
        reservations.forEach(reservation => {
            reservationsCache.set(reservation.reservationId, reservation);
        });
        
        saveToLocalStorage('userReservations', reservations);
        return reservations;

    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations. Please try again later.');
        return [];
    }
}

function updateReservationTables(reservations) {
    const now = new Date();
    const upcoming = reservations.filter(r => new Date(r.endTime) > now);
    const past = reservations.filter(r => new Date(r.endTime) <= now);

    // Update all reservation tables
    updateTable('reservationsTable', upcoming, true);
    updateTable('upcomingReservationsTable', upcoming, true);
    updateTable('pastReservationsTable', past, false);
}

function updateTable(tableId, reservations, includeActions) {
    const table = document.getElementById(tableId);
    if (!table) return;

    if (reservations.length === 0) {
        table.innerHTML = `<tr><td colspan="${includeActions ? 5 : 4}" class="text-center">No reservations found</td></tr>`;
        return;
    }

    table.innerHTML = reservations
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .map(reservation => `
            <tr>
                <td>${formatDateTime(reservation.startTime)}</td>
                <td>${formatDateTime(reservation.endTime)}</td>
                <td>Spot ${reservation.spotNumber || 'N/A'}</td>
                <td><span class="badge bg-${getStatusColor(reservation.status)}">${reservation.status}</span></td>
                ${includeActions && reservation.status === 'CONFIRMED' ? `
                    <td>
                        <button class="btn btn-sm btn-danger" 
                                onclick="window.cancelReservation('${reservation.reservationId}')">
                            Cancel
                        </button>
                    </td>
                ` : includeActions ? '<td></td>' : ''}
            </tr>
        `).join('');
}

function updateReservationStatistics(reservations) {
    const now = new Date();
    const active = reservations.filter(r => 
        new Date(r.startTime) <= now && new Date(r.endTime) > now
    ).length;
    const upcoming = reservations.filter(r => new Date(r.startTime) > now).length;

    // Update statistics in all relevant places
    ['activeReservations', 'activeReservationsCount'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = active;
    });

    ['upcomingReservations', 'upcomingReservationsCount'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = upcoming;
    });
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
    try {
        const response = await fetch(CONFIRMATION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
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

        return await response.json();
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        // Don't throw error as this is not critical to the reservation process
    }
}

function getStatusColor(status) {
    const colors = {
        'CONFIRMED': 'success',
        'PENDING': 'warning',
        'CANCELLED': 'danger',
        'COMPLETED': 'info'
    };
    return colors[status] || 'secondary';
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
    }, 60000); // Update every minute
}

// Make functions available globally
window.cancelReservation = cancelReservation;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeReservationSystem);

export { reservationsCache };

