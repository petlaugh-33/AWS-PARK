import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { getCurrentUser, redirectToLogin } from './auth.js';

let reservationsCache = new Map();
const TOTAL_SPOTS_PER_FLOOR = 6;
const FLOORS = ['P1', 'P2', 'P3', 'P4'];

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

function convertToEST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
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
        const nextSpot = await getNextAvailableSpot(floorSelect.value);

        const requestData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            userId: user.sub,
            userEmail: user.email,
            spotNumber: nextSpot,
            floor: floorSelect.value
        };
        
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
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email,
                spotNumber: nextSpot,
                floor: floorSelect.value
            });

            try {
                await sendConfirmationEmail(data.reservationId, user.email, startTime, endTime, floorSelect.value, nextSpot);
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
    } finally {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Make Reservation';
    }
}

async function getNextAvailableSpot(floor) {
    try {
        const currentReservations = Array.from(reservationsCache.values())
            .filter(r => r.floor === floor);
        const usedSpots = new Set(currentReservations.map(r => r.spotNumber));
        
        for (let spotNumber = 1; spotNumber <= TOTAL_SPOTS_PER_FLOOR; spotNumber++) {
            if (!usedSpots.has(spotNumber)) {
                return spotNumber;
            }
        }
        
        throw new Error(`No parking spots available on floor ${floor}`);
    } catch (error) {
        console.error('Error getting next available spot:', error);
        throw error;
    }
}

// Rest of your existing functions remain the same, but update these specific functions:

function updateParkingStatus(reservations) {
    const now = new Date();
    const totalSpaces = TOTAL_SPOTS_PER_FLOOR * FLOORS.length;
    
    const occupiedSpaces = reservations.filter(reservation => {
        const startTime = new Date(reservation.startTime);
        const endTime = new Date(reservation.endTime);
        return startTime <= now && endTime > now && reservation.status === 'CONFIRMED';
    }).length;

    const availableSpaces = totalSpaces - occupiedSpaces;
    const occupancyRate = Math.round((occupiedSpaces / totalSpaces) * 100);

    document.getElementById('availableSpaces').textContent = availableSpaces;
    document.getElementById('occupiedSpaces').textContent = occupiedSpaces;
    document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;
    
    const occupancyBar = document.getElementById('occupancyBar');
    if (occupancyBar) {
        occupancyBar.style.width = `${occupancyRate}%`;
        occupancyBar.setAttribute('aria-valuenow', occupancyRate);
    }

    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
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
            row.innerHTML = `
                <td>${formatDateTime(reservation.startTime)}</td>
                <td>${formatDateTime(reservation.endTime)}</td>
                <td>${reservation.floor}-${reservation.spotNumber || 'N/A'}</td>
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

// The rest of your existing code remains the same

export { reservationsCache };
