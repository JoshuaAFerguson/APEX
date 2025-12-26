/**
 * Dependency Detection Module
 *
 * Detects package managers across multiple programming languages and provides
 * appropriate install commands for each detected configuration.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported package manager types
 */
export type PackageManagerType =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'pip'
  | 'poetry'
  | 'cargo'
  | 'unknown';

/**
 * Package manager detection configuration file
 */
export interface PackageManagerConfig {
  /** Configuration file name */
  configFile: string;
  /** Package manager type */
  type: PackageManagerType;
  /** Language ecosystem */
  language: 'javascript' | 'python' | 'rust';
  /** Install command template */
  installCommand: string;
  /** Additional metadata check function */
  verify?: (projectPath: string, configContent?: string) => boolean;
}

/**
 * Package manager detection result
 */
export interface PackageManagerDetectionResult {
  /** Type of package manager detected */
  type: PackageManagerType;
  /** Whether the package manager configuration was found */
  detected: boolean;
  /** Path to the configuration file */
  configPath?: string;
  /** Language ecosystem */
  language?: 'javascript' | 'python' | 'rust';
  /** Recommended install command */
  installCommand?: string;
  /** Additional context or metadata */
  metadata?: Record<string, any>;
  /** Error message if detection failed */
  error?: string;
}

/**
 * Multi-language dependency detection result
 */
export interface DependencyDetectionResult {
  /** Project root path that was analyzed */
  projectPath: string;
  /** All detected package managers */
  detectedManagers: PackageManagerDetectionResult[];
  /** Primary package manager (most likely to be used) */
  primaryManager?: PackageManagerDetectionResult;
  /** Whether any package managers were detected */
  hasPackageManagers: boolean;
  /** Recommended install commands for all detected managers */
  installCommands: string[];
}

// ============================================================================
// Package Manager Configurations
// ============================================================================

const PACKAGE_MANAGER_CONFIGS: PackageManagerConfig[] = [
  // JavaScript/Node.js ecosystem
  {
    configFile: 'package.json',
    type: 'npm',
    language: 'javascript',
    installCommand: 'npm install',
    verify: (projectPath: string, configContent?: string) => {
      // Default to npm if no specific indicators
      if (!configContent) return true;

      try {
        const pkg = JSON.parse(configContent);
        // Check for npm-specific fields
        return !pkg.packageManager && !existsSync(join(projectPath, 'yarn.lock')) && !existsSync(join(projectPath, 'pnpm-lock.yaml'));
      } catch {
        return false;
      }
    }
  },
  {
    configFile: 'package.json',
    type: 'yarn',
    language: 'javascript',
    installCommand: 'yarn install',
    verify: (projectPath: string, configContent?: string) => {
      // Check for yarn.lock or packageManager field
      if (existsSync(join(projectPath, 'yarn.lock'))) return true;

      if (configContent) {
        try {
          const pkg = JSON.parse(configContent);
          return pkg.packageManager?.startsWith('yarn@') || false;
        } catch {
          return false;
        }
      }
      return false;
    }
  },
  {
    configFile: 'package.json',
    type: 'pnpm',
    language: 'javascript',
    installCommand: 'pnpm install',
    verify: (projectPath: string, configContent?: string) => {
      // Check for pnpm-lock.yaml or packageManager field
      if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return true;

      if (configContent) {
        try {
          const pkg = JSON.parse(configContent);
          return pkg.packageManager?.startsWith('pnpm@') || false;
        } catch {
          return false;
        }
      }
      return false;
    }
  },

  // Python ecosystem
  {
    configFile: 'requirements.txt',
    type: 'pip',
    language: 'python',
    installCommand: 'pip install -r requirements.txt'
  },
  {
    configFile: 'pyproject.toml',
    type: 'poetry',
    language: 'python',
    installCommand: 'poetry install',
    verify: (projectPath: string, configContent?: string) => {
      if (!configContent) return true;

      // Check if pyproject.toml contains poetry configuration
      return configContent.includes('[tool.poetry]');
    }
  },

  // Rust ecosystem
  {
    configFile: 'Cargo.toml',
    type: 'cargo',
    language: 'rust',
    installCommand: 'cargo build',
    verify: (projectPath: string, configContent?: string) => {
      if (!configContent) return true;

      // Basic check for Cargo.toml structure
      return configContent.includes('[package]') || configContent.includes('[dependencies]');
    }
  }
];

// ============================================================================
// Core Class
// ============================================================================

