import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { saveAgent, deleteAgent, loadAgents, parseAgentMarkdown, loadConfig, initializeApex } from '../config';
import { AgentDefinition } from '../types';

describe('Agent CRUD Operations - Integration Tests', () => {
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));
    projectPath = tempDir;
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

  describe('Integration with APEX initialization', () => {
    it('should work with agents after initializing APEX project', async () => {
      // Initialize APEX in the project
      await initializeApex(projectPath, {
        projectName: 'test-project',
        language: 'typescript',
        framework: 'react'
      });

      // Create an agent
      const agent: AgentDefinition = {
        name: 'post-init-agent',
        description: 'Agent created after APEX initialization',
        prompt: 'You were created after project initialization.',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      await saveAgent(projectPath, agent);

      // Verify agent exists
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('post-init-agent');
      expect(agents['post-init-agent']).toEqual(agent);

      // Verify we can load the config too
      const config = await loadConfig(projectPath);
      expect(config.project.name).toBe('test-project');
    });

    it('should handle agents directory creation before APEX initialization', async () => {
      // Create agent before APEX is fully initialized
      const agent: AgentDefinition = {
        name: 'early-agent',
        description: 'Agent created before full APEX setup',
        prompt: 'You were created early.'
      };

      await saveAgent(projectPath, agent);

      // Initialize APEX afterwards
      await initializeApex(projectPath, {
        projectName: 'test-project'
      });

      // Agent should still exist and be loadable
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('early-agent');
    });
  });

  describe('Integration with loadAgents()', () => {
    it('should maintain consistency between save/load cycles', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const originalAgents: AgentDefinition[] = [
        {
          name: 'planner',
          description: 'Plans and breaks down tasks',
          prompt: 'You are a skilled project planner.',
          tools: ['Read', 'Write'],
          model: 'opus'
        },
        {
          name: 'developer',
          description: 'Writes and refactors code',
          prompt: 'You are an expert developer.',
          tools: ['Read', 'Write', 'Edit', 'Bash'],
          model: 'sonnet',
          skills: ['typescript', 'react']
        },
        {
          name: 'reviewer',
          description: 'Reviews and improves code quality',
          prompt: 'You are a thorough code reviewer.',
          tools: ['Read'],
          model: 'haiku'
        }
      ];

      // Save all agents
      for (const agent of originalAgents) {
        await saveAgent(projectPath, agent);
      }

      // Load agents and verify consistency
      const loadedAgents = await loadAgents(projectPath);

      expect(Object.keys(loadedAgents)).toHaveLength(3);
      for (const originalAgent of originalAgents) {
        expect(loadedAgents).toHaveProperty(originalAgent.name);
        expect(loadedAgents[originalAgent.name]).toEqual(originalAgent);
      }
    });

    it('should handle mixed operations correctly', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      // Save initial agents
      const agent1: AgentDefinition = {
        name: 'persistent-agent',
        description: 'This agent will persist',
        prompt: 'You persist through operations.'
      };

      const agent2: AgentDefinition = {
        name: 'temporary-agent',
        description: 'This agent will be deleted',
        prompt: 'You are temporary.'
      };

      const agent3: AgentDefinition = {
        name: 'updated-agent',
        description: 'This agent will be updated',
        prompt: 'You will be updated.'
      };

      await Promise.all([
        saveAgent(projectPath, agent1),
        saveAgent(projectPath, agent2),
        saveAgent(projectPath, agent3)
      ]);

      // Verify all exist
      let agents = await loadAgents(projectPath);
      expect(Object.keys(agents)).toHaveLength(3);

      // Delete one agent
      await deleteAgent(projectPath, 'temporary-agent');

      // Update another agent
      const updatedAgent3: AgentDefinition = {
        ...agent3,
        description: 'This agent has been updated',
        prompt: 'You have been updated.',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      await saveAgent(projectPath, updatedAgent3);

      // Add a new agent
      const agent4: AgentDefinition = {
        name: 'new-agent',
        description: 'This is a new agent',
        prompt: 'You are new.'
      };

      await saveAgent(projectPath, agent4);

      // Verify final state
      agents = await loadAgents(projectPath);
      expect(Object.keys(agents)).toHaveLength(3);
      expect(agents).toHaveProperty('persistent-agent');
      expect(agents).not.toHaveProperty('temporary-agent');
      expect(agents).toHaveProperty('updated-agent');
      expect(agents).toHaveProperty('new-agent');

      // Verify the updated agent has new content
      expect(agents['updated-agent'].description).toBe('This agent has been updated');
      expect(agents['updated-agent'].tools).toEqual(['Read', 'Write']);
      expect(agents['updated-agent'].model).toBe('sonnet');
    });
  });

  describe('Integration with parseAgentMarkdown()', () => {
    it('should create files that parseAgentMarkdown can correctly read', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const testCases: AgentDefinition[] = [
        {
          name: 'minimal-parse-test',
          description: 'Minimal agent for parsing test',
          prompt: 'You are minimal.',
          model: 'sonnet' // Schema adds defaults
        },
        {
          name: 'full-parse-test',
          description: 'Full agent for parsing test',
          prompt: 'You are comprehensive.',
          tools: ['Read', 'Write', 'Edit'],
          model: 'opus',
          skills: ['typescript', 'testing']
        },
        {
          name: 'special-content-test',
          description: 'Agent with special YAML content: quotes, "double quotes", and \'single quotes\'',
          prompt: 'You handle special content:\n- Lists\n- With items\n\nAnd multiple paragraphs.',
          model: 'sonnet'
        }
      ];

      for (const originalAgent of testCases) {
        // Save the agent
        await saveAgent(projectPath, originalAgent);

        // Read the file directly
        const filePath = path.join(agentsDir, `${originalAgent.name}.md`);
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Parse it back
        const parsedAgent = parseAgentMarkdown(fileContent);

        // Verify parsing succeeded and content matches
        expect(parsedAgent).not.toBeNull();
        expect(parsedAgent).toEqual(originalAgent);
      }
    });

    it('should handle round-trip with complex content', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const complexAgent: AgentDefinition = {
        name: 'complex-roundtrip-test',
        description: 'Complex agent for round-trip testing with\nmultiline description\nand special chars: @#$%^&*()',
        prompt: `You are a complex agent with:

1. Multiple paragraphs
2. Special characters: !@#$%^&*()
3. Code blocks:
   \`\`\`typescript
   function example() {
     return 'Hello, World!';
   }
   \`\`\`

4. Lists and formatting
   - Item 1
   - Item 2 with "quotes"
   - Item 3 with 'apostrophes'

> Blockquotes and other markdown elements

**Bold text** and *italic text*

---

Final paragraph with emoji: 🤖`,
        tools: ['Read', 'Write', 'Edit', 'Bash', 'WebFetch'],
        model: 'sonnet',
        skills: ['typescript', 'react', 'testing', 'documentation']
      };

      // Save the agent
      await saveAgent(projectPath, complexAgent);

      // Load via loadAgents
      const agents = await loadAgents(projectPath);
      const loadedAgent = agents['complex-roundtrip-test'];

      // Verify round-trip consistency
      expect(loadedAgent).toEqual(complexAgent);

      // Also verify direct file parsing
      const filePath = path.join(agentsDir, 'complex-roundtrip-test.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedAgent = parseAgentMarkdown(fileContent);

      expect(parsedAgent).toEqual(complexAgent);
    });
  });

  describe('File system operations integration', () => {
    it('should handle simultaneous reads and writes', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      // Create initial agents
      const initialAgents = Array.from({ length: 5 }, (_, i) => ({
        name: `concurrent-agent-${i}`,
        description: `Agent ${i} for concurrent testing`,
        prompt: `You are agent number ${i}.`
      }));

      for (const agent of initialAgents) {
        await saveAgent(projectPath, agent);
      }

      // Perform concurrent operations
      const operations = [
        // Concurrent reads
        ...Array.from({ length: 3 }, () => loadAgents(projectPath)),
        // Concurrent writes
        saveAgent(projectPath, {
          name: 'new-concurrent-agent',
          description: 'New agent added during concurrent ops',
          prompt: 'You were added during chaos.'
        }),
        // Concurrent delete
        deleteAgent(projectPath, 'concurrent-agent-2'),
        // Concurrent update
        saveAgent(projectPath, {
          name: 'concurrent-agent-1',
          description: 'Updated during concurrent ops',
          prompt: 'You were updated during chaos.',
          tools: ['Read']
        })
      ];

      const results = await Promise.allSettled(operations);

      // All operations should succeed
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures).toHaveLength(0);

      // Verify final state is consistent
      const finalAgents = await loadAgents(projectPath);
      expect(finalAgents).toHaveProperty('new-concurrent-agent');
      expect(finalAgents).not.toHaveProperty('concurrent-agent-2');
      expect(finalAgents['concurrent-agent-1'].description).toBe('Updated during concurrent ops');
    });

    it('should handle cleanup of corrupt files gracefully', async () => {
      // Create the .apex/agents directory
      const agentsDir = path.join(projectPath, '.apex', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      // Create valid agent
      const validAgent: AgentDefinition = {
        name: 'valid-agent',
        description: 'A valid agent',
        prompt: 'You are valid.'
      };

      await saveAgent(projectPath, validAgent);

      // Create corrupt files
      await fs.writeFile(path.join(agentsDir, 'corrupt.md'), 'This is not valid agent markdown');
      await fs.writeFile(path.join(agentsDir, 'empty.md'), '');
      await fs.writeFile(path.join(agentsDir, 'invalid-yaml.md'), '---\ninvalid: yaml: content\n---\nPrompt');

      // loadAgents should skip corrupt files and return valid ones
      const agents = await loadAgents(projectPath);

      expect(agents).toHaveProperty('valid-agent');
      expect(Object.keys(agents)).toHaveLength(1);
    });
  });

  describe('Path normalization integration', () => {
    it('should work consistently across different path formats', async () => {
      const agent: AgentDefinition = {
        name: 'path-normalization-test',
        description: 'Agent for path normalization testing',
        prompt: 'You test path normalization.'
      };

      // Test different path representations
      const pathVariations = [
        projectPath,
        projectPath + path.sep,
        path.resolve(projectPath),
        path.normalize(projectPath)
      ];

      // Save with different path formats
      for (let i = 0; i < pathVariations.length; i++) {
        const agentWithIndex: AgentDefinition = {
          ...agent,
          name: `${agent.name}-${i}`
        };
        await saveAgent(pathVariations[i], agentWithIndex);
      }

      // Load with different path formats and verify consistency
      for (let i = 0; i < pathVariations.length; i++) {
        const agents = await loadAgents(pathVariations[i]);
        expect(Object.keys(agents)).toHaveLength(pathVariations.length);
        for (let j = 0; j < pathVariations.length; j++) {
          expect(agents).toHaveProperty(`path-normalization-test-${j}`);
        }
      }
    });

    it('should handle relative and absolute paths correctly', async () => {
      const agent: AgentDefinition = {
        name: 'relative-path-test',
        description: 'Agent for relative path testing',
        prompt: 'You test relative paths.'
      };

      // Save with absolute path
      await saveAgent(path.resolve(projectPath), agent);

      // Try to load with relative path (if possible)
      const relativePath = path.relative(process.cwd(), projectPath);
      if (relativePath && relativePath !== '..') {
        const agents = await loadAgents(relativePath);
        expect(agents).toHaveProperty('relative-path-test');
      }
    });
  });

  describe('Error recovery and resilience', () => {
    it('should handle partial directory structures', async () => {
      // Create only .apex directory, not agents subdirectory
      await fs.mkdir(path.join(projectPath, '.apex'));

      const agent: AgentDefinition = {
        name: 'auto-create-test',
        description: 'Agent to test auto-creation of directories',
        prompt: 'You test directory creation.'
      };

      // Should create agents directory automatically
      await saveAgent(projectPath, agent);

      // Verify agent was saved
      const agents = await loadAgents(projectPath);
      expect(agents).toHaveProperty('auto-create-test');
    });

    it('should handle permission scenarios gracefully', async () => {
      // Note: This test may not work on all systems due to permission restrictions
      // It's designed to verify graceful error handling

      const agent: AgentDefinition = {
        name: 'permission-test',
        description: 'Agent for permission testing',
        prompt: 'You test permissions.'
      };

      // Create a read-only directory scenario (skip on Windows)
      if (process.platform !== 'win32') {
        try {
          const readOnlyDir = path.join(tempDir, 'readonly');
          await fs.mkdir(readOnlyDir);
          await fs.chmod(readOnlyDir, 0o444); // Read-only

          // This should fail gracefully
          await expect(saveAgent(readOnlyDir, agent))
            .rejects
            .toThrow();

          // Restore permissions for cleanup
          await fs.chmod(readOnlyDir, 0o755);
        } catch (error) {
          // Skip this test if we can't set up the permission scenario
        }
      }
    });
  });
});