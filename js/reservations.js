import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage, getAuthTokens, isAuthenticated, getCurrentUserInfo } from './storage.js';
import { getCurrentUser } from './auth.js';
import { API } from 'aws-amplify';

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
                reservationsCache.set(reservation.reservationId, reservation);
            });
            updateReservationsTable(response);
        }
        
        return response;
    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations');
        
        // Try to load from cache
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
            redirectToLogin();
            return false;
        }

        // Show loading state
        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
        }

        const response = await API.del('api', `/reservations/${reservationId}`);
        console.log('Reservation cancelled:', response);

        // Reset button state
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Cancel';
        }

        // Remove from cache
        reservationsCache.delete(reservationId);

        // Show success message
        showSuccessMessage('Reservation cancelled successfully!');

        // Reload reservations
        await loadUserReservations();

        return true;
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showErrorMessage(`Failed to cancel reservation: ${error.message}`);
        return false;
    }
}

async function makeAuthenticatedRequest() {
    const idToken = localStorage.getItem('idToken'); // or however you store your token
    
    try {
        const response = await fetch('RESERVATIONS_API_ENDPOINT', {
            method: 'GET', // or POST, etc.
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Cache for reservations
let reservationsCache = new Map();

// Initialize the reservation system
export function initializeReservationSystem() {
    try {
        const now = convertToEST(new Date());
        const minDateTime = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
        
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const reservationForm = document.getElementById('reservationForm');

        if (!startTimeInput || !endTimeInput || !reservationForm) {
            throw new Error('Required reservation elements not found');
        }

        // Set minimum times
        startTimeInput.min = minDateTime;
        endTimeInput.min = minDateTime;
        
        // Add event listeners
        startTimeInput.addEventListener('change', handleStartTimeChange);
        reservationForm.addEventListener('submit', handleReservationSubmit);
        
        // Load existing reservations
        loadUserReservations();
        
        // Start refresh interval
        startReservationRefresh();

        return true;
    } catch (error) {
        console.error('Error initializing reservation system:', error);
        return false;
    }
}

// Handle start time change
function handleStartTimeChange(event) {
    const startTime = event.target.value;
    if (startTime) {
        document.getElementById('endTime').min = startTime;
    }
}

// convert UTC to EST
function convertToEST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Handle reservation form submission
export async function handleReservationSubmit(event) {
    event.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        console.log('No authenticated user');
        return;
    }
    
    const startTime = convertToEST(new Date(document.getElementById('startTime').value));
    const endTime = convertToEST(new Date(document.getElementById('endTime').value));
    
    try {
        const requestData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
        };
        
        console.log('Submitting reservation with data:', requestData);
        
        const data = await API.post('api', '/reservations', {
            body: requestData
        });
        
        console.log('Reservation created:', data);

        // Update cache
        if (data.reservationId) {
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email
            });

            // Send confirmation email
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

        // Clear form and show success
        document.getElementById('reservationForm').reset();
        showSuccessMessage('Reservation created successfully!');

        // Reload reservations immediately
        await loadUserReservations();
        
    } catch (error) {
        console.error('Reservation error:', error);
        showErrorMessage(error.message || 'Failed to create reservation');
    }
}

        // Clear form and show success
        document.getElementById('reservationForm').reset();
        showSuccessMessage('Reservation created successfully!');

        // Reload reservations immediately
        await loadUserReservations();
        
    } catch (error) {
        console.error('Reservation error:', error);
        showErrorMessage(error.message || 'Failed to create reservation');
    }
}

// Validate datetime inputs
function validateDateTime() {
    const startTime = convertToEST(new Date(document.getElementById('startTime').value));
    const endTime = convertToEST(new Date(document.getElementById('endTime').value));
    const now = convertToEST(new Date());

    if (startTime < now) {
        showErrorMessage('Start time must be in the future');
        return false;
    }

    if (endTime <= startTime) {
        showErrorMessage('End time must be after start time');
        return false;
    }

    const duration = (endTime - startTime) / (1000 * 60 * 60); // Duration in hours
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

// Add this helper function to validate dates
function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
}

// Add this helper function to check if a reservation is valid
function isValidReservation(reservation) {
    return (
        reservation &&
        typeof reservation === 'object' &&
        typeof reservation.reservationId === 'string' &&
        isValidDate(new Date(reservation.startTime)) &&
        isValidDate(new Date(reservation.endTime))
    );
}


function updateReservationsTable(reservations) {
    console.log('Updating table with reservations:', reservations);
    
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

// Export the cache if needed elsewhere
export { reservationsCache };

// Validate reservation object
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

// Format datetime for display
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

// Get status color for badges
function getStatusColor(status) {
    switch (status) {
        case 'CONFIRMED': return 'success';
        case 'PENDING': return 'warning';
        case 'CANCELLED': return 'danger';
        case 'COMPLETED': return 'info';
        default: return 'secondary';
    }
}

// Start reservation refresh interval
function startReservationRefresh() {
    setInterval(loadUserReservations, RESERVATION_REFRESH_INTERVAL);
}

// Get reservation by ID
export function getReservation(reservationId) {
    return reservationsCache.get(reservationId);
}

// Check for conflicting reservations
export function checkForConflicts(startTime, endTime) {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    return Array.from(reservationsCache.values()).some(reservation => {
        const existingStart = new Date(reservation.startTime);
        const existingEnd = new Date(reservation.endTime);
        
        return (newStart < existingEnd && newEnd > existingStart);
    });
}

// Export reservation data
export function exportReservations() {
    return Array.from(reservationsCache.values());
}

// Make cancelReservation available globally for the onclick handler
window.cancelReservation = cancelReservation;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing reservation system');
    initializeReservationSystem();
});