/**
 * Multi-language dependency detection utility
 *
 * Analyzes project directories to identify package managers and provides
 * appropriate installation commands for detected dependencies.
 */
export class DependencyDetector {
  private detectionCache: Map<string, DependencyDetectionResult> = new Map();
  private cacheExpiry: number = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Detect all package managers in a project directory
   * @param projectPath - Path to the project root directory
   * @param useCache - Whether to use cached results (default: true)
   * @returns Comprehensive detection results
   */
  async detectPackageManagers(projectPath: string, useCache: boolean = true): Promise<DependencyDetectionResult> {
    const normalizedPath = this.normalizePath(projectPath);
    const now = Date.now();

    // Check cache if enabled
    if (useCache) {
      const cached = this.detectionCache.get(normalizedPath);
      const cacheTime = this.cacheTimestamps.get(normalizedPath);

      if (cached && cacheTime && (now - cacheTime) < this.cacheExpiry) {
        return cached;
      }
    }

    const result: DependencyDetectionResult = {
      projectPath: normalizedPath,
      detectedManagers: [],
      hasPackageManagers: false,
      installCommands: []
    };

    // Detect each package manager type
    for (const config of PACKAGE_MANAGER_CONFIGS) {
      const detection = await this.detectSpecificPackageManager(normalizedPath, config);
      if (detection.detected) {
        result.detectedManagers.push(detection);
      }
    }

    // Process results
    this.processDetectionResults(result);

    // Cache results
    this.detectionCache.set(normalizedPath, result);
    this.cacheTimestamps.set(normalizedPath, now);

    return result;
  }

  /**
   * Get the best install command for a project
   * @param projectPath - Path to the project root directory
   * @returns Install command string or null if no package manager detected
   */
  async getInstallCommand(projectPath: string): Promise<string | null> {
    const detection = await this.detectPackageManagers(projectPath);

    if (detection.primaryManager?.installCommand) {
      return detection.primaryManager.installCommand;
    }

    if (detection.installCommands.length > 0) {
      return detection.installCommands[0];
    }

    return null;
  }

  /**
   * Check if a specific package manager is detected in a project
   * @param projectPath - Path to the project root directory
   * @param packageManager - Package manager type to check for
   * @returns True if the package manager is detected
   */
  async hasPackageManager(projectPath: string, packageManager: PackageManagerType): Promise<boolean> {
    const detection = await this.detectPackageManagers(projectPath);
    return detection.detectedManagers.some(manager => manager.type === packageManager);
  }

