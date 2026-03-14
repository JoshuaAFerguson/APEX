/**
 * @fileoverview Integration tests for CodebaseMapper and parallel agent spawning
 *
 * This test suite validates the integration between CLI command, CodebaseMapper,
 * and the orchestrator for parallel agent execution. Tests cover the complete
 * end-to-end flow of the apex map-codebase command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import EventEmitter from 'events';

// Import components to test
import {
  CodebaseAnalysisOrchestratorImpl as CodebaseAnalysisOrchestrator,
  AnalysisPhase
} from '../packages/orchestrator/src/codebase-analyzer/index.js';
import { handleMapCodebase } from '../packages/cli/src/handlers/map-codebase-handlers.js';
import { CodebaseIndexer } from '../packages/orchestrator/src/codebase-intelligence/indexer.js';

// Import types
import type { CliContext } from '../packages/cli/src/index.js';
import type { CodebaseAnalysisResult } from '../packages/core/src/types.js';

describe('Codebase Analysis Integration Tests', () => {
  const testProjectDir = '/tmp/apex-mapper-integration-test';
  let originalCwd: string;
  let mockContext: CliContext;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Clean up and create fresh test project
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Directory may not exist, ignore
    }

    await fs.mkdir(testProjectDir, { recursive: true });
    process.chdir(testProjectDir);

    // Mock CLI context
    mockContext = {
      cwd: testProjectDir,
      config: {},
      flags: {}
    } as CliContext;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Codebase Analysis Core Functionality', () => {
    it('should initialize and configure orchestrator correctly', async () => {
      await createTestProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();

      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.analyze).toBe('function');
      expect(orchestrator instanceof EventEmitter).toBe(true);
    });

    it('should analyze codebase with default settings', async () => {
      await createTestProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const result = await orchestrator.analyze(testProjectDir);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should emit progress events during analysis', async () => {
      await createTestProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const events: any[] = [];

      orchestrator.on('progress', (event) => events.push({ type: 'progress', ...event }));

      await orchestrator.analyze(testProjectDir);

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully during analysis', async () => {
      await createCorruptedProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();

      const result = await orchestrator.analyze(testProjectDir, {
        includeDetails: false
      });

      // Should still produce some results despite errors
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Parallel Agent Spawning', () => {
    it('should spawn multiple analysis agents in parallel', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const repositoryMap = await createMockRepositoryMap();

      const startTime = Date.now();
      let maxConcurrentAnalyzers = 0;
      let currentConcurrentAnalyzers = 0;

      // Mock analyzer execution to track concurrency
      const originalRunAnalysis = orchestrator.runAnalysis;
      vi.spyOn(orchestrator, 'runAnalysis').mockImplementation(async function(...args) {
        currentConcurrentAnalyzers++;
        maxConcurrentAnalyzers = Math.max(maxConcurrentAnalyzers, currentConcurrentAnalyzers);

        // Simulate some analysis time
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await originalRunAnalysis.apply(this, args);

        currentConcurrentAnalyzers--;
        return result;
      });

      await orchestrator.runAnalysis(repositoryMap, {
        phases: [AnalysisPhase.STACK, AnalysisPhase.ARCHITECTURE, AnalysisPhase.CONVENTIONS],
        parallel: true,
        maxConcurrency: 3
      });

      const endTime = Date.now();

      expect(maxConcurrentAnalyzers).toBeGreaterThan(1);
      expect(maxConcurrentAnalyzers).toBeLessThanOrEqual(3);
    });

    it('should coordinate agent communication and result aggregation', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const progressEvents: any[] = [];

      orchestrator.on('progress', (event) => progressEvents.push(event));

      const result = await orchestrator.analyze(testProjectDir);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(result).toBeDefined();
    });

    it('should handle agent failures without affecting other agents', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();

      const result = await orchestrator.analyze(testProjectDir, {
        includeDetails: true,
        excludePatterns: ['**/invalid/**']
      });

      // Should produce results despite any individual failures
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect analysis options', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();

      const result = await orchestrator.analyze(testProjectDir, {
        includeDetails: false,
        maxDepth: 2
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('CLI Integration', () => {
    it('should integrate with handleMapCodebase CLI handler', async () => {
      await createTestProject();

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleMapCodebase(mockContext, {
        'output-dir': path.join(testProjectDir, '.apex', 'analysis'),
        parallel: 2,
        'output-format': 'json',
        verbose: true
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Analyzing Codebase'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Analysis Complete'));

      consoleLogSpy.mockRestore();
    });

    it('should create output files in specified directory', async () => {
      await createTestProject();

      const outputDir = path.join(testProjectDir, 'custom-analysis');

      await handleMapCodebase(mockContext, {
        'output-dir': outputDir,
        'output-format': 'all'
      });

      // Check if output files were created
      const jsonExists = await fs.access(path.join(outputDir, 'repository-map.json'))
        .then(() => true).catch(() => false);
      const mdExists = await fs.access(path.join(outputDir, 'CODEBASE_MAP.md'))
        .then(() => true).catch(() => false);

      expect(jsonExists).toBe(true);
      expect(mdExists).toBe(true);
    });

    it('should handle CLI argument parsing correctly', async () => {
      await createTestProject();

      const mockArgs = {
        'output-dir': '/custom/path',
        parallel: 3,
        'output-format': 'json',
        'include-debt': true,
        quick: true,
        verbose: true
      };

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleMapCodebase(mockContext, mockArgs);

      // Verify verbose output shows configuration
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Parallel workers: 3'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Include technical debt: true'));

      consoleLogSpy.mockRestore();
    });

    it('should handle errors and display meaningful messages', async () => {
      // Create a directory that will cause permission errors
      const invalidDir = '/invalid/directory/that/cannot/be/created';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleMapCodebase(mockContext, {
        'output-dir': invalidDir
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to analyze codebase')
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Output Format Generation', () => {
    it('should analyze and return structured results', async () => {
      await createTestProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const result = await orchestrator.analyze(testProjectDir);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const firstResult = result[0];
      expect(firstResult.phase).toBeDefined();
      expect(firstResult.success).toBeDefined();
    });

    it('should generate markdown with proper formatting via CLI', async () => {
      await createTestProject();

      const outputDir = path.join(testProjectDir, '.apex', 'analysis');

      await handleMapCodebase(mockContext, {
        'output-format': 'markdown'
      });

      const mdPath = path.join(outputDir, 'CODEBASE_MAP.md');
      const mdContent = await fs.readFile(mdPath, 'utf-8');

      expect(mdContent).toContain('# Codebase Map Report');
      expect(mdContent).toContain('## Statistics');
      expect(mdContent).toContain('Generated:');
    });

    it('should generate all formats when requested via CLI', async () => {
      await createTestProject();

      const outputDir = path.join(testProjectDir, '.apex', 'analysis');

      await handleMapCodebase(mockContext, {
        'output-format': 'all'
      });

      const jsonExists = await fs.access(path.join(outputDir, 'repository-map.json'))
        .then(() => true).catch(() => false);
      const mdExists = await fs.access(path.join(outputDir, 'CODEBASE_MAP.md'))
        .then(() => true).catch(() => false);

      expect(jsonExists).toBe(true);
      expect(mdExists).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete large codebase analysis within reasonable time', async () => {
      await createLargeTestProject();

      const startTime = Date.now();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      await orchestrator.analyze(testProjectDir, {
        maxDepth: 3,
        excludePatterns: ['**/node_modules/**', '**/dist/**']
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2 minutes for large codebase
      expect(duration).toBeLessThan(120000);
    });

    it('should manage memory usage efficiently', async () => {
      await createLargeTestProject();

      const initialMemory = process.memoryUsage().heapUsed;

      const orchestrator = new CodebaseAnalysisOrchestrator();
      await orchestrator.analyze(testProjectDir);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 500MB for test project)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    });

    it('should clean up resources after completion', async () => {
      await createTestProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      await orchestrator.analyze(testProjectDir);

      // Verify no hanging event listeners
      expect(orchestrator.listenerCount('progress')).toBe(0);
      expect(orchestrator.listenerCount('error')).toBe(0);
    });
  });
});

// Helper functions for creating test projects

async function createTestProject() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.0'
    },
    devDependencies: {
      typescript: '^5.0.0'
    }
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'index.js'), `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

module.exports = app;
  `);

  await fs.writeFile(path.join(testProjectDir, 'README.md'), `
# Test Project

This is a test project for CodebaseMapper integration tests.
  `);
}

async function createComplexProject() {
  await createTestProject();

  // Add multiple directories and files
  await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, 'lib'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, 'test'), { recursive: true });

  await fs.writeFile(path.join(testProjectDir, 'src', 'service.js'), `
class UserService {
  constructor() {
    this.users = [];
  }

  addUser(user) {
    this.users.push(user);
  }

  getUsers() {
    return this.users;
  }
}

module.exports = UserService;
  `);

  await fs.writeFile(path.join(testProjectDir, 'lib', 'utils.js'), `
const lodash = require('lodash');

function processData(data) {
  return lodash.map(data, item => ({
    ...item,
    processed: true
  }));
}

module.exports = { processData };
  `);

  await fs.writeFile(path.join(testProjectDir, 'test', 'service.test.js'), `
const UserService = require('../src/service');

describe('UserService', () => {
  it('should add user', () => {
    const service = new UserService();
    service.addUser({ name: 'John' });
    expect(service.getUsers()).toHaveLength(1);
  });
});
  `);
}

async function createLargeTestProject() {
  await createComplexProject();

  // Create many files to simulate a large project
  for (let i = 0; i < 20; i++) {
    await fs.mkdir(path.join(testProjectDir, `module${i}`), { recursive: true });

    for (let j = 0; j < 5; j++) {
      await fs.writeFile(path.join(testProjectDir, `module${i}`, `file${j}.js`), `
// Module ${i} File ${j}
const value = ${j};

function process${j}() {
  return value * 2;
}

class Handler${j} {
  constructor() {
    this.id = ${j};
  }

  handle(data) {
    return process${j}() + (data || 0);
  }
}

module.exports = { process${j}, Handler${j} };
      `);
    }
  }
}

async function createCorruptedProject() {
  await createTestProject();

  // Add some files that might cause parsing errors
  await fs.writeFile(path.join(testProjectDir, 'corrupted.js'), `
// Intentionally malformed JavaScript
const incomplete = {
  prop1: "value"
  prop2: 123
// Missing closing brace
  `);

  // Add a binary file
  const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  await fs.writeFile(path.join(testProjectDir, 'image.png'), binaryData);
}

async function createMockRepositoryMap() {
  const { CodebaseIndexer } = await import('../packages/orchestrator/src/codebase-intelligence/indexer.js');
  const indexer = CodebaseIndexer.getInstance();
  return await indexer.indexDirectory(testProjectDir, {
    continueOnError: true,
    computeHashes: true
  });
}