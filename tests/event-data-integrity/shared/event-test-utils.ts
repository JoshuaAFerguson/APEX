/**
 * Shared utilities for event data integrity testing
 *
 * Provides common patterns and helpers for testing APEX event payloads
 */

import { z } from 'zod';

/**
 * Generate a unique ID for testing
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a test timestamp
 */
export function createTestTimestamp(offsetMs: number = 0): Date {
  return new Date(Date.now() + offsetMs);
}

/**
 * Validates that an event survives JSON round-trip serialization
 */
export function validateJsonRoundTrip<T>(event: T, dateFields: string[] = []): {
  isValid: boolean;
  original: T;
  deserialized: T;
  differences: string[];
} {
  const serialized = JSON.stringify(event);
  const deserialized = JSON.parse(serialized);

  // Restore Date objects
  dateFields.forEach(field => {
    const path = field.split('.');
    let target = deserialized;
    let parent = deserialized;
    let key = '';

    for (let i = 0; i < path.length; i++) {
      if (i === path.length - 1) {
        key = path[i];
        if (target[key]) {
          target[key] = new Date(target[key]);
        }
      } else {
        parent = target;
        target = target[path[i]];
        if (!target) break;
      }
    }
  });

  const differences: string[] = [];

  function compare(orig: unknown, deser: unknown, path: string = ''): void {
    if (orig instanceof Date && deser instanceof Date) {
      if (orig.getTime() !== deser.getTime()) {
        differences.push(`${path}: Date mismatch`);
      }
      return;
    }

    if (typeof orig !== typeof deser) {
      differences.push(`${path}: Type mismatch (${typeof orig} vs ${typeof deser})`);
      return;
    }

    if (orig === null || deser === null) {
      if (orig !== deser) {
        differences.push(`${path}: Null mismatch`);
      }
      return;
    }

    if (typeof orig === 'object') {
      const origKeys = Object.keys(orig as object);
      const deserKeys = Object.keys(deser as object);

      const allKeys = new Set([...origKeys, ...deserKeys]);
      allKeys.forEach(key => {
        compare(
          (orig as Record<string, unknown>)[key],
          (deser as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key
        );
      });
      return;
    }

    if (orig !== deser) {
      differences.push(`${path}: Value mismatch (${orig} vs ${deser})`);
    }
  }

  compare(event, deserialized);

  return {
    isValid: differences.length === 0,
    original: event,
    deserialized: deserialized as T,
    differences,
  };
}

/**
 * Validates that all required fields are present
 */
export function validateRequiredFields<T extends object>(
  event: T,
  requiredFields: (keyof T)[]
): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  requiredFields.forEach(field => {
    const value = event[field];
    if (value === undefined || value === null) {
      missingFields.push(String(field));
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validates field types match expected types
 */
export function validateFieldTypes<T extends object>(
  event: T,
  fieldTypes: Partial<Record<keyof T, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date'>>
): {
  isValid: boolean;
  typeErrors: string[];
} {
  const typeErrors: string[] = [];

  Object.entries(fieldTypes).forEach(([field, expectedType]) => {
    const value = (event as Record<string, unknown>)[field];

    if (value === undefined || value === null) {
      return; // Skip undefined/null - checked by required fields
    }

    let actualType: string;
    if (Array.isArray(value)) {
      actualType = 'array';
    } else if (value instanceof Date) {
      actualType = 'date';
    } else {
      actualType = typeof value;
    }

    if (actualType !== expectedType) {
      typeErrors.push(`${field}: Expected ${expectedType}, got ${actualType}`);
    }
  });

  return {
    isValid: typeErrors.length === 0,
    typeErrors,
  };
}

/**
 * Validates string field constraints
 */
export function validateStringConstraints(
  value: string,
  constraints: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: string[];
  }
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (constraints.minLength !== undefined && value.length < constraints.minLength) {
    errors.push(`String too short (min: ${constraints.minLength}, got: ${value.length})`);
  }

  if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
    errors.push(`String too long (max: ${constraints.maxLength}, got: ${value.length})`);
  }

  if (constraints.pattern && !constraints.pattern.test(value)) {
    errors.push(`String does not match pattern ${constraints.pattern}`);
  }

  if (constraints.enum && !constraints.enum.includes(value)) {
    errors.push(`String not in allowed values: ${constraints.enum.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates numeric field constraints
 */
export function validateNumericConstraints(
  value: number,
  constraints: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
    nonNegative?: boolean;
  }
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (constraints.min !== undefined && value < constraints.min) {
    errors.push(`Number too small (min: ${constraints.min}, got: ${value})`);
  }

  if (constraints.max !== undefined && value > constraints.max) {
    errors.push(`Number too large (max: ${constraints.max}, got: ${value})`);
  }

  if (constraints.integer && !Number.isInteger(value)) {
    errors.push(`Number must be integer, got: ${value}`);
  }

  if (constraints.positive && value <= 0) {
    errors.push(`Number must be positive, got: ${value}`);
  }

  if (constraints.nonNegative && value < 0) {
    errors.push(`Number must be non-negative, got: ${value}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a test wrapper for Zod schema validation
 */
export function createSchemaTestHelper<T>(schema: z.ZodType<T>) {
  return {
    /**
     * Validates that the schema accepts the input
     */
    expectValid(input: unknown): T {
      const result = schema.safeParse(input);
      if (!result.success) {
        throw new Error(`Schema validation failed: ${result.error.message}`);
      }
      return result.data;
    },

    /**
     * Validates that the schema rejects the input
     */
    expectInvalid(input: unknown): z.ZodError {
      const result = schema.safeParse(input);
      if (result.success) {
        throw new Error(`Schema validation should have failed but succeeded`);
      }
      return result.error;
    },

    /**
     * Gets validation errors without throwing
     */
    getErrors(input: unknown): z.ZodError | null {
      const result = schema.safeParse(input);
      return result.success ? null : result.error;
    },

    /**
     * Checks if input is valid
     */
    isValid(input: unknown): boolean {
      return schema.safeParse(input).success;
    },
  };
}

/**
 * Event sequence validator for workflow testing
 */
export class EventSequenceValidator {
  private events: Array<{ type: string; data: unknown; timestamp: Date }> = [];
  private expectedSequence: string[] = [];

  constructor(expectedSequence: string[]) {
    this.expectedSequence = expectedSequence;
  }

  /**
   * Add an event to the sequence
   */
  addEvent(type: string, data: unknown): void {
    this.events.push({
      type,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Validate the event sequence
   */
  validate(): {
    isValid: boolean;
    errors: string[];
    actualSequence: string[];
    expectedSequence: string[];
  } {
    const errors: string[] = [];
    const actualSequence = this.events.map(e => e.type);

    // Check if all expected events occurred in order
    let expectedIndex = 0;
    for (const event of actualSequence) {
      if (event === this.expectedSequence[expectedIndex]) {
        expectedIndex++;
      }
    }

    if (expectedIndex < this.expectedSequence.length) {
      errors.push(
        `Missing events in sequence: ${this.expectedSequence.slice(expectedIndex).join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      actualSequence,
      expectedSequence: this.expectedSequence,
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get all captured events
   */
  getEvents(): Array<{ type: string; data: unknown; timestamp: Date }> {
    return [...this.events];
  }
}

/**
 * Cross-reference validator for checking consistency across related events
 */
export class CrossReferenceValidator {
  private references: Map<string, Set<string>> = new Map();

  /**
   * Register a reference between events
   */
  registerReference(refType: string, refValue: string): void {
    if (!this.references.has(refType)) {
      this.references.set(refType, new Set());
    }
    this.references.get(refType)!.add(refValue);
  }

  /**
   * Check if a reference exists
   */
  hasReference(refType: string, refValue: string): boolean {
    return this.references.get(refType)?.has(refValue) ?? false;
  }

  /**
   * Validate that all expected references exist
   */
  validateReferences(
    expected: Array<{ refType: string; refValue: string }>
  ): {
    isValid: boolean;
    missingReferences: Array<{ refType: string; refValue: string }>;
  } {
    const missingReferences: Array<{ refType: string; refValue: string }> = [];

    expected.forEach(({ refType, refValue }) => {
      if (!this.hasReference(refType, refValue)) {
        missingReferences.push({ refType, refValue });
      }
    });

    return {
      isValid: missingReferences.length === 0,
      missingReferences,
    };
  }

  /**
   * Get all registered references
   */
  getAllReferences(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.references.forEach((values, key) => {
      result[key] = Array.from(values);
    });
    return result;
  }

  /**
   * Clear all references
   */
  clear(): void {
    this.references.clear();
  }
}

/**
 * Assert helper that provides better error messages
 */
export const eventAssert = {
  /**
   * Assert that event data has a specific field value
   */
  hasField<T extends object, K extends keyof T>(
    event: T,
    field: K,
    expectedValue: T[K],
    message?: string
  ): void {
    if (event[field] !== expectedValue) {
      throw new Error(
        message ||
          `Expected ${String(field)} to be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(event[field])}`
      );
    }
  },

  /**
   * Assert that event data has a field of a specific type
   */
  hasFieldType<T extends object>(
    event: T,
    field: keyof T,
    expectedType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date',
    message?: string
  ): void {
    const value = event[field];
    let actualType: string;

    if (Array.isArray(value)) {
      actualType = 'array';
    } else if (value instanceof Date) {
      actualType = 'date';
    } else {
      actualType = typeof value;
    }

    if (actualType !== expectedType) {
      throw new Error(
        message ||
          `Expected ${String(field)} to be of type ${expectedType}, got ${actualType}`
      );
    }
  },

  /**
   * Assert that event data has all required fields
   */
  hasRequiredFields<T extends object>(
    event: T,
    requiredFields: (keyof T)[],
    message?: string
  ): void {
    const result = validateRequiredFields(event, requiredFields);
    if (!result.isValid) {
      throw new Error(
        message || `Missing required fields: ${result.missingFields.join(', ')}`
      );
    }
  },

  /**
   * Assert that string field matches constraints
   */
  stringMatches(
    value: string,
    constraints: Parameters<typeof validateStringConstraints>[1],
    message?: string
  ): void {
    const result = validateStringConstraints(value, constraints);
    if (!result.isValid) {
      throw new Error(message || result.errors.join('; '));
    }
  },

  /**
   * Assert that numeric field matches constraints
   */
  numberMatches(
    value: number,
    constraints: Parameters<typeof validateNumericConstraints>[1],
    message?: string
  ): void {
    const result = validateNumericConstraints(value, constraints);
    if (!result.isValid) {
      throw new Error(message || result.errors.join('; '));
    }
  },
};
