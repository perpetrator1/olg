#!/bin/bash
# Setup and run script for the OLG Grid Django backend

cd "$(dirname "$0")"

echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting Django server on port 8000..."
python3 manage.py runserver 0.0.0.0:8000
