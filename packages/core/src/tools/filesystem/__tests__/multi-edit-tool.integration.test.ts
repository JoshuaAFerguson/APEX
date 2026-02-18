/**
 * @fileoverview Integration tests for MultiEditTool - Real-world scenarios and acceptance criteria validation
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

describe('MultiEditTool - Integration Tests', () => {
  let tool: MultiEditTool;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    tool = new MultiEditTool();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'multi-edit-integration-'));
    testFile = path.join(testDir, 'test.tsx');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Acceptance Criteria Validation', () => {
    it('should support multiple old_string/new_string pairs in one operation', async () => {
      // Test requirement: MultiEdit tool implemented supporting multiple old_string/new_string pairs
      const content = `
import React from 'react';
import { Button } from './Button';
import { Input } from './Input';

export const Component = () => {
  const [value, setValue] = React.useState('');

  const handleClick = () => {
    console.log('Button clicked');
    console.debug('Debug info');
  };

  return (
    <div className="container">
      <Input value={value} onChange={setValue} />
      <Button onClick={handleClick}>Click me</Button>
    </div>
  );
};
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update import to use new component name
          { old_string: "import { Button } from './Button';", new_string: "import { PrimaryButton } from './Button';" },
          // Update component usage
          { old_string: '<Button onClick={handleClick}>Click me</Button>', new_string: '<PrimaryButton onClick={handleClick}>Click me</PrimaryButton>' },
          // Replace console.log calls
          { old_string: 'console.log', new_string: 'logger.info', replace_all: true },
          // Replace console.debug calls
          { old_string: 'console.debug', new_string: 'logger.debug', replace_all: true },
          // Update CSS class
          { old_string: 'className="container"', new_string: 'className="main-container"' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(5);
      expect(result.output?.editResults).toHaveLength(5);

      // Verify all edits were applied correctly
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain("import { PrimaryButton } from './Button';");
      expect(newContent).toContain('<PrimaryButton onClick={handleClick}>Click me</PrimaryButton>');
      expect(newContent).toContain('logger.info(');
      expect(newContent).toContain('logger.debug(');
      expect(newContent).toContain('className="main-container"');

      // Verify old content is gone
      expect(newContent).not.toContain("import { Button } from './Button';");
      expect(newContent).not.toContain('<Button onClick={handleClick}>');
      expect(newContent).not.toContain('console.log(');
      expect(newContent).not.toContain('console.debug(');
    });

    it('should implement atomic rollback on failure', async () => {
      // Test requirement: atomic rollback on failure to maintain file consistency
      const originalContent = `
function processData(data) {
  validate(data);
  transform(data);
  save(data);
}

function validate(data) {
  if (!data) throw new Error('Invalid data');
}
`.trim();

      await fs.writeFile(testFile, originalContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // First edit should succeed
          { old_string: 'function processData(data)', new_string: 'function processDataAdvanced(data)' },
          // Second edit should succeed
          { old_string: 'validate(data);', new_string: 'validateStrict(data);' },
          // Third edit should fail - string doesn't exist
          { old_string: 'nonexistent_function()', new_string: 'replacement()' },
          // This edit would never be reached
          { old_string: 'save(data);', new_string: 'persist(data);' },
        ],
      };

      const result = await tool.execute(params);

      // The operation should fail due to the third edit
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify file was completely rolled back - no changes should remain
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(originalContent);

      // Verify original content is intact
      expect(fileContent).toContain('function processData(data)');
      expect(fileContent).toContain('validate(data);');
      expect(fileContent).toContain('save(data);');

      // Verify no partial edits remain
      expect(fileContent).not.toContain('processDataAdvanced');
      expect(fileContent).not.toContain('validateStrict');
    });

    it('should verify batch operations work correctly', async () => {
      // Test requirement: Tests verify batch operations behavior
      const configContent = `
export const config = {
  api: {
    url: 'http://localhost:3000',
    timeout: 5000,
    retries: 3
  },
  features: {
    enableLogging: true,
    enableAnalytics: false,
    enableDebug: true
  },
  ui: {
    theme: 'light',
    language: 'en',
    animations: true
  }
};
`.trim();

      await fs.writeFile(testFile, configContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update API configuration
          { old_string: 'url: \'http://localhost:3000\'', new_string: 'url: \'https://api.production.com\'' },
          { old_string: 'timeout: 5000', new_string: 'timeout: 10000' },
          { old_string: 'retries: 3', new_string: 'retries: 5' },

          // Update feature flags
          { old_string: 'enableLogging: true', new_string: 'enableLogging: false' },
          { old_string: 'enableAnalytics: false', new_string: 'enableAnalytics: true' },
          { old_string: 'enableDebug: true', new_string: 'enableDebug: false' },

          // Update UI settings
          { old_string: 'theme: \'light\'', new_string: 'theme: \'dark\'' },
          { old_string: 'language: \'en\'', new_string: 'language: \'es\'' },
          { old_string: 'animations: true', new_string: 'animations: false' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(9);

      // Verify each edit was applied exactly once
      result.output?.editResults.forEach((editResult, index) => {
        expect(editResult.success).toBe(true);
        expect(editResult.replacements).toBe(1);
        expect(editResult.index).toBe(index);
      });

      // Verify final state
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('url: \'https://api.production.com\'');
      expect(newContent).toContain('timeout: 10000');
      expect(newContent).toContain('retries: 5');
      expect(newContent).toContain('enableLogging: false');
      expect(newContent).toContain('enableAnalytics: true');
      expect(newContent).toContain('enableDebug: false');
      expect(newContent).toContain('theme: \'dark\'');
      expect(newContent).toContain('language: \'es\'');
      expect(newContent).toContain('animations: false');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex React component refactoring', async () => {
      const componentContent = `
import React, { useState, useEffect } from 'react';
import { fetchUserData, updateUserProfile } from '../api/users';
import { validateEmail, validatePhone } from '../utils/validation';

interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await fetchUserData(userId);
        setUser(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const handleUpdateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = await updateUserProfile(user.id, updates);
      setUser(updatedUser);
      onUpdate?.(updatedUser);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Phone: {user.phone}</p>
    </div>
  );
};
`.trim();

      await fs.writeFile(testFile, componentContent);

      // Refactor to use new API structure and add error handling
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update imports to use new API structure
          { old_string: "import { fetchUserData, updateUserProfile } from '../api/users';", new_string: "import { userApi } from '../api/userApi';" },

          // Update API calls to use new structure
          { old_string: 'await fetchUserData(userId)', new_string: 'await userApi.getUser(userId)' },
          { old_string: 'await updateUserProfile(user.id, updates)', new_string: 'await userApi.updateUser(user.id, updates)' },

          // Update error handling
          { old_string: 'setError(err.message);', new_string: 'setError(err?.message || "Unknown error occurred");', replace_all: true },

          // Add validation imports removal (old validation)
          { old_string: "import { validateEmail, validatePhone } from '../utils/validation';", new_string: "import { userValidator } from '../validators/userValidator';" },

          // Update class name to follow new convention
          { old_string: 'className="user-profile"', new_string: 'className="user-profile-container"' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(6);

      const newContent = await fs.readFile(testFile, 'utf-8');

      // Verify new imports
      expect(newContent).toContain("import { userApi } from '../api/userApi';");
      expect(newContent).toContain("import { userValidator } from '../validators/userValidator';");

      // Verify API calls updated
      expect(newContent).toContain('await userApi.getUser(userId)');
      expect(newContent).toContain('await userApi.updateUser(user.id, updates)');

      // Verify error handling improved
      expect(newContent).toContain('err?.message || "Unknown error occurred"');

      // Verify class name updated
      expect(newContent).toContain('className="user-profile-container"');

      // Verify old content removed
      expect(newContent).not.toContain('fetchUserData');
      expect(newContent).not.toContain('updateUserProfile');
      expect(newContent).not.toContain('validateEmail, validatePhone');
    });

    it('should handle database migration script updates', async () => {
      const migrationContent = `
-- Migration: Add user preferences table
-- Version: 001
-- Created: 2024-01-01

BEGIN TRANSACTION;

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create preferences table
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user
INSERT INTO users (email, password_hash) VALUES ('admin@example.com', 'hashed_password');

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_preferences_user_id ON user_preferences(user_id);

COMMIT;
`.trim();

      await fs.writeFile(testFile, migrationContent);

      // Update migration to version 2 with enhanced security and new fields
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update version and description
          { old_string: '-- Version: 001', new_string: '-- Version: 002' },
          { old_string: '-- Created: 2024-01-01', new_string: '-- Updated: 2024-02-01' },

          // Add new security fields to users table
          { old_string: 'password_hash TEXT NOT NULL,', new_string: 'password_hash TEXT NOT NULL,\n  salt TEXT NOT NULL,\n  failed_login_attempts INTEGER DEFAULT 0,\n  locked_until TIMESTAMP NULL,' },

          // Update preferences with new fields
          { old_string: 'notifications BOOLEAN DEFAULT true,', new_string: 'notifications BOOLEAN DEFAULT true,\n  dark_mode BOOLEAN DEFAULT false,\n  two_factor_enabled BOOLEAN DEFAULT false,' },

          // Update admin user insert to include salt
          { old_string: "INSERT INTO users (email, password_hash) VALUES ('admin@example.com', 'hashed_password');", new_string: "INSERT INTO users (email, password_hash, salt) VALUES ('admin@example.com', 'hashed_password', 'random_salt_123');" },

          // Add new security indexes
          { old_string: 'CREATE INDEX idx_preferences_user_id ON user_preferences(user_id);', new_string: 'CREATE INDEX idx_preferences_user_id ON user_preferences(user_id);\nCREATE INDEX idx_users_failed_attempts ON users(failed_login_attempts);\nCREATE INDEX idx_users_locked_until ON users(locked_until);' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(6);

      const newContent = await fs.readFile(testFile, 'utf-8');

      // Verify version updated
      expect(newContent).toContain('-- Version: 002');
      expect(newContent).toContain('-- Updated: 2024-02-01');

      // Verify new security fields added
      expect(newContent).toContain('salt TEXT NOT NULL');
      expect(newContent).toContain('failed_login_attempts INTEGER DEFAULT 0');
      expect(newContent).toContain('locked_until TIMESTAMP NULL');

      // Verify new preference fields
      expect(newContent).toContain('dark_mode BOOLEAN DEFAULT false');
      expect(newContent).toContain('two_factor_enabled BOOLEAN DEFAULT false');

      // Verify updated insert statement
      expect(newContent).toContain("INSERT INTO users (email, password_hash, salt)");
      expect(newContent).toContain("'random_salt_123'");

      // Verify new indexes
      expect(newContent).toContain('CREATE INDEX idx_users_failed_attempts');
      expect(newContent).toContain('CREATE INDEX idx_users_locked_until');
    });

    it('should handle configuration file mass update', async () => {
      const dockerComposeContent = `
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DB_HOST=localhost
      - DB_PORT=5432
      - DB_NAME=myapp_dev
      - REDIS_HOST=localhost
      - REDIS_PORT=6379
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=myapp_dev
      - POSTGRES_USER=developer
      - POSTGRES_PASSWORD=devpass123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
`.trim();

      await fs.writeFile(testFile, dockerComposeContent);

      // Convert from development to production configuration
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update environment to production
          { old_string: 'NODE_ENV=development', new_string: 'NODE_ENV=production' },

          // Update database configuration for production
          { old_string: 'DB_HOST=localhost', new_string: 'DB_HOST=${DB_HOST}' },
          { old_string: 'DB_NAME=myapp_dev', new_string: 'DB_NAME=${DB_NAME}' },
          { old_string: 'POSTGRES_DB=myapp_dev', new_string: 'POSTGRES_DB=${DB_NAME}' },

          // Update Redis configuration
          { old_string: 'REDIS_HOST=localhost', new_string: 'REDIS_HOST=${REDIS_HOST}' },

          // Update log level for production
          { old_string: 'LOG_LEVEL=debug', new_string: 'LOG_LEVEL=warn' },

          // Update database credentials to use environment variables
          { old_string: 'POSTGRES_USER=developer', new_string: 'POSTGRES_USER=${DB_USER}' },
          { old_string: 'POSTGRES_PASSWORD=devpass123', new_string: 'POSTGRES_PASSWORD=${DB_PASSWORD}' },

          // Remove development volume mounts
          { old_string: '    volumes:\n      - .:/app\n      - /app/node_modules', new_string: '' },

          // Remove port mappings for production (use load balancer)
          { old_string: '    ports:\n      - "3000:3000"', new_string: '    expose:\n      - "3000"' },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(10);

      const newContent = await fs.readFile(testFile, 'utf-8');

      // Verify environment updated
      expect(newContent).toContain('NODE_ENV=production');
      expect(newContent).toContain('LOG_LEVEL=warn');

      // Verify environment variables used
      expect(newContent).toContain('DB_HOST=${DB_HOST}');
      expect(newContent).toContain('DB_NAME=${DB_NAME}');
      expect(newContent).toContain('REDIS_HOST=${REDIS_HOST}');
      expect(newContent).toContain('POSTGRES_USER=${DB_USER}');
      expect(newContent).toContain('POSTGRES_PASSWORD=${DB_PASSWORD}');

      // Verify port configuration changed
      expect(newContent).toContain('expose:\n      - "3000"');
      expect(newContent).not.toContain('"3000:3000"');

      // Verify development volumes removed
      expect(newContent).not.toContain('.:/app');
      expect(newContent).not.toContain('/app/node_modules');

      // Verify old values are gone
      expect(newContent).not.toContain('development');
      expect(newContent).not.toContain('localhost');
      expect(newContent).not.toContain('myapp_dev');
      expect(newContent).not.toContain('devpass123');
    });
  });

  describe('Rollback Behavior Verification', () => {
    it('should maintain file integrity during partial failure scenarios', async () => {
      const sourceCode = `
export class DataProcessor {
  constructor(private config: ProcessorConfig) {}

  async process(data: InputData[]): Promise<OutputData[]> {
    const results: OutputData[] = [];

    for (const item of data) {
      try {
        const validated = this.validate(item);
        const transformed = this.transform(validated);
        const enriched = this.enrich(transformed);
        results.push(enriched);
      } catch (error) {
        console.error('Processing failed:', error);
        throw error;
      }
    }

    return results;
  }

  private validate(data: InputData): ValidatedData {
    if (!data.id) throw new Error('Missing ID');
    if (!data.value) throw new Error('Missing value');
    return data as ValidatedData;
  }

  private transform(data: ValidatedData): TransformedData {
    return {
      ...data,
      processedAt: new Date(),
      status: 'processed'
    };
  }

  private enrich(data: TransformedData): OutputData {
    return {
      ...data,
      metadata: this.generateMetadata(data)
    };
  }

  private generateMetadata(data: TransformedData): Metadata {
    return {
      version: '1.0',
      timestamp: Date.now(),
      checksum: this.calculateChecksum(data)
    };
  }

  private calculateChecksum(data: any): string {
    return 'checksum_' + JSON.stringify(data).length;
  }
}
`.trim();

      await fs.writeFile(testFile, sourceCode);

      // Try to refactor but with one failing edit in the middle
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // These should succeed
          { old_string: 'export class DataProcessor', new_string: 'export class AdvancedDataProcessor' },
          { old_string: 'console.error(\'Processing failed:\', error);', new_string: 'this.logger.error(\'Processing failed:\', error);' },

          // This should fail - string doesn't exist
          { old_string: 'nonexistent_method_call()', new_string: 'replacement_method()' },

          // These would be applied if the above didn't fail
          { old_string: 'version: \'1.0\'', new_string: 'version: \'2.0\'' },
          { old_string: 'calculateChecksum', new_string: 'computeChecksum', replace_all: true },
        ],
      };

      const result = await tool.execute(params);

      // Verify the operation failed
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify complete rollback - NO changes should be present
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(sourceCode);

      // Verify original content is unchanged
      expect(fileContent).toContain('export class DataProcessor');
      expect(fileContent).toContain('console.error(\'Processing failed:\', error);');
      expect(fileContent).toContain('version: \'1.0\'');
      expect(fileContent).toContain('calculateChecksum');

      // Verify no partial edits remain
      expect(fileContent).not.toContain('AdvancedDataProcessor');
      expect(fileContent).not.toContain('this.logger.error');
      expect(fileContent).not.toContain('version: \'2.0\'');
      expect(fileContent).not.toContain('computeChecksum');
    });

    it('should handle filesystem errors gracefully with rollback', async () => {
      const content = 'test content for filesystem error simulation';
      await fs.writeFile(testFile, content);

      // Make file read-only to simulate write permission error
      await fs.chmod(testFile, 0o444);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'test content', new_string: 'modified content' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to write permissions
      expect(result.success).toBe(false);

      // Restore write permissions to verify content
      await fs.chmod(testFile, 0o644);

      // Verify file content is unchanged
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });
});