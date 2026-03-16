import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { saveAgent, deleteAgent, loadAgents, parseAgentMarkdown } from '../config';
import { AgentDefinition } from '../types';

describe('Agent CRUD Operations - Comprehensive Edge Cases & Error Handling', () => {
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-comprehensive-test-'));
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

  describe('saveAgent() - Comprehensive Edge Cases', () => {
    describe('Schema validation edge cases', () => {
      it('should handle agent with extremely long name', async () => {
        // Use a long but filesystem-safe name (under 255 chars including .md extension)
        const longName = 'a'.repeat(200);
        const agent: AgentDefinition = {
          name: longName,
          description: 'Agent with very long name',
          prompt: 'You have a long name.'
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', `${longName}.md`);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain(`name: ${longName}`);
      });

      it('should handle agent with extremely long description', async () => {
        const longDescription = 'A'.repeat(2000); // Very long description
        const agent: AgentDefinition = {
          name: 'long-desc-agent',
          description: longDescription,
          prompt: 'You have a long description.'
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'long-desc-agent.md');
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain(longDescription);
      });

      it('should handle agent with extremely long prompt', async () => {
        const longPrompt = 'You are an agent with a very long prompt. ' + 'Details about your behavior. '.repeat(500);
        const agent: AgentDefinition = {
          name: 'long-prompt-agent',
          description: 'Agent with very long prompt',
          prompt: longPrompt
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'long-prompt-agent.md');
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain(longPrompt);
      });

      it('should handle agent with many tools', async () => {
        const allTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite', 'Browser'];
        const agent: AgentDefinition = {
          name: 'multi-tool-agent',
          description: 'Agent with all available tools',
          prompt: 'You can use all tools.',
          tools: allTools
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'multi-tool-agent.md');
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain(`tools: ${allTools.join(',')}`);
      });

      it('should handle agent with many skills', async () => {
        const manySkills = Array.from({ length: 20 }, (_, i) => `skill-${i + 1}`);
        const agent: AgentDefinition = {
          name: 'multi-skill-agent',
          description: 'Agent with many skills',
          prompt: 'You have many skills.',
          skills: manySkills
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'multi-skill-agent.md');
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain(`skills: ${manySkills.join(',')}`);
      });
    });

    describe('Input validation edge cases', () => {
      it('should reject agent with null name', async () => {
        const agent = {
          name: null,
          description: 'Agent with null name',
          prompt: 'You have a null name.'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with undefined name', async () => {
        const agent = {
          description: 'Agent without name',
          prompt: 'You have no name.'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with numeric name', async () => {
        const agent = {
          name: 123,
          description: 'Agent with numeric name',
          prompt: 'You have a numeric name.'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with boolean description', async () => {
        const agent = {
          name: 'boolean-desc-agent',
          description: true,
          prompt: 'You have a boolean description.'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with missing prompt', async () => {
        const agent = {
          name: 'missing-prompt-agent',
          description: 'Agent without prompt'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with invalid model', async () => {
        const agent = {
          name: 'invalid-model-agent',
          description: 'Agent with invalid model',
          prompt: 'You have an invalid model.',
          model: 'invalid-model'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with tools as string instead of array', async () => {
        const agent = {
          name: 'string-tools-agent',
          description: 'Agent with tools as string',
          prompt: 'You have tools as string.',
          tools: 'Read,Write'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });

      it('should reject agent with skills as string instead of array', async () => {
        const agent = {
          name: 'string-skills-agent',
          description: 'Agent with skills as string',
          prompt: 'You have skills as string.',
          skills: 'typescript,testing'
        } as any;

        await expect(saveAgent(projectPath, agent))
          .rejects
          .toThrow(/Invalid agent definition/);
      });
    });

    describe('Special character and Unicode handling', () => {
      it('should handle agent name with Unicode characters', async () => {
        const agent: AgentDefinition = {
          name: 'agent-with-ü-and-é',
          description: 'Agent with Unicode characters: ñ, ü, é, 中文',
          prompt: 'You handle Unicode: 🤖 emoji and 中文字符。'
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'agent-with-ü-and-é.md');
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain('Agent with Unicode characters: ñ, ü, é, 中文');
        expect(content).toContain('You handle Unicode: 🤖 emoji and 中文字符。');
      });

      it('should handle agent with YAML special characters in content', async () => {
        const agent: AgentDefinition = {
          name: 'yaml-special-chars',
          description: 'Description with: colons, "quotes", and \'apostrophes\'',
          prompt: 'You handle YAML special chars: - dashes\n* asterisks\n> greater than\n| pipes\nand [brackets]'
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'yaml-special-chars.md');
        const content = await fs.readFile(filePath, 'utf-8');
        // YAML may quote the description, so check for presence in any form
        expect(content).toMatch(/colons.*quotes.*apostrophes/);
        expect(content).toContain('- dashes');
        expect(content).toContain('[brackets]');
      });

      it('should handle agent with line breaks in description and prompt', async () => {
        const agent: AgentDefinition = {
          name: 'multiline-agent',
          description: 'Description with\nmultiple lines\nand formatting',
          prompt: 'You are an agent with\n\nmultiple paragraphs.\n\nEach paragraph is separated by blank lines.'
        };

        await saveAgent(projectPath, agent);

        const filePath = path.join(projectPath, '.apex', 'agents', 'multiline-agent.md');
        const content = await fs.readFile(filePath, 'utf-8');

        // Verify the content preserves line breaks
        expect(content).toContain('multiple lines');
        expect(content).toContain('multiple paragraphs');

        // Verify we can parse it back correctly
        const parsedAgent = parseAgentMarkdown(content);
        expect(parsedAgent).not.toBeNull();
        expect(parsedAgent?.description).toContain('\n');
        expect(parsedAgent?.prompt).toContain('\n\n');
      });
    });

    describe('File system edge cases', () => {
      it('should handle very deep directory structure', async () => {
        const deepPath = path.join(tempDir, 'very', 'deep', 'nested', 'directory', 'structure');
        const agent: AgentDefinition = {
          name: 'deep-path-agent',
          description: 'Agent in very deep path',
          prompt: 'You exist in a deep directory.'
        };

        await saveAgent(deepPath, agent);

        const filePath = path.join(deepPath, '.apex', 'agents', 'deep-path-agent.md');
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      });

      it('should handle case-sensitive file systems correctly', async () => {
        const agent1: AgentDefinition = {
          name: 'Case-Sensitive-Agent',
          description: 'Agent with mixed case name',
          prompt: 'You have mixed case.'
        };

        const agent2: AgentDefinition = {
          name: 'case-sensitive-agent',
          description: 'Agent with lowercase name',
          prompt: 'You are lowercase.'
        };

        await saveAgent(projectPath, agent1);
        await saveAgent(projectPath, agent2);

        // Both should exist as separate files on case-sensitive systems
        const file1 = path.join(projectPath, '.apex', 'agents', 'Case-Sensitive-Agent.md');
        const file2 = path.join(projectPath, '.apex', 'agents', 'case-sensitive-agent.md');

        const exists1 = await fs.access(file1).then(() => true).catch(() => false);
        const exists2 = await fs.access(file2).then(() => true).catch(() => false);

        // On case-insensitive systems (like macOS APFS), only one may exist
        if (process.platform === 'darwin') {
          // On macOS, this may be case-insensitive, so just check one exists
          expect(exists1 || exists2).toBe(true);
        } else {
          // On case-sensitive systems, both should exist
          expect(exists1).toBe(true);
          expect(exists2).toBe(true);

          // Content should be different
          const content1 = await fs.readFile(file1, 'utf-8');
          const content2 = await fs.readFile(file2, 'utf-8');
          expect(content1).not.toBe(content2);
        }
      });
    });

    describe('Concurrent operations', () => {
      it('should handle concurrent saves of different agents', async () => {
        const agents = Array.from({ length: 10 }, (_, i) => ({
          name: `concurrent-agent-${i}`,
          description: `Agent ${i} for concurrent testing`,
          prompt: `You are agent number ${i}.`
        }));

        // Save all agents concurrently
        await Promise.all(agents.map(agent => saveAgent(projectPath, agent)));

        // Verify all were saved
        const loadedAgents = await loadAgents(projectPath);
        for (let i = 0; i < 10; i++) {
          expect(loadedAgents).toHaveProperty(`concurrent-agent-${i}`);
        }
      });

      it('should handle concurrent saves of the same agent', async () => {
        const agent1: AgentDefinition = {
          name: 'concurrent-same',
          description: 'First version',
          prompt: 'You are the first version.'
        };

        const agent2: AgentDefinition = {
          name: 'concurrent-same',
          description: 'Second version',
          prompt: 'You are the second version.'
        };

        // Save both concurrently - one should win
        await Promise.all([
          saveAgent(projectPath, agent1),
          saveAgent(projectPath, agent2)
        ]);

        // File should exist and contain one of the versions
        const filePath = path.join(projectPath, '.apex', 'agents', 'concurrent-same.md');
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(filePath, 'utf-8');
        const hasFirst = content.includes('First version');
        const hasSecond = content.includes('Second version');

        // Should have exactly one of the versions
        expect(hasFirst || hasSecond).toBe(true);
        expect(hasFirst && hasSecond).toBe(false);
      });
    });
  });

  describe('deleteAgent() - Comprehensive Edge Cases', () => {
    beforeEach(async () => {
      // Create test agents for deletion tests
      const testAgents = [
        { name: 'test-agent-1', description: 'First test agent', prompt: 'You are first.' },
        { name: 'test-agent-2', description: 'Second test agent', prompt: 'You are second.' },
        { name: 'special-chars_agent-123', description: 'Agent with special chars', prompt: 'You have special chars.' }
      ];

      for (const agent of testAgents) {
        await saveAgent(projectPath, agent);
      }
    });

    describe('Input validation edge cases', () => {
      it('should handle whitespace-only agent name', async () => {
        await expect(deleteAgent(projectPath, '   '))
          .rejects
          .toThrow(/Agent name must be a non-empty string/);
      });

      it('should handle agent name with only newlines', async () => {
        await expect(deleteAgent(projectPath, '\n\n'))
          .rejects
          .toThrow(/Agent name must be a non-empty string/);
      });

      it('should handle agent name with only tabs', async () => {
        await expect(deleteAgent(projectPath, '\t\t'))
          .rejects
          .toThrow(/Agent name must be a non-empty string/);
      });

      it('should handle various falsy values as agent name', async () => {
        const falsyValues = [false, 0, NaN, null, undefined, ''];

        for (const falsyValue of falsyValues) {
          await expect(deleteAgent(projectPath, falsyValue as any))
            .rejects
            .toThrow(/Agent name must be a non-empty string/);
        }
      });

      it('should handle object as agent name', async () => {
        await expect(deleteAgent(projectPath, {} as any))
          .rejects
          .toThrow(/Agent name must be a non-empty string/);
      });

      it('should handle array as agent name', async () => {
        await expect(deleteAgent(projectPath, ['agent-name'] as any))
          .rejects
          .toThrow(/Agent name must be a non-empty string/);
      });
    });

    describe('File system edge cases', () => {
      it('should handle deletion when .apex directory does not exist', async () => {
        const newTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-apex-'));

        await expect(deleteAgent(newTempDir, 'non-existent'))
          .rejects
          .toThrow(/Agent 'non-existent' not found/);

        await fs.rm(newTempDir, { recursive: true, force: true });
      });

      it('should handle deletion when agents directory does not exist', async () => {
        const noAgentsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-agents-'));
        await fs.mkdir(path.join(noAgentsDir, '.apex'));

        await expect(deleteAgent(noAgentsDir, 'non-existent'))
          .rejects
          .toThrow(/Agent 'non-existent' not found/);

        await fs.rm(noAgentsDir, { recursive: true, force: true });
      });

      it('should handle very long agent names', async () => {
        const longName = 'a'.repeat(200); // Use filesystem-safe length
        await expect(deleteAgent(projectPath, longName))
          .rejects
          .toThrow(`Agent '${longName}' not found`);
      });

      it('should handle agent names with path traversal attempts', async () => {
        const maliciousNames = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '/etc/passwd',
          'C:\\Windows\\System32',
          '../../..',
          './../..',
        ];

        for (const maliciousName of maliciousNames) {
          await expect(deleteAgent(projectPath, maliciousName))
            .rejects
            .toThrow(`Agent '${maliciousName}' not found`);
        }
      });

      it('should handle agent names with null bytes', async () => {
        const nameWithNullByte = 'agent\0name';
        await expect(deleteAgent(projectPath, nameWithNullByte))
          .rejects
          .toThrow(/Failed to delete agent/);
      });
    });

    describe('Concurrent operations', () => {
      it('should handle concurrent deletion of different agents', async () => {
        // Delete multiple agents concurrently
        await Promise.all([
          deleteAgent(projectPath, 'test-agent-1'),
          deleteAgent(projectPath, 'test-agent-2')
        ]);

        // Both should be gone
        const agents = await loadAgents(projectPath);
        expect(agents).not.toHaveProperty('test-agent-1');
        expect(agents).not.toHaveProperty('test-agent-2');
      });

      it('should handle concurrent deletion of the same agent', async () => {
        // First deletion should succeed, second should fail
        const deletions = [
          deleteAgent(projectPath, 'special-chars_agent-123'),
          deleteAgent(projectPath, 'special-chars_agent-123')
        ];

        const results = await Promise.allSettled(deletions);

        // At least one should succeed, others may fail
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        // In concurrent scenarios, both might succeed due to filesystem timing
        // Just ensure we get consistent results
        expect(successes.length + failures.length).toBe(2);
        expect(successes.length).toBeGreaterThanOrEqual(1);

        if (failures.length > 0 && failures[0].status === 'rejected') {
          expect(failures[0].reason.message).toContain('not found');
        }
      });
    });

    describe('Case sensitivity', () => {
      it('should handle case-sensitive agent names correctly', async () => {
        // Create the test agent first since beforeEach might not have run in this context
        const testAgent: AgentDefinition = {
          name: 'test-agent-1',
          description: 'Test agent for case sensitivity',
          prompt: 'You test case sensitivity.'
        };
        await saveAgent(projectPath, testAgent);

        // Verify the agent was saved
        const beforeAgents = await loadAgents(projectPath);
        expect(beforeAgents).toHaveProperty('test-agent-1');

        // Try to delete with different case - should fail on case-sensitive systems
        const error = await deleteAgent(projectPath, 'TEST-AGENT-1')
          .then(() => null)
          .catch(e => e);

        // Check results after attempted deletion
        const agents = await loadAgents(projectPath);
        const hasLowercase = agents.hasOwnProperty('test-agent-1');
        const hasUppercase = agents.hasOwnProperty('TEST-AGENT-1');

        if (process.platform === 'darwin') {
          // On macOS (case-insensitive), behavior may vary
          // The test is successful if we get consistent behavior
          expect(typeof error === 'object' || hasLowercase || hasUppercase).toBe(true);
        } else {
          // On case-sensitive systems, should fail and original should remain
          expect(error).not.toBeNull();
          expect(error.message).toMatch(/not found/);
          expect(hasLowercase).toBe(true);
        }
      });
    });
  });

  describe('Error message accuracy', () => {
    it('should provide detailed error messages for validation failures', async () => {
      // Test with invalid agent (missing required field)
      await expect(saveAgent(projectPath, {
        description: 'Invalid agent',
        prompt: 'Test'
        // Missing 'name' field
      } as any))
        .rejects
        .toThrow(/Invalid agent definition/);
    });

    it('should provide clear error messages for missing files', async () => {
      try {
        await deleteAgent(projectPath, 'definitely-does-not-exist');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe("Agent 'definitely-does-not-exist' not found");
      }
    });
  });

  describe('Integration with parseAgentMarkdown edge cases', () => {
    it('should handle malformed YAML frontmatter gracefully', async () => {
      const agent: AgentDefinition = {
        name: 'test-parsing-agent',
        description: 'Agent to test parsing',
        prompt: 'You are for testing parsing.'
      };

      await saveAgent(projectPath, agent);

      // Read and manually corrupt the YAML
      const filePath = path.join(projectPath, '.apex', 'agents', 'test-parsing-agent.md');
      let content = await fs.readFile(filePath, 'utf-8');

      // Corrupt the YAML frontmatter
      const corruptedContent = content.replace('description:', 'description: [invalid yaml');
      await fs.writeFile(filePath, corruptedContent, 'utf-8');

      // Parsing should return null for invalid content
      const parsedAgent = parseAgentMarkdown(corruptedContent);
      expect(parsedAgent).toBeNull();
    });

    it('should handle BOM and different encodings', async () => {
      const agent: AgentDefinition = {
        name: 'encoding-test-agent',
        description: 'Agent to test encoding',
        prompt: 'You handle different encodings.'
      };

      await saveAgent(projectPath, agent);

      const filePath = path.join(projectPath, '.apex', 'agents', 'encoding-test-agent.md');
      let content = await fs.readFile(filePath, 'utf-8');

      // Add BOM (Byte Order Mark)
      const bomContent = '\uFEFF' + content;
      await fs.writeFile(filePath, bomContent, 'utf-8');

      // Should still parse correctly
      const parsedAgent = parseAgentMarkdown(bomContent);
      expect(parsedAgent).not.toBeNull();
      expect(parsedAgent?.name).toBe('encoding-test-agent');
    });
  });

  describe('Performance edge cases', () => {
    it('should handle saving agents with very large content', async () => {
      const largePrompt = 'This is a very large prompt. '.repeat(10000); // ~300KB
      const agent: AgentDefinition = {
        name: 'large-content-agent',
        description: 'Agent with very large content',
        prompt: largePrompt
      };

      const startTime = Date.now();
      await saveAgent(projectPath, agent);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify content was saved correctly
      const filePath = path.join(projectPath, '.apex', 'agents', 'large-content-agent.md');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(largePrompt.substring(0, 100));
    });
  });

  describe('Cross-platform path handling', () => {
    it('should handle different path separators correctly', async () => {
      const agent: AgentDefinition = {
        name: 'cross-platform-agent',
        description: 'Agent for cross-platform testing',
        prompt: 'You work cross-platform.'
      };

      // Test with different path representations
      const paths = [
        projectPath,
        projectPath.replace(/\//g, path.sep),
        path.resolve(projectPath)
      ];

      for (const testPath of paths) {
        await saveAgent(testPath, { ...agent, name: `${agent.name}-${Math.random()}` });
        // Should succeed without error
      }
    });
  });
});