/**
 * ConventionAnalyzer Project Analysis Integration Tests
 * Tests integration of ConventionAnalyzer with the broader project analysis system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Project Analysis Integration', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-integration-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real-world Project Structure Analysis', () => {
    it('should analyze a typical React TypeScript project structure', async () => {
      // Create a realistic React TypeScript project structure
      const srcDir = join(testDir, 'src');
      const componentsDir = join(srcDir, 'components');
      const hooksDir = join(srcDir, 'hooks');
      const utilsDir = join(srcDir, 'utils');
      const testsDir = join(srcDir, '__tests__');

      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(hooksDir, { recursive: true });
      await fs.mkdir(utilsDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      // Create React component files
      await fs.writeFile(join(componentsDir, 'UserProfile.tsx'), `
/**
 * User profile component
 * @param props - Component properties
 * @returns JSX element
 */
import React from 'react';

interface UserProfileProps {
  userId: string;
  displayName: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, displayName }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleProfileUpdate = async () => {
    setIsLoading(true);
    // Profile update logic
    setIsLoading(false);
  };

  return (
    <div className="user-profile">
      <h2>{displayName}</h2>
      <button onClick={handleProfileUpdate} disabled={isLoading}>
        {isLoading ? 'Updating...' : 'Update Profile'}
      </button>
    </div>
  );
};
`);

      // Create custom hook
      await fs.writeFile(join(hooksDir, 'useUserData.ts'), `
/**
 * Custom hook for managing user data
 * @param userId - The user ID to fetch data for
 * @returns User data and loading state
 */
import { useState, useEffect } from 'react';

export interface UserData {
  id: string;
  name: string;
  email: string;
}

