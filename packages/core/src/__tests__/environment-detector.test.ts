/**
 * EnvironmentDetector Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentDetector, type DetectedEnvironmentVar, type EnvironmentDetectionResult } from '../environment-detector.js';
import type { MCPEnvironmentVar } from '../types.js';

vi.mock('fs/promises');

describe('EnvironmentDetector', () => {
  let detector: EnvironmentDetector;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    detector = new EnvironmentDetector(mockProjectPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with project path', () => {
      expect(detector).toBeDefined();
    });
  });

  describe('scanProject', () => {
    it('should find .env files in project root', async () => {
      // Mock fs.access to simulate .env file existing
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      // Mock fs.readFile for .env content
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('TEST_VAR=value123\nPORT=3000');

      // Mock fs.readdir for subdirectory scanning
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      const result = await detector.scanProject();

      expect(result.envFiles).toContain('.env');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('TEST_VAR');
      expect(result.variables[1].name).toBe('PORT');
    });

    it('should find .env files in subdirectories', async () => {
      // Mock fs.access
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, 'backend', '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      // Mock fs.readFile
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('PORT=3000\nHOST=localhost');

      // Mock fs.readdir for subdirectory scanning
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([
        { name: 'backend', isDirectory: () => true } as any,
        { name: 'node_modules', isDirectory: () => true } as any,
        { name: '.git', isDirectory: () => true } as any,
      ]);

      const result = await detector.scanProject();

      expect(result.envFiles).toContain('backend/.env');
      expect(result.variables[0].source).toBe('backend/.env');
    });

    it('should handle directory scan errors gracefully', async () => {
      // Mock fs.readdir to fail
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      // Mock fs.access to reject all files
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockRejectedValue(new Error('File not found'));

      const result = await detector.scanProject();

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Failed to scan subdirectories');
    });
  });

  describe('parseEnvFile', () => {
    it('should parse basic KEY=VALUE format', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('TEST_VAR=value123\nPORT=3000');

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables).toHaveLength(2);
      expect(variables[0].name).toBe('TEST_VAR');
      expect(variables[1].name).toBe('PORT');
      expect(variables[1].pattern).toBe('port');
    });

    it('should handle quoted values', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('NAME="John Doe"\nPATH=\'/usr/bin:/bin\'');

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables).toHaveLength(2);
      expect(variables[0].value).toBe('John Doe');
      expect(variables[1].value).toBe('/usr/bin:/bin');
    });

    it('should skip comments and empty lines', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# This is a comment
TEST_VAR=value123

# Another comment
PORT=3000`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables).toHaveLength(2);
      expect(variables[0].name).toBe('TEST_VAR');
      expect(variables[1].name).toBe('PORT');
    });

    it('should detect patterns correctly', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`TEST_API_KEY=testvalue
PORT=3000
NODE_ENV=development`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables).toHaveLength(3);

      // Check pattern detection
      const testKey = variables.find(v => v.name === 'TEST_API_KEY');
      expect(testKey?.pattern).toBe('api-key');
      expect(testKey?.sensitive).toBe(true);

      const port = variables.find(v => v.name === 'PORT');
      expect(port?.pattern).toBe('port');
      expect(port?.sensitive).toBe(false);

      const nodeEnv = variables.find(v => v.name === 'NODE_ENV');
      expect(nodeEnv?.pattern).toBe('environment');
      expect(nodeEnv?.sensitive).toBe(false);
    });

    it('should handle file read errors', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      const filePath = path.join(mockProjectPath, '.env');

      await expect(detector.parseEnvFile(filePath)).rejects.toThrow('Failed to parse .env file');
    });
  });

  describe('mapToMCPRequirements', () => {
    it('should identify satisfied requirements', async () => {
      const detectedVars: DetectedEnvironmentVar[] = [
        {
          name: 'TEST_VAR',
          value: 'value123',
          source: '.env',
          sensitive: false,
        },
        {
          name: 'PORT',
          value: '3000',
          source: '.env',
          sensitive: false,
          pattern: 'port',
        },
      ];

      const requiredVars: MCPEnvironmentVar[] = [
        {
          name: 'TEST_VAR',
          description: 'Test variable',
          required: true,
          sensitive: false,
        },
        {
          name: 'DATABASE_URL',
          description: 'Database connection URL',
          required: true,
          sensitive: true,
        },
      ];

      const result = await detector.mapToMCPRequirements(detectedVars, requiredVars);

      expect(result.satisfied).toHaveLength(1);
      expect(result.satisfied[0].name).toBe('TEST_VAR');
      expect(result.satisfied[0].source).toBe('user');

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].name).toBe('DATABASE_URL');
    });

    it('should provide suggestions for similar variables', async () => {
      const detectedVars: DetectedEnvironmentVar[] = [
        {
          name: 'TEST_API_KEY',
          value: 'masked123',
          source: '.env',
          sensitive: true,
          pattern: 'api-key',
        },
        {
          name: 'DB_CONNECTION_STRING',
          value: 'connection123',
          source: '.env',
          sensitive: true,
          pattern: 'database-url',
        },
      ];

      const requiredVars: MCPEnvironmentVar[] = [
        {
          name: 'API_KEY',
          description: 'API key for service',
          required: true,
          sensitive: true,
        },
        {
          name: 'DATABASE_URL',
          description: 'Database connection URL',
          required: true,
          sensitive: true,
        },
      ];

      const result = await detector.mapToMCPRequirements(detectedVars, requiredVars);

      expect(result.suggestions).toHaveLength(2);

      const keySuggestion = result.suggestions.find(s => s.required.name === 'API_KEY');
      expect(keySuggestion?.suggestions[0].name).toBe('TEST_API_KEY');

      const dbSuggestion = result.suggestions.find(s => s.required.name === 'DATABASE_URL');
      expect(dbSuggestion?.suggestions[0].name).toBe('DB_CONNECTION_STRING');
    });
  });

  describe('detectEnvironmentVariables', () => {
    it('should return complete detection result', async () => {
      // Mock file system calls
      const mockAccess = vi.mocked(fs.access);
      mockAccess.mockImplementation((filePath) => {
        if (filePath === path.join(mockProjectPath, '.env')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('TEST_VAR=value123\nPORT=3000');

      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      const requiredVars: MCPEnvironmentVar[] = [
        {
          name: 'TEST_VAR',
          description: 'Test variable',
          required: true,
          sensitive: false,
        },
        {
          name: 'DATABASE_URL',
          description: 'Database connection URL',
          required: true,
          sensitive: true,
        },
      ];

      const result = await detector.detectEnvironmentVariables(requiredVars);

      expect(result.available).toHaveLength(2);
      expect(result.required).toHaveLength(2);
      expect(result.satisfied).toHaveLength(1);
      expect(result.missing).toHaveLength(1);
      expect(result.envFiles).toContain('.env');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('pattern detection', () => {
    it('should detect API key patterns', () => {
      const detector = new EnvironmentDetector('/test');
      const patterns = [
        'TEST_API_KEY',
        'SERVICE_API_KEY',
        'API_KEY',
      ];

      for (const pattern of patterns) {
        const result = (detector as any).detectVariablePattern(pattern);
        expect(result?.type).toBe('api-key');
        expect(result?.sensitive).toBe(true);
      }
    });

    it('should detect port and host patterns', () => {
      const detector = new EnvironmentDetector('/test');

      const portPatterns = ['PORT', 'SERVER_PORT', 'API_PORT'];
      for (const pattern of portPatterns) {
        const result = (detector as any).detectVariablePattern(pattern);
        expect(result?.type).toBe('port');
        expect(result?.sensitive).toBe(false);
      }

      const hostPatterns = ['HOST', 'SERVER_HOST', 'API_HOST'];
      for (const pattern of hostPatterns) {
        const result = (detector as any).detectVariablePattern(pattern);
        expect(result?.type).toBe('host');
        expect(result?.sensitive).toBe(false);
      }
    });
  });

  describe('value masking', () => {
    it('should mask short values completely', () => {
      const detector = new EnvironmentDetector('/test');
      const masked = (detector as any).maskSensitiveValue('short');
      expect(masked).toBe('*****');
    });

    it('should mask long values with start and end visible', () => {
      const detector = new EnvironmentDetector('/test');
      const masked = (detector as any).maskSensitiveValue('this-is-a-very-long-value');
      expect(masked).toBe('thi********lue');
    });

    it('should handle medium length values', () => {
      const detector = new EnvironmentDetector('/test');
      const masked = (detector as any).maskSensitiveValue('mediumvalue');
      expect(masked).toBe('med***lue');
    });
  });

  describe('similarity detection', () => {
    it('should find similar variable names', () => {
      const detector = new EnvironmentDetector('/test');

      const required: MCPEnvironmentVar = {
        name: 'API_KEY',
        description: 'API key',
        required: true,
        sensitive: true,
      };

      const detected: DetectedEnvironmentVar[] = [
        {
          name: 'SERVICE_API_KEY',
          value: 'masked123',
          source: '.env',
          sensitive: true,
          pattern: 'api-key',
        },
        {
          name: 'PORT',
          value: '3000',
          source: '.env',
          sensitive: false,
          pattern: 'port',
        },
      ];

      const similar = (detector as any).findSimilarVariables(required, detected);

      expect(similar).toHaveLength(1);
      expect(similar[0].name).toBe('SERVICE_API_KEY');
    });

    it('should return empty array when no similar variables found', () => {
      const detector = new EnvironmentDetector('/test');

      const required: MCPEnvironmentVar = {
        name: 'UNIQUE_VARIABLE',
        description: 'Unique variable',
        required: true,
        sensitive: false,
      };

      const detected: DetectedEnvironmentVar[] = [
        {
          name: 'PORT',
          value: '3000',
          source: '.env',
          sensitive: false,
          pattern: 'port',
        },
      ];

      const similar = (detector as any).findSimilarVariables(required, detected);
      expect(similar).toHaveLength(0);
    });
  });
});