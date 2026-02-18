/**
 * Error Information Leakage Tests for Orchestrator Package
 *
 * Verifies that orchestrator-level error handling doesn't expose
 * sensitive information such as file paths, API keys, database paths,
 * or SQL queries through the parseErrorMessage() method, event emissions,
 * and TaskStore error handling.
 *
 * This tests the orchestrator's error handling paths that could leak
 * sensitive information beyond what the core package's sanitizeErrorMessage()
 * utility handles.
 *
 * NOTE: This file contains FAKE/DUMMY credential patterns used solely as
 * test fixtures to verify error handling behavior. No real credentials are present.
 *
 * @see ADR-093 for architectural decisions
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { sanitizeErrorMessage, toSafeErrorResponse, ApexError, ApexErrorCode } from '@apexcli/core';
import Database from 'better-sqlite3';
import { TaskStore } from '../store';
import { ApexOrchestrator } from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

/** Sensitive pattern matchers (same as core tests for consistency) */
const SENSITIVE_PATH_PATTERNS = [
  /\/Users\/[^\s/]+\//,
  /\/home\/[^\s/]+\//,
  /[A-Z]:\\Users\\[^\s\\]+\\/i,
  /node_modules\/[^\s]+/,
  /\.apex\/(config\.yaml|apex\.db)/,
  /\/tmp\/[^\s]+/,
];

const SENSITIVE_VALUE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/,
  /sk-[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/,
  /password[=:]\s*\S+/i,
  /(?:api[_-]?key|secret|token|credential)[=:]\s*\S+/i,
];

const SQL_PATTERNS = [
  /SELECT\s+.*\s+FROM/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+.*\s+SET/i,
  /DELETE\s+FROM/i,
  /CREATE\s+TABLE/i,
  /PRAGMA\s+/i,
];

// Dummy test fixtures - NOT real credentials
const DUMMY_ANTHROPIC_KEY = 'sk-ant-api03-AAAA' + 'B'.repeat(20);
const DUMMY_BEARER_TOKEN = 'Bearer ' + 'x'.repeat(30);
const DUMMY_API_KEY = 'sk-' + 'A'.repeat(25);

// Dummy file paths for testing
const DUMMY_HOME_PATH = '/Users/testuser/project/.apex/config.yaml';
const DUMMY_NODE_MODULES_PATH = '/Users/testuser/project/node_modules/@anthropic-ai/sdk/index.js';
const DUMMY_APEX_DB_PATH = '/Users/testuser/project/.apex/apex.db';
const DUMMY_TMP_PATH = '/tmp/apex-task-123456789.json';

