#!/bin/bash

# Function to clean up background processes on exit
cleanup() {
    echo "Stopping containers and frontend..."
    docker-compose down
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting backend with Docker Compose..."
docker-compose up -d --build

echo "Starting frontend development server..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Node modules not found. Installing dependencies..."
    npm install
fi

# Run the development server in the background
npm run dev &
FRONTEND_PID=$!

echo "Frontend is running (PID: $FRONTEND_PID)"
echo "Backend is running at http://localhost:8000"
echo "Press Ctrl+C to stop both."

# Wait for background processes
wait $FRONTEND_PID
