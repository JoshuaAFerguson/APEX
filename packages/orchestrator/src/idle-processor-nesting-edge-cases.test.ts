import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from './idle-processor';
import { TaskStore } from './store';
import { DaemonConfig } from '@apexcli/core';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor - Deep Nesting Edge Cases', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn(),
      getAllTasks: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor('/test/project', mockConfig, mockStore);

    // Setup default exec mock
    const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
      const callback = arguments[2] || arguments[1];

      if (command.includes('find . -name "*.ts" -o -name "*.js"') && !command.includes('node_modules')) {
        callback(null, { stdout: './src/test-file.ts\n' });
      } else {
        callback(null, { stdout: '' });
      }
    });

    const childProcess = require('child_process');
    childProcess.exec = mockExec;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Edge cases for nesting detection', () => {
    it('should handle exact threshold boundary (exactly 5 levels)', async () => {
      const exactThresholdCode = `
function test() {
  if (a) {
    for (let i = 0; i < 10; i++) {
      while (condition) {
        try {
          if (something) {
            // Exactly 5 levels - should trigger
            doWork();
          }
        } catch (e) {}
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(exactThresholdCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
      expect(nestingSmells![0].details).toContain('5 levels');
      expect(nestingSmells![0].severity).toBe('medium');
    });

    it('should handle unbalanced braces gracefully', async () => {
      const unbalancedCode = `
function testUnbalanced() {
  if (condition1) {
    for (let i = 0; i < 10; i++) {
      if (condition2) {
        // Missing closing brace here
        doSomething();
      }
    }
  }
  // Extra closing brace
}
}`;

      vi.mocked(fs.readFile).mockResolvedValue(unbalancedCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();

      // Should not crash and should handle gracefully
      expect(analysis).toBeDefined();
      expect(analysis?.codeQuality.codeSmells).toBeDefined();
    });

    it('should handle mixed bracket styles', async () => {
      const mixedBracketCode = `
function mixedStyle()
{
  if (condition)
  {
    for (const item of items) {
      while (processing)
      {
        if (check) {
          if (final)
          {
            // Mixed bracket styles, deep nesting
            process();
          }
        }
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(mixedBracketCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
    });

    it('should handle inline single-statement blocks', async () => {
      const inlineCode = `
function inlineTest() {
  if (a) if (b) if (c) if (d) if (e) doSomething(); // 5 levels inline

  // Also test mixed inline and block
  if (x) {
    if (y) if (z) {
      while (w) if (v) doOtherThing(); // Deep nesting mixed style
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(inlineCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
    });

    it('should handle ternary operators (should not count as nesting)', async () => {
      const ternaryCode = `
function ternaryTest() {
  if (condition1) {
    for (const item of items) {
      const result = a ? (b ? (c ? (d ? e : f) : g) : h) : i; // Ternary chain - not structural nesting
      if (result) {
        // Only 3 structural levels
        processResult(result);
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(ternaryCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBe(0); // Should not detect ternary as deep nesting
    });

    it('should handle empty blocks and single-line blocks', async () => {
      const emptyBlocksCode = `
function emptyBlocks() {
  if (condition1) {
    for (let i = 0; i < 10; i++) {
      while (processing) {
        if (check1) {
          if (check2) { /* empty block */ }
        }

        if (check3) { doSomething(); } // single line
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(emptyBlocksCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
    });

    it('should handle complex real-world nesting patterns', async () => {
      const realWorldCode = `
class DataProcessor {
  async processDataBatch(batches) {
    try {
      for (const batch of batches) {
        if (batch.isValid()) {
          await batch.items.forEach(async (item) => {
            switch (item.type) {
              case 'complex':
                if (item.metadata) {
                  for (const [key, value] of Object.entries(item.metadata)) {
                    if (value.requiresProcessing) {
                      if (await this.canProcess(value)) {
                        // Real-world deep nesting scenario
                        await this.processComplexValue(key, value);
                      }
                    }
                  }
                }
                break;
              case 'simple':
                await this.processSimpleItem(item);
                break;
            }
          });
        }
      }
    } catch (error) {
      this.handleBatchError(error);
    }
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(realWorldCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
      expect(nestingSmells![0].details).toMatch(/forEach|switch|if/);
    });

    it('should provide correct context for deeply nested structures', async () => {
      const contextTestCode = `
function contextTest() {
  try {
    if (hasPermission) {
      while (dataAvailable) {
        for (const record of records) {
          switch (record.status) {
            case 'pending':
              if (record.priority === 'high') {
                // Context: try > if > while > for > switch > if
                processHighPriorityRecord(record);
              }
              break;
          }
        }
      }
    }
  } catch (error) {
    handleError(error);
  }
}`;

      vi.mocked(fs.readFile).mockResolvedValue(contextTestCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
      const smell = nestingSmells![0];
      expect(smell.details).toContain('try > if > while');
    });

    it('should handle JavaScript/TypeScript specific constructs', async () => {
      const jsSpecificCode = `
const processor = {
  async processData(data) {
    return new Promise((resolve, reject) => {
      try {
        data.items.forEach(item => {
          if (item.validate()) {
            item.children?.map(child => {
              return child.properties?.filter(prop => {
                if (prop?.isActive) {
                  // Deep nesting with optional chaining
                  return prop.value > 0;
                }
                return false;
              });
            });
          }
        });
        resolve('processed');
      } catch (error) {
        reject(error);
      }
    });
  }
};`;

      vi.mocked(fs.readFile).mockResolvedValue(jsSpecificCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      expect(nestingSmells!.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and limitations', () => {
    it('should handle very large files without performance issues', async () => {
      // Generate a large file with multiple nesting patterns
      const largeFunctionParts = [];
      for (let i = 0; i < 100; i++) {
        largeFunctionParts.push(`
function func${i}() {
  if (condition${i}) {
    for (let j = 0; j < 10; j++) {
      while (processing${i}) {
        try {
          if (someCheck${i}) {
            if (finalCheck${i}) {
              // Nested structure ${i}
              process${i}();
            }
          }
        } catch (e) {}
      }
    }
  }
}`);
      }

      const largeFileCode = largeFunctionParts.join('\n');

      vi.mocked(fs.readFile).mockResolvedValue(largeFileCode);

      const startTime = Date.now();
      await idleProcessor.processIdleTime();
      const endTime = Date.now();

      const analysis = idleProcessor.getLastAnalysis();
      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');

      // Should complete in reasonable time and detect multiple issues
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      expect(nestingSmells!.length).toBeGreaterThan(50); // Should detect many issues
    });

    it('should limit analysis to reasonable file count for performance', async () => {
      // Mock find command to return many files
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts" -o -name "*.js"') && !command.includes('node_modules')) {
          const manyFiles = Array.from({ length: 50 }, (_, i) => `./src/file${i}.ts`).join('\n');
          callback(null, { stdout: manyFiles });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const simpleCode = 'function simple() { return true; }';
      vi.mocked(fs.readFile).mockResolvedValue(simpleCode);

      await idleProcessor.processIdleTime();

      // Should have processed files (limited to first 20 as per implementation)
      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
    });
  });

  describe('Integration with method detection', () => {
    it('should correctly count methods in classes with nesting', async () => {
      const classWithNestingCode = `
class ComplexProcessor {
  method1() {
    if (a) {
      for (const item of items) {
        while (condition) {
          if (check1) {
            if (check2) {
              // Deep nesting in method
              doWork();
            }
          }
        }
      }
    }
  }

  method2() { return 'simple'; }
  method3() { return 'another'; }
  ${Array.from({ length: 22 }, (_, i) => `  method${i + 4}() { return ${i}; }`).join('\n')}
}`;

      // Mock exec for large class detection
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '600 ./src/test-file.ts\n600 total' });
        } else if (command.includes('find')) {
          callback(null, { stdout: './src/test-file.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockResolvedValue(classWithNestingCode);

      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();

      const nestingSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'deep-nesting');
      const largeClassSmells = analysis?.codeQuality.codeSmells.filter(s => s.type === 'large-class');

      // Should detect both deep nesting and large class
      expect(nestingSmells!.length).toBeGreaterThan(0);
      expect(largeClassSmells!.length).toBeGreaterThan(0);
      expect(largeClassSmells![0].details).toContain('25 methods'); // 25 total methods
    });
  });
});