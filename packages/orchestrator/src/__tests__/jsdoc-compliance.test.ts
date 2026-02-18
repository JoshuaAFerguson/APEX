import { describe, it, expect } from 'vitest';
import { TaskStore, ToolActionStore } from '../store';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests to validate that JSDoc comments have been added according to acceptance criteria:
 * - TaskStore class has JSDoc with @example
 * - All public methods (createTask, updateTask, getTask, listTasks, etc.) have @param and @returns tags
 * - ToolActionStore class is fully documented
 * - Constructor and initialization methods documented
 */
describe('JSDoc Compliance Tests', () => {
  const storeSourcePath = path.join(__dirname, '..', 'store.ts');
  let storeSource: string;

  beforeAll(() => {
    storeSource = fs.readFileSync(storeSourcePath, 'utf8');
  });

  describe('TaskStore Class Documentation', () => {
    it('has JSDoc documentation with @example', () => {
      // Find the TaskStore class declaration and its preceding JSDoc
      const taskStoreMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      expect(taskStoreMatch).toBeTruthy();

      const jsdoc = taskStoreMatch![0];
      expect(jsdoc).toMatch(/@example/);

      // Verify the example shows proper usage
      expect(jsdoc).toContain('const store = new TaskStore');
      expect(jsdoc).toContain('await store.initialize()');
    });

    it('has constructor documentation with @param', () => {
      const constructorMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
      expect(constructorMatch).toBeTruthy();

      const jsdoc = constructorMatch![0];
      expect(jsdoc).toMatch(/@param\s+projectPath/);
    });

    it('has initialize method documentation with @returns', () => {
      const initMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async initialize\s*\(\s*\)/);
      expect(initMatch).toBeTruthy();

      const jsdoc = initMatch![0];
      expect(jsdoc).toMatch(/@returns/);
    });

    // Test core public methods have proper JSDoc
    const coreMethods = [
      'createTask',
      'getTask',
      'updateTask',
      'updateTaskStatus',
      'listTasks'
    ];

    coreMethods.forEach(methodName => {
      it(`has ${methodName} method with @param and @returns documentation`, () => {
        // Look for JSDoc comment immediately before method declaration
        const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
        const methodMatch = storeSource.match(methodPattern);

        expect(methodMatch).toBeTruthy();

        const jsdoc = methodMatch![0];
        expect(jsdoc).toMatch(/@param/);
        expect(jsdoc).toMatch(/@returns/);
      });
    });
  });

  describe('ToolActionStore Class Documentation', () => {
    it('has JSDoc documentation with @example', () => {
      const toolStoreMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(toolStoreMatch).toBeTruthy();

      const jsdoc = toolStoreMatch![0];
      expect(jsdoc).toMatch(/@example/);

      // Verify the example shows proper usage
      expect(jsdoc).toContain('new ToolActionStore');
      expect(jsdoc).toContain('recordToolAction');
    });

    it('has constructor documentation with @param tags', () => {
      const constructorMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
      expect(constructorMatch).toBeTruthy();

      const jsdoc = constructorMatch![0];
      expect(jsdoc).toMatch(/@param\s+taskStore/);
      expect(jsdoc).toMatch(/@param\s+retentionConfig/);
    });

    it('has recordToolAction method documented', () => {
      const recordMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async recordToolAction\s*\(/);
      expect(recordMatch).toBeTruthy();

      // At minimum should have some documentation
      const jsdoc = recordMatch![0];
      expect(jsdoc.length).toBeGreaterThan(20);
    });

    it('has createFileSnapshot method with @param and @returns', () => {
      const snapshotMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async createFileSnapshot\s*\(/);
      expect(snapshotMatch).toBeTruthy();

      const jsdoc = snapshotMatch![0];
      expect(jsdoc).toMatch(/@param\s+filePath/);
      expect(jsdoc).toMatch(/@returns/);
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('validates all acceptance criteria are met', () => {
      // 1. TaskStore class has JSDoc with @example
      const taskStoreClassDoc = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      expect(taskStoreClassDoc![0]).toMatch(/@example/);

      // 2. ToolActionStore class is fully documented
      const toolStoreClassDoc = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(toolStoreClassDoc![0]).toMatch(/@example/);
      expect(toolStoreClassDoc![0].length).toBeGreaterThan(200); // Substantial documentation

      // 3. Constructor and initialization methods documented
      const taskConstructor = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
      expect(taskConstructor![0]).toMatch(/@param/);

      const toolConstructor = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
      expect(toolConstructor![0]).toMatch(/@param/);

      const initMethod = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async initialize/);
      expect(initMethod![0]).toMatch(/@returns/);

      // 4. Count documented public methods
      const documentedMethods = (storeSource.match(/\/\*\*[\s\S]*?\*\/\s*(async\s+)?\w+\s*\(/g) || []).length;
      expect(documentedMethods).toBeGreaterThan(15); // Should have documented many methods
    });
  });

  describe('Code Quality and Runtime Validation', () => {
    it('can instantiate TaskStore without errors', () => {
      expect(() => {
        // Should not throw during construction
        const store = new TaskStore('/tmp/test');
        expect(store).toBeInstanceOf(TaskStore);
      }).not.toThrow();
    });

    it('can instantiate ToolActionStore with TaskStore', () => {
      expect(() => {
        const taskStore = new TaskStore('/tmp/test');
        const toolStore = new ToolActionStore(taskStore);
        expect(toolStore).toBeInstanceOf(ToolActionStore);
      }).not.toThrow();
    });
  });
});