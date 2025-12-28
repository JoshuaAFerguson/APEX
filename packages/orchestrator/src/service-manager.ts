import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getHomeDir, getConfigDir } from '@apex/core';

const execPromise = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

export type Platform = 'linux' | 'darwin' | 'win32' | 'unsupported';

export type ServiceErrorCode =
  | 'PLATFORM_UNSUPPORTED'
  | 'SERVICE_EXISTS'
  | 'SERVICE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INSTALL_FAILED'
  | 'UNINSTALL_FAILED'
  | 'GENERATION_FAILED';

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface ServiceManagerOptions {
  /** Path to the project directory (default: process.cwd()) */
  projectPath?: string;
  /** Service name (default: 'apex-daemon') */
  serviceName?: string;
  /** Description for the service */
  serviceDescription?: string;
  /** User to run service as (default: current user) */
  user?: string;
  /** Working directory for the service */
  workingDirectory?: string;
  /** Environment variables for the service */
  environment?: Record<string, string>;
  /** Restart policy: 'always', 'on-failure', 'never' */
  restartPolicy?: 'always' | 'on-failure' | 'never';
  /** Restart delay in seconds */
  restartDelaySeconds?: number;
}

export interface ServiceStatus {
  installed: boolean;
  enabled: boolean;
  running: boolean;
  pid?: number;
  uptime?: number;
  platform: Platform;
  servicePath?: string;
}

export interface ServiceFileResult {
  content: string;
  path: string;
  platform: Platform;
}

export interface InstallOptions {
  /** Automatically enable the service after installation (default: false) */
  enableAfterInstall?: boolean;
  /** Force overwrite if service file already exists (default: false) */
  force?: boolean;
  /** Enable service to start on boot (default: false) */
  enableOnBoot?: boolean;
}

export interface UninstallOptions {
  /** Force uninstall even if stop fails (default: false) */
  force?: boolean;
  /** Timeout in ms to wait for graceful stop (default: 5000) */
  stopTimeout?: number;
}

export interface InstallResult {
  success: boolean;
  servicePath: string;
  platform: Platform;
  enabled: boolean;
  warnings: string[];
}

export interface UninstallResult {
  success: boolean;
  servicePath: string;
  wasRunning: boolean;
  warnings: string[];
}

// ============================================================================
// Platform Detection
// ============================================================================

export function detectPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  return 'unsupported';
}

