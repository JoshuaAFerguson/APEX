import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Available container runtime types
 */
export type ContainerRuntimeType = 'docker' | 'podman' | 'none';

/**
 * Container runtime version information
 */
export interface RuntimeVersionInfo {
  /** Version string (e.g., "24.0.7") */
  version: string;
  /** Full version output from the runtime */
  fullVersion: string;
  /** API version (if available) */
  apiVersion?: string;
  /** Build information */
  buildInfo?: string;
}

/**
 * Container runtime detection result
 */
export interface RuntimeDetectionResult {
  /** Type of runtime detected */
  type: ContainerRuntimeType;
  /** Whether the runtime is available and functional */
  available: boolean;
  /** Version information (if available) */
  versionInfo?: RuntimeVersionInfo;
  /** Error message if detection failed */
  error?: string;
  /** Command used for detection */
  command?: string;
}

/**
 * Container runtime compatibility requirements
 */
export interface CompatibilityRequirement {
  /** Minimum required version */
  minVersion?: string;
  /** Maximum supported version */
  maxVersion?: string;
  /** Required features */
  requiredFeatures?: string[];
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether the runtime meets compatibility requirements */
  compatible: boolean;
  /** Version compatibility status */
  versionCompatible: boolean;
  /** Feature compatibility status */
  featuresCompatible: boolean;
  /** Issues found during compatibility check */
  issues: string[];
  /** Recommendations for fixing compatibility issues */
  recommendations: string[];
}

/**
 * Container runtime detection and management utility
 * Detects available container runtimes (Docker/Podman) and validates compatibility
 */
export class ContainerRuntime {
  private detectionCache: Map<ContainerRuntimeType, RuntimeDetectionResult> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastDetectionTime: number = 0;

  /**
   * Detect all available container runtimes
   * Checks for Docker and Podman availability and returns detection results
   * @returns Array of runtime detection results for all supported runtimes
   * @throws {Error} When runtime detection commands fail unexpectedly
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   * const results = await runtime.detectRuntimes();
   *
   * results.forEach(result => {
   *   console.log(`${result.type}: ${result.available ? 'Available' : 'Not available'}`);
   *   if (result.versionInfo) {
   *     console.log(`  Version: ${result.versionInfo.version}`);
   *   }
   *   if (result.error) {
   *     console.log(`  Error: ${result.error}`);
   *   }
   * });
   * ```
   */
  async detectRuntimes(): Promise<RuntimeDetectionResult[]> {
    const now = Date.now();

    // Return cached results if they're still valid
    if (this.detectionCache.size > 0 && (now - this.lastDetectionTime) < this.cacheExpiry) {
      return Array.from(this.detectionCache.values());
    }

    this.detectionCache.clear();
    const results: RuntimeDetectionResult[] = [];

    // Check Docker
    const dockerResult = await this.detectRuntime('docker');
    this.detectionCache.set('docker', dockerResult);
    results.push(dockerResult);

    // Check Podman
    const podmanResult = await this.detectRuntime('podman');
    this.detectionCache.set('podman', podmanResult);
    results.push(podmanResult);

    this.lastDetectionTime = now;
    return results;
  }

  /**
   * Get the best available container runtime
   * Prioritizes Docker over Podman, but respects preferred runtime if available
   * @param preferredRuntime Optional preferred runtime type
   * @returns The best runtime type ('docker', 'podman', or 'none' if unavailable)
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   *
   * // Get best available runtime (prefers Docker)
   * const best = await runtime.getBestRuntime();
   * console.log(`Best runtime: ${best}`);
   *
   * // Try to use preferred runtime
   * const preferred = await runtime.getBestRuntime('podman');
   * if (preferred === 'podman') {
   *   console.log('Using preferred Podman runtime');
   * } else {
   *   console.log(`Podman not available, using: ${preferred}`);
   * }
   * ```
   */
  async getBestRuntime(preferredRuntime?: ContainerRuntimeType): Promise<ContainerRuntimeType> {
    const runtimes = await this.detectRuntimes();

    // If a preferred runtime is specified and available, use it
    if (preferredRuntime && preferredRuntime !== 'none') {
      const preferred = runtimes.find(r => r.type === preferredRuntime && r.available);
      if (preferred) {
        return preferredRuntime;
      }
    }

    // Find first available runtime, prioritizing Docker
    const available = runtimes.filter(r => r.available);

    // Priority: Docker > Podman
    const dockerRuntime = available.find(r => r.type === 'docker');
    if (dockerRuntime) {
      return 'docker';
    }

    const podmanRuntime = available.find(r => r.type === 'podman');
    if (podmanRuntime) {
      return 'podman';
    }

    return 'none';
  }

