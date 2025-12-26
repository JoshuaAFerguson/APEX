import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ImageBuilder, ImageCacheMetadata, ImageCache } from '../image-builder';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('child_process');
vi.mock('../container-runtime', () => ({
  detectContainerRuntime: vi.fn().mockResolvedValue('docker'),
}));

const mockedFs = vi.mocked(fs);
const { exec } = await vi.importMock<{ exec: any }>('child_process');
const { promisify } = await import('util');
const execAsync = promisify(exec);

describe('ImageBuilder Cache Functionality', () => {
  let imageBuilder: ImageBuilder;
  let projectRoot: string;
  let cacheFilePath: string;
  let testDockerfile: string;
  let testDockerfileContent: string;

  beforeEach(() => {
    vi.clearAllMocks();

    projectRoot = '/test/project';
    imageBuilder = new ImageBuilder(projectRoot);
    cacheFilePath = path.join(projectRoot, '.apex', 'image-cache.json');
    testDockerfile = path.join(projectRoot, 'Dockerfile');
    testDockerfileContent = 'FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install';

    // Setup default mock behaviors
    mockedFs.readFile.mockImplementation(async (filePath: string) => {
      if (filePath === testDockerfile) {
        return testDockerfileContent;
      }
      if (filePath === cacheFilePath) {
        throw { code: 'ENOENT' }; // Cache doesn't exist initially
      }
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);

    // Mock successful Docker commands
    (execAsync as any).mockResolvedValue({
      stdout: 'sha256:abc123|2024-01-01T00:00:00Z|1048576',
      stderr: '',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Cache Management', () => {
    it('should load empty cache when file does not exist', async () => {
      const cache = await imageBuilder.loadImageCache();

      expect(cache).toEqual({
        version: '1.0',
        images: {},
      });
    });

    it('should load existing cache from file', async () => {
      const existingCache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: 1640995200000,
            buildContext: '/test',
            lastAccessed: 1640995200000,
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(existingCache);
        }
        if (filePath === testDockerfile) {
          return testDockerfileContent;
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const cache = await imageBuilder.loadImageCache();
      expect(cache).toEqual(existingCache);
    });

    it('should save cache to file with proper formatting', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: 1640995200000,
            buildContext: '/test',
            lastAccessed: 1640995200000,
          },
        },
      };

      await imageBuilder.saveImageCache(cache);

      expect(mockedFs.mkdir).toHaveBeenCalledWith(
        path.dirname(cacheFilePath),
        { recursive: true }
      );
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        cacheFilePath,
        JSON.stringify(cache, null, 2),
        'utf-8'
      );
    });

    it('should handle cache version compatibility warnings', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const incompatibleCache = {
        version: '2.0',
        images: {},
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(incompatibleCache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await imageBuilder.loadImageCache();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Image cache version 2.0 may be incompatible. Expected 1.0.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Cache Operations', () => {
    it('should get cached metadata and update last accessed time', async () => {
      const originalTimestamp = 1640995200000;
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: originalTimestamp,
            buildContext: '/test',
            lastAccessed: originalTimestamp,
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const beforeTime = Date.now();
      const metadata = await imageBuilder.getCachedImageMetadata('test-image:latest');
      const afterTime = Date.now();

      expect(metadata).toBeTruthy();
      expect(metadata!.imageTag).toBe('test-image:latest');
      expect(metadata!.lastAccessed).toBeGreaterThanOrEqual(beforeTime);
      expect(metadata!.lastAccessed).toBeLessThanOrEqual(afterTime);

      // Should have saved the updated cache
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should return null for non-existent cache entry', async () => {
      const metadata = await imageBuilder.getCachedImageMetadata('non-existent:latest');
      expect(metadata).toBeNull();
    });

    it('should store new cache metadata', async () => {
      const metadata: ImageCacheMetadata = {
        imageTag: 'new-image:latest',
        dockerfileHash: 'efgh5678',
        dockerfilePath: '/test/Dockerfile',
        imageId: 'sha256:def456',
        imageSize: 2097152,
        buildDuration: 8000,
        buildTimestamp: Date.now(),
        buildContext: '/test',
        lastAccessed: Date.now(),
      };

      await imageBuilder.storeCachedImageMetadata(metadata);

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should remove cached metadata', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: 1640995200000,
            buildContext: '/test',
            lastAccessed: 1640995200000,
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await imageBuilder.removeCachedImageMetadata('test-image:latest');

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Cache Cleanup', () => {
    it('should cleanup old cache entries based on LRU', async () => {
      const now = Date.now();
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'old-image:latest': {
            imageTag: 'old-image:latest',
            dockerfileHash: 'old123',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:old123',
            buildDuration: 5000,
            buildTimestamp: now - 86400000, // 1 day ago
            buildContext: '/test',
            lastAccessed: now - 86400000, // Oldest
          },
          'recent-image:latest': {
            imageTag: 'recent-image:latest',
            dockerfileHash: 'new456',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:new456',
            buildDuration: 5000,
            buildTimestamp: now - 3600000, // 1 hour ago
            buildContext: '/test',
            lastAccessed: now - 3600000, // Most recent
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const removedCount = await imageBuilder.cleanupImageCache(1); // Keep only 1 entry

      expect(removedCount).toBe(1);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should not cleanup when under the limit', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'sha256:abc123',
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: '/test',
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const removedCount = await imageBuilder.cleanupImageCache(50); // Keep 50, only have 1

      expect(removedCount).toBe(0);
    });
  });

  describe('Build Image with Cache', () => {
    it('should use cached image when Dockerfile hash matches', async () => {
      const dockerfileHash = crypto
        .createHash('sha256')
        .update(testDockerfileContent)
        .digest('hex');

      const cache: ImageCache = {
        version: '1.0',
        images: {
          'apex-project-abcd1234:latest': {
            imageTag: 'apex-project-abcd1234:latest',
            dockerfileHash,
            dockerfilePath: testDockerfile,
            imageId: 'abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: path.dirname(testDockerfile),
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testDockerfile) {
          return testDockerfileContent;
        }
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker image inspect to return the cached image
      (execAsync as any).mockResolvedValue({
        stdout: 'abc123|2024-01-01T00:00:00Z|1048576',
        stderr: '',
      });

      await imageBuilder.initialize();
      const result = await imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
      });

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(false);
      expect(result.buildOutput).toBe('Using cached image (no Dockerfile changes detected)');
      expect(result.imageInfo?.dockerfileHash).toBe(dockerfileHash);
    });

    it('should rebuild when Dockerfile hash changes', async () => {
      const oldHash = 'old-hash-1234';
      const newDockerfileContent = 'FROM node:20\nWORKDIR /app\nCOPY . .\nRUN npm install';
      const newHash = crypto
        .createHash('sha256')
        .update(newDockerfileContent)
        .digest('hex');

      const cache: ImageCache = {
        version: '1.0',
        images: {
          'apex-project-abcd1234:latest': {
            imageTag: 'apex-project-abcd1234:latest',
            dockerfileHash: oldHash,
            dockerfilePath: testDockerfile,
            imageId: 'abc123',
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: path.dirname(testDockerfile),
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testDockerfile) {
          return newDockerfileContent; // Return changed content
        }
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker build success
      (execAsync as any).mockImplementation(async (command: string) => {
        if (command.includes('build')) {
          return { stdout: 'Build successful', stderr: '' };
        }
        if (command.includes('inspect')) {
          return { stdout: 'def456|2024-01-01T00:00:00Z|2097152', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await imageBuilder.initialize();
      const result = await imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
      });

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
      expect(result.buildOutput).toContain('Build successful');
      expect(result.imageInfo?.dockerfileHash).toBe(newHash);

      // Should have stored new metadata in cache
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        cacheFilePath,
        expect.stringContaining(newHash),
        'utf-8'
      );
    });

    it('should force rebuild when forceRebuild is true', async () => {
      const dockerfileHash = crypto
        .createHash('sha256')
        .update(testDockerfileContent)
        .digest('hex');

      const cache: ImageCache = {
        version: '1.0',
        images: {
          'apex-project-abcd1234:latest': {
            imageTag: 'apex-project-abcd1234:latest',
            dockerfileHash,
            dockerfilePath: testDockerfile,
            imageId: 'abc123',
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: path.dirname(testDockerfile),
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testDockerfile) {
          return testDockerfileContent;
        }
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker build success
      (execAsync as any).mockImplementation(async (command: string) => {
        if (command.includes('build')) {
          return { stdout: 'Forced rebuild successful', stderr: '' };
        }
        if (command.includes('inspect')) {
          return { stdout: 'def456|2024-01-01T00:00:00Z|2097152', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await imageBuilder.initialize();
      const result = await imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
        forceRebuild: true, // Force rebuild despite cache hit
      });

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
      expect(result.buildOutput).toContain('Forced rebuild successful');
    });

    it('should remove stale cache entry when image ID mismatch', async () => {
      const dockerfileHash = crypto
        .createHash('sha256')
        .update(testDockerfileContent)
        .digest('hex');

      const cache: ImageCache = {
        version: '1.0',
        images: {
          'apex-project-abcd1234:latest': {
            imageTag: 'apex-project-abcd1234:latest',
            dockerfileHash,
            dockerfilePath: testDockerfile,
            imageId: 'old-id-123', // Different from what Docker reports
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: path.dirname(testDockerfile),
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testDockerfile) {
          return testDockerfileContent;
        }
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker to return different image ID than cached
      (execAsync as any).mockImplementation(async (command: string) => {
        if (command.includes('build')) {
          return { stdout: 'Rebuilt after cache invalidation', stderr: '' };
        }
        if (command.includes('inspect')) {
          return { stdout: 'different123|2024-01-01T00:00:00Z|1048576', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await imageBuilder.initialize();
      const result = await imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
      });

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
      expect(result.buildOutput).toContain('Rebuilt after cache invalidation');

      // Should have written cache twice: once to remove stale entry, once to store new
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle cache miss when no cached metadata exists', async () => {
      // Empty cache
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testDockerfile) {
          return testDockerfileContent;
        }
        if (filePath === cacheFilePath) {
          throw { code: 'ENOENT' };
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker build success
      (execAsync as any).mockImplementation(async (command: string) => {
        if (command.includes('build')) {
          return { stdout: 'First build successful', stderr: '' };
        }
        if (command.includes('inspect')) {
          return { stdout: 'new123|2024-01-01T00:00:00Z|1048576', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await imageBuilder.initialize();
      const result = await imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
      });

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
      expect(result.buildOutput).toContain('First build successful');

      // Should have stored new metadata in cache
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Image Removal with Cache Cleanup', () => {
    it('should remove cached metadata when image is removed', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'test-image:latest': {
            imageTag: 'test-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'abc123',
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: '/test',
            lastAccessed: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock successful image removal
      (execAsync as any).mockResolvedValue({ stdout: '', stderr: '' });

      await imageBuilder.initialize();
      const result = await imageBuilder.removeImage('test-image:latest');

      expect(result).toBe(true);

      // Should have removed the cache entry
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should not affect cache when image removal fails', async () => {
      // Mock failed image removal
      (execAsync as any).mockRejectedValue(new Error('Image not found'));

      await imageBuilder.initialize();
      const result = await imageBuilder.removeImage('test-image:latest');

      expect(result).toBe(false);

      // Should not have touched the cache
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });
  });
});