export function useUserData(userId: string) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(\`/api/users/\${userId}\`);
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  return { userData, isLoading, error };
}
`);

      // Create utility functions
      await fs.writeFile(join(utilsDir, 'stringHelpers.ts'), `
/**
 * String utility functions
 */

/**
 * Capitalize first letter of a string
 * @param str - Input string
 * @returns Capitalized string
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to kebab-case
 * @param str - Input string
 * @returns Kebab-case string
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Truncate string to specified length
 * @param str - Input string
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}
`);

      // Create test files
      await fs.writeFile(join(testsDir, 'UserProfile.test.tsx'), `
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from '../components/UserProfile';

describe('UserProfile', () => {
  it('should render user profile with display name', () => {
    render(<UserProfile userId="123" displayName="John Doe" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Update Profile')).toBeInTheDocument();
  });

  it('should handle profile update button click', () => {
    render(<UserProfile userId="123" displayName="John Doe" />);

    const updateButton = screen.getByText('Update Profile');
    fireEvent.click(updateButton);

    // Assertions for update behavior
  });
});
`);

      await fs.writeFile(join(testsDir, 'stringHelpers.test.ts'), `
import { capitalizeFirst, toKebabCase, truncateString } from '../utils/stringHelpers';

describe('stringHelpers', () => {
  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello');
      expect(capitalizeFirst('WORLD')).toBe('WORLD');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('camelCaseString')).toBe('camel-case-string');
      expect(toKebabCase('PascalCaseString')).toBe('pascal-case-string');
    });
  });

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      expect(truncateString('This is a long string', 10)).toBe('This is...');
      expect(truncateString('Short', 10)).toBe('Short');
    });
  });
});
`);

      // Create package.json and config files
      await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'react-typescript-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@testing-library/react': '^13.0.0',
          'typescript': '^4.9.0'
        }
      }, null, 2));

      await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'es2020',
          module: 'esnext',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          strict: true
        }
      }, null, 2));

      // Analyze the project
      const result = await analyzer.analyze(testDir);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate React/TypeScript project patterns
      expect(result.fileNaming).toBe('PascalCase'); // React components typically use PascalCase
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.imports.style).toBe('es6');
      expect(result.imports.quotes).toBe('single');
      expect(result.documentation.style).toBe('tsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(80); // Well documented

      // Validate organization patterns
      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');
    });

    it('should analyze a Node.js Express API project structure', async () => {
      // Create a typical Node.js Express API structure
      const srcDir = join(testDir, 'src');
      const controllersDir = join(srcDir, 'controllers');
      const middlewareDir = join(srcDir, 'middleware');
      const modelsDir = join(srcDir, 'models');
      const routesDir = join(srcDir, 'routes');
      const testsDir = join(testDir, 'tests');

      await fs.mkdir(controllersDir, { recursive: true });
      await fs.mkdir(middlewareDir, { recursive: true });
      await fs.mkdir(modelsDir, { recursive: true });
      await fs.mkdir(routesDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      // Create controller files
      await fs.writeFile(join(controllersDir, 'user-controller.js'), `
const UserModel = require('../models/user-model');

/**
 * Get all users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAllUsers(req, res) {
  try {
    const users = await UserModel.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createUser(req, res) {
  const { name, email } = req.body;

  try {
    const user = await UserModel.create({ name, email });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllUsers,
  createUser
};
`);

      // Create middleware
      await fs.writeFile(join(middlewareDir, 'auth-middleware.js'), `
const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateToken(req, res, next) {
  const auth_header = req.headers['authorization'];
  const token = auth_header && auth_header.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
`);

      // Create model
      await fs.writeFile(join(modelsDir, 'user-model.js'), `
const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

/**
 * User model definition
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = User;
`);

      // Create test files
      await fs.writeFile(join(testsDir, 'user-controller.test.js'), `
const request = require('supertest');
const app = require('../src/app');

describe('User Controller', () => {
  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/users', () => {
    it('should create new user', async () => {
      const user_data = { name: 'John Doe', email: 'john@example.com' };

      const response = await request(app)
        .post('/api/users')
        .send(user_data)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(user_data.name);
    });
  });
});
`);

      // Create package.json
      await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'express-api-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'sequelize': '^6.28.0',
          'jsonwebtoken': '^9.0.0'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'supertest': '^6.3.0',
          'nodemon': '^2.0.0'
        }
      }, null, 2));

      // Analyze the project
      const result = await analyzer.analyze(testDir);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate Node.js/Express project patterns
      expect(result.fileNaming).toBe('kebab-case'); // kebab-case for file names
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('snake_case'); // Mixed with camelCase
      expect(result.imports.style).toBe('commonjs');
      expect(result.documentation.style).toBe('jsdoc');

      // Validate organization patterns
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');
    });
  });

  describe('Multi-language Project Analysis', () => {
    it('should analyze projects with multiple programming languages', async () => {
      const srcDir = join(testDir, 'src');
      const pythonDir = join(srcDir, 'python');
      const jsDir = join(srcDir, 'javascript');
      const goDir = join(srcDir, 'go');

      await fs.mkdir(pythonDir, { recursive: true });
      await fs.mkdir(jsDir, { recursive: true });
      await fs.mkdir(goDir, { recursive: true });

      // Python files with snake_case
      await fs.writeFile(join(pythonDir, 'user_service.py'), `
def get_user_by_id(user_id):
    """Get user by ID"""
    return database.users.find_one({'_id': user_id})

def create_new_user(user_data):
    """Create new user"""
    return database.users.insert_one(user_data)

class UserManager:
    """User management class"""

    def __init__(self, db_connection):
        self.db = db_connection
        self.cache = {}

    def validate_user_data(self, data):
        """Validate user data"""
        required_fields = ['name', 'email']
        return all(field in data for field in required_fields)
`);

      // JavaScript files with camelCase
      await fs.writeFile(join(jsDir, 'userService.js'), `
/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
async function getUserById(userId) {
  return await database.users.findOne({ _id: userId });
}

/**
 * Create new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
async function createNewUser(userData) {
  return await database.users.insertOne(userData);
}

class UserManager {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.cache = new Map();
  }

  validateUserData(data) {
    const requiredFields = ['name', 'email'];
    return requiredFields.every(field => field in data);
  }
}
`);

      // Go files with Go conventions
      await fs.writeFile(join(goDir, 'user_service.go'), `
package main

import (
    "context"
    "errors"
)

// User represents a user entity
type User struct {
    ID    string \`json:"id"\`
    Name  string \`json:"name"\`
    Email string \`json:"email"\`
}

// UserService provides user-related operations
type UserService struct {
    db Database
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(ctx context.Context, userID string) (*User, error) {
    if userID == "" {
        return nil, errors.New("user ID cannot be empty")
    }

    return s.db.FindUser(ctx, userID)
}

// CreateNewUser creates a new user
func (s *UserService) CreateNewUser(ctx context.Context, userData User) (*User, error) {
    if err := s.validateUserData(userData); err != nil {
        return nil, err
    }

    return s.db.CreateUser(ctx, userData)
}

func (s *UserService) validateUserData(data User) error {
    if data.Name == "" || data.Email == "" {
        return errors.New("name and email are required")
    }
    return nil
}
`);

      const result = await analyzer.analyze(testDir);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed patterns due to multiple languages
      expect(['mixed', 'inconsistent', 'camelCase', 'snake_case']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent', 'camelCase', 'snake_case']).toContain(result.variableNaming);
      expect(['mixed', 'PascalCase', 'snake_case']).toContain(result.classNaming);
      expect(result.organization?.sourceStructure).toBe('src');
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle analysis integration with performance monitoring', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create multiple files to test performance
      const fileCount = 50;
      const promises = [];

      for (let i = 0; i < fileCount; i++) {
        const fileName = `module${i}.ts`;
        const content = `
/**
 * Module ${i} - Performance test module
 */

export class Module${i} {
  private readonly module_id = ${i};
  private cache_data: Map<string, any> = new Map();

  /**
   * Process data for module ${i}
   * @param input_data - Input data to process
   * @returns Processed result
   */
  public async processData(input_data: any): Promise<any> {
    const cache_key = \`module_\${this.module_id}_\${JSON.stringify(input_data)}\`;

    if (this.cache_data.has(cache_key)) {
      return this.cache_data.get(cache_key);
    }

    const processed_result = await this.performProcessing(input_data);
    this.cache_data.set(cache_key, processed_result);

    return processed_result;
  }

  private async performProcessing(data: any): Promise<any> {
    // Simulate processing
    return { processed: true, data, module: this.module_id };
  }

  public clearCache(): void {
    this.cache_data.clear();
  }
}

export const module${i}Instance = new Module${i}();
`;

        promises.push(fs.writeFile(join(srcDir, fileName), content));
      }

      await Promise.all(promises);

      // Measure analysis performance
      const startTime = performance.now();
      const result = await analyzer.analyze(testDir);
      const endTime = performance.now();
      const analysisTime = endTime - startTime;

      // Validate results
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Performance assertions
      expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Convention analysis results should be consistent
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(['camelCase', 'snake_case', 'mixed']).toContain(result.variableNaming);
      expect(result.classNaming).toBe('PascalCase');
      expect(result.documentation.style).toBe('tsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from partial analysis failures', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a mix of valid and problematic files
      await fs.writeFile(join(srcDir, 'valid.js'), `
/**
 * Valid JavaScript file
 */
function validFunction() {
  const validVariable = 'This is valid';
  return validVariable;
}
`);

      await fs.writeFile(join(srcDir, 'problematic.js'), `
// File with various issues
function incompleteFunction(
  // Missing closing parenthesis
const brokenString = "Missing closing quote
if (missingClosingBrace {
  console.log("This will cause issues");
// Missing closing brace
`);

      await fs.writeFile(join(srcDir, 'binary-like.js'), `
// File with unusual content that might cause parsing issues
const weirdContent = "\x00\x01\x02\x03\x04";
function withSpecialChars() { return "Special: \u{1F600}"; }
`);

      const result = await analyzer.analyze(testDir);

      // Analysis should complete without throwing
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should extract what it can from valid parts
      expect(['camelCase', 'mixed']).toContain(result.functionNaming);
      expect(['camelCase', 'mixed']).toContain(result.variableNaming);
      expect(result.documentation.style).toBe('inline');
    });
  });

  describe('Configuration-driven Analysis', () => {
    it('should respect project configuration patterns', async () => {
      const srcDir = join(testDir, 'src');
      const configDir = join(testDir, 'config');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });

      // Create TypeScript config suggesting specific patterns
      await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'es2020',
          module: 'esnext',
          strict: true,
          noImplicitAny: true,
          exactOptionalPropertyTypes: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      }, null, 2));

      // Create ESLint config suggesting specific patterns
      await fs.writeFile(join(testDir, '.eslintrc.js'), `
module.exports = {
  extends: ['@typescript-eslint/recommended'],
  rules: {
    'prefer-const': 'error',
    'camelcase': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'function', format: ['camelCase'] },
      { selector: 'variable', format: ['camelCase'] },
      { selector: 'class', format: ['PascalCase'] }
    ]
  }
};
`);

      // Create Prettier config
      await fs.writeFile(join(testDir, '.prettierrc'), JSON.stringify({
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
        tabWidth: 2,
        printWidth: 100
      }, null, 2));

      // Create source files following these conventions
      await fs.writeFile(join(srcDir, 'ConfiguredModule.ts'), `
/**
 * Module following project configuration
 */
export class ConfiguredModule {
  private readonly moduleId = 'configured';

  /**
   * Process data according to configuration
   * @param inputData - The data to process
   * @returns Processed result
   */
  public processData(inputData: unknown): Promise<unknown> {
    const processedData = this.transformData(inputData);
    return Promise.resolve(processedData);
  }

  private transformData(data: unknown): unknown {
    return { transformed: true, originalData: data };
  }
}

export const configuredModuleInstance = new ConfiguredModule();
`);

      const result = await analyzer.analyze(testDir);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect configured patterns
      expect(result.fileNaming).toBe('PascalCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');

      expect(result.imports.style).toBe('es6');
      expect(result.documentation.style).toBe('tsdoc');

      // Configuration file organization
      expect(result.organization?.configLocation).toBe('root');

      // Formatting should match prettier config
      if (result.formatting) {
        expect(result.formatting.semicolons).toBe('required');
        expect(result.formatting.quotes).toBe('single');
        expect(result.formatting.trailingCommas).toBe('es5');
        expect(result.formatting.lineLength).toBeLessThanOrEqual(100);
      }
    });
  });
});