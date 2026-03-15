/**
 * Windows Service Management Module
 *
 * Provides native Windows service integration for APEX daemon using:
 * - Service Control Manager (sc.exe) for basic service operations
 * - NSSM (Non-Sucking Service Manager) for enhanced service features (optional)
 * - PowerShell for complex configurations and Event Log integration
 *
 * Part of ADR-0005: Windows Service Management Architecture
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface WindowsServiceConfig {
  /** Windows service name (no spaces, alphanumeric + hyphens only) */
  serviceName: string;
  /** Display name shown in Services console */
  displayName: string;
  /** Service description */
  description: string;
  /** Path to the executable (Node.js path) */
  executablePath: string;
  /** Command line arguments for the executable */
  arguments: string[];
  /** Working directory for the service */
  workingDirectory: string;
  /** Environment variables for the service */
  environment: Record<string, string>;
  /** Service startup type */
  startType: 'auto' | 'demand' | 'disabled';
  /** Service dependencies (optional) */
  dependencies?: string[];
  /** Recovery options for service failures */
  recoveryOptions?: ServiceRecoveryOptions;
}

export interface ServiceRecoveryOptions {
  /** Action on first failure */
  firstFailure: 'restart' | 'none' | 'run-command';
  /** Action on second failure */
  secondFailure: 'restart' | 'none' | 'run-command';
  /** Action on subsequent failures */
  subsequentFailures: 'restart' | 'none' | 'run-command';
  /** Reset period in days */
  resetPeriodDays: number;
  /** Restart delay in milliseconds */
  restartDelayMs: number;
  /** Command to run on failure (if action is 'run-command') */
  failureCommand?: string;
}

export interface WindowsServiceStatus {
  /** Whether service is installed in Service Control Manager */
  installed: boolean;
  /** Current service state */
  state: 'running' | 'stopped' | 'start_pending' | 'stop_pending' | 'paused' | 'unknown';
  /** Process ID if running */
  pid?: number;
  /** Exit code if stopped */
  exitCode?: number;
  /** Service uptime in milliseconds */
  uptime?: number;
  /** Service startup type */
  startType: 'auto' | 'demand' | 'disabled';
  /** Whether service is using NSSM wrapper */
  usingNSSM?: boolean;
}

export interface InstallResult {
  /** Whether installation was successful */
  success: boolean;
  /** Method used for installation */
  method: 'nssm' | 'sc.exe' | 'node-windows';
  /** Service name that was installed */
  serviceName: string;
  /** Any warnings encountered during installation */
  warnings: string[];
  /** Path to wrapper script (if applicable) */
  wrapperScriptPath?: string;
}

export interface UninstallOptions {
  /** Force uninstall even if service stop fails */
  force?: boolean;
  /** Timeout for graceful service stop in milliseconds */
  stopTimeout?: number;
  /** Remove wrapper scripts and temporary files */
  cleanup?: boolean;
}

export type WindowsServiceErrorCode =
  | 'SERVICE_EXISTS'
  | 'SERVICE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INSTALL_FAILED'
  | 'UNINSTALL_FAILED'
  | 'START_FAILED'
  | 'STOP_FAILED'
  | 'NSSM_NOT_AVAILABLE'
  | 'ELEVATION_REQUIRED';

export class WindowsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: WindowsServiceErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WindowsServiceError';
  }
}

// ============================================================================
// Windows Service Manager Implementation
// ============================================================================

export class WindowsServiceManager {
  private readonly isWindows: boolean;

  constructor() {
    this.isWindows = process.platform === 'win32';
  }

  // ============================================================================
  // Platform and Capability Detection
  // ============================================================================

  /**
   * Check if running on Windows platform
   */
  isWindowsPlatform(): boolean {
    return this.isWindows;
  }

