import chalk from 'chalk';
import {
  ServiceManager,
  ServiceError,
  type Platform,
  type InstallResult,
  type UninstallResult
} from '@apex/orchestrator';

/**
 * Interface representing the CLI context
 * This matches the ApexContext interface from index.ts
 */
interface ApexContext {
  cwd: string;
  initialized: boolean;
}

interface ServiceCommandOptions {
  enable?: boolean;     // For install: enable service after install
  force?: boolean;      // For install: overwrite existing; For uninstall: force remove
  timeout?: number;     // For uninstall: graceful stop timeout
  name?: string;        // Custom service name
}

/**
 * Error messages for different service error codes
 */
const SERVICE_ERROR_MESSAGES: Record<string, string> = {
  PLATFORM_UNSUPPORTED: 'Service installation is only available on Linux (systemd) and macOS (launchd).',
  SERVICE_EXISTS: 'A service file already exists. Use --force to overwrite.',
  SERVICE_NOT_FOUND: 'No service file found. The service may not be installed.',
  PERMISSION_DENIED: 'Permission denied. Check directory permissions or run with elevated privileges.',
  INSTALL_FAILED: 'Failed to install service. Check logs for details.',
  UNINSTALL_FAILED: 'Failed to uninstall service. Check logs for details.',
  GENERATION_FAILED: 'Failed to generate service file.',
};

/**
 * Get platform-specific command hints
 */
function getPlatformHints(platform: Platform): { start: string; status: string; logs?: string } {
  switch (platform) {
    case 'linux':
      return {
        start: 'systemctl --user start apex-daemon',
        status: 'systemctl --user status apex-daemon',
        logs: 'journalctl --user -u apex-daemon -f'
      };
    case 'darwin':
      return {
        start: 'launchctl start com.apex.daemon',
        status: 'launchctl list | grep apex',
        logs: 'tail -f .apex/daemon.out.log'
      };
    default:
      return {
        start: 'Service start commands not available',
        status: 'Service status commands not available'
      };
  }
}

/**
 * Parse command line options from arguments
 */
function parseOptions(args: string[]): ServiceCommandOptions {
  const options: ServiceCommandOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--enable':
        options.enable = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--timeout':
        const timeout = parseInt(args[++i], 10);
        if (!isNaN(timeout) && timeout > 0) {
          options.timeout = timeout;
        }
        break;
      case '--name':
        options.name = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Handle install-service command
 */
export async function handleInstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  // 1. Validate context
  if (!ctx.initialized) {
    console.log(chalk.red('✗ APEX not initialized'));
    console.log(chalk.gray("  Run 'apex init' first to initialize APEX in this directory."));
    return;
  }

  // 2. Parse command arguments
  const options = parseOptions(args);

  console.log(chalk.blue('📦 Installing APEX daemon as system service...'));

  // 3. Create ServiceManager
  const manager = new ServiceManager({
    projectPath: ctx.cwd,
    serviceName: options.name || 'apex-daemon'
  });

  try {
    // 4. Check platform support
    if (!manager.isSupported()) {
      const platform = manager.getPlatform();
      console.log(chalk.red('✗ Platform not supported'));
      console.log(chalk.gray(`  Service installation is only available on Linux (systemd) and macOS (launchd).`));
      console.log(chalk.gray(`  Current platform: ${platform}`));
      return;
    }

    // 5. Call install
    const result: InstallResult = await manager.install({
      enableAfterInstall: options.enable || false,
      force: options.force || false
    });

    // 6. Display success message
    console.log(chalk.green('✓ Service installed successfully'));
    console.log(`  Platform: ${getPlatformName(result.platform)}`);
    console.log(`  Service file: ${chalk.gray(result.servicePath)}`);
    if (options.enable) {
      console.log(`  Enabled: ${chalk.green('yes')}`);
    } else {
      console.log(`  Enabled: ${chalk.gray('no')}`);
    }

    // 7. Show platform-specific hints
    const hints = getPlatformHints(result.platform);
    console.log();
    console.log(`  To start the service: ${chalk.cyan(hints.start)}`);
    console.log(`  To check status: ${chalk.cyan(hints.status)}`);
    if (hints.logs) {
      console.log(`  To view logs: ${chalk.cyan(hints.logs)}`);
    }
    console.log();

  } catch (error) {
    // 8. Handle errors
    if (error instanceof ServiceError) {
      handleServiceError(error);
    } else {
      console.log(chalk.red(`✗ Failed to install service: ${(error as Error).message}`));
    }
  }
}

