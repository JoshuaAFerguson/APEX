#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# URLs to monitor
API_URL="http://localhost:4000/"
WEB_UI_URL="http://localhost:4001/"

# Daemon command
DAEMON_CMD="/Users/s0v3r1gn/APEX/packages/cli/dist/index.js daemon"

# Function to check URL status
check_url() {
  local url=$1
  local status_code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [[ $? -ne 0 || $status_code -lt 200 || $status_code -ge 400 ]]; then
    echo "Error: URL $url is down or returning status $status_code."
    return 1
  else
    echo "Success: URL $url is up (status $status_code)."
    return 0
  fi
}

# Main monitoring loop
while true; do
  if ! check_url "$API_URL" || ! check_url "$WEB_UI_URL"; then
    echo "One or more services are down. Starting recovery process..."

    echo "1. Stopping the daemon..."
    $DAEMON_CMD stop

    echo "2. Attempting to triage and fix with Claude..."
    # This is a placeholder for the actual command.
    # You might need to pipe logs or provide more context to the AI.
    claude --dangerously-bypass-permissions "The APEX services are down. Please analyze the build and runtime logs to identify and fix the issue."

    echo "3. Cleaning the build cache..."
    npm run clean

    echo "4. Rebuilding the project..."
    npm run build

    echo "5. Restarting the daemon..."
    $DAEMON_CMD start

    echo "Recovery process finished. Waiting before next check."
    sleep 60 # Wait longer after a restart
  else
    echo "All services are running correctly."
  fi

  echo "Waiting for 30 seconds before the next check..."
  sleep 30
done
