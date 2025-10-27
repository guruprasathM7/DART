"""
DART Analytics Backend Server
============================

A Flask-based web server that provides REST API endpoints for generating 
MSD (Moving Standard Deviation) control charts from CSV/Excel data files.

Key Features:
- File upload and parsing (CSV/Excel)
- Automatic column type detection
- Control chart generation with statistical analysis
- PowerPoint export functionality
- Session management for multi-chart workflows

Author: DART Analytics Team
Version: 2.2 (Production Ready)
"""

# Core Flask imports for web server functionality
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS  # Enable cross-origin requests from frontend

# Data processing and analysis libraries
import pandas as pd  # Data manipulation and analysis
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server environment
import matplotlib.pyplot as plt  # Chart generation
import numpy as np  # Numerical computations

# System and utility imports
import os  # File system operations
import io  # Input/output operations for in-memory files
import base64  # Encoding images for JSON transmission
from datetime import datetime, timedelta  # Date/time handling
import traceback  # Error debugging
import warnings  # Warning management
import re  # Regular expressions for data cleaning
import csv  # CSV file parsing
import chardet  # Character encoding detection

# PowerPoint generation libraries
from pptx import Presentation  # Create PowerPoint presentations
from pptx.util import Inches, Pt  # Measurement units
from pptx.enum.text import PP_ALIGN  # Text alignment
from pptx.dml.color import RGBColor  # Color management

# Suppress matplotlib warnings in production
warnings.filterwarnings("ignore", "Could not infer format", UserWarning)

# Initialize Flask application
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS for all routes to allow frontend communication

def convert_numpy_types(obj):
    """
    Recursively convert NumPy data types to native Python types for JSON serialization.
    
    This function is essential because NumPy types (int64, float64, bool_, etc.) 
    are not JSON serializable by default. It handles nested structures like 
    dictionaries and lists containing NumPy types.
    
    Args:
        obj: Any object that may contain NumPy types
        
    Returns:
        Object with all NumPy types converted to native Python types
        
    Example:
        >>> convert_numpy_types(np.int64(42))
        42
        >>> convert_numpy_types({'mean': np.float64(3.14)})
        {'mean': 3.14}
    """
    if isinstance(obj, np.integer): 
        return int(obj)
    if isinstance(obj, np.floating): 
        return float(obj)
    if isinstance(obj, np.bool_): 
        return bool(obj)  # Handle NumPy boolean types
    if isinstance(obj, np.ndarray): 
        return obj.tolist()  # Convert arrays to lists
    if isinstance(obj, dict): 
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    if isinstance(obj, list): 
        return [convert_numpy_types(item) for item in obj]
    return obj  # Return unchanged if not a NumPy type

