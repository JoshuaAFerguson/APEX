/**
 * Event Test Utilities
 *
 * Comprehensive utilities for validating event data integrity.
 * Provides validation functions, assertion helpers, and cross-reference tracking.
 */

import {
  TIMING_TOLERANCE_MS,
  areTimestampsWithinTolerance,
  isReasonableDuration,
  formatDuration
} from './timing-consistency-utils';

/**
 * Generate a unique test ID with optional prefix
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a test timestamp with optional offset
 */
export function createTestTimestamp(offsetMs = 0): Date {
  return new Date(Date.now() + offsetMs);
}

/**
 * Validate that an object has all required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: Array<keyof T>
): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null) {
      missingFields.push(String(field));
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Validate field types against expected types
 */
export function validateFieldTypes<T extends Record<string, unknown>>(
  obj: T,
  typeMap: Record<keyof T, 'string' | 'number' | 'boolean' | 'object' | 'date' | 'array'>
): {
  isValid: boolean;
  typeErrors: string[];
} {
  const typeErrors: string[] = [];

  for (const [field, expectedType] of Object.entries(typeMap)) {
    const value = obj[field];

    if (value === undefined || value === null) {
      continue; // Skip undefined/null values (handled by validateRequiredFields)
    }

    let actualType: string;
    let isValid: boolean;

    switch (expectedType) {
      case 'date':
        actualType = value instanceof Date ? 'date' : typeof value;
        isValid = value instanceof Date && !isNaN(value.getTime());
        break;
      case 'array':
        actualType = Array.isArray(value) ? 'array' : typeof value;
        isValid = Array.isArray(value);
        break;
      case 'object':
        actualType = Array.isArray(value) ? 'array' : typeof value;
        isValid = typeof value === 'object' && !Array.isArray(value);
        break;
      default:
        actualType = typeof value;
        isValid = typeof value === expectedType;
    }

    if (!isValid) {
      typeErrors.push(`${field} expected ${expectedType}, got ${actualType}`);
    }
  }

  return {
    isValid: typeErrors.length === 0,
    typeErrors
  };
}

/**
 * Validate JSON round-trip serialization
 */
export function validateJsonRoundTrip<T extends Record<string, unknown>>(
  obj: T,
  dateFields: Array<keyof T> = []
): {
  isValid: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  try {
    // Serialize and deserialize
    const serialized = JSON.stringify(obj);
    const deserialized = JSON.parse(serialized);

    // Restore Date objects
    for (const dateField of dateFields) {
      if (deserialized[dateField]) {
        deserialized[dateField] = new Date(deserialized[dateField]);
      }
    }

    // Compare all fields
    for (const [key, originalValue] of Object.entries(obj)) {
      const deserializedValue = deserialized[key];

      if (dateFields.includes(key)) {
        // Special handling for Date fields
        if (originalValue instanceof Date && deserializedValue instanceof Date) {
          if (originalValue.getTime() !== deserializedValue.getTime()) {
            differences.push(`${key}: date mismatch after serialization`);
          }
        } else {
          differences.push(`${key}: date type not preserved after serialization`);
        }
      } else if (typeof originalValue === 'object' && originalValue !== null) {
        // Deep comparison for objects
        if (JSON.stringify(originalValue) !== JSON.stringify(deserializedValue)) {
          differences.push(`${key}: object structure changed after serialization`);
        }
      } else {
        // Primitive comparison
        if (originalValue !== deserializedValue) {
          differences.push(`${key}: value changed after serialization`);
        }
      }
    }
  } catch (error) {
    differences.push(`JSON serialization failed: ${error}`);
  }

  return {
    isValid: differences.length === 0,
    differences
  };
}

/**
 * Cross-reference validator for tracking event relationships
 */
export class CrossReferenceValidator {
  private references = new Map<string, Set<string>>();

  /**
   * Register a reference for a specific event type
   */
  registerReference(eventType: string, referenceId: string): void {
    if (!this.references.has(eventType)) {
      this.references.set(eventType, new Set());
    }
    this.references.get(eventType)!.add(referenceId);
  }

  /**
   * Check if a reference exists for a specific event type
   */
  hasReference(eventType: string, referenceId: string): boolean {
    const refs = this.references.get(eventType);
    return refs ? refs.has(referenceId) : false;
  }

  /**
   * Get all references for a specific event type
   */
  getReferences(eventType: string): string[] {
    const refs = this.references.get(eventType);
    return refs ? Array.from(refs) : [];
  }

  /**
   * Find common references between two event types
   */
  findCommonReferences(eventType1: string, eventType2: string): string[] {
    const refs1 = this.references.get(eventType1);
    const refs2 = this.references.get(eventType2);

    if (!refs1 || !refs2) return [];

    return Array.from(refs1).filter(ref => refs2.has(ref));
  }

  /**
   * Clear all references
   */
  clear(): void {
    this.references.clear();
  }
}

/**
 * Event assertion helpers
 */
export const eventAssert = {
  /**
   * Assert that an event has required fields
   */
  hasRequiredFields<T extends Record<string, unknown>>(
    event: T,
    requiredFields: Array<keyof T>
  ): void {
    const result = validateRequiredFields(event, requiredFields);
    if (!result.isValid) {
      throw new Error(`Missing required fields: ${result.missingFields.join(', ')}`);
    }
  },

  /**
   * Assert that a field has the correct type
   */
  hasFieldType<T extends Record<string, unknown>>(
    event: T,
    field: keyof T,
    expectedType: 'string' | 'number' | 'boolean' | 'object' | 'date' | 'array'
  ): void {
    const result = validateFieldTypes(event, { [field]: expectedType });
    if (!result.isValid) {
      throw new Error(`Type assertion failed: ${result.typeErrors.join(', ')}`);
    }
  },

  /**
   * Assert timing consistency between events
   */
  timingConsistency(
    startTime: Date,
    endTime: Date,
    duration: number,
    tolerance = TIMING_TOLERANCE_MS
  ): void {
    const calculatedDuration = endTime.getTime() - startTime.getTime();
    const difference = Math.abs(duration - calculatedDuration);

    if (difference > tolerance) {
      throw new Error(
        `Timing inconsistency: expected duration ${calculatedDuration}ms ± ${tolerance}ms, ` +
        `got ${duration}ms (difference: ${difference}ms)`
      );
    }
  },

  /**
   * Assert that timestamps are within tolerance
   */
  timestampsWithinTolerance(
    timestamp1: Date,
    timestamp2: Date,
    tolerance = TIMING_TOLERANCE_MS
  ): void {
    if (!areTimestampsWithinTolerance(timestamp1, timestamp2, tolerance)) {
      const difference = Math.abs(timestamp1.getTime() - timestamp2.getTime());
      throw new Error(
        `Timestamps not within tolerance: difference ${difference}ms > ${tolerance}ms`
      );
    }
  },

  /**
   * Assert that a duration is reasonable
   */
  reasonableDuration(duration: number): void {
    const result = isReasonableDuration(duration);
    if (!result.isReasonable) {
      throw new Error(`Unreasonable duration: ${formatDuration(duration)} - ${result.issues.join(', ')}`);
    }
  }
};