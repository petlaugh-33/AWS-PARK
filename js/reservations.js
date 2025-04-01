import { RESERVATIONS_API_ENDPOINT, RESERVATION_REFRESH_INTERVAL, CONFIRMATION_ENDPOINT } from './constants.js';
import { showSuccessMessage, showErrorMessage } from './ui.js';
import { saveToLocalStorage, loadFromLocalStorage, getAuthTokens, isAuthenticated, getCurrentUserInfo } from './storage.js';
import { getCurrentUser } from './auth.js';


async function getAuthToken() {
    try {
        const session = await Auth.currentSession();
        return session.getIdToken().getJwtToken();
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw error;
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

// Add this after your imports
function getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Cache for reservations
let reservationsCache = new Map();

// Initialize the reservation system
export function initializeReservationSystem() {
    try {
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const reservationForm = document.getElementById('reservationForm');

        if (!startTimeInput || !endTimeInput || !reservationForm) {
            throw new Error('Required reservation elements not found');
        }
        
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
        
        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            },
            body: JSON.stringify(requestData),
            credentials: 'include'  // Add this line
        });
        
        if (response.status === 401) {
            redirectToLogin();
            return;
        }
                
        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            throw new Error(responseText || 'Failed to create reservation');
        }

        const data = JSON.parse(responseText);
        console.log('Parsed response data:', data);

        // Update cache
        if (data.reservationId) {
            reservationsCache.set(data.reservationId, {
                ...data,
                userId: user.sub,
                email: user.email
            });
        }
        // Add confirmation email here
        if (data.reservationId) {
            try {
                const token = localStorage.getItem('idToken');
                console.log('Actual token value:', token);
                
                const confirmResponse = await fetch(CONFIRMATION_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'Access-Control-Allow-Origin': 'https://main.d1lgse8ryp3x19.amplifyapp.com'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        reservationId: data.reservationId,
                        userEmail: user.email,
                        startTime: startTime,
                        endTime: endTime
                    })
                });
                
                console.log('Response status:', confirmResponse.status);
                console.log('Response headers:', [...confirmResponse.headers]);

                if (!confirmResponse.ok) {
                    const errorText = await confirmResponse.text();
                    console.error('Error response:', errorText);
                } else {
                    console.log('Confirmation successful');
                }
            } catch (emailError) {
                console.error('Email confirmation error:', emailError);
            }
        }

        // Clear form and show success
        document.getElementById('reservationForm').reset();
        showSuccessMessage('Reservation created successfully! Check your email for confirmation.');

        // Reload reservations immediately
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

        console.log('Attempting to cancel reservation:', reservationId);
        
        // Show loading state
        const button = document.querySelector(`button[onclick="window.cancelReservation('${reservationId}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
        }

        const cancelUrl = `${RESERVATIONS_API_ENDPOINT}/reservations/${reservationId}`;
        console.log('Cancel URL:', cancelUrl);

        const response = await fetch(cancelUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            },
            credentials: 'include'  // Add this line
        });

        // Reset button state
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Cancel';
        }

        if (response.status === 401) {
            redirectToLogin();
            return false;
        }

        // Parse response
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('Error parsing response:', e);
            throw new Error('Invalid response from server');
        }

        if (!response.ok) {
            throw new Error(data.error || `Failed to cancel reservation (Status: ${response.status})`);
        }

        // Remove from cache
        if (reservationsCache) {
            reservationsCache.delete(reservationId);
        }

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

        console.log('Making request with token:', idToken.substring(0, 20) + '...');

        const response = await fetch(`${RESERVATIONS_API_ENDPOINT}/reservations`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });

        console.log('Response status:', response.status);
        
        if (response.status === 401) {
            console.error('Unauthorized - token might be expired');
            // Redirect to login or handle token refresh
            return [];
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw data received:', data);
        
        let reservations = Array.isArray(data) ? data : [];
        
        // Filter reservations for the current user
        // Filter reservations for the current user and remove cancelled ones
        reservations = reservations.filter(reservation => 
            (reservation.userId === user.sub || reservation.userEmail === user.email) &&
            reservation.status !== 'CANCELLED'
        );
        
        console.log('Filtered reservations:', reservations);

        // Validate each reservation
        reservations = reservations.map(reservation => {
            // Ensure all required fields are present
            if (!reservation.reservationId || !reservation.startTime || !reservation.endTime) {
                console.warn('Invalid reservation data:', reservation);
                return null;
            }

            // Convert dates to proper format
            try {
                reservation.startTime = new Date(reservation.startTime).toISOString();
                reservation.endTime = new Date(reservation.endTime).toISOString();
            } catch (e) {
                console.warn('Invalid date in reservation:', e);
                return null;
            }

            return reservation;
        }).filter(Boolean); // Remove any null entries

        // Update cache
        reservationsCache.clear();
        reservations.forEach(reservation => {
            reservationsCache.set(reservation.reservationId, reservation);
        });
        
        // Update UI
        updateReservationsTable(reservations);
        
        // Save to local storage
        saveToLocalStorage('userReservations', reservations);
        
        return reservations;

    } catch (error) {
        console.error('Error loading reservations:', error);
        showErrorMessage('Failed to load reservations. Please try again later.');
        
        // Try to load from cache
        const cachedReservations = Array.from(reservationsCache.values());
        if (cachedReservations.length > 0) {
            console.log('Using cached reservations:', cachedReservations);
            updateReservationsTable(cachedReservations);
            return cachedReservations;
        }
        
        // If everything fails, return empty array
        return [];
    } finally {
        // Any cleanup code if needed
    }
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
