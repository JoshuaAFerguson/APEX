/**
 * @fileoverview End-to-end tests for MCP validate command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { validateMCPConfig } from '@apex/core';

vi.mock('@apex/core');
const mockValidateMCPConfig = vi.mocked(validateMCPConfig);

describe('MCP Validate E2E Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  it('should validate configuration structure', async () => {
    const testConfig = {
      mcp: {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      },
    };

    mockValidateMCPConfig.mockResolvedValue({
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });

    const result = await validateMCPConfig(testConfig.mcp);
    expect(result.isValid).toBe(true);
    expect(mockValidateMCPConfig).toHaveBeenCalledWith(testConfig.mcp);
  });

  it('should handle validation errors', async () => {
    const invalidConfig = {
      mcp: {
        enabled: true,
        servers: {
          'broken': {
            args: ['missing-command'],
          },
        },
      },
    };

    mockValidateMCPConfig.mockResolvedValue({
      isValid: false,
      issues: [
        {
          code: 'MISSING_COMMAND',
          message: 'Command is required',
          severity: 'error' as const,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
    });

    const result = await validateMCPConfig(invalidConfig.mcp);
    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBe(1);
  });
});