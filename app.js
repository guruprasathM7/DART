/**
 * ============================================================================
 * DART Analytics Frontend Application
 * ============================================================================
 * 
 * A comprehensive web application for generating MSD (Moving Standard Deviation)
 * control charts from CSV/Excel data. This application provides:
 * 
 * - Interactive file upload with drag & drop support
 * - Automatic column type detection and validation
 * - Real-time chart generation with statistical analysis
 * - PowerPoint export functionality for business reporting
 * - Responsive design with dark/light theme support
 * - Session management for multi-chart workflows
 * 
 * Architecture:
 * - Frontend: Vanilla JavaScript with Tailwind CSS
 * - Backend: Flask REST API with pandas/matplotlib
 * - Communication: JSON over HTTP with base64 image encoding
 * 
 * Author: DART Analytics Team
 * Version: 2.1 (Production Ready)
 */

class DARTAnalytics {
    /**
     * Initialize the DART Analytics application.
     * 
     * Sets up the complete application state, UI elements, event handlers,
     * and establishes connection with the backend server.
     */
    constructor() {
        // Core application state
        this.sessionId = null;  // Current data session identifier
        this.backendUrl = 'http://localhost:5000/api';  // Backend API base URL
        
        // User preferences with sensible defaults
        this.userSettings = { 
            rollingWindow: 7,      // Default rolling window for calculations
            stdDev: 2,             // Default standard deviation multiplier
            aggregationPeriod: 'W' // Default time aggregation (Weekly)
        };
        
        // Application state tracking
        this.chartHistory = [];        // History of generated charts for sidebar
        this.sessionChartCount = 0;    // Count of charts in current session
        
        // Initialize application components
        this.loadUserSettings();      // Load saved user preferences
        this.initializeElements();    // Cache DOM element references
        this.bindEvents();            // Attach event listeners
        this.applyTheme(localStorage.getItem('theme') || 'dark');  // Set theme
        this.showWelcomeScreen();     // Display initial welcome message
        this.updateExportButton();    // Update export button state
        this.checkBackendHealth();    // Verify backend connectivity
    }

    /**
     * Cache references to DOM elements for efficient access.
     * 
     * This method stores references to frequently accessed DOM elements
     * to avoid repeated querySelector calls and improve performance.
     */
    initializeElements() {
        // Chat interface elements
        this.chatForm = document.getElementById('chat-form');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatContainer = document.getElementById('chat-container');
        
        // File upload elements
        this.fileUploadBtn = document.getElementById('file-upload-btn');
        this.fileUploadInput = document.getElementById('file-upload');
        
        // Navigation and UI control elements
        this.newConversationBtn = document.getElementById('new-conversation-btn');
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');
        this.menuToggleBtn = document.getElementById('menu-toggle-btn');
        this.closeMenuBtn = document.getElementById('close-menu-btn');
        
        // Sidebar and history elements
        this.sidebar = document.getElementById('sidebar');
        this.chartHistoryElement = document.getElementById('chart-history');
        
        // Export functionality
        this.exportPptBtn = document.getElementById('export-ppt-btn');
    }

    /**
     * Attach event listeners to UI elements.
     * 
     * This method sets up all the interactive functionality by binding
     * event handlers to user interface elements. Uses event delegation
     * where appropriate for dynamic content.
     */
    bindEvents() {
        // Chat interface events
        this.chatForm.addEventListener('submit', (e) => this.handleChatSubmit(e));
        
        // File upload events
        this.fileUploadBtn.addEventListener('click', () => this.fileUploadInput.click());
        this.fileUploadInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Navigation events
        this.newConversationBtn.addEventListener('click', () => this.startNewConversation());
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        
        // Mobile menu events
        this.menuToggleBtn.addEventListener('click', () => this.toggleSidebar(true));
        this.closeMenuBtn.addEventListener('click', () => this.toggleSidebar(false));
        
        // Dynamic content events (using event delegation)
        this.chatMessages.addEventListener('click', (e) => this.handleMessageActions(e));
        
        // Export functionality
        this.exportPptBtn.addEventListener('click', () => this.exportToPowerPoint());

        // User settings auto-save (using event delegation for dynamic forms)
        this.chatMessages.addEventListener('change', (e) => {
            if (e.target.matches('#rolling-window-input, #std-dev-input, #aggregation-period-select')) {
                this.saveUserSettings();
            }
        });
    }



