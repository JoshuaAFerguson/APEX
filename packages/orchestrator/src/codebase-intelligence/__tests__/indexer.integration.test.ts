/**
 * Integration tests for CodebaseIndexer
 *
 * These tests use real file system operations and actual extractors
 * to validate end-to-end functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { CodebaseIndexer, type IndexingOptions } from '../indexer.js';
import type { RepositoryMap, CodeFile } from '@apexcli/core/types';

describe('CodebaseIndexer Integration Tests', () => {
  let indexer: CodebaseIndexer;
  let tempDir: string;

  beforeAll(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'indexer-test-'));
  });

  beforeEach(() => {
    // Reset the singleton instance for each test
    CodebaseIndexer.resetInstance();
    indexer = CodebaseIndexer.getInstance();
  });

  afterEach(async () => {
    // Clean up any test files
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(files.map(file =>
        fs.unlink(path.join(tempDir, file)).catch(() => {})
      ));
    } catch {
      // Directory might not exist, ignore
    }
  });

  describe('Real File System Operations', () => {
    it('should index actual TypeScript files', async () => {
      // Create test TypeScript files
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typeScriptContent = `
export interface User {
  id: number;
  name: string;
  email?: string;
}

export class UserService {
  private users: User[] = [];

  constructor(initialUsers: User[] = []) {
    this.users = initialUsers;
  }

  async findById(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const newUser: User = {
      id: Math.max(0, ...this.users.map(u => u.id)) + 1,
      ...userData
    };
    this.users.push(newUser);
    return newUser;
  }
}

export const DEFAULT_USERS: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith' }
];

export default UserService;
`;

      const indexContent = `
import { UserService, type User, DEFAULT_USERS } from './user.service';

export * from './user.service';

const userService = new UserService(DEFAULT_USERS);

export { userService as default };
`;

      await fs.writeFile(path.join(srcDir, 'user.service.ts'), typeScriptContent);
      await fs.writeFile(path.join(srcDir, 'index.ts'), indexContent);

      const result = await indexer.indexDirectory(tempDir);

      // Verify basic structure
      expect(result.rootPath).toBe(path.resolve(tempDir));
      expect(result.files).toHaveLength(2);
      expect(result.stats?.totalFiles).toBe(2);
      expect(result.stats?.languageBreakdown?.typescript).toBe(2);

      // Find the user.service.ts file
      const userServiceFile = result.files.find(f => f.path.endsWith('user.service.ts'));
      expect(userServiceFile).toBeDefined();
      expect(userServiceFile?.language).toBe('typescript');
      expect(userServiceFile?.symbols?.length).toBeGreaterThan(0);

      // Check that key symbols were extracted
      const symbolNames = userServiceFile?.symbols?.map(s => s.name) || [];
      expect(symbolNames).toEqual(
        expect.arrayContaining(['User', 'UserService', 'findById', 'createUser', 'DEFAULT_USERS'])
      );

      // Check symbol types
      const interfaceSymbol = userServiceFile?.symbols?.find(s => s.name === 'User');
      expect(interfaceSymbol?.type).toBe('interface');
      expect(interfaceSymbol?.exported).toBe(true);

      const classSymbol = userServiceFile?.symbols?.find(s => s.name === 'UserService');
      expect(classSymbol?.type).toBe('class');
      expect(classSymbol?.exported).toBe(true);

      const methodSymbol = userServiceFile?.symbols?.find(s => s.name === 'findById');
      expect(methodSymbol?.type).toBe('method');

      // Verify statistics
      expect(result.stats?.totalSymbols).toBeGreaterThan(5);
      expect(result.stats?.symbolTypeBreakdown?.interface).toBeGreaterThan(0);
      expect(result.stats?.symbolTypeBreakdown?.class).toBeGreaterThan(0);
      expect(result.stats?.symbolTypeBreakdown?.method).toBeGreaterThan(0);
    }, 10000); // Increase timeout for file I/O

    it('should handle JavaScript files', async () => {
      const jsContent = `
const express = require('express');
const app = express();

/**
 * Health check endpoint
 * @returns {Object} Health status
 */
