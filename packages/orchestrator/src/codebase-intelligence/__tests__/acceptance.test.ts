/**
 * Acceptance tests for Codebase Intelligence
 *
 * These tests verify that the complete codebase intelligence system meets
 * all acceptance criteria as specified in the requirements.
 *
 * Acceptance Criteria:
 * 1. CodebaseIndexer class creates AST-aware repository map using tree-sitter
 * 2. Supports symbol resolution across the codebase
 * 3. Import graph generation for understanding module dependencies
 * 4. Type awareness for understanding type relationships
 * 5. SemanticSearch enables finding code by meaning
 * 6. Integration tests pass
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import { CodebaseIntelligenceService } from '../codebase-intelligence-service.js';
import { SemanticSearch } from '../semantic-search.js';
import { ReferenceExtractor } from '../reference-extractor.js';
import { TypeRelationshipMap } from '../type-relationship-map.js';
import type { RepositoryMap, SupportedLanguage } from '@apexcli/core/types';

describe('Codebase Intelligence Acceptance Tests', () => {
  let testDir: string;
  let service: CodebaseIntelligenceService;

  beforeAll(async () => {
    // Create temporary test directory with sample code
    testDir = await createTestProject();

    // Initialize the service
    service = new CodebaseIntelligenceService({
      enableCaching: true,
      includeExternalDependencies: false,
    });

    await service.initialize(testDir);
  });

  afterAll(async () => {
    // Cleanup
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    service.reset();
  });

  describe('Acceptance Criteria 1: AST-aware repository map using tree-sitter', () => {
    it('should create comprehensive repository map with AST-parsed symbols', async () => {
      const repoMap = service.getRepositoryMap();
      expect(repoMap).toBeDefined();

      // Verify files are indexed
      expect(repoMap!.files.length).toBeGreaterThan(0);

      // Verify symbols are extracted from AST
      const allSymbols = repoMap!.files.flatMap(f => f.symbols);
      expect(allSymbols.length).toBeGreaterThan(0);

      // Verify symbols have accurate position information (from AST)
      const functions = allSymbols.filter(s => s.type === 'function');
      expect(functions.length).toBeGreaterThan(0);

      for (const func of functions) {
        expect(func.startLine).toBeGreaterThan(0);
        expect(func.endLine).toBeGreaterThanOrEqual(func.startLine);
        expect(func.signature).toBeDefined();
      }
    });

    it('should support multiple programming languages', async () => {
      const repoMap = service.getRepositoryMap();
      const languages = new Set(repoMap!.files.map(f => f.language));

      // Should have at least TypeScript and JavaScript
      expect(languages.has('typescript')).toBe(true);
      expect(languages.has('javascript')).toBe(true);
    });

    it('should extract detailed symbol information', async () => {
      const repoMap = service.getRepositoryMap();
      const allSymbols = repoMap!.files.flatMap(f => f.symbols);

      // Find a class symbol
      const classSymbol = allSymbols.find(s => s.type === 'class');
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBeDefined();
      expect(classSymbol!.filePath).toBeDefined();
      expect(classSymbol!.startLine).toBeGreaterThan(0);

      // Find a function symbol
      const functionSymbol = allSymbols.find(s => s.type === 'function');
      expect(functionSymbol).toBeDefined();
      expect(functionSymbol!.signature).toBeDefined();
      expect(functionSymbol!.signature).toMatch(/function|=>/);
    });
  });

  describe('Acceptance Criteria 2: Symbol resolution across the codebase', () => {
    it('should resolve symbol definitions across files', async () => {
      // Find a symbol that should exist
      const definition = await service.findSymbolDefinition('UserService');
      expect(definition).toBeDefined();
      expect(definition!.symbol.name).toBe('UserService');
      expect(definition!.filePath).toMatch(/\.ts$/);
    });

    it('should find symbol references across multiple files', async () => {
      const references = service.findReferences('UserService');
      expect(references.length).toBeGreaterThan(0);

      // Should have references from different files
      const sourceFiles = new Set(references.map(r => r.sourceFile));
      expect(sourceFiles.size).toBeGreaterThan(1);
    });

    it('should resolve imported symbols', async () => {
      const definition = await service.findSymbolDefinition('validateEmail');
      expect(definition).toBeDefined();

      // Should resolve to the correct file
      expect(definition!.filePath).toMatch(/utils|validation/);
    });

    it('should handle symbol resolution with context', async () => {
      const definition = await service.findSymbolDefinition('User', {
        filePath: path.join(testDir, 'src/services/user.ts'),
      });
      expect(definition).toBeDefined();
      expect(definition!.symbol.type).toBe('class');
    });
  });

  describe('Acceptance Criteria 3: Import graph generation', () => {
    it('should build accurate import graph', async () => {
      const repoMap = service.getRepositoryMap();
      expect(repoMap!.imports.length).toBeGreaterThan(0);

      // Should have import relationships between test files
      const userServiceImports = repoMap!.imports.filter(
        imp => imp.sourceFile.includes('user.ts')
      );
      expect(userServiceImports.length).toBeGreaterThan(0);
    });

    it('should detect circular dependencies', async () => {
      const circular = service.findCircularDependencies();

      // Our test project should not have circular dependencies
      expect(circular.imports.length).toBe(0);
      expect(circular.types.length).toBe(0);
    });

    it('should map import relationships correctly', async () => {
      const repoMap = service.getRepositoryMap();

      // Find an import relationship
      const importEdge = repoMap!.imports.find(
        imp => imp.importedSymbols && imp.importedSymbols.length > 0
      );
      expect(importEdge).toBeDefined();
      expect(importEdge!.sourceFile).toBeDefined();
      expect(importEdge!.targetFile).toBeDefined();
      expect(importEdge!.importedSymbols!.length).toBeGreaterThan(0);
    });
  });

  describe('Acceptance Criteria 4: Type awareness and relationships', () => {
    it('should understand inheritance relationships', async () => {
      const implementations = service.getImplementations('IUserService');
      expect(implementations.length).toBeGreaterThan(0);

      const implementation = implementations[0];
      expect(implementation.symbol.name).toBe('UserService');
      expect(implementation.symbol.type).toBe('class');
    });

    it('should build type hierarchy', async () => {
      const hierarchy = service.getTypeHierarchy('UserService');
      expect(hierarchy.type).toBe('UserService');
      expect(hierarchy.interfaces).toContain('IUserService');
    });

    it('should find inheritance chains', async () => {
      const chain = service.getInheritanceChain('AdminUser');
      expect(chain.length).toBeGreaterThan(1);

      // Should include the class itself and its parent
      const names = chain.map(c => c.symbol.name);
      expect(names).toContain('AdminUser');
      expect(names).toContain('User');
    });

    it('should track type usage patterns', async () => {
      const hierarchy = service.getTypeHierarchy('User');
      expect(hierarchy.descendants).toContain('AdminUser');
    });
  });

  describe('Acceptance Criteria 5: SemanticSearch for finding code by meaning', () => {
    it('should find functions by natural language description', async () => {
      const results = service.searchCode('function that validates email');
      expect(results.length).toBeGreaterThan(0);

      // Should find the validateEmail function
      const emailValidator = results.find(r =>
        r.symbol.name.toLowerCase().includes('email') &&
        r.symbol.name.toLowerCase().includes('valid')
      );
      expect(emailValidator).toBeDefined();
      expect(emailValidator!.symbol.type).toBe('function');
    });

    it('should rank results by relevance', async () => {
      const results = service.searchCode('user service class');
      expect(results.length).toBeGreaterThan(0);

      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }

      // Top result should be highly relevant
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should support different search strategies', async () => {
      const keywordResults = service.searchCode('UserService', { strategy: 'keyword' });
      const fuzzyResults = service.searchCode('UserService', { strategy: 'fuzzy' });
      const semanticResults = service.searchCode('UserService', { strategy: 'semantic' });

      expect(keywordResults.length).toBeGreaterThan(0);
      expect(fuzzyResults.length).toBeGreaterThan(0);
      expect(semanticResults.length).toBeGreaterThan(0);
    });

    it('should find similar symbols', async () => {
      const userServiceDef = await service.findSymbolDefinition('UserService');
      expect(userServiceDef).toBeDefined();

      const similar = service.findSimilarSymbols(userServiceDef!.symbol);
      expect(similar.length).toBeGreaterThan(0);

      // Should find other service classes
      const serviceClasses = similar.filter(s =>
        s.symbol.name.includes('Service') || s.symbol.type === 'class'
      );
      expect(serviceClasses.length).toBeGreaterThan(0);
    });

    it('should filter results by symbol type', async () => {
      const functionResults = service.searchCode('validate', {
        symbolTypes: ['function']
      });

      expect(functionResults.length).toBeGreaterThan(0);
      functionResults.forEach(result => {
        expect(result.symbol.type).toBe('function');
      });
    });
  });

  describe('Integration Test: Complete workflow', () => {
    it('should support end-to-end codebase analysis workflow', async () => {
      // 1. Get comprehensive analysis
      const analysis = service.getAnalysis();

      expect(analysis.repositoryMap.files.length).toBeGreaterThan(0);
      expect(analysis.symbolStats.totalSymbols).toBeGreaterThan(0);
      expect(analysis.referenceStats.totalReferences).toBeGreaterThan(0);

      // 2. Search for specific functionality
      const authResults = service.searchCode('authentication function');
      expect(authResults.length).toBeGreaterThanOrEqual(0);

      // 3. Analyze type relationships
      const userHierarchy = service.getTypeHierarchy('User');
      expect(userHierarchy.type).toBe('User');

      // 4. Check for circular dependencies
      const circular = service.findCircularDependencies();
      expect(circular.imports).toBeDefined();
      expect(circular.types).toBeDefined();

      // 5. Find symbol usages
      const userRefs = service.findReferences('User');
      expect(userRefs).toBeDefined();
    });

    it('should provide service status information', async () => {
      const status = service.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.indexing).toBe(false);
      expect(status.filesIndexed).toBeGreaterThan(0);
      expect(status.symbolsExtracted).toBeGreaterThan(0);
      expect(status.lastIndexed).toBeInstanceOf(Date);
    });
  });
});

/**
 * Create a test project with sample TypeScript/JavaScript code
 * that exercises all codebase intelligence features
 */