/**
 * Handle uninstall-service command
 */
export async function handleUninstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  // 1. Parse command arguments (no need to validate initialization for uninstall)
  const options = parseOptions(args);

  console.log(chalk.blue('🗑️ Uninstalling APEX daemon service...'));

  // 2. Create ServiceManager
  const manager = new ServiceManager({
    projectPath: ctx.cwd,
    serviceName: options.name || 'apex-daemon'
  });

  try {
    // 3. Call uninstall
    const result: UninstallResult = await manager.uninstall({
      force: options.force || false,
      stopTimeout: options.timeout || 5000
    });

    // 4. Display success message
    console.log(chalk.green('✓ Service uninstalled successfully'));
    console.log(`  Platform: ${getPlatformName(manager.getPlatform())}`);
    console.log(`  Removed: ${chalk.gray(result.servicePath)}`);
    console.log(`  Was running: ${result.wasRunning ? chalk.yellow('yes') : chalk.gray('no')}`);

    // Display any warnings
    if (result.warnings.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠ Warnings:'));
      result.warnings.forEach(warning => {
        console.log(chalk.gray(`  ${warning}`));
      });
    }
    console.log();

  } catch (error) {
    // 5. Handle errors
    if (error instanceof ServiceError) {
      handleServiceError(error);
    } else {
      console.log(chalk.red(`✗ Failed to uninstall service: ${(error as Error).message}`));
    }
  }
}

/**
 * Handle service status command (for REPL use)
 */
export async function handleServiceStatus(ctx: ApexContext): Promise<void> {
  const manager = new ServiceManager({
    projectPath: ctx.cwd,
    serviceName: 'apex-daemon'
  });

  try {
    const status = await manager.getStatus();
    const platform = manager.getPlatform();

    console.log(chalk.cyan('\nService Status'));
    console.log(chalk.gray('─'.repeat(36)));

    console.log(`  Platform:   ${getPlatformName(platform)}`);
    console.log(`  Installed:  ${status.installed ? chalk.green('yes') : chalk.gray('no')}`);

    if (status.installed) {
      console.log(`  Running:    ${status.running ? chalk.green('yes') : chalk.gray('no')}`);
      console.log(`  Enabled:    ${status.enabled ? chalk.green('yes') : chalk.gray('no')}`);
      console.log(`  File:       ${chalk.gray(status.servicePath || 'unknown')}`);

      if (status.running && status.pid) {
        console.log(`  PID:        ${status.pid}`);
      }
    }

    console.log();

    if (!status.installed) {
      console.log(chalk.gray("Use 'apex install-service' to install the service."));
    } else if (!status.running) {
      const hints = getPlatformHints(platform);
      console.log(chalk.gray(`To start: ${hints.start}`));
    }
    console.log();

  } catch (error) {
    if (error instanceof ServiceError) {
      handleServiceError(error);
    } else {
      console.log(chalk.red(`Failed to get service status: ${(error as Error).message}`));
    }
  }
}

/**
 * Handle service-specific errors with user-friendly messages
 */
function handleServiceError(error: ServiceError): void {
  const message = SERVICE_ERROR_MESSAGES[error.code] || error.message;
  console.log(chalk.red(`✗ ${message}`));

  // Add specific suggestions based on error type
  switch (error.code) {
    case 'SERVICE_EXISTS':
      console.log(chalk.gray('  Use --force to overwrite the existing service.'));
      break;
    case 'SERVICE_NOT_FOUND':
      console.log(chalk.gray('  The service may not be installed or may have been removed manually.'));
      break;
    case 'PERMISSION_DENIED':
      if (error.message.includes('systemd')) {
        console.log(chalk.gray('  Try running with proper user permissions or check ~/.config/systemd/user/ permissions.'));
      } else if (error.message.includes('launchd')) {
        console.log(chalk.gray('  Try checking ~/Library/LaunchAgents/ permissions.'));
      }
      break;
  }
}

/**
 * Get user-friendly platform name
 */
function getPlatformName(platform: Platform): string {
  switch (platform) {
    case 'linux':
      return 'Linux (systemd)';
    case 'darwin':
      return 'macOS (launchd)';
    default:
      return 'Unsupported';
  }
}