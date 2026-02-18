/**
 * EnvVarDetector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { EnvVarDetector } from './env-detector.js';
import type { MCPEnvironmentVar } from '@apexcli/core';

vi.mock('fs');

describe('EnvVarDetector', () => {
  let detector: EnvVarDetector;
  let mockEnv: Record<string, string | undefined>;

  beforeEach(() => {
    mockEnv = { TEST_VAR: 'test' };
    detector = new EnvVarDetector('/test/path', mockEnv);
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(detector).toBeDefined();
  });

  it('should detect existing variables', async () => {
    const envVars: MCPEnvironmentVar[] = [{
      name: 'TEST_VAR',
      description: 'Test',
      required: true,
      sensitive: false,
    }];

    const result = await detector.detectEnvironmentVariables(envVars);
    expect(result.found).toHaveLength(1);
    expect(result.found[0].name).toBe('TEST_VAR');
  });

  it('should resolve variables from environment', () => {
    const result = detector.resolveEnvVariable('TEST_VAR');
    expect(result?.value).toBe('test');
    expect(result?.source).toBe('env');
  });

  it('should validate patterns correctly', () => {
    const envVar: MCPEnvironmentVar = {
      name: 'VAR',
      description: 'Test',
      required: true,
      sensitive: false,
      pattern: '^test$',
    };

    expect(detector.validateEnvironmentVariable(envVar, 'test')).toBe(true);
    expect(detector.validateEnvironmentVariable(envVar, 'fail')).toBe(false);
  });
});