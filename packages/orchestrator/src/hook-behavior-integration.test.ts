import { describe, it, expect } from 'vitest';
import {
  BehaviorModeSchema,
  BehaviorEventDataSchema,
  PostHookResultSchema
} from '@apexcli/core';

describe('Behavior Mode Integration', () => {
  it('should validate BehaviorMode enum values', () => {
    expect(() => BehaviorModeSchema.parse('warn')).not.toThrow();
    expect(() => BehaviorModeSchema.parse('block')).not.toThrow();
    expect(() => BehaviorModeSchema.parse('redact')).not.toThrow();
    expect(() => BehaviorModeSchema.parse('invalid')).toThrow();
  });

  it('should validate BehaviorEventData schema', () => {
    const validEventData = {
      behaviorMode: 'warn',
      toolName: 'test-tool',
      reason: 'Test reason',
      timestamp: new Date(),
    };

    expect(() => BehaviorEventDataSchema.parse(validEventData)).not.toThrow();
  });

  it('should validate PostHookResult with behavior modes', () => {
    const validResult = {
      behaviorMode: 'redact',
      behaviorReason: 'Content contains sensitive data',
    };

    expect(() => PostHookResultSchema.parse(validResult)).not.toThrow();
  });

  it('should validate complete behavior workflow data', () => {
    // Test warn behavior
    const warnResult = {
      modifyResult: false,
      behaviorMode: 'warn',
      behaviorReason: 'Detected potential issue',
      metadata: { source: 'security-hook' },
    };
    expect(() => PostHookResultSchema.parse(warnResult)).not.toThrow();

    // Test block behavior
    const blockResult = {
      modifyResult: true,
      modifiedResult: {
        success: false,
        error: 'Operation blocked',
      },
      behaviorMode: 'block',
      behaviorReason: 'Dangerous operation detected',
    };
    expect(() => PostHookResultSchema.parse(blockResult)).not.toThrow();

    // Test redact behavior
    const redactResult = {
      modifyResult: true,
      modifiedResult: {
        success: true,
        output: { message: '[REDACTED]' },
      },
      behaviorMode: 'redact',
      behaviorReason: 'Sensitive content redacted',
    };
    expect(() => PostHookResultSchema.parse(redactResult)).not.toThrow();
  });
});