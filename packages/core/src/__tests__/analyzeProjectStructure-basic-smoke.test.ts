/**
 * Basic Smoke Test for analyzeProjectStructure
 *
 * This simple test verifies that the analyzeProjectStructure method
 * is properly implemented and accessible, and can be called without errors.
 */

import { describe, it, expect } from 'vitest';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';

describe('analyzeProjectStructure Basic Smoke Test', () => {
  it('should be available as a method on ProjectContextAnalyzer', () => {
    const analyzer = new ProjectContextAnalyzer(process.cwd());

    // Method should exist
    expect(typeof analyzer.analyzeProjectStructure).toBe('function');

    // Method should be async (returns a Promise)
    const result = analyzer.analyzeProjectStructure();
    expect(result).toBeInstanceOf(Promise);
  });

  it('should return a valid structure for current directory', async () => {
    const analyzer = new ProjectContextAnalyzer(process.cwd());

    try {
      const result = await analyzer.analyzeProjectStructure();

      // Basic structure validation
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(typeof result.root).toBe('string');
      expect(typeof result.totalFiles).toBe('number');
      expect(typeof result.totalDirectories).toBe('number');
      expect(Array.isArray(result.entries)).toBe(true);
      expect(Array.isArray(result.rootFiles)).toBe(true);
      expect(Array.isArray(result.topLevelDirectories)).toBe(true);
      expect(typeof result.filesByExtension).toBe('object');
      expect(typeof result.isMonorepo).toBe('boolean');
      expect(result.scannedAt).toBeInstanceOf(Date);

      console.log('✅ analyzeProjectStructure method is working correctly');
      console.log(`   Root: ${result.root}`);
      console.log(`   Files: ${result.totalFiles}, Directories: ${result.totalDirectories}`);
      console.log(`   Top-level directories: ${result.topLevelDirectories.join(', ')}`);
      console.log(`   Is monorepo: ${result.isMonorepo}`);

    } catch (error) {
      console.error('❌ analyzeProjectStructure method failed:', error);
      throw error;
    }
  });
});