/**
 * Permission Revocation and User Interaction Tests
 *
 * Tests focused on user prompt cancellation scenarios and complex
 * permission revocation edge cases with real-world interaction patterns.
 *
 * Test Areas:
 * 1. User prompt cancellation in various scenarios
 * 2. Permission revocation during ongoing operations
 * 3. Complex multi-agent permission scenarios
 * 4. Real-world user interaction patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';

// Mock user interaction types
type UserResponse = 'allow-always' | 'allow-once' | 'deny' | 'cancel' | 'timeout';

interface MockUserInteraction {
  response: UserResponse;
  delay?: number; // Simulation of user think time
}

// Mock prompt handler
class MockUserPromptHandler {
  private interactions: Map<string, MockUserInteraction> = new Map();
  private defaultResponse: UserResponse = 'cancel';

  setInteraction(tool: string, interaction: MockUserInteraction) {
    this.interactions.set(tool, interaction);
  }

  setDefaultResponse(response: UserResponse) {
    this.defaultResponse = response;
  }

  async prompt(tool: string, scope?: string): Promise<UserResponse> {
    const key = scope ? `${tool}:${scope}` : tool;
    const interaction = this.interactions.get(key) || { response: this.defaultResponse };

    if (interaction.delay) {
      await new Promise(resolve => setTimeout(resolve, interaction.delay));
    }

    if (interaction.response === 'timeout') {
      throw new Error('User prompt timeout');
    }

    return interaction.response;
  }

  reset() {
    this.interactions.clear();
    this.defaultResponse = 'cancel';
  }
}

describe('Permission Revocation and User Interaction Tests', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let mockPromptHandler: MockUserPromptHandler;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-user-interaction-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    mockPromptHandler = new MockUserPromptHandler();
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mockPromptHandler.reset();
  });

  // =========================================================================
  // User Prompt Cancellation Scenarios
  // =========================================================================
  describe('User prompt cancellation scenarios', () => {
    it('should handle immediate cancellation of permission prompt', async () => {
      mockPromptHandler.setInteraction('Write', { response: 'cancel' });

      // Simulate requesting permission that triggers user prompt
      const userResponse = await mockPromptHandler.prompt('Write');
      expect(userResponse).toBe('cancel');

      // Permission should not be granted on cancellation
      const result = await permissionManager.checkToolPermission('Write');
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Permission not granted');
    });

    it('should handle user declining permission after consideration', async () => {
      mockPromptHandler.setInteraction('Write', {
        response: 'deny',
        delay: 100 // User thinks before declining
      });

      const userResponse = await mockPromptHandler.prompt('Write');
      expect(userResponse).toBe('deny');

      // Should explicitly deny the permission
      await permissionManager.setPermission('Write', undefined, 'deny');
      const result = await permissionManager.checkToolPermission('Write');
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');
    });

    it('should handle timeout during user prompt', async () => {
      mockPromptHandler.setInteraction('Write', { response: 'timeout' });

      await expect(mockPromptHandler.prompt('Write')).rejects.toThrow('timeout');

      // Should fallback to no permission
      const result = await permissionManager.checkToolPermission('Write');
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBe('Permission not granted');
    });

    it('should handle mixed responses for multiple tools', async () => {
      // Set up different responses for different tools
      mockPromptHandler.setInteraction('Read', { response: 'allow-always' });
      mockPromptHandler.setInteraction('Write', { response: 'cancel' });
      mockPromptHandler.setInteraction('Edit', { response: 'allow-once' });
      mockPromptHandler.setInteraction('Bash', { response: 'deny' });

      // Process each tool request
      const tools = ['Read', 'Write', 'Edit', 'Bash'];
      const responses = await Promise.all(
        tools.map(tool => mockPromptHandler.prompt(tool))
      );

      expect(responses[0]).toBe('allow-always');
      expect(responses[1]).toBe('cancel');
      expect(responses[2]).toBe('allow-once');
      expect(responses[3]).toBe('deny');

      // Grant permissions based on responses
      if (responses[0] === 'allow-always') {
        await permissionManager.grantPermission('Read', undefined, 'allow-always');
      }
      if (responses[2] === 'allow-once') {
        await permissionManager.grantPermission('Edit', undefined, 'allow-once');
      }
      if (responses[3] === 'deny') {
        await permissionManager.setPermission('Bash', undefined, 'deny');
      }

      // Verify final states
      const readResult = await permissionManager.checkToolPermission('Read');
      const writeResult = await permissionManager.checkToolPermission('Write');
      const editResult = await permissionManager.checkToolPermission('Edit');
      const bashResult = await permissionManager.checkToolPermission('Bash');

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(false);
      expect(editResult.allowed).toBe(true);
      expect(bashResult.allowed).toBe(false);
      expect(bashResult.level).toBe('deny');
    });

    it('should handle user changing mind during multi-step process', async () => {
      // User initially allows, then cancels follow-up requests
      mockPromptHandler.setInteraction('Write', { response: 'allow-once' });

      // First request: user allows
      let response = await mockPromptHandler.prompt('Write');
      expect(response).toBe('allow-once');
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      // Use the permission
      const firstUse = await permissionManager.checkToolPermission('Write', {
        consumeAllowOnce: true
      });
      expect(firstUse.allowed).toBe(true);

      // Second request: user cancels
      mockPromptHandler.setInteraction('Write', { response: 'cancel' });
      response = await mockPromptHandler.prompt('Write');
      expect(response).toBe('cancel');

      // Should be denied now
      const secondUse = await permissionManager.checkToolPermission('Write');
      expect(secondUse.allowed).toBe(false);
    });
  });

  // =========================================================================
  // Permission Revocation During Operations
  // =========================================================================
  describe('Permission revocation during ongoing operations', () => {
    it('should handle revocation during long-running operation simulation', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      // Simulate starting a long operation
      const operationStarted = await permissionManager.checkToolPermission('Bash');
      expect(operationStarted.allowed).toBe(true);

      // Simulate revocation during operation
      await new Promise(resolve => setTimeout(resolve, 10));
      await permissionManager.revokePermission('Bash');

      // Operation that started with valid permission should complete
      // But new operations should be denied
      const newOperationCheck = await permissionManager.checkToolPermission('Bash');
      expect(newOperationCheck.allowed).toBe(false);
    });

    it('should handle revocation cascade across related tools', async () => {
      const tools = ['Read', 'Write', 'Edit']; // Related file operation tools

      // Grant all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Verify all are allowed
      let results = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );
      expect(results.every(r => r.allowed)).toBe(true);

      // Revoke core tool (Write) which might affect others
      await permissionManager.revokePermission('Write');

      // Check new states
      results = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      expect(results[0].allowed).toBe(true);  // Read still allowed
      expect(results[1].allowed).toBe(false); // Write revoked
      expect(results[2].allowed).toBe(true);  // Edit still allowed
    });

    it('should handle partial revocation in scoped environments', async () => {
      const scopes = ['project-root', 'src-folder', 'test-folder'];

      // Grant Write permission for all scopes
      for (const scope of scopes) {
        await permissionManager.grantPermission('Write', scope, 'allow-always');
      }

      // Revoke for sensitive scope only
      await permissionManager.revokePermission('Write', 'src-folder');

      // Check access for each scope
      const results = await Promise.all(
        scopes.map(scope =>
          permissionManager.checkToolPermission('Write', { scope })
        )
      );

      expect(results[0].allowed).toBe(true);  // project-root still allowed
      expect(results[1].allowed).toBe(false); // src-folder revoked
      expect(results[2].allowed).toBe(true);  // test-folder still allowed
    });

    it('should handle emergency revocation of all permissions', async () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob'];

      // Grant all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Emergency revocation (simulate security incident)
      const revocationPromises = tools.map(tool =>
        permissionManager.revokePermission(tool)
      );
      await Promise.all(revocationPromises);

      // All should be denied
      const results = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      expect(results.every(r => r.allowed === false)).toBe(true);
      expect(results.every(r => r.denialReason === 'Permission not granted')).toBe(true);
    });
  });

  // =========================================================================
  // Complex Multi-Agent Scenarios
  // =========================================================================
  describe('Complex multi-agent permission scenarios', () => {
    it('should handle permissions for multiple agents with conflicts', async () => {
      // Simulate different agents needing different permission levels
      const agents = [
        { name: 'reader-agent', tools: ['Read', 'Glob'] },
        { name: 'writer-agent', tools: ['Read', 'Write', 'Edit'] },
        { name: 'executor-agent', tools: ['Bash', 'Read'] },
      ];

      // Grant permissions per agent
      await permissionManager.grantPermission('Read', 'reader-agent', 'allow-always');
      await permissionManager.grantPermission('Glob', 'reader-agent', 'allow-always');

      await permissionManager.grantPermission('Read', 'writer-agent', 'allow-always');
      await permissionManager.grantPermission('Write', 'writer-agent', 'allow-always');
      await permissionManager.grantPermission('Edit', 'writer-agent', 'allow-always');

      await permissionManager.grantPermission('Bash', 'executor-agent', 'allow-once');
      await permissionManager.grantPermission('Read', 'executor-agent', 'allow-always');

      // Revoke writer agent access (security concern)
      await permissionManager.revokePermission('Write', 'writer-agent');
      await permissionManager.revokePermission('Edit', 'writer-agent');

      // Verify reader agent unaffected
      const readerRead = await permissionManager.checkToolPermission('Read', {
        scope: 'reader-agent'
      });
      const readerGlob = await permissionManager.checkToolPermission('Glob', {
        scope: 'reader-agent'
      });

      expect(readerRead.allowed).toBe(true);
      expect(readerGlob.allowed).toBe(true);

      // Verify writer agent partially revoked
      const writerRead = await permissionManager.checkToolPermission('Read', {
        scope: 'writer-agent'
      });
      const writerWrite = await permissionManager.checkToolPermission('Write', {
        scope: 'writer-agent'
      });

      expect(writerRead.allowed).toBe(true);  // Still has read
      expect(writerWrite.allowed).toBe(false); // Write revoked

      // Verify executor agent unaffected
      const executorBash = await permissionManager.checkToolPermission('Bash', {
        scope: 'executor-agent'
      });
      expect(executorBash.allowed).toBe(true);
    });

    it('should handle agent permission inheritance and override', async () => {
      // Global permission
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Specific agent override
      await permissionManager.setPermission('Read', 'restricted-agent', 'deny');
      await permissionManager.grantPermission('Read', 'privileged-agent', 'allow-always');

      // Check inheritance
      const globalRead = await permissionManager.checkToolPermission('Read');
      const restrictedRead = await permissionManager.checkToolPermission('Read', {
        scope: 'restricted-agent'
      });
      const privilegedRead = await permissionManager.checkToolPermission('Read', {
        scope: 'privileged-agent'
      });

      expect(globalRead.allowed).toBe(true);
      expect(restrictedRead.allowed).toBe(false);
      expect(restrictedRead.level).toBe('deny');
      expect(privilegedRead.allowed).toBe(true);
    });
  });

  // =========================================================================
  // Real-World User Interaction Patterns
  // =========================================================================
  describe('Real-world user interaction patterns', () => {
    it('should handle gradual permission escalation', async () => {
      // User starts with read-only, gradually escalates
      mockPromptHandler.setInteraction('Read', { response: 'allow-always' });
      mockPromptHandler.setInteraction('Write', { response: 'allow-once', delay: 50 });
      mockPromptHandler.setInteraction('Bash', { response: 'cancel', delay: 100 });

      // Stage 1: Read access
      let response = await mockPromptHandler.prompt('Read');
      expect(response).toBe('allow-always');
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Stage 2: Need write access
      response = await mockPromptHandler.prompt('Write');
      expect(response).toBe('allow-once');
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      // Stage 3: Need execution - user declines
      response = await mockPromptHandler.prompt('Bash');
      expect(response).toBe('cancel');

      // Verify final state
      const readResult = await permissionManager.checkToolPermission('Read');
      const writeResult = await permissionManager.checkToolPermission('Write');
      const bashResult = await permissionManager.checkToolPermission('Bash');

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
      expect(bashResult.allowed).toBe(false);
    });

    it('should handle session-based permission management', async () => {
      // Simulate user session with temporary permissions
      await permissionManager.grantPermission('Write', undefined, 'allow-once');
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      // Use allow-once permission
      const writeResult1 = await permissionManager.checkToolPermission('Write', {
        consumeAllowOnce: true
      });
      expect(writeResult1.allowed).toBe(true);

      // Session reset
      permissionManager.resetSession();

      // allow-once should be cleared, allow-always should persist
      const writeResult2 = await permissionManager.checkToolPermission('Write');
      const editResult = await permissionManager.checkToolPermission('Edit');

      expect(writeResult2.allowed).toBe(false);
      expect(editResult.allowed).toBe(true);
    });

    it('should handle user preference learning', async () => {
      // Simulate system learning user preferences over time
      const userPreferences = new Map<string, UserResponse>();

      // Initial unknown preferences
      mockPromptHandler.setDefaultResponse('cancel');

      // User establishes patterns
      const tools = ['Read', 'Write', 'Edit', 'Bash'];
      const preferences: UserResponse[] = ['allow-always', 'allow-once', 'allow-always', 'deny'];

      for (let i = 0; i < tools.length; i++) {
        userPreferences.set(tools[i], preferences[i]);
        mockPromptHandler.setInteraction(tools[i], { response: preferences[i] });
      }

      // Apply learned preferences
      for (const [tool, preference] of userPreferences) {
        const response = await mockPromptHandler.prompt(tool);
        expect(response).toBe(preference);

        if (preference === 'allow-always' || preference === 'allow-once') {
          await permissionManager.grantPermission(tool, undefined, preference);
        } else if (preference === 'deny') {
          await permissionManager.setPermission(tool, undefined, 'deny');
        }
      }

      // Verify preferences applied correctly
      const results = await Promise.all(
        tools.map(tool => permissionManager.checkToolPermission(tool))
      );

      expect(results[0].allowed).toBe(true);  // Read: allow-always
      expect(results[1].allowed).toBe(true);  // Write: allow-once
      expect(results[2].allowed).toBe(true);  // Edit: allow-always
      expect(results[3].allowed).toBe(false); // Bash: deny
      expect(results[3].level).toBe('deny');
    });

    it('should handle context-aware permission requests', async () => {
      // Different responses based on context
      mockPromptHandler.setInteraction('Write:safe-context', { response: 'allow-always' });
      mockPromptHandler.setInteraction('Write:risky-context', { response: 'deny' });
      mockPromptHandler.setInteraction('Write:unknown-context', { response: 'allow-once' });

      // Test context-aware responses
      const safeResponse = await mockPromptHandler.prompt('Write', 'safe-context');
      const riskyResponse = await mockPromptHandler.prompt('Write', 'risky-context');
      const unknownResponse = await mockPromptHandler.prompt('Write', 'unknown-context');

      expect(safeResponse).toBe('allow-always');
      expect(riskyResponse).toBe('deny');
      expect(unknownResponse).toBe('allow-once');

      // Apply context-based permissions
      await permissionManager.grantPermission('Write', 'safe-context', 'allow-always');
      await permissionManager.setPermission('Write', 'risky-context', 'deny');
      await permissionManager.grantPermission('Write', 'unknown-context', 'allow-once');

      // Verify context-based access
      const safeResult = await permissionManager.checkToolPermission('Write', {
        scope: 'safe-context'
      });
      const riskyResult = await permissionManager.checkToolPermission('Write', {
        scope: 'risky-context'
      });
      const unknownResult = await permissionManager.checkToolPermission('Write', {
        scope: 'unknown-context'
      });

      expect(safeResult.allowed).toBe(true);
      expect(riskyResult.allowed).toBe(false);
      expect(unknownResult.allowed).toBe(true);
    });
  });
});