  /**
   * Get runtime information for a specific type
   * @param runtimeType The runtime type to get info for
   * @returns Runtime detection result or null if not found
   * @throws {Error} When runtime detection fails
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   * const dockerInfo = await runtime.getRuntimeInfo('docker');
   *
   * if (dockerInfo?.available) {
   *   console.log(`Docker version: ${dockerInfo.versionInfo?.version}`);
   *   console.log(`Build info: ${dockerInfo.versionInfo?.buildInfo}`);
   * } else {
   *   console.log(`Docker not available: ${dockerInfo?.error}`);
   * }
   * ```
   */
  async getRuntimeInfo(runtimeType: ContainerRuntimeType): Promise<RuntimeDetectionResult | null> {
    if (runtimeType === 'none') {
      return {
        type: 'none',
        available: false,
        error: 'No container runtime requested',
      };
    }

    const runtimes = await this.detectRuntimes();
    return runtimes.find(r => r.type === runtimeType) || null;
  }

  /**
   * Check if a specific runtime is available
   * @param runtimeType The runtime type to check
   * @returns True if available and functional, false otherwise
   * @throws {Error} When runtime detection fails
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   *
   * if (await runtime.isRuntimeAvailable('docker')) {
   *   console.log('Docker is available and functional');
   * } else {
   *   console.log('Docker is not available');
   * }
   *
   * // Check both runtimes
   * const hasDocker = await runtime.isRuntimeAvailable('docker');
   * const hasPodman = await runtime.isRuntimeAvailable('podman');
   * console.log(`Docker: ${hasDocker}, Podman: ${hasPodman}`);
   * ```
   */
  async isRuntimeAvailable(runtimeType: ContainerRuntimeType): Promise<boolean> {
    const info = await this.getRuntimeInfo(runtimeType);
    return info?.available ?? false;
  }

  /**
   * Validate runtime compatibility against requirements
   * @param runtimeType The runtime type to validate
   * @param requirements Compatibility requirements (version bounds, features)
   * @returns Compatibility check result with detailed analysis
   * @throws {Error} When runtime detection fails
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   * const compatibility = await runtime.validateCompatibility('docker', {
   *   minVersion: '20.0.0',
   *   maxVersion: '25.0.0',
   *   requiredFeatures: ['buildkit', 'multi-stage']
   * });
   *
   * if (compatibility.compatible) {
   *   console.log('Docker meets all requirements');
   * } else {
   *   console.log('Compatibility issues found:');
   *   compatibility.issues.forEach(issue => console.log(`- ${issue}`));
   *   console.log('Recommendations:');
   *   compatibility.recommendations.forEach(rec => console.log(`- ${rec}`));
   * }
   * ```
   */
  async validateCompatibility(
    runtimeType: ContainerRuntimeType,
    requirements: CompatibilityRequirement
  ): Promise<CompatibilityResult> {
    const result: CompatibilityResult = {
      compatible: false,
      versionCompatible: true,
      featuresCompatible: true,
      issues: [],
      recommendations: [],
    };

    if (runtimeType === 'none') {
      result.issues.push('No container runtime specified');
      result.recommendations.push('Install Docker or Podman to enable container functionality');
      return result;
    }

    const runtimeInfo = await this.getRuntimeInfo(runtimeType);

    if (!runtimeInfo?.available) {
      result.issues.push(`${runtimeType} is not available or not functional`);
      result.recommendations.push(`Install or fix ${runtimeType} installation`);
      return result;
    }

    // Check version compatibility
    if (requirements.minVersion && runtimeInfo.versionInfo?.version) {
      try {
        if (this.compareVersions(runtimeInfo.versionInfo.version, requirements.minVersion) < 0) {
          result.versionCompatible = false;
          result.issues.push(
            `${runtimeType} version ${runtimeInfo.versionInfo.version} is below minimum required ${requirements.minVersion}`
          );
          result.recommendations.push(`Upgrade ${runtimeType} to version ${requirements.minVersion} or higher`);
        }
      } catch (error) {
        result.versionCompatible = false;
        result.issues.push(`Unable to parse ${runtimeType} version: ${runtimeInfo.versionInfo.version}`);
      }
    }

    if (requirements.maxVersion && runtimeInfo.versionInfo?.version) {
      try {
        if (this.compareVersions(runtimeInfo.versionInfo.version, requirements.maxVersion) > 0) {
          result.versionCompatible = false;
          result.issues.push(
            `${runtimeType} version ${runtimeInfo.versionInfo.version} is above maximum supported ${requirements.maxVersion}`
          );
          result.recommendations.push(`Downgrade ${runtimeType} to version ${requirements.maxVersion} or lower`);
        }
      } catch (error) {
        result.versionCompatible = false;
        result.issues.push(`Unable to parse ${runtimeType} version: ${runtimeInfo.versionInfo.version}`);
      }
    }

    // For now, we assume feature compatibility
    // In the future, this could be enhanced to check specific features
    if (requirements.requiredFeatures && requirements.requiredFeatures.length > 0) {
      result.featuresCompatible = true; // Optimistic assumption
    }

    result.compatible = result.versionCompatible && result.featuresCompatible;

    if (result.compatible) {
      result.recommendations.push(`${runtimeType} is compatible and ready to use`);
    }

    return result;
  }