function expectNoSensitivePaths(value: string): void {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

function expectNoSensitiveValues(value: string): void {
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

function expectNoSQLPatterns(value: string): void {
  for (const pattern of SQL_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

// Mock dependencies
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

vi.mock('better-sqlite3', () => {
  const mockDB = {
    prepare: vi.fn(),
    exec: vi.fn(),
    close: vi.fn(),
    pragma: vi.fn(),
  };

  const mockConstructor = vi.fn(() => mockDB);
  mockConstructor.prototype = mockDB;

  return {
    default: mockConstructor,
  };
});

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

// ============================================================================
// Tests
// ============================================================================

describe('Error Information Leakage Prevention', () => {

  // ==========================================================================
  // Category 1: Task Execution Errors Don't Leak File Paths (6 tests)
  // ==========================================================================
  describe('Task Execution Errors Don\'t Leak File Paths', () => {
    let orchestrator: ApexOrchestrator;
    let mockQuery: MockedFunction<any>;

    beforeEach(async () => {
      // Mock the claude-agent-sdk query function
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      mockQuery = vi.mocked(query);

      // Create orchestrator with minimal config
      orchestrator = new ApexOrchestrator({
        projectPath: '/tmp/test-project',
        apexPath: '/tmp/test-project/.apex',
        claudeApiKey: 'test-key',
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('parseErrorMessage strips home directory paths from file errors', async () => {
      // Arrange: Mock query to throw error with home directory path
      const fileError = new Error(`ENOENT: no such file or directory, open '${DUMMY_HOME_PATH}'`);
      mockQuery.mockRejectedValue(fileError);

      // Act: Execute task and capture error handling
      try {
        await orchestrator.executeTask({
          id: 'test-task',
          title: 'Test Task',
          description: 'Test',
          status: 'pending',
          priority: 'medium',
          effort: 'small',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        // The orchestrator should have processed the error through parseErrorMessage
        const processedMessage = (orchestrator as any).parseErrorMessage(fileError);
        expectNoSensitivePaths(processedMessage);
      }
    });

    it('parseErrorMessage strips node_modules paths from module errors', async () => {
      // Arrange: Mock query to throw module resolution error
      const moduleError = new Error(`Cannot find module '${DUMMY_NODE_MODULES_PATH}'`);
      mockQuery.mockRejectedValue(moduleError);

      // Act: Process error through orchestrator's parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(moduleError);

      // Assert: No node_modules paths leaked
      expectNoSensitivePaths(processedMessage);
      expect(processedMessage).toContain('Original error:');
    });

    it('parseErrorMessage strips .apex internal paths from config errors', async () => {
      // Arrange: Create error with .apex internal paths
      const configError = new Error(`Failed to load config from ${DUMMY_APEX_DB_PATH}`);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(configError);

      // Assert: .apex paths should be stripped
      expectNoSensitivePaths(processedMessage);
    });

    it('parseErrorMessage strips /tmp paths from temporary file errors', async () => {
      // Arrange: Create error with temp file path
      const tmpError = new Error(`Permission denied writing to ${DUMMY_TMP_PATH}`);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(tmpError);

      // Assert: /tmp paths should be stripped
      expectNoSensitivePaths(processedMessage);
    });

    it('task failure logs don\'t contain raw file paths', async () => {
      // Arrange: Mock TaskStore to capture log calls
      const mockStore = {
        addLog: vi.fn(),
        getTask: vi.fn().mockResolvedValue({ id: 'test-task', status: 'pending' }),
        updateTask: vi.fn(),
      };
      (orchestrator as any).store = mockStore;

      const filePathError = new Error(`Failed to access ${DUMMY_HOME_PATH}`);
      mockQuery.mockRejectedValue(filePathError);

      // Act: Execute task that will fail
      try {
        await orchestrator.executeTask({
          id: 'test-task',
          title: 'Test Task',
          description: 'Test',
          status: 'pending',
          priority: 'medium',
          effort: 'small',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        // Verify that addLog was called and check the message content
        const logCalls = mockStore.addLog.mock.calls;
        for (const call of logCalls) {
          const logEntry = call[1]; // Second parameter is the log entry
          if (logEntry && logEntry.message) {
            expectNoSensitivePaths(logEntry.message);
          }
        }
      }
    });

    it('task:failed event error message doesn\'t expose project directory structure', async () => {
      // Arrange: Set up event listener to capture emitted events
      const emittedEvents: any[] = [];
      orchestrator.on('task:failed', (task, error) => {
        emittedEvents.push({ task, error });
      });

      const directoryError = new Error(`EACCES: permission denied, scandir '${DUMMY_HOME_PATH}'`);
      mockQuery.mockRejectedValue(directoryError);

      // Act: Execute task that will fail and emit event
      try {
        await orchestrator.executeTask({
          id: 'test-task',
          title: 'Test Task',
          description: 'Test',
          status: 'pending',
          priority: 'medium',
          effort: 'small',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        // Assert: Check that emitted events don't contain sensitive paths
        for (const event of emittedEvents) {
          if (event.error && event.error.message) {
            expectNoSensitivePaths(event.error.message);
          }
        }
      }
    });
  });

  // ==========================================================================
  // Category 2: Claude SDK Integration Errors Don't Expose API Keys (5 tests)
  // ==========================================================================
  describe('Claude SDK Integration Errors Don\'t Expose API Keys', () => {
    let orchestrator: ApexOrchestrator;
    let mockQuery: MockedFunction<any>;

    beforeEach(async () => {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      mockQuery = vi.mocked(query);

      orchestrator = new ApexOrchestrator({
        projectPath: '/tmp/test-project',
        apexPath: '/tmp/test-project/.apex',
        claudeApiKey: 'test-key',
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('SDK authentication error doesn\'t expose Anthropic API key', async () => {
      // Arrange: Create auth error with API key
      const authError = new Error(`Invalid API key provided: ${DUMMY_ANTHROPIC_KEY}`);
      mockQuery.mockRejectedValue(authError);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(authError);

      // Assert: API key should be sanitized but original error is appended
      // Note: Current implementation appends "Original error: ${message}" which may leak keys
      // This test documents current behavior - if it fails, that indicates the leak exists
      expectNoSensitiveValues(processedMessage);
    });

    it('SDK error with Bearer token doesn\'t expose token value', async () => {
      // Arrange: Create error with bearer token
      const tokenError = new Error(`Unauthorized: ${DUMMY_BEARER_TOKEN} is invalid`);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(tokenError);

      // Assert: Bearer token should not be exposed
      expectNoSensitiveValues(processedMessage);
    });

    it('SDK error with ANTHROPIC_API_KEY env var doesn\'t expose value', async () => {
      // Arrange: Create error mentioning env var with value
      const envError = new Error(`Environment variable ANTHROPIC_API_KEY=${DUMMY_API_KEY} is invalid`);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(envError);

      // Assert: API key value should be sanitized
      expectNoSensitiveValues(processedMessage);
    });

    it('parseErrorMessage for auth errors replaces original message with safe message', async () => {
      // Arrange: Create authentication error
      const authError = new Error(`Authentication failed: Invalid key ${DUMMY_ANTHROPIC_KEY}`);

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(authError);

      // Assert: Should return safe auth error message
      expect(processedMessage).toContain('Authentication error');
      expect(processedMessage).toContain('Please check your API key configuration');
      // Note: Current implementation may still append "Original error:" which could leak
      expectNoSensitiveValues(processedMessage);
    });

    it('rate limit error from SDK doesn\'t expose internal endpoint URLs', async () => {
      // Arrange: Create rate limit error with internal URLs
      const rateLimitError = new Error('Rate limit exceeded on https://internal-api.anthropic.com/v1/chat/completions?key=secret');

      // Act: Process through parseErrorMessage
      const processedMessage = (orchestrator as any).parseErrorMessage(rateLimitError);

      // Assert: Should return safe rate limit message without exposing internal URLs
      expect(processedMessage).toContain('Rate limit exceeded');
      expect(processedMessage).not.toContain('internal-api');
      expect(processedMessage).not.toContain('key=secret');
    });
  });

  // ==========================================================================
  // Category 3: SQLite/TaskStore Errors Don't Reveal Database Paths or Queries (6 tests)
  // ==========================================================================
  describe('SQLite/TaskStore Errors Don\'t Reveal Database Paths or Queries', () => {
    let tempDbPath: string;

    beforeEach(() => {
      tempDbPath = '/tmp/test-apex.db';
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('TaskStore initialization error doesn\'t reveal database file path', async () => {
      // Arrange: Mock Database constructor to throw path-revealing error
      const MockedDatabase = vi.mocked(Database);
      MockedDatabase.mockImplementation(() => {
        throw new Error(`SQLITE_CANTOPEN: unable to open database file ${tempDbPath}`);
      });

      // Act & Assert: TaskStore creation should handle the error gracefully
      expect(() => {
        new TaskStore(tempDbPath);
      }).toThrow();

      // The error thrown by TaskStore should not reveal the database path
      try {
        new TaskStore(tempDbPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expectNoSensitivePaths(errorMessage);
      }
    });

    it('TaskStore query error doesn\'t expose SQL statements', async () => {
      // Arrange: Mock database to throw SQL-revealing error
      const mockDB = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('SQLITE_ERROR: near "SELCT": syntax error in "SELECT * FROM tasks WHERE status = ?"');
        }),
        exec: vi.fn(),
        close: vi.fn(),
        pragma: vi.fn(),
      };

      const MockedDatabase = vi.mocked(Database);
      MockedDatabase.mockImplementation(() => mockDB);

      // Act: Create store and attempt query that will fail
      const store = new TaskStore(tempDbPath);

      try {
        await store.getTask('test-id');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expectNoSQLPatterns(errorMessage);
      }
    });

    it('TaskStore error doesn\'t expose .apex/apex.db path', async () => {
      // Arrange: Mock database operation to throw path-revealing error
      const apexDbPath = '/Users/testuser/project/.apex/apex.db';
      const mockDB = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error(`SQLITE_BUSY: database is locked: ${apexDbPath}`);
        }),
        exec: vi.fn(),
        close: vi.fn(),
        pragma: vi.fn(),
      };

      const MockedDatabase = vi.mocked(Database);
      MockedDatabase.mockImplementation(() => mockDB);

      // Act: Create store and trigger error
      const store = new TaskStore(apexDbPath);

      try {
        await store.getTasks();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expectNoSensitivePaths(errorMessage);
      }
    });

    it('Task not found error only includes task ID, not database path', async () => {
      // Arrange: Create store with mocked database
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined), // Simulate task not found
        }),
        exec: vi.fn(),
        close: vi.fn(),
        pragma: vi.fn(),
      };

      const MockedDatabase = vi.mocked(Database);
      MockedDatabase.mockImplementation(() => mockDB);

      // Act: Try to get non-existent task
      const store = new TaskStore(tempDbPath);
      const result = await store.getTask('non-existent-id');

      // Assert: Should return null without throwing path-revealing error
      expect(result).toBeNull();

      // If TaskStore does throw an error for not found, it should be safe
      try {
        // Force an error scenario if applicable
        if (typeof (store as any).throwOnNotFound === 'function') {
          (store as any).throwOnNotFound('test-id');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('test-id'); // Task ID is safe to include
        expectNoSensitivePaths(errorMessage); // But no database paths
      }
    });

    it('Database connection error doesn\'t reveal connection string', async () => {
      // Arrange: Mock database to throw connection string error
      const MockedDatabase = vi.mocked(Database);
      MockedDatabase.mockImplementation(() => {
        throw new Error(`Connection failed to sqlite://${tempDbPath}?timeout=5000`);
      });

      // Act & Assert: Store creation should handle error without leaking connection details
      try {
        new TaskStore(tempDbPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expectNoSensitivePaths(errorMessage);
        expect(errorMessage).not.toContain('sqlite://');
        expect(errorMessage).not.toContain('timeout=5000');
      }
    });

    it('Store errors in task execution don\'t leak database internals', async () => {
      // Arrange: Create orchestrator with mocked store that throws database errors
      const orchestrator = new ApexOrchestrator({
        projectPath: '/tmp/test-project',
        apexPath: '/tmp/test-project/.apex',
        claudeApiKey: 'test-key',
      });

      const mockStore = {
        getTask: vi.fn().mockRejectedValue(
          new Error(`SQLITE_CORRUPT: database disk image is malformed at ${tempDbPath}`)
        ),
        addLog: vi.fn(),
        updateTask: vi.fn(),
      };
      (orchestrator as any).store = mockStore;

      // Act: Execute task that will encounter database error
      try {
        await orchestrator.executeTask({
          id: 'test-task',
          title: 'Test Task',
          description: 'Test',
          status: 'pending',
          priority: 'medium',
          effort: 'small',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expectNoSensitivePaths(errorMessage);
        expect(errorMessage).not.toContain('SQLITE_CORRUPT');
        expect(errorMessage).not.toContain('malformed');
      }
    });
  });
});