async function createTestProject(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

  // Create project structure
  await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'src/utils'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'src/services'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'src/models'), { recursive: true });

  // Create sample TypeScript files

  // utils/validation.ts
  await fs.writeFile(path.join(tmpDir, 'src/utils/validation.ts'), `
/**
 * Email validation utility
 * Validates email addresses using regex pattern
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Password validation utility
 * Ensures password meets security requirements
 */
export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
`);

  // models/user.ts
  await fs.writeFile(path.join(tmpDir, 'src/models/user.ts'), `
export interface IUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export class User implements IUser {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public createdAt: Date = new Date()
  ) {}

  /**
   * Get user display name
   */
  getDisplayName(): string {
    return this.name || this.email.split('@')[0];
  }

  /**
   * Check if user email is validated
   */
  isEmailValidated(): boolean {
    // Implementation would check validation status
    return true;
  }
}

export class AdminUser extends User {
  constructor(
    id: string,
    email: string,
    name: string,
    public permissions: string[] = [],
    createdAt: Date = new Date()
  ) {
    super(id, email, name, createdAt);
  }

  /**
   * Check if admin has specific permission
   */
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }
}
`);

  // services/user.ts
  await fs.writeFile(path.join(tmpDir, 'src/services/user.ts'), `
import { User, AdminUser, type IUser } from '../models/user.js';
import { validateEmail, validatePassword } from '../utils/validation.js';

export interface IUserService {
  createUser(email: string, name: string): Promise<User>;
  findUserById(id: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<IUser>): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
}

/**
 * User service implementation
 * Handles all user-related operations
 */
export class UserService implements IUserService {
  private users: Map<string, User> = new Map();

  /**
   * Create a new user with email validation
   */
  async createUser(email: string, name: string): Promise<User> {
    if (!validateEmail(email)) {
      throw new Error('Invalid email address');
    }

    const id = this.generateId();
    const user = new User(id, email, name);
    this.users.set(id, user);

    return user;
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  /**
   * Update existing user
   */
  async updateUser(id: string, updates: Partial<IUser>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.email && !validateEmail(updates.email)) {
      throw new Error('Invalid email address');
    }

    Object.assign(user, updates);
    return user;
  }

  /**
   * Delete user by ID
   */
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  /**
   * Generate unique user ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Authentication service
 * Handles user authentication and authorization
 */
export class AuthService {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    if (!validateEmail(email) || !validatePassword(password)) {
      return null;
    }

    // Find user by email (simplified implementation)
    for (const user of this.userService['users'].values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  /**
   * Create admin user with permissions
   */
  async createAdminUser(email: string, name: string, permissions: string[]): Promise<AdminUser> {
    if (!validateEmail(email)) {
      throw new Error('Invalid email address');
    }

    const id = Math.random().toString(36).substring(2);
    return new AdminUser(id, email, name, permissions);
  }
}
`);

  // index.ts (main entry point)
  await fs.writeFile(path.join(tmpDir, 'src/index.ts'), `
export * from './models/user.js';
export * from './services/user.js';
export * from './utils/validation.js';

import { UserService, AuthService } from './services/user.js';

/**
 * Initialize application services
 */
function initializeServices() {
  const userService = new UserService();
  const authService = new AuthService(userService);

  return {
    userService,
    authService,
  };
}

export { initializeServices };
`);

  // JavaScript file for multi-language testing
  await fs.writeFile(path.join(tmpDir, 'src/utils/helpers.js'), `
/**
 * Utility helper functions
 */

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString();
}

/**
 * Calculate user age from birth date
 */
function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

module.exports = {
  formatDate,
  calculateAge,
};
`);

  return tmpDir;
}