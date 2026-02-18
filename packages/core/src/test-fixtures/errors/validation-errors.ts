/**
 * @fileoverview Validation Error Fixtures
 *
 * Provides Zod validation error scenarios and custom validation errors
 * for testing schema validation and input validation flows.
 */

import { z } from 'zod';
import type { ErrorSimulationOptions } from '../types.js';

/**
 * Creates a Zod validation error with custom issues
 */
export const createZodError = (issues: z.ZodIssue[]): z.ZodError => {
  const error = new z.ZodError(issues);
  return error;
};

/**
 * Helper to create a validation issue
 */
export const createValidationIssue = (
  code: z.ZodIssueCode,
  path: (string | number)[],
  message: string,
  extra?: Record<string, unknown>
): z.ZodIssue => ({
  code,
  path,
  message,
  ...extra,
} as z.ZodIssue);

/**
 * Common validation error scenarios
 */
export const ValidationErrorScenarios = {
  /** Required field missing */
  requiredField: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['description'],
      'Required field is missing',
      { expected: 'string', received: 'undefined' }
    ),
  ]),

  /** Multiple required fields missing */
  multipleRequiredFields: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['name'],
      'Required',
      { expected: 'string', received: 'undefined' }
    ),
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['description'],
      'Required',
      { expected: 'string', received: 'undefined' }
    ),
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['workflow'],
      'Required',
      { expected: 'string', received: 'undefined' }
    ),
  ]),

  /** Invalid type errors */
  invalidType: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['priority'],
      'Expected string, received number',
      { expected: 'string', received: 'number' }
    ),
  ]),

  /** String validation errors */
  stringTooShort: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_small,
      ['name'],
      'String must contain at least 1 character(s)',
      { type: 'string', minimum: 1, inclusive: true }
    ),
  ]),

  stringTooLong: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_big,
      ['description'],
      'String must contain at most 500 character(s)',
      { type: 'string', maximum: 500, inclusive: true }
    ),
  ]),

  /** Number validation errors */
  numberTooSmall: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_small,
      ['retryCount'],
      'Number must be greater than or equal to 0',
      { type: 'number', minimum: 0, inclusive: true }
    ),
  ]),

  numberTooLarge: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_big,
      ['maxRetries'],
      'Number must be less than or equal to 10',
      { type: 'number', maximum: 10, inclusive: true }
    ),
  ]),

  /** Date validation errors */
  invalidDate: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_date,
      ['createdAt'],
      'Invalid date'
    ),
  ]),

  /** Enum validation errors */
  invalidEnum: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_enum_value,
      ['status'],
      "Invalid enum value. Expected 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled', received 'invalid'",
      {
        options: ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled'],
        received: 'invalid',
      }
    ),
  ]),

  /** Array validation errors */
  arrayTooShort: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_small,
      ['agents'],
      'Array must contain at least 1 element(s)',
      { type: 'array', minimum: 1, inclusive: true }
    ),
  ]),

  arrayTooLong: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_big,
      ['logs'],
      'Array must contain at most 100 element(s)',
      { type: 'array', maximum: 100, inclusive: true }
    ),
  ]),

  /** Object validation errors */
  invalidObject: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['usage'],
      'Expected object, received string',
      { expected: 'object', received: 'string' }
    ),
  ]),

  /** Nested object validation errors */
  nestedValidationErrors: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['usage', 'tokenUsage', 'inputTokens'],
      'Expected number, received string',
      { expected: 'number', received: 'string' }
    ),
    createValidationIssue(
      z.ZodIssueCode.too_small,
      ['usage', 'tokenUsage', 'outputTokens'],
      'Number must be greater than or equal to 0',
      { type: 'number', minimum: 0, inclusive: true }
    ),
  ]),

  /** Union validation errors */
  invalidUnion: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_union,
      ['model'],
      'Invalid input',
      {
        unionErrors: [
          createZodError([
            createValidationIssue(
              z.ZodIssueCode.invalid_literal,
              [],
              'Invalid literal value, expected "opus"',
              { expected: 'opus' }
            ),
          ]),
          createZodError([
            createValidationIssue(
              z.ZodIssueCode.invalid_literal,
              [],
              'Invalid literal value, expected "sonnet"',
              { expected: 'sonnet' }
            ),
          ]),
        ],
      }
    ),
  ]),

  /** Discriminated union errors */
  invalidDiscriminatedUnion: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_union_discriminator,
      ['type'],
      'Invalid discriminator value. Expected "success" | "error"',
      { options: ['success', 'error'] }
    ),
  ]),

  /** Custom validation errors */
  customValidation: createZodError([
    createValidationIssue(
      z.ZodIssueCode.custom,
      ['projectPath'],
      'Project path must be an absolute path',
      { code: 'custom' }
    ),
  ]),

  /** Regex pattern validation */
  invalidPattern: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_string,
      ['version'],
      'Invalid semver format',
      { validation: 'regex' }
    ),
  ]),
} as const;

/**
 * Task-specific validation errors
 */
