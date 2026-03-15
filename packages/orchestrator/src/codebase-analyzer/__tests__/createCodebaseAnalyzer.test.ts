/**
 * Tests for createCodebaseAnalyzer function and tree-sitter integration
 *
 * This test suite verifies:
 * 1. The createCodebaseAnalyzer function correctly instantiates an analyzer
 * 2. Tree-sitter dependencies are properly accessible
 * 3. Basic codebase analysis functionality works
 * 4. Error handling for various scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCodebaseAnalyzer, CodebaseAnalysisOrchestrator, AnalysisPhase } from '../index.js';

describe('createCodebaseAnalyzer', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test projects
    tempDir = await fs.mkdtemp(join(tmpdir(), 'apex-codebase-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Factory Function', () => {
    it('should create a CodebaseAnalysisOrchestrator instance', () => {
      const analyzer = createCodebaseAnalyzer();

      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.getSupportedPhases).toBe('function');
      expect(typeof analyzer.onProgress).toBe('function');
      expect(typeof analyzer.onError).toBe('function');
    });

    it('should return different instances on multiple calls', () => {
      const analyzer1 = createCodebaseAnalyzer();
      const analyzer2 = createCodebaseAnalyzer();

      expect(analyzer1).not.toBe(analyzer2);
    });
  });

  describe('Supported Phases', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should return supported analysis phases', () => {
      const phases = analyzer.getSupportedPhases();

      expect(phases).toContain(AnalysisPhase.CONVENTIONS);
      expect(Array.isArray(phases)).toBe(true);
      expect(phases.length).toBeGreaterThan(0);
    });
  });

  describe('Analysis Functionality', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should analyze an empty project directory', async () => {
      const results = await analyzer.analyze(tempDir);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Should have at least conventions analysis
      const conventionResult = results.find(r => r.phase === AnalysisPhase.CONVENTIONS);
      expect(conventionResult).toBeDefined();
      expect(conventionResult?.success).toBe(true);
      expect(typeof conventionResult?.executionTime).toBe('number');
    });

    it('should handle analysis with options', async () => {
      const options = {
        includeDetails: true,
        maxDepth: 5,
        excludePatterns: ['node_modules/**'],
        enableParsing: true
      };

      const results = await analyzer.analyze(tempDir, options);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should analyze a project with JavaScript files', async () => {
      // Create a simple JS project structure
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const jsFile = join(srcDir, 'index.js');
      await fs.writeFile(jsFile, `
function calculateSum(a, b) {
  return a + b;
}

const MAX_VALUE = 100;
class Calculator {
  constructor() {
    this.value = 0;
  }
}

export { calculateSum, Calculator };
      `);

      const results = await analyzer.analyze(tempDir);

      expect(results).toBeDefined();
      const conventionResult = results.find(r => r.phase === AnalysisPhase.CONVENTIONS);
      expect(conventionResult?.success).toBe(true);
      expect(conventionResult?.data).toBeDefined();
    });

    it('should analyze a project with TypeScript files', async () => {
      // Create a simple TS project structure
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const tsFile = join(srcDir, 'types.ts');
      await fs.writeFile(tsFile, `
export interface User {
  id: number;
  name: string;
  email: string;
}

export type UserStatus = 'active' | 'inactive';

export class UserService {
  private users: User[] = [];

  constructor() {}

  createUser(userData: Omit<User, 'id'>): User {
    const id = Math.floor(Math.random() * 1000);
    const user: User = { id, ...userData };
    this.users.push(user);
    return user;
  }
}
      `);

      const results = await analyzer.analyze(tempDir);

      expect(results).toBeDefined();
      const conventionResult = results.find(r => r.phase === AnalysisPhase.CONVENTIONS);
      expect(conventionResult?.success).toBe(true);
      expect(conventionResult?.data).toBeDefined();
    });

    it('should handle non-existent directory', async () => {
      const nonExistentDir = join(tempDir, 'does-not-exist');

      await expect(analyzer.analyze(nonExistentDir)).rejects.toThrow();
    });

    it('should handle directory with no analyzable files', async () => {
      // Create a directory with only non-code files
      const readmeFile = join(tempDir, 'README.md');
      await fs.writeFile(readmeFile, '# Test Project\n\nThis is a test.');

      const licenseFile = join(tempDir, 'LICENSE');
      await fs.writeFile(licenseFile, 'MIT License');

      const results = await analyzer.analyze(tempDir);

      expect(Array.isArray(results)).toBe(true);
      // Should still return results with default conventions
      const conventionResult = results.find(r => r.phase === AnalysisPhase.CONVENTIONS);
      expect(conventionResult).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should allow setting progress callback', () => {
      const progressCallback = vi.fn();

      expect(() => {
        analyzer.onProgress(progressCallback);
      }).not.toThrow();
    });

    it('should allow setting error callback', () => {
      const errorCallback = vi.fn();

      expect(() => {
        analyzer.onError(errorCallback);
      }).not.toThrow();
    });

    it('should call progress callback during analysis', async () => {
      const progressCallback = vi.fn();
      analyzer.onProgress(progressCallback);

      // Create a simple project to analyze
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);
      const jsFile = join(srcDir, 'test.js');
      await fs.writeFile(jsFile, 'console.log("hello");');

      await analyzer.analyze(tempDir);

      expect(progressCallback).toHaveBeenCalled();

      // Verify progress callback was called with correct structure
      const calls = progressCallback.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const firstCall = calls[0][0];
      expect(firstCall).toHaveProperty('phase');
      expect(firstCall).toHaveProperty('progress');
      expect(typeof firstCall.progress).toBe('number');
    });
  });

  describe('Error Scenarios', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should handle file system permission errors gracefully', async () => {
      // Mock fs.stat to throw permission error
      const originalStat = fs.stat;
      vi.mocked(fs).stat = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));

      const errorCallback = vi.fn();
      analyzer.onError(errorCallback);

      await expect(analyzer.analyze('/some/protected/path')).rejects.toThrow();

      // Restore original fs.stat
      vi.mocked(fs).stat = originalStat;
    });

    it('should handle corrupted files gracefully', async () => {
      // Create a file with invalid content that might cause parsing issues
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const corruptedFile = join(srcDir, 'corrupted.js');
      await fs.writeFile(corruptedFile, '\x00\x01\x02invalid binary content');

      // Analysis should still complete, even with corrupted files
      const results = await analyzer.analyze(tempDir);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Tree-sitter Dependencies', () => {
    it('should have tree-sitter core available', async () => {
      // Test that tree-sitter module can be imported
      const TreeSitter = await import('tree-sitter');
      expect(TreeSitter).toBeDefined();
      expect(typeof TreeSitter.default).toBe('function');
    });

    it('should have JavaScript parser available', async () => {
      const JavaScript = await import('tree-sitter-javascript');
      expect(JavaScript).toBeDefined();
      expect(typeof JavaScript.default).toBe('function');
    });

    it('should have TypeScript parser available', async () => {
      const TypeScript = await import('tree-sitter-typescript');
      expect(TypeScript).toBeDefined();
      expect(TypeScript.typescript).toBeDefined();
      expect(TypeScript.tsx).toBeDefined();
    });

    it('should have Python parser available', async () => {
      const Python = await import('tree-sitter-python');
      expect(Python).toBeDefined();
      expect(typeof Python.default).toBe('function');
    });

    it('should have Go parser available', async () => {
      const Go = await import('tree-sitter-go');
      expect(Go).toBeDefined();
      expect(typeof Go.default).toBe('function');
    });

    it('should have Rust parser available', async () => {
      const Rust = await import('tree-sitter-rust');
      expect(Rust).toBeDefined();
      expect(typeof Rust.default).toBe('function');
    });

    it('should have Java parser available', async () => {
      const Java = await import('tree-sitter-java');
      expect(Java).toBeDefined();
      expect(typeof Java.default).toBe('function');
    });

    it('should be able to parse simple JavaScript with tree-sitter', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const sourceCode = 'function hello() { return "world"; }';
      const tree = parser.parse(sourceCode);

      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
    });

    it('should be able to parse TypeScript with tree-sitter', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const { typescript } = await import('tree-sitter-typescript');

      const parser = new TreeSitter();
      parser.setLanguage(typescript);

      const sourceCode = 'interface User { name: string; }';
      const tree = parser.parse(sourceCode);

      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
    });
  });

  describe('Analysis Results Structure', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should return results with correct structure', async () => {
      const results = await analyzer.analyze(tempDir);

      expect(Array.isArray(results)).toBe(true);

      for (const result of results) {
        expect(result).toHaveProperty('phase');
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('executionTime');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.executionTime).toBe('number');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include conventions analysis in results', async () => {
      const results = await analyzer.analyze(tempDir);

      const conventionResult = results.find(r => r.phase === AnalysisPhase.CONVENTIONS);
      expect(conventionResult).toBeDefined();
      expect(conventionResult?.success).toBe(true);
      expect(conventionResult?.data).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    let analyzer: CodebaseAnalysisOrchestrator;

    beforeEach(() => {
      analyzer = createCodebaseAnalyzer();
    });

    it('should complete analysis within reasonable time for small project', async () => {
      const startTime = Date.now();

      // Create a small project with a few files
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);

      for (let i = 0; i < 5; i++) {
        const file = join(srcDir, `file${i}.js`);
        await fs.writeFile(file, `export const value${i} = ${i};`);
      }

      const results = await analyzer.analyze(tempDir);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(results).toBeDefined();
    });

    it('should handle directories with many files without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many small files
      const srcDir = join(tempDir, 'src');
      await fs.mkdir(srcDir);

      for (let i = 0; i < 100; i++) {
        const file = join(srcDir, `generated${i}.js`);
        await fs.writeFile(file, `// File ${i}\nexport const value = ${i};`);
      }

      await analyzer.analyze(tempDir);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this small test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});