/**
 * User service for managing user operations
 *
 * @example
 * ```typescript
 * const service = new UserService();
 * const user = await service.createUser({ name: 'John', email: 'john@example.com' });
 * ```
 */
import type { DatabaseConfig } from '../types/config.js';
import { ValidationError } from './errors/ValidationError.js';
import { Logger } from '../utils/logger.js';

/**
 * Core user management service
 * Handles CRUD operations for users with validation
 */
export class UserService {
  /** Maximum number of concurrent operations */
  private static readonly MAX_CONCURRENT_OPS = 10;

  /** Default timeout for database operations */
  private static readonly DEFAULT_TIMEOUT = 5000;

  /** Database configuration */
  private readonly dbConfig: DatabaseConfig;

  /** Logger instance */
  private readonly logger: Logger;

  /** Current operation count */
  private currentOperations: number = 0;

  /**
   * Initialize user service with configuration
   * @param config - Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.dbConfig = config;
    this.logger = new Logger('UserService');
  }

  /**
   * Create a new user
   * @param userData - User data for creation
   * @returns Promise resolving to created user
   * @throws {ValidationError} When user data is invalid
   * @throws {Error} When maximum operations exceeded
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    this.checkOperationLimit();
    this.currentOperations++;

    try {
      const validatedData = await this.validateUserData(userData);
      const userId = this.generateUserId();

      const newUser: User = {
        id: userId,
        name: validatedData.name,
        email: validatedData.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        metadata: {
          source: 'api',
          version: '1.0',
        },
      };

      await this.saveUserToDatabase(newUser);

      this.logger.info(`User created successfully: ${userId}`);
      return newUser;
    } finally {
      this.currentOperations--;
    }
  }

  /**
   * Retrieve user by ID
   * @param userId - User identifier
   * @returns Promise resolving to user or null if not found
   */
  async getUserById(userId: string): Promise<User | null> {
    this.checkOperationLimit();

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    const user = await this.loadUserFromDatabase(userId);

    if (user) {
      this.logger.debug(`User retrieved: ${userId}`);
    } else {
      this.logger.warn(`User not found: ${userId}`);
    }

    return user;
  }

  /**
   * Update existing user
   * @param userId - User identifier
   * @param updateData - Data to update
   * @returns Promise resolving to updated user
   */
  async updateUser(userId: string, updateData: UpdateUserRequest): Promise<User> {
    const existingUser = await this.getUserById(userId);

    if (!existingUser) {
      throw new Error(`User not found: ${userId}`);
    }

    const validatedData = await this.validateUpdateData(updateData);

    const updatedUser: User = {
      ...existingUser,
      ...validatedData,
      updatedAt: new Date(),
    };

    await this.saveUserToDatabase(updatedUser);

    this.logger.info(`User updated successfully: ${userId}`);
    return updatedUser;
  }

