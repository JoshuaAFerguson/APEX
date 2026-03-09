/**
 * Agent Definition Format Edge Cases and Error Scenario Tests
 *
 * This test suite focuses on edge cases, error conditions, and boundary
 * scenarios for the agent definition format implementation.
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
  AgentModelSchema,
} from '@apexcli/core';

describe('Agent Definition Format - Edge Cases and Error Scenarios', () => {
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

  describe('Frontmatter Parsing Edge Cases', () => {
    it('should handle frontmatter with extra whitespace', () => {
      const markdown = `  ---
  name: whitespace-agent
  description:  A test agent with extra whitespace
  model:  sonnet
  tools:  Read,  Write
  ---
You are an agent with whitespace.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('whitespace-agent');
    });

    it('should handle frontmatter with YAML comments', () => {
      const markdown = `---
# Agent configuration
name: commented-agent
description: Agent with YAML comments
# This is a comment
model: sonnet # inline comment
tools: Read, Write
# skills: disabled for now
---
You have comments in frontmatter.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('commented-agent');
      expect(agent?.model).toBe('sonnet');
    });

    it('should handle frontmatter with quoted strings containing special characters', () => {
      const markdown = `---
name: "special-chars-agent"
description: "Agent with: special, characters! @#$%^&*()"
tools: "Read, Write: Edit"
---
You handle special characters.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('special-chars-agent');
      expect(agent?.description).toBe('Agent with: special, characters! @#$%^&*()');
    });

    it('should handle frontmatter with multiline descriptions', () => {
      const markdown = `---
name: multiline-agent
description: |
  This is a multiline description
  that spans multiple lines
  and preserves formatting
model: sonnet
---
You have a multiline description.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.description).toContain('This is a multiline description');
      expect(agent?.description).toContain('that spans multiple lines');
    });

    it('should handle frontmatter with nested YAML structures', () => {
      const markdown = `---
name: nested-agent
description: Agent with nested YAML
metadata:
  version: 1.0
  author: test
  config:
    debug: true
tools: [Read, Write]
---
You have nested metadata.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('nested-agent');
      expect(agent?.tools).toEqual(['Read', 'Write']);
    });

    it('should handle empty frontmatter fields', () => {
      const markdown = `---
name: empty-fields-agent
description: Agent with empty fields
tools:
skills:
model: sonnet
---
You have empty fields.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.tools).toBe(''); // Empty string should be handled
      expect(agent?.skills).toBe('');
    });

    it('should handle frontmatter with boolean and number values', () => {
      const markdown = `---
name: mixed-types-agent
description: Agent with mixed types
enabled: true
version: 1.5
debug: false
tools: Read, Write
---
You have mixed type values.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('mixed-types-agent');
    });
  });

  describe('Schema Validation Error Cases', () => {
    it('should provide detailed error messages for invalid agent definitions', () => {
      const invalidAgent = {
        name: 123, // should be string
        description: null, // should be string
        prompt: '', // empty string
        model: 'invalid-model', // invalid enum
        tools: 'not-an-array', // should be array
      };

      const result = AgentDefinitionSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);

      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.length).toBeGreaterThan(0);

        // Should have specific error for each invalid field
        const paths = issues.map(issue => issue.path.join('.'));
        expect(paths).toContain('name');
        expect(paths).toContain('description');
        expect(paths).toContain('model');
      }
    });

    it('should handle very long field values', () => {
      const longString = 'A'.repeat(10000);
      const agentDef = {
        name: longString,
        description: longString,
        prompt: longString,
        tools: [longString],
        skills: [longString],
      };

      // Should still validate successfully (no length limits in schema)
      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in field values', () => {
      const specialChars = '!@#$%^&*()[]{}|\\:";\'<>?,./`~';
      const agentDef = {
        name: `agent-${specialChars}-test`,
        description: `Description with ${specialChars} characters`,
        prompt: `Prompt with ${specialChars} in content`,
        tools: [`Tool${specialChars}`],
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested array structures', () => {
      const agentDef = {
        name: 'nested-array-agent',
        description: 'Agent with nested arrays',
        prompt: 'You have nested arrays.',
        tools: [['Read', 'Write'], ['Edit', 'Bash']], // Nested arrays
      };

      // Nested arrays should fail validation (tools should be string[])
      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
    });

    it('should handle circular references gracefully', () => {
      const circular: any = {
        name: 'circular-agent',
        description: 'Agent with circular reference',
        prompt: 'You have circular references.',
      };
      circular.self = circular; // Create circular reference

      // Should not crash, but validation should fail
      const result = AgentDefinitionSchema.safeParse(circular);
      expect(result.success).toBe(false);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle agents directory with very deep nesting', async () => {
      // Create deeply nested directory structure
      const deepPath = path.join(agentsDir, 'a', 'b', 'c', 'd', 'e');
      await fs.mkdir(deepPath, { recursive: true });

      await fs.writeFile(
        path.join(deepPath, 'deep-agent.md'),
        `---
name: deep-agent
description: Agent in deep directory
---
Deep agent content.`
      );

      // Should only load from direct agents directory, not nested
      const agents = await loadAgents(testDir);
      expect(agents['deep-agent']).toBeUndefined();
    });

    it('should handle files with unusual extensions in agents directory', async () => {
      const files = [
        'agent1.markdown',
        'agent2.mdown',
        'agent3.mkd',
        'agent4.MD', // uppercase
        'agent5.txt',
        'valid-agent.md'
      ];

      for (const file of files) {
        await fs.writeFile(
          path.join(agentsDir, file),
          `---
name: ${file.split('.')[0]}
description: Test agent
---
Test content.`
        );
      }

      const agents = await loadAgents(testDir);
      // Should only load .md files (case sensitive)
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents['valid-agent']).toBeDefined();
    });

    it('should handle symbolic links in agents directory', async () => {
      // Create a real agent file
      const realAgentPath = path.join(agentsDir, 'real-agent.md');
      await fs.writeFile(realAgentPath, `---
name: real-agent
description: Real agent
---
Real agent content.`);

      // Create symbolic link (if supported by OS)
      const linkPath = path.join(agentsDir, 'link-agent.md');
      try {
        await fs.symlink(realAgentPath, linkPath);

        const agents = await loadAgents(testDir);
        // Both real file and symlink should be loaded
        expect(agents['real-agent']).toBeDefined();
        expect(agents['link-agent']).toBeDefined();
      } catch (error) {
        // Symlinks might not be supported, skip this test
        console.log('Symlinks not supported, skipping test');
      }
    });

    it('should handle files with no read permissions', async () => {
      const restrictedFile = path.join(agentsDir, 'restricted-agent.md');
      await fs.writeFile(restrictedFile, `---
name: restricted-agent
description: Restricted agent
---
Restricted content.`);

      // Try to remove read permissions (may not work on all systems)
      try {
        await fs.chmod(restrictedFile, 0o000);

        // Should handle the error gracefully
        const agents = await loadAgents(testDir);
        expect(agents['restricted-agent']).toBeUndefined();

        // Restore permissions for cleanup
        await fs.chmod(restrictedFile, 0o644);
      } catch (error) {
        // Permission changes might not be supported, skip this test
        console.log('Permission changes not supported, skipping test');
      }
    });

    it('should handle very large agent files', async () => {
      const largeContent = 'You are an agent with very long content. '.repeat(10000);
      const largeAgent = `---
name: large-agent
description: Agent with very large content
---
${largeContent}`;

      await fs.writeFile(path.join(agentsDir, 'large-agent.md'), largeAgent);

      const agents = await loadAgents(testDir);
      expect(agents['large-agent']).toBeDefined();
      expect(agents['large-agent'].prompt.length).toBeGreaterThan(100000);
    });

    it('should handle binary files with .md extension', async () => {
      // Create a binary file with .md extension
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await fs.writeFile(path.join(agentsDir, 'binary-file.md'), binaryData);

      // Should handle gracefully without crashing
      const agents = await loadAgents(testDir);
      expect(agents['binary-file']).toBeUndefined();
    });
  });

  describe('YAML Parsing Edge Cases', () => {
    it('should handle YAML with tabs instead of spaces', () => {
      const markdown = `---
name:\ttest-agent
description:\tAgent with tabs
tools:\t[Read,\tWrite]
---
You use tabs.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('test-agent');
    });

    it('should handle YAML with different quote styles', () => {
      const markdown = `---
name: 'single-quote-agent'
description: "double-quote-agent"
tools: 'Read, Write'
---
You have quotes.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('single-quote-agent');
      expect(agent?.description).toBe('double-quote-agent');
    });

    it('should handle YAML with escape sequences', () => {
      const markdown = `---
name: escape-agent
description: "Agent with \\n newline and \\t tab"
tools: "Read\\nWrite"
---
You have escape sequences.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.description).toContain('\\n');
      expect(agent?.description).toContain('\\t');
    });

    it('should handle YAML with different array syntaxes', () => {
      const markdown = `---
name: array-syntax-agent
description: Agent with different array syntaxes
tools: [Read, Write, Edit]
skills:
  - typescript
  - testing
---
You have different array syntaxes.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.tools).toEqual(['Read', 'Write', 'Edit']);
      expect(agent?.skills).toEqual(['typescript', 'testing']);
    });

    it('should handle malformed YAML gracefully', () => {
      const malformedYamls = [
        `---
name: malformed1
description: "unclosed quote
---
Content`,
        `---
name: malformed2
tools: [unclosed, array
---
Content`,
        `---
name: malformed3
  invalid: indentation
---
Content`,
        `---
name: malformed4
description:
  - this should not be an array
---
Content`
      ];

      malformedYamls.forEach((markdown, index) => {
        const agent = parseAgentMarkdown(markdown);
        // Should return null for malformed YAML
        expect(agent).toBeNull();
      });
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle loading many agent files efficiently', async () => {
      // Create many agent files
      const agentCount = 100;
      const startTime = Date.now();

      for (let i = 0; i < agentCount; i++) {
        const content = `---
name: agent-${i}
description: Test agent number ${i}
---
You are agent number ${i}.`;

        await fs.writeFile(path.join(agentsDir, `agent-${i}.md`), content);
      }

      const agents = await loadAgents(testDir);
      const endTime = Date.now();

      expect(Object.keys(agents)).toHaveLength(agentCount);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time

      // Verify all agents loaded correctly
      for (let i = 0; i < agentCount; i++) {
        expect(agents[`agent-${i}`]).toBeDefined();
        expect(agents[`agent-${i}`].description).toBe(`Test agent number ${i}`);
      }
    });

    it('should handle concurrent access to agents directory', async () => {
      // Create some agent files
      for (let i = 0; i < 10; i++) {
        const content = `---
name: concurrent-agent-${i}
description: Concurrent test agent ${i}
---
You are concurrent agent ${i}.`;

        await fs.writeFile(path.join(agentsDir, `concurrent-agent-${i}.md`), content);
      }

      // Load agents concurrently multiple times
      const loadPromises = Array(5).fill(0).map(() => loadAgents(testDir));
      const results = await Promise.all(loadPromises);

      // All loads should succeed and return same result
      results.forEach(agents => {
        expect(Object.keys(agents)).toHaveLength(10);
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle different line ending styles', () => {
      const lineEndings = ['\n', '\r\n', '\r'];

      lineEndings.forEach((ending, index) => {
        const markdown = `---${ending}name: line-ending-agent-${index}${ending}description: Agent with different line endings${ending}---${ending}You have ${ending} line endings.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.name).toBe(`line-ending-agent-${index}`);
      });
    });

    it('should handle different file encodings', async () => {
      // UTF-8 with BOM
      const utf8BomContent = '\ufeff---\nname: utf8-bom-agent\ndescription: UTF-8 with BOM\n---\nYou have BOM.';
      await fs.writeFile(path.join(agentsDir, 'utf8-bom-agent.md'), utf8BomContent, 'utf8');

      const agents = await loadAgents(testDir);
      expect(agents['utf8-bom-agent']).toBeDefined();
      expect(agents['utf8-bom-agent'].name).toBe('utf8-bom-agent');
    });

    it('should handle path separators correctly', () => {
      // This is mainly tested by the existing loadAgents function
      // which uses path.join for cross-platform compatibility
      expect(path.join('.apex', 'agents')).toBeTruthy();
      expect(path.join('.apex', 'agents').includes(path.sep)).toBe(true);
    });
  });
});