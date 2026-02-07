import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore, ToolActionStore } from '../store';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Final validation tests to ensure the JSDoc documentation and store functionality work correctly.
 * This validates the acceptance criteria for the testing stage.
 */
describe('Final Testing Validation', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-final-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();
    toolActionStore = new ToolActionStore(taskStore);
  });

  afterEach(async () => {
    taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('JSDoc Documentation Validation', () => {
    it('validates TaskStore class has JSDoc with @example', () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = fs.readFileSync(storeSourcePath, 'utf8');

      // TaskStore class should have @example
      const taskStoreMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      expect(taskStoreMatch).toBeTruthy();
      expect(taskStoreMatch![0]).toContain('@example');
    });

    it('validates ToolActionStore class is fully documented', () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = fs.readFileSync(storeSourcePath, 'utf8');

      // ToolActionStore class should have comprehensive documentation
      const toolStoreMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(toolStoreMatch).toBeTruthy();
      expect(toolStoreMatch![0]).toContain('@example');
      expect(toolStoreMatch![0].length).toBeGreaterThan(300); // Substantial documentation
    });

    it('validates constructor and initialization methods are documented', () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = fs.readFileSync(storeSourcePath, 'utf8');

      // TaskStore constructor
      const taskConstructorMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
      expect(taskConstructorMatch).toBeTruthy();
      expect(taskConstructorMatch![0]).toContain('@param projectPath');

      // TaskStore initialize method
      const initializeMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async initialize/);
      expect(initializeMatch).toBeTruthy();
      expect(initializeMatch![0]).toContain('@returns');

      // ToolActionStore constructor
      const toolConstructorMatch = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
      expect(toolConstructorMatch).toBeTruthy();
      expect(toolConstructorMatch![0]).toContain('@param taskStore');
    });

    it('validates public methods have @param and @returns tags', () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = fs.readFileSync(storeSourcePath, 'utf8');

      // Check core public methods
      const methods = ['createTask', 'getTask', 'updateTask', 'listTasks'];

      methods.forEach(methodName => {
        const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
        const methodMatch = storeSource.match(methodPattern);
        expect(methodMatch).toBeTruthy();
        expect(methodMatch![0]).toContain('@param');
        expect(methodMatch![0]).toContain('@returns');
      });
    });
  });

  describe('Functional Testing', () => {
    it('can create and retrieve a task using documented methods', async () => {
      const task = await taskStore.createTask({
        description: 'Test task for JSDoc validation',
        workflow: 'feature',
        autonomy: 'full'
      });

      expect(task).toBeDefined();
      expect(task.id).toBeTruthy();

      const retrievedTask = await taskStore.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.id).toBe(task.id);
    });

    it('can use TaskStore public methods with proper parameters', async () => {
      const task = await taskStore.createTask({
        description: 'Test task',
        workflow: 'feature',
        autonomy: 'full'
      });

      // Test updateTask with documented parameters
      await taskStore.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'testing'
      });

      // Test updateTaskStatus with documented parameters
      await taskStore.updateTaskStatus(task.id, 'completed', 'testing', 'All tests passed');

      // Test listTasks with documented options
      const tasks = await taskStore.listTasks({
        status: 'completed',
        limit: 10
      });

      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('can use ToolActionStore methods', async () => {
      const task = await taskStore.createTask({
        description: 'Test task for tool actions',
        workflow: 'feature',
        autonomy: 'full'
      });

      // Test createFileSnapshot method
      const testFilePath = path.join(testDir, 'test.txt');
      await fs.writeFile(testFilePath, 'test content');

      const snapshot = await toolActionStore.createFileSnapshot(testFilePath, {
        testMetadata: 'test'
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.filePath).toBe(testFilePath);
      expect(snapshot.content).toBe('test content');
    });
  });

  describe('Coverage Report Generation', () => {
    it('generates documentation coverage statistics', async () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = await fs.readFile(storeSourcePath, 'utf8');

      // Count JSDoc blocks
      const jsdocBlocks = storeSource.match(/\/\*\*[\s\S]*?\*\//g) || [];
      expect(jsdocBlocks.length).toBeGreaterThan(20); // Should have many documented methods

      // Count @param tags
      const paramTags = storeSource.match(/@param/g) || [];
      expect(paramTags.length).toBeGreaterThan(30); // Should have many parameter documentations

      // Count @returns tags
      const returnsTags = storeSource.match(/@returns/g) || [];
      expect(returnsTags.length).toBeGreaterThan(20); // Should have many return documentations

      // Count @example tags
      const exampleTags = storeSource.match(/@example/g) || [];
      expect(exampleTags.length).toBeGreaterThanOrEqual(2); // At least one for each class
    });

    it('validates documentation quality metrics', () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = fs.readFileSync(storeSourcePath, 'utf8');

      // Both classes should have @example
      const taskStoreExample = storeSource.includes('export class TaskStore') &&
        storeSource.match(/\/\*\*[\s\S]*?@example[\s\S]*?\*\/\s*export class TaskStore/);
      expect(taskStoreExample).toBeTruthy();

      const toolStoreExample = storeSource.includes('export class ToolActionStore') &&
        storeSource.match(/\/\*\*[\s\S]*?@example[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(toolStoreExample).toBeTruthy();

      // Should have comprehensive method documentation
      const documentedMethods = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*(async\s+)?\w+\s*\(/g) || [];
      expect(documentedMethods.length).toBeGreaterThan(15);
    });
  });

  describe('Acceptance Criteria Compliance', () => {
    it('meets all acceptance criteria requirements', async () => {
      const storeSourcePath = path.join(__dirname, '..', 'store.ts');
      const storeSource = await fs.readFile(storeSourcePath, 'utf8');

      const criteria = {
        taskStoreHasExampleJSDoc: false,
        toolActionStoreFullyDocumented: false,
        publicMethodsHaveParamReturns: false,
        constructorInitMethodsDocumented: false
      };

      // Check 1: TaskStore class has JSDoc with @example
      const taskStoreClassDoc = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      criteria.taskStoreHasExampleJSDoc = !!(taskStoreClassDoc && taskStoreClassDoc[0].includes('@example'));

      // Check 2: ToolActionStore class is fully documented
      const toolStoreClassDoc = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      criteria.toolActionStoreFullyDocumented = !!(toolStoreClassDoc &&
        toolStoreClassDoc[0].includes('@example') &&
        toolStoreClassDoc[0].length > 200);

      // Check 3: Public methods have @param and @returns tags
      const coreMethods = ['createTask', 'getTask', 'updateTask', 'listTasks'];
      const documentedMethods = coreMethods.filter(method => {
        const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${method}\\s*\\(`);
        const match = storeSource.match(methodPattern);
        return match && match[0].includes('@param') && match[0].includes('@returns');
      });
      criteria.publicMethodsHaveParamReturns = documentedMethods.length >= 4;

      // Check 4: Constructor and initialization methods documented
      const taskConstructor = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath/);
      const initMethod = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*async initialize/);
      const toolConstructor = storeSource.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore/);

      criteria.constructorInitMethodsDocumented = !!(
        taskConstructor && taskConstructor[0].includes('@param') &&
        initMethod && initMethod[0].includes('@returns') &&
        toolConstructor && toolConstructor[0].includes('@param')
      );

      // All criteria must be met
      expect(criteria.taskStoreHasExampleJSDoc).toBe(true);
      expect(criteria.toolActionStoreFullyDocumented).toBe(true);
      expect(criteria.publicMethodsHaveParamReturns).toBe(true);
      expect(criteria.constructorInitMethodsDocumented).toBe(true);

      // Generate a simple coverage report
      const coverageReport = {
        totalCriteria: 4,
        metCriteria: Object.values(criteria).filter(Boolean).length,
        percentCoverage: (Object.values(criteria).filter(Boolean).length / 4) * 100
      };

      expect(coverageReport.percentCoverage).toBe(100);
    });
  });
});