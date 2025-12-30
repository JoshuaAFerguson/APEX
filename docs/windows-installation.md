# Windows Installation Guide

This guide provides comprehensive instructions for installing and configuring APEX on Windows systems.

## System Requirements

### Supported Windows Versions
- Windows 10 (version 1903 or later)
- Windows 11
- Windows Server 2019 or later

### Prerequisites

#### Essential Requirements
1. **Node.js 18 or higher**
   - [Download from nodejs.org](https://nodejs.org/)
   - Choose the LTS version for stability
   - Includes npm package manager

2. **Git for Windows**
   - [Download Git for Windows](https://git-scm.com/download/win)
   - Provides Git Bash, Git GUI, and Git from Command Line
   - Required for all APEX Git operations

3. **Terminal Application**
   - **Windows Terminal** (recommended) - [Microsoft Store](https://aka.ms/terminal)
   - Command Prompt (built-in)
   - PowerShell 5.1+ (built-in)
   - Git Bash (included with Git for Windows)

#### Recommended for Development
- **Windows Subsystem for Linux (WSL2)** - For advanced development workflows
- **Visual Studio Code** - Code editor with excellent Git and terminal integration
- **Windows Package Manager (winget)** - For package installation

## Installation Methods

### Method 1: Using npm (Recommended)

This method works with any terminal application.

#### Step 1: Install Node.js
```powershell
# Using winget (Windows 10 1909+ or Windows 11)
winget install OpenJS.NodeJS

# Or download and install manually from https://nodejs.org/
```

#### Step 2: Install APEX globally
```powershell
# PowerShell (recommended)
npm install -g @apexcli/cli

# Command Prompt
npm install -g @apexcli/cli
```

#### Step 3: Verify installation
```powershell
apex --version
apex --help
```

### Method 2: Using Windows Package Manager (winget)

```powershell
# Install Node.js first if not already installed
winget install OpenJS.NodeJS

# Install APEX via npm
npm install -g @apexcli/cli
```

### Method 3: Development Installation

For contributing to APEX or local development:

```powershell
# Clone the repository
git clone https://github.com/JoshuaAFerguson/apex.git
cd apex

# Install dependencies
npm install

# Build all packages
npm run build

# Link for global usage
npm link

# Verify installation
apex --version
```

## Configuration

### API Key Setup

APEX requires an Anthropic API key. Choose one method below:

#### Method 1: Environment Variable (Session-based)

**PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="your_api_key_here"
```

**Command Prompt:**
```cmd
set ANTHROPIC_API_KEY=your_api_key_here
```

#### Method 2: Permanent Environment Variable

**Option A: System Properties GUI**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables" button
3. Under "User variables", click "New"
4. Variable name: `ANTHROPIC_API_KEY`
5. Variable value: `your_api_key_here`
6. Click OK and restart your terminal

**Option B: PowerShell (Administrator required)**
```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your_api_key_here", "User")
# Restart your terminal after running this
```

**Option C: Command Prompt (Administrator required)**
```cmd
setx ANTHROPIC_API_KEY "your_api_key_here"
# Restart your terminal after running this
```

### Verify Configuration

Test that everything is working:

```powershell
# Check APEX installation
apex --version

# Check API key (should not show "not set" error)
apex config

# Test basic functionality
cd your-project-directory
apex init
```

## Windows-Specific Considerations

### PATH Configuration

If `apex` command is not recognized after installation:

1. **Find npm global installation path:**
```powershell
npm config get prefix
# Usually: C:\Users\<username>\AppData\Roaming\npm
```

2. **Add to PATH environment variable:**
   - Follow the same steps as API key setup
   - Add the npm global path to your PATH variable
   - Restart your terminal

### Terminal Selection

**Windows Terminal (Recommended):**
- Best Unicode and color support
- Multiple tab support
- Customizable appearance
- Works with PowerShell, Command Prompt, and Git Bash

**PowerShell:**
- Native Windows scripting environment
- Full APEX compatibility
- Good for automation scripts

**Command Prompt:**
- Basic but reliable
- Full APEX functionality
- Familiar to Windows users

**Git Bash:**
- Unix-like environment
- May have minor display formatting differences
- Good for developers familiar with Unix commands

### PowerShell Execution Policy

If you encounter script execution errors in PowerShell:

```powershell
# Check current execution policy
Get-ExecutionPolicy

# Set policy to allow local scripts (recommended)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or allow all scripts (less secure, use with caution)
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
```

### Windows Defender Considerations

Windows Defender may occasionally flag Node.js operations:

1. **Add npm global directory to exclusions:**
   - Open Windows Security
   - Go to Virus & threat protection
   - Add exclusion for folder: `%APPDATA%\npm`

2. **Add your project directories to exclusions** if you encounter performance issues

## Usage Examples

### Basic Project Setup

```powershell
# Navigate to your project
cd C:\Users\<username>\Projects\my-project

# Initialize APEX
apex init

# Follow the prompts for project configuration

# Run your first task
apex run "Add a health check endpoint to the API"
```

### Running the API Server

```powershell
# Start the APEX API server
apex serve

# Or with custom options
apex serve --port 3000 --host 0.0.0.0
```

### Service Management Alternative

Since Windows service management is not yet implemented, use these alternatives:

#### Option 1: Task Scheduler
1. Open Task Scheduler (`Win + R` → `taskschd.msc`)
2. Create Basic Task
3. Name: "APEX Service"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program/script: `cmd.exe`
7. Arguments: `/c "cd /d C:\path\to\your\project && apex serve"`

#### Option 2: Windows Services Wrapper (NSSM)
```powershell
# Install NSSM
winget install NSSM.NSSM

# Create Windows service
nssm install apex-service
# In the NSSM GUI:
# - Application path: <path-to-node.exe>
# - Startup directory: <your-project-path>
# - Arguments: <path-to-apex-cli> serve
```

## Troubleshooting

### Common Issues and Solutions

#### "apex is not recognized as an internal or external command"

**Solution:**
1. Ensure npm global directory is in PATH
2. Restart your terminal
3. Try reinstalling: `npm uninstall -g @apexcli/cli && npm install -g @apexcli/cli`

#### Permission Issues During Installation

**Solution:**
1. Run terminal as Administrator (not recommended for regular use)
2. Or configure npm to use a user directory: `npm config set prefix %APPDATA%\npm`

#### Node.js Installation Issues

**Solution:**
1. Download Node.js installer directly from nodejs.org
2. Run as Administrator
3. Ensure "Add to PATH" is checked during installation
4. Restart your computer if necessary

#### Git Operations Fail

**Solution:**
1. Ensure Git for Windows is installed
2. Add Git to PATH: usually `C:\Program Files\Git\bin`
3. Test with: `git --version`

### Performance Optimization

#### For Better Performance:
1. **Use Windows Terminal** instead of Command Prompt
2. **Add project directories to Windows Defender exclusions**
3. **Use an SSD** for better file I/O performance
4. **Increase PowerShell buffer size** in terminal settings

#### For Development:
1. **Enable Developer Mode** in Windows Settings
2. **Use WSL2** for Linux-like development environment
3. **Install Windows Terminal Preview** for latest features

## Additional Resources

### Documentation
- [Getting Started Guide](getting-started.md) - Basic usage instructions
- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [Configuration Guide](configuration.md) - Advanced configuration options

### Windows-Specific Tools
- [Windows Terminal](https://github.com/microsoft/terminal) - Modern terminal application
- [Windows Package Manager](https://github.com/microsoft/winget-cli) - Package installation
- [PowerShell](https://docs.microsoft.com/en-us/powershell/) - Windows PowerShell documentation

### Community Support
- [GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues) - Report Windows-specific issues
- [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions) - Community help

## What's Supported on Windows

✅ **Fully Supported:**
- Core APEX functionality (task orchestration, AI agents, workflows)
- CLI interface and all commands
- API server and WebSocket streaming
- Git operations and worktree management
- Build, test, and development workflows
- Database operations (SQLite)
- File operations and project management

⚠️ **Partial Support:**
- Service management (manual alternatives available)
- Some Unix-specific file operations (automatically skipped in tests)

🔄 **Planned:**
- Native Windows service integration
- PowerShell-specific optimizations
- Windows-specific deployment options

---

APEX provides excellent Windows compatibility for all core functionality. While some Unix-specific features like service management are not yet implemented, workarounds are available and Windows service support is planned for future releases.