  /**
   * Get all install commands for detected package managers
   * @param projectPath - Path to the project root directory
   * @returns Array of install commands
   */
  async getAllInstallCommands(projectPath: string): Promise<string[]> {
    const detection = await this.detectPackageManagers(projectPath);
    return detection.installCommands;
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
    this.cacheTimestamps.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Detect a specific package manager configuration
   * @param projectPath - Project root path
   * @param config - Package manager configuration
   * @returns Detection result for the specific package manager
   */
  private async detectSpecificPackageManager(
    projectPath: string,
    config: PackageManagerConfig
  ): Promise<PackageManagerDetectionResult> {
    const result: PackageManagerDetectionResult = {
      type: config.type,
      detected: false,
      language: config.language
    };

    try {
      const configPath = join(projectPath, config.configFile);

      if (!existsSync(configPath)) {
        return result;
      }

      let configContent: string | undefined;
      try {
        configContent = readFileSync(configPath, 'utf-8');
      } catch (error) {
        result.error = `Failed to read ${config.configFile}: ${error instanceof Error ? error.message : String(error)}`;
        return result;
      }

      // Perform additional verification if specified
      if (config.verify) {
        if (!config.verify(projectPath, configContent)) {
          return result;
        }
      }

      result.detected = true;
      result.configPath = configPath;
      result.installCommand = config.installCommand;

      // Extract metadata based on package manager type
      result.metadata = this.extractMetadata(config.type, configContent, projectPath);

    } catch (error) {
      result.error = `Detection failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return result;
  }

  /**
   * Process and prioritize detection results
   * @param result - Detection result to process
   */
  private processDetectionResults(result: DependencyDetectionResult): void {
    result.hasPackageManagers = result.detectedManagers.length > 0;

    if (!result.hasPackageManagers) {
      return;
    }

    // Extract install commands
    result.installCommands = result.detectedManagers
      .filter(manager => manager.installCommand)
      .map(manager => manager.installCommand!);

    // Determine primary package manager using priority rules
    result.primaryManager = this.determinePrimaryManager(result.detectedManagers);
  }

  /**
   * Determine the primary package manager from detected managers
   * @param detectedManagers - Array of detected package managers
   * @returns Primary package manager or undefined
   */
  private determinePrimaryManager(detectedManagers: PackageManagerDetectionResult[]): PackageManagerDetectionResult | undefined {
    if (detectedManagers.length === 0) return undefined;
    if (detectedManagers.length === 1) return detectedManagers[0];

    // Priority order for package managers within same language
    const jsManagerPriority = ['pnpm', 'yarn', 'npm'];
    const pythonManagerPriority = ['poetry', 'pip'];
    const rustManagerPriority = ['cargo'];

    // Group by language
    const jsManagers = detectedManagers.filter(m => m.language === 'javascript');
    const pythonManagers = detectedManagers.filter(m => m.language === 'python');
    const rustManagers = detectedManagers.filter(m => m.language === 'rust');

    // Find highest priority manager for each language
    let primaryCandidates: PackageManagerDetectionResult[] = [];

    if (jsManagers.length > 0) {
      const primary = this.findByPriority(jsManagers, jsManagerPriority);
      if (primary) primaryCandidates.push(primary);
    }

    if (pythonManagers.length > 0) {
      const primary = this.findByPriority(pythonManagers, pythonManagerPriority);
      if (primary) primaryCandidates.push(primary);
    }

    if (rustManagers.length > 0) {
      const primary = this.findByPriority(rustManagers, rustManagerPriority);
      if (primary) primaryCandidates.push(primary);
    }

    // Return the first candidate (or original first if no candidates)
    return primaryCandidates[0] || detectedManagers[0];
  }

  /**
   * Find package manager by priority order
   * @param managers - Managers to search
   * @param priority - Priority order
   * @returns Highest priority manager or undefined
   */
  private findByPriority(
    managers: PackageManagerDetectionResult[],
    priority: string[]
  ): PackageManagerDetectionResult | undefined {
    for (const type of priority) {
      const found = managers.find(m => m.type === type);
      if (found) return found;
    }
    return managers[0]; // Fallback to first
  }

  /**
   * Extract metadata from configuration files
   * @param type - Package manager type
   * @param configContent - Configuration file content
   * @param projectPath - Project root path
   * @returns Extracted metadata
   */
  private extractMetadata(
    type: PackageManagerType,
    configContent: string,
    projectPath: string
  ): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      switch (type) {
        case 'npm':
        case 'yarn':
        case 'pnpm':
          const pkg = JSON.parse(configContent);
          metadata.packageName = pkg.name;
          metadata.version = pkg.version;
          metadata.hasWorkspaces = !!pkg.workspaces;
          metadata.dependencyCount = Object.keys(pkg.dependencies || {}).length +
                                   Object.keys(pkg.devDependencies || {}).length;
          break;

        case 'pip':
          metadata.requirementLines = configContent.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
          break;

        case 'poetry':
          metadata.hasPoetryConfig = configContent.includes('[tool.poetry]');
          break;

        case 'cargo':
          metadata.hasCargoConfig = configContent.includes('[package]');
          metadata.hasLockFile = existsSync(join(projectPath, 'Cargo.lock'));
          break;
      }
    } catch (error) {
      metadata.parseError = error instanceof Error ? error.message : String(error);
    }

    return metadata;
  }

  /**
   * Normalize path for consistent caching
   * @param path - Input path
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/$/, '');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Singleton instance for global use
 */
export const dependencyDetector = new DependencyDetector();

/**
 * Convenience function to detect package managers in a project
 * @param projectPath - Path to the project root directory
 * @returns Detection results
 */
export async function detectDependencies(projectPath: string): Promise<DependencyDetectionResult> {
  return dependencyDetector.detectPackageManagers(projectPath);
}

/**
 * Convenience function to get install command for a project
 * @param projectPath - Path to the project root directory
 * @returns Install command or null if none detected
 */
export async function getProjectInstallCommand(projectPath: string): Promise<string | null> {
  return dependencyDetector.getInstallCommand(projectPath);
}

/**
 * Convenience function to check if a project has a specific package manager
 * @param projectPath - Path to the project root directory
 * @param packageManager - Package manager type to check
 * @returns True if the package manager is detected
 */
export async function hasProjectPackageManager(projectPath: string, packageManager: PackageManagerType): Promise<boolean> {
  return dependencyDetector.hasPackageManager(projectPath, packageManager);
}