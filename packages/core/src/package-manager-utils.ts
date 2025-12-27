/**
 * Package Manager Utilities
 *
 * Utilities for handling package manager specific commands and configurations,
 * including frozen lockfile variants, CI optimization commands, and workspace handling.
 */

import type { PackageManagerType, PackageManagerDetectionResult } from './dependency-detector';

// ============================================================================
// Type Definitions
// ============================================================================

export interface InstallCommandOptions {
  /** Whether to use frozen lockfile installation (CI mode) */
  useFrozenLockfile?: boolean;
  /** Whether to install only production dependencies */
  productionOnly?: boolean;
  /** Custom registry URL */
  registry?: string;
  /** Additional install flags */
  additionalFlags?: string[];
}

export interface PackageManagerCommands {
  /** Basic install command */
  install: string;
  /** Frozen lockfile install command (for CI) */
  installFrozen: string;
  /** Production-only install command */
  installProduction: string;
  /** Clean install command (removes node_modules first) */
  installClean: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard package manager commands for different scenarios
 */
export const PACKAGE_MANAGER_COMMANDS: Record<PackageManagerType, PackageManagerCommands> = {
  npm: {
    install: 'npm install',
    installFrozen: 'npm ci',
    installProduction: 'npm ci --only=production',
    installClean: 'npm ci --no-cache'
  },
  yarn: {
    install: 'yarn install',
    installFrozen: 'yarn install --frozen-lockfile',
    installProduction: 'yarn install --frozen-lockfile --production',
    installClean: 'yarn install --frozen-lockfile --cache-folder=/tmp/yarn-cache'
  },
  pnpm: {
    install: 'pnpm install',
    installFrozen: 'pnpm install --frozen-lockfile',
    installProduction: 'pnpm install --frozen-lockfile --prod',
    installClean: 'pnpm install --frozen-lockfile --store-dir=/tmp/pnpm-store'
  },
  pip: {
    install: 'pip install -r requirements.txt',
    installFrozen: 'pip install -r requirements.txt --no-deps',
    installProduction: 'pip install -r requirements.txt --no-dev',
    installClean: 'pip install -r requirements.txt --force-reinstall'
  },
  poetry: {
    install: 'poetry install',
    installFrozen: 'poetry install --no-dev',
    installProduction: 'poetry install --no-dev',
    installClean: 'poetry install --no-cache'
  },
  cargo: {
    install: 'cargo build',
    installFrozen: 'cargo build --locked',
    installProduction: 'cargo build --release --locked',
    installClean: 'cargo clean && cargo build --locked'
  },
  unknown: {
    install: '',
    installFrozen: '',
    installProduction: '',
    installClean: ''
  }
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate appropriate install command based on package manager and options
 * @param packageManager - Detected package manager result
 * @param options - Install command options
 * @returns Optimized install command
 */
export function getInstallCommand(
  packageManager: PackageManagerDetectionResult,
  options: InstallCommandOptions = {}
): string {
  const { useFrozenLockfile = false, productionOnly = false, registry, additionalFlags = [] } = options;

  const commands = PACKAGE_MANAGER_COMMANDS[packageManager.type];
  if (!commands || packageManager.type === 'unknown') {
    return packageManager.installCommand || '';
  }

  let baseCommand: string;

  // Determine base command based on options and lockfile presence
  if (productionOnly) {
    baseCommand = commands.installProduction;
  } else if (useFrozenLockfile && packageManager.metadata?.hasLockfile) {
    baseCommand = commands.installFrozen;
  } else {
    baseCommand = commands.install;
  }

  // Add registry if specified
  if (registry) {
    baseCommand = addRegistryFlag(packageManager.type, baseCommand, registry);
  }

  // Add additional flags
  if (additionalFlags.length > 0) {
    baseCommand += ' ' + additionalFlags.join(' ');
  }

  return baseCommand.trim();
}

/**
 * Get the best install command for CI environments
 * @param packageManager - Detected package manager result
 * @param options - Additional options
 * @returns CI-optimized install command
 */
export function getCIInstallCommand(
  packageManager: PackageManagerDetectionResult,
  options: Omit<InstallCommandOptions, 'useFrozenLockfile'> = {}
): string {
  return getInstallCommand(packageManager, { ...options, useFrozenLockfile: true });
}

/**
 * Check if a package manager supports frozen lockfile installation
 * @param packageManager - Package manager to check
 * @returns True if frozen lockfile is supported
 */
export function supportsFrozenLockfile(packageManager: PackageManagerDetectionResult): boolean {
  const hasLockfile = packageManager.metadata?.hasLockfile;
  const supportedManagers: PackageManagerType[] = ['npm', 'yarn', 'pnpm', 'cargo'];

  return hasLockfile && supportedManagers.includes(packageManager.type);
}

/**
 * Check if a package manager is for a monorepo/workspace project
 * @param packageManager - Package manager to check
 * @returns True if this is a monorepo project
 */
export function isMonorepoProject(packageManager: PackageManagerDetectionResult): boolean {
  return !!(
    packageManager.metadata?.isMonorepoRoot ||
    packageManager.metadata?.hasWorkspaces ||
    packageManager.metadata?.hasLernaConfig ||
    packageManager.metadata?.hasWorkspaceConfig
  );
}

/**
 * Get workspace-specific install recommendations
 * @param packageManager - Detected package manager result
 * @returns Workspace install recommendations
 */
export function getWorkspaceInstallRecommendations(
  packageManager: PackageManagerDetectionResult
): {
  command: string;
  recommendations: string[];
  warnings: string[];
} {
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (!isMonorepoProject(packageManager)) {
    return {
      command: getInstallCommand(packageManager),
      recommendations: ['This appears to be a single-package project'],
      warnings: []
    };
  }

  switch (packageManager.type) {
    case 'npm':
      recommendations.push(
        'Use npm install to install all workspace dependencies',
        'Consider using npm workspaces for better dependency management'
      );
      if (packageManager.metadata?.hasLernaConfig) {
        recommendations.push('Lerna detected - consider migrating to npm workspaces');
      }
      break;

    case 'yarn':
      recommendations.push('Use yarn install to install all workspace dependencies');
      if (packageManager.metadata?.isYarnBerry) {
        recommendations.push('Yarn Berry detected - ensure .yarnrc.yml is properly configured');
        if (packageManager.metadata?.nodeLinker === 'pnp') {
          warnings.push('PnP mode may require additional configuration for some tools');
        }
      }
      if (packageManager.metadata?.hasNohoistConfig) {
        recommendations.push('Nohoist configuration detected - verify package isolation');
      }
      break;

    case 'pnpm':
      recommendations.push(
        'Use pnpm install to install all workspace dependencies',
        'PNPM provides excellent monorepo support with efficient storage'
      );
      if (packageManager.metadata?.hasPnpmrcConfig) {
        recommendations.push('Custom .pnpmrc detected - verify configuration compatibility');
      }
      break;

    default:
      warnings.push(`Package manager ${packageManager.type} may have limited workspace support`);
  }

  return {
    command: getInstallCommand(packageManager),
    recommendations,
    warnings
  };
}

/**
 * Generate performance-optimized install command
 * @param packageManager - Detected package manager result
 * @param isCI - Whether running in CI environment
 * @returns Performance-optimized command
 */
export function getOptimizedInstallCommand(
  packageManager: PackageManagerDetectionResult,
  isCI: boolean = false
): string {
  const options: InstallCommandOptions = {
    useFrozenLockfile: isCI,
    additionalFlags: []
  };

  // Add performance flags based on package manager
  switch (packageManager.type) {
    case 'npm':
      if (isCI) {
        options.additionalFlags?.push('--prefer-offline', '--no-audit');
      }
      break;

    case 'yarn':
      if (isCI) {
        options.additionalFlags?.push('--prefer-offline', '--silent');
      }
      if (packageManager.metadata?.isYarnBerry) {
        options.additionalFlags?.push('--immutable');
      }
      break;

    case 'pnpm':
      if (isCI) {
        options.additionalFlags?.push('--prefer-offline');
      }
      break;
  }

  return getInstallCommand(packageManager, options);
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Add registry flag to install command
 * @param packageManagerType - Type of package manager
 * @param command - Base command
 * @param registry - Registry URL
 * @returns Command with registry flag
 */
function addRegistryFlag(
  packageManagerType: PackageManagerType,
  command: string,
  registry: string
): string {
  switch (packageManagerType) {
    case 'npm':
      return `${command} --registry=${registry}`;
    case 'yarn':
      return `${command} --registry=${registry}`;
    case 'pnpm':
      return `${command} --registry=${registry}`;
    default:
      return command;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get all possible install commands for a package manager
 * @param packageManager - Package manager result
 * @returns Object with all install command variants
 */
export function getAllInstallCommands(packageManager: PackageManagerDetectionResult): PackageManagerCommands {
  return PACKAGE_MANAGER_COMMANDS[packageManager.type] || PACKAGE_MANAGER_COMMANDS.unknown;
}

/**
 * Validate if install command is appropriate for the detected environment
 * @param packageManager - Package manager result
 * @param command - Command to validate
 * @returns Validation result with suggestions
 */
export function validateInstallCommand(
  packageManager: PackageManagerDetectionResult,
  command: string
): {
  isValid: boolean;
  suggestions: string[];
  warnings: string[];
} {
  const suggestions: string[] = [];
  const warnings: string[] = [];

  // Check if command matches package manager type
  const expectedPrefix = packageManager.type === 'unknown' ? '' : packageManager.type;
  if (expectedPrefix && !command.startsWith(expectedPrefix)) {
    return {
      isValid: false,
      suggestions: [`Command should start with '${expectedPrefix}'`],
      warnings: [`Command '${command}' doesn't match detected package manager '${packageManager.type}'`]
    };
  }

  // Check for lockfile usage
  if (packageManager.metadata?.hasLockfile && !command.includes('frozen') && !command.includes('ci')) {
    suggestions.push('Consider using frozen lockfile command for deterministic installs');
  }

  // Check for workspace projects
  if (isMonorepoProject(packageManager)) {
    suggestions.push('This appears to be a monorepo - ensure workspace dependencies are handled correctly');
  }

  return {
    isValid: true,
    suggestions,
    warnings
  };
}

/**
 * Get package manager specific environment variables
 * @param packageManager - Package manager result
 * @returns Environment variables to set
 */
export function getPackageManagerEnvVars(
  packageManager: PackageManagerDetectionResult
): Record<string, string> {
  const envVars: Record<string, string> = {};

  switch (packageManager.type) {
    case 'npm':
      envVars.NPM_CONFIG_PROGRESS = 'false'; // Disable progress in CI
      envVars.NPM_CONFIG_LOGLEVEL = 'error'; // Reduce log noise
      break;

    case 'yarn':
      envVars.YARN_ENABLE_TELEMETRY = 'false'; // Disable telemetry
      if (packageManager.metadata?.isYarnBerry) {
        envVars.YARN_ENABLE_GLOBAL_CACHE = 'true'; // Enable global cache
      }
      break;

    case 'pnpm':
      envVars.PNPM_CONFIG_REPORTER = 'silent'; // Reduce output
      envVars.PNPM_CONFIG_PROGRESS = 'false'; // Disable progress
      break;
  }

  return envVars;
}