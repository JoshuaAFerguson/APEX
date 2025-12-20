import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

export type Platform = 'linux' | 'darwin' | 'unsupported';

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
    const homeDir = process.env.HOME || '/tmp';
    return `${homeDir}/.config/systemd/user/${this.options.serviceName}.service`;
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
    const homeDir = process.env.HOME || '/tmp';
    return `${homeDir}/Library/LaunchAgents/${this.getLaunchdLabel()}.plist`;
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
// ServiceManager Implementation
// ============================================================================

export class ServiceManager {
  private readonly options: Required<ServiceManagerOptions>;
  private readonly platform: Platform;
  private generator: SystemdGenerator | LaunchdGenerator | null = null;
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
    return false;
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
    }
  }

  async disable(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user disable ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const plistPath = this.getServiceFilePath();
      await this.execCommand(`launchctl unload -w ${plistPath}`);
    }
  }

  async start(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user start ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const label = `com.apex.${this.options.serviceName.replace('apex-', '')}`;
      await this.execCommand(`launchctl start ${label}`);
    }
  }

  async stop(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user stop ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
      const label = `com.apex.${this.options.serviceName.replace('apex-', '')}`;
      await this.execCommand(`launchctl stop ${label}`);
    }
  }

  async restart(): Promise<void> {
    if (this.platform === 'linux') {
      await this.execCommand(`systemctl --user restart ${this.options.serviceName}`);
    } else if (this.platform === 'darwin') {
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
      throw new ServiceError(
        err.stderr || err.message,
        'PERMISSION_DENIED',
        err
      );
    }
  }
}
