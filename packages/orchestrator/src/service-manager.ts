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
  constructor(private readonly options: Required<ServiceManagerOptions>) {}

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
  constructor(private readonly options: Required<ServiceManagerOptions>) {}

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
      RunAtLoad: true,
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
  private readonly generator: SystemdGenerator | LaunchdGenerator | null;

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
    if (this.platform === 'linux') {
      this.generator = new SystemdGenerator(this.options);
    } else if (this.platform === 'darwin') {
      this.generator = new LaunchdGenerator(this.options);
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

  async install(): Promise<void> {
    if (!this.isSupported()) {
      throw new ServiceError(
        `Service management not available on ${this.platform}`,
        'PLATFORM_UNSUPPORTED'
      );
    }

    const serviceFile = this.generateServiceFile();

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(serviceFile.path), { recursive: true });

      // Write service file
      await fs.writeFile(serviceFile.path, serviceFile.content, 'utf-8');

      // Platform-specific post-install
      if (this.platform === 'linux') {
        await this.systemctlReload();
      }
      // launchd doesn't require explicit reload

    } catch (error) {
      throw new ServiceError(
        'Failed to install service',
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  async uninstall(): Promise<void> {
    try {
      // Stop service first (ignore errors if not running)
      await this.stop().catch(() => {});

      // Disable service (ignore errors if not enabled)
      await this.disable().catch(() => {});

      // Remove service file
      const servicePath = this.getServiceFilePath();
      await fs.unlink(servicePath).catch(() => {});

      // Platform-specific cleanup
      if (this.platform === 'linux') {
        await this.systemctlReload();
      }

    } catch (error) {
      throw new ServiceError(
        'Failed to uninstall service',
        'UNINSTALL_FAILED',
        error as Error
      );
    }
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