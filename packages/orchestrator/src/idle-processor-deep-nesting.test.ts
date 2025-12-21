import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from './idle-processor';
import { TaskStore } from './store';
import { DaemonConfig, CodeSmell } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor - Deep Nesting Detection', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
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

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectDeepNesting', () => {
    beforeEach(() => {
      // Mock exec to return test files
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts" -o -name "*.js"')) {
          callback(null, {
            stdout: './src/deeply-nested.ts\n./src/shallow.ts\n./src/complex.ts\n'
          });
        } else if (command.includes('package.json')) {
          callback(null, { stdout: '' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should detect deep nesting with 5 levels', async () => {
      const deeplyNestedCode = `
function outerFunction() {
  if (condition1) {
    for (let i = 0; i < items.length; i++) {
      while (processing) {
        if (someOtherCondition) {
          if (finalCondition) {
            // This is 6 levels deep
            doSomething();
          }
        }
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('deeply-nested.ts')) {
          return Promise.resolve(deeplyNestedCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
      expect(deepNestingSmells![0].severity).toBe('high'); // 6 levels should be high severity
      expect(deepNestingSmells![0].details).toContain('6 levels');
    });

    it('should detect medium severity nesting with 5 levels', async () => {
      const mediumNestingCode = `
function processData() {
  if (hasData) {
    for (const item of items) {
      switch (item.type) {
        case 'complex':
          if (item.validate()) {
            // This is exactly 5 levels deep
            processComplexItem(item);
          }
          break;
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('deeply-nested.ts')) {
          return Promise.resolve(mediumNestingCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
      expect(deepNestingSmells![0].severity).toBe('medium'); // 5 levels should be medium severity
    });

    it('should not detect shallow nesting (4 levels or less)', async () => {
      const shallowCode = `
function processSimple() {
  if (condition) {
    for (const item of items) {
      if (item.isValid()) {
        // This is only 4 levels deep - should not trigger
        processItem(item);
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(shallowCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBe(0);
    });

    it('should correctly identify nesting context', async () => {
      const contextCode = `
class DataProcessor {
  processData() {
    for (let i = 0; i < data.length; i++) {
      try {
        while (hasMoreData()) {
          if (shouldProcess()) {
            // Deep nesting with clear context
            executeProcessing();
          }
        }
      } catch (error) {
        handleError(error);
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(contextCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
      expect(deepNestingSmells![0].details).toMatch(/for > try > while/);
    });

    it('should handle arrow functions correctly', async () => {
      const arrowFunctionCode = `
const processData = () => {
  items.forEach(item => {
    if (item.enabled) {
      item.children.map(child => {
        return child.properties.filter(prop => {
          if (prop.isValid) {
            // Deep nesting with arrow functions
            return prop.value > 0;
          }
        });
      });
    }
  });
};`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(arrowFunctionCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
    });

    it('should skip comments and empty lines', async () => {
      const codeWithComments = `
function processWithComments() {
  if (condition1) {
    // This is a comment
    for (let i = 0; i < 10; i++) {
      /*
       * Multi-line comment
       */
      if (condition2) {
        // Another comment

        if (condition3) {
          if (condition4) {
            // Deep nesting despite comments
            doWork();
          }
        }
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(codeWithComments);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
    });

    it('should handle switch statements', async () => {
      const switchCode = `
function handleSwitch(type) {
  if (isEnabled) {
    switch (type) {
      case 'complex':
        for (const item of items) {
          if (item.needsProcessing) {
            switch (item.subtype) {
              case 'special':
                // Deep nesting with switch
                processSpecialItem(item);
                break;
            }
          }
        }
        break;
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(switchCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
      expect(deepNestingSmells![0].details).toMatch(/switch/);
    });

    it('should handle multiple deep nesting issues in same file', async () => {
      const multipleNestingCode = `
function firstFunction() {
  if (condition1) {
    for (const item of items) {
      while (processing) {
        if (someCondition) {
          if (deepCondition) {
            // First deep nesting issue
            doSomething();
          }
        }
      }
    }
  }
}

function secondFunction() {
  try {
    if (canProcess) {
      items.forEach(item => {
        if (item.isValid) {
          for (let i = 0; i < item.children.length; i++) {
            // Second deep nesting issue
            processChild(item.children[i]);
          }
        }
      });
    }
  } catch (error) {
    handleError(error);
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(multipleNestingCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(1); // Should detect multiple issues
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBe(0); // Should not crash, return empty array
    });

    it('should provide accurate line numbers for nesting issues', async () => {
      const lineNumberTestCode = `function testLineNumbers() {
  if (condition1) {  // Line 2
    for (const item of items) {  // Line 3
      while (processing) {  // Line 4
        if (someCondition) {  // Line 5
          if (deepCondition) {  // Line 6 - this should be reported
            doSomething();
          }
        }
      }
    }
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(lineNumberTestCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const deepNestingSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toBeDefined();
      expect(deepNestingSmells!.length).toBeGreaterThan(0);
      expect(deepNestingSmells![0].details).toContain('line 6');
    });
  });

  describe('Updated code smell thresholds', () => {
    beforeEach(() => {
      // Mock exec for file analysis
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts" -o -name "*.js"')) {
          callback(null, {
            stdout: './src/large-file.ts\n'
          });
        } else if (command.includes('xargs wc -l')) {
          // Mock file with 600 lines
          callback(null, { stdout: '600 ./src/large-file.ts\n600 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should detect large class with >500 lines', async () => {
      const largeClassCode = 'class LargeClass {\n' + '  method() { return 1; }\n'.repeat(500) + '}';

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('large-file.ts')) {
          return Promise.resolve(largeClassCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const largeClassSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'large-class');

      expect(largeClassSmells).toBeDefined();
      expect(largeClassSmells!.length).toBeGreaterThan(0);
      expect(largeClassSmells![0].details).toContain('600 lines');
      expect(largeClassSmells![0].severity).toBe('high');
    });

    it('should detect large class with >20 methods', async () => {
      // Create code with many methods but fewer lines
      const manyMethodsCode =
        'class ManyMethodsClass {\n' +
        Array.from({ length: 25 }, (_, i) => `  method${i}() { return ${i}; }`).join('\n') +
        '\n}';

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('large-file.ts')) {
          return Promise.resolve(manyMethodsCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const largeClassSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'large-class');

      expect(largeClassSmells).toBeDefined();
      expect(largeClassSmells!.length).toBeGreaterThan(0);
      expect(largeClassSmells![0].details).toContain('25 methods');
    });

    it('should detect long method with >50 lines', async () => {
      const longMethodCode = `
class TestClass {
  longMethod() {
    ${Array.from({ length: 55 }, (_, i) => `    console.log('line ${i}');`).join('\n')}
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('large-file.ts')) {
          return Promise.resolve(longMethodCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const longMethodSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'long-method');

      expect(longMethodSmells).toBeDefined();
      expect(longMethodSmells!.length).toBeGreaterThan(0);
      expect(longMethodSmells![0].details).toContain('longMethod');
      expect(longMethodSmells![0].details).toMatch(/has \d+ lines/);
      expect(longMethodSmells![0].severity).toBe('medium');
    });

    it('should not detect short methods (<= 50 lines)', async () => {
      const shortMethodCode = `
class TestClass {
  shortMethod() {
    ${Array.from({ length: 30 }, (_, i) => `    console.log('line ${i}');`).join('\n')}
  }
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(shortMethodCode);
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const longMethodSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'long-method');

      expect(longMethodSmells).toBeDefined();
      expect(longMethodSmells!.length).toBe(0);
    });

    it('should not detect small classes (<= 500 lines and <= 20 methods)', async () => {
      const smallClassCode = `
class SmallClass {
  ${Array.from({ length: 15 }, (_, i) => `  method${i}() { return ${i}; }`).join('\n')}
}`;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(smallClassCode);
      });

      // Mock exec to return smaller line count
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '400 ./src/small-file.ts\n400 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const largeClassSmells = analysis?.codeQuality.codeSmells.filter(smell => smell.type === 'large-class');

      expect(largeClassSmells).toBeDefined();
      expect(largeClassSmells!.length).toBe(0);
    });
  });

  describe('Integration with existing analysis', () => {
    it('should include deep nesting smells alongside other code smells', async () => {
      // Mock exec for multiple files with different issues
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts" -o -name "*.js"') && !command.includes('node_modules')) {
          callback(null, {
            stdout: './src/nested-file.ts\n./src/large-file.ts\n'
          });
        } else if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '300 ./src/nested-file.ts\n700 ./src/large-file.ts\n1000 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const nestedCode = `
function complexFunction() {
  if (condition1) {
    for (const item of items) {
      while (processing) {
        if (condition2) {
          if (condition3) {
            // Deep nesting
            doSomething();
          }
        }
      }
    }
  }
}`;

      const largeClassCode = 'class LargeClass {\n' + '  method() { return 1; }\n'.repeat(600) + '}';

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('nested-file.ts')) {
          return Promise.resolve(nestedCode);
        } else if (path.includes('large-file.ts')) {
          return Promise.resolve(largeClassCode);
        }
        return Promise.resolve('simple code');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const codeSmells = analysis?.codeQuality.codeSmells || [];

      // Should have both deep nesting and large class smells
      const deepNestingSmells = codeSmells.filter(smell => smell.type === 'deep-nesting');
      const largeClassSmells = codeSmells.filter(smell => smell.type === 'large-class');

      expect(deepNestingSmells.length).toBeGreaterThan(0);
      expect(largeClassSmells.length).toBeGreaterThan(0);
      expect(codeSmells.length).toBe(deepNestingSmells.length + largeClassSmells.length);
    });
  });
});