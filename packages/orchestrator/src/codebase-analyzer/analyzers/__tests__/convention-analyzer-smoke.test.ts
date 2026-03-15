/**
 * ConventionAnalyzer Smoke Test
 * Quick smoke test to verify core functionality works
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Smoke Test', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `smoke-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should return valid ConventionAnalysis schema for basic project', async () => {
    const srcDir = join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Create a simple test file
    const testCode = `
/**
 * Test function with JSDoc
 */
function testFunction() {
  return 'test';
}

function undocumentedFunction() {
  return 'undocumented';
}

/**
 * Test class
 */
class TestClass {
  constructor() {}
}
`;

    await fs.writeFile(join(srcDir, 'test.js'), testCode);

    const result = await analyzer.analyze(testDir);

    // Should not throw when validating against schema
    expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

    // Basic assertions
    expect(result).toHaveProperty('documentation');
    expect(result.documentation).toHaveProperty('style');
    expect(result.documentation).toHaveProperty('coverage');

    expect(result.documentation.style).toBe('jsdoc');
    expect(result.documentation.coverage).toBe(67); // 2 out of 3 documented (67%)

    // Verify all required fields are present
    expect(result).toHaveProperty('fileNaming');
    expect(result).toHaveProperty('functionNaming');
    expect(result).toHaveProperty('variableNaming');
    expect(result).toHaveProperty('indentation');
    expect(result).toHaveProperty('imports');
    expect(result).toHaveProperty('organization');
  });

  it('should handle empty project gracefully', async () => {
    const result = await analyzer.analyze(testDir);

    expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
    expect(result.documentation.style).toBe('none');
    expect(result.documentation.coverage).toBe(0);
  });

  it('should handle AMD imports correctly', async () => {
    const srcDir = join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const amdCode = `
define(['jquery'], function($) {
  return {
    init: function() {
      console.log('AMD module');
    }
  };
});
`;

    await fs.writeFile(join(srcDir, 'amd-module.js'), amdCode);

    const result = await analyzer.analyze(testDir);

    expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
    expect(result.imports.style).toBe('amd');
  });

  it('should handle UMD imports correctly', async () => {
    const srcDir = join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const umdCode = `
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.myModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    return { version: '1.0.0' };
}));
`;

    await fs.writeFile(join(srcDir, 'umd-module.js'), umdCode);

    const result = await analyzer.analyze(testDir);

    expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
    expect(result.imports.style).toBe('umd');
  });
});