  /**
   * Clear detection cache
   * Forces re-detection of container runtimes on next access
   * @example
   * ```typescript
   * const runtime = new ContainerRuntime();
   *
   * // Clear cache to force fresh detection
   * runtime.clearCache();
   *
   * // Next call will re-detect runtimes
   * const freshResults = await runtime.detectRuntimes();
   * ```
   */
  clearCache(): void {
    this.detectionCache.clear();
    this.lastDetectionTime = 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Detect a specific container runtime
   * @param runtimeType The runtime type to detect ('docker' or 'podman')
   * @returns Detection result with availability, version, and error info
   */
  private async detectRuntime(runtimeType: 'docker' | 'podman'): Promise<RuntimeDetectionResult> {
    const command = `${runtimeType} --version`;

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });

      if (stderr && stderr.length > 0) {
        return {
          type: runtimeType,
          available: false,
          error: stderr.trim(),
          command,
        };
      }

      const versionInfo = this.parseVersionOutput(stdout.trim(), runtimeType);

      // Verify runtime is functional by trying a simple command
      try {
        await execAsync(`${runtimeType} info`, { timeout: 10000 });

        return {
          type: runtimeType,
          available: true,
          versionInfo,
          command,
        };
      } catch (infoError) {
        return {
          type: runtimeType,
          available: false,
          versionInfo,
          error: `${runtimeType} is installed but not functional: ${infoError}`,
          command,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if command not found
      if (errorMessage.includes('not found') || errorMessage.includes('command not found')) {
        return {
          type: runtimeType,
          available: false,
          error: `${runtimeType} is not installed`,
          command,
        };
      }

      return {
        type: runtimeType,
        available: false,
        error: errorMessage,
        command,
      };
    }
  }

  /**
   * Parse version output from docker/podman --version
   * @param output Version command output string
   * @param runtimeType Runtime type for context ('docker' or 'podman')
   * @returns Parsed version information with version numbers and build info
   */
  private parseVersionOutput(output: string, runtimeType: string): RuntimeVersionInfo {
    const versionInfo: RuntimeVersionInfo = {
      version: 'unknown',
      fullVersion: output,
    };

    try {
      if (runtimeType === 'docker') {
        // Docker version output: "Docker version 24.0.7, build afdd53b"
        const dockerMatch = output.match(/Docker version ([\d.]+)(?:, build (.+))?/i);
        if (dockerMatch) {
          versionInfo.version = dockerMatch[1];
          versionInfo.buildInfo = dockerMatch[2];
        }
      } else if (runtimeType === 'podman') {
        // Podman version output: "podman version 4.7.2"
        const podmanMatch = output.match(/podman version ([\d.]+)/i);
        if (podmanMatch) {
          versionInfo.version = podmanMatch[1];
        }
      }

      // Try generic version extraction if specific parsing failed
      if (versionInfo.version === 'unknown') {
        const genericMatch = output.match(/(\d+\.\d+(?:\.\d+)?)/);
        if (genericMatch) {
          versionInfo.version = genericMatch[1];
        }
      }
    } catch (error) {
      // Fallback to unknown if parsing fails
    }

    return versionInfo;
  }

