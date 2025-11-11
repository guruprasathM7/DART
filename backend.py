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
- Generates Excel file with outlier cells highlighted.
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

# Excel styling library
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

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
        return bool(obj)
    if isinstance(obj, np.ndarray): 
        return obj.tolist()
    if isinstance(obj, dict): 
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    if isinstance(obj, list): 
        return [convert_numpy_types(item) for item in obj]
    return obj

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
        if not isinstance(data_df, pd.DataFrame):
            raise ValueError("Input data must be a pandas DataFrame.")
        self.df = data_df.copy()
        self.session_charts = []

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
        
        clean_df[value_col] = pd.to_numeric(clean_df[value_col], errors='coerce')
        clean_df[date_col] = pd.to_datetime(clean_df[date_col], errors='coerce')
        clean_df.dropna(subset=[date_col, value_col], inplace=True)
        
        rows_dropped = initial_rows - len(clean_df)
        if clean_df.empty: 
            return [], {"status": f"{rows_dropped} rows dropped; no data remains."}

        charts_data = []
        
        # Step 3: Handle data grouping (cut columns)
        if cut_cols and len(cut_cols) > 0:
            valid_cut_cols = []
            for col in cut_cols:
                if col in clean_df.columns and clean_df[col].nunique() > 1:
                    valid_cut_cols.append(col)
            
            if valid_cut_cols:
                grouped_by_cuts = clean_df.groupby(valid_cut_cols)
                
                for group_key, group_df in grouped_by_cuts:
                    if len(group_df) < 2:
                        continue
                    
                    chart_data = self._process_group(group_df, value_col, date_col, group_key, valid_cut_cols, aggregation_period, rolling_window, std_dev)
                    if chart_data:
                        charts_data.append(chart_data)
            else:
                chart_data = self._process_group(clean_df, value_col, date_col, None, [], aggregation_period, rolling_window, std_dev)
                if chart_data:
                    charts_data.append(chart_data)
        else:
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
            # Store original indices for Excel highlighting
            original_indices = group_df.index.tolist()
            
            # Aggregate data by time period
            group_df_resampled = group_df.set_index(date_col)[[value_col]].resample(aggregation_period).mean().dropna().reset_index()
            if len(group_df_resampled) < 2:
                return None

            resampled_df = group_df_resampled.copy()
            
            # Calculate sigma estimate
            non_zero_values = resampled_df[value_col].replace(0, np.nan)
            sigma_estimate = np.nan
            if len(non_zero_values.dropna()) > 1:
                moving_ranges = non_zero_values.dropna().diff().abs()
                sigma_estimate = (moving_ranges.mean() / 1.128) if len(moving_ranges.dropna()) > 1 else non_zero_values.std(ddof=1)
            
            if pd.isna(sigma_estimate) or sigma_estimate == 0: 
                return None

            # Calculate control parameters
            rolling_mean = non_zero_values.rolling(window=rolling_window, min_periods=1).mean()
            resampled_df['rolling_mean'] = rolling_mean.interpolate(method='linear', limit_direction='both')
            resampled_df['upper_bound'] = resampled_df['rolling_mean'] + (std_dev * sigma_estimate)
            resampled_df['lower_bound'] = (resampled_df['rolling_mean'] - (std_dev * sigma_estimate)).clip(lower=0)
            
            # Enhanced outlier detection
            resampled_df['high_outlier'] = resampled_df.apply(
                lambda r: r[value_col] if r[value_col] > r['upper_bound'] and r[value_col] != 0 else np.nan,
                axis=1
            )
            resampled_df['low_outlier'] = resampled_df.apply(
                lambda r: r[value_col] if r[value_col] < r['lower_bound'] and r[value_col] != 0 else np.nan,
                axis=1
            )
            
            # Extreme outliers
            resampled_df['extreme_high_outlier'] = resampled_df.apply(
                lambda r: r[value_col] if (r[value_col] > r['rolling_mean'] + (5 * (r['upper_bound'] - r['rolling_mean']))) else np.nan,
                axis=1
            )
            resampled_df['extreme_low_outlier'] = resampled_df.apply(
                lambda r: r[value_col] if (r[value_col] < r['rolling_mean'] - (5 * (r['rolling_mean'] - r['lower_bound'])) 
                                         and r[value_col] != 0) else np.nan,
                axis=1
            )
            
            # Combined outliers
            resampled_df['outlier'] = resampled_df.apply(
                lambda r: r[value_col] if pd.notna(r['high_outlier']) or pd.notna(r['low_outlier']) else np.nan,
                axis=1
            )
            
            # Zero values
            resampled_df['zero_value'] = resampled_df.apply(
                lambda r: r[value_col] if r[value_col] == 0 else np.nan,
                axis=1
            )
            
            # Generate chart
            chart_data = self.generate_plot(resampled_df.copy(), value_col, date_col, group_key, cut_cols, rolling_window, std_dev, aggregation_period)
            
            # Add outlier mapping information and aggregation period
            if chart_data:
                chart_data['resampled_data'] = resampled_df.to_dict('records')
                chart_data['aggregation_period'] = aggregation_period
            
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
        
        plt.style.use('seaborn-v0_8-whitegrid')
        fig, ax = plt.subplots(figsize=(15, 7))
        ax.clear()
        
        # Calculate dynamic y-axis limits
        all_values = pd.concat([
            plot_df[value_col],
            plot_df['upper_bound'],
            plot_df['lower_bound'].replace(0, np.nan)
        ]).dropna()
        
        if len(all_values) > 0:
            y_min = all_values.min()
            y_max = all_values.max()
            y_range = y_max - y_min
            y_padding = y_range * 0.1
            y_min = max(0, y_min - y_padding)
            y_max = y_max + y_padding
            ax.set_ylim(y_min, y_max)
        
        # Plot data
        ax.plot(plot_df[date_col], plot_df[value_col], 
               marker='o', linestyle='-', color='blue', 
               label='Actual', markersize=4)
        
        ax.plot(plot_df[date_col], plot_df['rolling_mean'], 
               color='green', linestyle='-', linewidth=2, 
               label=f'{rolling_window}-period Rolling Mean')
        
        ax.plot(plot_df[date_col], plot_df['upper_bound'], 
               color='red', linestyle='--', linewidth=1, 
               label=f'±{std_dev}σ Control Limit')
        ax.plot(plot_df[date_col], plot_df['lower_bound'], 
               color='red', linestyle='--', linewidth=1)
        
        ax.fill_between(plot_df[date_col], plot_df['lower_bound'], plot_df['upper_bound'], 
                       color='gray', alpha=0.15, label='Control Zone')
        
        # Highlight outliers
        high_outliers_mask = plot_df['high_outlier'].notna()
        low_outliers_mask = plot_df['low_outlier'].notna()
        extreme_high_mask = plot_df['extreme_high_outlier'].notna()
        extreme_low_mask = plot_df['extreme_low_outlier'].notna()
        zero_mask = plot_df['zero_value'].notna()
        
        regular_outliers_mask = ((high_outliers_mask | low_outliers_mask) & 
                               ~(extreme_high_mask | extreme_low_mask))
        if regular_outliers_mask.any():
            regular_values = plot_df.loc[regular_outliers_mask, 'outlier']
            ax.scatter(plot_df.loc[regular_outliers_mask, date_col],
                      regular_values,
                      color='yellow', s=80, zorder=5, alpha=0.6,
                      label=f'Regular Outliers ({regular_outliers_mask.sum()})')
        
        if extreme_high_mask.any():
            ax.scatter(plot_df.loc[extreme_high_mask, date_col],
                      plot_df.loc[extreme_high_mask, 'extreme_high_outlier'],
                      color='darkred', s=200, marker='*', zorder=7, 
                      edgecolors='red', linewidth=1,
                      label=f'Severe High Outliers ({extreme_high_mask.sum()})')
            
        if extreme_low_mask.any():
            ax.scatter(plot_df.loc[extreme_low_mask, date_col],
                      plot_df.loc[extreme_low_mask, 'extreme_low_outlier'],
                      color='indigo', s=200, marker='*', zorder=7,
                      edgecolors='purple', linewidth=1,
                      label=f'Severe Low Outliers ({extreme_low_mask.sum()})')
        
        if zero_mask.any():
            ax.scatter(plot_df.loc[zero_mask, date_col],
                      plot_df.loc[zero_mask, 'zero_value'],
                      color='orange', s=50, zorder=5,
                      label=f'Zero Values ({zero_mask.sum()})')
        
        # Create title
        title_add, group_name = "", "All Data"
        if cut_cols and group_key is not None:
            if isinstance(group_key, tuple):
                group_details = list(zip(cut_cols, group_key))
            else:
                group_details = [(cut_cols[0], group_key)]
            title_add = " - " + ", ".join(f"{col}={val}" for col, val in group_details)
            group_name = title_add.replace(" - ", "")
        
        agg_map = {'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly', 'Y': 'Yearly'}
        
        ax.set_title(f"MSD Control Chart for {value_col}{title_add}\n"
                    f"({agg_map.get(aggregation_period, '')} Aggregation, "
                    f"{rolling_window}-period rolling window)", 
                    fontsize=14, weight='bold')
        
        ax.set_xlabel(f'Time ({agg_map.get(aggregation_period, "")})', fontsize=12)
        ax.set_ylabel(value_col, fontsize=12)
        
        plt.xticks(rotation=30, ha="right")
        plt.tight_layout()
        ax.legend(loc='best')
        
        # Save chart
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        
        plt.close(fig)
        plt.clf()
        plt.cla()
        
        # Calculate statistics
        total_points = len(plot_df)
        half_point = max(1, total_points // 2)
        
        total_outliers = int((high_outliers_mask | low_outliers_mask).sum())
        total_extreme_outliers = int((extreme_high_mask | extreme_low_mask).sum())
        recent_outliers = int((high_outliers_mask | low_outliers_mask).iloc[half_point:].sum())
        recent_extreme_outliers = int((extreme_high_mask | extreme_low_mask).iloc[half_point:].sum())
        
        y_min, y_max = ax.get_ylim()
        off_scale_high = int(sum(plot_df[value_col] > y_max))
        off_scale_low = int(sum((plot_df[value_col] < y_min) & (plot_df[value_col] != 0)))
        
        all_outliers = {
            'total': total_outliers,
            'high': int(high_outliers_mask.sum()),
            'low': int(low_outliers_mask.sum()),
            'extreme_high': int(extreme_high_mask.sum()),
            'extreme_low': int(extreme_low_mask.sum()),
            'recent_total': recent_outliers,
            'recent_extreme': recent_extreme_outliers,
            'max_value': float(plot_df[value_col].max()),
            'min_value': float(plot_df[value_col].min()),
            'visible_range': {
                'min': float(y_min),
                'max': float(y_max)
            },
            'off_scale': {
                'high': off_scale_high,
                'low': off_scale_low,
                'total': off_scale_high + off_scale_low
            }
        }
        
        def safe_float(val):
            try:
                f = float(val)
                if pd.isna(f):
                    return None
                return f
            except Exception:
                return None

        chart_data = {
            'image': base64.b64encode(img_buffer.getvalue()).decode(),
            'title': f"Chart for {value_col}{title_add}", 
            'group': group_name, 
            'data_points': total_points,
            'outlier_stats': all_outliers,
            'outliers': total_outliers,
            'latter_half_outliers': recent_outliers,
            'zero_values': int(zero_mask.sum()),
            'statistics': {
                'mean': safe_float(plot_df[value_col].mean()),
                'std': safe_float(plot_df[value_col].std()),
                'min': safe_float(plot_df[value_col].min()),
                'max': safe_float(plot_df[value_col].max()),
                'control_limits': {
                    'upper': safe_float(plot_df['upper_bound'].mean()),
                    'lower': safe_float(plot_df['lower_bound'].replace(0, np.nan).mean())
                }
            }
        }

        chart_data['_image_buffer'] = img_buffer.getvalue()

        return chart_data

# ============================================================================
# GLOBAL SESSION MANAGEMENT
# ============================================================================

session_charts_storage = {}

def cleanup_temp_files(max_age_hours=1):
    """Clean up temporary files older than specified age."""
    temp_dir = 'temp_data'
    if not os.path.isdir(temp_dir): 
        return
    
    current_time = datetime.now()
    
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        try:
            if os.path.isfile(file_path):
                file_age = current_time - datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_age > timedelta(hours=max_age_hours):
                    os.remove(file_path)
                    print(f"Cleaned up old temp file: {filename}")
        except Exception as e: 
            print(f"Error cleaning up file {filename}: {e}")

def highlight_outliers_excel(df, value_col, date_col, charts_data, session_id, filters=None):
    """
    Generate Excel file with outlier cells highlighted in yellow.
    
    Args:
        df: Original DataFrame
        value_col: Column with values to analyze
        date_col: Column with dates
        charts_data: List of chart dictionaries with outlier information
        session_id: Session identifier for output file
        filters: Applied filters (optional)
    
    Returns:
        str: Path to generated Excel file
    """
    try:
        print(f"Starting Excel generation for session {session_id}")
        
        # Create copy of original data
        df_export = df.copy()
        
        # Apply same filters that were used for charts
        if filters:
            for col, values in filters.items():
                if col in df_export.columns and values:
                    df_export = df_export[df_export[col].isin(values)]
        
        # Convert columns for analysis
        df_export[date_col] = pd.to_datetime(df_export[date_col], errors='coerce')
        df_export[value_col] = pd.to_numeric(df_export[value_col], errors='coerce')
        
        # Collect ALL outlier information from charts with proper aggregation period mapping
        all_outlier_indices = set()
        
        for chart in charts_data:
            if 'resampled_data' in chart:
                resampled_df = pd.DataFrame(chart['resampled_data'])
                
                # Get outlier rows from resampled data
                outlier_rows = resampled_df[resampled_df['outlier'].notna()]
                
                print(f"Chart '{chart.get('title', 'Unknown')}' has {len(outlier_rows)} outlier periods")
                
                for _, outlier_row in outlier_rows.iterrows():
                    outlier_date = pd.to_datetime(outlier_row[date_col])
                    outlier_value = float(outlier_row[value_col])
                    
                    # For each outlier in the aggregated data, find ALL original rows
                    # that contributed to that aggregated period
                    
                    # Determine the aggregation period window
                    # Weekly aggregation (W) means we need to find all rows in that week
                    aggregation_period = chart.get('aggregation_period', 'W')
                    
                    if aggregation_period == 'W':
                        # Weekly - find all rows in the same week
                        week_start = outlier_date - pd.Timedelta(days=outlier_date.dayofweek)
                        week_end = week_start + pd.Timedelta(days=6)
                        
                        matching_indices = df_export[
                            (df_export[date_col] >= week_start) &
                            (df_export[date_col] <= week_end)
                        ].index.tolist()
                        
                    elif aggregation_period == 'D':
                        # Daily - find rows on the same day
                        matching_indices = df_export[
                            df_export[date_col].dt.date == outlier_date.date()
                        ].index.tolist()
                        
                    elif aggregation_period == 'M':
                        # Monthly - find all rows in the same month
                        matching_indices = df_export[
                            (df_export[date_col].dt.year == outlier_date.year) &
                            (df_export[date_col].dt.month == outlier_date.month)
                        ].index.tolist()
                        
                    elif aggregation_period == 'Y':
                        # Yearly - find all rows in the same year
                        matching_indices = df_export[
                            df_export[date_col].dt.year == outlier_date.year
                        ].index.tolist()
                    else:
                        # Fallback to a wider time window
                        matching_indices = df_export[
                            (df_export[date_col] >= outlier_date - pd.Timedelta(days=7)) &
                            (df_export[date_col] <= outlier_date + pd.Timedelta(days=7))
                        ].index.tolist()
                    
                    all_outlier_indices.update(matching_indices)
                    print(f"  Outlier period {outlier_date.date()} matched {len(matching_indices)} original rows")
        
        print(f"Total outlier data points: {len(outlier_rows) if 'outlier_rows' in locals() else 'N/A'}")
        print(f"Total original rows to highlight: {len(all_outlier_indices)}")
        
        # Create output directory
        os.makedirs('temp_exports', exist_ok=True)
        output_path = os.path.join('temp_exports', f'outliers_{session_id}.xlsx')
        
        # Write DataFrame to Excel
        df_export.to_excel(output_path, index=False, engine='openpyxl')
        
        # Load workbook for styling
        wb = openpyxl.load_workbook(output_path)
        ws = wb.active
        
        # Define styles
        yellow_fill = PatternFill(start_color='FFFF00', end_color='FFFF00', fill_type='solid')
        header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        header_font = Font(bold=True, color='FFFFFF', size=11)
        border = Border(
            left=Side(style='thin', color='000000'),
            right=Side(style='thin', color='000000'),
            top=Side(style='thin', color='000000'),
            bottom=Side(style='thin', color='000000')
        )
        
        # Style header row
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Highlight ALL outlier rows
        for idx in all_outlier_indices:
            excel_row = idx + 2  # +2 because Excel is 1-indexed and has header row
            
            # Highlight the entire row
            for col in range(1, ws.max_column + 1):
                cell = ws.cell(row=excel_row, column=col)
                cell.fill = yellow_fill
                cell.border = border
        
        print(f"Highlighted {len(all_outlier_indices)} rows in Excel")
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            
            for cell in column:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Freeze header row
        ws.freeze_panes = 'A2'
        
        # Count total outlier periods across all charts
        total_outlier_periods = 0
        for chart in charts_data:
            if 'resampled_data' in chart:
                resampled_df = pd.DataFrame(chart['resampled_data'])
                outlier_count = resampled_df['outlier'].notna().sum()
                total_outlier_periods += outlier_count
        
        # Add a summary sheet
        summary_ws = wb.create_sheet('Outlier Summary', 0)
        summary_ws['A1'] = 'Outlier Detection Summary'
        summary_ws['A1'].font = Font(bold=True, size=14)
        
        summary_ws['A3'] = 'Total Outlier Periods Found:'
        summary_ws['B3'] = total_outlier_periods
        summary_ws['A4'] = 'Rows Highlighted:'
        summary_ws['B4'] = len(all_outlier_indices)
        summary_ws['A5'] = 'Generation Date:'
        summary_ws['B5'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        summary_ws['A7'] = 'Note: Outlier cells are highlighted in yellow on the Data sheet.'
        summary_ws['A8'] = 'Each outlier period (from aggregated data) may include multiple original data rows.'
        summary_ws['A7'].font = Font(italic=True)
        summary_ws['A8'].font = Font(italic=True, size=9)
        
        # Save workbook
        wb.save(output_path)
        print(f"Excel file saved successfully: {output_path}")
        
        return output_path
        
    except Exception as e:
        print(f"Error creating Excel with highlighted outliers: {e}")
        traceback.print_exc()
        return None

def create_powerpoint_export(charts_data, session_id):
    """Create a professional PowerPoint presentation from generated charts."""
    try:
        sorted_charts = sorted(charts_data, 
                             key=lambda x: x.get('latter_half_outliers', 0), 
                             reverse=True)
        
        prs = Presentation()
        prs.slide_width = Inches(13.33)
        prs.slide_height = Inches(7.5)

        TITLE_FONT = 'Segoe UI'
        BODY_FONT = 'Segoe UI'
        BLUE = RGBColor(0, 102, 204)
        GRAY_BLUE_BG = RGBColor(240, 244, 248)
        DARK_TEXT = RGBColor(40, 40, 40)
        ACCENT = RGBColor(20, 80, 140)

        def style_textframe(frame, font_size=Pt(14), bold=False, color=DARK_TEXT):
            for p in frame.paragraphs:
                for run in p.runs:
                    run.font.name = BODY_FONT
                    run.font.size = font_size
                    run.font.bold = bold
                    run.font.color.rgb = color

        # Title Slide
        title_slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(title_slide_layout)
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = GRAY_BLUE_BG

        title_box = slide.shapes.add_textbox(Inches(2.5), Inches(2.5), Inches(8), Inches(1.2))
        title_frame = title_box.text_frame
        title_frame.text = "DART Analytics Report"
        style_textframe(title_frame, Pt(40), True, ACCENT)

        subtitle_box = slide.shapes.add_textbox(Inches(2.5), Inches(3.5), Inches(8), Inches(1))
        subtitle_frame = subtitle_box.text_frame
        subtitle_frame.text = (f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n"
                               f"Total Charts: {len(sorted_charts)}")
        style_textframe(subtitle_frame, Pt(18), False, DARK_TEXT)

        # Executive Summary
        layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(layout)
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = GRAY_BLUE_BG

        title_box = slide.shapes.add_textbox(Inches(0.7), Inches(0.5), Inches(8), Inches(1))
        title_frame = title_box.text_frame
        title_frame.text = "Executive Summary"
        style_textframe(title_frame, Pt(32), True, ACCENT)

        charts_with_recent_anomalies = len([c for c in sorted_charts if c.get('latter_half_outliers', 0) > 0])
        total_anomalies = sum(c.get('outliers', 0) for c in sorted_charts)
        recent_anomalies = sum(c.get('latter_half_outliers', 0) for c in sorted_charts)

        content_box = slide.shapes.add_textbox(Inches(0.9), Inches(1.8), Inches(10.5), Inches(4))
        content_frame = content_box.text_frame
        content_frame.text = (
            f"Key Findings:\n\n"
            f"• Total Charts Analyzed: {len(sorted_charts)}\n"
            f"• Charts with Recent Anomalies: {charts_with_recent_anomalies}\n"
            f"• Total Anomalies Detected: {total_anomalies}\n"
            f"• Recent Anomalies (Last Half): {recent_anomalies}\n\n"
            f"Charts are ordered by recent anomaly count (highest first) for priority review."
        )
        style_textframe(content_frame, Pt(20), False, DARK_TEXT)

        # Individual Chart Slides
        for i, chart in enumerate(sorted_charts, 1):
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = RGBColor(255, 255, 255)

            title_box = slide.shapes.add_textbox(Inches(0.7), Inches(0.3), Inches(9), Inches(0.8))
            title_frame = title_box.text_frame
            title_frame.text = f"{i}. {chart.get('title', 'Chart')}"
            style_textframe(title_frame, Pt(26), True, ACCENT)

            if '_image_buffer' in chart:
                img_stream = io.BytesIO(chart['_image_buffer'])
                slide.shapes.add_picture(img_stream, Inches(0.8), Inches(1.3), Inches(11.8), Inches(4.8))

            stats_box = slide.shapes.add_textbox(Inches(0.8), Inches(6.2), Inches(11.8), Inches(1.2))
            stats_frame = stats_box.text_frame

            zero_pct = (chart.get('zero_values', 0) / chart.get('data_points', 1)) * 100 if chart.get('data_points', 0) > 0 else 0
            stats_text = (
                f"Statistics:\n"
                f"Data Points: {chart.get('data_points', 'N/A')} | "
                f"Total Outliers: {chart.get('outliers', 0)} | "
                f"Recent Outliers: {chart.get('latter_half_outliers', 0)} | "
                f"Zero Values: {chart.get('zero_values', 0)} ({zero_pct:.1f}%)\n"
                f"Mean: {chart.get('statistics', {}).get('mean', 0):.3f} | "
                f"Std Dev: {chart.get('statistics', {}).get('std', 0):.3f} | "
                f"Min: {chart.get('statistics', {}).get('min', 0):.3f} | "
                f"Max: {chart.get('statistics', {}).get('max', 0):.3f}\n\n"
                f"Note: Charts are prioritized by recent anomaly count."
            )
            stats_frame.text = stats_text
            style_textframe(stats_frame, Pt(14), False, DARK_TEXT)

            if chart.get('latter_half_outliers', 0) > 0:
                shape = slide.shapes.add_shape(
                    autoshape_type_id=1,
                    left=Inches(10.8),
                    top=Inches(0.3),
                    width=Inches(2.3),
                    height=Inches(0.6)
                )
                fill = shape.fill
                fill.solid()
                fill.fore_color.rgb = ACCENT
                line = shape.line
                line.fill.background()

                text_frame = shape.text_frame
                text_frame.text = "High Priority Chart"
                style_textframe(text_frame, Pt(12), True, RGBColor(255, 255, 255))

        os.makedirs('temp_exports', exist_ok=True)
        ppt_filename = f"DART_Report_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pptx"
        ppt_path = os.path.join('temp_exports', ppt_filename)
        prs.save(ppt_path)

        print(f"PowerPoint report successfully created: {ppt_filename}")
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
        cleanup_temp_files()
        
        if 'file' not in request.files: 
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '': 
            return jsonify({'error': 'No file selected'}), 400
        
        filename = file.filename.lower()
        try:
            if filename.endswith('.csv'):
                raw_data = file.read()
                file.seek(0)
                
                detected_encoding = chardet.detect(raw_data[:10000])['encoding'] or 'utf-8'
                
                try:
                    dialect = csv.Sniffer().sniff(raw_data[:4096].decode(detected_encoding))
                    df = pd.read_csv(io.StringIO(raw_data.decode(detected_encoding)), 
                                   sep=dialect.delimiter, low_memory=False)
                except (csv.Error, UnicodeDecodeError):
                    df = pd.read_csv(io.StringIO(raw_data.decode(detected_encoding)), 
                                   low_memory=False)
                    
            elif filename.endswith(('.xlsx', '.xls')):
                sheet_name = request.form.get('sheet_name')
                
                excel_file = pd.ExcelFile(file, engine='openpyxl')
                sheet_names = excel_file.sheet_names
                
                if len(sheet_names) > 1 and not sheet_name:
                    return jsonify({
                        'multiple_sheets': True,
                        'sheet_names': sheet_names,
                        'message': 'Please select a sheet to analyze'
                    }), 200
                
                sheet_to_use = sheet_name if sheet_name else sheet_names[0]
                df = pd.read_excel(excel_file, sheet_name=sheet_to_use, engine='openpyxl')
            else:
                return jsonify({'error': 'Unsupported file type. Please use CSV or Excel.'}), 400
                
        except Exception as e:
            return jsonify({'error': f"Failed to parse file. Details: {str(e)}"}), 400
        
        if df.empty: 
            return jsonify({'error': 'File is empty or could not be read.'}), 400
        
        initial_rows = len(df)
        df.dropna(how='all', inplace=True)
        rows_dropped = initial_rows - len(df)
        
        columns_info, filter_options = [], {}
        sample_df = df.head(100).copy()
        
        for col in df.columns:
            dtype = df[col].dtype
            
            is_numeric = pd.api.types.is_numeric_dtype(dtype)
            
            is_date_like = (pd.api.types.is_datetime64_any_dtype(dtype) or 
                           (pd.to_datetime(sample_df[col], errors='coerce').notna().sum() / len(sample_df) > 0.5 
                            if len(sample_df) > 0 else False))
            
            if (not is_numeric and not is_date_like and 
                df[col].nunique() < 50 and df[col].nunique() > 1):
                filter_options[col] = sorted(df[col].dropna().unique().tolist())
            
            columns_info.append({
                'name': col, 
                'type': str(dtype), 
                'is_numeric': is_numeric, 
                'is_date_like': is_date_like
            })
        
        session_id = re.sub(r'\W+', '', str(datetime.now().timestamp()))
        os.makedirs('temp_data', exist_ok=True)
        df.to_pickle(os.path.join('temp_data', f'{session_id}.pkl'))
        
        response_data = {
            'session_id': session_id, 
            'filename': file.filename, 
            'rows': len(df), 
            'columns': len(df.columns),
            'columns_info': columns_info, 
            'filter_options': filter_options,
            'quality_report': {'empty_rows_dropped': rows_dropped}
        }
        
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
        data = request.get_json()
        session_id = re.sub(r'\W+', '', data.get('session_id', ''))
        value_col, date_col = data.get('value_column'), data.get('date_column')
        
        if not all([session_id, value_col, date_col]): 
            return jsonify({'error': 'Missing required parameters'}), 400
        
        try:
            rolling_window = int(data.get('rolling_window', 7))
            std_dev = float(data.get('std_dev', 2))
        except (ValueError, TypeError):
            return jsonify({'error': 'Rolling window and std dev must be numbers.'}), 400
        
        df_path = os.path.join('temp_data', f'{session_id}.pkl')
        if not os.path.exists(df_path): 
            return jsonify({'error': 'Session expired or invalid.'}), 404
        
        df = pd.read_pickle(df_path)
        
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
        
        if not charts_data: 
            return jsonify({'error': f"No valid data to generate charts. {report.get('status', '')}"}), 400
        
        # Store charts for PowerPoint export
        if session_id not in session_charts_storage:
            session_charts_storage[session_id] = []
        session_charts_storage[session_id].extend(charts_data)
        
        # Generate Excel file with highlighted outliers
        excel_path = None
        try:
            excel_path = highlight_outliers_excel(
                df, 
                value_col, 
                date_col, 
                charts_data, 
                session_id,
                filters=data.get('filters')
            )
            print(f"Excel file generated: {excel_path}")
        except Exception as e:
            print(f"Excel generation failed: {e}")
            traceback.print_exc()
        
        # Prepare JSON response
        charts_for_json = []
        for chart in charts_data:
            chart_copy = chart.copy()
            if '_image_buffer' in chart_copy:
                del chart_copy['_image_buffer']
            if 'resampled_data' in chart_copy:
                del chart_copy['resampled_data']
            if 'outlier_dates' in chart_copy:
                del chart_copy['outlier_dates']
            if 'outlier_values' in chart_copy:
                del chart_copy['outlier_values']
            charts_for_json.append(chart_copy)
        
        response_data = {
            'success': True, 
            'charts': convert_numpy_types(charts_for_json), 
            'message': f"Generated {len(charts_data)} chart(s). {report.get('status', '')}"
        }
        
        # Add Excel download info if generated successfully
        if excel_path and os.path.exists(excel_path):
            response_data['excel_file'] = f"outliers_{session_id}.xlsx"
            response_data['excel_ready'] = True
        
        return jsonify(response_data)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

@app.route('/api/download_excel/<session_id>', methods=['GET'])
def download_excel(session_id):
    """Download the Excel file with highlighted outliers."""
    try:
        session_id = re.sub(r'\W+', '', session_id)
        excel_filename = f'outliers_{session_id}.xlsx'  # Internal filename
        excel_path = os.path.join('temp_exports', excel_filename)
        
        if not os.path.exists(excel_path):
            return jsonify({'error': 'Excel file not found. Please generate charts first.'}), 404
        
        # Get custom filename from query parameters if provided
        custom_filename = request.args.get('filename', excel_filename)
        if not custom_filename.endswith('.xlsx'):
            custom_filename += '_outliers.xlsx'
        
        return send_file(
            excel_path,
            as_attachment=True,
            download_name=custom_filename,  # Use the custom filename for download
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Error downloading Excel: {str(e)}'}), 500

@app.route('/api/export_ppt/<session_id>', methods=['GET'])
def export_powerpoint(session_id):
    """Export all charts to PowerPoint."""
    try:
        session_id = re.sub(r'\W+', '', session_id)
        
        if session_id not in session_charts_storage or not session_charts_storage[session_id]:
            return jsonify({'error': 'No charts found for this session. Generate some charts first.'}), 404
        
        charts_data = session_charts_storage[session_id]
        
        ppt_path, ppt_filename = create_powerpoint_export(charts_data, session_id)
        
        if not ppt_path or not os.path.exists(ppt_path):
            return jsonify({'error': 'Failed to create PowerPoint presentation'}), 500
        
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
        session_id = re.sub(r'\W+', '', session_id)
        
        if session_id in session_charts_storage:
            del session_charts_storage[session_id]
            
        return jsonify({'success': True, 'message': 'Session charts cleared'})
    except Exception as e:
        return jsonify({'error': f'Error clearing session: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check(): 
    """Health check endpoint."""
    return jsonify({'status': 'healthy'})

@app.route('/')
def serve_frontend(): 
    """Serve the main frontend HTML file."""
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
    os.makedirs('temp_exports', exist_ok=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)