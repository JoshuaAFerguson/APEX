# ADR-054: ServiceManager - Platform-Specific Service File Generation

## Status
Proposed

## Context

APEX needs to support running the daemon as a proper system service that:
1. Starts automatically on system boot
2. Restarts on failure
3. Integrates with platform-native service management tools
4. Provides consistent management interface across platforms

Currently, `DaemonManager` handles foreground/background process management, but there's no mechanism to:
- Generate platform-specific service configuration files
- Install/uninstall services via systemd (Linux) or launchd (macOS)
- Detect the current platform and use appropriate service format

A `ServiceManager` class is needed to:
1. Detect the current platform (Linux/macOS)
2. Generate systemd unit files on Linux
3. Generate launchd plist files on macOS
4. Provide install/uninstall/enable/disable operations
5. Query service status via native service managers

## Decision

### Architecture Overview

Create a `ServiceManager` class in `packages/orchestrator/src/service-manager.ts` that abstracts platform-specific service management with a unified API.

### Class Hierarchy

```
ServiceManager (public API)
    ├── PlatformDetector (static utility)
    ├── SystemdGenerator (Linux)
    └── LaunchdGenerator (macOS)
```

### Platform Detection Strategy

```typescript
export type Platform = 'linux' | 'darwin' | 'unsupported';

export function detectPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'darwin';
  return 'unsupported';
}

export function isSystemdAvailable(): boolean {
  // Check if systemctl exists and is functional
  try {
    execSync('systemctl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isLaunchdAvailable(): boolean {
  // macOS always has launchd if platform is darwin
  return process.platform === 'darwin';
}
```

### Core Interfaces

```typescript
// ============================================================================
// Types and Interfaces
// ============================================================================

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
```

### ServiceManager Class Interface

```typescript
export class ServiceManager {
  private readonly options: Required<ServiceManagerOptions>;
  private readonly platform: Platform;

  constructor(options: ServiceManagerOptions = {});

  // ============================================================================
  // Platform Detection
  // ============================================================================

  /** Get the detected platform */
  getPlatform(): Platform;

  /** Check if service management is supported on this platform */
  isSupported(): boolean;

  // ============================================================================
  // Service File Generation
  // ============================================================================

  /** Generate service file content without installing */
  generateServiceFile(): ServiceFileResult;

  /** Get the path where the service file would be installed */
  getServiceFilePath(): string;

  // ============================================================================
  // Service Management Operations
  // ============================================================================

  /** Install the service (generates file and registers with system) */
  install(): Promise<void>;

  /** Uninstall the service (stops, disables, removes file) */
  uninstall(): Promise<void>;

  /** Enable service to start on boot */
  enable(): Promise<void>;

  /** Disable service from starting on boot */
  disable(): Promise<void>;

  /** Start the service via system service manager */
  start(): Promise<void>;

  /** Stop the service via system service manager */
  stop(): Promise<void>;

  /** Restart the service */
  restart(): Promise<void>;

  /** Get current service status */
  getStatus(): Promise<ServiceStatus>;
}
```

### Systemd Unit File Generation (Linux)

The generated systemd unit file follows best practices:

```ini
[Unit]
Description=APEX Daemon - AI Development Team Automation
Documentation=https://github.com/your-org/apex
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=%USER%
Group=%GROUP%
WorkingDirectory=%WORKING_DIR%
ExecStart=%NODE_PATH% %APEX_CLI_PATH% daemon start --foreground
ExecStop=%NODE_PATH% %APEX_CLI_PATH% daemon stop
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=apex-daemon

# Environment
Environment=NODE_ENV=production
Environment=APEX_PROJECT_PATH=%PROJECT_PATH%
%ADDITIONAL_ENV%

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=%PROJECT_PATH%/.apex

[Install]
WantedBy=multi-user.target
```

**Generator Implementation:**

```typescript
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
    return require.resolve('@apex/cli/dist/index.js');
  }
}
```

### Launchd Plist Generation (macOS)

The generated plist follows Apple's launchd best practices:

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
        <string>/path/to/apex/cli/dist/index.js</string>
        <string>daemon</string>
        <string>start</string>
        <string>--foreground</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/path/to/project</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>APEX_PROJECT_PATH</key>
        <string>/path/to/project</string>
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
    <string>/path/to/project/.apex/daemon.out.log</string>

    <key>StandardErrorPath</key>
    <string>/path/to/project/.apex/daemon.err.log</string>
</dict>
</plist>
```

**Generator Implementation:**

```typescript
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

  private buildKeepAlive(): Record<string, unknown> {
    switch (this.options.restartPolicy) {
      case 'always':
        return { SuccessfulExit: false, Crashed: true };
      case 'on-failure':
        return { SuccessfulExit: false };
      case 'never':
        return false as unknown as Record<string, unknown>;
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
    return require.resolve('@apex/cli/dist/index.js');
  }
}
```

### ServiceManager Implementation

```typescript
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
        pid: props.MainPID ? parseInt(props.MainPID, 10) : undefined,
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

const execPromise = promisify(exec);
```

### File Structure

```
packages/orchestrator/src/
├── service-manager.ts            # Main ServiceManager class + generators
├── service-manager.test.ts       # Unit tests
└── index.ts                      # Export ServiceManager