  /**
   * Compare two semantic version strings
   * @param version1 First version string (e.g., "24.0.7")
   * @param version2 Second version string (e.g., "23.0.1")
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }
}

/**
 * Singleton instance for global use
 * Pre-configured ContainerRuntime instance for convenient access throughout the application
 * @example
 * ```typescript
 * import { containerRuntime } from '@apex/core';
 *
 * // Use the singleton instance
 * const best = await containerRuntime.getBestRuntime();
 * const dockerAvailable = await containerRuntime.isRuntimeAvailable('docker');
 * ```
 */
export const containerRuntime = new ContainerRuntime();

/**
 * Convenience function to detect the best available runtime
 * Uses the singleton containerRuntime instance for detection
 * @param preferredRuntime Optional preferred runtime type
 * @returns The best available runtime type ('docker', 'podman', or 'none')
 * @throws {Error} When runtime detection fails
 * @example
 * ```typescript
 * // Get best available runtime
 * const runtime = await detectContainerRuntime();
 * console.log(`Using runtime: ${runtime}`);
 *
 * // Try to use preferred runtime
 * const preferredRuntime = await detectContainerRuntime('podman');
 * if (preferredRuntime === 'podman') {
 *   console.log('Using preferred Podman');
 * } else {
 *   console.log(`Podman not available, fallback: ${preferredRuntime}`);
 * }
 * ```
 */
export async function detectContainerRuntime(preferredRuntime?: ContainerRuntimeType): Promise<ContainerRuntimeType> {
  return containerRuntime.getBestRuntime(preferredRuntime);
}

/**
 * Convenience function to check if a runtime is available
 * Uses the singleton containerRuntime instance for checking
 * @param runtimeType Runtime type to check ('docker' or 'podman')
 * @returns True if the runtime is available and functional
 * @throws {Error} When runtime detection fails
 * @example
 * ```typescript
 * // Check if Docker is available
 * if (await isContainerRuntimeAvailable('docker')) {
 *   console.log('Docker is ready to use');
 * } else {
 *   console.log('Docker is not available');
 * }
 *
 * // Check multiple runtimes
 * const dockerOk = await isContainerRuntimeAvailable('docker');
 * const podmanOk = await isContainerRuntimeAvailable('podman');
 * console.log(`Available runtimes: Docker=${dockerOk}, Podman=${podmanOk}`);
 * ```
 */
export async function isContainerRuntimeAvailable(runtimeType: ContainerRuntimeType): Promise<boolean> {
  return containerRuntime.isRuntimeAvailable(runtimeType);
}

/**
 * Convenience function to get runtime version info
 * Uses the singleton containerRuntime instance for version detection
 * @param runtimeType Runtime type to get info for ('docker' or 'podman')
 * @returns Runtime version information or null if not available
 * @throws {Error} When runtime detection fails
 * @example
 * ```typescript
 * // Get Docker version info
 * const dockerVersion = await getContainerRuntimeInfo('docker');
 * if (dockerVersion) {
 *   console.log(`Docker version: ${dockerVersion.version}`);
 *   console.log(`Build info: ${dockerVersion.buildInfo}`);
 *   console.log(`API version: ${dockerVersion.apiVersion}`);
 * } else {
 *   console.log('Docker version info not available');
 * }
 *
 * // Compare versions
 * const podmanVersion = await getContainerRuntimeInfo('podman');
 * if (dockerVersion && podmanVersion) {
 *   console.log(`Docker: ${dockerVersion.version}, Podman: ${podmanVersion.version}`);
 * }
 * ```
 */
export async function getContainerRuntimeInfo(runtimeType: ContainerRuntimeType): Promise<RuntimeVersionInfo | null> {
  const info = await containerRuntime.getRuntimeInfo(runtimeType);
  return info?.versionInfo || null;
}