    /**
     * Add a message to the chat interface.
     * 
     * This method creates and displays messages in the chat interface with
     * different styling for user messages, bot responses, charts, and file info.
     * Supports rich content including charts and interactive forms.
     * 
     * @param {string} message - The message text content
     * @param {string} sender - Either 'user' or 'bot'
     * @param {Object} options - Additional options for special message types
     * @param {boolean} options.isChart - Whether this is a chart message
     * @param {string} options.chartHtml - Pre-rendered chart HTML
     * @param {boolean} options.isFileInfo - Whether this is file information
     * @param {Object} options.fileInfo - File analysis data
     * @returns {HTMLElement} The created message element
     */
    addMessage(message, sender, options = {}) {
        // Create message container with animation classes
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('flex', 'items-start', 'gap-3', 'message-animate', 'w-full', 'message-wrapper');
        
        // Determine content type and generate appropriate HTML
        let contentHtml;
        if (options.isChart) {
            // Chart message with embedded image and statistics
            contentHtml = options.chartHtml;
        } else if (options.isFileInfo) {
            // File upload result with interactive form
            contentHtml = this.createFileInfoHtml(options.fileInfo);
        } else {
            // Regular text message with markdown support
            contentHtml = `<div class="prose">${marked.parse(message)}</div>`;
        }

        // Style message based on sender
        if (sender === 'user') {
            // User messages: right-aligned with distinct styling
            messageWrapper.classList.add('justify-end');
            messageWrapper.innerHTML = `<div class="max-w-xl px-4 py-3 rounded-lg bg-[var(--bg-user-message)] text-[var(--text-dark)]">${contentHtml}</div>`;
        } else {
            // Bot messages: left-aligned with avatar and assistant styling
            messageWrapper.classList.add('justify-start');
            messageWrapper.innerHTML = `
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDIuMzMzMzFMMjUuNjY2NyAyMUgyLjMzMzMzTDE0IDIuMzMzMzFaIiBzdHJva2U9IiNFNUU1RTUiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE0IDIxVjI1LjY2NjciIHN0cm9rZT0iI0U1RTVFNSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K" alt="DART" class="w-10 h-10 rounded-full flex-shrink-0">
                <div class="flex flex-col items-start w-full">
                    <div class="max-w-3xl w-full px-4 py-3 rounded-lg bg-[var(--bg-element-dark)] text-[var(--text-primary)] border border-[var(--border-color)]">${contentHtml}</div>
                </div>`;
        }
        
        // Add message to chat and auto-scroll to bottom
        const el = this.chatMessages.appendChild(messageWrapper);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return el;
    }



