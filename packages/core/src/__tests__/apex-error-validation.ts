/**
 * Validation script to verify ApexError implementation compiles and exports correctly
 * This is a TypeScript compilation check, not a runtime test
 */

import {
  ApexError,
  ApexErrorCode,
  ApexErrorContext,
  ApexErrorContextSchema,
  isApexError,
  toApexError,
  wrapWithApexError,
} from '../apex-error';

// Type checking compilation - these should not have any TypeScript errors

// Test error code compilation
const validCode: ApexErrorCode = ApexErrorCode.TASK_NOT_FOUND;

// Test context type compilation
const validContext: ApexErrorContext = {
  taskId: 'test',
  agentId: 'developer',
  stage: 'testing',
  timestamp: new Date(),
  metadata: { test: true },
};

// Test ApexError constructor compilation
const error = new ApexError('Test message', ApexErrorCode.VALIDATION, validContext);

// Test instance methods compilation
const isCode: boolean = error.isCode(ApexErrorCode.VALIDATION);
const isCategory: boolean = error.isCategory('APEX_10');
const details = error.getDetails();
const json = error.toJSON();
const str: string = error.toString();

// Test utility functions compilation
const isApex: boolean = isApexError(error);
const converted = toApexError(new Error('test'), ApexErrorCode.INTERNAL);
const wrapped = wrapWithApexError(() => 'test', ApexErrorCode.UNKNOWN);

// Test schema validation compilation
const parsedContext = ApexErrorContextSchema.parse(validContext);

console.log('✅ ApexError TypeScript compilation validation passed');
export {};