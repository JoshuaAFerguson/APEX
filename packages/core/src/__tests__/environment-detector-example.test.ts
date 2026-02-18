/**
 * EnvironmentDetector Usage Example
 *
 * This test demonstrates how to use the EnvironmentDetector
 * in a real-world scenario with MCP server configuration.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs/promises';
import { EnvironmentDetector } from '../environment-detector.js';
import type { MCPEnvironmentVar } from '../types.js';

vi.mock('fs/promises');

describe('EnvironmentDetector Usage Example', () => {
  it('should detect environment variables and map to MCP requirements', async () => {
    // Mock project structure with .env file
    const mockAccess = vi.mocked(fs.access);
    mockAccess.mockImplementation((filePath) => {
      if (filePath.toString().endsWith('.env')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValue(`# Project environment variables
OPENAI_API_KEY=sk-example123456789
DATABASE_URL=postgresql://localhost:5432/myapp
PORT=3000
NODE_ENV=development
DEBUG=true`);

    const mockReaddir = vi.mocked(fs.readdir);
    mockReaddir.mockResolvedValue([]);

    // Create detector for project
    const detector = new EnvironmentDetector('/path/to/project');

    // Define MCP server requirements
    const mcpRequirements: MCPEnvironmentVar[] = [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for language models',
        required: true,
        sensitive: true,
        pattern: '^sk-[a-zA-Z0-9]+$',
      },
      {
        name: 'DATABASE_URL',
        description: 'Database connection URL',
        required: true,
        sensitive: true,
      },
      {
        name: 'REDIS_URL',
        description: 'Redis connection URL',
        required: false,
        sensitive: true,
      },
    ];

    // Detect environment variables
    const result = await detector.detectEnvironmentVariables(mcpRequirements);

    // Verify detection results
    expect(result.available).toHaveLength(5); // All detected variables
    expect(result.required).toHaveLength(3); // All MCP requirements
    expect(result.satisfied).toHaveLength(2); // OPENAI_API_KEY and DATABASE_URL
    expect(result.missing).toHaveLength(1); // REDIS_URL
    expect(result.envFiles).toContain('.env');

    // Verify satisfied variables have correct metadata
    const satisfiedApiKey = result.satisfied.find(v => v.name === 'OPENAI_API_KEY');
    expect(satisfiedApiKey).toBeDefined();
    expect(satisfiedApiKey?.source).toBe('user');
    expect(satisfiedApiKey?.sensitive).toBe(true);

    // Verify missing variables
    const missingRedisUrl = result.missing.find(v => v.name === 'REDIS_URL');
    expect(missingRedisUrl).toBeDefined();
    expect(missingRedisUrl?.required).toBe(false);

    // Verify available variables detected correctly
    const availableApiKey = result.available.find(v => v.name === 'OPENAI_API_KEY');
    expect(availableApiKey?.pattern).toBe('api-key');
    expect(availableApiKey?.sensitive).toBe(true);

    const availablePort = result.available.find(v => v.name === 'PORT');
    expect(availablePort?.pattern).toBe('port');
    expect(availablePort?.sensitive).toBe(false);

    const availableNodeEnv = result.available.find(v => v.name === 'NODE_ENV');
    expect(availableNodeEnv?.pattern).toBe('environment');
    expect(availableNodeEnv?.sensitive).toBe(false);
  });

  it('should provide helpful suggestions for missing variables', async () => {
    // Mock project with similar but not exact variable names
    const mockAccess = vi.mocked(fs.access);
    mockAccess.mockImplementation((filePath) => {
      if (filePath.toString().endsWith('.env')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValue(`OPENAI_KEY=sk-example123456789
DB_CONNECTION_STRING=postgresql://localhost:5432/myapp
APP_PORT=3000`);

    const mockReaddir = vi.mocked(fs.readdir);
    mockReaddir.mockResolvedValue([]);

    const detector = new EnvironmentDetector('/path/to/project');

    // Standard MCP requirements
    const mcpRequirements: MCPEnvironmentVar[] = [
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
      {
        name: 'PORT',
        description: 'Application port',
        required: false,
        sensitive: false,
      },
    ];

    const detected = await detector.scanProject();
    const mapping = await detector.mapToMCPRequirements(detected.variables, mcpRequirements);

    // Should find no exact matches but provide suggestions
    expect(mapping.satisfied).toHaveLength(0);
    expect(mapping.missing).toHaveLength(3);
    expect(mapping.suggestions).toHaveLength(3);

    // Verify suggestions are reasonable
    const apiKeySuggestion = mapping.suggestions.find(s => s.required.name === 'API_KEY');
    expect(apiKeySuggestion?.suggestions).toHaveLength(1);
    expect(apiKeySuggestion?.suggestions[0].name).toBe('OPENAI_KEY');

    const dbSuggestion = mapping.suggestions.find(s => s.required.name === 'DATABASE_URL');
    expect(dbSuggestion?.suggestions).toHaveLength(1);
    expect(dbSuggestion?.suggestions[0].name).toBe('DB_CONNECTION_STRING');

    const portSuggestion = mapping.suggestions.find(s => s.required.name === 'PORT');
    expect(portSuggestion?.suggestions).toHaveLength(1);
    expect(portSuggestion?.suggestions[0].name).toBe('APP_PORT');
  });
});