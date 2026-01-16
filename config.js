/**
 * Configuration file for DART Analytics
 * 
 * This file contains configuration settings that can be easily modified
 * for different deployment environments.
 */

const CONFIG = {
    // Backend API URL - Auto-detect based on environment
    // If on Render domain, use same domain for API
    // If on GitHub Pages, use Render backend
    // If localhost, use local backend
    BACKEND_URL: (() => {
        const hostname = window.location.hostname;
        
        // Running on Render (frontend and backend together)
        if (hostname.includes('onrender.com')) {
            return window.location.origin + '/api';
        }
        // Running on GitHub Pages (frontend only)
        else if (hostname.includes('github.io')) {
            return 'https://dart-vz1l.onrender.com/api';
        }
        // Local development
        else {
            return 'http://localhost:5000/api';
        }
    })(),
    
    // Application settings
    APP_NAME: 'DART Analytics',
    APP_VERSION: '1.0.0',
    
    // Feature flags
    ENABLE_EXPORT_PPT: true,
    ENABLE_CHART_COMPARISON: true,
    
    // Chart defaults
    DEFAULT_WINDOW_SIZE: 30,
    DEFAULT_STD_THRESHOLD: 2
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
