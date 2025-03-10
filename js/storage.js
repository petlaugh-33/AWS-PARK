
import { STORAGE_KEYS } from './constants.js';

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
    const ONE_DAY = 24 * 60 * 60 * 1000; // milliseconds
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

// Update data storage time display
export function updateDataStorageTime() {
    const storageTimeElement = document.getElementById('dataStorageTime');
    if (storageTimeElement) {
        const timestamp = getStorageTimestamp(STORAGE_KEYS.CURRENT_STATUS);
        if (timestamp) {
            const storedTime = new Date(timestamp);
            storageTimeElement.textContent = storedTime.toLocaleString();
        } else {
            storageTimeElement.textContent = 'No data stored';
        }
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

// Clear all application storage
export function clearStorage() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}

// Get storage usage statistics
export function getStorageStats() {
    const stats = {
        totalItems: 0,
        totalSize: 0,
        items: {}
    };

    Object.keys(localStorage).forEach(key => {
        const item = localStorage.getItem(key);
        const size = new Blob([item]).size;
        
        stats.totalItems++;
        stats.totalSize += size;
        stats.items[key] = {
            size: size,
            lastUpdated: getStorageTimestamp(key)
        };
    });

    return stats;
}

// Check if storage is available
export function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
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

// Batch save multiple items
export function batchSave(items) {
    const results = {
        success: [],
        failed: []
    };

    items.forEach(({ key, data }) => {
        try {
            if (saveToLocalStorage(key, data)) {
                results.success.push(key);
            } else {
                results.failed.push(key);
            }
        } catch (error) {
            results.failed.push(key);
        }
    });

    return results;
}

// Subscribe to storage changes
export function subscribeToStorageChanges(callback) {
    window.addEventListener('storage', (event) => {
        if (Object.values(STORAGE_KEYS).includes(event.key)) {
            callback({
                key: event.key,
                oldValue: event.oldValue ? JSON.parse(event.oldValue) : null,
                newValue: event.newValue ? JSON.parse(event.newValue) : null
            });
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