class CheckColumns:
    """
    Main class for generating MSD (Moving Standard Deviation) control charts.
    
    This class handles the core analytics functionality including:
    - Data preprocessing and validation
    - Statistical calculations for control limits
    - Chart generation with matplotlib
    - Outlier detection and analysis
    
    The class implements statistical process control principles to identify
    data points that fall outside normal variation patterns.
    """
    
    def __init__(self, data_df):
        """
        Initialize the CheckColumns analyzer with a pandas DataFrame.
        
        Args:
            data_df (pd.DataFrame): The input data to analyze
            
        Raises:
            ValueError: If input is not a pandas DataFrame
        """
        if not isinstance(data_df, pd.DataFrame):
            raise ValueError("Input data must be a pandas DataFrame.")
        self.df = data_df.copy()  # Create a copy to avoid modifying original data
        self.session_charts = []  # Store generated charts for PowerPoint export

    def create_control_chart(self, value_col, date_col, cut_cols=None, filters=None, aggregation_period='W', rolling_window=7, std_dev=2):
        """
        Generate MSD control charts from the loaded data.
        
        This is the main method that orchestrates the entire chart generation process:
        1. Applies user-specified filters to the data
        2. Cleans and validates the data (removes nulls, converts types)
        3. Groups data by cut columns if specified
        4. Generates individual charts for each group
        5. Returns chart data and processing statistics
        
        Args:
            value_col (str): Column name containing the numeric values to analyze
            date_col (str): Column name containing date/time information
            cut_cols (list, optional): Columns to group data by (creates separate charts)
            filters (dict, optional): Column filters to apply before analysis
            aggregation_period (str): Time period for data aggregation ('D', 'W', 'M', 'Y')
            rolling_window (int): Number of periods for rolling average calculation
            std_dev (float): Number of standard deviations for control limits
            
        Returns:
            tuple: (charts_data, status_report)
                - charts_data: List of chart dictionaries with images and statistics
                - status_report: Dictionary with processing information
        """
        # Clear any existing matplotlib state to prevent memory leaks
        plt.close('all')
        plt.clf()
        plt.cla()
        
        # Step 1: Apply user-specified filters
        filtered_df = self.df
        if filters:
            for col, values in filters.items():
                if col in filtered_df.columns and values:
                    filtered_df = filtered_df[filtered_df[col].isin(values)]
        
        if filtered_df.empty: 
            return [], {"status": "No data remaining after applying filters."}

        # Step 2: Data cleaning and validation
        initial_rows = len(filtered_df)
        clean_df = filtered_df.dropna(subset=[date_col, value_col]).copy()
        
        # Convert columns to appropriate data types
        clean_df[value_col] = pd.to_numeric(clean_df[value_col], errors='coerce')
        clean_df[date_col] = pd.to_datetime(clean_df[date_col], errors='coerce')
        
        # Remove rows where conversion failed
        clean_df.dropna(subset=[date_col, value_col], inplace=True)
        
        rows_dropped = initial_rows - len(clean_df)
        if clean_df.empty: 
            return [], {"status": f"{rows_dropped} rows dropped; no data remains."}

        charts_data = []
        
        # Step 3: Handle data grouping (cut columns)
        if cut_cols and len(cut_cols) > 0:
            # Validate cut columns - only use columns that exist and have variation
            valid_cut_cols = []
            for col in cut_cols:
                if col in clean_df.columns and clean_df[col].nunique() > 1:
                    valid_cut_cols.append(col)
            
            if valid_cut_cols:
                # Create separate charts for each group
                grouped_by_cuts = clean_df.groupby(valid_cut_cols)
                
                for group_key, group_df in grouped_by_cuts:
                    if len(group_df) < 2:  # Skip groups with insufficient data
                        continue
                    
                    chart_data = self._process_group(group_df, value_col, date_col, group_key, valid_cut_cols, aggregation_period, rolling_window, std_dev)
                    if chart_data:
                        charts_data.append(chart_data)
            else:
                # No valid cut columns, create single chart
                chart_data = self._process_group(clean_df, value_col, date_col, None, [], aggregation_period, rolling_window, std_dev)
                if chart_data:
                    charts_data.append(chart_data)
        else:
            # No cut columns specified, create single chart for all data
            chart_data = self._process_group(clean_df, value_col, date_col, None, [], aggregation_period, rolling_window, std_dev)
            if chart_data:
                charts_data.append(chart_data)

        return charts_data, {"status": f"Analysis complete. {rows_dropped} rows excluded. Generated {len(charts_data)} charts."}

    def _process_group(self, group_df, value_col, date_col, group_key, cut_cols, aggregation_period, rolling_window, std_dev):
        """
        Process a single data group and calculate statistical control parameters.
        
        This method performs the core statistical analysis for MSD control charts:
        1. Aggregates data by time period (daily, weekly, monthly, yearly)
        2. Calculates sigma estimate using moving range method
        3. Computes rolling mean and control limits
        4. Identifies outliers and zero values
        5. Generates the visual chart
        
        Args:
            group_df (pd.DataFrame): Data for this specific group
            value_col (str): Column containing values to analyze
            date_col (str): Column containing date information
            group_key: Identifier for this group (from cut columns)
            cut_cols (list): List of grouping column names
            aggregation_period (str): Time aggregation period
            rolling_window (int): Window size for rolling calculations
            std_dev (float): Standard deviation multiplier for control limits
            
        Returns:
            dict or None: Chart data dictionary or None if processing fails
        """
        try:
            # Step 1: Aggregate data by time period
            # Set date as index and resample by specified period (D/W/M/Y)
            group_df_resampled = group_df.set_index(date_col)[[value_col]].resample(aggregation_period).mean().dropna().reset_index()
            if len(group_df_resampled) < 2:  # Need at least 2 points for analysis
                return None

            resampled_df = group_df_resampled.copy()
            
            # Step 2: Prepare data for sigma calculation (exclude zeros)
            non_zero_values = resampled_df[value_col].replace(0, np.nan)
            
            # Step 3: Calculate sigma estimate using moving range method
            # This is a standard statistical process control technique
            sigma_estimate = np.nan
            if len(non_zero_values.dropna()) > 1:
                # Calculate moving ranges (absolute differences between consecutive points)
                moving_ranges = non_zero_values.dropna().diff().abs()
                # Use the standard factor 1.128 for moving range estimation
                sigma_estimate = (moving_ranges.mean() / 1.128) if len(moving_ranges.dropna()) > 1 else non_zero_values.std(ddof=1)
            
            if pd.isna(sigma_estimate) or sigma_estimate == 0: 
                return None

            # Step 4: Calculate control chart parameters
            # Rolling mean provides the center line
            rolling_mean = non_zero_values.rolling(window=rolling_window, min_periods=1).mean()
            resampled_df['rolling_mean'] = rolling_mean.interpolate(method='linear', limit_direction='both')
            
            # Control limits are center line ± (std_dev × sigma)
            resampled_df['upper_bound'] = resampled_df['rolling_mean'] + (std_dev * sigma_estimate)
            resampled_df['lower_bound'] = (resampled_df['rolling_mean'] - (std_dev * sigma_estimate)).clip(lower=0)
            
            # Step 5: Identify outliers and special values
            # Outliers are points outside control limits (excluding zeros)
            resampled_df['outlier'] = resampled_df.apply(
                lambda r: r[value_col] if (r[value_col] > r['upper_bound'] or r[value_col] < r['lower_bound']) and r[value_col] != 0 else np.nan, 
                axis=1
            )
            # Track zero values separately as they may indicate special conditions
            resampled_df['zero_value'] = resampled_df.apply(
                lambda r: r[value_col] if r[value_col] == 0 else np.nan, 
                axis=1
            )
            
            # Step 6: Generate the visual chart
            chart_data = self.generate_plot(resampled_df.copy(), value_col, date_col, group_key, cut_cols, rolling_window, std_dev, aggregation_period)
            
            # Clean up matplotlib resources
            plt.close('all')
            plt.clf()
            plt.cla()
            
            return chart_data
            
        except Exception as e:
            print(f"Error processing group {group_key}: {e}")
            return None

    def generate_plot(self, plot_df, value_col, date_col, group_key, cut_cols, rolling_window, std_dev, aggregation_period):
        """
        Generate a professional MSD control chart using matplotlib.
        
        This method creates a comprehensive statistical process control chart with:
        - Actual data points connected by lines
        - Rolling mean (center line) 
        - Upper and lower control limits
        - Highlighted outliers and zero values
        - Professional styling and annotations
        
        Args:
            plot_df (pd.DataFrame): Processed data ready for plotting
            value_col (str): Name of the value column being analyzed
            date_col (str): Name of the date column
            group_key: Identifier for data grouping
            cut_cols (list): Column names used for grouping
            rolling_window (int): Rolling window size for display
            std_dev (float): Standard deviation multiplier for display
            aggregation_period (str): Time aggregation period for display
            
        Returns:
            dict: Chart data including base64 image, statistics, and metadata
        """
        # Step 1: Initialize clean matplotlib environment
        plt.clf()
        plt.cla()
        plt.close('all')
        
        # Step 2: Set professional styling and create figure
        plt.style.use('seaborn-v0_8-whitegrid')  # Professional grid style
        fig, ax = plt.subplots(figsize=(15, 7))  # Wide format for time series
        ax.clear()  # Ensure clean axes state
        
        # Step 3: Plot the main data elements
        # Main data line with markers
        ax.plot(plot_df[date_col], plot_df[value_col], 
               marker='o', linestyle='-', color='blue', 
               label='Actual', markersize=4)
        
        # Rolling mean (center line)
        ax.plot(plot_df[date_col], plot_df['rolling_mean'], 
               color='green', linestyle='-', linewidth=2, 
               label=f'{rolling_window}-period Rolling Mean')
        
        # Control limits (upper and lower bounds)
        ax.plot(plot_df[date_col], plot_df['upper_bound'], 
               color='red', linestyle='--', linewidth=1, 
               label=f'±{std_dev}σ Control Limit')
        ax.plot(plot_df[date_col], plot_df['lower_bound'], 
               color='red', linestyle='--', linewidth=1)
        
        # Control zone shading
        ax.fill_between(plot_df[date_col], plot_df['lower_bound'], plot_df['upper_bound'], 
                       color='gray', alpha=0.15, label='Control Zone')
        
        # Step 4: Highlight special points (outliers and zeros)
        outliers_mask = plot_df['outlier'].notna()
        zero_mask = plot_df['zero_value'].notna()
        
        # Outliers (points outside control limits)
        if outliers_mask.any(): 
            ax.scatter(plot_df.loc[outliers_mask, date_col], 
                      plot_df.loc[outliers_mask, 'outlier'], 
                      color='red', s=100, zorder=5, 
                      label=f'Outliers ({outliers_mask.sum()})')
        
        # Zero values (may indicate special conditions)
        if zero_mask.any(): 
            ax.scatter(plot_df.loc[zero_mask, date_col], 
                      plot_df.loc[zero_mask, 'zero_value'], 
                      color='orange', s=50, zorder=5, 
                      label=f'Zero Values ({zero_mask.sum()})')
        
        # Step 5: Create descriptive titles and labels
        title_add, group_name = "", "All Data"
        if cut_cols and group_key is not None:
            # Handle both single and multiple grouping columns
            if isinstance(group_key, tuple):
                group_details = list(zip(cut_cols, group_key))
            else:
                group_details = [(cut_cols[0], group_key)]
            title_add = " - " + ", ".join(f"{col}={val}" for col, val in group_details)
            group_name = title_add.replace(" - ", "")
        
        # Map aggregation codes to readable names
        agg_map = {'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly', 'Y': 'Yearly'}
        
        # Set comprehensive title with analysis parameters
        ax.set_title(f"MSD Control Chart for {value_col}{title_add}\n"
                    f"({agg_map.get(aggregation_period, '')} Aggregation, "
                    f"{rolling_window}-period rolling window)", 
                    fontsize=14, weight='bold')
        
        # Set axis labels
        ax.set_xlabel(f'Time ({agg_map.get(aggregation_period, "")})', fontsize=12)
        ax.set_ylabel(value_col, fontsize=12)
        
        # Step 6: Apply professional formatting
        plt.xticks(rotation=30, ha="right")  # Rotate date labels for readability
        plt.tight_layout()  # Optimize spacing
        ax.legend(loc='best')  # Add legend in optimal position
        
        # Step 7: Save chart to memory buffer
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        
        # Step 8: Clean up matplotlib resources
        plt.close(fig)
        plt.clf()
        plt.cla()
        
        # Step 9: Calculate summary statistics
        total_points = len(plot_df)
        
        # Create comprehensive chart data package
        chart_data = {
            'image': base64.b64encode(img_buffer.getvalue()).decode(),  # Base64 encoded image
            'title': f"Chart for {value_col}{title_add}", 
            'group': group_name, 
            'data_points': total_points, 
            'outliers': int(outliers_mask.sum()),  # Total outliers
            'latter_half_outliers': int(outliers_mask.iloc[max(1, total_points // 2):].sum()),  # Recent outliers
            'zero_values': int(zero_mask.sum()), 
            'statistics': {
                'mean': float(plot_df[value_col].mean()), 
                'std': float(plot_df[value_col].std()), 
                'min': float(plot_df[value_col].min()), 
                'max': float(plot_df[value_col].max())
            }
        }
        
        # Store raw image buffer for PowerPoint export (not sent in JSON)
        chart_data['_image_buffer'] = img_buffer.getvalue()
        
        return chart_data

# ============================================================================
# GLOBAL SESSION MANAGEMENT
# ============================================================================

# Global storage for session charts - stores chart data for PowerPoint export
# Structure: {session_id: [chart_data_1, chart_data_2, ...]}
session_charts_storage = {}

def cleanup_temp_files(max_age_hours=1):
    """
    Clean up temporary files older than specified age to prevent disk space issues.
    
    This function automatically removes old session data files to maintain
    system performance and prevent storage overflow in production environments.
    
    Args:
        max_age_hours (int): Maximum age of files to keep (default: 1 hour)
    """
    temp_dir = 'temp_data'
    if not os.path.isdir(temp_dir): 
        return
    
    current_time = datetime.now()
    
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        try:
            if os.path.isfile(file_path):
                # Get file modification time
                file_age = current_time - datetime.fromtimestamp(os.path.getmtime(file_path))
                
                # Remove files older than max_age_hours
                if file_age > timedelta(hours=max_age_hours):
                    os.remove(file_path)
                    print(f"Cleaned up old temp file: {filename}")
        except Exception as e: 
            print(f"Error cleaning up file {filename}: {e}")

def create_powerpoint_export(charts_data, session_id):
    """
    Create a professional PowerPoint presentation from generated charts.
    
    This function generates a comprehensive business report with:
    - Title slide with generation timestamp
    - Executive summary with key metrics
    - Individual slides for each chart (ordered by priority)
    - Statistical summaries and priority indicators
    
    Charts are automatically sorted by recent anomaly count to prioritize
    the most critical findings for business review.
    
    Args:
        charts_data (list): List of chart dictionaries with image data
        session_id (str): Unique session identifier for filename
        
    Returns:
        tuple: (file_path, filename) or (None, None) if creation fails
    """
    try:
        # Step 1: Sort charts by business priority (recent anomalies first)
        # Recent anomalies are more actionable than historical ones
        sorted_charts = sorted(charts_data, 
                             key=lambda x: x.get('latter_half_outliers', 0), 
                             reverse=True)
        
        # Step 2: Initialize PowerPoint presentation
        prs = Presentation()
        
        # Step 3: Create title slide
        title_slide_layout = prs.slide_layouts[0]  # Title slide layout
        slide = prs.slides.add_slide(title_slide_layout)
        title = slide.shapes.title
        subtitle = slide.placeholders[1]
        
        # Set title slide content
        title.text = "DART Analytics Report"
        subtitle.text = (f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n"
                        f"Total Charts: {len(sorted_charts)}")
        
        # Step 4: Create executive summary slide
        summary_layout = prs.slide_layouts[1]  # Title and content layout
        slide = prs.slides.add_slide(summary_layout)
        title = slide.shapes.title
        title.text = "Executive Summary"
        
        # Calculate key business metrics
        charts_with_recent_anomalies = len([c for c in sorted_charts if c.get('latter_half_outliers', 0) > 0])
        total_anomalies = sum(c.get('outliers', 0) for c in sorted_charts)
        recent_anomalies = sum(c.get('latter_half_outliers', 0) for c in sorted_charts)
        
        # Add executive summary content
        content = slide.placeholders[1]
        summary_text = f"""Key Findings:

• Total Charts Analyzed: {len(sorted_charts)}
• Charts with Recent Anomalies: {charts_with_recent_anomalies}
• Total Anomalies Detected: {total_anomalies}
• Recent Anomalies (Last Half): {recent_anomalies}

Charts are ordered by recent anomaly count (highest first) for priority review."""
        
        content.text = summary_text
        
        # Step 5: Create individual chart slides
        for i, chart in enumerate(sorted_charts, 1):
            # Use blank layout for maximum flexibility
            chart_layout = prs.slide_layouts[6]  # Blank layout
            slide = prs.slides.add_slide(chart_layout)
            
            # Add chart title with numbering
            title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.2), Inches(9), Inches(0.8))
            title_frame = title_box.text_frame
            title_frame.text = f"{i}. {chart.get('title', 'Chart')}"
            title_frame.paragraphs[0].font.size = Pt(24)
            title_frame.paragraphs[0].font.bold = True
            
            # Add chart image (main content)
            if '_image_buffer' in chart:
                img_stream = io.BytesIO(chart['_image_buffer'])
                slide.shapes.add_picture(img_stream, Inches(0.5), Inches(1.2), Inches(9), Inches(5))
            
            # Add comprehensive statistics box
            stats_box = slide.shapes.add_textbox(Inches(0.5), Inches(6.5), Inches(9), Inches(1.5))
            stats_frame = stats_box.text_frame
            
            # Calculate additional metrics for business context
            zero_pct = (chart.get('zero_values', 0) / chart.get('data_points', 1)) * 100 if chart.get('data_points', 0) > 0 else 0
            
            # Create detailed statistics text
            stats_text = f"""Statistics:
Data Points: {chart.get('data_points', 'N/A')} | Total Outliers: {chart.get('outliers', 0)} | Recent Outliers: {chart.get('latter_half_outliers', 0)} | Zero Values: {chart.get('zero_values', 0)} ({zero_pct:.1f}%)
Mean: {chart.get('statistics', {}).get('mean', 0):.3f} | Std Dev: {chart.get('statistics', {}).get('std', 0):.3f} | Min: {chart.get('statistics', {}).get('min', 0):.3f} | Max: {chart.get('statistics', {}).get('max', 0):.3f}

Note: Charts are ordered by recent anomaly count (highest priority first). High zero percentages may indicate data quality issues or normal operational patterns."""
            
            stats_frame.text = stats_text
            stats_frame.paragraphs[0].font.size = Pt(12)
            
            # Step 6: Add priority indicators for high-priority charts
            if chart.get('latter_half_outliers', 0) > 0:
                # Add visual priority indicator for charts requiring immediate attention
                priority_box = slide.shapes.add_textbox(Inches(8.5), Inches(0.2), Inches(1), Inches(0.5))
                priority_frame = priority_box.text_frame
                priority_frame.text = "⚠️ HIGH PRIORITY"
                priority_frame.paragraphs[0].font.size = Pt(10)
                priority_frame.paragraphs[0].font.bold = True
        
        # Step 7: Save presentation to temporary directory
        os.makedirs('temp_exports', exist_ok=True)
        ppt_filename = f"DART_Report_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pptx"
        ppt_path = os.path.join('temp_exports', ppt_filename)
        prs.save(ppt_path)
        
        print(f"PowerPoint presentation created: {ppt_filename}")
        return ppt_path, ppt_filename
        
    except Exception as e:
        print(f"Error creating PowerPoint: {e}")
        traceback.print_exc()
        return None, None

# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Handle file upload and data preprocessing.
    
    This endpoint processes CSV and Excel files, performs data quality analysis,
    and prepares the data for chart generation. It includes:
    - Automatic encoding detection for CSV files
    - Column type inference (numeric, date, categorical)
    - Data quality reporting
    - Session management for multi-chart workflows
    
    Expected Request:
        POST /api/upload
        Content-Type: multipart/form-data
        Body: file (CSV or Excel file)
        
    Returns:
        JSON response with:
        - session_id: Unique identifier for this data session
        - filename: Original filename
        - rows/columns: Data dimensions
        - columns_info: Detailed column analysis
        - filter_options: Available filter values for categorical columns
        - quality_report: Data quality metrics
        
    Error Codes:
        400: Bad request (no file, unsupported format, parsing error)
        500: Internal server error
    """
    try:
        # Step 1: Clean up old temporary files to maintain system performance
        cleanup_temp_files()
        
        # Step 2: Validate file upload request
        if 'file' not in request.files: 
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '': 
            return jsonify({'error': 'No file selected'}), 400
        
        # Step 3: Parse file based on extension
        filename = file.filename.lower()
        try:
            if filename.endswith('.csv'):
                # Advanced CSV parsing with encoding detection
                raw_data = file.read()
                file.seek(0)
                
                # Detect character encoding to handle international characters
                detected_encoding = chardet.detect(raw_data[:10000])['encoding'] or 'utf-8'
                
                try:
                    # Attempt to detect CSV dialect (delimiter, quoting, etc.)
                    dialect = csv.Sniffer().sniff(raw_data[:4096].decode(detected_encoding))
                    df = pd.read_csv(io.StringIO(raw_data.decode(detected_encoding)), 
                                   sep=dialect.delimiter, low_memory=False)
                except (csv.Error, UnicodeDecodeError):
                    # Fallback to standard CSV parsing
                    df = pd.read_csv(io.StringIO(raw_data.decode(detected_encoding)), 
                                   low_memory=False)
                    
            elif filename.endswith(('.xlsx', '.xls')):
                # Excel file parsing
                df = pd.read_excel(file, engine='openpyxl')
            else:
                return jsonify({'error': 'Unsupported file type. Please use CSV or Excel.'}), 400
                
        except Exception as e:
            return jsonify({'error': f"Failed to parse file. Details: {str(e)}"}), 400
        
        # Step 4: Validate data content
        if df.empty: 
            return jsonify({'error': 'File is empty or could not be read.'}), 400
        
        # Step 5: Data quality analysis and cleaning
        initial_rows = len(df)
        df.dropna(how='all', inplace=True)  # Remove completely empty rows
        rows_dropped = initial_rows - len(df)
        
        # Step 6: Column analysis and type inference
        columns_info, filter_options = [], {}
        sample_df = df.head(100).copy()  # Use sample for performance on large files
        
        for col in df.columns:
            dtype = df[col].dtype
            
            # Determine if column is numeric
            is_numeric = pd.api.types.is_numeric_dtype(dtype)
            
            # Determine if column contains date-like data
            is_date_like = (pd.api.types.is_datetime64_any_dtype(dtype) or 
                           (pd.to_datetime(sample_df[col], errors='coerce').notna().sum() / len(sample_df) > 0.5 
                            if len(sample_df) > 0 else False))
            
            # Create filter options for categorical columns (reasonable number of unique values)
            if (not is_numeric and not is_date_like and 
                df[col].nunique() < 50 and df[col].nunique() > 1):
                filter_options[col] = sorted(df[col].dropna().unique().tolist())
            
            # Store column metadata
            columns_info.append({
                'name': col, 
                'type': str(dtype), 
                'is_numeric': is_numeric, 
                'is_date_like': is_date_like
            })
        
        # Step 7: Create session and store data
        session_id = re.sub(r'\W+', '', str(datetime.now().timestamp()))  # Clean session ID
        os.makedirs('temp_data', exist_ok=True)
        df.to_pickle(os.path.join('temp_data', f'{session_id}.pkl'))  # Efficient binary storage
        
        # Step 8: Prepare response data
        response_data = {
            'session_id': session_id, 
            'filename': file.filename, 
            'rows': len(df), 
            'columns': len(df.columns),
            'columns_info': columns_info, 
            'filter_options': filter_options,
            'quality_report': {'empty_rows_dropped': rows_dropped}
        }
        
        # Convert NumPy types to ensure JSON serialization compatibility
        return jsonify(convert_numpy_types(response_data))
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

@app.route('/api/generate_chart', methods=['POST'])
def generate_chart_api():
    """
    Generate MSD control charts based on user specifications.
    
    This endpoint is the core of the analytics functionality. It takes user
    parameters and generates statistical control charts with outlier detection.
    
    Expected Request:
        POST /api/generate_chart
        Content-Type: application/json
        Body: {
            "session_id": "unique_session_identifier",
            "value_column": "column_name_with_numeric_data",
            "date_column": "column_name_with_date_data", 
            "cut_columns": ["optional_grouping_columns"],
            "filters": {"column": ["filter_values"]},
            "aggregation_period": "W|D|M|Y",
            "rolling_window": 7,
            "std_dev": 2.0
        }
        
    Returns:
        JSON response with:
        - success: Boolean indicating success
        - charts: Array of chart objects with images and statistics
        - message: Status message with processing details
        
    Error Codes:
        400: Bad request (missing parameters, invalid data)
        404: Session not found (expired or invalid)
        500: Internal server error
    """
    try:
        # Step 1: Parse and validate request data
        data = request.get_json()
        session_id = re.sub(r'\W+', '', data.get('session_id', ''))  # Sanitize session ID
        value_col, date_col = data.get('value_column'), data.get('date_column')
        
        # Validate required parameters
        if not all([session_id, value_col, date_col]): 
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Step 2: Parse and validate numeric parameters
        try:
            rolling_window = int(data.get('rolling_window', 7))
            std_dev = float(data.get('std_dev', 2))
        except (ValueError, TypeError):
            return jsonify({'error': 'Rolling window and std dev must be numbers.'}), 400
        
        # Step 3: Load session data
        df_path = os.path.join('temp_data', f'{session_id}.pkl')
        if not os.path.exists(df_path): 
            return jsonify({'error': 'Session expired or invalid.'}), 404
        
        df = pd.read_pickle(df_path)
        
        # Step 4: Generate control charts
        checker = CheckColumns(df)
        charts_data, report = checker.create_control_chart(
            value_col=value_col, 
            date_col=date_col, 
            cut_cols=data.get('cut_columns'), 
            filters=data.get('filters'),
            aggregation_period=data.get('aggregation_period', 'W'), 
            rolling_window=rolling_window, 
            std_dev=std_dev
        )
        
        # Step 5: Validate chart generation results
        if not charts_data: 
            return jsonify({'error': f"No valid data to generate charts. {report.get('status', '')}"}), 400
        
        # Step 6: Store charts for PowerPoint export
        # Keep full chart data (including image buffers) for PPT generation
        if session_id not in session_charts_storage:
            session_charts_storage[session_id] = []
        session_charts_storage[session_id].extend(charts_data)
        
        # Step 7: Prepare JSON response (remove binary data)
        # Remove image buffers from JSON response to avoid serialization issues
        charts_for_json = []
        for chart in charts_data:
            chart_copy = chart.copy()
            if '_image_buffer' in chart_copy:
                del chart_copy['_image_buffer']  # Remove binary data for JSON
            charts_for_json.append(chart_copy)
        
        # Step 8: Return successful response
        return jsonify({
            'success': True, 
            'charts': convert_numpy_types(charts_for_json), 
            'message': f"Generated {len(charts_data)} chart(s). {report.get('status', '')}"
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Error generating chart: {str(e)}'}), 500

@app.route('/api/export_ppt/<session_id>', methods=['GET'])
def export_powerpoint(session_id):
    """
    Export all charts from a session to a PowerPoint presentation.
    
    This endpoint creates a professional business report containing all charts
    generated in the current session, automatically ordered by priority
    (charts with recent anomalies first).
    
    Expected Request:
        GET /api/export_ppt/{session_id}
        
    Returns:
        PowerPoint file download or JSON error response
        
    Error Codes:
        404: No charts found for session
        500: PowerPoint generation failed
    """
    try:
        session_id = re.sub(r'\W+', '', session_id)  # Sanitize session ID
        
        # Step 1: Validate session has charts
        if session_id not in session_charts_storage or not session_charts_storage[session_id]:
            return jsonify({'error': 'No charts found for this session. Generate some charts first.'}), 404
        
        charts_data = session_charts_storage[session_id]
        
        # Step 2: Generate PowerPoint presentation
        ppt_path, ppt_filename = create_powerpoint_export(charts_data, session_id)
        
        # Step 3: Validate file creation
        if not ppt_path or not os.path.exists(ppt_path):
            return jsonify({'error': 'Failed to create PowerPoint presentation'}), 500
        
        # Step 4: Send file to client
        return send_file(
            ppt_path,
            as_attachment=True,
            download_name=ppt_filename,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Error exporting PowerPoint: {str(e)}'}), 500

@app.route('/api/clear_session/<session_id>', methods=['DELETE'])
def clear_session_charts(session_id):
    """
    Clear stored charts for a specific session.
    
    This endpoint removes all chart data associated with a session to free
    memory and allow users to start fresh analyses.
    
    Expected Request:
        DELETE /api/clear_session/{session_id}
        
    Returns:
        JSON response confirming session clearance
    """
    try:
        session_id = re.sub(r'\W+', '', session_id)  # Sanitize session ID
        
        # Remove session data if it exists
        if session_id in session_charts_storage:
            del session_charts_storage[session_id]
            
        return jsonify({'success': True, 'message': 'Session charts cleared'})
    except Exception as e:
        return jsonify({'error': f'Error clearing session: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check(): 
    """
    Health check endpoint for monitoring server status.
    
    Returns:
        JSON response indicating server is operational
    """
    return jsonify({'status': 'healthy'})

@app.route('/')
def serve_frontend(): 
    """
    Serve the main frontend HTML file.
    
    Returns:
        HTML file for the web application interface
    """
    return send_from_directory('.', 'index.html')

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

if __name__ == '__main__':
    """
    Start the Flask development server.
    
    This creates necessary directories and starts the server in debug mode
    for development. In production, use a proper WSGI server like Gunicorn.
    """
    # Ensure temporary data directory exists
    os.makedirs('temp_data', exist_ok=True)
    
    # Start development server
    # Note: For production deployment, use a proper WSGI server
    app.run(debug=True, host='0.0.0.0', port=5000)