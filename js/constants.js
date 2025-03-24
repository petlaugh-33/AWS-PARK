// API Endpoints
export const RESERVATIONS_API_ENDPOINT = 'https://wszwvwc915.execute-api.us-east-1.amazonaws.com/prod';
export const API_ENDPOINT = 'https://7rw5ezddjj.execute-api.us-east-1.amazonaws.com/prod';
export const WEBSOCKET_URL = 'wss://ocly49pex3.execute-api.us-east-1.amazonaws.com/production';
// Add this new constant
export const CONFIRMATION_ENDPOINT = 'https://wszwvwc915.execute-api.us-east-1.amazonaws.com/prod/send-confirmation';

// Timing constants
export const RESERVATION_REFRESH_INTERVAL = 30000; // 30 seconds
export const WEBSOCKET_HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const RECONNECT_DELAY = 2000; // 2 seconds

// Limits
export const MAX_HISTORY = 10;
export const MAX_RECONNECT_ATTEMPTS = 5;
export const MAX_RESERVATION_DURATION = 24; // hours
export const MIN_RESERVATION_DURATION = 1; // hours

// Storage keys
export const STORAGE_KEYS = {
    HISTORY: 'parkingHistory',
    CURRENT_STATUS: 'parkingCurrentStatus',
    LAST_CHART_TYPE: 'lastChartType',
    USER_RESERVATIONS: 'userReservations'
};

// Status types
export const STATUS_TYPES = {
    AVAILABLE: 'AVAILABLE',
    LIMITED: 'LIMITED',
    FULL: 'FULL'
};

// Chart types
export const CHART_TYPES = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly'
};

