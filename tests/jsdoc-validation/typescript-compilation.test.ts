/**
 * TypeScript Compilation Validation Tests
 *
 * Tests various JSDoc and TypeScript scenarios to ensure the compilation
 * validation works correctly with different code patterns and documentation styles.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('TypeScript Compilation Validation with JSDoc', () => {
  const testDir = path.join(__dirname, 'ts-test-data');
  const tempTsConfig = path.join(__dirname, 'test-tsconfig.json');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Create TypeScript config for testing
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "node",
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: [path.join(testDir, '**/*.ts')]
    };

    await fs.writeFile(tempTsConfig, JSON.stringify(tsConfig, null, 2));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm(tempTsConfig, { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Valid JSDoc with TypeScript', () => {
    it('should compile functions with proper JSDoc types', async () => {
      const validCode = `
/**
 * Calculates the area of a rectangle
 * @param {number} width - The width of the rectangle
 * @param {number} height - The height of the rectangle
 * @returns {number} The area of the rectangle
 */
export function calculateArea(width: number, height: number): number {
  return width * height;
}

/**
 * Formats a user's full name
 * @param {string} firstName - The user's first name
 * @param {string} lastName - The user's last name
 * @param {string} [middle] - Optional middle name
 * @returns {string} The formatted full name
 */
export function formatName(firstName: string, lastName: string, middle?: string): string {
  return middle ? \`\${firstName} \${middle} \${lastName}\` : \`\${firstName} \${lastName}\`;
}

/**
 * Configuration for API requests
 */
export interface ApiConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Optional authentication token */
  authToken?: string;
}

/**
 * Creates an API configuration object
 * @param {string} baseUrl - The base URL for the API
 * @param {number} [timeout=5000] - Request timeout in milliseconds
 * @returns {ApiConfig} The configuration object
 */
export function createApiConfig(baseUrl: string, timeout: number = 5000): ApiConfig {
  return {
    baseUrl,
    timeout,
  };
}
`;

      await fs.writeFile(path.join(testDir, 'valid-types.ts'), validCode);

      // Should compile without errors
      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true); // Compilation succeeded
      } catch (error) {
        throw new Error(`Expected valid TypeScript to compile, but got: ${error}`);
      }
    });

    it('should compile classes with JSDoc documentation', async () => {
      const classCode = `
/**
 * Represents a user account in the system
 * @example
 * const user = new UserAccount('john@example.com', 'John Doe');
 * await user.save();
 */
export class UserAccount {
  private _email: string;
  private _name: string;
  private _id?: string;

  /**
   * Creates a new user account
   * @param {string} email - The user's email address
   * @param {string} name - The user's display name
   */
  constructor(email: string, name: string) {
    this._email = email;
    this._name = name;
  }

  /**
   * Gets the user's email address
   * @returns {string} The email address
   */
  get email(): string {
    return this._email;
  }

  /**
   * Gets the user's display name
   * @returns {string} The display name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the user's unique identifier
   * @returns {string | undefined} The user ID if set
   */
  get id(): string | undefined {
    return this._id;
  }

  /**
   * Saves the user account to the database
   * @returns {Promise<void>} Resolves when save is complete
   * @throws {Error} When save operation fails
   */
  async save(): Promise<void> {
    // Simulated save operation
    if (!this._email.includes('@')) {
      throw new Error('Invalid email format');
    }
    this._id = Math.random().toString(36).substr(2, 9);
  }

  /**
   * Updates the user's display name
   * @param {string} newName - The new display name
   * @returns {void}
   */
  updateName(newName: string): void {
    if (newName.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    this._name = newName.trim();
  }
}
`;

      await fs.writeFile(path.join(testDir, 'class-types.ts'), classCode);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected valid class to compile, but got: ${error}`);
      }
    });

    it('should compile generic functions with JSDoc', async () => {
      const genericCode = `
/**
 * Creates an array of the specified length filled with a default value
 * @template T
 * @param {number} length - The length of the array to create
 * @param {T} defaultValue - The value to fill the array with
 * @returns {T[]} An array filled with the default value
 */
export function createFilledArray<T>(length: number, defaultValue: T): T[] {
  return new Array(length).fill(defaultValue);
}

/**
 * Maps over an array and returns a new array with transformed values
 * @template T, U
 * @param {T[]} array - The input array
 * @param {function(T, number): U} mapper - The transformation function
 * @returns {U[]} The transformed array
 */
export function mapArray<T, U>(array: T[], mapper: (item: T, index: number) => U): U[] {
  return array.map(mapper);
}

/**
 * A generic result type that can represent success or failure
 * @template T, E
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Creates a successful result
 * @template T
 * @param {T} data - The success data
 * @returns {Result<T, never>} A successful result
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Creates a failed result
 * @template E
 * @param {E} error - The error data
 * @returns {Result<never, E>} A failed result
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}
`;

      await fs.writeFile(path.join(testDir, 'generic-types.ts'), genericCode);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected valid generic types to compile, but got: ${error}`);
      }
    });
  });

  describe('Invalid TypeScript that should fail compilation', () => {
    it('should fail compilation with type mismatches', async () => {
      const invalidCode = `
/**
 * Function with type errors that should fail compilation
 * @param {string} input - A string input
 * @returns {number} Should return a number
 */
export function typeError(input: string): number {
  // This should cause a compilation error: returning string instead of number
  return input.toUpperCase();
}

/**
 * Another function with parameter type mismatch
 * @param {number} count - Should be a number
 * @returns {string} Returns a string
 */
export function parameterError(count: number): string {
  // This should cause an error: calling string method on number
  return count.charAt(0);
}
`;

      await fs.writeFile(path.join(testDir, 'type-errors.ts'), invalidCode);

      let compilationFailed = false;
      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
      } catch (error) {
        compilationFailed = true;
        expect(error).toBeDefined();
      }

      expect(compilationFailed).toBe(true);
    });

    it('should fail compilation with undefined variable usage', async () => {
      const undefinedCode = `
/**
 * Function that uses undefined variables
 * @returns {string} Should return a string
 */
export function undefinedError(): string {
  // This should cause a compilation error: undefinedVariable is not defined
  return undefinedVariable.toString();
}

/**
 * Function with strict null check violations
 * @param {string | null} input - Potentially null input
 * @returns {string} Returns processed string
 */
export function nullCheckError(input: string | null): string {
  // This should cause an error with strict null checks
  return input.toUpperCase();
}
`;

      await fs.writeFile(path.join(testDir, 'undefined-errors.ts'), undefinedCode);

      let compilationFailed = false;
      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
      } catch (error) {
        compilationFailed = true;
        expect(error).toBeDefined();
      }

      expect(compilationFailed).toBe(true);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle async/await functions correctly', async () => {
      const asyncCode = `
/**
 * Fetches user data from an API
 * @param {string} userId - The user's unique identifier
 * @returns {Promise<UserData>} Promise that resolves to user data
 * @throws {Error} When the API request fails
 */
export async function fetchUserData(userId: string): Promise<UserData> {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    if (!response.ok) {
      throw new Error(\`Failed to fetch user data: \${response.statusText}\`);
    }
    return await response.json() as UserData;
  } catch (error) {
    throw new Error(\`Network error: \${error}\`);
  }
}

/**
 * User data structure
 */
export interface UserData {
  /** User's unique identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Account creation timestamp */
  createdAt: Date;
}

/**
 * Processes multiple users concurrently
 * @param {string[]} userIds - Array of user IDs to process
 * @returns {Promise<UserData[]>} Promise that resolves to array of user data
 */
export async function processUsers(userIds: string[]): Promise<UserData[]> {
  const promises = userIds.map(id => fetchUserData(id));
  return await Promise.all(promises);
}
`;

      await fs.writeFile(path.join(testDir, 'async-functions.ts'), asyncCode);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected async functions to compile, but got: ${error}`);
      }
    });

    it('should handle union types and conditional logic', async () => {
      const unionCode = `
/**
 * Status of an operation
 */
export type OperationStatus = 'pending' | 'success' | 'error' | 'cancelled';

/**
 * Result of an API operation
 */
export interface ApiResult<T = any> {
  /** Status of the operation */
  status: OperationStatus;
  /** Data returned on success */
  data?: T;
  /** Error message on failure */
  error?: string;
  /** Timestamp of the operation */
  timestamp: Date;
}

/**
 * Processes an API result and returns appropriate response
 * @param {ApiResult<any>} result - The API result to process
 * @returns {string | any} Either the data or an error message
 */
export function processApiResult(result: ApiResult<any>): string | any {
  switch (result.status) {
    case 'success':
      return result.data;
    case 'error':
      return \`Error: \${result.error || 'Unknown error'}\`;
    case 'pending':
      return 'Operation is still pending...';
    case 'cancelled':
      return 'Operation was cancelled';
    default:
      // TypeScript should ensure this is never reached
      const exhaustiveCheck: never = result.status;
      return \`Unknown status: \${exhaustiveCheck}\`;
  }
}

/**
 * Creates a successful API result
 * @template T
 * @param {T} data - The success data
 * @returns {ApiResult<T>} A successful API result
 */
export function createSuccessResult<T>(data: T): ApiResult<T> {
  return {
    status: 'success',
    data,
    timestamp: new Date()
  };
}

/**
 * Creates an error API result
 * @param {string} error - The error message
 * @returns {ApiResult<never>} An error API result
 */
export function createErrorResult(error: string): ApiResult<never> {
  return {
    status: 'error',
    error,
    timestamp: new Date()
  };
}
`;

      await fs.writeFile(path.join(testDir, 'union-types.ts'), unionCode);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected union types to compile, but got: ${error}`);
      }
    });

    it('should handle complex object types and nested structures', async () => {
      const complexCode = `
/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database host */
  host: string;
  /** Database port */
  port: number;
  /** Database name */
  database: string;
  /** Connection credentials */
  credentials: {
    /** Username for authentication */
    username: string;
    /** Password for authentication */
    password: string;
  };
  /** Connection pool settings */
  pool?: {
    /** Minimum number of connections */
    min?: number;
    /** Maximum number of connections */
    max?: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
  };
  /** SSL configuration */
  ssl?: {
    /** Whether to use SSL */
    enabled: boolean;
    /** Path to certificate file */
    certPath?: string;
    /** Whether to reject unauthorized connections */
    rejectUnauthorized?: boolean;
  };
}

/**
 * Creates a database configuration with default values
 * @param {Partial<DatabaseConfig>} config - Partial configuration options
 * @returns {DatabaseConfig} Complete database configuration
 */
export function createDatabaseConfig(config: Partial<DatabaseConfig>): DatabaseConfig {
  return {
    host: config.host || 'localhost',
    port: config.port || 5432,
    database: config.database || 'myapp',
    credentials: {
      username: config.credentials?.username || 'user',
      password: config.credentials?.password || 'password'
    },
    pool: {
      min: config.pool?.min || 1,
      max: config.pool?.max || 10,
      timeout: config.pool?.timeout || 30000,
      ...config.pool
    },
    ssl: config.ssl && {
      enabled: config.ssl.enabled,
      certPath: config.ssl.certPath,
      rejectUnauthorized: config.ssl.rejectUnauthorized ?? true
    }
  };
}

/**
 * Validates a database configuration
 * @param {DatabaseConfig} config - The configuration to validate
 * @returns {boolean} True if configuration is valid
 * @throws {Error} When configuration is invalid
 */
export function validateDatabaseConfig(config: DatabaseConfig): boolean {
  if (!config.host || config.host.trim().length === 0) {
    throw new Error('Database host is required');
  }

  if (config.port <= 0 || config.port > 65535) {
    throw new Error('Database port must be between 1 and 65535');
  }

  if (!config.credentials.username || !config.credentials.password) {
    throw new Error('Database credentials are required');
  }

  if (config.pool && config.pool.min! > config.pool.max!) {
    throw new Error('Pool minimum cannot be greater than maximum');
  }

  return true;
}
`;

      await fs.writeFile(path.join(testDir, 'complex-types.ts'), complexCode);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected complex types to compile, but got: ${error}`);
      }
    });
  });

  describe('JSDoc Type Annotations', () => {
    it('should handle JSDoc type annotations correctly', async () => {
      const jsDocTypes = `
/**
 * @typedef {Object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} Rectangle
 * @property {Point} topLeft - Top left corner
 * @property {Point} bottomRight - Bottom right corner
 */

/**
 * Calculates the distance between two points
 * @param {Point} point1 - First point
 * @param {Point} point2 - Second point
 * @returns {number} Distance between points
 */
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the area of a rectangle
 * @param {Rectangle} rect - The rectangle
 * @returns {number} The area
 */
export function calculateRectangleArea(rect: {
  topLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}): number {
  const width = rect.bottomRight.x - rect.topLeft.x;
  const height = rect.bottomRight.y - rect.topLeft.y;
  return Math.abs(width * height);
}

/**
 * Array of numbers
 * @type {number[]}
 */
export const numbers: number[] = [1, 2, 3, 4, 5];

/**
 * Configuration object
 * @type {{ apiUrl: string, timeout: number, retries: number }}
 */
export const config: { apiUrl: string; timeout: number; retries: number } = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
`;

      await fs.writeFile(path.join(testDir, 'jsdoc-types.ts'), jsDocTypes);

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Expected JSDoc types to compile, but got: ${error}`);
      }
    });
  });

  describe('Compilation Error Analysis', () => {
    it('should provide detailed error information for debugging', async () => {
      const errorCode = `
/**
 * Function with multiple type errors for testing error reporting
 * @param {string} text - Input text
 * @param {number} count - Repeat count
 * @returns {string[]} Array of repeated strings
 */
export function multipleErrors(text: string, count: number): string[] {
  // Error 1: Using string method on number
  const length = count.charAt(0);

  // Error 2: Array.fill expects consistent types
  const result = new Array(count).fill(text);

  // Error 3: Returning wrong type (number instead of string[])
  return length;
}
`;

      await fs.writeFile(path.join(testDir, 'multiple-errors.ts'), errorCode);

      let error: any;
      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.stdout || error.stderr).toContain('error TS');

      // Should contain file path
      expect(error.stdout || error.stderr).toContain('multiple-errors.ts');

      // Should contain line numbers
      expect(error.stdout || error.stderr).toMatch(/\(\d+,\d+\)/);
    });
  });
});