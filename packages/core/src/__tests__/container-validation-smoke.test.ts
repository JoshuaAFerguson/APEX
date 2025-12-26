import { describe, it, expect } from 'vitest';
import {
  validateContainerWorkspaceConfig,
  ContainerValidationError,
  ContainerValidationWarning,
  ContainerValidationResult
} from '../config';
import { ApexConfig } from '../types';

/**
 * Smoke tests for container workspace validation functionality
 * These tests verify basic functionality without complex mocking
 */
describe('Container Validation Smoke Tests', () => {
  describe('Type exports', () => {
    it('should export all required types and functions', () => {
      expect(typeof validateContainerWorkspaceConfig).toBe('function');
      expect(validateContainerWorkspaceConfig.length).toBe(1); // Should accept one parameter
    });

    it('should define proper TypeScript interfaces', () => {
      // Test that we can create objects with the expected interface shapes
      const error: ContainerValidationError = {
        type: 'missing_runtime',
        message: 'Test error message',
        suggestion: 'Test suggestion'
      };

      const warning: ContainerValidationWarning = {
        type: 'no_image_specified',
        message: 'Test warning message',
        suggestion: 'Test warning suggestion'
      };

      const result: ContainerValidationResult = {
        valid: true,
        errors: [error],
        warnings: [warning]
      };

      expect(error.type).toBe('missing_runtime');
      expect(warning.type).toBe('no_image_specified');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('Basic functionality', () => {
    it('should handle minimal config without workspace', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const result = await validateContainerWorkspaceConfig(config);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle non-container workspace strategies', async () => {
      const strategies = ['worktree', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        const config: ApexConfig = {
          version: '1.0',
          project: {
            name: 'test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          workspace: {
            defaultStrategy: strategy,
            cleanupOnComplete: true,
          },
        };

        const result = await validateContainerWorkspaceConfig(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      }
    });

    it('should return proper result structure for container strategy', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      const result = await validateContainerWorkspaceConfig(config);

      // Result should have proper structure regardless of validation outcome
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Error and warning structure validation', () => {
    it('should use correct error types', () => {
      const validErrorTypes = ['missing_runtime', 'runtime_not_functional'];

      const error1: ContainerValidationError = {
        type: 'missing_runtime',
        message: 'No runtime available',
      };

      const error2: ContainerValidationError = {
        type: 'runtime_not_functional',
        message: 'Runtime not working',
        suggestion: 'Fix it',
      };

      expect(validErrorTypes).toContain(error1.type);
      expect(validErrorTypes).toContain(error2.type);
    });

    it('should use correct warning types', () => {
      const validWarningTypes = ['no_image_specified'];

      const warning: ContainerValidationWarning = {
        type: 'no_image_specified',
        message: 'No image specified',
        suggestion: 'Set an image',
      };

      expect(validWarningTypes).toContain(warning.type);
    });

    it('should allow optional suggestion field', () => {
      const errorWithoutSuggestion: ContainerValidationError = {
        type: 'missing_runtime',
        message: 'Error without suggestion',
      };

      const warningWithoutSuggestion: ContainerValidationWarning = {
        type: 'no_image_specified',
        message: 'Warning without suggestion',
      };

      expect(errorWithoutSuggestion.suggestion).toBeUndefined();
      expect(warningWithoutSuggestion.suggestion).toBeUndefined();
    });
  });

  describe('Schema compatibility', () => {
    it('should work with minimal ApexConfig', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // Should not throw during validation call
      expect(() => {
        validateContainerWorkspaceConfig(minimalConfig);
      }).not.toThrow();
    });

    it('should work with full container configuration', () => {
      const fullConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'full-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            networkMode: 'bridge',
            autoRemove: true,
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            environment: {
              NODE_ENV: 'test',
            },
          },
        },
      };

      // Should not throw during validation call
      expect(() => {
        validateContainerWorkspaceConfig(fullConfig);
      }).not.toThrow();
    });
  });

  describe('Function signature and behavior', () => {
    it('should be an async function', () => {
      const result = validateContainerWorkspaceConfig({
        version: '1.0',
        project: {
          name: 'async-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      });

      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept ApexConfig parameter', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'param-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // Function should accept config without throwing
      const result = await validateContainerWorkspaceConfig(config);
      expect(result).toBeDefined();
    });

    it('should return ContainerValidationResult', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'return-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const result = await validateContainerWorkspaceConfig(config);

      // Check that result matches ContainerValidationResult interface
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);

      // Check that error and warning arrays contain proper objects
      result.errors.forEach(error => {
        expect(typeof error.type).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(error.suggestion === undefined || typeof error.suggestion === 'string').toBe(true);
      });

      result.warnings.forEach(warning => {
        expect(typeof warning.type).toBe('string');
        expect(typeof warning.message).toBe('string');
        expect(warning.suggestion === undefined || typeof warning.suggestion === 'string').toBe(true);
      });
    });
  });
});