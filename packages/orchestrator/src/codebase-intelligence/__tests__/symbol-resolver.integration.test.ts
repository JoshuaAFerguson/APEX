/**
 * Integration tests for SymbolResolver
 *
 * These tests verify SymbolResolver works with real CodebaseIndexer output
 * and handles actual repository structures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SymbolResolver } from '../symbol-resolver.js';
import { CodebaseIndexer } from '../indexer.js';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { RepositoryMap } from '@apexcli/core';

describe('SymbolResolver Integration', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;

  beforeEach(async () => {
    // Create a temporary directory for our test files
    tempDir = await mkdtemp(join(tmpdir(), 'symbol-resolver-integration-'));
    indexer = new CodebaseIndexer();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Real File Integration', () => {
    it('should resolve symbols from actual TypeScript files', async () => {
      // Create a realistic TypeScript project structure
      const userModelContent = `
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

export class UserValidator {
  static validateEmail(email: string): boolean {
    return email.includes('@');
  }

  static validateUser(user: User): boolean {
    return !!user.id && !!user.name && this.validateEmail(user.email);
  }
}
      `;

      const userServiceContent = `
import { User, UserRole, UserValidator } from './User';

export class UserService {
  private users: User[] = [];

  async createUser(userData: Partial<User>): Promise<User> {
    const user: User = {
      id: generateId(),
      role: UserRole.USER,
      ...userData
    } as User;

    if (!UserValidator.validateUser(user)) {
      throw new Error('Invalid user data');
    }

    this.users.push(user);
    return user;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.users.filter(user => user.role === role);
  }
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
      `;

      const appContent = `
import { UserService } from './UserService';
import { UserRole } from './User';

class App {
  private userService = new UserService();

  async run() {
    const adminUsers = await this.userService.findByRole(UserRole.ADMIN);
    console.log('Admin users:', adminUsers);
  }
}

export default App;
      `;

      // Write test files
      await writeFile(join(tempDir, 'User.ts'), userModelContent);
      await writeFile(join(tempDir, 'UserService.ts'), userServiceContent);
      await writeFile(join(tempDir, 'App.ts'), appContent);

      // Index the temporary directory
      const repoMap = await indexer.indexDirectory(tempDir, {
        includeNodeModules: false,
        followSymlinks: false,
      });

      expect(repoMap.files).toBeDefined();
      expect(repoMap.files!.length).toBe(3);

      // Create SymbolResolver with the indexed repository
      const resolver = new SymbolResolver(repoMap);

      // Test finding definitions
      const userDefinitions = resolver.findDefinition('User');
      expect(userDefinitions.length).toBeGreaterThan(0);
      expect(userDefinitions[0].symbol.type).toBe('interface');
      expect(userDefinitions[0].filePath).toContain('User.ts');

      const userServiceDefinitions = resolver.findDefinition('UserService');
      expect(userServiceDefinitions.length).toBeGreaterThan(0);
      expect(userServiceDefinitions[0].symbol.type).toBe('class');
      expect(userServiceDefinitions[0].filePath).toContain('UserService.ts');

      // Test finding references
      const userReferences = resolver.findReferences('User');
      expect(userReferences.length).toBeGreaterThan(0);

      // Should find User interface referenced in UserService
      const userServiceReference = userReferences.find(
        ref => ref.reference.sourceFile.includes('UserService.ts')
      );
      expect(userServiceReference).toBeDefined();

      const userRoleReferences = resolver.findReferences('UserRole');
      expect(userRoleReferences.length).toBeGreaterThan(0);

      // Should find UserRole referenced in both UserService and App
      const serviceRoleRef = userRoleReferences.find(
        ref => ref.reference.sourceFile.includes('UserService.ts')
      );
      const appRoleRef = userRoleReferences.find(
        ref => ref.reference.sourceFile.includes('App.ts')
      );
      expect(serviceRoleRef).toBeDefined();
      expect(appRoleRef).toBeDefined();

      // Test cross-file symbol tracking
      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBeGreaterThan(5);
      expect(stats.byType.class).toBeGreaterThan(0);
      expect(stats.byType.interface).toBeGreaterThan(0);
      expect(stats.byType.enum).toBeGreaterThan(0);
      expect(stats.filesWithSymbols).toBe(3);
    });

    it('should handle complex inheritance relationships', async () => {
      const baseContent = `
export abstract class BaseService<T> {
  protected items: T[] = [];

  abstract validate(item: T): boolean;

  async save(item: T): Promise<void> {
    if (!this.validate(item)) {
      throw new Error('Validation failed');
    }
    this.items.push(item);
  }

  async findAll(): Promise<T[]> {
    return [...this.items];
  }
}
      `;

      const concreteContent = `
import { BaseService } from './BaseService';

interface Product {
  id: string;
  name: string;
  price: number;
}

export class ProductService extends BaseService<Product> {
  validate(product: Product): boolean {
    return product.id && product.name && product.price > 0;
  }

  async findByPrice(minPrice: number): Promise<Product[]> {
    const products = await this.findAll();
    return products.filter(p => p.price >= minPrice);
  }
}
      `;

      await writeFile(join(tempDir, 'BaseService.ts'), baseContent);
      await writeFile(join(tempDir, 'ProductService.ts'), concreteContent);

      const repoMap = await indexer.indexDirectory(tempDir);
      const resolver = new SymbolResolver(repoMap);

      // Test finding base class
      const baseServiceDefs = resolver.findDefinition('BaseService');
      expect(baseServiceDefs.length).toBeGreaterThan(0);
      expect(baseServiceDefs[0].symbol.type).toBe('class');

      // Test finding derived class
      const productServiceDefs = resolver.findDefinition('ProductService');
      expect(productServiceDefs.length).toBeGreaterThan(0);
      expect(productServiceDefs[0].symbol.type).toBe('class');

      // Test finding interface
      const productInterfaceDefs = resolver.findDefinition('Product');
      expect(productInterfaceDefs.length).toBeGreaterThan(0);
      expect(productInterfaceDefs[0].symbol.type).toBe('interface');

      // Test cross-file references
      const baseServiceRefs = resolver.findReferences('BaseService');
      expect(baseServiceRefs.length).toBeGreaterThan(0);

      const importReference = baseServiceRefs.find(
        ref => ref.reference.referenceType === 'import'
      );
      expect(importReference).toBeDefined();
      expect(importReference!.reference.sourceFile).toContain('ProductService.ts');
    });
  });

  describe('Large Codebase Performance', () => {
    it('should handle moderate-sized codebase efficiently', async () => {
      // Create a moderate-sized codebase with multiple files and cross-references
      const fileCount = 20;
      const symbolsPerFile = 5;

      const files: string[] = [];

      for (let i = 0; i < fileCount; i++) {
        const fileName = `Module${i}.ts`;
        const imports = i > 0 ? `import { Class${i-1} } from './Module${i-1}';` : '';
        const nextImport = i < fileCount - 1 ? `import { Class${i+1} } from './Module${i+1}';` : '';

        let content = imports + '\n' + nextImport + '\n\n';

        for (let j = 0; j < symbolsPerFile; j++) {
          const className = `Class${i}_${j}`;
          const baseClass = i > 0 && j === 0 ? ` extends Class${i-1}` : '';

          content += `
export class ${className}${baseClass} {
  private id: string = '${className}';

  getId(): string {
    return this.id;
  }

  static create(): ${className} {
    return new ${className}();
  }
}

export interface I${className} {
  id: string;
  getId(): string;
}

export const ${className.toUpperCase()}_CONSTANT = '${className}_VALUE';
          `;
        }

        files.push(content);
        await writeFile(join(tempDir, fileName), content);
      }

      const startTime = Date.now();
      const repoMap = await indexer.indexDirectory(tempDir);
      const indexingTime = Date.now() - startTime;

      expect(repoMap.files!.length).toBe(fileCount);

      const startResolverTime = Date.now();
      const resolver = new SymbolResolver(repoMap);
      const resolverCreationTime = Date.now() - startResolverTime;

      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBeGreaterThan(fileCount * symbolsPerFile);
      expect(stats.indexBuildTimeMs).toBeLessThan(1000); // Should build index quickly

      // Test finding definitions across the codebase
      const startSearchTime = Date.now();
      const firstClassDefs = resolver.findDefinition('Class0_0');
      const searchTime = Date.now() - startSearchTime;

      expect(firstClassDefs.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should search quickly

      // Test finding references
      const firstClassRefs = resolver.findReferences('Class0_0');
      expect(firstClassRefs.length).toBeGreaterThanOrEqual(0);

      // Performance assertions
      expect(indexingTime).toBeLessThan(5000); // Indexing should be reasonably fast
      expect(resolverCreationTime).toBeLessThan(500); // Resolver creation should be fast

      console.log(`Performance metrics:
        - Indexing time: ${indexingTime}ms
        - Resolver creation time: ${resolverCreationTime}ms
        - Index build time: ${stats.indexBuildTimeMs}ms
        - Search time: ${searchTime}ms
        - Total symbols indexed: ${stats.totalSymbols}
        - Files processed: ${fileCount}`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const validContent = `
export class ValidClass {
  method() {
    return 'valid';
  }
}
      `;

      const invalidContent = `
export class InvalidClass {
  method() {
    return 'missing semicolon and bracket'
  // Missing closing brace
      `;

      await writeFile(join(tempDir, 'Valid.ts'), validContent);
      await writeFile(join(tempDir, 'Invalid.ts'), invalidContent);

      // Indexing should handle syntax errors gracefully
      const repoMap = await indexer.indexDirectory(tempDir);

      // Should still have indexed the valid file
      expect(repoMap.files!.length).toBeGreaterThan(0);

      const resolver = new SymbolResolver(repoMap);

      // Should be able to find symbols from valid files
      const validClassDefs = resolver.findDefinition('ValidClass');
      expect(validClassDefs.length).toBeGreaterThan(0);

      // Should handle search for invalid symbols gracefully
      const invalidClassDefs = resolver.findDefinition('InvalidClass');
      expect(Array.isArray(invalidClassDefs)).toBe(true);
    });

    it('should handle empty files and directories', async () => {
      // Create an empty file
      await writeFile(join(tempDir, 'Empty.ts'), '');

      // Create a file with only comments
      await writeFile(join(tempDir, 'OnlyComments.ts'), `
        // This file only has comments
        /*
         * No actual code here
         */
      `);

      const repoMap = await indexer.indexDirectory(tempDir);
      const resolver = new SymbolResolver(repoMap);

      // Should handle empty repository gracefully
      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBe(0);
      expect(stats.totalFiles).toBe(2);

      // Should return empty results for searches
      expect(resolver.findDefinition('AnySymbol')).toHaveLength(0);
      expect(resolver.findReferences('AnySymbol')).toHaveLength(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical React component structure', async () => {
      const typesContent = `
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ComponentProps {
  user: User;
  onUpdate: (user: User) => void;
}
      `;

      const hookContent = `