export const TaskValidationErrors = {
  /** Missing required task fields */
  missingRequired: ValidationErrorScenarios.multipleRequiredFields,

  /** Invalid task status */
  invalidStatus: ValidationErrorScenarios.invalidEnum,

  /** Invalid priority */
  invalidPriority: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_enum_value,
      ['priority'],
      "Invalid enum value. Expected 'low' | 'normal' | 'high' | 'urgent', received 'critical'",
      { options: ['low', 'normal', 'high', 'urgent'], received: 'critical' }
    ),
  ]),

  /** Invalid workflow type */
  invalidWorkflow: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['workflow'],
      'Expected string, received null',
      { expected: 'string', received: 'null' }
    ),
  ]),

  /** Invalid usage data */
  invalidUsage: ValidationErrorScenarios.nestedValidationErrors,

  /** Invalid dates */
  invalidDates: createZodError([
    createValidationIssue(
      z.ZodIssueCode.custom,
      ['completedAt'],
      'Completion date cannot be before start date',
      { code: 'custom' }
    ),
  ]),
} as const;

/**
 * Tool configuration validation errors
 */
export const ToolValidationErrors = {
  /** Missing tool name */
  missingName: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['name'],
      'Tool name is required',
      { expected: 'string', received: 'undefined' }
    ),
  ]),

  /** Invalid tool parameters schema */
  invalidParametersSchema: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['parameters', 'properties'],
      'Expected object, received array',
      { expected: 'object', received: 'array' }
    ),
  ]),

  /** Invalid tool category */
  invalidCategory: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_enum_value,
      ['category'],
      "Invalid enum value. Expected 'filesystem' | 'search' | 'shell' | 'web' | 'system' | 'custom', received 'unknown'",
      {
        options: ['filesystem', 'search', 'shell', 'web', 'system', 'custom'],
        received: 'unknown',
      }
    ),
  ]),

  /** Invalid permissions */
  invalidPermissions: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_enum_value,
      ['permissions', 0],
      "Invalid enum value. Expected 'read' | 'write' | 'execute' | 'network' | 'admin', received 'superuser'",
      {
        options: ['read', 'write', 'execute', 'network', 'admin'],
        received: 'superuser',
      }
    ),
  ]),
} as const;

/**
 * Agent configuration validation errors
 */
export const AgentValidationErrors = {
  /** Invalid agent model */
  invalidModel: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_enum_value,
      ['model'],
      "Invalid enum value. Expected 'opus' | 'sonnet' | 'haiku' | 'inherit', received 'gpt-4'",
      { options: ['opus', 'sonnet', 'haiku', 'inherit'], received: 'gpt-4' }
    ),
  ]),

  /** Missing agent prompt */
  missingPrompt: createZodError([
    createValidationIssue(
      z.ZodIssueCode.too_small,
      ['prompt'],
      'Agent prompt must not be empty',
      { type: 'string', minimum: 1, inclusive: true }
    ),
  ]),

  /** Invalid tools array */
  invalidTools: createZodError([
    createValidationIssue(
      z.ZodIssueCode.invalid_type,
      ['tools', 0],
      'Expected string, received number',
      { expected: 'string', received: 'number' }
    ),
  ]),
} as const;

/**
 * Utility function to create custom validation errors
 */
export const createCustomValidationError = (
  field: string,
  message: string,
  options: ErrorSimulationOptions = {}
): z.ZodError =>
  createZodError([
    createValidationIssue(
      z.ZodIssueCode.custom,
      [field],
      message,
      {
        code: 'custom',
        severity: options.severity || 'medium',
        category: options.category || 'validation',
        ...options.data,
      }
    ),
  ]);

/**
 * Validation error preset collections
 */
export const ValidationErrorPresets = {
  /** Basic validation errors */
  basic: {
    required: () => ValidationErrorScenarios.requiredField,
    invalidType: () => ValidationErrorScenarios.invalidType,
    invalidEnum: () => ValidationErrorScenarios.invalidEnum,
    stringTooShort: () => ValidationErrorScenarios.stringTooShort,
    stringTooLong: () => ValidationErrorScenarios.stringTooLong,
  },

  /** Task validation errors */
  task: {
    missingRequired: () => TaskValidationErrors.missingRequired,
    invalidStatus: () => TaskValidationErrors.invalidStatus,
    invalidPriority: () => TaskValidationErrors.invalidPriority,
    invalidUsage: () => TaskValidationErrors.invalidUsage,
  },

  /** Tool validation errors */
  tool: {
    missingName: () => ToolValidationErrors.missingName,
    invalidCategory: () => ToolValidationErrors.invalidCategory,
    invalidPermissions: () => ToolValidationErrors.invalidPermissions,
    invalidSchema: () => ToolValidationErrors.invalidParametersSchema,
  },

  /** Agent validation errors */
  agent: {
    invalidModel: () => AgentValidationErrors.invalidModel,
    missingPrompt: () => AgentValidationErrors.missingPrompt,
    invalidTools: () => AgentValidationErrors.invalidTools,
  },

  /** Complex validation scenarios */
  complex: {
    multipleFields: () => ValidationErrorScenarios.multipleRequiredFields,
    nestedErrors: () => ValidationErrorScenarios.nestedValidationErrors,
    unionErrors: () => ValidationErrorScenarios.invalidUnion,
    customValidation: () => ValidationErrorScenarios.customValidation,
  },
} as const;