import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { detectContainerRuntime, type ContainerRuntimeType } from './container-runtime';

const execAsync = promisify(exec);

/**
 * Configuration for building Docker/OCI images
 */
export interface ImageBuildConfig {
  /** Path to Dockerfile (relative to build context) */
  dockerfilePath: string;
  /** Build context directory (defaults to directory containing Dockerfile) */
  buildContext?: string;
  /** Custom image tag (if not provided, will generate project-specific tag) */
  imageTag?: string;
  /** Build arguments to pass to docker/podman build */
  buildArgs?: Record<string, string>;
  /** Target stage for multi-stage builds */
  target?: string;
  /** Platform for multi-platform builds (e.g., 'linux/amd64', 'linux/arm64') */
  platform?: string;
  /** Whether to use build cache */
  noCache?: boolean;
  /** Force rebuild even if image exists */
  forceRebuild?: boolean;
  /** Preferred container runtime ('docker' or 'podman') */
  runtime?: ContainerRuntimeType;
}

/**
 * Information about a built image
 */
export interface ImageInfo {
  /** Full image tag */
  tag: string;
  /** Image ID/hash */
  id: string;
  /** When the image was created */
  created: Date;
  /** Size of the image in bytes */
  size?: number;
  /** Human-readable size */
  sizeFormatted?: string;
  /** Content hash of the Dockerfile used to build this image */
  dockerfileHash?: string;
  /** Whether the image exists locally */
  exists: boolean;
}

/**
 * Result of building an image
 */
export interface ImageBuildResult {
  /** Whether the build was successful */
  success: boolean;
  /** Information about the built image (if successful) */
  imageInfo?: ImageInfo;
  /** Error message (if build failed) */
  error?: string;
  /** Full build output */
  buildOutput: string;
  /** Build duration in milliseconds */
  buildDuration: number;
  /** Whether the image was actually rebuilt or used from cache */
  rebuilt: boolean;
}

/**
 * Utility class for building Docker/OCI images from Dockerfiles
 * Provides functionality to build images, generate project-specific tags,
 * detect changes, and check for existing images
 */
export class ImageBuilder {
  private runtime: ContainerRuntimeType = 'none';
  private projectRoot: string;

  /**
   * Create a new ImageBuilder instance
   * @param projectRoot The root directory of the project
   */
  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Initialize the image builder by detecting the best available container runtime
   * @param preferredRuntime Optional preferred runtime to use
   */
  async initialize(preferredRuntime?: ContainerRuntimeType): Promise<void> {
    this.runtime = await detectContainerRuntime(preferredRuntime);

    if (this.runtime === 'none') {
      throw new Error('No container runtime (Docker or Podman) available. Please install Docker or Podman to build images.');
    }
  }

  /**
   * Build an image from a Dockerfile
   * @param config Build configuration
   * @returns Promise resolving to build result
   */
  async buildImage(config: ImageBuildConfig): Promise<ImageBuildResult> {
    const startTime = Date.now();

    try {
      // Ensure runtime is available
      if (this.runtime === 'none') {
        await this.initialize(config.runtime);
      }

      // Resolve paths
      const dockerfilePath = path.resolve(this.projectRoot, config.dockerfilePath);
      const buildContext = config.buildContext
        ? path.resolve(this.projectRoot, config.buildContext)
        : path.dirname(dockerfilePath);

      // Generate image tag
      const imageTag = config.imageTag || await this.generateProjectTag(dockerfilePath);

      // Check if rebuild is needed
      const dockerfileHash = await this.calculateDockerfileHash(dockerfilePath);
      const existing = await this.getImageInfo(imageTag);

      if (!config.forceRebuild && existing.exists && existing.dockerfileHash === dockerfileHash) {
        return {
          success: true,
          imageInfo: existing,
          buildOutput: 'Using existing image (no changes detected)',
          buildDuration: Date.now() - startTime,
          rebuilt: false,
        };
      }

      // Build the image
      const buildCommand = this.buildBuildCommand(
        dockerfilePath,
        buildContext,
        imageTag,
        config
      );

      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: buildContext,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for build output
      });

      const buildOutput = stdout + (stderr ? '\n' + stderr : '');

      // Get information about the built image
      const imageInfo = await this.getImageInfo(imageTag);
      imageInfo.dockerfileHash = dockerfileHash;