function healthCheck() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}

/**
 * User management utilities
 */
const userUtils = {
  validateEmail: (email) => {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  },

  formatName: (firstName, lastName) => {
    return \`\${firstName} \${lastName}\`.trim();
  }
};

app.get('/health', (req, res) => {
  res.json(healthCheck());
});

app.get('/users/:id', async (req, res) => {
  // Mock user retrieval
  const userId = parseInt(req.params.id);
  res.json({ id: userId, name: 'Mock User' });
});

module.exports = { app, healthCheck, userUtils };
`;

      await fs.writeFile(path.join(tempDir, 'server.js'), jsContent);

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].language).toBe('javascript');
      expect(result.files[0].path).toBe('server.js');

      const symbolNames = result.files[0].symbols?.map(s => s.name) || [];
      expect(symbolNames).toEqual(
        expect.arrayContaining(['healthCheck', 'userUtils'])
      );

      expect(result.stats?.languageBreakdown?.javascript).toBe(1);
    }, 10000);

    it('should handle Python files', async () => {
      const pythonContent = `
"""
User management module
Provides utilities for user operations
"""

from typing import List, Optional, Dict
import json
from datetime import datetime

class User:
    """Represents a user in the system"""

    def __init__(self, user_id: int, name: str, email: Optional[str] = None):
        self.id = user_id
        self.name = name
        self.email = email
        self.created_at = datetime.now()

    def to_dict(self) -> Dict:
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

class UserRepository:
    """Repository for user data operations"""

    def __init__(self):
        self._users: List[User] = []

    def add_user(self, user: User) -> None:
        """Add a user to the repository"""
        self._users.append(user)

    def find_by_id(self, user_id: int) -> Optional[User]:
        """Find user by ID"""
        return next((user for user in self._users if user.id == user_id), None)

    def get_all_users(self) -> List[User]:
        """Get all users"""
        return self._users.copy()

def create_default_user() -> User:
    """Create a default test user"""
    return User(1, "Default User", "default@example.com")

# Module constants
DEFAULT_USER_COUNT = 100
ADMIN_EMAIL_DOMAIN = "admin.example.com"
`;

      await fs.writeFile(path.join(tempDir, 'user_manager.py'), pythonContent);

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].language).toBe('python');
      expect(result.files[0].path).toBe('user_manager.py');

      const symbolNames = result.files[0].symbols?.map(s => s.name) || [];
      expect(symbolNames).toEqual(
        expect.arrayContaining([
          'User', 'UserRepository', '__init__', 'to_dict',
          'add_user', 'find_by_id', 'get_all_users', 'create_default_user'
        ])
      );

      // Check class symbols
      const userClass = result.files[0].symbols?.find(s => s.name === 'User');
      expect(userClass?.type).toBe('class');

      const repoClass = result.files[0].symbols?.find(s => s.name === 'UserRepository');
      expect(repoClass?.type).toBe('class');

      // Check function symbols
      const createFunc = result.files[0].symbols?.find(s => s.name === 'create_default_user');
      expect(createFunc?.type).toBe('function');

      expect(result.stats?.languageBreakdown?.python).toBe(1);
      expect(result.stats?.symbolTypeBreakdown?.class).toBeGreaterThan(0);
      expect(result.stats?.symbolTypeBreakdown?.method).toBeGreaterThan(0);
      expect(result.stats?.symbolTypeBreakdown?.function).toBeGreaterThan(0);
    }, 10000);

    it('should respect file size limits', async () => {
      // Create a small and large file
      const smallContent = 'const small = "test";';
      const largeContent = 'const large = "' + 'x'.repeat(2000) + '";';

      await fs.writeFile(path.join(tempDir, 'small.js'), smallContent);
      await fs.writeFile(path.join(tempDir, 'large.js'), largeContent);

      // Index with size limit of 100 bytes
      const options: IndexingOptions = {
        maxFileSize: 100
      };

      const result = await indexer.indexDirectory(tempDir, options);

      // Only the small file should be indexed
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('small.js');
      expect(result.stats?.totalFiles).toBe(1);
    });

    it('should handle mixed language codebases', async () => {
      // Create files in different languages
      const files = [
        { name: 'app.ts', content: 'export class App { start() {} }', language: 'typescript' },
        { name: 'utils.js', content: 'function utils() {} module.exports = utils;', language: 'javascript' },
        { name: 'main.py', content: 'def main():\n    print("Hello")', language: 'python' },
      ];

      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.content);
      }

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(3);
      expect(result.stats?.totalFiles).toBe(3);
      expect(result.stats?.languageBreakdown).toEqual({
        typescript: 1,
        javascript: 1,
        python: 1
      });

      // Check that each file was processed correctly
      const tsFile = result.files.find(f => f.path === 'app.ts');
      expect(tsFile?.language).toBe('typescript');

      const jsFile = result.files.find(f => f.path === 'utils.js');
      expect(jsFile?.language).toBe('javascript');

      const pyFile = result.files.find(f => f.path === 'main.py');
      expect(pyFile?.language).toBe('python');
    });

    it('should handle deeply nested directory structures', async () => {
      // Create nested directory structure
      const nestedPath = path.join(tempDir, 'src', 'components', 'ui', 'forms');
      await fs.mkdir(nestedPath, { recursive: true });

      const componentContent = `
export interface FormProps {
  onSubmit: (data: any) => void;
}

export const LoginForm: React.FC<FormProps> = ({ onSubmit }) => {
  return <form onSubmit={onSubmit}></form>;
};
`;

      await fs.writeFile(path.join(nestedPath, 'LoginForm.tsx'), componentContent);

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(path.join('src', 'components', 'ui', 'forms', 'LoginForm.tsx'));

      const symbolNames = result.files[0].symbols?.map(s => s.name) || [];
      expect(symbolNames).toEqual(
        expect.arrayContaining(['FormProps', 'LoginForm'])
      );
    });
  });

  describe('Progress Reporting Integration', () => {
    it('should report accurate progress for real files', async () => {
      // Create multiple files
      const files = Array.from({ length: 5 }, (_, i) => ({
        name: `module${i}.ts`,
        content: `export const value${i} = ${i};`
      }));

      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.content);
      }

      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => {
        progressUpdates.push({ ...progress });
      };

      await indexer.indexDirectoryWithProgress(tempDir, {}, onProgress);

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Check that progress was reported for each file
      expect(progressUpdates.some(p => p.filesProcessed === 0)).toBe(true);
      expect(progressUpdates.some(p => p.filesProcessed === files.length)).toBe(true);

      // Final update should show completion
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      expect(finalUpdate.filesProcessed).toBe(files.length);
      expect(finalUpdate.totalFiles).toBe(files.length);
      expect(finalUpdate.currentFile).toBe('');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle files with syntax errors gracefully', async () => {
      // Create a file with invalid syntax
      const invalidContent = `
export class InvalidClass {
  method( // Missing closing parenthesis and brace
`;

      await fs.writeFile(path.join(tempDir, 'invalid.ts'), invalidContent);

      const result = await indexer.indexDirectory(tempDir, { continueOnError: true });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].hasParseErrors).toBe(true);
      expect(result.files[0].errors?.length).toBeGreaterThan(0);
    });

    it('should handle permission denied errors', async () => {
      // This test may not work on all systems, so we'll skip it on CI
      if (process.env.CI) {
        return;
      }

      // Create a directory structure
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedDir, { recursive: true });

      const testFile = path.join(restrictedDir, 'test.ts');
      await fs.writeFile(testFile, 'export const test = "hello";');

      try {
        // Try to make directory unreadable (may not work on all systems)
        await fs.chmod(restrictedDir, 0o000);

        // Should continue despite permission errors
        const result = await indexer.indexDirectory(tempDir, { continueOnError: true });

        // Result should still be valid, even if some files couldn't be processed
        expect(result).toBeDefined();
        expect(result.files).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(restrictedDir, 0o755);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});