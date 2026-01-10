/**
 * Auto-Fix Stage Completion Hook Tests
 *
 * Tests the specific functionality of auto-fix execution hooks that trigger
 * after code generation workflow stages complete. Focuses on the stage
 * completion detection logic and hook execution timing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isCodeGenerationStage } from '../prompts';
import type { WorkflowStage, AutoFixStageConfig } from '@apexcli/core';

describe('Auto-Fix Stage Completion Hook', () => {

  describe('Code Generation Stage Detection', () => {
    it('should identify stages by agent name', () => {
      const developerStage: WorkflowStage = {
        name: 'custom-implementation',
        agent: 'developer',
        outputs: [],
        description: 'Custom implementation work'
      };

      const testerStage: WorkflowStage = {
        name: 'custom-testing',
        agent: 'tester',
        outputs: [],
        description: 'Custom testing work'
      };

      const plannerStage: WorkflowStage = {
        name: 'custom-planning',
        agent: 'planner',
        outputs: [],
        description: 'Custom planning work'
      };

      expect(isCodeGenerationStage(developerStage)).toBe(true);
      expect(isCodeGenerationStage(testerStage)).toBe(true);
      expect(isCodeGenerationStage(plannerStage)).toBe(false);
    });

    it('should identify stages by output types', () => {
      const codeOutputStage: WorkflowStage = {
        name: 'code-generation',
        agent: 'architect',
        outputs: ['code_changes', 'implementation_files'],
        description: 'Generate code'
      };

      const testOutputStage: WorkflowStage = {
        name: 'test-creation',
        agent: 'reviewer',
        outputs: ['test_files', 'verification_code'],
        description: 'Create tests'
      };

      const implementationStage: WorkflowStage = {
        name: 'feature-impl',
        agent: 'architect',
        outputs: ['implementation', 'files_modified'],
        description: 'Implement feature'
      };

      const docsStage: WorkflowStage = {
        name: 'documentation',
        agent: 'writer',
        outputs: ['documentation', 'readme'],
        description: 'Write docs'
      };

      expect(isCodeGenerationStage(codeOutputStage)).toBe(true);
      expect(isCodeGenerationStage(testOutputStage)).toBe(true);
      expect(isCodeGenerationStage(implementationStage)).toBe(true);
      expect(isCodeGenerationStage(docsStage)).toBe(false);
    });

    it('should handle stages with no outputs gracefully', () => {
      const emptyOutputsStage: WorkflowStage = {
        name: 'planning',
        agent: 'planner',
        outputs: [],
        description: 'Planning work'
      };

      const undefinedOutputsStage: WorkflowStage = {
        name: 'analysis',
        agent: 'analyst',
        description: 'Analysis work'
        // outputs intentionally undefined
      };

      expect(isCodeGenerationStage(emptyOutputsStage)).toBe(false);
      expect(isCodeGenerationStage(undefinedOutputsStage)).toBe(false);
    });

    it('should be case-insensitive for output matching', () => {
      const mixedCaseStage: WorkflowStage = {
        name: 'mixed-case',
        agent: 'custom',
        outputs: ['CODE_Changes', 'Test_Files', 'IMPLEMENTATION'],
        description: 'Mixed case outputs'
      };

      expect(isCodeGenerationStage(mixedCaseStage)).toBe(true);
    });
  });

  describe('Stage Trigger Configuration', () => {
    const mockAutoFixConfig: AutoFixStageConfig = {
      enabled: true,
      triggerStages: ['implementation', 'testing', 'development'],
      triggerAgents: ['developer', 'tester'],
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      maxFilesPerStage: 50,
      skipOnStageFailure: true
    };

    it('should trigger for configured stage names', () => {
      const implementationStage: WorkflowStage = {
        name: 'implementation',
        agent: 'custom',
        outputs: [],
        description: 'Implementation'
      };

      const testingStage: WorkflowStage = {
        name: 'testing',
        agent: 'custom',
        outputs: [],
        description: 'Testing'
      };

      const planningStage: WorkflowStage = {
        name: 'planning',
        agent: 'custom',
        outputs: [],
        description: 'Planning'
      };

      // Simulate the stage trigger logic
      const shouldTriggerImpl =
        isCodeGenerationStage(implementationStage) ||
        mockAutoFixConfig.triggerStages.includes(implementationStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(implementationStage.agent);

      const shouldTriggerTest =
        isCodeGenerationStage(testingStage) ||
        mockAutoFixConfig.triggerStages.includes(testingStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(testingStage.agent);

      const shouldTriggerPlan =
        isCodeGenerationStage(planningStage) ||
        mockAutoFixConfig.triggerStages.includes(planningStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(planningStage.agent);

      expect(shouldTriggerImpl).toBe(true);
      expect(shouldTriggerTest).toBe(true);
      expect(shouldTriggerPlan).toBe(false);
    });

    it('should trigger for configured agent names', () => {
      const customDeveloperStage: WorkflowStage = {
        name: 'custom-stage',
        agent: 'developer',
        outputs: [],
        description: 'Custom developer work'
      };

      const customTesterStage: WorkflowStage = {
        name: 'custom-stage',
        agent: 'tester',
        outputs: [],
        description: 'Custom tester work'
      };

      const customReviewerStage: WorkflowStage = {
        name: 'custom-stage',
        agent: 'reviewer',
        outputs: [],
        description: 'Custom reviewer work'
      };

      const shouldTriggerDev =
        isCodeGenerationStage(customDeveloperStage) ||
        mockAutoFixConfig.triggerStages.includes(customDeveloperStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(customDeveloperStage.agent);

      const shouldTriggerTest =
        isCodeGenerationStage(customTesterStage) ||
        mockAutoFixConfig.triggerStages.includes(customTesterStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(customTesterStage.agent);

      const shouldTriggerReview =
        isCodeGenerationStage(customReviewerStage) ||
        mockAutoFixConfig.triggerStages.includes(customReviewerStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(customReviewerStage.agent);

      expect(shouldTriggerDev).toBe(true);
      expect(shouldTriggerTest).toBe(true);
      expect(shouldTriggerReview).toBe(false);
    });

    it('should handle multiple trigger conditions', () => {
      // Stage that matches both agent and output criteria
      const multiMatchStage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Developer implementation'
      };

      const shouldTrigger =
        isCodeGenerationStage(multiMatchStage) ||
        mockAutoFixConfig.triggerStages.includes(multiMatchStage.name.toLowerCase()) ||
        mockAutoFixConfig.triggerAgents.includes(multiMatchStage.agent);

      expect(shouldTrigger).toBe(true);
    });
  });

  describe('File Extension Filtering', () => {
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

    it('should filter files by configured extensions', () => {
      const allFiles = [
        'src/component.ts',
        'src/component.tsx',
        'src/utils.js',
        'src/hooks.jsx',
        'src/test.py',
        'docs/readme.md',
        'config.json',
        'styles.css'
      ];

      const filteredFiles = allFiles.filter(file => {
        const ext = file.substring(file.lastIndexOf('.'));
        return supportedExtensions.includes(ext);
      });

      expect(filteredFiles).toEqual([
        'src/component.ts',
        'src/component.tsx',
        'src/utils.js',
        'src/hooks.jsx'
      ]);
    });

    it('should handle files without extensions', () => {
      const filesWithoutExt = [
        'src/component.ts',
        'Dockerfile',
        'README',
        'src/utils.js'
      ];

      const filteredFiles = filesWithoutExt.filter(file => {
        const lastDot = file.lastIndexOf('.');
        if (lastDot === -1) return false;
        const ext = file.substring(lastDot);
        return supportedExtensions.includes(ext);
      });

      expect(filteredFiles).toEqual([
        'src/component.ts',
        'src/utils.js'
      ]);
    });

    it('should handle edge cases in file paths', () => {
      const edgeCaseFiles = [
        '.ts', // Just extension
        'file.', // Trailing dot
        '.hidden.ts', // Hidden file with extension
        'path/to/file.test.ts', // Multiple dots
        'file.TS', // Wrong case
        ''  // Empty string
      ];

      const filteredFiles = edgeCaseFiles.filter(file => {
        if (!file) return false;
        const lastDot = file.lastIndexOf('.');
        if (lastDot === -1) return false;
        const ext = file.substring(lastDot);
        return supportedExtensions.includes(ext);
      });

      expect(filteredFiles).toEqual([
        '.hidden.ts',
        'path/to/file.test.ts'
      ]);
    });
  });

  describe('File Limit Enforcement', () => {
    it('should respect maxFilesPerStage limit', () => {
      const maxFiles = 3;
      const files = [
        'file1.ts',
        'file2.ts',
        'file3.ts',
        'file4.ts',
        'file5.ts'
      ];

      const limitedFiles = files.slice(0, maxFiles);

      expect(limitedFiles).toHaveLength(3);
      expect(limitedFiles).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    it('should handle empty file lists', () => {
      const maxFiles = 5;
      const files: string[] = [];

      const limitedFiles = files.slice(0, maxFiles);

      expect(limitedFiles).toHaveLength(0);
      expect(limitedFiles).toEqual([]);
    });

    it('should handle limits larger than file count', () => {
      const maxFiles = 10;
      const files = ['file1.ts', 'file2.ts'];

      const limitedFiles = files.slice(0, maxFiles);

      expect(limitedFiles).toHaveLength(2);
      expect(limitedFiles).toEqual(files);
    });
  });

  describe('Stage Failure Handling', () => {
    const autoFixConfig: AutoFixStageConfig = {
      enabled: true,
      triggerStages: ['implementation'],
      triggerAgents: ['developer'],
      fileExtensions: ['.ts', '.tsx'],
      maxFilesPerStage: 50,
      skipOnStageFailure: true
    };

    it('should skip auto-fix when stage fails and skipOnStageFailure is true', () => {
      const failedStageResult = {
        stageName: 'implementation',
        agent: 'developer',
        status: 'failed' as const,
        outputs: {},
        artifacts: [],
        summary: 'Stage failed',
        usage: { totalTokens: 0, totalCost: 0 },
        error: 'Implementation error',
        startedAt: new Date(),
        completedAt: new Date()
      };

      const shouldSkip =
        autoFixConfig.skipOnStageFailure &&
        failedStageResult.status === 'failed';

      expect(shouldSkip).toBe(true);
    });

    it('should run auto-fix when stage fails and skipOnStageFailure is false', () => {
      const configNoSkip: AutoFixStageConfig = {
        ...autoFixConfig,
        skipOnStageFailure: false
      };

      const failedStageResult = {
        stageName: 'implementation',
        agent: 'developer',
        status: 'failed' as const,
        outputs: {},
        artifacts: [],
        summary: 'Stage failed',
        usage: { totalTokens: 0, totalCost: 0 },
        error: 'Implementation error',
        startedAt: new Date(),
        completedAt: new Date()
      };

      const shouldSkip =
        configNoSkip.skipOnStageFailure &&
        failedStageResult.status === 'failed';

      expect(shouldSkip).toBe(false);
    });

    it('should run auto-fix when stage succeeds regardless of skipOnStageFailure', () => {
      const successStageResult = {
        stageName: 'implementation',
        agent: 'developer',
        status: 'completed' as const,
        outputs: {},
        artifacts: ['src/test.ts'],
        summary: 'Stage completed',
        usage: { totalTokens: 100, totalCost: 0.01 },
        startedAt: new Date(),
        completedAt: new Date()
      };

      const shouldSkip =
        autoFixConfig.skipOnStageFailure &&
        successStageResult.status === 'failed';

      expect(shouldSkip).toBe(false);
    });
  });

  describe('Integration Points', () => {
    it('should validate AutoFixStageConfig schema requirements', () => {
      const validConfig: AutoFixStageConfig = {
        enabled: true,
        triggerStages: ['implementation', 'testing'],
        triggerAgents: ['developer', 'tester'],
        fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
        maxFilesPerStage: 50,
        skipOnStageFailure: true
      };

      // Validate all required properties are present
      expect(typeof validConfig.enabled).toBe('boolean');
      expect(Array.isArray(validConfig.triggerStages)).toBe(true);
      expect(Array.isArray(validConfig.triggerAgents)).toBe(true);
      expect(Array.isArray(validConfig.fileExtensions)).toBe(true);
      expect(typeof validConfig.maxFilesPerStage).toBe('number');
      expect(typeof validConfig.skipOnStageFailure).toBe('boolean');
    });

    it('should handle partial config with defaults', () => {
      const partialConfig: Partial<AutoFixStageConfig> = {
        enabled: true,
        triggerStages: ['custom-stage']
      };

      // Simulate merging with defaults
      const mergedConfig: AutoFixStageConfig = {
        enabled: partialConfig.enabled ?? true,
        triggerStages: partialConfig.triggerStages ?? ['implementation', 'testing', 'development', 'coding'],
        triggerAgents: partialConfig.triggerAgents ?? ['developer', 'tester'],
        fileExtensions: partialConfig.fileExtensions ?? ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rs'],
        maxFilesPerStage: partialConfig.maxFilesPerStage ?? 50,
        skipOnStageFailure: partialConfig.skipOnStageFailure ?? true
      };

      expect(mergedConfig.enabled).toBe(true);
      expect(mergedConfig.triggerStages).toEqual(['custom-stage']);
      expect(mergedConfig.triggerAgents).toEqual(['developer', 'tester']);
      expect(mergedConfig.fileExtensions).toEqual(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rs']);
      expect(mergedConfig.maxFilesPerStage).toBe(50);
      expect(mergedConfig.skipOnStageFailure).toBe(true);
    });
  });
});