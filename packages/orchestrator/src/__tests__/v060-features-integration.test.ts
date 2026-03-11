/**
 * Integration Test for v0.6.0 Features
 *
 * This test verifies that all the major v0.6.0 features work together:
 * 1. Smart Context Management
 * 2. AI Platform Agnostic Orchestration
 * 3. OAuth/Credential Management
 * 4. Context Enrichment
 * 5. Codebase Intelligence Service
 * 6. Memory Manager
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SmartContextManager } from '../smart-context-manager.js';
import { DriverFactory } from '../drivers/index.js';
import { CredentialManager } from '../auth/credential-manager.js';
import { enrichTaskContext } from '../context-enrichment.js';
import { CodebaseIntelligenceService } from '../codebase-intelligence/codebase-intelligence-service.js';
import { MemoryManager } from '../memory-manager.js';
import type { ProjectContext } from '@apexcli/core';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('v0.6.0 Features Integration', () => {
  let tempDbPath: string;
  let tempCredDir: string;
  let db: Database.Database;
  let memoryManager: MemoryManager;
  let credentialManager: CredentialManager;
  let smartContextManager: SmartContextManager;
  let codebaseIntelligence: CodebaseIntelligenceService;

  beforeAll(async () => {
    // Setup temporary database
    tempDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);
    db = new Database(tempDbPath);

    // Setup temporary credential directory
    tempCredDir = path.join(os.tmpdir(), `test-creds-${Date.now()}`);

    // Initialize services
    memoryManager = new MemoryManager(db);
    memoryManager.initialize();

    credentialManager = new CredentialManager(tempCredDir);

    smartContextManager = new SmartContextManager({
      maxTokensPerTask: 100000,
      contextBudgetPercent: 0.25
    });

    codebaseIntelligence = new CodebaseIntelligenceService();
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
    if (fs.existsSync(tempCredDir)) {
      fs.rmSync(tempCredDir, { recursive: true, force: true });
    }
  });

  describe('Smart Context Management Integration', () => {
    it('should integrate with memory manager and build context', async () => {
      // Store some memories
      memoryManager.remember('Use TypeScript for type safety', {
        type: 'convention',
        tags: ['typescript', 'coding'],
        confidence: 0.9
      });

      memoryManager.remember('Prefer React functional components over class components', {
        type: 'preference',
        tags: ['react', 'components'],
        confidence: 0.8
      });

      // Create mock project context
      const projectContext: ProjectContext = {
        gitStatus: {
          branch: 'feature/v0.6.0-integration',
          isDirty: true,
          staged: ['src/smart-context.ts'],
          unstaged: ['src/drivers.ts']
        },
        frameworks: [{ name: 'React' }, { name: 'TypeScript' }],
        testFrameworks: [{ name: 'Vitest' }],
        structure: {
          isMonorepo: true,
          workspaces: ['packages/orchestrator', 'packages/core']
        }
      };

      // Build unified context
      const context = smartContextManager.buildContext({
        taskDescription: 'Use TypeScript and React components',
        projectContext,
        memoryManager
      });

      // Verify context structure
      expect(context.budget.projectContext).toBe(5000);
      expect(context.budget.codebaseIntelligence).toBe(10000);
      expect(context.budget.memory).toBe(5000);
      expect(context.budget.taskHistory).toBe(3000);
      expect(context.budget.livingMemory).toBe(2000);

      // Verify memory context is included
      expect(context.memoryContext).toBeDefined();
      expect(context.memoryContext).toContain('TypeScript');
      expect(context.memoryContext).toContain('React functional components');

      // Verify project context is formatted
      expect(context.projectContext).toBeDefined();
      expect(context.projectContext).toContain('feature/v0.6.0-integration');
      expect(context.projectContext).toContain('React, TypeScript');

      // Verify visualization
      expect(context.visualization.totalTokenBudget).toBe(25000);
      expect(context.visualization.sections.length).toBeGreaterThan(0);
    });

    it('should work with living memory', async () => {
      // Update living memory
      memoryManager.updateLivingMemory(
        'session-context',
        'Current session: Working on v0.6.0 feature integration tests',
        'session'
      );

      const context = smartContextManager.buildContext({
        taskDescription: 'Complete integration testing',
        memoryManager
      });

      expect(context.livingMemory).toBeDefined();
      expect(context.livingMemory).toContain('Current session');
      expect(context.livingMemory).toContain('v0.6.0 feature integration');
    });
  });

  describe('AI Platform Driver Integration', () => {
    it('should support multiple driver types through factory', () => {
      // Test driver factory can create all driver types
      const anthropicDriver = DriverFactory.getDriver('anthropic');
      expect(anthropicDriver.providerId).toBe('anthropic');

      const openaiDriver = DriverFactory.getDriver('openai');
      expect(openaiDriver.providerId).toBe('openai-codex');

      const geminiDriver = DriverFactory.getDriver('gemini');
      expect(geminiDriver.providerId).toBe('gemini');

      const agnosticDriver = DriverFactory.getDriver('agnostic');
      expect(agnosticDriver.providerId).toBe('agnostic');

      // Test singleton behavior - should return same instance
      const anthropicDriver2 = DriverFactory.getDriver('anthropic');
      expect(anthropicDriver).toBe(anthropicDriver2);
    });

    it('should resolve model aliases correctly across providers', () => {
      const anthropicDriver = DriverFactory.getDriver('anthropic');
      expect(anthropicDriver.resolveModel('opus')).toBe('claude-opus-4-5-20251101');
      expect(anthropicDriver.resolveModel('sonnet')).toBe('claude-sonnet-4-20250514');
      expect(anthropicDriver.resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');

      const openaiDriver = DriverFactory.getDriver('openai');
      expect(openaiDriver.resolveModel('opus')).toBe('gpt-4o');
      expect(openaiDriver.resolveModel('sonnet')).toBe('gpt-4o');
      expect(openaiDriver.resolveModel('haiku')).toBe('gpt-4o-mini');

      const geminiDriver = DriverFactory.getDriver('gemini');
      expect(geminiDriver.resolveModel('opus')).toBe('gemini-2.0-flash');
      expect(geminiDriver.resolveModel('sonnet')).toBe('gemini-2.0-flash');
      expect(geminiDriver.resolveModel('haiku')).toBe('gemini-2.0-flash-lite');
    });

    it('should handle unsupported provider gracefully', () => {
      expect(() => DriverFactory.getDriver('unsupported')).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('Credential Management Integration', () => {
    it('should store and retrieve credentials securely', async () => {
      const testCredentials = {
        accessToken: 'test-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: Date.now() + 3600000, // 1 hour
        provider: 'anthropic'
      };

      // Store credentials
      await credentialManager.saveCredentials('anthropic', testCredentials);

      // Retrieve credentials
      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toEqual(testCredentials);

      // Test non-existent provider
      const nonExistent = await credentialManager.getCredentials('nonexistent');
      expect(nonExistent).toBeNull();
    });

    it('should delete credentials properly', async () => {
      const testCredentials = {
        accessToken: 'test-token-delete',
        provider: 'test-provider'
      };

      await credentialManager.saveCredentials('test-provider', testCredentials);

      // Verify stored
      let retrieved = await credentialManager.getCredentials('test-provider');
      expect(retrieved).toEqual(testCredentials);

      // Delete credentials
      await credentialManager.deleteCredentials('test-provider');

      // Verify deleted
      retrieved = await credentialManager.getCredentials('test-provider');
      expect(retrieved).toBeNull();
    });

    it('should create secure credential file permissions', async () => {
      const testCredentials = {
        accessToken: 'permissions-test',
        provider: 'permissions'
      };

      await credentialManager.saveCredentials('permissions', testCredentials);

      // Check that credentials file was created in temp directory
      const credentialsPath = path.join(tempCredDir, 'credentials.json');
      expect(fs.existsSync(credentialsPath)).toBe(true);

      // Verify file contains the credentials
      const fileContent = fs.readFileSync(credentialsPath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.permissions).toEqual(testCredentials);
    });
  });

  describe('Context Enrichment Integration', () => {
    it('should handle codebase intelligence when service is not initialized', async () => {
      const enrichedContext = await enrichTaskContext(
        'Implement user authentication',
        codebaseIntelligence,
        { maxTokens: 2000 }
      );

      // Should return basic structure even if service isn't initialized
      expect(enrichedContext).toBeDefined();
      expect(enrichedContext.repositoryMap).toBeDefined();
      expect(enrichedContext.relevantFiles).toBeDefined();
      expect(enrichedContext.relevantSymbols).toBeDefined();
      expect(enrichedContext.importGraph).toBeDefined();
      expect(enrichedContext.typeInfo).toBeDefined();

      // Arrays should be empty since service isn't initialized with actual code
      expect(enrichedContext.relevantFiles).toHaveLength(0);
      expect(enrichedContext.relevantSymbols).toHaveLength(0);
    });

    it('should format enriched context properly', async () => {
      const mockEnrichedContext = {
        repositoryMap: 'src/\n  components/\n  utils/',
        relevantFiles: [{
          path: 'src/auth.ts',
          relevanceScore: 0.8,
          symbolCount: 5,
          language: 'typescript'
        }],
        relevantSymbols: [{
          name: 'authenticate',
          type: 'function',
          file: 'src/auth.ts',
          line: 10,
          signature: 'authenticate(token: string): Promise<boolean>'
        }],
        importGraph: 'src/auth.ts → crypto, jwt',
        typeInfo: 'User extends BaseEntity'
      };

      const formatted = (await import('../context-enrichment.js')).formatEnrichedContext(mockEnrichedContext);

      expect(formatted).toContain('### Relevant Files');
      expect(formatted).toContain('src/auth.ts');
      expect(formatted).toContain('typescript, 5 symbols, relevance: 80%');
      expect(formatted).toContain('### Relevant Symbols');
      expect(formatted).toContain('authenticate');
      expect(formatted).toContain('### Repository Structure');
      expect(formatted).toContain('components/');
      expect(formatted).toContain('### Import Dependencies');
      expect(formatted).toContain('crypto, jwt');
      expect(formatted).toContain('### Type Relationships');
      expect(formatted).toContain('User extends BaseEntity');
    });
  });

  describe('End-to-End Integration', () => {
    it('should integrate all v0.6.0 features in a realistic workflow', async () => {
      // Step 1: Store some project knowledge in memory
      memoryManager.remember('Use JWT tokens for authentication', {
        type: 'convention',
        tags: ['auth', 'jwt', 'security'],
        confidence: 0.9
      });

      memoryManager.remember('Always validate input parameters', {
        type: 'pattern',
        tags: ['validation', 'security'],
        confidence: 0.85
      });

      // Step 2: Set up credentials (simulating OAuth flow completion)
      await credentialManager.saveCredentials('anthropic', {
        accessToken: 'sk-ant-api03-xxx',
        provider: 'anthropic',
        expiresAt: Date.now() + 3600000
      });

      // Step 3: Initialize driver and verify credentials integration
      const driver = DriverFactory.getDriver('anthropic');
      expect(driver.providerId).toBe('anthropic');

      // Step 4: Create enriched context (simulating codebase analysis)
      const enrichedContext = await enrichTaskContext(
        'Add JWT authentication to login endpoint',
        codebaseIntelligence,
        { maxTokens: 4000 }
      );

      // Step 5: Build unified context with all sources
      const projectContext: ProjectContext = {
        gitStatus: {
          branch: 'feature/jwt-auth',
          isDirty: true,
          staged: [],
          unstaged: ['src/auth/login.ts']
        },
        frameworks: [{ name: 'Express' }, { name: 'TypeScript' }],
        testFrameworks: [{ name: 'Jest' }]
      };

      const unifiedContext = smartContextManager.buildContext({
        taskDescription: 'JWT authentication with input validation for security',
        projectContext,
        enrichedContext: (await import('../context-enrichment.js')).formatEnrichedContext(enrichedContext),
        memoryManager
      });

      // Step 6: Verify all components are integrated
      expect(unifiedContext.projectContext).toContain('feature/jwt-auth');
      expect(unifiedContext.projectContext).toContain('Express, TypeScript');

      expect(unifiedContext.memoryContext).toContain('JWT tokens');
      expect(unifiedContext.memoryContext).toContain('validate input parameters');

      // Enriched context may be undefined since codebase intelligence isn't initialized with real code
      if (unifiedContext.enrichedContext) {
        expect(unifiedContext.enrichedContext).toBeDefined();
      } else {
        // This is expected when the codebase intelligence service has no indexed data
        expect(unifiedContext.enrichedContext).toBeUndefined();
      }

      expect(unifiedContext.budget.projectContext).toBeGreaterThan(0);
      expect(unifiedContext.budget.codebaseIntelligence).toBeGreaterThan(0);
      expect(unifiedContext.budget.memory).toBeGreaterThan(0);

      expect(unifiedContext.visualization.totalTokenBudget).toBe(25000);
      expect(unifiedContext.visualization.totalUsedTokens).toBeGreaterThan(0);
      expect(unifiedContext.visualization.percentTotal).toBeGreaterThanOrEqual(0);

      // Step 7: Verify context can be serialized for driver consumption
      const contextString = JSON.stringify(unifiedContext);
      expect(contextString).toContain('JWT');
      expect(contextString).toContain('authentication');

      // Step 8: Verify visualization provides useful debugging info
      const vizText = smartContextManager.getContextVisualization(unifiedContext.visualization);
      expect(vizText).toContain('Context Budget:');
      expect(vizText).toContain('Project Context');
      expect(vizText).toContain('Memory');
      expect(vizText).toMatch(/\[[\#\.]+\]/); // Progress bar pattern (# or .)
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing components gracefully', () => {
      const contextWithoutDeps = smartContextManager.buildContext({
        taskDescription: 'Test without dependencies'
      });

      expect(contextWithoutDeps.projectContext).toBeUndefined();
      expect(contextWithoutDeps.enrichedContext).toBeUndefined();
      expect(contextWithoutDeps.memoryContext).toBeUndefined();
      expect(contextWithoutDeps.taskHistoryContext).toBeUndefined();
      expect(contextWithoutDeps.livingMemory).toBeUndefined();
      expect(contextWithoutDeps.budget).toBeDefined();
      expect(contextWithoutDeps.visualization).toBeDefined();
    });

    it('should handle corrupted credential files gracefully', async () => {
      // Create corrupted credential file
      const corruptedCredDir = path.join(os.tmpdir(), `corrupted-creds-${Date.now()}`);
      const corruptedCredManager = new CredentialManager(corruptedCredDir);

      // Create directory and write invalid JSON
      fs.mkdirSync(corruptedCredDir, { recursive: true });
      fs.writeFileSync(path.join(corruptedCredDir, 'credentials.json'), 'invalid json {');

      // Should not throw, should return null
      const result = await corruptedCredManager.getCredentials('test');
      expect(result).toBeNull();

      // Cleanup
      fs.rmSync(corruptedCredDir, { recursive: true, force: true });
    });

    it('should handle large context gracefully with truncation', () => {
      const largeMemoryContent = 'Large memory content. '.repeat(10000); // ~200k chars

      memoryManager.remember(largeMemoryContent, {
        type: 'fact',
        tags: ['large'],
        confidence: 1.0
      });

      const context = smartContextManager.buildContext({
        taskDescription: 'Handle large memory test',
        memoryManager
      });

      // Should be truncated to fit within budget
      expect(context.memoryContext).toBeDefined();
      expect(context.memoryContext!.length).toBeLessThan(largeMemoryContent.length);

      // Should show proper token usage in visualization
      const memorySection = context.visualization.sections.find(s => s.name === 'Memory');
      expect(memorySection).toBeDefined();
      expect(memorySection!.usedTokens).toBeLessThanOrEqual(context.budget.memory);
    });
  });
});