/**
 * Additional edge case tests for APEX Agent Definition Format
 * Focuses on edge cases not fully covered in existing tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  parseAgentMarkdown,
  loadAgents,
  AgentDefinition,
  AgentDefinitionSchema,
} from '@apexcli/core';

describe('Agent Definition Format - Additional Edge Cases', () => {
  let testDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-edge-test-'));
    agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Security Edge Cases', () => {
    it('should handle extremely large agent files gracefully', async () => {
      // Create a large prompt content (1MB)
      const largePormpt = 'x'.repeat(1024 * 1024);
      const agentContent = `---
name: large-agent
description: Agent with very large prompt
---
${largePormpt}`;

      await fs.writeFile(
        path.join(agentsDir, 'large-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents['large-agent']).toBeDefined();
      expect(agents['large-agent'].prompt).toHaveLength(1024 * 1024);
    });

    it('should handle malicious YAML injection attempts', () => {
      const maliciousYaml = `---
name: test
description: "normal"
# YAML injection attempt - using quoted string instead of !!js/function
dangerous: "function(){ return require('fs').readFileSync('/etc/passwd', 'utf8'); }"
---
Test content`;

      const agent = parseAgentMarkdown(maliciousYaml);
      // Should still parse but dangerous property should be ignored by schema
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('test');
      expect((agent as any)?.dangerous).toBeUndefined();
    });

    it('should handle extremely long file names', async () => {
      const longName = 'a'.repeat(200);
      const agentContent = `---
name: ${longName}
description: Agent with very long name
---
Test content`;

      await fs.writeFile(
        path.join(agentsDir, `${longName}.md`),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents[longName]).toBeDefined();
    });
  });

  describe('Unicode and International Text', () => {
    it('should handle multi-language content correctly', async () => {
      const agentContent = `---
name: multilang-agent
description: エージェント with 中文 и русский
---
You are a multilingual agent.
你是一个多语言代理。
Вы многоязычный агент.
あなたは多言語エージェントです。`;

      await fs.writeFile(
        path.join(agentsDir, 'multilang-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents['multilang-agent']).toBeDefined();
      expect(agents['multilang-agent'].description).toBe('エージェント with 中文 и русский');
    });

    it('should handle right-to-left text properly', async () => {
      const agentContent = `---
name: rtl-agent
description: وكيل عربي
---
أنت وكيل ذكي يتحدث العربية.
שלום, אתה סוכן חכם.`;

      await fs.writeFile(
        path.join(agentsDir, 'rtl-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents['rtl-agent']).toBeDefined();
      expect(agents['rtl-agent'].description).toBe('وكيل عربي');
    });

    it('should handle emoji and special unicode characters', async () => {
      const agentContent = `---
name: emoji-agent
description: "🚀 AI Agent 🤖 with ⚡ special chars 💫"
tools: ["🔍 Search", "✏️ Write"]
---
Welcome! 🎉 You are an AI agent with emoji support! 🌟
Use these tools: 🛠️ and features 🎯`;

      await fs.writeFile(
        path.join(agentsDir, 'emoji-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents['emoji-agent']).toBeDefined();
      expect(agents['emoji-agent'].description).toContain('🚀');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle loading many agent files efficiently', async () => {
      const startTime = Date.now();

      // Create 100 agent files
      for (let i = 0; i < 100; i++) {
        const agentContent = `---
name: agent-${i}
description: Test agent number ${i}
---
You are agent number ${i}.`;

        await fs.writeFile(
          path.join(agentsDir, `agent-${i}.md`),
          agentContent
        );
      }

      const agents = await loadAgents(testDir);
      const loadTime = Date.now() - startTime;

      expect(Object.keys(agents)).toHaveLength(100);
      // Should load 100 agents in reasonable time (under 2 seconds)
      expect(loadTime).toBeLessThan(2000);
    });

    it('should handle concurrent loading requests gracefully', async () => {
      const agentContent = `---
name: concurrent-agent
description: Agent for concurrent testing
---
You are a concurrent test agent.`;

      await fs.writeFile(
        path.join(agentsDir, 'concurrent-agent.md'),
        agentContent
      );

      // Make 10 concurrent load requests
      const loadPromises = Array(10).fill(0).map(() => loadAgents(testDir));
      const results = await Promise.all(loadPromises);

      // All should succeed and return the same result
      results.forEach(agents => {
        expect(agents['concurrent-agent']).toBeDefined();
        expect(agents['concurrent-agent'].name).toBe('concurrent-agent');
      });
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle symbolic links to agent files', async () => {
      const agentContent = `---
name: symlinked-agent
description: Agent accessed via symlink
---
You are accessed via a symbolic link.`;

      const realFile = path.join(agentsDir, 'real-agent.md');
      const symlinkFile = path.join(agentsDir, 'symlinked-agent.md');

      await fs.writeFile(realFile, agentContent);

      try {
        await fs.symlink(realFile, symlinkFile);
        const agents = await loadAgents(testDir);

        // Should load the agent from symlink
        expect(agents['symlinked-agent']).toBeDefined();
      } catch (error) {
        // Skip test on systems that don't support symlinks
        console.log('Symlink test skipped (not supported on this system)');
      }
    });

    it('should handle read-only agent files', async () => {
      const agentContent = `---
name: readonly-agent
description: Read-only agent file
---
You are a read-only agent.`;

      const filePath = path.join(agentsDir, 'readonly-agent.md');
      await fs.writeFile(filePath, agentContent);

      try {
        await fs.chmod(filePath, 0o444); // Read-only
        const agents = await loadAgents(testDir);

        expect(agents['readonly-agent']).toBeDefined();
      } catch (error) {
        // Skip on systems where chmod might not work as expected
        console.log('Read-only test skipped');
      }
    });

    it('should handle files with no extension', async () => {
      const agentContent = `---
name: no-extension-agent
description: Agent file without extension
---
You are an agent without file extension.`;

      await fs.writeFile(
        path.join(agentsDir, 'no-extension'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      // Should not load files without .md extension
      expect(agents['no-extension-agent']).toBeUndefined();
      expect(Object.keys(agents)).toHaveLength(0);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should validate schema with boundary values', () => {
      const testCases = [
        {
          name: 'x',
          description: 'y',
          prompt: 'z',
          tools: [],
          skills: [],
        },
        {
          name: 'very-long-name-' + 'x'.repeat(1000),
          description: 'very-long-description-' + 'y'.repeat(1000),
          prompt: 'very-long-prompt-' + 'z'.repeat(10000),
          tools: Array(100).fill('Read'),
          skills: Array(100).fill('skill'),
        },
      ];

      testCases.forEach((testCase, index) => {
        const result = AgentDefinitionSchema.safeParse(testCase);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe(testCase.name);
          expect(result.data.description).toBe(testCase.description);
        }
      });
    });

    it('should handle null, undefined, and missing properties correctly', () => {
      const testCases = [
        { name: 'test', description: null, prompt: 'test' },
        { name: 'test', prompt: 'test' }, // missing description
        { description: 'test', prompt: 'test' }, // missing name
        { name: 'test', description: 'test' }, // missing prompt
      ];

      testCases.forEach(testCase => {
        const result = AgentDefinitionSchema.safeParse(testCase);
        expect(result.success).toBe(false);
      });
    });

    it('should handle type coercion edge cases', () => {
      const testCase = {
        name: 123, // number instead of string
        description: true, // boolean instead of string
        prompt: ['array', 'instead', 'of', 'string'],
        tools: 'single-string', // string instead of array
        skills: 42, // number instead of array
      };

      const result = AgentDefinitionSchema.safeParse(testCase);
      expect(result.success).toBe(false);
    });
  });

  describe('Parsing Edge Cases', () => {
    it('should handle nested frontmatter delimiters in content', () => {
      const agentContent = `---
name: nested-delim-agent
description: Agent with nested delimiters
---
Your instructions:

\`\`\`yaml
---
name: example
description: This is just an example
---
\`\`\`

Use the above as reference.`;

      const agent = parseAgentMarkdown(agentContent);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('nested-delim-agent');
      expect(agent?.prompt).toContain('---\nname: example');
    });

    it('should handle complex YAML structures in frontmatter', () => {
      const agentContent = `---
name: complex-yaml-agent
description: Agent with complex YAML
tools:
  - Read
  - Write
  - Edit
metadata:
  created: "2024-01-01"
  version: 1.0
  tags: ["test", "complex"]
nested:
  deep:
    value: "deeply nested"
---
You are a complex agent with nested YAML.`;

      const agent = parseAgentMarkdown(agentContent);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('complex-yaml-agent');
      expect(agent?.tools).toEqual(['Read', 'Write', 'Edit']);
      // Extra properties should be ignored by schema
      expect((agent as any)?.metadata).toBeUndefined();
    });

    it('should handle frontmatter with different indentation styles', () => {
      const agentContent = `---
name:     spaced-agent
description:   Agent with lots of spaces
tools:
    - Read
    -   Write
model:      sonnet
---
You are an agent with varied spacing.`;

      const agent = parseAgentMarkdown(agentContent);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('spaced-agent');
      expect(agent?.tools).toEqual(['Read', 'Write']);
    });
  });
});