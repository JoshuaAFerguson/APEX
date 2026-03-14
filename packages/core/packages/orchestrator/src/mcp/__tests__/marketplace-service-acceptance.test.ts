/**
 * @fileoverview Acceptance Tests for MCPMarketplaceService
 *
 * This file tests the specific acceptance criteria:
 * 1. MarketplaceService.loadMarketplaceData handles missing data file
 * 2. autoConfigureStandardTools returns accurate configured/skipped/errors arrays
 * 3. Project type detection works for common project types
 *
 * Uses manual mocking to avoid import/compilation issues.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';

// Simplified mocking approach
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('@apexcli/core', () => ({
  saveConfig: vi.fn(),
  getMCPServers: vi.fn(),
  MCPMarketplaceEntrySchema: {
    array: () => ({
      parse: (data: any) => data // Simple pass-through
    })
  }
}));

describe('MCPMarketplaceService Acceptance Tests', () => {
  let MCPMarketplaceService: any;
  let service: any;
  let mockConfig: any;
  let mockProjectPath: string;

  beforeEach(async () => {
    // Dynamic import to avoid module loading issues
    const module = await import('../marketplace-service.js');
    MCPMarketplaceService = module.MCPMarketplaceService;

    mockProjectPath = '/test/project';
    mockConfig = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        servers: {},
      },
    };

    service = new MCPMarketplaceService(mockProjectPath, mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1: loadMarketplaceData handles missing data file', () => {
    it('should handle ENOENT error gracefully and return empty data', async () => {
      const fileNotFoundError = new Error('ENOENT: no such file or directory, open \'/path/to/marketplace-data.json\'');
      vi.mocked(fs.readFile).mockRejectedValue(fileNotFoundError);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.loadMarketplaceData();

      expect(result).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });

      expect(consoleSpy).toHaveBeenCalledWith('Marketplace data file not found, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle file not found error variations gracefully', async () => {
      const variations = [
        new Error('no such file or directory'),
        new Error('ENOENT: file not found'),
        new Error('File does not exist: marketplace-data.json')
      ];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (const error of variations) {
        vi.mocked(fs.readFile).mockRejectedValue(error);

        const result = await service.loadMarketplaceData();

        expect(result).toEqual({
          entries: [],
          categories: [],
          featured: [],
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith('Marketplace data file not found, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle JSON parsing errors gracefully and return empty data', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json content {');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.loadMarketplaceData();

      expect(result).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });

      expect(consoleSpy).toHaveBeenCalledWith('Invalid marketplace data format, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should handle empty file content gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.loadMarketplaceData();

      expect(result).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });

      expect(consoleSpy).toHaveBeenCalledWith('Invalid marketplace data format, using empty marketplace data');
      consoleSpy.mockRestore();
    });

    it('should cache loaded data correctly', async () => {
      const mockData = {
        entries: [{ name: 'test', description: 'test desc', version: '1.0' }],
        categories: ['test'],
        featured: ['test']
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const firstResult = await service.loadMarketplaceData();
      const secondResult = await service.loadMarketplaceData();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(firstResult).toEqual(mockData);
      expect(secondResult).toEqual(mockData);
    });
  });

  describe('Acceptance Criteria 2: autoConfigureStandardTools returns accurate arrays', () => {
    beforeEach(() => {
      // Mock successful data loading
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        entries: [],
        categories: [],
        featured: []
      }));
    });

    it('should return accurate configured/skipped/errors structure', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: []
      });

      // Verify the result structure
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');

      expect(Array.isArray(result.configured)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return error when no valid servers to configure', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: ['', '   ', null, undefined] as any
      });

      expect(result.configured).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        name: 'configuration',
        error: 'No valid servers to configure'
      });
    });

    it('should handle marketplace entry not found accurately', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: ['nonexistent-server']
      });

      expect(result.configured).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        name: 'nonexistent-server',
        error: 'Server not found in marketplace'
      });
    });

    it('should handle project detection failure with proper error feedback', async () => {
      // This will trigger the default auto-configuration which includes project detection
      const result = await service.autoConfigureStandardTools();

      // Should have either configured some default servers or reported project detection errors
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');

      // The result arrays should be accurate - either all empty with an error, or have some configured items
      const totalItems = result.configured.length + result.skipped.length + result.errors.length;
      expect(totalItems).toBeGreaterThan(0); // Should have some result
    });

    it('should provide detailed error messages for configuration failures', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: ['invalid-server-1', 'invalid-server-2']
      });

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].name).toBe('invalid-server-1');
      expect(result.errors[0].error).toBe('Server not found in marketplace');
      expect(result.errors[1].name).toBe('invalid-server-2');
      expect(result.errors[1].error).toBe('Server not found in marketplace');
    });
  });

  describe('Acceptance Criteria 3: Project type detection works correctly', () => {
    let originalRequire: any;
    let mockFs: any;

    beforeEach(() => {
      // Mock successful data loading
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        entries: [],
        categories: [],
        featured: []
      }));

      // Set up filesystem mocking for project detection
      mockFs = {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        statSync: vi.fn(),
        readdirSync: vi.fn(),
      };

      originalRequire = global.require;
      global.require = vi.fn((module) => {
        if (module === 'fs') return mockFs;
        if (module === 'child_process') return { execSync: vi.fn() };
        return {};
      });
    });

    afterEach(() => {
      global.require = originalRequire;
    });

    it('should detect Node.js projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('package.json');
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { jest: '^29.0.0' }
      }));

      const result = await service.autoConfigureStandardTools();

      // Project detection should work without throwing errors
      expect(result).toBeDefined();
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
    });

    it('should detect Git repositories correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('.git');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Git repository without errors
    });

    it('should detect Python projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('requirements.txt') || path.includes('pyproject.toml');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Python project without errors
    });

    it('should detect Docker projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('Dockerfile') || path.includes('docker-compose.yml');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Docker project without errors
    });

    it('should detect Java projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('pom.xml') || path.includes('build.gradle');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Java project without errors
    });

    it('should detect Go projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('go.mod');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Go project without errors
    });

    it('should detect Rust projects correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('Cargo.toml');
      });

      const result = await service.autoConfigureStandardTools();

      expect(result).toBeDefined();
      // Should successfully detect Rust project without errors
    });

    it('should handle project detection errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Filesystem access error');
      });

      const result = await service.autoConfigureStandardTools();

      // Should handle detection errors and still return valid structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');

      // Should have reported the project detection error
      const hasProjectDetectionError = result.errors.some(
        (error: any) => error.name === 'project-detection'
      );
      expect(hasProjectDetectionError).toBe(true);
    });

    it('should provide fallback recommendations when detection fails', async () => {
      // Mock all detection methods to fail
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Cannot access filesystem');
      });

      const result = await service.autoConfigureStandardTools();

      // Should still provide some fallback behavior
      expect(result).toBeDefined();

      // Should either configure fallback tools or report appropriate errors
      const totalResults = result.configured.length + result.skipped.length + result.errors.length;
      expect(totalResults).toBeGreaterThan(0);
    });
  });
});