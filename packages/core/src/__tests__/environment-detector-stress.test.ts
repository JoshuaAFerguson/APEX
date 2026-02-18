/**
 * EnvironmentDetector Stress and Performance Tests
 *
 * Tests for performance, large file handling, and edge cases
 * without sensitive content patterns.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentDetector, type DetectedEnvironmentVar } from '../environment-detector.js';
import type { MCPEnvironmentVar } from '../types.js';

vi.mock('fs/promises');

describe('EnvironmentDetector Stress Tests', () => {
  let detector: EnvironmentDetector;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    detector = new EnvironmentDetector(mockProjectPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large File Handling', () => {
    it('should handle files with many variables', async () => {
      // Generate a large .env file with 1000 variables
      const lines = ['# Large environment file'];
      for (let i = 0; i < 1000; i++) {
        lines.push(`VAR_${i.toString().padStart(4, '0')}=value_${i}`);
      }

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(lines.join('\n'));

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await detector.scanProject();

      expect(result.variables).toHaveLength(1000);
      expect(result.envFiles).toContain('.env');
      expect(result.variables[0].name).toBe('VAR_0000');
      expect(result.variables[999].name).toBe('VAR_0999');
    });

    it('should handle files with very long lines', async () => {
      const longValue = 'x'.repeat(10000);
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`NORMAL_VAR=value
LONG_VAR=${longValue}
ANOTHER_VAR=value2`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables).toHaveLength(3);
      const longVar = variables.find(v => v.name === 'LONG_VAR');
      expect(longVar?.value).toHaveLength(10000);
    });

    it('should handle many comment lines efficiently', async () => {
      const lines = [];
      // Add 500 comment lines
      for (let i = 0; i < 500; i++) {
        lines.push(`# Comment line ${i}`);
      }
      // Add some actual variables
      lines.push('VAR1=value1');
      lines.push('VAR2=value2');
      lines.push('VAR3=value3');

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(lines.join('\n'));

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Should only parse the 3 actual variables
      expect(variables).toHaveLength(3);
      expect(variables.map(v => v.name)).toEqual(['VAR1', 'VAR2', 'VAR3']);
    });
  });

  describe('Error Handling', () => {
    it('should handle file permission errors gracefully', async () => {
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      // parseEnvFile should throw on permission error
      const filePath = path.join(mockProjectPath, '.env');
      await expect(detector.parseEnvFile(filePath)).rejects.toThrow('Failed to parse .env file');

      // But scanProject should handle it gracefully by not including the file
      const result = await detector.scanProject();
      expect(result.envFiles).toHaveLength(0);
      expect(result.variables).toHaveLength(0);
    });

    it('should handle corrupted file content gracefully', async () => {
      // Simulate file with null bytes and other binary content
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('VAR1=value1\x00\x01\x02\nVAR2=value2\n');

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Should still parse valid lines
      expect(variables).toHaveLength(2);
      expect(variables[0].name).toBe('VAR1');
      expect(variables[1].name).toBe('VAR2');
    });

    it('should handle directory scan failures gracefully', async () => {
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockRejectedValue(new Error('File not found'));

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const result = await detector.scanProject();

      expect(result.envFiles).toHaveLength(0);
      expect(result.variables).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Failed to scan subdirectories');
    });
  });

  describe('Complex Directory Structure', () => {
    it('should scan multiple subdirectories correctly', async () => {
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        const allowedPaths = [
          path.join(mockProjectPath, 'backend', '.env'),
          path.join(mockProjectPath, 'frontend', '.env.local'),
          path.join(mockProjectPath, 'api', '.env.production'),
        ];
        if (allowedPaths.includes(filePath.toString())) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('backend')) {
          return Promise.resolve('BACKEND_VAR=backend_value\nPORT=3001');
        }
        if (filePath.toString().includes('frontend')) {
          return Promise.resolve('FRONTEND_VAR=frontend_value\nPORT=3000');
        }
        if (filePath.toString().includes('api')) {
          return Promise.resolve('API_VAR=api_value\nPORT=4000');
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([
        { name: 'backend', isDirectory: () => true },
        { name: 'frontend', isDirectory: () => true },
        { name: 'api', isDirectory: () => true },
        { name: 'node_modules', isDirectory: () => true }, // Should be ignored
        { name: '.git', isDirectory: () => true }, // Should be ignored
        { name: 'package.json', isDirectory: () => false },
      ] as any);

      const result = await detector.scanProject();

      expect(result.envFiles).toHaveLength(3);
      expect(result.envFiles).toContain('backend/.env');
      expect(result.envFiles).toContain('frontend/.env.local');
      expect(result.envFiles).toContain('api/.env.production');

      expect(result.variables).toHaveLength(6); // 2 vars per file × 3 files

      // Check that source paths are correct
      const backendVar = result.variables.find(v => v.name === 'BACKEND_VAR');
      expect(backendVar?.source).toBe('backend/.env');

      const frontendVar = result.variables.find(v => v.name === 'FRONTEND_VAR');
      expect(frontendVar?.source).toBe('frontend/.env.local');

      const apiVar = result.variables.find(v => v.name === 'API_VAR');
      expect(apiVar?.source).toBe('api/.env.production');
    });

    it('should ignore hidden directories and node_modules', async () => {
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockRejectedValue(new Error('File not found'));

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: '.git', isDirectory: () => true },
        { name: '.vscode', isDirectory: () => true },
        { name: '.next', isDirectory: () => true },
        { name: 'validdir', isDirectory: () => true },
      ] as any);

      const result = await detector.scanProject();

      // Should not scan hidden directories or node_modules
      expect(mockAccess).toHaveBeenCalledWith(
        expect.stringContaining('validdir')
      );
      expect(mockAccess).not.toHaveBeenCalledWith(
        expect.stringContaining('node_modules')
      );
      expect(mockAccess).not.toHaveBeenCalledWith(
        expect.stringContaining('.git')
      );
    });
  });

  describe('Mapping Performance', () => {
    it('should handle large numbers of detected and required variables', async () => {
      // Generate many detected variables
      const detectedVars: DetectedEnvironmentVar[] = [];
      for (let i = 0; i < 500; i++) {
        detectedVars.push({
          name: `DETECTED_VAR_${i}`,
          value: `value_${i}`,
          source: '.env',
          sensitive: false,
          pattern: i % 10 === 0 ? 'port' : undefined,
        });
      }

      // Generate many required variables with some overlap
      const requiredVars: MCPEnvironmentVar[] = [];
      for (let i = 0; i < 200; i++) {
        requiredVars.push({
          name: i < 50 ? `DETECTED_VAR_${i * 2}` : `REQUIRED_VAR_${i}`,
          description: `Variable ${i}`,
          required: true,
          sensitive: false,
        });
      }

      const startTime = Date.now();
      const result = await detector.mapToMCPRequirements(detectedVars, requiredVars);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify results
      expect(result.satisfied).toHaveLength(25); // 50 overlapping variables / 2
      expect(result.missing).toHaveLength(175); // 200 - 25 satisfied
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate excessive data during repeated scans', async () => {
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('VAR1=value1\nVAR2=value2\nVAR3=value3');

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      // Run multiple scans
      for (let i = 0; i < 10; i++) {
        const result = await detector.scanProject();
        expect(result.variables).toHaveLength(3);
        expect(result.envFiles).toHaveLength(1);
      }

      // Each scan should produce consistent results
      const finalResult = await detector.scanProject();
      expect(finalResult.variables).toHaveLength(3);
      expect(finalResult.envFiles).toHaveLength(1);
    });
  });
});