    createFileInfoHtml(fileInfo) {
        // If fileInfo contains custom HTML (for sheet selection), return it directly
        if (fileInfo.html) {
            return fileInfo.html;
        }
        const { columns_info, filename, rows, columns, quality_report } = fileInfo;
        
        if (!columns_info || !Array.isArray(columns_info)) {
            return '<div class="error">Error: Invalid file data structure</div>';
        }
        
        const allCols = columns_info.map(c => c.name);
        const numericCols = columns_info.filter(c => c.is_numeric).map(c => c.name);
        const dateCols = columns_info.filter(c => c.is_date_like).map(c => c.name);
        
        const qualityReportHtml = quality_report?.empty_rows_dropped > 0 ? `<div class="p-2 mt-2 text-sm bg-yellow-900/50 text-yellow-300 border border-yellow-700 rounded-md"><strong>Data Quality Note:</strong> ${quality_report.empty_rows_dropped} empty rows were removed.</div>` : '';

        return `
            <div class="file-info">
                <h3 class="font-semibold text-[var(--text-primary)] mb-2">📊 File Loaded: ${filename}</h3>
                <p class="text-[var(--text-secondary)] mb-2">Rows: ${rows} | Columns: ${columns}</p>
                ${qualityReportHtml}
                <div class="p-4 bg-[var(--bg-element-medium)] rounded-lg border border-[var(--border-color)] mt-4">
                    <h4 class="text-base font-medium text-[var(--text-primary)] mb-3">🎯 Build Your Analysis</h4>
                    <form id="chart-options-form" class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-[var(--text-primary)] mb-2 block">1. Select Value Column</label>
                            <select name="value-column" class="w-full">
                                <option value="">-- Select Metric --</option>
                                ${numericCols.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-[var(--text-primary)] mb-2 block">2. Select Time Series Column</label>
                            <select name="date-column" class="w-full">
                                <option value="">-- Select Time Period --</option>
                                ${dateCols.length > 0 ? `<optgroup label="Suggested">${dateCols.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>` : ''}
                                <optgroup label="All Columns">${allCols.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-[var(--text-primary)] mb-2 block">3. Select Data Cut Column (Optional)</label>
                            <select name="cut-column" class="w-full">
                                <option value="">-- No Data Cut --</option>
                                ${allCols.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-[var(--border-color)]">
                            <div>
                                <label class="text-sm text-[var(--text-secondary)] mb-1 block">Aggregation</label>
                                <select id="aggregation-period-select" class="w-full">
                                    <option value="D">Daily</option>
                                    <option value="W" ${this.userSettings.aggregationPeriod === 'W' ? 'selected' : ''}>Weekly</option>
                                    <option value="M" ${this.userSettings.aggregationPeriod === 'M' ? 'selected' : ''}>Monthly</option>
                                    <option value="Y" ${this.userSettings.aggregationPeriod === 'Y' ? 'selected' : ''}>Yearly</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-sm text-[var(--text-secondary)] mb-1 block">Rolling Window</label>
                                <input type="number" id="rolling-window-input" value="${this.userSettings.rollingWindow}" min="1" max="52" class="w-full">
                            </div>
                            <div>
                                <label class="text-sm text-[var(--text-secondary)] mb-1 block">Std Dev (σ)</label>
                                <input type="number" id="std-dev-input" value="${this.userSettings.stdDev}" min="1" max="4" step="0.5" class="w-full">
                            </div>
                        </div>
                        <button type="button" id="generate-chart-btn" class="w-full mt-4"><span class="btn-text">🚀 Generate Charts</span><div class="loading-spinner hidden"></div></button>
                    </form>
                </div>

            </div>`;
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // If there's an existing session, show confirmation dialog
        if (this.sessionId) {
            const confirmUpload = window.confirm('Loading a new file will clear your current analysis session. Do you want to continue?');
            if (!confirmUpload) {
                event.target.value = ''; // Clear the file input
                return;
            }
            
            // Clear existing session data
            this.sessionId = null;
            this.sessionChartCount = 0;
            this.chartHistory = [];
            this.updateChartHistoryUI();
            this.updateExportButton();
            
            // Clear chat messages except the welcome message
            this.showWelcomeScreen();
        }

        this.addMessage(`📁 Uploading ${file.name}...`, 'user');
        const msg = this.addMessage('🔄 Processing file, please wait...', 'bot');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${this.backendUrl}/upload`, { method: 'POST', body: formData });
            const result = await res.json();
            
            if (!res.ok) throw new Error(result.error);
            
            // Handle multiple sheets in Excel files
            if (result.multiple_sheets) {
                msg.remove();
                // Create sheet selection HTML
                const messageWrapper = document.createElement('div');
                messageWrapper.classList.add('flex', 'items-start', 'gap-3', 'message-animate', 'w-full', 'message-wrapper', 'justify-start');
                
                messageWrapper.innerHTML = `
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDIuMzMzMzFMMjUuNjY2NyAyMUgyLjMzMzMzTDE0IDIuMzMzMzFaIiBzdHJva2U9IiNFNUU1RTUiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE0IDIxVjI1LjY2NjciIHN0cm9rZT0iI0U1RTVFNSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K" alt="DART" class="w-10 h-10 rounded-full flex-shrink-0">
                    <div class="flex flex-col items-start w-full">
                        <div class="max-w-3xl w-full px-4 py-3 rounded-lg bg-[var(--bg-element-dark)] text-[var(--text-primary)] border border-[var(--border-color)]">
                            <div class="file-info">
                                <h3 class="font-semibold text-[var(--text-primary)] mb-2">📑 Multiple Sheets Detected</h3>
                                <p class="text-[var(--text-secondary)] mb-4">Please select a sheet to analyze:</p>
                                <form id="sheet-selection-form" class="space-y-4">
                                    <select name="sheet-select" class="w-full bg-[var(--bg-element-dark)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2">
                                        ${result.sheet_names.map(sheet => `<option value="${sheet}">${sheet}</option>`).join('')}
                                    </select>
                                    <button type="submit" class="w-full bg-[var(--accent-primary)] text-[var(--bg-main)] font-semibold py-2.5 px-4 rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors">
                                        Load Selected Sheet
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>`;
                
                // Add the message to the chat
                const messageEl = this.chatMessages.appendChild(messageWrapper);
                
                // Handle sheet selection
                const form = messageEl.querySelector('#sheet-selection-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const selectedSheet = form.querySelector('[name="sheet-select"]').value;
                        const loadingMsg = this.addMessage('🔄 Loading selected sheet...', 'bot');
                        
                        try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('sheet_name', selectedSheet);
                            
                            const sheetRes = await fetch(`${this.backendUrl}/upload`, { method: 'POST', body: formData });
                            const sheetResult = await sheetRes.json();
                            
                            if (!sheetRes.ok) throw new Error(sheetResult.error);
                            this.sessionId = sheetResult.session_id;
                            loadingMsg.remove();
                            messageEl.remove();
                            
                            if (!sheetResult.columns_info || !Array.isArray(sheetResult.columns_info)) {
                                throw new Error('Invalid file data structure received');
                            }
                            
                            this.addMessage('', 'bot', { isFileInfo: true, fileInfo: sheetResult });
                        } catch (error) {
                            loadingMsg.remove();
                            this.addMessage(`❌ Error loading sheet: ${error.message}`, 'bot');
                        }
                    });
                }
                return;
            }
            
            this.sessionId = result.session_id;
            msg.remove();
            
            // Ensure we have the required data structure
            if (!result.columns_info || !Array.isArray(result.columns_info)) {
                throw new Error('Invalid file data structure received');
            }
            
            this.addMessage('', 'bot', { isFileInfo: true, fileInfo: result });
        } catch (error) {
            msg.remove();
            this.addMessage(`❌ Error loading file: ${error.message}`, 'bot');
        } finally {
            event.target.value = '';
        }
    }

    handleChatSubmit(event) {
        event.preventDefault();
        const message = this.chatInput.value.trim();
        if (!message) return;
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        this.addMessage("I am an analytics assistant. Please upload a file and use the forms provided to create your analysis.", 'bot');
    }
    
    createChartHtml(chartData) {
        const stats = chartData.outlier_stats || {
            total: chartData.outliers,
            high: 0,
            low: 0,
            extreme_high: 0,
            extreme_low: 0,
            recent_total: chartData.latter_half_outliers,
            recent_extreme: 0
        };
        
        return `
            <div class="chart-container">
                <h3 class="font-semibold text-[var(--text-primary)] mb-3">${chartData.title}</h3>
                <img src="data:image/png;base64,${chartData.image}" alt="${chartData.title}" class="w-full rounded-lg border border-[var(--border-color)]">
                
                <!-- Primary Statistics -->
                <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div class="stat-box">
                        <div class="stat-label">Data Points</div>
                        <div class="stat-value">${chartData.data_points}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Mean Value</div>
                        <div class="stat-value">${chartData.statistics.mean.toFixed(2)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Zero Values</div>
                        <div class="stat-value text-orange-400">${chartData.zero_values}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Value Range</div>
                        <div class="stat-value text-xs">
                            ${chartData.statistics.min.toFixed(1)} - ${chartData.statistics.max.toFixed(1)}
                        </div>
                    </div>
                </div>
                
                <!-- Outlier Analysis -->
                <div class="mt-6 bg-[var(--bg-element-dark)] rounded-lg p-4 border border-[var(--border-color)]">
                    <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-3">📊 Outlier Analysis</h4>
                    
                    <!-- Total Outliers Summary -->
                    <div class="mb-4 p-3 bg-[var(--accent-primary)]/5 rounded-lg border-2 border-[var(--accent-primary)]/20">
                        <div class="flex items-center justify-between">
                            <div class="text-[var(--text-primary)] font-medium">Total Outliers</div>
                            <div class="text-2xl font-bold text-[var(--accent-primary)]">${stats.total}</div>
                        </div>
                        <div class="mt-1 text-xs text-[var(--text-secondary)]">
                            <span class="inline-flex items-center">
                                <span class="w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>
                                ${stats.high + stats.low} outside control limits
                            </span>
                            <span class="mx-2">•</span>
                            <span class="inline-flex items-center">
                                <span class="w-2 h-2 rounded-full bg-red-500 mr-1"></span>
                                ${stats.extreme_high + stats.extreme_low} extreme deviations
                            </span>
                        </div>
                        ${stats.off_scale && stats.off_scale.total > 0 ? `
                        <div class="mt-2 text-xs bg-orange-500/10 p-2 rounded border border-orange-500/20">
                            <div class="text-orange-400 font-medium">⚠️ Additional outliers outside visible range:</div>
                            <div class="mt-1 text-[var(--text-secondary)]">
                                ${stats.off_scale.high > 0 ? `${stats.off_scale.high} above ${stats.visible_range.max.toFixed(1)}` : ''}
                                ${stats.off_scale.high > 0 && stats.off_scale.low > 0 ? ' • ' : ''}
                                ${stats.off_scale.low > 0 ? `${stats.off_scale.low} below ${stats.visible_range.min.toFixed(1)}` : ''}
                            </div>
                            <div class="mt-1 text-[var(--text-secondary)]">
                                Full data range: ${stats.min_value.toFixed(1)} - ${stats.max_value.toFixed(1)}
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <!-- Regular Outliers (Combined) -->
                        <div class="stat-box ${(stats.high + stats.low) > 0 ? 'bg-yellow-500/10' : ''}">
                            <div class="stat-label">Regular Outliers</div>
                            <div class="stat-value text-yellow-400">${stats.high + stats.low}</div>
                        </div>
                        
                        <!-- Extreme Outliers -->
                        <div class="stat-box ${stats.extreme_high > 0 ? 'bg-red-900/20' : ''}">
                            <div class="stat-label">Extreme High</div>
                            <div class="stat-value text-red-500">${stats.extreme_high}</div>
                        </div>
                        <div class="stat-box ${stats.extreme_low > 0 ? 'bg-purple-900/20' : ''}">
                            <div class="stat-label">Extreme Low</div>
                            <div class="stat-value text-purple-500">${stats.extreme_low}</div>
                        </div>
                    </div>
                    
                    <!-- Recent Anomalies -->
                    ${(stats.recent_total > 0 || stats.recent_extreme > 0) ? `
                    <div class="mt-3 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                        <div class="text-yellow-400 text-xs font-medium">
                            ⚠️ Recent Anomalies (Last 50% of data):
                            <span class="ml-1">${stats.recent_total} outliers</span>
                            ${stats.recent_extreme > 0 ? `<span class="ml-1 text-red-400">(${stats.recent_extreme} extreme)</span>` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Control Limits -->
                ${chartData.statistics.control_limits ? `
                <div class="mt-4 text-xs text-[var(--text-secondary)]">
                    Control Limits: ${chartData.statistics.control_limits.lower.toFixed(2)} - ${chartData.statistics.control_limits.upper.toFixed(2)}
                </div>
                ` : ''}
            </div>`;
    }

    handleMessageActions(event) {
        const btn = event.target.closest('#generate-chart-btn');
        if (btn) {
            this.saveUserSettings();
            this.handleFormChartGeneration(btn);
        }
        
        // Handle input changes for rolling window and std dev
        if (event.target.matches('#rolling-window-input, #std-dev-input, #aggregation-period-select')) {
            this.saveUserSettings();
        }
    }

    async handleFormChartGeneration(button) {
        if (!this.sessionId) return this.addMessage('❌ No data session. Please upload a file.', 'bot');

        const form = document.getElementById('chart-options-form');
        const valueColumn = form.querySelector('select[name="value-column"]').value;
        const dateColumn = form.querySelector('select[name="date-column"]').value;
        const cutColumn = form.querySelector('select[name="cut-column"]').value;
        const cutColumns = cutColumn ? [cutColumn] : [];
        
        // Get current form values for rolling window and std dev
        const rollingWindow = parseInt(document.getElementById('rolling-window-input')?.value) || 7;
        const stdDev = parseFloat(document.getElementById('std-dev-input')?.value) || 2;
        const aggregationPeriod = document.getElementById('aggregation-period-select')?.value || 'W';
        
        if (!valueColumn || !dateColumn) return this.addMessage('❌ Please select a Value and Time Series column.', 'bot');

        // Update user settings with current form values
        this.userSettings.rollingWindow = rollingWindow;
        this.userSettings.stdDev = stdDev;
        this.userSettings.aggregationPeriod = aggregationPeriod;

        this.addMessage(`🚀 Generating charts for <span class="value-column">${valueColumn}</span> (Rolling Window: ${rollingWindow}, Std Dev: ${stdDev}σ)...`, 'user');
        const msg = this.addMessage('🔄 Processing your analysis... This may take a moment.', 'bot');
        
        button.disabled = true;
        button.querySelector('.btn-text').textContent = 'Generating...';
        button.querySelector('.loading-spinner').classList.remove('hidden');

        try {
            const res = await fetch(`${this.backendUrl}/generate_chart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId, 
                    value_column: valueColumn, 
                    date_column: dateColumn,
                    cut_columns: cutColumns,
                    rolling_window: rollingWindow,
                    std_dev: stdDev,
                    aggregation_period: aggregationPeriod
                })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            msg.remove();
            result.charts.sort((a, b) => (b.latter_half_outliers || 0) - (a.latter_half_outliers || 0));
            result.charts.forEach(chartData => {
                this.addMessage('', 'bot', { isChart: true, chartHtml: this.createChartHtml(chartData) });
                this.addToChartHistory({ title: chartData.title, ...chartData, timestamp: new Date().toLocaleTimeString() });
            });
            this.sessionChartCount += result.charts.length;
            this.updateExportButton();
            this.addMessage(`✅ ${result.message}`, 'bot');
        } catch (error) {
            msg.remove();
            this.addMessage(`❌ Error generating charts: ${error.message}`, 'bot');
        } finally {
            button.disabled = false;
            button.querySelector('.btn-text').textContent = '🚀 Generate Charts';
            button.querySelector('.loading-spinner').classList.add('hidden');
        }
    }
    
    addToChartHistory(chartInfo) {
        this.chartHistory.unshift(chartInfo);
        if (this.chartHistory.length > 10) this.chartHistory.pop();
        this.updateChartHistoryUI();
    }

    updateChartHistoryUI() {
        this.chartHistoryElement.innerHTML = this.chartHistory.length === 0 ?
            `<li class="px-3 py-2 text-sm text-gray-500">No charts yet.</li>` :
            this.chartHistory.map(chart => `
                <li>
                    <a href="#" class="block px-3 py-2 text-sm rounded-md text-[var(--text-secondary)] hover:bg-black/20 hover:text-[var(--text-primary)]">
                        <div class="font-medium truncate">${chart.title}</div>
                        <div class="text-xs text-gray-500">${chart.timestamp}</div>
                        <div class="text-xs mt-1 ${chart.outliers > 0 ? 'text-yellow-400' : 'text-green-400'}">${chart.outliers} outliers</div>
                    </a>
                </li>`).join('');
    }

    showWelcomeScreen() {
        this.chatMessages.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center text-[var(--text-secondary)]"><svg width="80" height="80" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-6 text-[var(--text-primary)] logo-glow"><path d="M14 2.33331L25.6667 21H2.33333L14 2.33331Z" stroke="currentColor" stroke-width="2.5"/><path d="M14 21V25.6667" stroke="currentColor" stroke-width="2.5"/></svg><h2 class="text-2xl font-semibold text-gray-400 mb-2">DART Analytics Assistant</h2><p class="text-lg mb-8">Ready to turn your data into insights. Upload a CSV or Excel file to begin.</p></div>`;
    }

    saveUserSettings() {
        // Get current values from form inputs
        const rollingWindowInput = document.getElementById('rolling-window-input');
        const stdDevInput = document.getElementById('std-dev-input');
        const aggregationSelect = document.getElementById('aggregation-period-select');
        
        if (rollingWindowInput) this.userSettings.rollingWindow = parseInt(rollingWindowInput.value) || 7;
        if (stdDevInput) this.userSettings.stdDev = parseFloat(stdDevInput.value) || 2;
        if (aggregationSelect) this.userSettings.aggregationPeriod = aggregationSelect.value || 'W';
        
        localStorage.setItem('dartAnalyticsSettings', JSON.stringify(this.userSettings));
    }

    loadUserSettings() {
        try { const saved = localStorage.getItem('dartAnalyticsSettings'); if (saved) this.userSettings = { ...this.userSettings, ...JSON.parse(saved) }; } catch (e) { console.warn('Could not load user settings.'); }
    }

    async exportToPowerPoint() {
        if (!this.sessionId || this.sessionChartCount === 0) {
            this.addMessage('❌ No charts to export. Generate some charts first.', 'bot');
            return;
        }

        this.addMessage(`📊 Exporting ${this.sessionChartCount} charts to PowerPoint...`, 'user');
        const msg = this.addMessage('🔄 Creating PowerPoint presentation (ordered by anomaly priority)...', 'bot');
        
        try {
            const response = await fetch(`${this.backendUrl}/export_ppt/${this.sessionId}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }
            
            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DART_Report_${new Date().toISOString().slice(0,10)}.pptx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            msg.remove();
            this.addMessage(`✅ PowerPoint exported successfully! Charts are ordered by anomaly count (highest priority first).`, 'bot');
            
        } catch (error) {
            msg.remove();
            this.addMessage(`❌ Export failed: ${error.message}`, 'bot');
        }
    }

    updateExportButton() {
        if (this.exportPptBtn) {
            this.exportPptBtn.disabled = this.sessionChartCount === 0;
            this.exportPptBtn.textContent = this.sessionChartCount > 0 ? 
                `📊 Export ${this.sessionChartCount} Charts to PPT` : 
                '📊 Export to PowerPoint';
        }
    }

    startNewConversation() {
        this.showWelcomeScreen();
        this.sessionId = null; 
        this.chartHistory = []; 
        this.sessionChartCount = 0;
        this.updateChartHistoryUI(); 
        this.updateExportButton();
        this.chatInput.focus();
        if (window.innerWidth < 768) this.toggleSidebar(false);
    }

    toggleSidebar(show) { this.sidebar.classList.toggle('-translate-x-full', !show); }
    toggleTheme() { const isLight = document.body.classList.toggle('light-theme'); this.applyTheme(isLight ? 'light' : 'dark'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); }
    applyTheme(theme) { document.getElementById('theme-icon-sun').classList.toggle('hidden', theme === 'dark'); document.getElementById('theme-icon-moon').classList.toggle('hidden', theme === 'light'); }
    async checkBackendHealth() {
        try { const res = await fetch(`${this.backendUrl}/health`); if (!res.ok) throw new Error(); console.log('✅ Backend connected'); } catch (error) { this.addMessage('⚠️ Connection to the backend server failed. Please ensure the Python server is running.', 'bot'); }
    }
}

document.addEventListener('DOMContentLoaded', () => new DARTAnalytics());