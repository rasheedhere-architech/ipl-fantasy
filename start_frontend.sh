#!/bin/bash

# Navigate to the frontend directory
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Node modules not found. Installing dependencies..."
  npm install
fi

# Run the development server
echo "Starting Vite development server..."
npm run dev
