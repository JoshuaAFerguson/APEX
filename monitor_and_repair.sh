#!/bin/bash

# APEX Service Monitor and Recovery Script
# Monitors API and WebUI, attempts recovery on failure

# URLs to monitor
API_URL="http://localhost:4000/"
WEB_UI_URL="http://localhost:4001/"
LOG_FILE="./.apex/daemon.log"
LOG_LINES=50

# Daemon command
DAEMON_CMD="/Users/s0v3r1gn/APEX/packages/cli/dist/index.js daemon"

# Retry counters
restart_attempts=0
max_restart_attempts=3

# Function to log with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check URL status
# Returns 0 for success, 1 for failure
check_url() {
  local url=$1
  local name=$2

  # Use timeout and silent mode, capture HTTP code
  local http_code
  http_code=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  local curl_exit=$?

  if [[ $curl_exit -eq 0 && $http_code -ge 200 && $http_code -lt 400 ]]; then
    return 0
  else
    return 1
  fi
}

# Function to check service health
check_services() {
  local api_ok=false
  local webui_ok=false

  if check_url "$API_URL" "API"; then
    api_ok=true
  fi

  if check_url "$WEB_UI_URL" "WebUI"; then
    webui_ok=true
  fi

  if $api_ok && $webui_ok; then
    return 0  # All services healthy
  elif $api_ok; then
    return 2  # Only WebUI down
  elif $webui_ok; then
    return 3  # Only API down
  else
    return 1  # Both down
  fi
}

# Function to restart daemon
restart_daemon() {
  log "Stopping daemon..."
  $DAEMON_CMD stop 2>/dev/null || true
  sleep 3

  log "Starting daemon..."
  $DAEMON_CMD start
  sleep 10  # Wait for services to come up
}

# Function to perform full rebuild
full_rebuild() {
  log "Performing full rebuild..."

  log "1. Stopping daemon..."
  $DAEMON_CMD stop 2>/dev/null || true
  sleep 3

  log "2. Cleaning build artifacts..."
  npm run clean 2>/dev/null || true

  log "3. Installing dependencies..."
  npm install || {
    log "ERROR: npm install failed"
    return 1
  }

  log "4. Building project..."
  npm run build || {
    log "ERROR: npm run build failed"
    return 1
  }

  log "5. Starting daemon..."
  $DAEMON_CMD start
  sleep 10

  return 0
}

# Function to capture and display recent logs
show_recent_logs() {
  if [[ -f "$LOG_FILE" ]]; then
    log "Recent daemon logs:"
    echo "----------------------------------------"
    tail -n "$LOG_LINES" "$LOG_FILE"
    echo "----------------------------------------"
  fi
}

# Main monitoring loop
log "Starting APEX service monitor..."
log "Monitoring: API=$API_URL, WebUI=$WEB_UI_URL"

while true; do
  check_services
  status=$?

  case $status in
    0)
      # All services healthy
      if [[ $restart_attempts -gt 0 ]]; then
        log "Services recovered after $restart_attempts restart attempt(s)"
        restart_attempts=0
      fi
      ;;

    1)
      # Both services down
      log "ALERT: Both API and WebUI are down!"
      show_recent_logs

      if [[ $restart_attempts -lt $max_restart_attempts ]]; then
        ((restart_attempts++))
        log "Attempting restart ($restart_attempts/$max_restart_attempts)..."
        restart_daemon
      else
        log "Max restart attempts reached. Attempting full rebuild..."
        if full_rebuild; then
          restart_attempts=0
          log "Full rebuild completed successfully"
        else
          log "ERROR: Full rebuild failed. Manual intervention required."
          log "Waiting 5 minutes before retrying..."
          sleep 300
        fi
      fi
      ;;

    2)
      # Only WebUI down - this is common, just restart
      log "WARNING: WebUI is down (API is healthy)"

      if [[ $restart_attempts -lt $max_restart_attempts ]]; then
        ((restart_attempts++))
        log "Attempting restart ($restart_attempts/$max_restart_attempts)..."
        restart_daemon
      else
        log "Max restart attempts reached for WebUI. Attempting full rebuild..."
        if full_rebuild; then
          restart_attempts=0
        else
          log "ERROR: Full rebuild failed. Continuing with API only."
          restart_attempts=0  # Reset and continue monitoring
        fi
      fi
      ;;

    3)
      # Only API down - more serious
      log "ALERT: API is down (WebUI may still be serving cached content)"
      show_recent_logs

      if [[ $restart_attempts -lt $max_restart_attempts ]]; then
        ((restart_attempts++))
        log "Attempting restart ($restart_attempts/$max_restart_attempts)..."
        restart_daemon
      else
        log "Max restart attempts reached. Attempting full rebuild..."
        if full_rebuild; then
          restart_attempts=0
        else
          log "ERROR: Full rebuild failed. Manual intervention required."
          sleep 300
        fi
      fi
      ;;
  esac

  # Wait before next check
  if [[ $restart_attempts -eq 0 ]]; then
    sleep 30
  else
    sleep 10  # Check more frequently during recovery
  fi
done
