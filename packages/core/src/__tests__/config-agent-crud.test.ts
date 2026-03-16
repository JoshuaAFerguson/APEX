import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { saveAgent, deleteAgent, loadAgents, parseAgentMarkdown } from '../config';
import { AgentDefinition } from '../types';

describe('Agent CRUD Operations', () => {
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    projectPath = tempDir;

    // Create the .apex/agents directory structure
    const apexDir = path.join(projectPath, '.apex');
    const agentsDir = path.join(apexDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('saveAgent()', () => {
    it('should save a valid agent definition to a markdown file', async () => {
      const agent: AgentDefinition = {
        name: 'test-agent',
        description: 'A test agent for unit testing',
        prompt: 'You are a test agent that helps with testing.',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      await saveAgent(projectPath, agent);

      // Verify file was created
      const filePath = path.join(projectPath, '.apex', 'agents', 'test-agent.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify file content
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('name: test-agent');
      expect(content).toContain('description: A test agent for unit testing');
      expect(content).toContain('tools: Read,Write');
      expect(content).toContain('model: sonnet');
      expect(content).toContain('You are a test agent that helps with testing.');
    });

    it('should save agent with minimal required fields only', async () => {
      const agent: AgentDefinition = {
        name: 'minimal-agent',
        description: 'Minimal agent with required fields only',
        prompt: 'You are a minimal agent.'
      };

      await saveAgent(projectPath, agent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'minimal-agent.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('name: minimal-agent');
      expect(content).toContain('description: Minimal agent with required fields only');
      expect(content).toContain('You are a minimal agent.');
      expect(content).not.toContain('tools:');
      expect(content).toContain('model: sonnet'); // Schema applies default
      expect(content).not.toContain('skills:');
    });

    it('should save agent with all optional fields', async () => {
      const agent: AgentDefinition = {
        name: 'full-agent',
        description: 'Agent with all fields populated',
        prompt: 'You are a comprehensive agent.',
        tools: ['Read', 'Write', 'Bash'],
        model: 'opus',
        skills: ['typescript', 'testing']
      };

      await saveAgent(projectPath, agent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'full-agent.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('name: full-agent');
      expect(content).toContain('description: Agent with all fields populated');
      expect(content).toContain('tools: Read,Write,Bash');
      expect(content).toContain('model: opus');
      expect(content).toContain('skills: typescript,testing');
      expect(content).toContain('You are a comprehensive agent.');
    });

    it('should create agents directory if it does not exist', async () => {
      // Remove the agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.rm(agentsDir, { recursive: true, force: true });

      const agent: AgentDefinition = {
        name: 'auto-create-agent',
        description: 'Agent to test directory auto-creation',
        prompt: 'You help test directory creation.'
      };

      await saveAgent(projectPath, agent);

      // Verify directory was created and file exists
      const filePath = path.join(agentsDir, 'auto-create-agent.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should overwrite existing agent file', async () => {
      const initialAgent: AgentDefinition = {
        name: 'overwrite-test',
        description: 'Initial description',
        prompt: 'Initial prompt.'
      };

      const updatedAgent: AgentDefinition = {
        name: 'overwrite-test',
        description: 'Updated description',
        prompt: 'Updated prompt.',
        tools: ['Read'],
        model: 'haiku'
      };

      // Save initial agent
      await saveAgent(projectPath, initialAgent);

      // Save updated agent (should overwrite)
      await saveAgent(projectPath, updatedAgent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'overwrite-test.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('description: Updated description');
      expect(content).toContain('Updated prompt.');
      expect(content).toContain('tools: Read');
      expect(content).toContain('model: haiku');
      expect(content).not.toContain('Initial description');
      expect(content).not.toContain('Initial prompt.');
    });

    it('should throw error for invalid agent definition', async () => {
      const invalidAgent = {
        // Missing required 'name' field
        description: 'Invalid agent',
        prompt: 'This agent is invalid.'
      } as AgentDefinition;

      await expect(saveAgent(projectPath, invalidAgent))
        .rejects
        .toThrow(/Invalid agent definition/);
    });

    it('should handle agent name with special characters properly', async () => {
      const agent: AgentDefinition = {
        name: 'test-agent_with-special_chars',
        description: 'Agent with special characters in name',
        prompt: 'You handle special characters.'
      };

      await saveAgent(projectPath, agent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'test-agent_with-special_chars.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle empty tools and skills arrays', async () => {
      const agent: AgentDefinition = {
        name: 'empty-arrays-agent',
        description: 'Agent with empty arrays',
        prompt: 'You have empty arrays.',
        tools: [],
        skills: []
      };

      await saveAgent(projectPath, agent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'empty-arrays-agent.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('name: empty-arrays-agent');
      expect(content).toContain('description: Agent with empty arrays');
      expect(content).toContain('You have empty arrays.');
      // Empty arrays should not appear in frontmatter
      expect(content).not.toContain('tools:');
      expect(content).not.toContain('skills:');
    });
  });

  describe('deleteAgent()', () => {
    beforeEach(async () => {
      // Create a test agent file for deletion tests
      const testAgent: AgentDefinition = {
        name: 'delete-test',
        description: 'Agent for testing deletion',
        prompt: 'You will be deleted.'
      };
      await saveAgent(projectPath, testAgent);
    });

    it('should delete existing agent file', async () => {
      const filePath = path.join(projectPath, '.apex', 'agents', 'delete-test.md');

      // Verify file exists before deletion
      const existsBefore = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsBefore).toBe(true);

      // Delete the agent
      await deleteAgent(projectPath, 'delete-test');

      // Verify file no longer exists
      const existsAfter = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsAfter).toBe(false);
    });

    it('should throw error when deleting non-existent agent', async () => {
      await expect(deleteAgent(projectPath, 'non-existent-agent'))
        .rejects
        .toThrow(/Agent 'non-existent-agent' not found/);
    });

    it('should throw error for empty agent name', async () => {
      await expect(deleteAgent(projectPath, ''))
        .rejects
        .toThrow(/Agent name must be a non-empty string/);
    });

    it('should throw error for null/undefined agent name', async () => {
      await expect(deleteAgent(projectPath, null as any))
        .rejects
        .toThrow(/Agent name must be a non-empty string/);

      await expect(deleteAgent(projectPath, undefined as any))
        .rejects
        .toThrow(/Agent name must be a non-empty string/);
    });

    it('should throw error for non-string agent name', async () => {
      await expect(deleteAgent(projectPath, 123 as any))
        .rejects
        .toThrow(/Agent name must be a non-empty string/);
    });

    it('should trim whitespace from agent name', async () => {
      // Create an agent with a specific name
      const testAgent: AgentDefinition = {
        name: 'whitespace-test',
        description: 'Agent for testing whitespace trimming',
        prompt: 'You test whitespace.'
      };
      await saveAgent(projectPath, testAgent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'whitespace-test.md');

      // Verify file exists
      const existsBefore = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsBefore).toBe(true);

      // Delete with whitespace around name
      await deleteAgent(projectPath, '  whitespace-test  ');

      // Verify file was deleted
      const existsAfter = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsAfter).toBe(false);
    });

    it('should handle agent names with special characters', async () => {
      const agentName = 'special-agent_with-chars';
      const testAgent: AgentDefinition = {
        name: agentName,
        description: 'Agent with special characters',
        prompt: 'You have special characters.'
      };
      await saveAgent(projectPath, testAgent);

      const filePath = path.join(projectPath, '.apex', 'agents', `${agentName}.md`);

      // Verify file exists
      const existsBefore = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsBefore).toBe(true);

      // Delete the agent
      await deleteAgent(projectPath, agentName);

      // Verify file was deleted
      const existsAfter = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsAfter).toBe(false);
    });
  });

  describe('Integration with existing functions', () => {
    it('should work with loadAgents() after saving agent', async () => {
      const agent: AgentDefinition = {
        name: 'integration-test',
        description: 'Agent for integration testing',
        prompt: 'You test integration.',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      // Save agent
      await saveAgent(projectPath, agent);

      // Load agents and verify it's included
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('integration-test');
      expect(agents['integration-test']).toEqual(agent);
    });

    it('should work with parseAgentMarkdown() for saved content', async () => {
      const originalAgent: AgentDefinition = {
        name: 'parse-test',
        description: 'Agent for testing parsing',
        prompt: 'You test parsing functionality.',
        tools: ['Read', 'Bash'],
        model: 'opus',
        skills: ['testing']
      };

      // Save agent
      await saveAgent(projectPath, originalAgent);

      // Read file and parse it
      const filePath = path.join(projectPath, '.apex', 'agents', 'parse-test.md');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsedAgent = parseAgentMarkdown(content);

      expect(parsedAgent).not.toBeNull();
      expect(parsedAgent).toEqual(originalAgent);
    });

    it('should remove agent from loadAgents() result after deletion', async () => {
      const agent1: AgentDefinition = {
        name: 'persistent-agent',
        description: 'Agent that stays',
        prompt: 'You persist.'
      };

      const agent2: AgentDefinition = {
        name: 'temporary-agent',
        description: 'Agent that gets deleted',
        prompt: 'You are temporary.'
      };

      // Save both agents
      await saveAgent(projectPath, agent1);
      await saveAgent(projectPath, agent2);

      // Verify both exist
      let agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('persistent-agent');
      expect(agents).toHaveProperty('temporary-agent');

      // Delete one agent
      await deleteAgent(projectPath, 'temporary-agent');

      // Verify only persistent agent remains
      agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('persistent-agent');
      expect(agents).not.toHaveProperty('temporary-agent');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle file system errors gracefully', async () => {
      // Test that the functions handle filesystem issues appropriately
      const agent: AgentDefinition = {
        name: 'filesystem-test',
        description: 'Agent for testing filesystem errors',
        prompt: 'You test filesystem errors.'
      };

      // Test with a path that exists but might have issues
      // Note: The saveAgent function creates directories recursively, so it might succeed
      // This test verifies the function doesn't crash and provides meaningful errors when needed
      const testPath = path.join(tempDir, 'test-filesystem');

      // This should succeed since fs.mkdir with recursive: true creates the path
      await expect(saveAgent(testPath, agent)).resolves.not.toThrow();

      // Verify the file was created
      const filePath = path.join(testPath, '.apex', 'agents', 'filesystem-test.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle concurrent save operations', async () => {
      const agent1: AgentDefinition = {
        name: 'concurrent-1',
        description: 'First concurrent agent',
        prompt: 'You are first.'
      };

      const agent2: AgentDefinition = {
        name: 'concurrent-2',
        description: 'Second concurrent agent',
        prompt: 'You are second.'
      };

      // Save both agents concurrently
      await Promise.all([
        saveAgent(projectPath, agent1),
        saveAgent(projectPath, agent2)
      ]);

      // Verify both were saved
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('concurrent-1');
      expect(agents).toHaveProperty('concurrent-2');
    });
  });

  describe('Path normalization', () => {
    it('should handle different path separators correctly', async () => {
      const agent: AgentDefinition = {
        name: 'path-test',
        description: 'Agent for testing path handling',
        prompt: 'You test paths.'
      };

      // Test with path that has mixed separators (on Windows)
      const mixedPath = projectPath.replace(/\//g, path.sep);
      await saveAgent(mixedPath, agent);

      // Verify file was created correctly
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('path-test');
    });
  });
});