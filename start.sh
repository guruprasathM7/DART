#!/bin/bash
# DART Analytics Quick Start Script
# Automates the setup and launch process

set -e  # Exit on error

echo "🚀 DART Analytics Quick Start"
echo "=============================="
echo ""

# Check Python version
echo "📋 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✅ Found Python $python_version"
echo ""

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv .venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi
echo ""

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source .venv/bin/activate
echo "✅ Virtual environment activated"
echo ""

# Install/upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo "✅ pip upgraded"
echo ""

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
echo "✅ Dependencies installed"
echo ""

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p temp_data temp_exports
echo "✅ Directories created"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env from template..."
    cp .env.example .env
    echo "✅ .env file created (please configure if needed)"
else
    echo "✅ .env file already exists"
fi
echo ""

# Run tests (optional)
read -p "🧪 Run tests before starting? (y/N): " run_tests
if [[ $run_tests == "y" || $run_tests == "Y" ]]; then
    echo "🧪 Running tests..."
    python test_suite.py
    echo "✅ Tests passed"
    echo ""
fi

# Start the application
echo "🎉 Setup complete!"
echo ""
echo "Starting DART Analytics..."
echo "=========================="
echo ""
echo "📊 Dashboard will be available at: http://localhost:5000"
echo "📚 API Documentation: http://localhost:5000/api/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the Flask application
python backend.py