      return {
        success: true,
        imageInfo,
        buildOutput,
        buildDuration: Date.now() - startTime,
        rebuilt: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        buildOutput: errorMessage,
        buildDuration: Date.now() - startTime,
        rebuilt: false,
      };
    }
  }

  /**
   * Check if an image exists locally
   * @param imageTag Image tag to check
   * @returns Promise resolving to true if image exists
   */
  async imageExists(imageTag: string): Promise<boolean> {
    if (this.runtime === 'none') {
      await this.initialize();
    }

    try {
      await execAsync(`${this.runtime} image inspect ${imageTag}`, {
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed information about an image
   * @param imageTag Image tag to inspect
   * @returns Promise resolving to image information
   */
  async getImageInfo(imageTag: string): Promise<ImageInfo> {
    const baseInfo: ImageInfo = {
      tag: imageTag,
      id: '',
      created: new Date(),
      exists: false,
    };

    if (this.runtime === 'none') {
      await this.initialize();
    }

    try {
      const { stdout } = await execAsync(
        `${this.runtime} image inspect ${imageTag} --format '{{.Id}}|{{.Created}}|{{.Size}}'`,
        { timeout: 10000 }
      );

      const [id, created, sizeStr] = stdout.trim().split('|');
      const size = parseInt(sizeStr, 10);

      return {
        ...baseInfo,
        id: id.replace('sha256:', '').substring(0, 12),
        created: new Date(created),
        size: isNaN(size) ? undefined : size,
        sizeFormatted: isNaN(size) ? undefined : this.formatSize(size),
        exists: true,
      };
    } catch {
      return baseInfo;
    }
  }

  /**
   * Generate a project-specific image tag
   * @param dockerfilePath Path to the Dockerfile
   * @returns Promise resolving to generated tag
   */
  async generateProjectTag(dockerfilePath: string): Promise<string> {
    // Generate hash from project path and dockerfile path
    const projectHash = crypto
      .createHash('sha256')
      .update(this.projectRoot)
      .update(dockerfilePath)
      .digest('hex')
      .substring(0, 8);

    return `apex-project-${projectHash}:latest`;
  }

  /**
   * Calculate content hash of a Dockerfile
   * @param dockerfilePath Path to the Dockerfile
   * @returns Promise resolving to content hash
   */
  async calculateDockerfileHash(dockerfilePath: string): Promise<string> {
    try {
      const content = await fs.readFile(dockerfilePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      throw new Error(`Failed to read Dockerfile at ${dockerfilePath}: ${error}`);
    }
  }

  /**
   * Remove an image from the local system
   * @param imageTag Image tag to remove
   * @returns Promise resolving to true if removal was successful
   */
  async removeImage(imageTag: string): Promise<boolean> {
    if (this.runtime === 'none') {
      await this.initialize();
    }

    try {
      await execAsync(`${this.runtime} rmi ${imageTag}`, {
        timeout: 30000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all locally available images with the project prefix
   * @returns Promise resolving to array of image information
   */
  async listProjectImages(): Promise<ImageInfo[]> {
    if (this.runtime === 'none') {
      await this.initialize();
    }

    try {
      const { stdout } = await execAsync(
        `${this.runtime} images --format 'table {{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}|{{.Size}}' --filter reference='apex-project-*'`,
        { timeout: 15000 }
      );

      const lines = stdout.trim().split('\n').slice(1); // Skip header
      const images: ImageInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const [tag, id, created, sizeStr] = line.split('|');
        const size = this.parseSize(sizeStr);

        images.push({
          tag,
          id: id.substring(0, 12),
          created: new Date(created),
          size,
          sizeFormatted: sizeStr,
          exists: true,
        });
      }

      return images;
    } catch {
      return [];
    }
  }

  /**
   * Clean up old project images (keeping the most recent N images)
   * @param keepCount Number of recent images to keep per project (default: 3)
   * @returns Promise resolving to number of images removed
   */
  async cleanupOldImages(keepCount: number = 3): Promise<number> {
    const projectImages = await this.listProjectImages();

    // Group by project hash (extract from tag)
    const projectGroups = new Map<string, ImageInfo[]>();

    for (const image of projectImages) {
      const match = image.tag.match(/apex-project-([a-f0-9]+):/);
      if (match) {
        const projectHash = match[1];
        if (!projectGroups.has(projectHash)) {
          projectGroups.set(projectHash, []);
        }
        projectGroups.get(projectHash)!.push(image);
      }
    }

    let removedCount = 0;

    // Clean up each project group
    for (const [, images] of projectGroups) {
      // Sort by creation date, newest first
      images.sort((a, b) => b.created.getTime() - a.created.getTime());

      // Remove images beyond the keep count
      const toRemove = images.slice(keepCount);

      for (const image of toRemove) {
        const removed = await this.removeImage(image.tag);
        if (removed) {
          removedCount++;
        }
      }
    }

    return removedCount;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build the docker/podman build command
   */
  private buildBuildCommand(
    dockerfilePath: string,
    buildContext: string,
    imageTag: string,
    config: ImageBuildConfig
  ): string {
    const parts = [this.runtime, 'build'];

    // Add dockerfile path
    parts.push('-f', dockerfilePath);

    // Add tag
    parts.push('-t', imageTag);

    // Add build arguments
    if (config.buildArgs) {
      for (const [key, value] of Object.entries(config.buildArgs)) {
        parts.push('--build-arg', `${key}=${value}`);
      }
    }

    // Add target stage
    if (config.target) {
      parts.push('--target', config.target);
    }

    // Add platform
    if (config.platform) {
      parts.push('--platform', config.platform);
    }

    // Add no-cache flag
    if (config.noCache) {
      parts.push('--no-cache');
    }

    // Add build context
    parts.push(buildContext);

    return parts.join(' ');
  }

  /**
   * Format bytes as human readable string
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }

  /**
   * Parse size string back to bytes (best effort)
   */
  private parseSize(sizeStr: string): number | undefined {
    const match = sizeStr.match(/^([\d.]+)(B|KB|MB|GB|TB)$/);
    if (!match) return undefined;

    const [, numStr, unit] = match;
    const num = parseFloat(numStr);

    const multipliers = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };

    return num * (multipliers[unit as keyof typeof multipliers] || 1);
  }
}

/**
 * Create a new ImageBuilder instance
 * @param projectRoot The root directory of the project
 * @returns ImageBuilder instance
 */
export function createImageBuilder(projectRoot: string): ImageBuilder {
  return new ImageBuilder(projectRoot);
}