// Utility functions for safely handling session storage operations
export const safeSessionStorage = {
  set: (key: string, value: any): void => {
    try {
      if (typeof window === 'undefined') return;
      
      // Validate key
      if (!key || typeof key !== 'string') {
        console.error('Invalid session storage key:', key);
        return;
      }
      
      // Validate value
      if (value === undefined) {
        console.error('Cannot store undefined value in session storage');
        return;
      }
      
      // Stringify value with error handling
      let stringifiedValue: string;
      try {
        stringifiedValue = JSON.stringify(value);
      } catch (err) {
        console.error('Failed to stringify value for session storage:', err);
        return;
      }
      
      // Store in session storage
      sessionStorage.setItem(key, stringifiedValue);
    } catch (err) {
      console.error('Error writing to sessionStorage:', err);
    }
  },
  
  get: (key: string): any => {
    try {
      if (typeof window === 'undefined') return null;
      
      // Validate key
      if (!key || typeof key !== 'string') {
        console.error('Invalid session storage key:', key);
        return null;
      }
      
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from sessionStorage:', error);
      return null;
    }
  },
  
  remove: (key: string): void => {
    try {
      if (typeof window === 'undefined') return;
      
      // Validate key
      if (!key || typeof key !== 'string') {
        console.error('Invalid session storage key:', key);
        return;
      }
      
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from sessionStorage:', error);
    }
  },
  
  clear: (): void => {
    try {
      if (typeof window === 'undefined') return;
      
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  },
  
  // Helper to check if session storage is available
  isAvailable: (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const test = '__storage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}; 