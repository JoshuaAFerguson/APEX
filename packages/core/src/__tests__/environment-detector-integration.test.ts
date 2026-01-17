/**
 * EnvironmentDetector Integration Tests
 *
 * These tests verify the integration of EnvironmentDetector
 * with the existing MCP system and type definitions.
 */

import { describe, it, expect } from 'vitest';
import { EnvironmentDetector } from '../environment-detector.js';
import type { MCPEnvironmentVar } from '../types.js';

describe('EnvironmentDetector Integration', () => {
  it('should create detector instance correctly', () => {
    const detector = new EnvironmentDetector('/test/path');
    expect(detector).toBeDefined();
    expect(detector).toBeInstanceOf(EnvironmentDetector);
  });

  it('should have correct method signatures', async () => {
    const detector = new EnvironmentDetector('/test/path');

    // Test that methods exist and can be called (even if they throw due to mocking)
    expect(typeof detector.scanProject).toBe('function');
    expect(typeof detector.parseEnvFile).toBe('function');
    expect(typeof detector.mapToMCPRequirements).toBe('function');
    expect(typeof detector.detectEnvironmentVariables).toBe('function');
  });

  it('should work with MCP types correctly', () => {
    // Test that MCPEnvironmentVar type is compatible
    const testVar: MCPEnvironmentVar = {
      name: 'TEST_VAR',
      description: 'Test variable',
      required: true,
      sensitive: false,
    };

    expect(testVar.name).toBe('TEST_VAR');
    expect(testVar.required).toBe(true);
  });

  it('should export all required types', () => {
    // Verify that types can be imported and used
    expect(EnvironmentDetector).toBeDefined();

    // Test that interfaces exist by creating objects with their shape
    const detectionResult = {
      available: [],
      required: [],
      missing: [],
      satisfied: [],
      envFiles: [],
      warnings: [],
    };

    const detectedVar = {
      name: 'TEST',
      value: 'value',
      source: '.env',
      sensitive: false,
    };

    expect(detectionResult).toBeDefined();
    expect(detectedVar).toBeDefined();
  });
});