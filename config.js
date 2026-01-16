/**
 * Configuration file for DART Analytics
 * 
 * This file contains configuration settings that can be easily modified
 * for different deployment environments.
 */

const CONFIG = {
    // Backend API URL
    // Automatically detects environment:
    // - GitHub Pages: Uses production Render URL
    // - Local development: Uses localhost
    BACKEND_URL: window.location.hostname === 'guruprasathm7.github.io' 
        ? 'https://dart-vz1l.onrender.com/api'
        : 'http://localhost:5000/api',
    
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