packages/core/src/
└── types.ts                      # Add ServiceManagerConfig schema (optional)
```

### Integration with Existing Code

**Export from orchestrator package** (`index.ts`):

```typescript
export {
  ServiceManager,
  ServiceError,
  detectPlatform,
  isSystemdAvailable,
  isLaunchdAvailable,
  type ServiceManagerOptions,
  type ServiceStatus,
  type ServiceFileResult,
  type ServiceErrorCode,
  type Platform,
} from './service-manager';
```

**Relationship with DaemonManager**:

```
User → CLI → ServiceManager (install/enable/start as system service)
                    ↓
            Native Service Manager (systemd/launchd)
                    ↓
            DaemonRunner (--foreground mode)
                    ↓
            ApexOrchestrator → TaskStore
```

- `ServiceManager` installs service files and delegates to OS service manager
- The service file runs `apex daemon start --foreground`
- `DaemonManager` is still used for ad-hoc daemon start/stop
- Both can coexist - service manager for boot-time, daemon manager for CLI

### Test Strategy

**Unit Tests** (`service-manager.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceManager, SystemdGenerator, LaunchdGenerator } from './service-manager';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';

// Mock platform detection
vi.mock('process', async () => {
  const actual = await vi.importActual('process');
  return { ...actual, platform: 'linux' };
});

describe('ServiceManager', () => {
  describe('Platform Detection', () => {
    it('should detect Linux platform', () => {
      const manager = new ServiceManager({ projectPath: '/test' });
      expect(manager.getPlatform()).toBe('linux');
    });
  });

  describe('SystemdGenerator', () => {
    it('should generate valid systemd unit file', () => {
      const generator = new SystemdGenerator({
        projectPath: '/home/user/project',
        serviceName: 'apex-daemon',
        serviceDescription: 'Test Service',
        user: 'testuser',
        workingDirectory: '/home/user/project',
        environment: { FOO: 'bar' },
        restartPolicy: 'on-failure',
        restartDelaySeconds: 5,
      });

      const content = generator.generate();

      expect(content).toContain('[Unit]');
      expect(content).toContain('[Service]');
      expect(content).toContain('[Install]');
      expect(content).toContain('User=testuser');
      expect(content).toContain('Restart=on-failure');
      expect(content).toContain('Environment=FOO=bar');
    });

    it('should use user-level path for non-root', () => {
      const generator = new SystemdGenerator({...defaultOptions});
      const path = generator.getInstallPath();
      expect(path).toContain('.config/systemd/user');
    });
  });

  describe('LaunchdGenerator', () => {
    it('should generate valid plist XML', () => {
      const generator = new LaunchdGenerator({
        projectPath: '/Users/user/project',
        serviceName: 'apex-daemon',
        serviceDescription: 'Test Service',
        user: 'testuser',
        workingDirectory: '/Users/user/project',
        environment: { FOO: 'bar' },
        restartPolicy: 'on-failure',
        restartDelaySeconds: 5,
      });

      const content = generator.generate();

      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<!DOCTYPE plist');
      expect(content).toContain('<key>Label</key>');
      expect(content).toContain('<string>com.apex.daemon</string>');
      expect(content).toContain('<key>KeepAlive</key>');
    });

    it('should use LaunchAgents path', () => {
      const generator = new LaunchdGenerator({...defaultOptions});
      const path = generator.getInstallPath();
      expect(path).toContain('Library/LaunchAgents');
    });
  });

  describe('Service Operations', () => {
    it('should install service file', async () => {
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(child_process, 'exec').mockImplementation((cmd, cb) => {
        (cb as Function)(null, '', '');
        return {} as any;
      });

      const manager = new ServiceManager({ projectPath: '/test' });
      await expect(manager.install()).resolves.not.toThrow();
    });
  });
});
```

## Consequences

### Positive
- Native OS integration for production deployments
- Automatic restart on failure via OS service manager
- Boot-time start capability
- Consistent API across Linux and macOS
- Clean separation from ad-hoc DaemonManager usage
- Security hardening via systemd sandboxing

### Negative
- Platform-specific code paths increase complexity
- Windows not supported (would need Windows Service API)
- Root/sudo may be required for system-level installation
- Two ways to manage daemon (ServiceManager vs DaemonManager) may confuse users

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Platform detection fails | Fall back to process.platform, comprehensive error messages |
| Service file syntax errors | Validate generated content, provide dry-run mode |
| Permission issues | Support user-level services (systemd --user, ~/Library/LaunchAgents) |
| Path resolution fails | Use absolute paths, validate paths exist |
| launchctl/systemctl not in PATH | Use full paths to binaries if needed |

## Implementation Plan

1. **Phase 1: Core Classes** (Developer Stage)
   - Create `service-manager.ts` with platform detection
   - Implement `SystemdGenerator` class
   - Implement `LaunchdGenerator` class
   - Unit tests for generators

2. **Phase 2: ServiceManager Operations** (Developer Stage)
   - Implement install/uninstall operations
   - Implement enable/disable operations
   - Implement start/stop/restart operations
   - Implement getStatus()

3. **Phase 3: Integration** (Developer Stage)
   - Export from orchestrator package
   - Add CLI commands: `apex service install/uninstall/status`

4. **Phase 4: Testing** (Tester Stage)
   - Unit tests for all public methods
   - Integration tests with mocked exec
   - Platform-specific test variants

## References

- [systemd Service Unit](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [launchd plist Format](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Existing DaemonManager ADR](./ADR-051-daemon-process-manager.md)
