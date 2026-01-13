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
        this.currentFileName = null; // Store the current file name
        this.currentSheetName = null; // Store the current sheet name
        this.lastFileInfo = null; // Store last file info for re-analysis
        this.excelFiles = [];  // Store all Excel files generated in this session
        
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
        
        // Chart comparison
        this.selectedCharts = new Set();  // Track selected chart IDs
        
        // Download Excel button
        this.downloadExcelBtn = document.getElementById('download-excel-btn');
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

            // Download Excel event - downloads the most recent Excel file
            if (this.downloadExcelBtn) {
                this.downloadExcelBtn.addEventListener('click', () => {
                    if (this.excelFiles.length > 0) {
                        // Download the most recent Excel file
                        const mostRecentExcel = this.excelFiles[this.excelFiles.length - 1];
                        this.downloadSpecificExcel(mostRecentExcel);
                    } else {
                        alert('No Excel file available. Please generate a chart first.');
                    }
                });
            }

        // User settings auto-save (using event delegation for dynamic forms)
        this.chatMessages.addEventListener('change', (e) => {
            const target = e.target;
            if (target.matches('#rolling-window-input, #std-dev-input, #aggregation-period-select')) {
                const form = target.closest('form');
                if (form) {
                    this._saveSettingsFromForm(form);
                }
            }
        });
    }

    _saveSettingsFromForm(form) {
        const rollingWindowInput = form.querySelector('#rolling-window-input');
        const stdDevInput = form.querySelector('#std-dev-input');
        const aggregationSelect = form.querySelector('#aggregation-period-select');
        
        if (rollingWindowInput) this.userSettings.rollingWindow = parseInt(rollingWindowInput.value) || 7;
        if (stdDevInput) this.userSettings.stdDev = parseFloat(stdDevInput.value) || 2;
        if (aggregationSelect) this.userSettings.aggregationPeriod = aggregationSelect.value || 'W';
        
        localStorage.setItem('dartAnalyticsSettings', JSON.stringify(this.userSettings));
    }

    /**
     * Download a specific Excel file with highlighted outliers.
     * 
     * @param {string} excelFilename - The specific Excel filename to download
     */
    downloadSpecificExcel(excelFilename) {
        if (!excelFilename) {
            alert('No Excel file available. Please generate a chart first.');
            return;
        }
        
        // Generate the download filename based on original file and sheet name
        let downloadName;
        // Check if we have a valid filename stored
        if (this.currentFileName && this.currentFileName.trim()) {
            // Remove the extension from the original filename and sanitize
            downloadName = this.currentFileName.replace(/\.[^/.]+$/, '').trim();
            downloadName = downloadName.replace(/[^a-zA-Z0-9-_]/g, '_'); // Sanitize filename
            
            // Add sheet name if it exists
            if (this.currentSheetName && this.currentSheetName.trim()) {
                let sheetPart = this.currentSheetName.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
                downloadName += `_${sheetPart}`;
            }
            // Add outliers suffix and extension
            downloadName += '_outliers.xlsx';
        } else {
            // Fallback if no filename is stored
            downloadName = excelFilename;
        }
        
        // Build URL with the specific Excel filename
        const url = new URL(`${this.backendUrl}/download_excel/${excelFilename}`);
        url.searchParams.set('filename', downloadName);
        
        const link = document.createElement('a');
        link.href = url.toString();
        link.download = downloadName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                            <label class="text-sm font-medium text-[var(--text-primary)] mb-2 block">
                                2. Select Time Series Column(s)
                                <span class="text-xs text-[var(--text-muted)] ml-2">(Check multiple to combine)</span>
                            </label>
                            <div class="max-h-48 overflow-y-auto border border-[var(--border-color)] rounded-lg p-3 bg-[var(--bg-element-dark)]" id="date-column-checkboxes">
                                ${dateCols.length > 0 ? `
                                    <div class="mb-3">
                                        <p class="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Suggested</p>
                                        ${dateCols.map(c => `
                                            <label class="flex items-center gap-2 py-1.5 px-2 hover:bg-[var(--bg-element-medium)] rounded cursor-pointer transition-colors">
                                                <input type="checkbox" name="date-column" value="${c}">
                                                <span class="text-sm text-[var(--text-primary)]">${c}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                <div>
                                    <p class="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">All Columns</p>
                                    ${allCols.map(c => `
                                        <label class="flex items-center gap-2 py-1.5 px-2 hover:bg-[var(--bg-element-medium)] rounded cursor-pointer transition-colors">
                                            <input type="checkbox" name="date-column" value="${c}">
                                            <span class="text-sm text-[var(--text-primary)]">${c}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            <p class="text-xs text-[var(--text-muted)] mt-2">💡 Check multiple columns (e.g., Year + Month) to combine them into a single time series</p>
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
                                    <option value="NONE" ${this.userSettings.aggregationPeriod === 'NONE' ? 'selected' : ''}>None (Original Data)</option>
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
            this.currentFileName = null;
            this.currentSheetName = null;
            this.lastFileInfo = null;
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
                            // Store original file name after validation
                            this.currentFileName = file.name ? file.name.trim() : null;
                            this.currentSheetName = selectedSheet ? selectedSheet.trim() : null;
                            this.lastFileInfo = sheetResult;
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
            // Store original file name after validation
            this.currentFileName = file.name ? file.name.trim() : null;
            this.currentSheetName = null; // No sheet selected for single-sheet files
            this.lastFileInfo = result;
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

    /**
     * Show the analysis form for re-analysis with different parameters.
     */
    showAnalysisForm() {
        if (!this.lastFileInfo || !this.sessionId) {
            this.addMessage('❌ No data available for re-analysis. Please upload a file first.', 'bot');
            return;
        }
        this.addMessage('🔄 Ready to analyze with different parameters. Select new options below:', 'bot');
        this.addMessage('', 'bot', { isFileInfo: true, fileInfo: this.lastFileInfo });
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
        // Helper to safely format numbers or show 'N/A'
        function safeFormat(val, digits = 2) {
            if (val === null || val === undefined || isNaN(val)) return 'N/A';
            return Number(val).toFixed(digits);
        }
        const stats = chartData.outlier_stats || {
            total: chartData.outliers,
            high: 0,
            low: 0,
            extreme_high: 0,
            extreme_low: 0,
            recent_total: chartData.latter_half_outliers,
        };
        
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="chart-container" data-chart-id="${chartId}">
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
                        <div class="stat-value">${safeFormat(chartData.statistics.mean, 2)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Zero Values</div>
                        <div class="stat-value text-orange-400">${chartData.zero_values}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Value Range</div>
                        <div class="stat-value text-xs">
                            ${safeFormat(chartData.statistics.min, 1)} - ${safeFormat(chartData.statistics.max, 1)}
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
                        <div class="mt-4 text-xs text-[var(--text-secondary)]">
                            Control Limits: ${safeFormat(chartData.statistics.control_limits.lower, 2)} - ${safeFormat(chartData.statistics.control_limits.upper, 2)}
                        </div>
                        <div class="mt-2 text-xs flex flex-wrap gap-3 text-[var(--text-secondary)]">
                            <span class="inline-flex items-center">
                                <span class="w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>
                                ${stats.total} outside control limits
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
                                Full data range: ${safeFormat(stats.min_value, 1)} - ${safeFormat(stats.max_value, 1)}
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <!-- Regular Outliers (Combined) - Excluding Extreme -->
                        <div class="stat-box ${(stats.total - stats.extreme_high - stats.extreme_low) > 0 ? 'bg-yellow-500/10' : ''}">
                            <div class="stat-label">Regular Outliers</div>
                            <div class="stat-value text-yellow-400">${stats.total - stats.extreme_high - stats.extreme_low}</div>
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
                
                <!-- Control Limits (Fixed) -->
                ${chartData.statistics.control_limits ? `
                <div class="mt-4 text-xs text-[var(--text-secondary)]">
                    Control Limits: ${safeFormat(chartData.statistics.control_limits.lower, 2)} - ${safeFormat(chartData.statistics.control_limits.upper, 2)}
                </div>
                ` : ''}
            </div>`;
    }

    handleMessageActions(event) {
        const btn = event.target.closest('#generate-chart-btn');
        if (btn) {
            this.handleFormChartGeneration(btn);
        }
    }

    async handleFormChartGeneration(button) {
        if (!this.sessionId) return this.addMessage('❌ No data session. Please upload a file.', 'bot');

        const form = button.closest('form');
        if (!form) return this.addMessage('❌ Form not found.', 'bot');

        const valueColumn = form.querySelector('select[name="value-column"]').value;
        
        // Handle multiple date column selection from checkboxes
        const dateColumnCheckboxes = form.querySelectorAll('input[name="date-column"]:checked');
        const selectedDateColumns = Array.from(dateColumnCheckboxes).map(cb => cb.value);
        const dateColumn = selectedDateColumns.length === 1 ? selectedDateColumns[0] : selectedDateColumns;
        
        const cutColumn = form.querySelector('select[name="cut-column"]').value;
        const cutColumns = cutColumn ? [cutColumn] : [];
        
        // Get current form values for rolling window and std dev
        const rollingWindow = parseInt(form.querySelector('#rolling-window-input')?.value) || 7;
        const stdDev = parseFloat(form.querySelector('#std-dev-input')?.value) || 2;
        const aggregationPeriod = form.querySelector('#aggregation-period-select')?.value || 'W';
        
        if (!valueColumn || !dateColumn || (Array.isArray(dateColumn) && dateColumn.length === 0)) {
            return this.addMessage('❌ Please select a Value and at least one Time Series column.', 'bot');
        }

        // Update user settings with current form values
        this.userSettings.rollingWindow = rollingWindow;
        this.userSettings.stdDev = stdDev;
        this.userSettings.aggregationPeriod = aggregationPeriod;
        localStorage.setItem('dartAnalyticsSettings', JSON.stringify(this.userSettings));

        const dateColumnDisplay = Array.isArray(dateColumn) ? dateColumn.join(' + ') : dateColumn;
        this.addMessage(`🚀 Generating charts for <span class="value-column">${valueColumn}</span> over <span class="value-column">${dateColumnDisplay}</span> (Rolling Window: ${rollingWindow}, Std Dev: ${stdDev}σ)...`, 'user');
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

            // Add download and re-analyze buttons if Excel is ready
            // Store the Excel filename for this specific analysis
            const excelFileForThisAnalysis = result.excel_file;
            
            // Track all Excel files generated in this session
            if (excelFileForThisAnalysis) {
                this.excelFiles.push(excelFileForThisAnalysis);
            }
            
            if (result.excel_ready && excelFileForThisAnalysis) {
                // Add a message about the download option
                this.addMessage('📊 Your analysis is ready! You can download the Excel file with highlighted outliers.', 'bot');
                // Create action buttons container
                const actionDiv = document.createElement('div');
                actionDiv.className = 'flex flex-wrap gap-3 justify-start mt-2';
               
                // Download Excel button - captures excelFileForThisAnalysis in closure
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-4 py-2 rounded-lg transition-colors';
                downloadBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    Download Excel
                `;
                downloadBtn.addEventListener('click', () => this.downloadSpecificExcel(excelFileForThisAnalysis));
               
                // Analyze with Different Parameters button
                const reAnalyzeBtn = document.createElement('button');
                reAnalyzeBtn.className = 'flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors';
                reAnalyzeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    Analyze with Different Parameters
                `;
                reAnalyzeBtn.addEventListener('click', () => this.showAnalysisForm());
               
                // Quick Compare button - new feature
                const quickCompareBtn = document.createElement('button');
                quickCompareBtn.className = 'flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors';
                quickCompareBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    Compare Charts
                `;
                quickCompareBtn.addEventListener('click', () => this.showChartSelectorModal());
               
                actionDiv.appendChild(downloadBtn);
                actionDiv.appendChild(reAnalyzeBtn);
                actionDiv.appendChild(quickCompareBtn);
                // Add the action buttons to chat
                const lastMessage = this.chatMessages.lastElementChild;
                if (lastMessage) {
                    const botMessageContent = lastMessage.querySelector('.max-w-3xl');
                    if (botMessageContent) {
                        botMessageContent.appendChild(actionDiv);
                    }
                }
            }

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
        this.lastFileInfo = null;
        this.excelFiles = [];  // Clear Excel files list
        // Preserve currentFileName and currentSheetName for Excel downloads
        this.updateChartHistoryUI(); 
        this.updateExportButton();
        this.chatInput.focus();
        if (window.innerWidth < 768) this.toggleSidebar(false);
    }

    toggleSidebar(show) { this.sidebar.classList.toggle('-translate-x-full', !show); }
    toggleTheme() {
    const html = document.documentElement;               // <html>
    const isLight = html.classList.toggle('light-theme'); // toggle class
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    this.applyTheme(newTheme);
}

applyTheme(theme) {
    const sun  = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');
    if (theme === 'light') {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
    } else {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
    }
}
    async checkBackendHealth() {
        try { const res = await fetch(`${this.backendUrl}/health`); if (!res.ok) throw new Error(); console.log('✅ Backend connected'); } catch (error) { this.addMessage('⚠️ Connection to the backend server failed. Please ensure the Python server is running.', 'bot'); }
    }

    /**
     * Handle compare checkbox selection
     */
    /**
     * Show chart selector modal for easy multi-selection
     */
    showChartSelectorModal() {
        // Get all chart containers that have valid images
        const allCharts = Array.from(document.querySelectorAll('[data-chart-id]')).filter(chart => {
            const chartImg = chart.querySelector('img[src^="data:image"]');
            return chartImg && chartImg.src && chartImg.src.length > 50; // Ensure valid base64 image
        });
        
        if (allCharts.length < 2) {
            this.addMessage('⚠️ You need at least 2 charts to compare. Generate more charts first.', 'bot');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm';
        modal.style.animation = 'fadeIn 0.2s ease-out';
        
        modal.innerHTML = `
            <div class="relative max-w-5xl w-full mx-4 bg-[var(--bg-element-dark)] rounded-xl shadow-2xl border-2 border-[var(--accent-primary)]/40 max-h-[90vh] flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between p-6 border-b-2 border-[var(--border-color)]">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-[var(--text-primary)]">Select Charts to Compare</h3>
                            <p class="text-sm text-[var(--text-secondary)] mt-0.5">Choose 2 or more charts for side-by-side analysis</p>
                        </div>
                    </div>
                    <button class="close-modal p-2 rounded-lg hover:bg-[var(--bg-element-medium)] text-[var(--text-secondary)] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <!-- Chart Grid -->
                <div class="flex-1 overflow-y-auto p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${allCharts.map((chart, index) => {
                            const chartId = chart.getAttribute('data-chart-id');
                            const chartImg = chart.querySelector('img[src^="data:image"]');
                            const chartTitle = chart.querySelector('h3')?.textContent || `Chart ${index + 1}`;
                            const totalOutliers = chart.querySelector('.text-2xl.font-bold')?.textContent || '0';
                            const isSelected = this.selectedCharts.has(chartId);
                            
                            return `
                                <div class="chart-selector-item relative bg-[var(--bg-main)] rounded-lg border-2 ${isSelected ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30' : 'border-[var(--border-color)]'} hover:border-[var(--accent-primary)] transition-all duration-200 cursor-pointer" data-chart-id="${chartId}">
                                    ${isSelected ? `
                                        <div class="absolute -top-2 -right-2 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg z-10">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    ` : ''}
                                    <div class="p-3">
                                        <div class="text-xs font-semibold text-[var(--text-primary)] mb-2 truncate" title="${chartTitle}">${chartTitle}</div>
                                        <div class="aspect-video rounded overflow-hidden border border-[var(--border-color)] mb-2 bg-white/5">
                                            ${chartImg ? `<img src="${chartImg.src}" alt="${chartTitle}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">No preview</div>'}
                                        </div>
                                        <div class="flex items-center justify-between text-xs">
                                            <span class="text-[var(--text-secondary)]">Outliers:</span>
                                            <span class="font-bold text-[var(--accent-primary)]">${totalOutliers}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="flex items-center justify-between p-6 border-t-2 border-[var(--border-color)] bg-[var(--bg-element-medium)]">
                    <div class="flex items-center gap-4">
                        <div class="text-sm text-[var(--text-secondary)]">
                            <span class="font-semibold text-[var(--text-primary)] selected-count">${this.selectedCharts.size}</span> charts selected
                        </div>
                        <div class="flex gap-2">
                            <button class="select-all text-xs px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors font-medium">
                                ✓ Select All
                            </button>
                            <button class="select-recent text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium">
                                ⚡ Recent (Last 3)
                            </button>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button class="clear-selection px-4 py-2 rounded-lg bg-[var(--bg-element-dark)] text-[var(--text-secondary)] hover:bg-red-500 hover:text-white transition-colors font-medium">
                            Clear Selection
                        </button>
                        <button class="compare-selected px-6 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" ${this.selectedCharts.size < 2 ? 'disabled' : ''}>
                            Compare Charts
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event handlers
        const closeModal = () => {
            modal.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => modal.remove(), 200);
        };
        
        // Close button
        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Chart selection
        modal.querySelectorAll('.chart-selector-item').forEach(item => {
            item.addEventListener('click', () => {
                const chartId = item.getAttribute('data-chart-id');
                
                if (this.selectedCharts.has(chartId)) {
                    this.selectedCharts.delete(chartId);
                    item.classList.remove('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                    item.classList.add('border-[var(--border-color)]');
                    item.querySelector('.absolute')?.remove();
                } else {
                    this.selectedCharts.add(chartId);
                    item.classList.remove('border-[var(--border-color)]');
                    item.classList.add('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                    item.insertAdjacentHTML('afterbegin', `
                        <div class="absolute -top-2 -right-2 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    `);
                }
                
                // Update count and button state
                const count = this.selectedCharts.size;
                modal.querySelector('.selected-count').textContent = count;
                modal.querySelector('.compare-selected').disabled = count < 2;
            });
        });
        
        // Clear selection
        modal.querySelector('.clear-selection').addEventListener('click', () => {
            this.selectedCharts.clear();
            modal.querySelectorAll('.chart-selector-item').forEach(item => {
                item.classList.remove('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                item.classList.add('border-[var(--border-color)]');
                item.querySelector('.absolute')?.remove();
            });
            modal.querySelector('.selected-count').textContent = '0';
            modal.querySelector('.compare-selected').disabled = true;
        });
        
        // Select All
        modal.querySelector('.select-all').addEventListener('click', () => {
            const items = modal.querySelectorAll('.chart-selector-item');
            items.forEach(item => {
                const chartId = item.getAttribute('data-chart-id');
                if (!this.selectedCharts.has(chartId)) {
                    this.selectedCharts.add(chartId);
                    
                    item.classList.remove('border-[var(--border-color)]');
                    item.classList.add('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                    if (!item.querySelector('.absolute')) {
                        item.insertAdjacentHTML('afterbegin', `
                            <div class="absolute -top-2 -right-2 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg z-10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        `);
                    }
                }
            });
            
            const count = this.selectedCharts.size;
            modal.querySelector('.selected-count').textContent = count;
            modal.querySelector('.compare-selected').disabled = count < 2;
        });
        
        // Select Recent (Last 3)
        modal.querySelector('.select-recent').addEventListener('click', () => {
            // Clear existing selection first
            this.selectedCharts.clear();
            modal.querySelectorAll('.chart-selector-item').forEach(item => {
                item.classList.remove('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                item.classList.add('border-[var(--border-color)]');
                item.querySelector('.absolute')?.remove();
            });
            
            // Select last 3 charts
            const items = Array.from(modal.querySelectorAll('.chart-selector-item'));
            const recentItems = items.slice(0, Math.min(3, items.length));
            
            recentItems.forEach(item => {
                const chartId = item.getAttribute('data-chart-id');
                this.selectedCharts.add(chartId);
                
                item.classList.remove('border-[var(--border-color)]');
                item.classList.add('border-[var(--accent-primary)]', 'ring-2', 'ring-[var(--accent-primary)]/30');
                item.insertAdjacentHTML('afterbegin', `
                    <div class="absolute -top-2 -right-2 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                `);
            });
            
            const count = this.selectedCharts.size;
            modal.querySelector('.selected-count').textContent = count;
            modal.querySelector('.compare-selected').disabled = count < 2;
        });
        
        // Compare selected
        modal.querySelector('.compare-selected').addEventListener('click', () => {
            closeModal();
            this.showComparisonView();
        });
    }

    /**
     * Show comparison view with selected charts side-by-side
     */
    showComparisonView() {
        if (this.selectedCharts.size < 2) {
            this.addMessage('⚠️ Please select at least 2 charts to compare.', 'bot');
            return;
        }

        // Get all selected chart containers
        const chartContainers = Array.from(this.selectedCharts).map(chartId => {
            return document.querySelector(`[data-chart-id="${chartId}"]`);
        }).filter(container => container !== null);

        if (chartContainers.length < 2) {
            this.addMessage('⚠️ Selected charts not found. Please try again.', 'bot');
            return;
        }

        // Create comparison view HTML with professional styling
        const comparisonHtml = `
            <div class="comparison-view bg-[var(--bg-element-dark)] rounded-xl p-6 border border-[var(--accent-primary)]/40 shadow-xl">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-color)]">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-[var(--text-primary)]">Comparative Analysis</h3>
                            <p class="text-xs text-[var(--text-secondary)]">${chartContainers.length} charts</p>
                        </div>
                    </div>
                    <button class="close-comparison px-4 py-2 rounded-lg bg-[var(--bg-element-medium)] text-[var(--text-secondary)] hover:bg-red-500 hover:text-white transition-all duration-200 flex items-center gap-2 text-sm font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>Close</span>
                    </button>
                </div>
                <div class="grid ${chartContainers.length === 2 ? 'grid-cols-1 md:grid-cols-2' : chartContainers.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'} gap-6">
                    ${chartContainers.map((container, index) => {
                        // Extract just the chart image (it's directly in the container)
                        const chartImg = container.querySelector('img[src^="data:image"]');
                        const chartTitle = container.querySelector('h3')?.textContent || `Chart ${index + 1}`;
                        
                        return `
                            <div class="comparison-chart-card bg-[var(--bg-main)] rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-all duration-300 hover:shadow-xl">
                                <div class="bg-[var(--accent-primary)] px-3 py-2 flex items-center gap-2">
                                    <div class="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-white text-xs font-bold">${index + 1}</div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-xs font-bold text-white truncate" title="${chartTitle}">${chartTitle}</div>
                                    </div>
                                </div>
                                <div class="p-3">
                                    <div class="chart-display-wrapper rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-[var(--accent-primary)]/60 transition-all duration-300 cursor-zoom-in mb-3 bg-white/5" data-chart-src="${chartImg ? chartImg.src : ''}" data-chart-title="${chartTitle}">
                                        ${chartImg ? `<img src="${chartImg.src}" alt="${chartTitle}" class="w-full">` : '<p class="text-xs text-[var(--text-secondary)] p-6 text-center">Chart not available</p>'}
                                    </div>
                                    <div class="bg-[var(--bg-element-dark)]/50 rounded-lg p-3 border border-[var(--border-color)]/50">
                                        ${this.extractChartStats(container)}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Add comparison view as a message
        this.addMessage('', 'bot', {
            isChart: true,
            chartHtml: comparisonHtml
        });

        // Add event listeners for close button and chart clicks
        setTimeout(() => {
            const closeBtn = this.chatMessages.querySelector('.close-comparison');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    closeBtn.closest('.message-wrapper').remove();
                });
            }
            
            // Add click handlers for full-screen chart view
            const chartWrappers = this.chatMessages.querySelectorAll('.chart-display-wrapper');
            chartWrappers.forEach(wrapper => {
                wrapper.addEventListener('click', (e) => {
                    const chartSrc = wrapper.getAttribute('data-chart-src');
                    const chartTitle = wrapper.getAttribute('data-chart-title');
                    if (chartSrc) {
                        this.openFullScreenChart(chartSrc, chartTitle);
                    }
                });
            });
        }, 100);

        // Clear selections
        this.selectedCharts.clear();
    }

    openFullScreenChart(chartSrc, chartTitle) {
        // Create full-screen modal overlay
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm';
        modal.style.animation = 'fadeIn 0.2s ease-out';
        
        modal.innerHTML = `
            <div class="relative max-w-7xl max-h-screen w-full h-full p-8 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-white">${chartTitle}</h3>
                    <button class="close-fullscreen px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-red-500 transition-all duration-200 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>Close</span>
                    </button>
                </div>
                <div class="flex-1 flex items-center justify-center overflow-auto">
                    <img src="${chartSrc}" alt="${chartTitle}" class="max-w-full max-h-full object-contain rounded-lg border-2 border-[var(--accent-primary)] shadow-2xl">
                </div>
                <div class="mt-4 text-center text-sm text-white/60">
                    Click anywhere outside the chart or press ESC to close
                </div>
            </div>
        `;
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-fullscreen') || e.target.closest('.close-fullscreen')) {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => modal.remove(), 200);
            }
        });
        
        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => modal.remove(), 200);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        document.body.appendChild(modal);
    }

    /**
     * Generate comparison summary statistics
     */
    generateComparisonSummary(chartContainers) {
        return chartContainers.map((container, index) => {
            const title = container.querySelector('h3')?.textContent || `Chart ${index + 1}`;
            
            // Find data points - look for all stat-boxes and find the one with "Data Points" label
            let dataPoints = 'N/A';
            const statBoxes = container.querySelectorAll('.stat-box');
            for (const box of statBoxes) {
                const label = box.querySelector('.stat-label');
                if (label && label.textContent.trim() === 'Data Points') {
                    dataPoints = box.querySelector('.stat-value')?.textContent || 'N/A';
                    break;
                }
            }
            
            const totalOutliers = container.querySelector('.text-2xl.font-bold')?.textContent || '0';
            
            return `
                <div class="p-3 bg-[var(--bg-element-dark)] rounded border border-[var(--border-color)]">
                    <div class="font-medium text-[var(--text-primary)] mb-2 truncate" title="${title}">
                        ${title.length > 30 ? title.substring(0, 30) + '...' : title}
                    </div>
                    <div class="space-y-1 text-[var(--text-secondary)]">
                        <div>📊 Data: ${dataPoints}</div>
                        <div>⚠️ Outliers: <span class="text-[var(--accent-primary)] font-semibold">${totalOutliers}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    extractChartStats(container) {
        // Extract key statistics from a chart container
        const statBoxes = container.querySelectorAll('.stat-box');
        const stats = {};
        
        statBoxes.forEach(box => {
            const label = box.querySelector('.stat-label')?.textContent.trim();
            const value = box.querySelector('.stat-value')?.textContent.trim();
            if (label && value) {
                stats[label] = value;
            }
        });
        
        // Get total outliers count
        const totalOutliers = container.querySelector('.text-2xl.font-bold')?.textContent || '0';
        
        // Build professional minimal stats display
        return `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Data Points</span>
                    <span class="text-base font-bold text-[var(--text-primary)]">${stats['Data Points'] || 'N/A'}</span>
                </div>
                <div class="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent"></div>
                <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total Outliers</span>
                    <span class="text-lg font-bold text-[var(--accent-primary)]">${totalOutliers}</span>
                </div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => new DARTAnalytics());