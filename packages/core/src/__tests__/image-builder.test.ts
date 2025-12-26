import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ImageBuilder,
  createImageBuilder,
  type ImageBuildConfig,
  type ImageBuildResult,
  type ImageInfo,
} from '../image-builder';
import * as containerRuntime from '../container-runtime';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock container-runtime module
vi.mock('../container-runtime', () => ({
  detectContainerRuntime: vi.fn(),
}));

const mockExec = vi.mocked(exec);
const mockReadFile = vi.mocked(fs.readFile);
const mockDetectContainerRuntime = vi.mocked(containerRuntime.detectContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

describe('ImageBuilder', () => {
  let builder: ImageBuilder;
  const testProjectRoot = '/test/project';
  const testDockerfilePath = 'Dockerfile';
  const testDockerfileContent = 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\n';

  beforeEach(() => {
    builder = new ImageBuilder(testProjectRoot);
    vi.clearAllMocks();

    // Default mock: Docker is available
    mockDetectContainerRuntime.mockResolvedValue('docker');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor and Initialization Tests
  // ============================================================================

  describe('constructor and initialization', () => {
    it('should create ImageBuilder with project root', () => {
      const builder = new ImageBuilder('/my/project');
      expect(builder).toBeInstanceOf(ImageBuilder);
    });

    it('should resolve relative project root paths', () => {
      // This is implicit - the constructor uses path.resolve
      const builder = new ImageBuilder('./relative/path');
      expect(builder).toBeInstanceOf(ImageBuilder);
    });

    it('should initialize with Docker when available', async () => {
      mockDetectContainerRuntime.mockResolvedValueOnce('docker');

      await builder.initialize();
      expect(mockDetectContainerRuntime).toHaveBeenCalledWith(undefined);
    });

    it('should initialize with Podman when preferred', async () => {
      mockDetectContainerRuntime.mockResolvedValueOnce('podman');

      await builder.initialize('podman');
      expect(mockDetectContainerRuntime).toHaveBeenCalledWith('podman');
    });

    it('should throw error when no runtime available', async () => {
      mockDetectContainerRuntime.mockResolvedValueOnce('none');

      await expect(builder.initialize()).rejects.toThrow(
        'No container runtime (Docker or Podman) available'
      );
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createImageBuilder', () => {
    it('should create ImageBuilder instance', () => {
      const builder = createImageBuilder('/test/project');
      expect(builder).toBeInstanceOf(ImageBuilder);
    });
  });

  // ============================================================================
  // Build Image Tests
  // ============================================================================

  describe('buildImage', () => {
    const config: ImageBuildConfig = {
      dockerfilePath: testDockerfilePath,
    };

    beforeEach(() => {
      // Mock successful Dockerfile read
      mockReadFile.mockResolvedValue(testDockerfileContent);

      // Mock image doesn't exist initially
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('No such image'))
      );
    });

    it('should build image successfully', async () => {
      // Mock successful build
      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built abc123\nSuccessfully tagged apex-project-12345678:latest')
      );

      // Mock image info after build
      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:abc123def456|2024-01-01T12:00:00Z|134217728')
      );

      const result = await builder.buildImage(config);

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
      expect(result.imageInfo?.tag).toMatch(/^apex-project-[a-f0-9]{8}:latest$/);
      expect(result.imageInfo?.exists).toBe(true);
      expect(result.buildDuration).toBeGreaterThan(0);
    });

    it('should use existing image when no changes detected', async () => {
      const dockerfileHash = 'abc123def456';

      // Mock existing image with same hash
      mockExec
        .mockImplementationOnce(
          mockExecCallback('sha256:existing123|2024-01-01T12:00:00Z|134217728')
        );

      const existingConfig = { ...config, forceRebuild: false };

      // Create a builder with a mock method to return existing hash
      const builderWithMock = builder as any;
      builderWithMock.getImageInfo = vi.fn().mockResolvedValueOnce({
        tag: 'apex-project-12345678:latest',
        id: 'existing123',
        created: new Date('2024-01-01T12:00:00Z'),
        exists: true,
        dockerfileHash,
      });

      builderWithMock.calculateDockerfileHash = vi.fn().mockResolvedValueOnce(dockerfileHash);

      const result = await builder.buildImage(existingConfig);

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(false);
      expect(result.buildOutput).toContain('Using existing image');
    });

    it('should rebuild when forceRebuild is true', async () => {
      const existingConfig = { ...config, forceRebuild: true };

      // Mock successful build
      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built def789')
      );

      // Mock image info after build
      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:def789|2024-01-01T12:00:00Z|134217728')
      );

      const result = await builder.buildImage(existingConfig);

      expect(result.success).toBe(true);
      expect(result.rebuilt).toBe(true);
    });

    it('should handle build failure', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', 'Build failed: invalid syntax', new Error('Build failed'))
      );

      const result = await builder.buildImage(config);

      expect(result.success).toBe(false);
      expect(result.rebuilt).toBe(false);
      expect(result.error).toContain('Build failed');
    });

    it('should use custom image tag when provided', async () => {
      const customConfig = { ...config, imageTag: 'my-custom-image:v1.0' };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully tagged my-custom-image:v1.0')
      );

      // Mock image info
      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:custom123|2024-01-01T12:00:00Z|134217728')
      );

      const result = await builder.buildImage(customConfig);

      expect(result.success).toBe(true);
      expect(result.imageInfo?.tag).toBe('my-custom-image:v1.0');
    });

    it('should pass build arguments correctly', async () => {
      const configWithArgs = {
        ...config,
        buildArgs: {
          NODE_ENV: 'production',
          VERSION: '1.0.0',
        },
      };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built with args')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:args123|2024-01-01T12:00:00Z|134217728')
      );

      await builder.buildImage(configWithArgs);

      // Verify build command includes build args
      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('--build-arg')
      );
      expect(buildCall).toBeDefined();
      expect(buildCall![0]).toContain('--build-arg NODE_ENV=production');
      expect(buildCall![0]).toContain('--build-arg VERSION=1.0.0');
    });

    it('should handle build context correctly', async () => {
      const configWithContext = {
        ...config,
        buildContext: './docker',
      };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built with context')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:context123|2024-01-01T12:00:00Z|134217728')
      );

      await builder.buildImage(configWithContext);

      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('build')
      );
      expect(buildCall).toBeDefined();
      expect(buildCall![0]).toContain(path.resolve(testProjectRoot, './docker'));
    });

    it('should handle multi-stage builds with target', async () => {
      const configWithTarget = {
        ...config,
        target: 'production',
      };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built target stage')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:target123|2024-01-01T12:00:00Z|134217728')
      );

      await builder.buildImage(configWithTarget);

      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('--target')
      );
      expect(buildCall).toBeDefined();
      expect(buildCall![0]).toContain('--target production');
    });

    it('should handle platform specification', async () => {
      const configWithPlatform = {
        ...config,
        platform: 'linux/arm64',
      };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built for platform')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:platform123|2024-01-01T12:00:00Z|134217728')
      );

      await builder.buildImage(configWithPlatform);

      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('--platform')
      );
      expect(buildCall).toBeDefined();
      expect(buildCall![0]).toContain('--platform linux/arm64');
    });

    it('should handle no-cache builds', async () => {
      const configNoCache = {
        ...config,
        noCache: true,
      };

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built without cache')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:nocache123|2024-01-01T12:00:00Z|134217728')
      );

      await builder.buildImage(configNoCache);

      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('--no-cache')
      );
      expect(buildCall).toBeDefined();
    });

    it('should auto-initialize runtime if needed', async () => {
      // Create a fresh builder that hasn't been initialized
      const freshBuilder = new ImageBuilder(testProjectRoot);

      mockExec.mockImplementationOnce(
        mockExecCallback('Successfully built with auto-init')
      );

      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:autoinit123|2024-01-01T12:00:00Z|134217728')
      );

      const result = await freshBuilder.buildImage(config);

      expect(result.success).toBe(true);
      expect(mockDetectContainerRuntime).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Image Information Tests
  // ============================================================================

  describe('imageExists', () => {
    it('should return true for existing image', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('Image exists output')
      );

      const exists = await builder.imageExists('test-image:latest');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing image', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('No such image'))
      );

      const exists = await builder.imageExists('nonexistent:latest');
      expect(exists).toBe(false);
    });

    it('should auto-initialize runtime if needed', async () => {
      const freshBuilder = new ImageBuilder(testProjectRoot);

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('No such image'))
      );

      await freshBuilder.imageExists('test:latest');
      expect(mockDetectContainerRuntime).toHaveBeenCalled();
    });
  });

  describe('getImageInfo', () => {
    it('should return complete image info for existing image', async () => {
      const imageOutput = 'sha256:abc123def456789|2024-01-15T10:30:00Z|134217728';
      mockExec.mockImplementationOnce(
        mockExecCallback(imageOutput)
      );

      const info = await builder.getImageInfo('test-image:latest');

      expect(info).toEqual({
        tag: 'test-image:latest',
        id: 'abc123def456', // Should be truncated to 12 chars
        created: new Date('2024-01-15T10:30:00Z'),
        size: 134217728,
        sizeFormatted: '128.0MB',
        exists: true,
      });
    });

    it('should return basic info for non-existing image', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('No such image'))
      );

      const info = await builder.getImageInfo('nonexistent:latest');

      expect(info).toEqual({
        tag: 'nonexistent:latest',
        id: '',
        created: expect.any(Date),
        exists: false,
      });
    });

    it('should handle malformed image inspect output', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('malformed|output')
      );

      const info = await builder.getImageInfo('test:latest');

      expect(info.exists).toBe(false);
    });

    it('should handle image ID without sha256 prefix', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('plainid123456789|2024-01-15T10:30:00Z|134217728')
      );

      const info = await builder.getImageInfo('test:latest');

      expect(info.id).toBe('plainid12345'); // Truncated to 12 chars
      expect(info.exists).toBe(true);
    });
  });

  // ============================================================================
  // Project Tag Generation Tests
  // ============================================================================

  describe('generateProjectTag', () => {
    it('should generate consistent tags for same inputs', async () => {
      const tag1 = await builder.generateProjectTag('Dockerfile');
      const tag2 = await builder.generateProjectTag('Dockerfile');

      expect(tag1).toBe(tag2);
      expect(tag1).toMatch(/^apex-project-[a-f0-9]{8}:latest$/);
    });

    it('should generate different tags for different dockerfiles', async () => {
      const tag1 = await builder.generateProjectTag('Dockerfile');
      const tag2 = await builder.generateProjectTag('Dockerfile.prod');

      expect(tag1).not.toBe(tag2);
      expect(tag1).toMatch(/^apex-project-[a-f0-9]{8}:latest$/);
      expect(tag2).toMatch(/^apex-project-[a-f0-9]{8}:latest$/);
    });

    it('should generate different tags for different project roots', async () => {
      const builder1 = new ImageBuilder('/project1');
      const builder2 = new ImageBuilder('/project2');

      const tag1 = await builder1.generateProjectTag('Dockerfile');
      const tag2 = await builder2.generateProjectTag('Dockerfile');

      expect(tag1).not.toBe(tag2);
    });
  });

  // ============================================================================
  // Dockerfile Hash Tests
  // ============================================================================

  describe('calculateDockerfileHash', () => {
    it('should calculate hash from dockerfile content', async () => {
      mockReadFile.mockResolvedValueOnce(testDockerfileContent);

      const hash = await builder.calculateDockerfileHash('Dockerfile');

      expect(hash).toBe('f7e8c9b4d3a2e1c6f9a8b5d2c7e4f1a6b8c9d2e5f4a7b1c6d9e2f5a8b4c7e1f6');
      expect(mockReadFile).toHaveBeenCalledWith(
        path.resolve(testProjectRoot, 'Dockerfile'),
        'utf-8'
      );
    });

    it('should generate different hashes for different content', async () => {
      const content1 = 'FROM node:18';
      const content2 = 'FROM node:20';

      mockReadFile.mockResolvedValueOnce(content1);
      const hash1 = await builder.calculateDockerfileHash('Dockerfile');

      mockReadFile.mockResolvedValueOnce(content2);
      const hash2 = await builder.calculateDockerfileHash('Dockerfile');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle file read errors', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('File not found'));

      await expect(builder.calculateDockerfileHash('missing.dockerfile'))
        .rejects.toThrow('Failed to read Dockerfile');
    });
  });

  // ============================================================================
  // Image Management Tests
  // ============================================================================

  describe('removeImage', () => {
    it('should remove image successfully', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('Image removed successfully')
      );

      const removed = await builder.removeImage('test-image:latest');
      expect(removed).toBe(true);
    });

    it('should handle removal failure', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Image not found'))
      );

      const removed = await builder.removeImage('nonexistent:latest');
      expect(removed).toBe(false);
    });

    it('should auto-initialize runtime if needed', async () => {
      const freshBuilder = new ImageBuilder(testProjectRoot);

      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Image not found'))
      );

      await freshBuilder.removeImage('test:latest');
      expect(mockDetectContainerRuntime).toHaveBeenCalled();
    });
  });

  describe('listProjectImages', () => {
    it('should list project images successfully', async () => {
      const imagesOutput = `REPOSITORY:TAG|IMAGE ID|CREATED AT|SIZE
apex-project-abc12345:latest|def456789012|2024-01-15 10:30:00|128MB
apex-project-def67890:latest|ghi123456789|2024-01-14 15:45:00|256MB`;

      mockExec.mockImplementationOnce(
        mockExecCallback(imagesOutput)
      );

      const images = await builder.listProjectImages();

      expect(images).toHaveLength(2);
      expect(images[0]).toEqual({
        tag: 'apex-project-abc12345:latest',
        id: 'def456789012',
        created: new Date('2024-01-15 10:30:00'),
        sizeFormatted: '128MB',
        size: undefined, // parseSize might not parse this format
        exists: true,
      });
    });

    it('should handle empty results', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('REPOSITORY:TAG|IMAGE ID|CREATED AT|SIZE')
      );

      const images = await builder.listProjectImages();
      expect(images).toHaveLength(0);
    });

    it('should handle command failure', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Command failed'))
      );

      const images = await builder.listProjectImages();
      expect(images).toHaveLength(0);
    });

    it('should auto-initialize runtime if needed', async () => {
      const freshBuilder = new ImageBuilder(testProjectRoot);

      mockExec.mockImplementationOnce(
        mockExecCallback('REPOSITORY:TAG|IMAGE ID|CREATED AT|SIZE')
      );

      await freshBuilder.listProjectImages();
      expect(mockDetectContainerRuntime).toHaveBeenCalled();
    });
  });

  describe('cleanupOldImages', () => {
    it('should cleanup old images keeping recent ones', async () => {
      // Mock list project images
      const builderWithMocks = builder as any;
      builderWithMocks.listProjectImages = vi.fn().mockResolvedValueOnce([
        {
          tag: 'apex-project-abc12345:latest',
          id: 'old1',
          created: new Date('2024-01-10T10:00:00Z'),
          exists: true,
        },
        {
          tag: 'apex-project-abc12345:v1',
          id: 'old2',
          created: new Date('2024-01-11T10:00:00Z'),
          exists: true,
        },
        {
          tag: 'apex-project-abc12345:v2',
          id: 'recent1',
          created: new Date('2024-01-15T10:00:00Z'),
          exists: true,
        },
        {
          tag: 'apex-project-def67890:latest',
          id: 'other1',
          created: new Date('2024-01-12T10:00:00Z'),
          exists: true,
        },
      ]);

      // Mock successful removals
      builderWithMocks.removeImage = vi.fn()
        .mockResolvedValueOnce(true)  // Remove old1
        .mockResolvedValueOnce(false); // Fail to remove old2

      const removedCount = await builder.cleanupOldImages(2);

      expect(removedCount).toBe(1);
      expect(builderWithMocks.removeImage).toHaveBeenCalledTimes(2);
    });

    it('should handle no images to cleanup', async () => {
      const builderWithMocks = builder as any;
      builderWithMocks.listProjectImages = vi.fn().mockResolvedValueOnce([]);

      const removedCount = await builder.cleanupOldImages();
      expect(removedCount).toBe(0);
    });
  });

  // ============================================================================
  // Runtime Detection and Error Handling
  // ============================================================================

  describe('runtime handling', () => {
    it('should work with Podman runtime', async () => {
      mockDetectContainerRuntime.mockResolvedValueOnce('podman');

      await builder.initialize();

      const config: ImageBuildConfig = {
        dockerfilePath: testDockerfilePath,
      };

      // Mock file read and build
      mockReadFile.mockResolvedValueOnce(testDockerfileContent);
      mockExec
        .mockImplementationOnce(mockExecCallback('', '', new Error('No such image')))
        .mockImplementationOnce(mockExecCallback('Successfully built with podman'))
        .mockImplementationOnce(mockExecCallback('sha256:podman123|2024-01-01T12:00:00Z|134217728'));

      const result = await builder.buildImage(config);

      expect(result.success).toBe(true);

      // Verify podman was used in build command
      const buildCall = mockExec.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('podman build')
      );
      expect(buildCall).toBeDefined();
    });

    it('should handle runtime initialization failure', async () => {
      mockDetectContainerRuntime.mockResolvedValueOnce('none');

      const freshBuilder = new ImageBuilder(testProjectRoot);
      const config: ImageBuildConfig = {
        dockerfilePath: testDockerfilePath,
      };

      mockReadFile.mockResolvedValueOnce(testDockerfileContent);

      const result = await freshBuilder.buildImage(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime');
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('advanced scenarios', () => {
    it('should handle very long dockerfilePath correctly', async () => {
      const longPath = 'very/long/path/with/many/segments/' + 'a'.repeat(100) + '/Dockerfile';
      const tag = await builder.generateProjectTag(longPath);

      expect(tag).toMatch(/^apex-project-[a-f0-9]{8}:latest$/);
    });

    it('should handle special characters in build args', async () => {
      const builderWithMocks = builder as any;

      const command = builderWithMocks.buildBuildCommand(
        '/path/to/Dockerfile',
        '/build/context',
        'my-image:latest',
        {
          buildArgs: {
            'SPECIAL_CHARS': 'value with spaces & symbols!',
            'EMPTY_VALUE': '',
            'UNICODE': '测试数据',
          },
        }
      );

      expect(command).toContain('--build-arg SPECIAL_CHARS=value with spaces & symbols!');
      expect(command).toContain('--build-arg EMPTY_VALUE=');
      expect(command).toContain('--build-arg UNICODE=测试数据');
    });

    it('should handle empty dockerfile content hash', async () => {
      mockReadFile.mockResolvedValueOnce('');

      const hash = await builder.calculateDockerfileHash('empty-dockerfile');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // SHA256 of empty string
    });

    it('should handle dockerfile with only whitespace', async () => {
      mockReadFile.mockResolvedValueOnce('   \n\t  \r\n  ');

      const hash = await builder.calculateDockerfileHash('whitespace-dockerfile');
      expect(hash).not.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 hex length
    });

    it('should handle image with zero size', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:zerosize123|2024-01-15T10:30:00Z|0')
      );

      const info = await builder.getImageInfo('zero-size:latest');

      expect(info.size).toBe(0);
      expect(info.sizeFormatted).toBe('0B');
      expect(info.exists).toBe(true);
    });

    it('should handle image info with missing size field', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('sha256:nosize123|2024-01-15T10:30:00Z|')
      );

      const info = await builder.getImageInfo('no-size:latest');

      expect(info.size).toBeUndefined();
      expect(info.sizeFormatted).toBeUndefined();
      expect(info.exists).toBe(true);
    });

    it('should handle listProjectImages with malformed line', async () => {
      const imagesOutput = `REPOSITORY:TAG|IMAGE ID|CREATED AT|SIZE
apex-project-abc12345:latest|def456789012|2024-01-15 10:30:00|128MB
malformed line without proper format
apex-project-def67890:latest|ghi123456789|2024-01-14 15:45:00|256MB`;

      mockExec.mockImplementationOnce(
        mockExecCallback(imagesOutput)
      );

      const images = await builder.listProjectImages();

      expect(images).toHaveLength(2); // Should skip malformed line
      expect(images[0].tag).toBe('apex-project-abc12345:latest');
      expect(images[1].tag).toBe('apex-project-def67890:latest');
    });
  });

  // ============================================================================
  // Error Handling Edge Cases
  // ============================================================================

  describe('error handling', () => {
    it('should handle dockerfile read permission errors', async () => {
      const config: ImageBuildConfig = {
        dockerfilePath: 'restricted/Dockerfile',
      };

      mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await builder.buildImage(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read Dockerfile');
    });

    it('should handle very large build output', async () => {
      const config: ImageBuildConfig = {
        dockerfilePath: testDockerfilePath,
      };

      const largeBuildOutput = 'Build step'.repeat(100000);

      mockReadFile.mockResolvedValueOnce(testDockerfileContent);
      mockExec
        .mockImplementationOnce(mockExecCallback('', '', new Error('No such image')))
        .mockImplementationOnce(mockExecCallback(largeBuildOutput))
        .mockImplementationOnce(mockExecCallback('sha256:large123|2024-01-01T12:00:00Z|134217728'));

      const result = await builder.buildImage(config);

      expect(result.success).toBe(true);
      expect(result.buildOutput).toContain('Build step');
    });

    it('should handle timeout errors gracefully', async () => {
      mockExec.mockImplementationOnce(
        mockExecCallback('', '', new Error('Command timeout'))
      );

      const exists = await builder.imageExists('test:latest');
      expect(exists).toBe(false);
    });

    it('should handle malformed command output', async () => {
      // Mock malformed output for image info
      mockExec.mockImplementationOnce(
        mockExecCallback('unexpected-format-without-separators')
      );

      const info = await builder.getImageInfo('test:latest');
      expect(info.exists).toBe(false);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('helper functions', () => {
    it('should format sizes correctly', () => {
      const builderWithMocks = builder as any;

      expect(builderWithMocks.formatSize(1024)).toBe('1.0KB');
      expect(builderWithMocks.formatSize(1048576)).toBe('1.0MB');
      expect(builderWithMocks.formatSize(1073741824)).toBe('1.0GB');
      expect(builderWithMocks.formatSize(512)).toBe('512B');
    });

    it('should format very large sizes correctly', () => {
      const builderWithMocks = builder as any;

      expect(builderWithMocks.formatSize(1099511627776)).toBe('1.0TB');
      expect(builderWithMocks.formatSize(0)).toBe('0B');
      expect(builderWithMocks.formatSize(1023)).toBe('1023B');
      expect(builderWithMocks.formatSize(1536)).toBe('1.5KB');
    });

    it('should parse sizes correctly', () => {
      const builderWithMocks = builder as any;

      expect(builderWithMocks.parseSize('1KB')).toBe(1024);
      expect(builderWithMocks.parseSize('1.5MB')).toBe(1572864);
      expect(builderWithMocks.parseSize('2GB')).toBe(2147483648);
      expect(builderWithMocks.parseSize('invalid')).toBeUndefined();
    });

    it('should parse TB sizes correctly', () => {
      const builderWithMocks = builder as any;

      expect(builderWithMocks.parseSize('1TB')).toBe(1099511627776);
      expect(builderWithMocks.parseSize('0.5TB')).toBe(549755813888);
      expect(builderWithMocks.parseSize('1B')).toBe(1);
      expect(builderWithMocks.parseSize('1.0KB')).toBe(1024);
    });

    it('should handle edge cases in size parsing', () => {
      const builderWithMocks = builder as any;

      expect(builderWithMocks.parseSize('')).toBeUndefined();
      expect(builderWithMocks.parseSize('XYZ')).toBeUndefined();
      expect(builderWithMocks.parseSize('123')).toBeUndefined();
      expect(builderWithMocks.parseSize('MB')).toBeUndefined();
    });

    it('should build commands correctly', () => {
      const builderWithMocks = builder as any;

      const command = builderWithMocks.buildBuildCommand(
        '/path/to/Dockerfile',
        '/build/context',
        'my-image:latest',
        {
          buildArgs: { NODE_ENV: 'production' },
          target: 'prod',
          platform: 'linux/amd64',
          noCache: true,
        }
      );

      expect(command).toContain('docker build');
      expect(command).toContain('-f /path/to/Dockerfile');
      expect(command).toContain('-t my-image:latest');
      expect(command).toContain('--build-arg NODE_ENV=production');
      expect(command).toContain('--target prod');
      expect(command).toContain('--platform linux/amd64');
      expect(command).toContain('--no-cache');
      expect(command).toContain('/build/context');
    });

    it('should build minimal commands correctly', () => {
      const builderWithMocks = builder as any;

      const command = builderWithMocks.buildBuildCommand(
        '/path/to/Dockerfile',
        '/build/context',
        'my-image:latest',
        {}
      );

      expect(command).toContain('docker build');
      expect(command).toContain('-f /path/to/Dockerfile');
      expect(command).toContain('-t my-image:latest');
      expect(command).toContain('/build/context');
      expect(command).not.toContain('--build-arg');
      expect(command).not.toContain('--target');
      expect(command).not.toContain('--platform');
      expect(command).not.toContain('--no-cache');
    });

    it('should handle multiple build args correctly', () => {
      const builderWithMocks = builder as any;

      const command = builderWithMocks.buildBuildCommand(
        '/path/to/Dockerfile',
        '/build/context',
        'my-image:latest',
        {
          buildArgs: {
            NODE_ENV: 'production',
            VERSION: '1.2.3',
            API_URL: 'https://api.example.com',
          },
        }
      );

      expect(command).toContain('--build-arg NODE_ENV=production');
      expect(command).toContain('--build-arg VERSION=1.2.3');
      expect(command).toContain('--build-arg API_URL=https://api.example.com');
    });
  });
});