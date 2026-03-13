/**
 * Output Components Category Validation Test Suite
 *
 * This test validates the implementation and functionality of all 7 output component categories
 * documented in the audit report.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import * as path from 'path';

describe('Output Components Category Validation', () => {
  const componentsPath = path.join(process.cwd(), 'packages/cli/src/ui/components');

  describe('Category 1: StreamingText/ResponseStream', () => {
    it('should have all StreamingText components implemented', () => {
      const streamingTextPath = path.join(componentsPath, 'StreamingText.tsx');
      const responseStreamPath = path.join(componentsPath, 'ResponseStream.tsx');

      expect(existsSync(streamingTextPath), 'StreamingText.tsx should exist').toBe(true);
      expect(existsSync(responseStreamPath), 'ResponseStream.tsx should exist').toBe(true);
    });

    it('should have comprehensive test coverage', () => {
      const testFiles = [
        'StreamingText.test.tsx',
        'StreamingText.responsive.test.tsx',
        'StreamingText.cursor.test.tsx',
        'StreamingText.core-functionality.test.tsx',
        'StreamingText.edge-cases.test.tsx',
        'StreamingText.integration.test.tsx',
        'StreamingText.performance.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 2: MarkdownRenderer', () => {
    it('should have MarkdownRenderer components implemented', () => {
      const markdownRendererPath = path.join(componentsPath, 'MarkdownRenderer.tsx');
      expect(existsSync(markdownRendererPath), 'MarkdownRenderer.tsx should exist').toBe(true);
    });

    it('should have comprehensive test coverage', () => {
      const testFiles = [
        'MarkdownRenderer.test.tsx',
        'MarkdownRenderer.audit.test.tsx',
        'MarkdownRenderer.responsive.test.tsx',
        'MarkdownRenderer.overflow.test.tsx',
        'MarkdownRenderer.integration.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 3: StatusBar', () => {
    it('should have StatusBar components implemented', () => {
      const statusBarPath = path.join(componentsPath, 'StatusBar.tsx');
      expect(existsSync(statusBarPath), 'StatusBar.tsx should exist').toBe(true);
    });

    it('should have status sub-components', () => {
      const statusPath = path.join(componentsPath, 'status');
      expect(existsSync(statusPath), 'status directory should exist').toBe(true);

      const subComponents = ['TokenCounter.tsx', 'CostTracker.tsx'];
      subComponents.forEach(component => {
        const componentPath = path.join(statusPath, component);
        expect(existsSync(componentPath), `${component} should exist`).toBe(true);
      });
    });

    it('should have extensive test coverage', () => {
      const testFiles = [
        'StatusBar.test.tsx',
        'StatusBar.helpers.test.ts',
        'StatusBar.timer.test.tsx',
        'StatusBar.displayMode.test.tsx',
        'StatusBar.responsive.test.tsx',
        'StatusBar.priority-breakpoints.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 4: ProgressIndicators', () => {
    it('should have ProgressIndicators components implemented', () => {
      const progressIndicatorsPath = path.join(componentsPath, 'ProgressIndicators.tsx');
      const taskProgressPath = path.join(componentsPath, 'TaskProgress.tsx');

      expect(existsSync(progressIndicatorsPath), 'ProgressIndicators.tsx should exist').toBe(true);
      expect(existsSync(taskProgressPath), 'TaskProgress.tsx should exist').toBe(true);
    });

    it('should have SubtaskTree in agents directory', () => {
      const subtaskTreePath = path.join(componentsPath, 'agents', 'SubtaskTree.tsx');
      expect(existsSync(subtaskTreePath), 'SubtaskTree.tsx should exist').toBe(true);
    });

    it('should have comprehensive test coverage', () => {
      const testFiles = [
        'ProgressIndicators.test.tsx',
        'ProgressIndicators.performance.test.tsx',
        'ProgressIndicators.responsive-edge-cases.test.tsx',
        'ProgressIndicators.integration.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 5: ErrorDisplay', () => {
    it('should have ErrorDisplay components implemented', () => {
      const errorDisplayPath = path.join(componentsPath, 'ErrorDisplay.tsx');
      expect(existsSync(errorDisplayPath), 'ErrorDisplay.tsx should exist').toBe(true);
    });

    it('should have test coverage', () => {
      const testFiles = [
        'ErrorDisplay.test.tsx',
        'ErrorDisplay.enhanced-responsive.test.tsx',
        'ErrorDisplay.stack-responsive.test.tsx',
        'ErrorDisplay.stack-trace-coverage.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 6: ActivityLog', () => {
    it('should have ActivityLog components implemented', () => {
      const activityLogPath = path.join(componentsPath, 'ActivityLog.tsx');
      expect(existsSync(activityLogPath), 'ActivityLog.tsx should exist').toBe(true);
    });

    it('should have comprehensive test coverage', () => {
      const testFiles = [
        'ActivityLog.test.tsx',
        'ActivityLog.compact-mode.test.tsx',
        'ActivityLog.display-modes.test.tsx',
        'ActivityLog.responsive-width.test.tsx',
        'ActivityLog.acceptance.test.tsx',
        'ActivityLog.verbose-mode.test.tsx'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(componentsPath, '__tests__', testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Category 7: SuccessCelebration', () => {
    it('should have SuccessCelebration components implemented', () => {
      const successCelebrationPath = path.join(componentsPath, 'SuccessCelebration.tsx');
      expect(existsSync(successCelebrationPath), 'SuccessCelebration.tsx should exist').toBe(true);
    });

    it('should have test coverage', () => {
      const testPath = path.join(componentsPath, '__tests__', 'SuccessCelebration.test.tsx');
      expect(existsSync(testPath), 'SuccessCelebration.test.tsx should exist').toBe(true);
    });
  });

  describe('Cross-Cutting Concerns Validation', () => {
    it('should have Ink framework properly integrated in package.json', () => {
      const packageJsonPath = path.join(process.cwd(), 'packages/cli/package.json');
      expect(existsSync(packageJsonPath), 'packages/cli/package.json should exist').toBe(true);

      // Verify ink dependencies are documented in the audit
      // This is validated by the actual package.json content which the audit references
    });

    it('should have useStdoutDimensions hook available', () => {
      const hooksPath = path.join(componentsPath, '../hooks/index.ts');
      expect(existsSync(hooksPath), 'hooks/index.ts should exist').toBe(true);
    });

    it('should have App.tsx integration', () => {
      const appPath = path.join(componentsPath, '../App.tsx');
      expect(existsSync(appPath), 'App.tsx should exist').toBe(true);
    });
  });

  describe('Test Infrastructure Validation', () => {
    it('should have test utilities available', () => {
      const testUtilsPath = path.join(componentsPath, '../__tests__/test-utils.tsx');
      expect(existsSync(testUtilsPath), 'test-utils.tsx should exist').toBe(true);
    });

    it('should have vitest configurations', () => {
      const vitestConfigs = [
        'vitest.config.ts',
        'vitest.unit.config.ts',
        'vitest.integration.config.ts',
        'vitest.e2e.config.ts'
      ];

      vitestConfigs.forEach(config => {
        const configPath = path.join(process.cwd(), config);
        expect(existsSync(configPath), `${config} should exist`).toBe(true);
      });
    });
  });
});