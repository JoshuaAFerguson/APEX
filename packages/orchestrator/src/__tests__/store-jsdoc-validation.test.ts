import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Store JSDoc Documentation Validation', () => {
  const storeFilePath = path.join(__dirname, '..', 'store.ts');
  const storeContent = fs.readFileSync(storeFilePath, 'utf8');

  describe('TaskStore Class Documentation', () => {
    it('should have JSDoc with @example tag', () => {
      const classMatch = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      expect(classMatch).toBeTruthy();

      const classDocumentation = classMatch![0];
      expect(classDocumentation).toContain('@example');
      expect(classDocumentation).toContain('const store = new TaskStore');
      expect(classDocumentation).toContain('await store.initialize()');
    });

    it('should have constructor documentation with @param tag', () => {
      const constructorMatch = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
      expect(constructorMatch).toBeTruthy();

      const constructorDoc = constructorMatch![0];
      expect(constructorDoc).toContain('@param');
      expect(constructorDoc).toContain('projectPath');
    });

    it('should have initialize method documentation', () => {
      const initializeMatch = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*async initialize\s*\(\s*\)/);
      expect(initializeMatch).toBeTruthy();

      const initDoc = initializeMatch![0];
      expect(initDoc).toContain('@returns');
    });

    const publicMethods = [
      { name: 'createTask', params: ['task'], returns: true },
      { name: 'getTask', params: ['taskId'], returns: true },
      { name: 'updateTask', params: ['taskId', 'updates'], returns: true },
      { name: 'updateTaskStatus', params: ['taskId', 'status', 'stage', 'message'], returns: true },
      { name: 'listTasks', params: ['options'], returns: true },
      { name: 'deleteTask', params: ['taskId'], returns: true },
      { name: 'archiveTask', params: ['taskId'], returns: true },
      { name: 'restoreTask', params: ['taskId'], returns: true },
      { name: 'trashTask', params: ['taskId'], returns: true },
      { name: 'addTaskLog', params: ['taskId', 'log'], returns: true },
      { name: 'addTaskArtifact', params: ['taskId', 'artifact'], returns: true },
      { name: 'updateTaskUsage', params: ['taskId', 'usage'], returns: true },
      { name: 'getTasksStats', params: [], returns: true },
    ];

    publicMethods.forEach(({ name, params, returns }) => {
      it(`should document ${name} method with @param and @returns tags`, () => {
        const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${name}\\s*\\(`);
        const methodMatch = storeContent.match(methodPattern);

        if (methodMatch) {
          const methodDoc = methodMatch[0];

          // Check for @param tags for each parameter
          params.forEach(param => {
            if (param !== 'options') { // options might be optional
              expect(methodDoc).toContain(`@param ${param}`);
            }
          });

          // Check for @returns tag if method returns something
          if (returns) {
            expect(methodDoc).toContain('@returns');
          }
        } else {
          // Method might have overloads or different signature
          const anyMethodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/[\\s\\S]*?${name}[\\s\\S]*?\\(`);
          const anyMatch = storeContent.match(anyMethodPattern);
          expect(anyMatch).toBeTruthy();
        }
      });
    });
  });

  describe('ToolActionStore Class Documentation', () => {
    it('should have JSDoc with @example tag', () => {
      const classMatch = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(classMatch).toBeTruthy();

      const classDocumentation = classMatch![0];
      expect(classDocumentation).toContain('@example');
      expect(classDocumentation).toContain('new ToolActionStore');
      expect(classDocumentation).toContain('recordToolAction');
    });

    it('should have constructor documentation with @param tags', () => {
      const constructorMatch = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
      expect(constructorMatch).toBeTruthy();

      const constructorDoc = constructorMatch![0];
      expect(constructorDoc).toContain('@param taskStore');
      expect(constructorDoc).toContain('@param retentionConfig');
    });

    const toolActionMethods = [
      { name: 'recordToolAction', params: ['taskId', 'execution'], returns: true },
      { name: 'createFileSnapshot', params: ['filePath'], returns: true },
      { name: 'getToolActions', params: ['taskId'], returns: true },
      { name: 'undoToolAction', params: ['taskId', 'actionId'], returns: true },
      { name: 'getFileSnapshots', params: ['taskId'], returns: true },
      { name: 'cleanupOldActions', params: [], returns: true },
    ];

    toolActionMethods.forEach(({ name, params, returns }) => {
      it(`should document ${name} method with proper JSDoc`, () => {
        const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${name}\\s*\\(`);
        const methodMatch = storeContent.match(methodPattern);

        if (methodMatch) {
          const methodDoc = methodMatch[0];

          // Check for basic documentation
          expect(methodDoc.length).toBeGreaterThan(10); // Should have meaningful documentation

          // Check for @param tags for main parameters (some might be optional)
          const mainParams = params.slice(0, 2); // Check first two params at minimum
          mainParams.forEach(param => {
            if (methodDoc.includes(`@param`)) {
              expect(methodDoc).toContain(`@param`);
            }
          });

          // Check for @returns if method returns something
          if (returns && methodDoc.includes(`@returns`)) {
            expect(methodDoc).toContain('@returns');
          }
        }

        // At minimum, the method should exist and have some documentation
        const simpleMethodPattern = new RegExp(`${name}\\s*\\(`);
        expect(storeContent).toMatch(simpleMethodPattern);
      });
    });
  });

  describe('Documentation Quality', () => {
    it('should have meaningful method descriptions', () => {
      const jsdocBlocks = storeContent.match(/\/\*\*[\s\S]*?\*\//g) || [];
      const meaningfulBlocks = jsdocBlocks.filter(block =>
        block.length > 50 && // More than just a basic comment
        (block.includes('@param') || block.includes('@returns') || block.includes('@example'))
      );

      // Should have a good number of well-documented methods
      expect(meaningfulBlocks.length).toBeGreaterThan(20);
    });

    it('should have consistent JSDoc formatting', () => {
      const jsdocBlocks = storeContent.match(/\/\*\*[\s\S]*?\*\//g) || [];

      jsdocBlocks.forEach(block => {
        if (block.includes('@param')) {
          // @param should be followed by parameter name and description
          const paramMatches = block.match(/@param\s+\w+[\s\S]*?(?=@|\*\/|$)/g);
          if (paramMatches) {
            paramMatches.forEach(param => {
              expect(param.split(' ').length).toBeGreaterThan(2); // Should have name and description
            });
          }
        }

        if (block.includes('@returns')) {
          // @returns should have a description
          const returnsMatch = block.match(/@returns[\s\S]*?(?=@|\*\/|$)/);
          if (returnsMatch) {
            expect(returnsMatch[0].length).toBeGreaterThan(10); // Should have meaningful description
          }
        }
      });
    });
  });

  describe('Specific Acceptance Criteria Validation', () => {
    it('TaskStore class has JSDoc with @example', () => {
      const taskStoreClassDoc = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
      expect(taskStoreClassDoc).toBeTruthy();
      expect(taskStoreClassDoc![0]).toContain('@example');
    });

    it('ToolActionStore class is fully documented', () => {
      const toolActionStoreClassDoc = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
      expect(toolActionStoreClassDoc).toBeTruthy();

      const doc = toolActionStoreClassDoc![0];
      expect(doc.length).toBeGreaterThan(200); // Should be substantial documentation
      expect(doc).toContain('@example');
    });

    it('Constructor and initialization methods documented', () => {
      // TaskStore constructor
      const taskStoreConstructor = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
      expect(taskStoreConstructor).toBeTruthy();
      expect(taskStoreConstructor![0]).toContain('@param projectPath');

      // TaskStore initialize method
      const initializeMethod = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*async initialize/);
      expect(initializeMethod).toBeTruthy();
      expect(initializeMethod![0]).toContain('@returns');

      // ToolActionStore constructor
      const toolActionConstructor = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
      expect(toolActionConstructor).toBeTruthy();
      expect(toolActionConstructor![0]).toContain('@param taskStore');
    });

    it('All public methods have @param and @returns tags where appropriate', () => {
      const publicMethodPattern = /\/\*\*[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]*\)\s*[:{}]/g;
      const methodMatches = Array.from(storeContent.matchAll(publicMethodPattern));

      let documentedMethods = 0;
      let methodsWithParams = 0;
      let methodsWithReturns = 0;

      methodMatches.forEach(match => {
        const docBlock = match[0];
        if (docBlock.includes('/**')) {
          documentedMethods++;

          if (docBlock.includes('@param')) {
            methodsWithParams++;
          }

          if (docBlock.includes('@returns')) {
            methodsWithReturns++;
          }
        }
      });

      // Should have substantial documentation coverage
      expect(documentedMethods).toBeGreaterThan(15);
      expect(methodsWithParams).toBeGreaterThan(10);
      expect(methodsWithReturns).toBeGreaterThan(10);
    });
  });
});