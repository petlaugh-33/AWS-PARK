// 1. Imports
import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage } from './storage.js';
import { getCurrentUser } from './auth.js';
import { API } from 'aws-amplify';

// 2. Constants and Cache
let reservationsCache = new Map();

// 3. Core API Functions
export async function testAPIConnection() {
    try {
        const response = await API.get('api', '/reservations');
        console.log('API test successful:', response);
        return true;
    } catch (error) {
        console.error('API test failed:', error);
        return false;
    }
}

export async function loadUserReservations() {
    try {
        const response = await API.get('api', '/reservations');
        console.log('Reservations loaded:', response);
        
        if (Array.isArray(response)) {
            reservationsCache.clear();
            response.forEach(reservation => {
                if (validateReservation(reservation)) {
                    reservationsCache.set(reservation.reservationId, reservation);
                }
            });
            updateReservationsTable(Array.from(reservationsCache.values()));
        }
        
        return Array.from(reservationsCache.values());
    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations');
        
        const cachedReservations = Array.from(reservationsCache.values());
        if (cachedReservations.length > 0) {
            updateReservationsTable(cachedReservations);
            return cachedReservations;
        }
        return [];
    }
}

export async function createReservation(reservationData) {
    try {
        const response = await API.post('api', '/reservations', {
            body: reservationData
        });
        console.log('Reservation created:', response);
        return response;
    } catch (error) {
        console.error('Error creating reservation:', error);
        showErrorMessage('Failed to create reservation');
        throw error;
    }
}

export async function cancelReservation(reservationId) {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.log('No authenticated user');
            return false;
        }

        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
        }

        const response = await API.del('api', `/reservations/${reservationId}`);
        console.log('Reservation cancelled:', response);

        if (button) {
            button.disabled = false;
            button.innerHTML = 'Cancel';
        }

        reservationsCache.delete(reservationId);
        showSuccessMessage('Reservation cancelled successfully!');
        await loadUserReservations();

        return true;
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showErrorMessage(`Failed to cancel reservation: ${error.message}`);
        return false;
    }
}

// 4. UI Event Handlers
export function initializeReservationSystem() {
    try {
        const now = convertToEST(new Date());
        const minDateTime = now.toISOString().slice(0, 16);
        
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const reservationForm = document.getElementById('reservationForm');

        if (!startTimeInput || !endTimeInput || !reservationForm) {
            throw new Error('Required reservation elements not found');
        }

        startTimeInput.min = minDateTime;
        endTimeInput.min = minDateTime;
        
        startTimeInput.addEventListener('change', handleStartTimeChange);
        reservationForm.addEventListener('submit', handleReservationSubmit);
        
        loadUserReservations();
        startReservationRefresh();

        return true;
    } catch (error) {
        console.error('Error initializing reservation system:', error);
        return false;
    }
}

function handleStartTimeChange(event) {
    const startTime = event.target.value;
    if (startTime) {
        document.getElementById('endTime').min = startTime;
    }
}

export async function handleReservationSubmit(event) {
    event.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        console.log('No authenticated user');
        return;
    }
    
    const startTime = convertToEST(new Date(document.getElementById('startTime').value));
    const endTime = convertToEST(new Date(document.getElementById('endTime').value));
    
    if (!validateDateTime(startTime, endTime)) {
        return;
    }
    
    try {
        const requestData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
        };
        
        const data = await API.post('api', '/reservations', {
            body: requestData
        });

        if (data.reservationId) {
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email
            });

            try {
                await API.post('api', '/confirmation', {
                    body: {
                        reservationId: data.reservationId,
                        userEmail: user.email,
                        startTime: startTime,
                        endTime: endTime
                    }
                });
                console.log('Confirmation email sent successfully');
            } catch (emailError) {
                console.error('Error sending confirmation email:', emailError);
            }
        }

        document.getElementById('reservationForm').reset();
        showSuccessMessage('Reservation created successfully!');
        await loadUserReservations();
        
    } catch (error) {
        console.error('Reservation error:', error);
        showErrorMessage(error.message || 'Failed to create reservation');
    }
}

// 5. Validation Functions
function validateDateTime(startTime, endTime) {
    const now = convertToEST(new Date());

    if (startTime < now) {
        showErrorMessage('Start time must be in the future');
        return false;
    }

    if (endTime <= startTime) {
        showErrorMessage('End time must be after start time');
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

function validateReservation(reservation) {
    if (!reservation.startTime || !reservation.endTime) {
        console.warn('Invalid reservation (missing times):', reservation);
        return false;
    }
    
    try {
        new Date(reservation.startTime);
        new Date(reservation.endTime);
    } catch (error) {
        console.warn('Invalid reservation (invalid dates):', reservation);
        return false;
    }
    
    return true;
}

// 6. UI Update Functions
function updateReservationsTable(reservations) {
    const tbody = document.getElementById('reservationsTable');
    if (!tbody) {
        console.error('Table body element not found');
        return;
    }

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No reservations found</td></tr>';
        return;
    }

    tbody.innerHTML = reservations
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .map(reservation => `
            <tr>
                <td>${formatDateTime(reservation.startTime)}</td>
                <td>${formatDateTime(reservation.endTime)}</td>
                <td>Spot ${reservation.spotNumber || 'N/A'}</td>
                <td>
                    <span class="badge bg-${getStatusColor(reservation.status)}">
                        ${reservation.status}
                    </span>
                </td>
                <td>
                    ${reservation.status === 'CONFIRMED' ? 
                        `<button class="btn btn-sm btn-danger" onclick="window.cancelReservation('${reservation.reservationId}')">
                            Cancel
                        </button>` : 
                        ''}
                </td>
            </tr>
        `).join('');
}

// 7. Utility Functions
function convertToEST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
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
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return 'Invalid Date';
    }
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

export function checkForConflicts(startTime, endTime) {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    return Array.from(reservationsCache.values()).some(reservation => {
        const existingStart = new Date(reservation.startTime);
        const existingEnd = new Date(reservation.endTime);
        
        return (newStart < existingEnd && newEnd > existingStart);
    });
}

// 8. Exports and Initialization
export { reservationsCache };
export const getReservation = (reservationId) => reservationsCache.get(reservationId);
export const exportReservations = () => Array.from(reservationsCache.values());

window.cancelReservation = cancelReservation;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing reservation system');
    initializeReservationSystem();
});