export function isSystemdAvailable(): boolean {
  // Check if systemctl exists and is functional
  try {
    require('child_process').execSync('systemctl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isLaunchdAvailable(): boolean {
  // macOS always has launchd if platform is darwin
  return process.platform === 'darwin';
}

export function isWindowsServiceAvailable(): boolean {
  // Check if we're on Windows and can access service control manager
  if (process.platform !== 'win32') return false;

  try {
    // Check if sc command is available (Service Control Manager)
    require('child_process').execSync('sc query', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isNSSMAvailable(): boolean {
  // Check if NSSM (Non-Sucking Service Manager) is available on Windows
  if (process.platform !== 'win32') return false;

  try {
    require('child_process').execSync('nssm version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// SystemdGenerator Implementation
// ============================================================================

export class SystemdGenerator {
  constructor(
    private readonly options: Required<ServiceManagerOptions>,
    private readonly enableOnBoot: boolean = false
  ) {}

  generate(): string {
    const nodePath = process.execPath;
    const apexCliPath = this.findApexCliPath();

    return `[Unit]
Description=${this.options.serviceDescription}
Documentation=https://github.com/your-org/apex
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${this.options.user}
WorkingDirectory=${this.options.workingDirectory}
ExecStart=${nodePath} ${apexCliPath} daemon start --foreground
ExecStop=${nodePath} ${apexCliPath} daemon stop
Restart=${this.mapRestartPolicy(this.options.restartPolicy)}
RestartSec=${this.options.restartDelaySeconds}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${this.options.serviceName}

# Environment
Environment=NODE_ENV=production
Environment=APEX_PROJECT_PATH=${this.options.projectPath}
${this.formatEnvironment(this.options.environment)}

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`;
  }

  getInstallPath(): string {
    // User-level services go to ~/.config/systemd/user/
    // System-level (requires sudo) go to /etc/systemd/system/
    const isRoot = process.getuid?.() === 0;
    if (isRoot) {
      return `/etc/systemd/system/${this.options.serviceName}.service`;
    }
    const configDir = getConfigDir();
    return path.join(configDir, 'systemd', 'user', `${this.options.serviceName}.service`);
  }

  private mapRestartPolicy(policy: string): string {
    switch (policy) {
      case 'always': return 'always';
      case 'on-failure': return 'on-failure';
      case 'never': return 'no';
      default: return 'on-failure';
    }
  }

  private formatEnvironment(env: Record<string, string>): string {
    return Object.entries(env)
      .map(([key, value]) => `Environment=${key}=${value}`)
      .join('\n');
  }

  private findApexCliPath(): string {
    // Find the apex CLI entry point
    // Could be global install or local node_modules
    try {
      return require.resolve('@apex/cli/dist/index.js');
    } catch {
      // Fallback to checking common locations
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js'),
        path.join(process.cwd(), 'packages/cli/dist/index.js'),
        '/usr/local/lib/node_modules/@apex/cli/dist/index.js',
      ];

      for (const possiblePath of possiblePaths) {
        try {
          require('fs').accessSync(possiblePath);
          return possiblePath;
        } catch {
          // Continue to next path
        }
      }

      // If nothing found, return a reasonable default
      return path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js');
    }
  }
}

// ============================================================================
// LaunchdGenerator Implementation
// ============================================================================

export class LaunchdGenerator {
  constructor(
    private readonly options: Required<ServiceManagerOptions>,
    private readonly enableOnBoot: boolean = false
  ) {}

  generate(): string {
    const nodePath = process.execPath;
    const apexCliPath = this.findApexCliPath();
    const logDir = path.join(this.options.projectPath, '.apex');

    const plist = {
      Label: this.getLaunchdLabel(),
      ProgramArguments: [nodePath, apexCliPath, 'daemon', 'start', '--foreground'],
      WorkingDirectory: this.options.workingDirectory,
      EnvironmentVariables: {
        NODE_ENV: 'production',
        APEX_PROJECT_PATH: this.options.projectPath,
        ...this.options.environment,
      },
      RunAtLoad: this.enableOnBoot,
      KeepAlive: this.buildKeepAlive(),
      ThrottleInterval: this.options.restartDelaySeconds,
      StandardOutPath: path.join(logDir, 'daemon.out.log'),
      StandardErrorPath: path.join(logDir, 'daemon.err.log'),
    };

    return this.toPlistXml(plist);
  }

  getInstallPath(): string {
    // User-level LaunchAgents
    const homeDir = getHomeDir();
    return path.join(homeDir, 'Library', 'LaunchAgents', `${this.getLaunchdLabel()}.plist`);
  }

  private getLaunchdLabel(): string {
    // Convert service name to reverse-domain notation
    // apex-daemon -> com.apex.daemon
    return `com.apex.${this.options.serviceName.replace('apex-', '')}`;
  }

  private buildKeepAlive(): Record<string, unknown> | boolean {
    switch (this.options.restartPolicy) {
      case 'always':
        return { SuccessfulExit: false, Crashed: true };
      case 'on-failure':
        return { SuccessfulExit: false };
      case 'never':
        return false;
      default:
        return { SuccessfulExit: false };
    }
  }

  private toPlistXml(obj: Record<string, unknown>): string {
    // Build XML plist from object structure
    const header = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>`;

    const footer = `
</dict>
</plist>`;

    const body = this.objectToPlistEntries(obj, 1);
    return header + body + footer;
  }

  private objectToPlistEntries(obj: Record<string, unknown>, indent: number): string {
    const pad = '    '.repeat(indent);
    let result = '';

    for (const [key, value] of Object.entries(obj)) {
      result += `\n${pad}<key>${this.escapeXml(key)}</key>`;
      result += `\n${pad}${this.valueToPlist(value, indent)}`;
    }

    return result;
  }

  private valueToPlist(value: unknown, indent: number): string {
    const pad = '    '.repeat(indent);

    if (typeof value === 'string') {
      return `<string>${this.escapeXml(value)}</string>`;
    }
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? `<integer>${value}</integer>`
        : `<real>${value}</real>`;
    }
    if (typeof value === 'boolean') {
      return value ? '<true/>' : '<false/>';
    }
    if (Array.isArray(value)) {
      const items = value.map(v => `${pad}    ${this.valueToPlist(v, indent + 1)}`).join('\n');
      return `<array>\n${items}\n${pad}</array>`;
    }
    if (typeof value === 'object' && value !== null) {
      const entries = this.objectToPlistEntries(value as Record<string, unknown>, indent + 1);
      return `<dict>${entries}\n${pad}</dict>`;
    }
    return '<string></string>';
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private findApexCliPath(): string {
    try {
      return require.resolve('@apex/cli/dist/index.js');
    } catch {
      // Fallback to checking common locations
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js'),
        path.join(process.cwd(), 'packages/cli/dist/index.js'),
        '/usr/local/lib/node_modules/@apex/cli/dist/index.js',
      ];

      for (const possiblePath of possiblePaths) {
        try {
          require('fs').accessSync(possiblePath);
          return possiblePath;
        } catch {
          // Continue to next path
        }
      }

      // If nothing found, return a reasonable default
      return path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js');
    }
  }
}

// ============================================================================
// WindowsServiceGenerator Implementation
// ============================================================================

export class WindowsServiceGenerator {
  constructor(
    private readonly options: Required<ServiceManagerOptions>,
    private readonly enableOnBoot: boolean = false
  ) {}

  generate(): string {
    const nodePath = process.execPath.replace(/\\/g, '\\\\');
    const apexCliPath = this.findApexCliPath().replace(/\\/g, '\\\\');

    // Generate a PowerShell script that uses NSSM (Non-Sucking Service Manager)
    // or falls back to sc.exe for basic service creation
    return `# APEX Service Installation Script for Windows
# This script creates a Windows service for APEX Daemon

param(
    [Parameter(Mandatory=$false)]
    [switch]$Install,

    [Parameter(Mandatory=$false)]
    [switch]$Uninstall,

    [Parameter(Mandatory=$false)]
    [switch]$UseNSSM = $true
)

$serviceName = "${this.options.serviceName}"
$serviceDisplayName = "${this.options.serviceDescription}"
$nodePath = "${nodePath}"
$apexCliPath = "${apexCliPath}"
$workingDirectory = "${this.options.workingDirectory.replace(/\\/g, '\\\\')}"
$enableOnBoot = $${this.enableOnBoot.toString().toLowerCase()}

function Install-ApexService {
    if ($UseNSSM -and (Get-Command "nssm" -ErrorAction SilentlyContinue)) {
        Write-Host "Installing service using NSSM..."

        # Install service with NSSM
        & nssm install $serviceName $nodePath $apexCliPath daemon start --foreground
        & nssm set $serviceName DisplayName "$serviceDisplayName"
        & nssm set $serviceName Description "$serviceDisplayName"
        & nssm set $serviceName AppDirectory "$workingDirectory"

        # Set environment variables
        & nssm set $serviceName AppEnvironmentExtra "NODE_ENV=production" "APEX_PROJECT_PATH=${this.options.projectPath.replace(/\\/g, '\\\\')}"
${this.formatEnvironmentForNSSM()}

        # Set restart policy
        & nssm set $serviceName AppExit Default ${this.mapRestartPolicyForNSSM()}
        & nssm set $serviceName AppRestartDelay ${this.options.restartDelaySeconds * 1000}

        # Set startup type
        if ($enableOnBoot) {
            & nssm set $serviceName Start SERVICE_AUTO_START
        } else {
            & nssm set $serviceName Start SERVICE_DEMAND_START
        }

        # Set log files
        $logDir = Join-Path "${this.options.projectPath.replace(/\\/g, '\\\\')}" ".apex"
        if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force }
        & nssm set $serviceName AppStdout (Join-Path $logDir "daemon.out.log")
        & nssm set $serviceName AppStderr (Join-Path $logDir "daemon.err.log")

        Write-Host "Service installed successfully with NSSM"
    } else {
        Write-Host "Installing service using built-in Windows Service Manager..."
        Write-Warning "NSSM not available. Using basic service creation. Consider installing NSSM for better service management."

        # Create a wrapper script for the service
        $wrapperScript = @"
@echo off
cd /d "$workingDirectory"
set NODE_ENV=production
set APEX_PROJECT_PATH=${this.options.projectPath}
${this.formatEnvironmentForBatch()}
"$nodePath" "$apexCliPath" daemon start --foreground
"@

        $wrapperPath = Join-Path $env:TEMP "apex-service-wrapper.bat"
        $wrapperScript | Out-File -FilePath $wrapperPath -Encoding ASCII

        # Create service using sc.exe
        $startType = if ($enableOnBoot) { "auto" } else { "demand" }
        & sc.exe create $serviceName binPath= "\`"$wrapperPath\`"" DisplayName= "$serviceDisplayName" start= $startType
        & sc.exe description $serviceName "$serviceDisplayName"

        Write-Host "Basic service installed successfully"
        Write-Host "Wrapper script created at: $wrapperPath"
    }
}

function Uninstall-ApexService {
    Write-Host "Uninstalling service..."

    # Stop service if running
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-Host "Stopping service..."
        Stop-Service -Name $serviceName -Force
        Start-Sleep -Seconds 2
    }

    if ($UseNSSM -and (Get-Command "nssm" -ErrorAction SilentlyContinue)) {
        & nssm remove $serviceName confirm
    } else {
        & sc.exe delete $serviceName
    }

    # Clean up wrapper script if it exists
    $wrapperPath = Join-Path $env:TEMP "apex-service-wrapper.bat"
    if (Test-Path $wrapperPath) {
        Remove-Item $wrapperPath -Force
        Write-Host "Cleaned up wrapper script"
    }

    Write-Host "Service uninstalled successfully"
}

# Main execution
if ($Install) {
    Install-ApexService
} elseif ($Uninstall) {
    Uninstall-ApexService
} else {
    Write-Host "Usage: .\\service-install.ps1 -Install or .\\service-install.ps1 -Uninstall"
    Write-Host "Optional: Add -UseNSSM:`$false to use basic Windows service manager"
}
`;
  }

  getInstallPath(): string {
    // Windows service scripts typically go in the project .apex directory
    return path.join(this.options.projectPath, '.apex', 'service-install.ps1');
  }

  private mapRestartPolicyForNSSM(): string {
    switch (this.options.restartPolicy) {
      case 'always': return 'Restart';
      case 'on-failure': return 'Restart';
      case 'never': return 'Exit';
      default: return 'Restart';
    }
  }

  private formatEnvironmentForNSSM(): string {
    const entries = Object.entries(this.options.environment);
    if (entries.length === 0) return '';

    return entries
      .map(([key, value]) => `        & nssm set $serviceName AppEnvironmentExtra "${key}=${value}"`)
      .join('\n');
  }

  private formatEnvironmentForBatch(): string {
    return Object.entries(this.options.environment)
      .map(([key, value]) => `set ${key}=${value}`)
      .join('\n');
  }

  private findApexCliPath(): string {
    try {
      return require.resolve('@apex/cli/dist/index.js');
    } catch {
      // Fallback to checking common locations on Windows
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules', '@apex', 'cli', 'dist', 'index.js'),
        path.join(process.cwd(), 'packages', 'cli', 'dist', 'index.js'),
        path.join(getConfigDir(), 'npm', 'node_modules', '@apex', 'cli', 'dist', 'index.js'),
      ];

      for (const possiblePath of possiblePaths) {
        try {
          require('fs').accessSync(possiblePath);
          return possiblePath;
        } catch {
          // Continue to next path
        }
      }

      // If nothing found, return a reasonable default
      return path.join(process.cwd(), 'node_modules', '@apex', 'cli', 'dist', 'index.js');
    }
  }
}

// ============================================================================
// ServiceManager Implementation
// ============================================================================

export class ServiceManager {
  private readonly options: Required<ServiceManagerOptions>;
  private readonly platform: Platform;
  private generator: SystemdGenerator | LaunchdGenerator | WindowsServiceGenerator | null = null;
  private enableOnBoot: boolean = false;

  constructor(options: ServiceManagerOptions = {}) {
    this.platform = detectPlatform();

    // Apply defaults
    this.options = {
      projectPath: options.projectPath || process.cwd(),
      serviceName: options.serviceName || 'apex-daemon',
      serviceDescription: options.serviceDescription || 'APEX Daemon - AI Development Team Automation',
      user: options.user || process.env.USER || 'nobody',
      workingDirectory: options.workingDirectory || options.projectPath || process.cwd(),
      environment: options.environment || {},
      restartPolicy: options.restartPolicy || 'on-failure',
      restartDelaySeconds: options.restartDelaySeconds || 5,
    };

    // Initialize platform-specific generator
    this.updateGenerator();
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  setEnableOnBoot(enable: boolean): void {
    if (this.enableOnBoot !== enable) {
      this.enableOnBoot = enable;
      this.updateGenerator();
    }
  }

  private updateGenerator(): void {
    if (this.platform === 'linux') {
      this.generator = new SystemdGenerator(this.options, this.enableOnBoot);
    } else if (this.platform === 'darwin') {
      this.generator = new LaunchdGenerator(this.options, this.enableOnBoot);
    } else if (this.platform === 'win32') {
      this.generator = new WindowsServiceGenerator(this.options, this.enableOnBoot);
    } else {
      this.generator = null;
    }
  }

  // ============================================================================
  // Platform Detection
  // ============================================================================

  getPlatform(): Platform {
    return this.platform;
  }

  isSupported(): boolean {
    if (this.platform === 'linux') return isSystemdAvailable();
    if (this.platform === 'darwin') return isLaunchdAvailable();
    if (this.platform === 'win32') return isWindowsServiceAvailable();
    return false;
  }

  /**
   * Check if NSSM (Non-Sucking Service Manager) is available on Windows
   */
  isNSSMSupported(): boolean {
    return this.platform === 'win32' && isNSSMAvailable();
  }

  // ============================================================================
  // Service File Generation
  // ============================================================================

  generateServiceFile(): ServiceFileResult {
    if (!this.generator) {
      throw new ServiceError(
        `Platform ${this.platform} is not supported`,
        'PLATFORM_UNSUPPORTED'
      );
    }

    return {
      content: this.generator.generate(),
      path: this.generator.getInstallPath(),
      platform: this.platform,
    };
  }

  getServiceFilePath(): string {
    if (!this.generator) {
      throw new ServiceError(
        `Platform ${this.platform} is not supported`,
        'PLATFORM_UNSUPPORTED'
      );
    }
    return this.generator.getInstallPath();
  }

  // ============================================================================
  // Service Management Operations
  // ============================================================================

  async installService(options: InstallOptions = {}): Promise<InstallResult> {
    return this.install(options);
  }

  async uninstallService(options: UninstallOptions = {}): Promise<UninstallResult> {
    return this.uninstall(options);
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return this.getStatus();
  }

  async performHealthCheck(): Promise<{ healthy: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.isSupported()) {
      errors.push(`Service management not supported on ${this.platform}`);
      return { healthy: false, errors };
    }

    const status = await this.getStatus();
    if (!status.installed) {
      errors.push('Service not installed');
    }
    if (status.installed && !status.running) {
      errors.push('Service not running');
    }

    return { healthy: errors.length === 0, errors };
  }

  async install(options: InstallOptions = {}): Promise<InstallResult> {
    const { enableAfterInstall = false, force = false, enableOnBoot = false } = options;

    // Update enableOnBoot setting before generating service file
    this.setEnableOnBoot(enableOnBoot);
    const warnings: string[] = [];

    // 1. Platform validation
    if (!this.isSupported()) {
      throw new ServiceError(
        `Service management not available on ${this.platform}`,
        'PLATFORM_UNSUPPORTED'
      );
    }

    const serviceFile = this.generateServiceFile();

    // 2. Check for existing installation
    if (!force) {
      try {
        await fs.access(serviceFile.path);
        throw new ServiceError(
          `Service file already exists at ${serviceFile.path}. Use force: true to overwrite.`,
          'SERVICE_EXISTS'
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          if ((error as ServiceError).code === 'SERVICE_EXISTS') throw error;
        }
        // File doesn't exist, continue with installation
      }
    }

    // 3. Create directory with permission handling
    try {
      await fs.mkdir(path.dirname(serviceFile.path), { recursive: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ServiceError(
          `Permission denied creating directory ${path.dirname(serviceFile.path)}. ` +
          `For system-level installation, run with elevated privileges (sudo).`,
          'PERMISSION_DENIED',
          err
        );
      }
      throw new ServiceError('Failed to create service directory', 'INSTALL_FAILED', err);
    }

    // 4. Write service file with permission handling
    try {
      await fs.writeFile(serviceFile.path, serviceFile.content, 'utf-8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ServiceError(
          `Permission denied writing to ${serviceFile.path}. ` +
          `Check directory permissions or run with elevated privileges.`,
          'PERMISSION_DENIED',
          err
        );
      }
      throw new ServiceError('Failed to write service file', 'INSTALL_FAILED', err);
    }

    // 5. Platform-specific post-install
    let enabled = false;
    if (this.platform === 'linux') {
      try {
        await this.systemctlReload();
      } catch (error) {
        warnings.push(`Service installed but systemctl reload failed: ${(error as Error).message}`);
      }

      // For systemd, enable service if either enableAfterInstall or enableOnBoot is true
      if (enableAfterInstall || enableOnBoot) {
        try {
          await this.enable();
          enabled = true;
        } catch (error) {
          warnings.push(`Service installed but could not be enabled: ${(error as Error).message}`);
        }
      }
    } else if (this.platform === 'darwin') {
      // For launchd, enableOnBoot is controlled by RunAtLoad in the plist
      // but we still need to load the plist if enableAfterInstall is true
      if (enableAfterInstall) {
        try {
          await this.enable();
          enabled = true;
        } catch (error) {
          warnings.push(`Service installed but could not be enabled: ${(error as Error).message}`);
        }
      }
    } else if (this.platform === 'win32') {
      // For Windows, both enableAfterInstall and enableOnBoot work the same way
      // The PowerShell script handles the enableOnBoot setting internally
      if (enableAfterInstall || enableOnBoot) {
        try {
          await this.enable();
          enabled = true;
        } catch (error) {
          warnings.push(`Service installed but could not be enabled: ${(error as Error).message}`);
        }
      }
    }

    return {
      success: true,
      servicePath: serviceFile.path,
      platform: this.platform,
      enabled,
      warnings,
    };
  }

  async uninstall(options: UninstallOptions = {}): Promise<UninstallResult> {
    const { force = false, stopTimeout = 5000 } = options;
    const warnings: string[] = [];
    let wasRunning = false;

    const servicePath = this.getServiceFilePath();

    // 1. Check if service exists
    try {
      await fs.access(servicePath);
    } catch {
      throw new ServiceError(
        `Service not found at ${servicePath}`,
        'SERVICE_NOT_FOUND'
      );
    }

    // 2. Check if service is running and stop it
    try {
      const status = await this.getStatus();
      wasRunning = status.running;
      if (wasRunning) {
        await this.stopWithTimeout(stopTimeout);
      }
    } catch (error) {
      if (!force) {
        throw new ServiceError(
          `Could not stop service gracefully: ${(error as Error).message}. Use force: true to continue anyway.`,
          'UNINSTALL_FAILED',
          error as Error
        );
      } else {
        warnings.push(`Could not stop service gracefully: ${(error as Error).message}`);
      }
    }

    // 3. Disable service
    try {
      await this.disable();
    } catch (error) {
      warnings.push(`Could not disable service: ${(error as Error).message}`);
    }

    // 4. Remove service file with permission handling
    try {
      await fs.unlink(servicePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ServiceError(
          `Permission denied removing ${servicePath}. ` +
          `The service may require elevated privileges to uninstall.`,
          'PERMISSION_DENIED',
          err
        );
      }
      if (err.code !== 'ENOENT') {
        throw new ServiceError('Failed to remove service file', 'UNINSTALL_FAILED', err);
      }
    }

    // 5. Platform-specific cleanup
    if (this.platform === 'linux') {
      try {
        await this.systemctlReload();
      } catch (error) {
        warnings.push(`Could not reload systemd: ${(error as Error).message}`);
      }
    }

    return {
      success: true,
      servicePath,
      wasRunning,
      warnings,
    };
  }

  async enable(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user enable ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      // launchd services with RunAtLoad are auto-enabled
      // Just ensure the plist is loaded
      const plistPath = this.getServiceFilePath();
      await this.execCommand(`launchctl load -w ${plistPath}`);
    } else if (this.platform === 'win32') {
      // For Windows, we execute the PowerShell installation script with the -Install flag
      const scriptPath = this.getServiceFilePath();
      await this.execCommand(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Install`);
    }
  }

  /**
   * Installs Windows service directly using sc.exe when NSSM is not available
   */
  async installWindowsServiceDirect(): Promise<void> {
    if (this.platform !== 'win32') {
      throw new ServiceError('Direct Windows service install only available on Windows', 'PLATFORM_UNSUPPORTED');
    }

    const nodePath = process.execPath;
    const apexCliPath = this.findApexCliPath();

    // Create a wrapper batch script
    const wrapperScript = `@echo off
cd /d "${this.options.workingDirectory}"
set NODE_ENV=production
set APEX_PROJECT_PATH=${this.options.projectPath}
${Object.entries(this.options.environment).map(([key, value]) => `set ${key}=${value}`).join('\n')}
"${nodePath}" "${apexCliPath}" daemon start --foreground`;

    const wrapperPath = path.join(os.tmpdir(), 'apex-service-wrapper.bat');

    try {
      await fs.writeFile(wrapperPath, wrapperScript, 'utf-8');

      // Create service using sc.exe directly
      const startType = this.enableOnBoot ? 'auto' : 'demand';
      await this.execCommand(
        `sc create "${this.options.serviceName}" binPath= "\\"${wrapperPath}\\"" DisplayName= "${this.options.serviceDescription}" start= ${startType}`
      );
      await this.execCommand(`sc description "${this.options.serviceName}" "${this.options.serviceDescription}"`);

    } catch (error) {
      throw new ServiceError(
        `Failed to install Windows service directly: ${(error as Error).message}`,
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  /**
   * Uninstalls Windows service directly using sc.exe
   */
  async uninstallWindowsServiceDirect(): Promise<void> {
    if (this.platform !== 'win32') {
      throw new ServiceError('Direct Windows service uninstall only available on Windows', 'PLATFORM_UNSUPPORTED');
    }

    try {
      // Stop service if running
      try {
        await this.stop();
      } catch {
        // Ignore stop errors during uninstall
      }

      // Delete service
      await this.execCommand(`sc delete "${this.options.serviceName}"`);

      // Clean up wrapper script
      const wrapperPath = path.join(os.tmpdir(), 'apex-service-wrapper.bat');
      try {
        await fs.unlink(wrapperPath);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      throw new ServiceError(
        `Failed to uninstall Windows service: ${(error as Error).message}`,
        'UNINSTALL_FAILED',
        error as Error
      );
    }
  }

  private findApexCliPath(): string {
    try {
      return require.resolve('@apex/cli/dist/index.js');
    } catch {
      // Fallback to checking common locations
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js'),
        path.join(process.cwd(), 'packages/cli/dist/index.js'),
        '/usr/local/lib/node_modules/@apex/cli/dist/index.js',
      ];

      for (const possiblePath of possiblePaths) {
        try {
          require('fs').accessSync(possiblePath);
          return possiblePath;
        } catch {
          // Continue to next path
        }
      }

      // If nothing found, return a reasonable default
      return path.join(process.cwd(), 'node_modules/@apex/cli/dist/index.js');
    }
  }

  async disable(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user disable ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const plistPath = this.getServiceFilePath();
      await this.execCommand(`launchctl unload -w ${plistPath}`);
    } else if (this.platform === 'win32') {
      // For Windows, we execute the PowerShell script with the -Uninstall flag
      const scriptPath = this.getServiceFilePath();
      await this.execCommand(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Uninstall`);
    }
  }

  async start(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user start ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const label = `com.apex.${this.options.serviceName.replace('apex-', '')}`;
      await this.execCommand(`launchctl start ${label}`);
    } else if (this.platform === 'win32') {
      await this.execCommand(`sc start "${this.options.serviceName}"`);
    }
  }

  async stop(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user stop ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const label = `com.apex.${this.options.serviceName.replace('apex-', '')}`;
      await this.execCommand(`launchctl stop ${label}`);
    } else if (this.platform === 'win32') {
      await this.execCommand(`sc stop "${this.options.serviceName}"`);
    }
  }

  async restart(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user restart ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      await this.stop();
      await this.start();
    } else if (this.platform === 'win32') {
      await this.stop();
      await this.start();
    }
  }

  async getStatus(): Promise<ServiceStatus> {
    const servicePath = this.getServiceFilePath();
    let installed = false;

    try {
      await fs.access(servicePath);
      installed = true;
    } catch {
      installed = false;
    }

    if (!installed) {
      return {
        installed: false,
        enabled: false,
        running: false,
        platform: this.platform,
      };
    }

    if (this.platform === 'linux') {
      return this.getSystemdStatus(servicePath);
    } else if (this.platform === 'darwin') {
      return this.getLaunchdStatus(servicePath);
    } else if (this.platform === 'win32') {
      return this.getWindowsStatus(servicePath);
    }

    return {
      installed,
      enabled: false,
      running: false,
      platform: this.platform,
      servicePath,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async systemctlReload(): Promise<void> {
    await this.execCommand('systemctl --user daemon-reload');
  }

  /**
   * Stop service with timeout for graceful shutdown
   */
  private async stopWithTimeout(timeoutMs: number): Promise<void> {
    const stopPromise = this.stop();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Stop timeout exceeded')), timeoutMs);
    });
    await Promise.race([stopPromise, timeoutPromise]);
  }

  private async getSystemdStatus(servicePath: string): Promise<ServiceStatus> {
    try {
      const { stdout } = await execPromise(
        `systemctl --user show ${this.options.serviceName} --property=ActiveState,SubState,MainPID,LoadState`
      );

      const props = this.parseSystemdProperties(stdout);

      return {
        installed: true,
        enabled: props.LoadState === 'loaded',
        running: props.ActiveState === 'active',
        pid: props.MainPID && props.MainPID !== '0' ? parseInt(props.MainPID, 10) : undefined,
        platform: this.platform,
        servicePath,
      };
    } catch {
      return {
        installed: true,
        enabled: false,
        running: false,
        platform: this.platform,
        servicePath,
      };
    }
  }

  private async getLaunchdStatus(servicePath: string): Promise<ServiceStatus> {
    try {
      const label = `com.apex.${this.options.serviceName.replace('apex-', '')}`;
      const { stdout } = await execPromise(`launchctl list | grep ${label}`);

      // launchctl list format: PID Status Label
      const parts = stdout.trim().split(/\s+/);
      const pid = parts[0] !== '-' ? parseInt(parts[0], 10) : undefined;
      const running = pid !== undefined && pid > 0;

      return {
        installed: true,
        enabled: true, // If plist exists and launchctl knows about it
        running,
        pid,
        platform: this.platform,
        servicePath,
      };
    } catch {
      return {
        installed: true,
        enabled: false,
        running: false,
        platform: this.platform,
        servicePath,
      };
    }
  }

  private async getWindowsStatus(servicePath: string): Promise<ServiceStatus> {
    try {
      const { stdout } = await execPromise(`sc query "${this.options.serviceName}"`);

      // Parse sc query output
      const running = stdout.includes('RUNNING');
      const stopped = stdout.includes('STOPPED');
      const startPending = stdout.includes('START_PENDING');
      const stopPending = stdout.includes('STOP_PENDING');

      // Check if service is set to auto-start (enabled)
      let enabled = false;
      try {
        const { stdout: configOutput } = await execPromise(`sc qc "${this.options.serviceName}"`);
        enabled = configOutput.includes('AUTO_START') || configOutput.includes('DEMAND_START');
      } catch {
        // If we can't get config, assume not enabled
        enabled = false;
      }

      // Try to get PID if running
      let pid: number | undefined;
      if (running || startPending) {
        try {
          // Try wmic first
          const { stdout: processOutput } = await execPromise(
            `wmic service where "name='${this.options.serviceName}'" get ProcessId /value`
          );
          const pidMatch = processOutput.match(/ProcessId=(\d+)/);
          if (pidMatch) {
            pid = parseInt(pidMatch[1], 10);
            if (pid === 0) pid = undefined; // Service not actually running if PID is 0
          }
        } catch {
          // Try PowerShell as fallback
          try {
            const { stdout: psOutput } = await execPromise(
              `powershell.exe -Command "Get-WmiObject -Class Win32_Service -Filter \\"Name='${this.options.serviceName}'\\" | Select-Object ProcessId"`
            );
            const psMatch = psOutput.match(/(\d+)/);
            if (psMatch) {
              pid = parseInt(psMatch[1], 10);
              if (pid === 0) pid = undefined;
            }
          } catch {
            // PID detection failed completely, continue without it
          }
        }
      }

      return {
        installed: true,
        enabled,
        running: running && !stopPending,
        pid,
        platform: this.platform,
        servicePath,
      };
    } catch (error) {
      const err = error as Error & { stderr?: string };
      // If service doesn't exist, we would have thrown a more specific error earlier
      // This catch is for other unexpected errors
      if (err.stderr?.includes('The specified service does not exist')) {
        return {
          installed: false,
          enabled: false,
          running: false,
          platform: this.platform,
        };
      }

      return {
        installed: true,
        enabled: false,
        running: false,
        platform: this.platform,
        servicePath,
      };
    }
  }

  private parseSystemdProperties(output: string): Record<string, string> {
    const props: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const [key, value] = line.split('=');
      if (key && value) {
        props[key.trim()] = value.trim();
      }
    }
    return props;
  }

  private async execCommand(command: string): Promise<void> {
    try {
      await execPromise(command);
    } catch (error) {
      const err = error as Error & { stderr?: string };
      const errorMessage = err.stderr || err.message;

      // Provide more specific error codes based on the command and error
      let errorCode: ServiceErrorCode = 'PERMISSION_DENIED';

      if (this.platform === 'win32') {
        // Windows-specific error handling
        if (command.includes('sc query') || command.includes('sc qc')) {
          if (errorMessage.includes('The specified service does not exist')) {
            errorCode = 'SERVICE_NOT_FOUND';
          } else if (errorMessage.includes('Access is denied')) {
            errorCode = 'PERMISSION_DENIED';
          }
        } else if (command.includes('sc start')) {
          if (errorMessage.includes('service is already running') || errorMessage.includes('already started')) {
            // Service already running - this could be considered success
            return; // Don't throw error for already running service
          } else if (errorMessage.includes('The specified service does not exist')) {
            errorCode = 'SERVICE_NOT_FOUND';
          }
        } else if (command.includes('sc stop')) {
          if (errorMessage.includes('service is not started') || errorMessage.includes('not running')) {
            // Service already stopped - this could be considered success
            return; // Don't throw error for already stopped service
          } else if (errorMessage.includes('The specified service does not exist')) {
            errorCode = 'SERVICE_NOT_FOUND';
          }
        } else if (command.includes('powershell') && command.includes('-Install')) {
          if (errorMessage.includes('already exists')) {
            errorCode = 'SERVICE_EXISTS';
          } else if (errorMessage.includes('Access is denied')) {
            errorCode = 'PERMISSION_DENIED';
          } else {
            errorCode = 'INSTALL_FAILED';
          }
        } else if (command.includes('powershell') && command.includes('-Uninstall')) {
          errorCode = 'UNINSTALL_FAILED';
        }
      }

      throw new ServiceError(
        errorMessage,
        errorCode,
        err
      );
    }
  }
}
