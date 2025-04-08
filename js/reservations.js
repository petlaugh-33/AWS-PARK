import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

let reservationsCache = new Map();
const TOTAL_PARKING_SPOTS = 6; // Fixed total number of parking spots

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
            if (reservation.status !== 'CONFIRMED') return false;
            const reservationStart = new Date(reservation.startTime);
            const reservationEnd = new Date(reservation.endTime);
            return (
                (startTime <= reservationEnd && endTime >= reservationStart) ||
                (startTime >= reservationStart && startTime < reservationEnd) ||
                (endTime > reservationStart && endTime <= reservationEnd)
            );
        });

        // Get used spot numbers for the requested time period
        const usedSpots = new Set(overlappingReservations.map(r => r.spotNumber));

        // Find first available spot from 1 to TOTAL_PARKING_SPOTS
        for (let spot = 1; spot <= TOTAL_PARKING_SPOTS; spot++) {
            if (!usedSpots.has(spot)) {
                return spot;
            }
        }
        
        throw new Error('No parking spots available for the selected time period');
    } catch (error) {
        console.error('Error getting next available spot:', error);
        throw error;
    }
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
    
    const startTimeInput = formId === 'reservationForm' ? 
        document.getElementById('startTime') : 
        document.getElementById('startTimeReservations');
    
    const endTimeInput = formId === 'reservationForm' ? 
        document.getElementById('endTime') : 
        document.getElementById('endTimeReservations');

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

        if (data.reservationId) {
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email,
                spotNumber: nextSpot
            });

            try {
                await sendConfirmationEmail(data.reservationId, user.email, startTime, endTime);
            } catch (emailError) {
                console.error('Email confirmation error:', emailError);
            }
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

        reservationsCache.delete(reservationId);
        showSuccessMessage('Reservation cancelled successfully!');
        await loadUserReservations();

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

function updateParkingStatus(reservations) {
    const now = new Date();
    
    // Count currently active reservations
    const occupiedSpaces = reservations.filter(reservation => {
        const startTime = new Date(reservation.startTime);
        const endTime = new Date(reservation.endTime);
        return startTime <= now && endTime > now && reservation.status === 'CONFIRMED';
    }).length;

    // Calculate available spaces and occupancy rate based on TOTAL_PARKING_SPOTS
    const availableSpaces = Math.max(0, TOTAL_PARKING_SPOTS - occupiedSpaces);
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
    }

    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

// ... Rest of your existing functions remain the same ...

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
        
        reservations = reservations.filter(reservation => 
            (reservation.userId === user.sub || reservation.userEmail === user.email) &&
            reservation.status !== 'CANCELLED'
        );

        updateReservationTables(reservations);
        updateReservationStatistics(reservations);
        updateParkingStatus(reservations);

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

// ... Rest of your existing code remains exactly the same ...

window.cancelReservation = cancelReservation;

document.addEventListener('DOMContentLoading', initializeReservationSystem);

export { reservationsCache };
