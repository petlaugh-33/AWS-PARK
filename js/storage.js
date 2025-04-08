
import { STORAGE_KEYS } from './constants.js';

// Authentication token keys
const TOKEN_KEYS = {
    ID_TOKEN: 'idToken',
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken'
};

// Save data to localStorage
export function saveToLocalStorage(key, data) {
    try {
        const serializedData = JSON.stringify({
            data: data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(key, serializedData);
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

// Authentication token management
export function saveAuthTokens(tokens) {
    try {
        localStorage.setItem(TOKEN_KEYS.ID_TOKEN, tokens.idToken);
        localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken);
        if (tokens.refreshToken) {
            localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken);
        }
        return true;
    } catch (error) {
        console.error('Error saving auth tokens:', error);
        return false;
    }
}

export function getAuthTokens() {
    try {
        return {
            idToken: localStorage.getItem(TOKEN_KEYS.ID_TOKEN),
            accessToken: localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN),
            refreshToken: localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
        };
    } catch (error) {
        console.error('Error getting auth tokens:', error);
        return null;
    }
}

export function clearAuthTokens() {
    try {
        localStorage.removeItem(TOKEN_KEYS.ID_TOKEN);
        localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
        return true;
    } catch (error) {
        console.error('Error clearing auth tokens:', error);
        return false;
    }
}

export function isAuthenticated() {
    const idToken = localStorage.getItem(TOKEN_KEYS.ID_TOKEN);
    if (!idToken) return false;
    
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const expirationTime = payload.exp * 1000;
        return Date.now() < expirationTime;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

export function getCurrentUserInfo() {
    const idToken = localStorage.getItem(TOKEN_KEYS.ID_TOKEN);
    if (!idToken) return null;
    
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return {
            sub: payload.sub,
            email: payload.email,
            username: payload['cognito:username']
        };
    } catch (error) {
        console.error('Error getting user info:', error);
        return null;
    }
}

// Load data from localStorage
export function loadFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item).data : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}

// Get data timestamp from localStorage
export function getStorageTimestamp(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item).timestamp : null;
    } catch (error) {
        console.error('Error getting timestamp:', error);
        return null;
    }
}

// Clean up old data
export function cleanupStorageData() {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    
    Object.keys(localStorage).forEach(key => {
        try {
            if (key.startsWith('chartData_')) {
                const item = localStorage.getItem(key);
                if (item) {
                    const { timestamp } = JSON.parse(item);
                    const dataAge = now - new Date(timestamp).getTime();
                    if (dataAge > ONE_DAY) {
                        localStorage.removeItem(key);
                        console.log(`Removed old data: ${key}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error cleaning up key ${key}:`, error);
        }
    });
}

// Save data with expiration
export function saveWithExpiration(key, data, expirationMinutes) {
    try {
        const expirationMS = expirationMinutes * 60 * 1000;
        const item = {
            data: data,
            timestamp: new Date().toISOString(),
            expiration: new Date(Date.now() + expirationMS).toISOString()
        };
        localStorage.setItem(key, JSON.stringify(item));
        return true;
    } catch (error) {
        console.error('Error saving with expiration:', error);
        return false;
    }
}

// Load data with expiration check
export function loadWithExpiration(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const { data, expiration } = JSON.parse(item);
        if (new Date(expiration) < new Date()) {
            localStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error loading with expiration:', error);
        return null;
    }
}

// Initialize storage with default values
export function initializeStorage() {
    const defaultValues = {
        [STORAGE_KEYS.HISTORY]: [],
        [STORAGE_KEYS.CURRENT_STATUS]: null,
        [STORAGE_KEYS.LAST_CHART_TYPE]: 'daily'
    };

    Object.entries(defaultValues).forEach(([key, value]) => {
        if (!localStorage.getItem(key)) {
            saveToLocalStorage(key, value);
        }
    });
}

// Export storage data
export function exportStorageData() {
    const exportData = {};
    Object.values(STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
            exportData[key] = JSON.parse(item);
        }
    });
    return exportData;
}

// Import storage data
export function importStorageData(data) {
    try {
        Object.entries(data).forEach(([key, value]) => {
            if (Object.values(STORAGE_KEYS).includes(key)) {
                saveToLocalStorage(key, value.data);
            }
        });
        return true;
    } catch (error) {
        console.error('Error importing storage data:', error);
        return false;
    }
}


// Usage example:
/*
import { 
    initializeStorage,
    saveToLocalStorage,
    loadFromLocalStorage,
    subscribeToStorageChanges
} from './storage.js';

// Initialize storage
initializeStorage();

// Save data
saveToLocalStorage('key', { data: 'value' });

// Load data
const data = loadFromLocalStorage('key');

// Subscribe to changes
subscribeToStorageChanges(({ key, oldValue, newValue }) => {
    console.log(`Storage changed: ${key}`, { oldValue, newValue });
});

// Save data with expiration
saveWithExpiration('tempData', { data: 'temporary' }, 30); // expires in 30 minutes

// Export data
const backup = exportStorageData();

// Import data
importStorageData(backup);
*/