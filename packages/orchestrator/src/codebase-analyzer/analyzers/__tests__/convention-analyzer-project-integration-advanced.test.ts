/**
 * ConventionAnalyzer ProjectAnalysis Integration Tests - Advanced
 *
 * Tests the integration of ConventionAnalyzer with ProjectAnalysis to ensure
 * the organization analysis is properly integrated into the broader codebase analysis.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - ProjectAnalysis Integration Advanced', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real-world Project Structure Integration', () => {
    it('should analyze a React TypeScript project with common patterns', async () => {
      // Create React TypeScript project structure
      const srcDir = join(testDir, 'src');
      const componentsDir = join(srcDir, 'components');
      const hooksDir = join(srcDir, 'hooks');
      const utilsDir = join(srcDir, 'utils');
      const testsDir = join(srcDir, '__tests__');
      const componentTestsDir = join(componentsDir, '__tests__');

      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(hooksDir, { recursive: true });
      await fs.mkdir(utilsDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(componentTestsDir, { recursive: true });

      // React components with TypeScript
      await fs.writeFile(join(componentsDir, 'Button.tsx'), `
/**
 * Reusable button component
 */
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <button
      className={\`btn btn--\${variant}\`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
`);

      // Custom hooks
      await fs.writeFile(join(hooksDir, 'useLocalStorage.ts'), `
/**
 * Custom hook for localStorage management
 */
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue];
}
`);

      // Utility functions
      await fs.writeFile(join(utilsDir, 'formatters.ts'), `
/**
 * Utility functions for data formatting
 */

/**
 * Formats a date to a readable string
 */
export function formatDate(date: Date, locale: string = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * Formats a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
}

// Helper function without documentation
export function formatPercentage(value: number): string {
  return \`\${(value * 100).toFixed(2)}%\`;
}
`);

      // Test files with mixed patterns
      await fs.writeFile(join(componentTestsDir, 'Button.test.tsx'), `
/**
 * Button component tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
`);

      await fs.writeFile(join(testsDir, 'formatters.test.ts'), `
/**
 * Formatters utility tests
 */
import { formatDate, formatCurrency, formatPercentage } from '../utils/formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    it('formats date correctly with default locale', () => {
      const date = new Date('2023-12-25');
      const result = formatDate(date);
      expect(result).toMatch(/December 25, 2023|25 December 2023/);
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency by default', () => {
      const result = formatCurrency(123.45);
      expect(result).toBe('$123.45');
    });
  });

  describe('formatPercentage', () => {
    it('formats percentage correctly', () => {
      expect(formatPercentage(0.1234)).toBe('12.34%');
      expect(formatPercentage(1)).toBe('100.00%');
    });
  });
});
`);

      // Configuration files
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
          'jest': '^29.0.0',
          'typescript': '^4.9.0'
        }
      }, null, 2));

      await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          lib: ['DOM', 'DOM.Iterable', 'ES6'],
          strict: true,
          jsx: 'react-jsx'
        },
        include: ['src']
      }, null, 2));

      await fs.writeFile(join(testDir, 'jest.config.js'), `
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ]
};
`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify organization analysis
      expect(result.organization?.testLocation).toBe('mixed'); // Has both colocated and separate tests
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');

      // Verify integration with other convention analysis
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.imports.style).toBe('es6');
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(60);
    });

    it('should analyze a Node.js Express API project', async () => {
      // Create Node.js API project structure
      const srcDir = join(testDir, 'src');
      const controllersDir = join(srcDir, 'controllers');
      const modelsDir = join(srcDir, 'models');
      const routesDir = join(srcDir, 'routes');
      const testsDir = join(testDir, 'tests');

      await fs.mkdir(controllersDir, { recursive: true });
      await fs.mkdir(modelsDir, { recursive: true });
      await fs.mkdir(routesDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      // Express controllers
      await fs.writeFile(join(controllersDir, 'userController.js'), `
/**
 * User management controller
 * Handles all user-related HTTP requests
 */
const { User } = require('../models/User');

/**
 * Get all users
 */
async function getAllUsers(req, res) {
  try {
    const users = await User.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create new user
 */
async function createUser(req, res) {
  try {
    const { name, email } = req.body;
    const user = await User.create({ name, email });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get user by ID
async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllUsers,
  createUser,
  getUserById
};
`);

      await fs.writeFile(join(modelsDir, 'User.js'), `
/**
 * User model definition
 */
const { DataTypes } = require('sequelize');

/**
 * User model with validation
 */
const User = {
  id: {
    type: DataTypes.UUID,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
};

/**
 * Find user by email
 */
User.findByEmail = async function(email) {
  return this.findOne({ where: { email: email.toLowerCase() } });
};

module.exports = { User };
`);

      // Test files
      await fs.writeFile(join(testsDir, 'userController.test.js'), `
/**
 * User controller tests
 */
const request = require('supertest');
const { getAllUsers, createUser, getUserById } = require('../src/controllers/userController');

describe('User Controller', () => {
  describe('getAllUsers', () => {
    it('should return all users', async () => {
      // Mock implementation
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await getAllUsers(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const mockReq = { body: { name: 'John', email: 'john@test.com' } };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await createUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });
});
`);

      // Configuration files
      await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'express-api-project',
        version: '1.0.0',
        main: 'src/app.js',
        scripts: {
          start: 'node src/app.js',
          test: 'jest'
        },
        dependencies: {
          express: '^4.18.0',
          sequelize: '^6.28.0'
        },
        devDependencies: {
          jest: '^29.0.0',
          supertest: '^6.3.0'
        }
      }, null, 2));

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify organization analysis
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');

      // Verify integration with other conventions
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.imports.style).toBe('commonjs');
      expect(result.documentation.style).toBe('jsdoc');
    });
  });

  describe('Complex Project Structures', () => {
    it('should handle monorepo with multiple packages', async () => {
      const packagesDir = join(testDir, 'packages');
      const package1Dir = join(packagesDir, 'package1');
      const package2Dir = join(packagesDir, 'package2');

      // Package 1: React components
      const package1SrcDir = join(package1Dir, 'src');
      const package1TestsDir = join(package1SrcDir, '__tests__');
      await fs.mkdir(package1TestsDir, { recursive: true });

      await fs.writeFile(join(package1SrcDir, 'Button.tsx'), `
/**
 * Button component
 */
export const Button = () => <button>Click me</button>;
`);
      await fs.writeFile(join(package1TestsDir, 'Button.test.tsx'), `
import { Button } from '../Button';
test('Button renders', () => {});
`);

      // Package 2: Utility library
      const package2LibDir = join(package2Dir, 'lib');
      const package2TestsDir = join(package2Dir, 'test');
      await fs.mkdir(package2LibDir, { recursive: true });
      await fs.mkdir(package2TestsDir, { recursive: true });

      await fs.writeFile(join(package2LibDir, 'utils.js'), `
/**
 * Utility functions
 */
export function add(a, b) { return a + b; }
`);
      await fs.writeFile(join(package2TestsDir, 'utils.test.js'), `
import { add } from '../lib/utils';
test('add function', () => {});
`);

      // Root config files
      await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'monorepo',
        workspaces: ['packages/*']
      }, null, 2));

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('mixed');
      expect(result.organization?.configLocation).toBe('root');
    });

    it('should analyze project with multiple test directories', async () => {
      const srcDir = join(testDir, 'src');
      const unitTestsDir = join(testDir, 'tests', 'unit');
      const integrationTestsDir = join(testDir, 'tests', 'integration');
      const e2eTestsDir = join(testDir, 'tests', 'e2e');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(unitTestsDir, { recursive: true });
      await fs.mkdir(integrationTestsDir, { recursive: true });
      await fs.mkdir(e2eTestsDir, { recursive: true });

      // Source files
      await fs.writeFile(join(srcDir, 'calculator.js'), `
/**
 * Calculator module
 */
export function add(a, b) { return a + b; }
export function multiply(a, b) { return a * b; }
`);

      // Different types of tests
      await fs.writeFile(join(unitTestsDir, 'calculator.test.js'), `
import { add, multiply } from '../../src/calculator';
describe('Calculator unit tests', () => {});
`);

      await fs.writeFile(join(integrationTestsDir, 'api.test.js'), `
describe('API integration tests', () => {});
`);

      await fs.writeFile(join(e2eTestsDir, 'user-flow.test.js'), `
describe('User flow E2E tests', () => {});
`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
    });
  });

  describe('Integration Validation', () => {
    it('should maintain consistent organization analysis across multiple runs', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(srcDir, '__tests__');

      await fs.mkdir(testsDir, { recursive: true });

      // Create consistent project structure
      await fs.writeFile(join(srcDir, 'service.ts'), `
/**
 * Service module with TypeScript
 */
export class UserService {
  private users: any[] = [];

  /**
   * Add user to service
   */
  addUser(user: any): void {
    this.users.push(user);
  }

  getUsers(): any[] {
    return this.users;
  }
}
`);

      await fs.writeFile(join(testsDir, 'service.test.ts'), `
import { UserService } from '../service';

describe('UserService', () => {
  it('should add and retrieve users', () => {
    const service = new UserService();
    service.addUser({ name: 'Test' });
    expect(service.getUsers()).toHaveLength(1);
  });
});
`);

      // Run analysis multiple times
      const results = await Promise.all([
        analyzer.analyze(testDir),
        analyzer.analyze(testDir),
        analyzer.analyze(testDir)
      ]);

      // Verify consistency across runs
      for (const result of results) {
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('separate-__tests__');
        expect(result.organization?.testNaming).toBe('suffix-.test');
        expect(result.organization?.sourceStructure).toBe('src');

        // Verify other conventions are also consistent
        expect(result.functionNaming).toBe('camelCase');
        expect(result.classNaming).toBe('PascalCase');
        expect(result.imports.style).toBe('es6');
        expect(result.documentation.style).toBe('jsdoc');
      }

      // Verify all results are identical
      const firstResult = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].organization).toEqual(firstResult.organization);
      }
    });
  });
});