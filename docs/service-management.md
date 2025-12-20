# Service Management Guide

This guide covers managing APEX daemon as a system service on Linux (systemd) and macOS (launchd) platforms, including installation, configuration, troubleshooting, and logging.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Linux (systemd) Service Management](#linux-systemd-service-management)
- [macOS (launchd) Service Management](#macos-launchd-service-management)
- [Configuration](#configuration)
- [Service Logging](#service-logging)
- [Auto-Start Configuration](#auto-start-configuration)
- [Troubleshooting](#troubleshooting)
- [Platform Comparison](#platform-comparison)

## Overview

APEX can run as a system service to provide:
- **Automatic startup** on system boot
- **Automatic restart** on failure
- **Background operation** independent of user login
- **System integration** with native service management tools

The service runs the APEX daemon (`apex daemon start --foreground`) and integrates with:
- **Linux**: systemd (user-level services)
- **macOS**: launchd (LaunchAgents)

> **Note**: Windows is not currently supported for service installation.

## Prerequisites

Before installing APEX as a service:

1. **APEX must be initialized** in your project directory:
   ```bash
   apex init
   ```

2. **Valid configuration** in `.apex/config.yaml`

3. **Proper permissions** for service file installation (usually no sudo required for user-level services)

4. **Platform-specific requirements**:
   - **Linux**: systemd available (`systemctl --version`)
   - **macOS**: macOS with launchd (always available)

## Linux (systemd) Service Management

### Installation

Install APEX as a systemd user service:

```bash
# Basic installation
apex install-service

# Install and enable for boot startup
apex install-service --enable

# Install with custom name
apex install-service --name my-apex-daemon

# Force overwrite existing service
apex install-service --force
```

**What this does**:
- Generates a systemd unit file (`.service`)
- Installs to `~/.config/systemd/user/apex-daemon.service`
- Reloads systemd configuration (`systemctl --user daemon-reload`)
- Optionally enables for boot startup

### Service Management Commands

```bash
# Start the service
systemctl --user start apex-daemon

# Stop the service
systemctl --user stop apex-daemon

# Restart the service
systemctl --user restart apex-daemon

# Check service status
systemctl --user status apex-daemon

# Enable boot startup
systemctl --user enable apex-daemon

# Disable boot startup
systemctl --user disable apex-daemon

# View service logs
journalctl --user -u apex-daemon -f

# View recent logs
journalctl --user -u apex-daemon --since "1 hour ago"
```

### Service File Location

- **User service**: `~/.config/systemd/user/apex-daemon.service`
- **System service** (requires sudo): `/etc/systemd/system/apex-daemon.service`

### Example Generated Service File

```ini
[Unit]
Description=APEX Daemon - AI Development Team Automation
Documentation=https://github.com/your-org/apex
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=myuser
WorkingDirectory=/home/myuser/project
ExecStart=/usr/bin/node /usr/local/lib/node_modules/@apex/cli/dist/index.js daemon start --foreground
ExecStop=/usr/bin/node /usr/local/lib/node_modules/@apex/cli/dist/index.js daemon stop
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=apex-daemon

# Environment
Environment=NODE_ENV=production
Environment=APEX_PROJECT_PATH=/home/myuser/project

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Uninstallation

```bash
# Uninstall service
apex uninstall-service

# Force uninstall (even if stop fails)
apex uninstall-service --force

# Uninstall with custom stop timeout
apex uninstall-service --timeout 10000
```

**What this does**:
- Stops the service (`systemctl --user stop`)
- Disables boot startup (`systemctl --user disable`)
- Removes service file (`~/.config/systemd/user/apex-daemon.service`)
- Reloads systemd configuration

## macOS (launchd) Service Management

### Installation

Install APEX as a launchd LaunchAgent:

```bash
# Basic installation
apex install-service

# Install and enable for boot startup
apex install-service --enable

# Install with custom name
apex install-service --name my-apex-daemon

# Force overwrite existing service
apex install-service --force
```

**What this does**:
- Generates a property list (`.plist`) file
- Installs to `~/Library/LaunchAgents/com.apex.daemon.plist`
- Optionally loads and enables the service

### Service Management Commands

```bash
# Load and start the service
launchctl load ~/Library/LaunchAgents/com.apex.daemon.plist

# Unload and stop the service
launchctl unload ~/Library/LaunchAgents/com.apex.daemon.plist

# Start the service (if loaded)
launchctl start com.apex.daemon

# Stop the service (if loaded)
launchctl stop com.apex.daemon

# Check if service is loaded/running
launchctl list | grep com.apex.daemon

# View all loaded services
launchctl list | grep apex
```

### Service File Location

- **User agent**: `~/Library/LaunchAgents/com.apex.daemon.plist`
- **System daemon** (requires sudo): `/Library/LaunchDaemons/com.apex.daemon.plist`

### Example Generated Plist File

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.apex.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/usr/local/lib/node_modules/@apex/cli/dist/index.js</string>
        <string>daemon</string>
        <string>start</string>
        <string>--foreground</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/myuser/project</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>APEX_PROJECT_PATH</key>
        <string>/Users/myuser/project</string>
        <key>ANTHROPIC_API_KEY</key>
        <string>your-api-key-here</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>StandardOutPath</key>
    <string>/Users/myuser/project/.apex/daemon.out.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/myuser/project/.apex/daemon.err.log</string>
</dict>
</plist>
```

### Uninstallation

```bash
# Uninstall service
apex uninstall-service

# Force uninstall (even if unload fails)
apex uninstall-service --force
```

**What this does**:
- Unloads the service (`launchctl unload`)
- Removes plist file (`~/Library/LaunchAgents/com.apex.daemon.plist`)

## Configuration

### Service Configuration

Configure service behavior in `.apex/config.yaml`:

```yaml
daemon:
  # Existing daemon settings
  pollInterval: 5000
  autoStart: false        # Controls CLI auto-start (not service)
  logLevel: info

  # Service-specific configuration
  service:
    enableOnBoot: true    # Service starts when system boots
    name: apex-daemon     # Service name
    restartPolicy: on-failure  # always, on-failure, never
    restartDelaySeconds: 5
```

### Environment Variables

The service automatically includes:
- `NODE_ENV=production`
- `APEX_PROJECT_PATH=/path/to/project`
- Any custom environment variables from config

Add custom environment variables:

```yaml
daemon:
  service:
    environment:
      DEBUG: "apex:*"
      NODE_OPTIONS: "--max-old-space-size=4096"
```

### Restart Policies

| Policy | Linux (systemd) | macOS (launchd) | Description |
|--------|-----------------|-----------------|-------------|
| `always` | `Restart=always` | `KeepAlive=true` | Restart on any exit |
| `on-failure` | `Restart=on-failure` | `KeepAlive={SuccessfulExit: false}` | Restart only on crash |
| `never` | `Restart=no` | `KeepAlive=false` | Never restart |

## Service Logging

### Linux (systemd) Logging

Systemd services log to the system journal:

```bash
# Follow service logs in real-time
journalctl --user -u apex-daemon -f

# View recent logs
journalctl --user -u apex-daemon --since "1 hour ago"

# View logs from specific date
journalctl --user -u apex-daemon --since "2024-01-01"

# View logs with specific priority
journalctl --user -u apex-daemon --priority err

# Export logs to file
journalctl --user -u apex-daemon > apex-service.log
```

**Log location**: System journal (managed by journald)

### macOS (launchd) Logging

Launchd services log to files specified in the plist:

```bash
# View stdout logs
tail -f /path/to/project/.apex/daemon.out.log

# View stderr logs
tail -f /path/to/project/.apex/daemon.err.log

# View both logs together
tail -f /path/to/project/.apex/daemon.*.log

# View system logs for launchd
log stream --predicate 'process == "launchd"' --style syslog
```

**Log locations**:
- **stdout**: `PROJECT_PATH/.apex/daemon.out.log`
- **stderr**: `PROJECT_PATH/.apex/daemon.err.log`

### Log Configuration

Control logging behavior through APEX configuration:

```yaml
daemon:
  logLevel: info        # debug, info, warn, error
  logFormat: json       # json, text
  logFile: .apex/daemon.log
```

## Auto-Start Configuration

### Enabling Boot Startup

**Option 1: During installation**
```bash
apex install-service --enable
```

**Option 2: After installation**

Linux:
```bash
systemctl --user enable apex-daemon
```

macOS:
```bash
launchctl load -w ~/Library/LaunchAgents/com.apex.daemon.plist
```

**Option 3: Via configuration**
```yaml
# .apex/config.yaml
daemon:
  service:
    enableOnBoot: true
```

### Disabling Boot Startup

Linux:
```bash
systemctl --user disable apex-daemon
```

macOS:
```bash
launchctl unload -w ~/Library/LaunchAgents/com.apex.daemon.plist
```

### Checking Boot Status

Linux:
```bash
systemctl --user is-enabled apex-daemon
```

macOS:
```bash
launchctl list | grep com.apex.daemon
# If listed, it's enabled for boot
```

## Troubleshooting

### Common Issues

#### 1. Service Installation Failed

**Error**: `Permission denied writing service file`

**Solution**:
- Ensure service directory exists:
  ```bash
  # Linux
  mkdir -p ~/.config/systemd/user

  # macOS
  mkdir -p ~/Library/LaunchAgents
  ```

- Check directory permissions:
  ```bash
  ls -la ~/.config/systemd/user    # Linux
  ls -la ~/Library/LaunchAgents    # macOS
  ```

#### 2. Service Won't Start

**Error**: `Failed to start service`

**Diagnosis**:
```bash
# Linux - check service status
systemctl --user status apex-daemon

# macOS - check launchctl output
launchctl list | grep apex
launchctl error com.apex.daemon
```

**Common causes**:
- **APEX not initialized**: Run `apex init` in project directory
- **Invalid configuration**: Check `.apex/config.yaml` syntax
- **Missing API key**: Set `ANTHROPIC_API_KEY` environment variable
- **Wrong paths**: Verify Node.js and APEX CLI paths in service file

#### 3. Service Starts But Crashes

**Diagnosis**: Check service logs

Linux:
```bash
journalctl --user -u apex-daemon --since "5 minutes ago"
```

macOS:
```bash
tail -20 /path/to/project/.apex/daemon.err.log
```

**Common causes**:
- **Configuration errors**: Invalid `.apex/config.yaml`
- **Port conflicts**: Another process using daemon port
- **Database issues**: Corrupted `.apex/apex.db`

#### 4. Service Doesn't Start on Boot

**Linux troubleshooting**:
```bash
# Check if service is enabled
systemctl --user is-enabled apex-daemon

# Check if user lingering is enabled
loginctl show-user $USER --property=Linger

# Enable user lingering (allows services to start without login)
sudo loginctl enable-linger $USER
```

**macOS troubleshooting**:
```bash
# Check if plist is loaded
launchctl list | grep com.apex

# Check RunAtLoad setting in plist
plutil -p ~/Library/LaunchAgents/com.apex.daemon.plist | grep RunAtLoad
```

#### 5. Port Permission Issues

**Error**: `EACCES: permission denied, bind to port 3000`

**Solutions**:
- Use non-privileged port (> 1024):
  ```yaml
  # .apex/config.yaml
  server:
    port: 3001
  ```

- On Linux, allow binding to low ports:
  ```bash
  sudo setcap 'cap_net_bind_service=+ep' $(which node)
  ```

### Platform-Specific Issues

#### Linux (systemd)

**Issue**: User service won't start after reboot
**Solution**: Enable user lingering
```bash
sudo loginctl enable-linger $USER
```

**Issue**: Service file not found after installation
**Solution**: Check systemd user directory
```bash
ls -la ~/.config/systemd/user/
systemctl --user daemon-reload
```

#### macOS (launchd)

**Issue**: Service loads but doesn't stay running
**Solution**: Check KeepAlive settings and logs
```bash
# Check plist KeepAlive setting
plutil -p ~/Library/LaunchAgents/com.apex.daemon.plist

# Check error logs
tail -50 /path/to/project/.apex/daemon.err.log
```

**Issue**: `launchctl load` fails with "service already loaded"
**Solution**: Unload first, then reload
```bash
launchctl unload ~/Library/LaunchAgents/com.apex.daemon.plist
launchctl load ~/Library/LaunchAgents/com.apex.daemon.plist
```

### Diagnostic Commands

**Check service status**:
```bash
# Linux
systemctl --user status apex-daemon
systemctl --user list-units | grep apex

# macOS
launchctl list | grep apex
ps aux | grep apex
```

**Verify service configuration**:
```bash
# Linux - view service file
cat ~/.config/systemd/user/apex-daemon.service

# macOS - view plist file
cat ~/Library/LaunchAgents/com.apex.daemon.plist
plutil -p ~/Library/LaunchAgents/com.apex.daemon.plist
```

**Test manual startup**:
```bash
# Test APEX daemon manually
apex daemon start --foreground

# Test in project directory
cd /path/to/project
apex daemon start
```

## Platform Comparison

| Feature | Linux (systemd) | macOS (launchd) |
|---------|------------------|-----------------|
| **Service File** | `~/.config/systemd/user/service.service` | `~/Library/LaunchAgents/label.plist` |
| **Start Command** | `systemctl --user start service` | `launchctl start label` |
| **Stop Command** | `systemctl --user stop service` | `launchctl stop label` |
| **Enable Boot** | `systemctl --user enable service` | `launchctl load -w plist` |
| **Status Check** | `systemctl --user status service` | `launchctl list \| grep label` |
| **View Logs** | `journalctl --user -u service` | `tail -f .apex/daemon.*.log` |
| **Config Reload** | `systemctl --user daemon-reload` | Automatic |
| **User Services** | Requires user lingering for boot | Works automatically |

### When to Use Each Platform

**Use systemd (Linux) when**:
- You need robust logging via journald
- You want systemd's advanced features (dependencies, sandboxing)
- You're running on a Linux server environment

**Use launchd (macOS) when**:
- You're developing on macOS
- You need GUI application integration
- You want simpler file-based logging

---

For more information, see:
- [CLI Guide](cli-guide.md) - Complete command reference
- [Configuration Guide](configuration.md) - Daemon and service configuration
- [Troubleshooting Guide](troubleshooting.md) - General APEX troubleshooting