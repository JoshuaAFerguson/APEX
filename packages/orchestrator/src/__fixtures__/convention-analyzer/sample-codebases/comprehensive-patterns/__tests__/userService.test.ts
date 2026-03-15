/**
 * Comprehensive tests for UserService
 * Tests all major functionality including edge cases and error conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService, type User, type CreateUserRequest, type UpdateUserRequest, type ListUsersOptions } from '../src/userService.js';
import { ValidationError } from '../src/errors/ValidationError.js';
import type { DatabaseConfig } from '../types/config.js';

// Mock logger to avoid console output during tests
vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('UserService', () => {
  let userService: UserService;
  let mockDbConfig: DatabaseConfig;

  beforeEach(() => {
    mockDbConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_database',
      connectionTimeout: 5000,
      queryTimeout: 30000,
      maxConnections: 10,
    };

    userService = new UserService(mockDbConfig);
  });

  describe('createUser', () => {
    it('should create user with valid data successfully', async () => {
      const userData: CreateUserRequest = {
        name: 'John Doe',
        email: 'john.doe@example.com',
      };

      const result = await userService.createUser(userData);

      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john.doe@example.com');
      expect(result.id).toMatch(/^user_\\d+_[a-z0-9]+$/);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe('api');
      expect(result.metadata.version).toBe('1.0');
    });

    it('should throw ValidationError for empty name', async () => {
      const userData: CreateUserRequest = {
        name: '',
        email: 'test@example.com',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(ValidationError);
      await expect(userService.createUser(userData)).rejects.toThrow('User name is required');
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      const userData: CreateUserRequest = {
        name: '   \\t\\n   ',
        email: 'test@example.com',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(ValidationError);
      await expect(userService.createUser(userData)).rejects.toThrow('User name is required');
    });

    it('should throw ValidationError for name too long', async () => {
      const userData: CreateUserRequest = {
        name: 'a'.repeat(101), // 101 characters
        email: 'test@example.com',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(ValidationError);
      await expect(userService.createUser(userData)).rejects.toThrow('User name must be less than 100 characters');
    });

    it('should throw ValidationError for invalid email', async () => {
      const invalidEmails = [
        'invalid-email',
        'no-at-symbol.com',
        '@missing-local.com',
        'missing-domain@.com',
        'spaces @example.com',
        'test@',
        '@example.com',
        '',
      ];

      for (const email of invalidEmails) {
        const userData: CreateUserRequest = {
          name: 'Valid Name',
          email,
        };

        await expect(userService.createUser(userData)).rejects.toThrow(ValidationError);
        await expect(userService.createUser(userData)).rejects.toThrow('Valid email address is required');
      }
    });

    it('should normalize email to lowercase', async () => {
      const userData: CreateUserRequest = {
        name: 'John Doe',
        email: 'John.Doe@EXAMPLE.COM',
      };

      const result = await userService.createUser(userData);

      expect(result.email).toBe('john.doe@example.com');
    });

    it('should trim whitespace from name', async () => {
      const userData: CreateUserRequest = {
        name: '  \\t John Doe \\n  ',
        email: 'john@example.com',
      };

      const result = await userService.createUser(userData);

      expect(result.name).toBe('John Doe');
    });

    it('should generate unique user IDs', async () => {
      const userData: CreateUserRequest = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const user1 = await userService.createUser({ ...userData, email: 'test1@example.com' });
      const user2 = await userService.createUser({ ...userData, email: 'test2@example.com' });
      const user3 = await userService.createUser({ ...userData, email: 'test3@example.com' });

      expect(user1.id).not.toBe(user2.id);
      expect(user2.id).not.toBe(user3.id);
      expect(user1.id).not.toBe(user3.id);

      // All should match the expected pattern
      expect(user1.id).toMatch(/^user_\\d+_[a-z0-9]+$/);
      expect(user2.id).toMatch(/^user_\\d+_[a-z0-9]+$/);
      expect(user3.id).toMatch(/^user_\\d+_[a-z0-9]+$/);
    });
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const result = await userService.getUserById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should throw ValidationError for empty user ID', async () => {
      await expect(userService.getUserById('')).rejects.toThrow(ValidationError);
      await expect(userService.getUserById('')).rejects.toThrow('User ID is required');
    });

    it('should throw ValidationError for whitespace-only user ID', async () => {
      await expect(userService.getUserById('   \\t\\n   ')).rejects.toThrow(ValidationError);
      await expect(userService.getUserById('   \\t\\n   ')).rejects.toThrow('User ID is required');
    });

    it('should handle valid user ID format', async () => {
      const validIds = [
        'user_123456789_abc123',
        'user_987654321_xyz789',
        'uuid-format-id',
        'simple-id',
      ];

      for (const userId of validIds) {
        const result = await userService.getUserById(userId);
        expect(result).toBeNull(); // Expected since we're mocking null return
      }
    });
  });

  describe('listUsers', () => {
    it('should return empty list with default pagination', async () => {
      const result = await userService.listUsers();

      expect(result.users).toEqual([]);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle custom pagination options', async () => {
      const options: ListUsersOptions = {
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        filter: {
          isActive: true,
          namePattern: 'John',
        },
      };

      const result = await userService.listUsers(options);

      expect(result.users).toEqual([]);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalCount).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle special characters in names', async () => {
      const specialNames = [
        'José María García-López',
        'Wang Xiaoming',
        "O'Connor-Smith",
        'Jean-Baptiste François',
      ];

      for (const name of specialNames) {
        const userData: CreateUserRequest = {
          name,
          email: 'special@example.com',
        };

        const result = await userService.createUser(userData);
        expect(result.name).toBe(name);
      }
    });

    it('should handle boundary values for name length', async () => {
      // Test exactly 100 characters (should pass)
      const exactly100Chars = 'a'.repeat(100);
      const validUserData: CreateUserRequest = {
        name: exactly100Chars,
        email: 'boundary@example.com',
      };

      const result = await userService.createUser(validUserData);
      expect(result.name).toBe(exactly100Chars);

      // Test 101 characters (should fail)
      const exactly101Chars = 'a'.repeat(101);
      const invalidUserData: CreateUserRequest = {
        name: exactly101Chars,
        email: 'boundary2@example.com',
      };

      await expect(userService.createUser(invalidUserData)).rejects.toThrow(ValidationError);
    });
  });
});