  /**
   * Delete user by ID
   * @param userId - User identifier
   * @returns Promise resolving to boolean indicating success
   */
  async deleteUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);

    if (!user) {
      return false;
    }

    await this.removeUserFromDatabase(userId);

    this.logger.info(`User deleted successfully: ${userId}`);
    return true;
  }

  /**
   * List users with pagination
   * @param options - Pagination and filtering options
   * @returns Promise resolving to paginated user list
   */
  async listUsers(options: ListUsersOptions = {}): Promise<UserListResult> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filter = {},
    } = options;

    const offset = (page - 1) * limit;

    const users = await this.loadUsersFromDatabase({
      offset,
      limit,
      sortBy,
      sortOrder,
      filter,
    });

    const totalCount = await this.getUserCount(filter);

    return {
      users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Validate user data before creation
   * @param data - Raw user data
   * @returns Validated user data
   * @private
   */
  private async validateUserData(data: CreateUserRequest): Promise<ValidatedUserData> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('User name is required');
    }

    if (data.name.length > 100) {
      throw new ValidationError('User name must be less than 100 characters');
    }

    if (!this.isValidEmail(data.email)) {
      throw new ValidationError('Valid email address is required');
    }

    // Check for duplicate email
    const existingUser = await this.getUserByEmail(data.email);
    if (existingUser) {
      throw new ValidationError('Email address already exists');
    }

    return {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
    };
  }

  /**
   * Validate user update data
   * @param data - Update data
   * @returns Validated update data
   * @private
   */
  private async validateUpdateData(data: UpdateUserRequest): Promise<Partial<ValidatedUserData>> {
    const validatedData: Partial<ValidatedUserData> = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('User name cannot be empty');
      }
      if (data.name.length > 100) {
        throw new ValidationError('User name must be less than 100 characters');
      }
      validatedData.name = data.name.trim();
    }

    if (data.email !== undefined) {
      if (!this.isValidEmail(data.email)) {
        throw new ValidationError('Valid email address is required');
      }
      validatedData.email = data.email.toLowerCase().trim();
    }

    return validatedData;
  }

  /**
   * Check if email format is valid
   * @param email - Email to validate
   * @returns True if email is valid
   * @private
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate unique user ID
   * @returns Unique identifier
   * @private
   */
  private generateUserId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `user_${timestamp}_${random}`;
  }

  /**
   * Check operation limits
   * @private
   * @throws {Error} When operation limit exceeded
   */
  private checkOperationLimit(): void {
    if (this.currentOperations >= UserService.MAX_CONCURRENT_OPS) {
      throw new Error('Maximum concurrent operations exceeded');
    }
  }

  /**
   * Save user to database
   * @param user - User to save
   * @returns Promise resolving when save completes
   * @private
   */
  private async saveUserToDatabase(user: User): Promise<void> {
    // Simulate database save with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database operation timeout'));
      }, UserService.DEFAULT_TIMEOUT);

      setTimeout(() => {
        clearTimeout(timeout);
        resolve(undefined);
      }, 50); // Simulate 50ms database operation
    });
  }

  /**
   * Load user from database
   * @param userId - User ID to load
   * @returns Promise resolving to user or null
   * @private
   */
  private async loadUserFromDatabase(userId: string): Promise<User | null> {
    // Simulate database load
    await new Promise(resolve => setTimeout(resolve, 25));
    return null; // Simulate no user found for testing
  }

  /**
   * Remove user from database
   * @param userId - User ID to remove
   * @returns Promise resolving when removal completes
   * @private
   */
  private async removeUserFromDatabase(userId: string): Promise<void> {
    // Simulate database removal
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  /**
   * Load users from database with options
   * @param options - Load options
   * @returns Promise resolving to user array
   * @private
   */
  private async loadUsersFromDatabase(options: DatabaseLoadOptions): Promise<User[]> {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 100));
    return []; // Simulate empty result for testing
  }

  /**
   * Get user count for pagination
   * @param filter - Filter criteria
   * @returns Promise resolving to user count
   * @private
   */
  private async getUserCount(filter: UserFilter): Promise<number> {
    // Simulate count query
    await new Promise(resolve => setTimeout(resolve, 25));
    return 0; // Simulate zero count for testing
  }

  /**
   * Get user by email address
   * @param email - Email to search for
   * @returns Promise resolving to user or null
   * @private
   */
  private async getUserByEmail(email: string): Promise<User | null> {
    // Simulate email lookup
    await new Promise(resolve => setTimeout(resolve, 40));
    return null; // Simulate no user found for testing
  }
}

/**
 * User entity interface
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Whether account is active */
  isActive: boolean;
  /** Additional metadata */
  metadata: UserMetadata;
}

/**
 * User metadata structure
 */
interface UserMetadata {
  /** Source of user creation */
  source: string;
  /** Schema version */
  version: string;
}

/**
 * User creation request data
 */
export interface CreateUserRequest {
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
}

/**
 * User update request data
 */
export interface UpdateUserRequest {
  /** Updated name (optional) */
  name?: string;
  /** Updated email (optional) */
  email?: string;
}

/**
 * Validated user data
 */
interface ValidatedUserData {
  name: string;
  email: string;
}

/**
 * List users options
 */
export interface ListUsersOptions {
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Field to sort by */
  sortBy?: keyof User;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filter criteria */
  filter?: UserFilter;
}

/**
 * User filter criteria
 */
interface UserFilter {
  /** Filter by active status */
  isActive?: boolean;
  /** Filter by name pattern */
  namePattern?: string;
  /** Filter by email domain */
  emailDomain?: string;
}

/**
 * Database load options
 */
interface DatabaseLoadOptions {
  offset: number;
  limit: number;
  sortBy: keyof User;
  sortOrder: 'asc' | 'desc';
  filter: UserFilter;
}

/**
 * Paginated user list result
 */
export interface UserListResult {
  /** User array */
  users: User[];
  /** Pagination information */
  pagination: PaginationInfo;
}

/**
 * Pagination metadata
 */
interface PaginationInfo {
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Total item count */
  totalCount: number;
  /** Total page count */
  totalPages: number;
  /** Whether next page exists */
  hasNextPage: boolean;
  /** Whether previous page exists */
  hasPreviousPage: boolean;
}