import { useState, useCallback } from 'react';
import { User } from './types';

export function useUser(initialUser: User) {
  const [user, setUser] = useState<User>(initialUser);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  return { user, updateUser };
}
      `;

      const componentContent = `
import React from 'react';
import { ComponentProps } from './types';
import { useUser } from './hooks';

export function UserProfile({ user, onUpdate }: ComponentProps) {
  const { user: currentUser, updateUser } = useUser(user);

  const handleSubmit = () => {
    onUpdate(currentUser);
  };

  return (
    <div>
      <h1>{currentUser.name}</h1>
      <p>{currentUser.email}</p>
    </div>
  );
}

export default UserProfile;
      `;

      await writeFile(join(tempDir, 'types.ts'), typesContent);
      await writeFile(join(tempDir, 'hooks.ts'), hookContent);
      await writeFile(join(tempDir, 'UserProfile.tsx'), componentContent);

      const repoMap = await indexer.indexDirectory(tempDir);
      const resolver = new SymbolResolver(repoMap);

      // Test finding interfaces
      const userInterfaceDefs = resolver.findDefinition('User');
      expect(userInterfaceDefs.length).toBeGreaterThan(0);

      const componentPropsDefs = resolver.findDefinition('ComponentProps');
      expect(componentPropsDefs.length).toBeGreaterThan(0);

      // Test finding hook
      const useUserDefs = resolver.findDefinition('useUser');
      expect(useUserDefs.length).toBeGreaterThan(0);
      expect(useUserDefs[0].symbol.type).toBe('function');

      // Test finding component
      const userProfileDefs = resolver.findDefinition('UserProfile');
      expect(userProfileDefs.length).toBeGreaterThan(0);
      expect(userProfileDefs[0].symbol.type).toBe('function');

      // Test cross-file references
      const userRefs = resolver.findReferences('User');
      expect(userRefs.length).toBeGreaterThan(2); // Should be referenced in hooks and component

      // Verify references point to correct files
      const hooksRef = userRefs.find(ref => ref.reference.sourceFile.includes('hooks.ts'));
      const componentRef = userRefs.find(ref => ref.reference.sourceFile.includes('UserProfile.tsx'));

      expect(hooksRef).toBeDefined();
      expect(componentRef).toBeDefined();
    });
  });
});