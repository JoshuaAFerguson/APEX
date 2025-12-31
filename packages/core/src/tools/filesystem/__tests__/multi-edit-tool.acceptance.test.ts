/**
 * @fileoverview Acceptance Criteria Tests for MultiEditTool
 *
 * This file validates that the MultiEditTool meets all specified acceptance criteria:
 * - MultiEdit tool implemented supporting multiple old_string/new_string pairs in one operation
 * - Atomic rollback on failure
 * - Tests verify batch operations and rollback behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  MultiEditTool,
  type MultiEditFileParams,
  type MultiEditFileOutput,
  BatchEditError,
} from '../multi-edit-tool.js';

describe('MultiEditTool - Acceptance Criteria Validation', () => {
  let tool: MultiEditTool;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    tool = new MultiEditTool();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'multi-edit-acceptance-'));
    testFile = path.join(testDir, 'acceptance-test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AC1: MultiEdit tool supports multiple old_string/new_string pairs in one operation', () => {
    it('should execute multiple string replacements in a single atomic operation', async () => {
      const content = `
import React from 'react';
import { Button } from './components/Button';
import { Input } from './components/Input';

const API_URL = 'http://localhost:3000';
const DEBUG_MODE = true;
const VERSION = 'v1.0.0';

export function App() {
  const [data, setData] = React.useState('');

  const handleSubmit = () => {
    console.log('Submitting data:', data);
    fetch(API_URL + '/api/submit', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  };

  return (
    <div className="container">
      <h1>My App {VERSION}</h1>
      <Input value={data} onChange={setData} />
      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  );
}
`.trim();

      await fs.writeFile(testFile, content);

      // Perform multiple edits in one operation
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update API URL for production
          { old_string: "'http://localhost:3000'", new_string: "'https://api.production.com'" },

          // Disable debug mode
          { old_string: 'DEBUG_MODE = true', new_string: 'DEBUG_MODE = false' },

          // Update version
          { old_string: "'v1.0.0'", new_string: "'v2.0.0'" },

          // Replace console.log with proper logging
          { old_string: 'console.log', new_string: 'logger.info' },

          // Update CSS class name
          { old_string: 'className="container"', new_string: 'className="app-container"' },

          // Update component prop
          { old_string: 'value={data} onChange={setData}', new_string: 'value={data} onChange={setData} placeholder="Enter data"' },
        ],
      };

      const result = await tool.execute(params);

      // Verify the operation succeeded
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.editsApplied).toBe(6);
      expect(result.output!.editResults).toHaveLength(6);

      // Verify all edits were applied
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('https://api.production.com');
      expect(newContent).toContain('DEBUG_MODE = false');
      expect(newContent).toContain('v2.0.0');
      expect(newContent).toContain('logger.info(');
      expect(newContent).toContain('className="app-container"');
      expect(newContent).toContain('placeholder="Enter data"');

      // Verify old content is gone
      expect(newContent).not.toContain('localhost:3000');
      expect(newContent).not.toContain('DEBUG_MODE = true');
      expect(newContent).not.toContain('v1.0.0');
      expect(newContent).not.toContain('console.log');
      expect(newContent).not.toContain('className="container"');

      // Verify edit metadata
      result.output!.editResults.forEach((editResult, index) => {
        expect(editResult.index).toBe(index);
        expect(editResult.success).toBe(true);
        expect(editResult.replacements).toBe(1);
        expect(editResult.modifiedLines).toHaveLength(1);
      });
    });

    it('should handle batch operations with replace_all option', async () => {
      const content = `
function processData(data) {
  log('Processing started');
  validate(data);
  log('Validation complete');
  transform(data);
  log('Transform complete');
  save(data);
  log('Save complete');
  return data;
}

function validate(data) {
  log('Validating data');
  if (!data) {
    log('Invalid data detected');
    throw new Error('Invalid data');
  }
}
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Replace all log calls with logger.debug
          { old_string: 'log(', new_string: 'logger.debug(', replace_all: true },

          // Update function signatures
          { old_string: 'function processData(data)', new_string: 'async function processData(data)' },
          { old_string: 'function validate(data)', new_string: 'async function validate(data)' },

          // Add error handling
          { old_string: 'throw new Error(\'Invalid data\')', new_string: 'throw new ValidationError(\'Invalid data\')' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output!.editsApplied).toBe(4);

      // Verify replace_all worked correctly (6 log calls total)
      expect(result.output!.editResults[0].replacements).toBe(6);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('logger.debug(');
      expect(newContent).not.toContain('log(');
      expect(newContent).toContain('async function processData');
      expect(newContent).toContain('async function validate');
      expect(newContent).toContain('ValidationError');
    });

    it('should provide detailed results for each edit operation', async () => {
      const content = 'line 1\nline 2\nline 3\nline 4\nline 5\n';
      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'line 1', new_string: 'LINE ONE' },
          { old_string: 'line 3', new_string: 'LINE THREE' },
          { old_string: 'line 5', new_string: 'LINE FIVE' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const editResults = result.output!.editResults;

      // Verify detailed edit results
      expect(editResults[0]).toMatchObject({
        index: 0,
        replacements: 1,
        modifiedLines: [1],
        success: true,
        error: undefined,
      });

      expect(editResults[1]).toMatchObject({
        index: 1,
        replacements: 1,
        modifiedLines: [3],
        success: true,
        error: undefined,
      });

      expect(editResults[2]).toMatchObject({
        index: 2,
        replacements: 1,
        modifiedLines: [5],
        success: true,
        error: undefined,
      });

      // Verify change preview is generated
      expect(result.output!.changePreview).toContain('Applied 3/3 edits');
      expect(result.output!.changePreview).toContain('- 1: line 1');
      expect(result.output!.changePreview).toContain('+ 1: LINE ONE');
    });
  });

  describe('AC2: Atomic rollback on failure to maintain file consistency', () => {
    it('should completely rollback all changes when any edit fails', async () => {
      const originalContent = `
class UserService {
  constructor(config) {
    this.config = config;
    this.users = [];
  }

  async createUser(userData) {
    const user = this.validateUser(userData);
    this.users.push(user);
    return user;
  }

  validateUser(userData) {
    if (!userData.email) {
      throw new Error('Email required');
    }
    return userData;
  }

  async getUsers() {
    return this.users;
  }
}
`.trim();

      await fs.writeFile(testFile, originalContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // These first edits should succeed
          { old_string: 'class UserService', new_string: 'class EnhancedUserService' },
          { old_string: 'this.users = [];', new_string: 'this.users = new Map();' },
          { old_string: 'async createUser(userData)', new_string: 'async createUser(userData, options = {})' },

          // This edit should fail - string doesn't exist
          { old_string: 'nonexistent_method_call()', new_string: 'replacement_call()' },

          // These edits would never be reached due to failure above
          { old_string: 'validateUser(userData)', new_string: 'validateUserData(userData)' },
          { old_string: 'Email required', new_string: 'Valid email address required' },
        ],
      };

      const result = await tool.execute(params);

      // Verify the operation failed
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify COMPLETE rollback - file should be exactly as it was originally
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);

      // Verify none of the successful edits remain
      expect(fileContent).toContain('class UserService'); // Not 'EnhancedUserService'
      expect(fileContent).toContain('this.users = [];'); // Not 'new Map()'
      expect(fileContent).toContain('async createUser(userData)'); // No options parameter
      expect(fileContent).toContain('validateUser(userData)'); // Not 'validateUserData'
      expect(fileContent).toContain('Email required'); // Not enhanced message

      // Verify no partial changes exist
      expect(fileContent).not.toContain('EnhancedUserService');
      expect(fileContent).not.toContain('new Map()');
      expect(fileContent).not.toContain('options = {}');
      expect(fileContent).not.toContain('validateUserData');
    });

    it('should rollback on ambiguous replacement errors', async () => {
      const originalContent = `
function helper() { return 'helper'; }
function helper() { return 'duplicate'; }
function main() {
  return helper();
}
`.trim();

      await fs.writeFile(testFile, originalContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // This should succeed
          { old_string: 'function main()', new_string: 'function mainFunction()' },

          // This should fail - ambiguous match (multiple function helper definitions)
          { old_string: "function helper() { return 'helper'; }", new_string: "function helperFunction() { return 'helper'; }" },

          // This would never be reached
          { old_string: 'return helper();', new_string: 'return helperFunction();' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to ambiguous replacement
      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 2 times');

      // Verify complete rollback
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);
      expect(fileContent).toContain('function main()'); // Should not be changed to mainFunction
    });

    it('should rollback on file system errors during write operation', async () => {
      const originalContent = 'original content that should be preserved';
      await fs.writeFile(testFile, originalContent);

      // Make the file read-only to simulate write failure
      await fs.chmod(testFile, 0o444);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'original content', new_string: 'modified content' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to write permissions
      expect(result.success).toBe(false);

      // Restore write permissions for verification
      await fs.chmod(testFile, 0o644);

      // Verify file content is unchanged
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);
    });

    it('should maintain file integrity during complex cascade failure', async () => {
      const originalContent = `
const config = {
  database: {
    host: 'localhost',
    port: 5432,
    name: 'myapp'
  },
  cache: {
    host: 'localhost',
    port: 6379,
    ttl: 3600
  },
  api: {
    host: 'localhost',
    port: 3000,
    timeout: 5000
  }
};

function connectDatabase() {
  return connect(config.database);
}

function connectCache() {
  return connect(config.cache);
}
`.trim();

      await fs.writeFile(testFile, originalContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // These should all succeed initially
          { old_string: 'host: \'localhost\'', new_string: 'host: process.env.HOST', replace_all: true },
          { old_string: 'port: 5432', new_string: 'port: process.env.DB_PORT' },
          { old_string: 'port: 6379', new_string: 'port: process.env.CACHE_PORT' },
          { old_string: 'port: 3000', new_string: 'port: process.env.API_PORT' },

          // This should fail after many successful edits
          { old_string: 'nonexistent_configuration_key: value', new_string: 'replacement_key: value' },

          // These would never be reached
          { old_string: 'function connectDatabase()', new_string: 'async function connectDatabase()' },
          { old_string: 'function connectCache()', new_string: 'async function connectCache()' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail on the fifth edit
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify complete rollback despite many successful edits
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);

      // Verify all original values are preserved
      expect(fileContent).toContain('host: \'localhost\''); // Not process.env.HOST
      expect(fileContent).toContain('port: 5432'); // Not process.env.DB_PORT
      expect(fileContent).toContain('port: 6379'); // Not process.env.CACHE_PORT
      expect(fileContent).toContain('port: 3000'); // Not process.env.API_PORT
      expect(fileContent).toContain('function connectDatabase()'); // Not async
      expect(fileContent).toContain('function connectCache()'); // Not async
    });
  });

  describe('AC3: Tests verify batch operations and rollback behavior', () => {
    it('should demonstrate proper batch operation execution flow', async () => {
      const content = `
// Configuration settings
const SETTINGS = {
  theme: 'light',
  language: 'en',
  timeout: 30,
  debug: false,
  version: '1.0.0'
};

// Application state
let currentUser = null;
let isAuthenticated = false;
let sessionTimeout = 30 * 60 * 1000; // 30 minutes

// Helper functions
function logMessage(msg) {
  if (SETTINGS.debug) {
    console.log(msg);
  }
}

function checkTimeout() {
  return sessionTimeout;
}
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Batch update configuration
          { old_string: 'theme: \'light\'', new_string: 'theme: \'dark\'' },
          { old_string: 'language: \'en\'', new_string: 'language: \'es\'' },
          { old_string: 'timeout: 30', new_string: 'timeout: 60' },
          { old_string: 'debug: false', new_string: 'debug: true' },
          { old_string: 'version: \'1.0.0\'', new_string: 'version: \'2.0.0\'' },

          // Update session timeout calculation
          { old_string: '30 * 60 * 1000', new_string: 'SETTINGS.timeout * 60 * 1000' },

          // Replace console.log with structured logging
          { old_string: 'console.log(msg)', new_string: 'logger.info(msg)' },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      // Verify successful batch operation
      expect(result.success).toBe(true);
      expect(result.output!.editsApplied).toBe(7);

      // Verify performance (batch should be faster than individual operations)
      expect(executionTime).toBeLessThan(1000);

      // Verify all changes applied atomically
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('theme: \'dark\'');
      expect(newContent).toContain('language: \'es\'');
      expect(newContent).toContain('timeout: 60');
      expect(newContent).toContain('debug: true');
      expect(newContent).toContain('version: \'2.0.0\'');
      expect(newContent).toContain('SETTINGS.timeout * 60 * 1000');
      expect(newContent).toContain('logger.info(msg)');

      // Verify detailed operation tracking
      expect(result.output!.changePreview).toContain('Applied 7/7 edits');
      expect(result.output!.sizeChange.after).toBeDefined();
      expect(result.output!.sizeChange.before).toBeDefined();

      // Verify each edit was tracked properly
      result.output!.editResults.forEach((editResult, index) => {
        expect(editResult.index).toBe(index);
        expect(editResult.success).toBe(true);
        expect(editResult.replacements).toBe(1);
        expect(editResult.modifiedLines.length).toBeGreaterThan(0);
      });
    });

    it('should demonstrate rollback behavior preserves file integrity', async () => {
      const originalContent = `
class DataProcessor {
  constructor() {
    this.cache = new Map();
    this.queue = [];
    this.processing = false;
  }

  async processItem(item) {
    this.queue.push(item);

    if (!this.processing) {
      await this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      await this.handleItem(item);
    }

    this.processing = false;
  }

  async handleItem(item) {
    if (this.cache.has(item.id)) {
      return this.cache.get(item.id);
    }

    const result = await this.transform(item);
    this.cache.set(item.id, result);
    return result;
  }
}
`.trim();

      await fs.writeFile(testFile, originalContent);

      // Test multiple scenarios of rollback behavior

      // Scenario 1: Rollback due to string not found
      const params1: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'class DataProcessor', new_string: 'class EnhancedDataProcessor' },
          { old_string: 'this.cache = new Map()', new_string: 'this.cache = new LRUCache(100)' },
          { old_string: 'nonexistent_method_call()', new_string: 'replacement()' }, // This will fail
        ],
      };

      const result1 = await tool.execute(params1);
      expect(result1.success).toBe(false);

      let fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent); // Complete rollback

      // Scenario 2: Rollback due to ambiguous replacement
      const params2: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'async processItem(item)', new_string: 'async processItem(item, priority = 0)' },
          { old_string: 'item', new_string: 'element' }, // Ambiguous - appears many times
        ],
      };

      const result2 = await tool.execute(params2);
      expect(result2.success).toBe(false);

      fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent); // Complete rollback again

      // Scenario 3: Successful batch operation for comparison
      const params3: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'class DataProcessor', new_string: 'class EnhancedDataProcessor' },
          { old_string: 'this.cache = new Map();', new_string: 'this.cache = new LRUCache(100);' },
          { old_string: 'this.queue = [];', new_string: 'this.queue = new PriorityQueue();' },
        ],
      };

      const result3 = await tool.execute(params3);
      expect(result3.success).toBe(true);

      fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toContain('EnhancedDataProcessor');
      expect(fileContent).toContain('LRUCache(100)');
      expect(fileContent).toContain('PriorityQueue()');
    });

    it('should validate that no partial edits remain after rollback failure', async () => {
      const originalContent = `
export const API_CONFIG = {
  baseURL: 'http://localhost:3000/api',
  timeout: 5000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

export const CACHE_CONFIG = {
  prefix: 'app_cache_',
  ttl: 3600,
  maxKeys: 1000
};

export const LOG_CONFIG = {
  level: 'debug',
  format: 'json',
  output: 'console'
};
`.trim();

      await fs.writeFile(testFile, originalContent);

      // Create a batch operation where a middle edit fails
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update API configuration (should succeed)
          { old_string: 'http://localhost:3000/api', new_string: 'https://api.production.com' },
          { old_string: 'timeout: 5000', new_string: 'timeout: 10000' },
          { old_string: 'retries: 3', new_string: 'retries: 5' },

          // Update cache configuration (should succeed)
          { old_string: 'prefix: \'app_cache_\'', new_string: 'prefix: \'prod_cache_\'' },
          { old_string: 'ttl: 3600', new_string: 'ttl: 7200' },

          // This should fail - string doesn't exist
          { old_string: 'nonexistent_config_key: value', new_string: 'replacement_key: value' },

          // Update log configuration (would succeed if above didn't fail)
          { old_string: 'level: \'debug\'', new_string: 'level: \'info\'' },
          { old_string: 'format: \'json\'', new_string: 'format: \'text\'' },
          { old_string: 'output: \'console\'', new_string: 'output: \'file\'' },
        ],
      };

      const result = await tool.execute(params);

      // Verify operation failed
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Read file and verify NO changes were applied
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);

      // Explicitly check that none of the 'successful' edits remain
      expect(fileContent).toContain('http://localhost:3000/api'); // Not production URL
      expect(fileContent).toContain('timeout: 5000'); // Not 10000
      expect(fileContent).toContain('retries: 3'); // Not 5
      expect(fileContent).toContain('prefix: \'app_cache_\''); // Not prod_cache_
      expect(fileContent).toContain('ttl: 3600'); // Not 7200
      expect(fileContent).toContain('level: \'debug\''); // Not info
      expect(fileContent).toContain('format: \'json\''); // Not text
      expect(fileContent).toContain('output: \'console\''); // Not file

      // Verify no partial state exists
      expect(fileContent).not.toContain('api.production.com');
      expect(fileContent).not.toContain('timeout: 10000');
      expect(fileContent).not.toContain('retries: 5');
      expect(fileContent).not.toContain('prod_cache_');
      expect(fileContent).not.toContain('ttl: 7200');
      expect(fileContent).not.toContain('level: \'info\'');
      expect(fileContent).not.toContain('format: \'text\'');
      expect(fileContent).not.toContain('output: \'file\'');
    });
  });

  describe('Tool Integration and Registration', () => {
    it('should be properly integrated into the filesystem tools registry', async () => {
      // Verify tool definition properties
      const definition = tool.getDefinition();

      expect(definition).toMatchObject({
        name: 'MultiEdit',
        description: expect.stringContaining('multiple surgical edits'),
        category: 'filesystem',
        permissions: ['read', 'write'],
        dangerous: false,
        version: '1.0.0',
      });

      expect(definition.tags).toContain('batch');
      expect(definition.tags).toContain('atomic');
      expect(definition.examples).toHaveLength(3);
    });

    it('should validate parameters according to schema', async () => {
      const definition = tool.getDefinition();
      const schema = definition.parameters;

      expect(schema).toMatchObject({
        type: 'object',
        required: ['file_path', 'edits'],
        properties: {
          file_path: {
            type: 'string',
            minLength: 1,
          },
          edits: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
          },
        },
      });
    });

    it('should demonstrate the complete workflow from planning to execution', async () => {
      // Simulate a complete workflow: validate -> execute -> verify
      const content = 'const old_value = "test";';
      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'old_value', new_string: 'new_value' },
          { old_string: '"test"', new_string: '"production"' },
        ],
      };

      // Step 1: Validate
      const validation = tool.validate(params);
      expect(validation.valid).toBe(true);

      // Step 2: Execute
      const result = await tool.execute(params);
      expect(result.success).toBe(true);

      // Step 3: Verify result structure
      expect(result.output).toMatchObject({
        filePath: testFile,
        editsApplied: 2,
        editResults: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            replacements: 1,
            success: true,
          }),
          expect.objectContaining({
            index: 1,
            replacements: 1,
            success: true,
          }),
        ]),
        changePreview: expect.stringContaining('Applied 2/2 edits'),
        sizeChange: {
          before: expect.any(Number),
          after: expect.any(Number),
        },
      });

      // Step 4: Verify file changes
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('const new_value = "production";');
    });
  });
});