  /**
   * Check if NSSM is available and functional
   */
  async isNSSMAvailable(): Promise<boolean> {
    if (!this.isWindows) return false;

    try {
      await execAsync('nssm version', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if current process has administrator privileges
   */
  async isElevated(): Promise<boolean> {
    if (!this.isWindows) return false;

    try {
      // Try to access a system directory that requires admin rights
      const { stdout } = await execAsync(
        'net session 2>nul && echo elevated || echo not-elevated',
        { timeout: 3000 }
      );
      return stdout.trim().includes('elevated');
    } catch {
      return false;
    }
  }

  /**
   * Prompt user to restart with elevated privileges
   */
  async requestElevation(): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Elevation request only available on Windows',
        'PERMISSION_DENIED'
      );
    }

    throw new WindowsServiceError(
      'Administrator privileges required. Please restart as Administrator.',
      'ELEVATION_REQUIRED'
    );
  }

  // ============================================================================
  // Service Lifecycle Management
  // ============================================================================

  /**
   * Install Windows service with best available method
   */
  async install(config: WindowsServiceConfig): Promise<InstallResult> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service installation only available on Windows',
        'INSTALL_FAILED'
      );
    }

    // Check if elevated
    const elevated = await this.isElevated();
    if (!elevated) {
      throw new WindowsServiceError(
        'Administrator privileges required to install Windows services',
        'ELEVATION_REQUIRED'
      );
    }

    // Check if service already exists
    const status = await this.getStatus(config.serviceName);
    if (status.installed) {
      throw new WindowsServiceError(
        `Service '${config.serviceName}' already exists`,
        'SERVICE_EXISTS'
      );
    }

    // Try NSSM first (preferred method)
    if (await this.isNSSMAvailable()) {
      return await this.installWithNSSM(config);
    }

    // Fallback to sc.exe
    return await this.installWithSC(config);
  }

  /**
   * Uninstall Windows service
   */
  async uninstall(serviceName: string, options: UninstallOptions = {}): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service uninstallation only available on Windows',
        'UNINSTALL_FAILED'
      );
    }

    const { force = false, stopTimeout = 30000, cleanup = true } = options;

    // Check if elevated
    const elevated = await this.isElevated();
    if (!elevated) {
      throw new WindowsServiceError(
        'Administrator privileges required to uninstall Windows services',
        'ELEVATION_REQUIRED'
      );
    }

    // Check if service exists
    const status = await this.getStatus(serviceName);
    if (!status.installed) {
      throw new WindowsServiceError(
        `Service '${serviceName}' not found`,
        'SERVICE_NOT_FOUND'
      );
    }

    // Stop service if running
    if (status.state === 'running' || status.state === 'start_pending') {
      try {
        await this.stop(serviceName, stopTimeout);
      } catch (error) {
        if (!force) {
          throw new WindowsServiceError(
            `Failed to stop service '${serviceName}': ${(error as Error).message}`,
            'STOP_FAILED',
            error as Error
          );
        }
        // Continue with forced uninstall
      }
    }

    // Remove service
    try {
      if (status.usingNSSM && await this.isNSSMAvailable()) {
        await execAsync(`nssm remove "${serviceName}" confirm`, { timeout: 10000 });
      } else {
        await execAsync(`sc delete "${serviceName}"`, { timeout: 10000 });
      }

      // Cleanup wrapper scripts if requested
      if (cleanup) {
        await this.cleanupWrapperScript(serviceName);
      }
    } catch (error) {
      throw new WindowsServiceError(
        `Failed to uninstall service '${serviceName}': ${(error as Error).message}`,
        'UNINSTALL_FAILED',
        error as Error
      );
    }
  }

  /**
   * Start Windows service
   */
  async start(serviceName: string): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service start only available on Windows',
        'START_FAILED'
      );
    }

    try {
      await execAsync(`sc start "${serviceName}"`, { timeout: 30000 });
    } catch (error) {
      const err = error as Error & { stderr?: string };

      // Check for already running
      if (err.stderr?.includes('already running') || err.stderr?.includes('1056')) {
        return; // Service already running, consider success
      }

      throw new WindowsServiceError(
        `Failed to start service '${serviceName}': ${err.message}`,
        'START_FAILED',
        err
      );
    }
  }

  /**
   * Stop Windows service
   */
  async stop(serviceName: string, timeout: number = 30000): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service stop only available on Windows',
        'STOP_FAILED'
      );
    }

    try {
      await execAsync(`sc stop "${serviceName}"`, { timeout });
    } catch (error) {
      const err = error as Error & { stderr?: string };

      // Check for already stopped
      if (err.stderr?.includes('not running') || err.stderr?.includes('1062')) {
        return; // Service already stopped, consider success
      }

      throw new WindowsServiceError(
        `Failed to stop service '${serviceName}': ${err.message}`,
        'STOP_FAILED',
        err
      );
    }
  }

  /**
   * Restart Windows service
   */
  async restart(serviceName: string): Promise<void> {
    await this.stop(serviceName);

    // Wait a moment for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.start(serviceName);
  }

  // ============================================================================
  // Service Status and Configuration
  // ============================================================================

  /**
   * Get Windows service status
   */
  async getStatus(serviceName: string): Promise<WindowsServiceStatus> {
    if (!this.isWindows) {
      return {
        installed: false,
        state: 'unknown',
        startType: 'disabled'
      };
    }

    try {
      // Query service state
      const { stdout } = await execAsync(`sc query "${serviceName}"`, { timeout: 10000 });

      const state = this.parseServiceState(stdout);
      const pid = await this.getServicePID(serviceName, state);
      const startType = await this.getServiceStartType(serviceName);
      const usingNSSM = await this.checkIfUsingNSSM(serviceName);

      return {
        installed: true,
        state,
        pid,
        startType,
        usingNSSM
      };
    } catch (error) {
      const err = error as Error & { stderr?: string };

      if (err.stderr?.includes('does not exist') || err.stderr?.includes('1060')) {
        return {
          installed: false,
          state: 'unknown',
          startType: 'disabled'
        };
      }

      // Service exists but query failed
      return {
        installed: true,
        state: 'unknown',
        startType: 'disabled'
      };
    }
  }

  /**
   * Set service startup type
   */
  async setStartType(serviceName: string, startType: 'auto' | 'demand' | 'disabled'): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service configuration only available on Windows',
        'INSTALL_FAILED'
      );
    }

    const elevated = await this.isElevated();
    if (!elevated) {
      throw new WindowsServiceError(
        'Administrator privileges required to configure Windows services',
        'ELEVATION_REQUIRED'
      );
    }

    try {
      await execAsync(`sc config "${serviceName}" start= ${startType}`, { timeout: 10000 });
    } catch (error) {
      throw new WindowsServiceError(
        `Failed to set start type for service '${serviceName}': ${(error as Error).message}`,
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  /**
   * Configure service recovery options
   */
  async configureRecovery(serviceName: string, options: ServiceRecoveryOptions): Promise<void> {
    if (!this.isWindows) {
      throw new WindowsServiceError(
        'Windows service recovery configuration only available on Windows',
        'INSTALL_FAILED'
      );
    }

    const elevated = await this.isElevated();
    if (!elevated) {
      throw new WindowsServiceError(
        'Administrator privileges required to configure Windows services',
        'ELEVATION_REQUIRED'
      );
    }

    try {
      const actions = [
        this.mapRecoveryAction(options.firstFailure),
        this.mapRecoveryAction(options.secondFailure),
        this.mapRecoveryAction(options.subsequentFailures)
      ].join('/');

      const delays = [
        options.restartDelayMs.toString(),
        options.restartDelayMs.toString(),
        options.restartDelayMs.toString()
      ].join('/');

      await execAsync(
        `sc failure "${serviceName}" reset= ${options.resetPeriodDays * 24 * 3600} actions= ${actions} delay= ${delays}`,
        { timeout: 10000 }
      );
    } catch (error) {
      throw new WindowsServiceError(
        `Failed to configure recovery for service '${serviceName}': ${(error as Error).message}`,
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Install service using NSSM (preferred method)
   */
  private async installWithNSSM(config: WindowsServiceConfig): Promise<InstallResult> {
    const warnings: string[] = [];

    try {
      // Create service with NSSM
      const args = config.arguments.join(' ');
      await execAsync(`nssm install "${config.serviceName}" "${config.executablePath}" ${args}`, { timeout: 15000 });

      // Configure basic properties
      await execAsync(`nssm set "${config.serviceName}" DisplayName "${config.displayName}"`, { timeout: 5000 });
      await execAsync(`nssm set "${config.serviceName}" Description "${config.description}"`, { timeout: 5000 });
      await execAsync(`nssm set "${config.serviceName}" AppDirectory "${config.workingDirectory}"`, { timeout: 5000 });

      // Set startup type
      const nssmStartType = this.mapStartTypeToNSSM(config.startType);
      await execAsync(`nssm set "${config.serviceName}" Start ${nssmStartType}`, { timeout: 5000 });

      // Configure environment variables
      if (Object.keys(config.environment).length > 0) {
        const envVars = Object.entries(config.environment)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ');
        try {
          await execAsync(`nssm set "${config.serviceName}" AppEnvironmentExtra "${envVars}"`, { timeout: 5000 });
        } catch (error) {
          warnings.push(`Failed to set environment variables: ${(error as Error).message}`);
        }
      }

      // Configure recovery options if provided
      if (config.recoveryOptions) {
        try {
          await execAsync(`nssm set "${config.serviceName}" AppExit Default Restart`, { timeout: 5000 });
          await execAsync(`nssm set "${config.serviceName}" AppRestartDelay ${config.recoveryOptions.restartDelayMs}`, { timeout: 5000 });
        } catch (error) {
          warnings.push(`Failed to configure recovery options: ${(error as Error).message}`);
        }
      }

      // Configure logging
      try {
        const logDir = path.join(config.workingDirectory, '.apex');
        await fs.mkdir(logDir, { recursive: true });

        const stdoutLog = path.join(logDir, 'service.out.log');
        const stderrLog = path.join(logDir, 'service.err.log');

        await execAsync(`nssm set "${config.serviceName}" AppStdout "${stdoutLog}"`, { timeout: 5000 });
        await execAsync(`nssm set "${config.serviceName}" AppStderr "${stderrLog}"`, { timeout: 5000 });
      } catch (error) {
        warnings.push(`Failed to configure logging: ${(error as Error).message}`);
      }

      return {
        success: true,
        method: 'nssm',
        serviceName: config.serviceName,
        warnings
      };
    } catch (error) {
      throw new WindowsServiceError(
        `NSSM installation failed: ${(error as Error).message}`,
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  /**
   * Install service using sc.exe with wrapper script
   */
  private async installWithSC(config: WindowsServiceConfig): Promise<InstallResult> {
    const warnings: string[] = [
      'Using basic Windows service installation. Consider installing NSSM for better service management.'
    ];

    try {
      // Create wrapper batch script
      const wrapperScript = this.generateWrapperScript(config);
      const wrapperPath = path.join(os.tmpdir(), `${config.serviceName}-wrapper.bat`);

      await fs.writeFile(wrapperPath, wrapperScript, 'utf-8');

      // Create service
      const startType = config.startType === 'auto' ? 'auto' : 'demand';
      await execAsync(
        `sc create "${config.serviceName}" binPath= "\\"${wrapperPath}\\"" DisplayName= "${config.displayName}" start= ${startType}`,
        { timeout: 15000 }
      );

      // Set description
      await execAsync(`sc description "${config.serviceName}" "${config.description}"`, { timeout: 5000 });

      // Configure recovery options if provided
      if (config.recoveryOptions) {
        try {
          await this.configureRecovery(config.serviceName, config.recoveryOptions);
        } catch (error) {
          warnings.push(`Failed to configure recovery options: ${(error as Error).message}`);
        }
      }

      return {
        success: true,
        method: 'sc.exe',
        serviceName: config.serviceName,
        warnings,
        wrapperScriptPath: wrapperPath
      };
    } catch (error) {
      throw new WindowsServiceError(
        `Service installation failed: ${(error as Error).message}`,
        'INSTALL_FAILED',
        error as Error
      );
    }
  }

  /**
   * Generate wrapper batch script for sc.exe method
   */
  private generateWrapperScript(config: WindowsServiceConfig): string {
    const envVars = Object.entries(config.environment)
      .map(([key, value]) => `set ${key}=${value}`)
      .join('\n');

    return `@echo off
cd /d "${config.workingDirectory}"
${envVars}
"${config.executablePath}" ${config.arguments.join(' ')}`;
  }

  /**
   * Parse service state from sc query output
   */
  private parseServiceState(output: string): WindowsServiceStatus['state'] {
    if (output.includes('RUNNING')) return 'running';
    if (output.includes('STOPPED')) return 'stopped';
    if (output.includes('START_PENDING')) return 'start_pending';
    if (output.includes('STOP_PENDING')) return 'stop_pending';
    if (output.includes('PAUSED')) return 'paused';
    return 'unknown';
  }

  /**
   * Get service process ID
   */
  private async getServicePID(serviceName: string, state: WindowsServiceStatus['state']): Promise<number | undefined> {
    if (state !== 'running' && state !== 'start_pending') {
      return undefined;
    }

    try {
      // Try tasklist first (most reliable)
      const { stdout } = await execAsync(
        `tasklist /svc /fi "SERVICES eq ${serviceName}" /fo csv`,
        { timeout: 5000 }
      );

      const lines = stdout.split('\n');
      if (lines.length > 1) {
        const pidMatch = lines[1].match(/"([^"]+)",.*?"(\d+)"/);
        if (pidMatch) {
          const pid = parseInt(pidMatch[2], 10);
          return pid > 0 ? pid : undefined;
        }
      }
    } catch {
      // Fallback to wmic
      try {
        const { stdout } = await execAsync(
          `wmic service where "name='${serviceName}'" get ProcessId /value`,
          { timeout: 5000 }
        );

        const pidMatch = stdout.match(/ProcessId=(\d+)/);
        if (pidMatch) {
          const pid = parseInt(pidMatch[1], 10);
          return pid > 0 ? pid : undefined;
        }
      } catch {
        // Final fallback to PowerShell
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "Get-WmiObject -Class Win32_Service -Filter \\"Name='${serviceName}'\\" | Select-Object ProcessId"`,
            { timeout: 10000 }
          );

          const psMatch = stdout.match(/(\d+)/);
          if (psMatch) {
            const pid = parseInt(psMatch[1], 10);
            return pid > 0 ? pid : undefined;
          }
        } catch {
          // PID detection failed completely
        }
      }
    }

    return undefined;
  }

  /**
   * Get service start type
   */
  private async getServiceStartType(serviceName: string): Promise<'auto' | 'demand' | 'disabled'> {
    try {
      const { stdout } = await execAsync(`sc qc "${serviceName}"`, { timeout: 5000 });

      if (stdout.includes('AUTO_START')) return 'auto';
      if (stdout.includes('DEMAND_START')) return 'demand';
      if (stdout.includes('DISABLED')) return 'disabled';
    } catch {
      // Ignore errors, return default
    }

    return 'disabled';
  }

  /**
   * Check if service is using NSSM wrapper
   */
  private async checkIfUsingNSSM(serviceName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`sc qc "${serviceName}"`, { timeout: 5000 });
      return stdout.includes('nssm.exe');
    } catch {
      return false;
    }
  }

  /**
   * Map recovery action to sc.exe format
   */
  private mapRecoveryAction(action: ServiceRecoveryOptions['firstFailure']): string {
    switch (action) {
      case 'restart': return 'restart';
      case 'run-command': return 'run';
      case 'none': return '';
      default: return 'restart';
    }
  }

  /**
   * Map start type to NSSM format
   */
  private mapStartTypeToNSSM(startType: WindowsServiceConfig['startType']): string {
    switch (startType) {
      case 'auto': return 'SERVICE_AUTO_START';
      case 'demand': return 'SERVICE_DEMAND_START';
      case 'disabled': return 'SERVICE_DISABLED';
      default: return 'SERVICE_DEMAND_START';
    }
  }

  /**
   * Clean up wrapper scripts and temporary files
   */
  private async cleanupWrapperScript(serviceName: string): Promise<void> {
    const wrapperPath = path.join(os.tmpdir(), `${serviceName}-wrapper.bat`);

    try {
      await fs.unlink(wrapperPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}