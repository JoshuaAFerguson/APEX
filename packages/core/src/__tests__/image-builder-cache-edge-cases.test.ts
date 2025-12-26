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

describe('ImageBuilder Cache Edge Cases', () => {
  let imageBuilder: ImageBuilder;
  let projectRoot: string;
  let cacheFilePath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    projectRoot = '/test/project';
    imageBuilder = new ImageBuilder(projectRoot);
    cacheFilePath = path.join(projectRoot, '.apex', 'image-cache.json');

    // Setup default mock behaviors
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Cache File Error Handling', () => {
    it('should handle corrupted cache file gracefully', async () => {
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return 'invalid json content {broken';
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await expect(imageBuilder.loadImageCache()).rejects.toThrow('Failed to load image cache');
    });

    it('should handle cache file read permission errors', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          throw permissionError;
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await expect(imageBuilder.loadImageCache()).rejects.toThrow('Failed to load image cache');
    });

    it('should handle cache directory creation failure', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {},
      };

      mockedFs.mkdir.mockRejectedValueOnce(new Error('Cannot create directory'));

      await expect(imageBuilder.saveImageCache(cache)).rejects.toThrow('Failed to save image cache');
    });

    it('should handle cache file write permission errors', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {},
      };

      mockedFs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(imageBuilder.saveImageCache(cache)).rejects.toThrow('Failed to save image cache');
    });

    it('should handle very large cache files', async () => {
      const largeCache: ImageCache = {
        version: '1.0',
        images: {},
      };

      // Create 1000 fake cache entries
      for (let i = 0; i < 1000; i++) {
        largeCache.images[`test-image-${i}:latest`] = {
          imageTag: `test-image-${i}:latest`,
          dockerfileHash: `hash${i}`.repeat(10), // Make it longer
          dockerfilePath: `/test/project/docker/Dockerfile-${i}`,
          imageId: `sha256:${'abcd'.repeat(16)}${i}`,
          imageSize: 1048576 * i,
          buildDuration: 5000,
          buildTimestamp: Date.now() - i * 1000,
          buildContext: `/test/project/docker/context-${i}`,
          lastAccessed: Date.now() - i * 100,
        };
      }

      await imageBuilder.saveImageCache(largeCache);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        cacheFilePath,
        expect.stringContaining('test-image-999:latest'),
        'utf-8'
      );
    });
  });

  describe('Cache Metadata Edge Cases', () => {
    it('should handle missing fields in cache metadata gracefully', async () => {
      const incompleteCache = {
        version: '1.0',
        images: {
          'incomplete-image:latest': {
            imageTag: 'incomplete-image:latest',
            dockerfileHash: 'abcd1234',
            // Missing some required fields intentionally
            imageId: 'abc123',
            buildTimestamp: Date.now(),
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(incompleteCache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const cache = await imageBuilder.loadImageCache();
      const metadata = cache.images['incomplete-image:latest'];

      expect(metadata).toBeDefined();
      expect(metadata.imageTag).toBe('incomplete-image:latest');
      expect(metadata.dockerfileHash).toBe('abcd1234');
    });

    it('should handle null and undefined values in cache', async () => {
      const cacheWithNulls = {
        version: '1.0',
        images: {
          'null-image:latest': {
            imageTag: 'null-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'abc123',
            imageSize: null,
            buildDuration: 5000,
            buildTimestamp: Date.now(),
            buildContext: '/test',
            lastAccessed: undefined,
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cacheWithNulls);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const cache = await imageBuilder.loadImageCache();
      const metadata = cache.images['null-image:latest'];

      expect(metadata).toBeDefined();
      expect(metadata.imageSize).toBeNull();
      expect(metadata.lastAccessed).toBeUndefined();
    });

    it('should handle extremely old timestamps', async () => {
      const cacheWithOldData: ImageCache = {
        version: '1.0',
        images: {
          'old-image:latest': {
            imageTag: 'old-image:latest',
            dockerfileHash: 'abcd1234',
            dockerfilePath: '/test/Dockerfile',
            imageId: 'abc123',
            imageSize: 1048576,
            buildDuration: 5000,
            buildTimestamp: 0, // Unix epoch
            buildContext: '/test',
            lastAccessed: 1, // Very old timestamp
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cacheWithOldData);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const removedCount = await imageBuilder.cleanupImageCache(0); // Keep none

      expect(removedCount).toBe(1);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should handle cache entries with identical timestamps', async () => {
      const now = Date.now();
      const cacheWithSameTimestamps: ImageCache = {
        version: '1.0',
        images: {
          'image1:latest': {
            imageTag: 'image1:latest',
            dockerfileHash: 'hash1',
            dockerfilePath: '/test/Dockerfile1',
            imageId: 'id1',
            buildDuration: 5000,
            buildTimestamp: now,
            buildContext: '/test',
            lastAccessed: now, // Same timestamp
          },
          'image2:latest': {
            imageTag: 'image2:latest',
            dockerfileHash: 'hash2',
            dockerfilePath: '/test/Dockerfile2',
            imageId: 'id2',
            buildDuration: 5000,
            buildTimestamp: now,
            buildContext: '/test',
            lastAccessed: now, // Same timestamp
          },
          'image3:latest': {
            imageTag: 'image3:latest',
            dockerfileHash: 'hash3',
            dockerfilePath: '/test/Dockerfile3',
            imageId: 'id3',
            buildDuration: 5000,
            buildTimestamp: now,
            buildContext: '/test',
            lastAccessed: now, // Same timestamp
          },
        },
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cacheWithSameTimestamps);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const removedCount = await imageBuilder.cleanupImageCache(1); // Keep only 1

      expect(removedCount).toBe(2);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Dockerfile Hash Edge Cases', () => {
    it('should handle different line endings in Dockerfile content', async () => {
      const contentUnix = 'FROM node:18\nWORKDIR /app\nCOPY . .';
      const contentWindows = 'FROM node:18\r\nWORKDIR /app\r\nCOPY . .';
      const contentMixed = 'FROM node:18\r\nWORKDIR /app\nCOPY . .';

      const hashUnix = crypto.createHash('sha256').update(contentUnix).digest('hex');
      const hashWindows = crypto.createHash('sha256').update(contentWindows).digest('hex');
      const hashMixed = crypto.createHash('sha256').update(contentMixed).digest('hex');

      // Verify that different line endings produce different hashes
      expect(hashUnix).not.toBe(hashWindows);
      expect(hashUnix).not.toBe(hashMixed);
      expect(hashWindows).not.toBe(hashMixed);

      // This is expected behavior - caching is content-sensitive
    });

    it('should handle Dockerfile with Unicode characters', async () => {
      const unicodeContent = 'FROM node:18\n# 这是一个测试注释\nWORKDIR /app\n# Emoji test: 🐳\n';

      mockedFs.readFile.mockResolvedValueOnce(unicodeContent);

      const hash = await imageBuilder.calculateDockerfileHash('/test/Dockerfile');

      expect(hash).toBe(crypto.createHash('sha256').update(unicodeContent).digest('hex'));
      expect(hash).toHaveLength(64); // SHA256 hex string length
    });

    it('should handle very large Dockerfile content', async () => {
      const largeComment = '# ' + 'A'.repeat(100000); // Very large comment
      const largeContent = `FROM node:18\n${largeComment}\nWORKDIR /app`;

      mockedFs.readFile.mockResolvedValueOnce(largeContent);

      const hash = await imageBuilder.calculateDockerfileHash('/test/Dockerfile');

      expect(hash).toBe(crypto.createHash('sha256').update(largeContent).digest('hex'));
      expect(hash).toHaveLength(64);
    });

    it('should handle Dockerfile with null bytes', async () => {
      const contentWithNulls = 'FROM node:18\x00\nWORKDIR /app\x00';

      mockedFs.readFile.mockResolvedValueOnce(contentWithNulls);

      const hash = await imageBuilder.calculateDockerfileHash('/test/Dockerfile');

      expect(hash).toBe(crypto.createHash('sha256').update(contentWithNulls).digest('hex'));
    });
  });

  describe('Concurrent Cache Operations', () => {
    it('should handle multiple concurrent cache reads', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {
          'concurrent-test:latest': {
            imageTag: 'concurrent-test:latest',
            dockerfileHash: 'hash123',
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
          // Simulate some async delay
          await new Promise(resolve => setTimeout(resolve, 10));
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Trigger multiple concurrent reads
      const promises = [
        imageBuilder.getCachedImageMetadata('concurrent-test:latest'),
        imageBuilder.getCachedImageMetadata('concurrent-test:latest'),
        imageBuilder.getCachedImageMetadata('concurrent-test:latest'),
      ];

      const results = await Promise.all(promises);

      // All should succeed and return the same metadata
      expect(results[0]).toBeTruthy();
      expect(results[1]).toBeTruthy();
      expect(results[2]).toBeTruthy();
      expect(results[0]!.imageTag).toBe('concurrent-test:latest');
      expect(results[1]!.imageTag).toBe('concurrent-test:latest');
      expect(results[2]!.imageTag).toBe('concurrent-test:latest');
    });

    it('should handle cache operations during build process', async () => {
      const dockerfileContent = 'FROM node:18\nWORKDIR /app';
      const dockerfileHash = crypto.createHash('sha256').update(dockerfileContent).digest('hex');

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('Dockerfile')) {
          return dockerfileContent;
        }
        if (filePath === cacheFilePath) {
          throw { code: 'ENOENT' }; // Cache doesn't exist initially
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Mock docker build and inspect
      (execAsync as any).mockImplementation(async (command: string) => {
        if (command.includes('build')) {
          // Simulate build time
          await new Promise(resolve => setTimeout(resolve, 20));
          return { stdout: 'Build successful', stderr: '' };
        }
        if (command.includes('inspect')) {
          return { stdout: 'new123|2024-01-01T00:00:00Z|1048576', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await imageBuilder.initialize();

      // Start a build and simultaneously try to access cache
      const buildPromise = imageBuilder.buildImage({
        dockerfilePath: 'Dockerfile',
      });

      const cachePromise = imageBuilder.getCachedImageMetadata('test-image:latest');

      const [buildResult, cacheResult] = await Promise.all([buildPromise, cachePromise]);

      expect(buildResult.success).toBe(true);
      expect(buildResult.rebuilt).toBe(true);
      expect(cacheResult).toBeNull(); // Cache didn't exist initially
    });
  });

  describe('Cache Validation Edge Cases', () => {
    it('should handle cache with missing version field', async () => {
      const cacheWithoutVersion = {
        images: {
          'no-version:latest': {
            imageTag: 'no-version:latest',
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
          return JSON.stringify(cacheWithoutVersion);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      // Should still load the cache but might warn
      const cache = await imageBuilder.loadImageCache();
      expect(cache.images['no-version:latest']).toBeDefined();
    });

    it('should handle cache with future version', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const futureCache = {
        version: '99.0', // Future version
        images: {},
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(futureCache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      await imageBuilder.loadImageCache();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Image cache version 99.0 may be incompatible. Expected 1.0.'
      );

      consoleSpy.mockRestore();
    });

    it('should handle cache with non-string version', async () => {
      const cacheWithNumericVersion = {
        version: 1.0, // Should be string
        images: {},
      };

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cacheWithNumericVersion);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const cache = await imageBuilder.loadImageCache();
      expect(cache.version).toBe(1.0); // Should preserve the original value
    });
  });

  describe('Cache Performance Edge Cases', () => {
    it('should handle cleanup of extremely large cache efficiently', async () => {
      const hugeCache: ImageCache = {
        version: '1.0',
        images: {},
      };

      // Create 10,000 cache entries
      for (let i = 0; i < 10000; i++) {
        hugeCache.images[`perf-test-${i}:latest`] = {
          imageTag: `perf-test-${i}:latest`,
          dockerfileHash: `hash${i}`,
          dockerfilePath: `/test/Dockerfile${i}`,
          imageId: `id${i}`,
          buildDuration: 5000,
          buildTimestamp: Date.now(),
          buildContext: '/test',
          lastAccessed: Date.now() - i, // Different access times
        };
      }

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(hugeCache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const startTime = Date.now();
      const removedCount = await imageBuilder.cleanupImageCache(100); // Keep only 100
      const duration = Date.now() - startTime;

      expect(removedCount).toBe(9900);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should handle metadata access updates efficiently', async () => {
      const cache: ImageCache = {
        version: '1.0',
        images: {},
      };

      // Create many cache entries
      for (let i = 0; i < 1000; i++) {
        cache.images[`access-test-${i}:latest`] = {
          imageTag: `access-test-${i}:latest`,
          dockerfileHash: `hash${i}`,
          dockerfilePath: `/test/Dockerfile${i}`,
          imageId: `id${i}`,
          buildDuration: 5000,
          buildTimestamp: Date.now(),
          buildContext: '/test',
          lastAccessed: Date.now() - i * 1000,
        };
      }

      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === cacheFilePath) {
          return JSON.stringify(cache);
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      });

      const startTime = Date.now();

      // Access several cache entries
      for (let i = 0; i < 10; i++) {
        await imageBuilder.getCachedImageMetadata(`access-test-${i}:latest`);
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should be fast
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(10); // One write per access
    });
  });
});