/**
 * Agent Definition Parser - Production Validation Tests
 *
 * This test suite validates the agent parser against real production scenarios
 * and verifies that all existing agent files work correctly with the current
 * parser implementation.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  parseAgentMarkdown,
  loadAgents,
  AgentDefinitionSchema,
} from '@apexcli/core';

describe('Agent Definition Parser - Production Validation', () => {
  describe('Production Agent Files Validation', () => {
    const expectedAgents = [
      'architect.md',
      'developer.md',
      'reviewer.md',
      'tester.md',
      'devops.md',
      'planner.md',
      'tdd-developer.md',
      'tdd-tester.md',
      'verify.md',
      'regression-check.md'
    ];

    it('should successfully parse all production agent files', async () => {
      const productionAgentsDir = path.resolve('./.apex/agents');

      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        console.log(`📁 Found ${mdFiles.length} agent files in .apex/agents/`);

        for (const file of mdFiles) {
          const content = await fs.readFile(path.join(productionAgentsDir, file), 'utf-8');
          const agent = parseAgentMarkdown(content);

          expect(agent, `Failed to parse ${file}`).not.toBeNull();
          expect(agent?.name, `Missing name in ${file}`).toBeTruthy();
          expect(agent?.description, `Missing description in ${file}`).toBeTruthy();
          expect(agent?.prompt, `Missing prompt in ${file}`).toBeTruthy();

          // Validate schema compliance
          const schemaResult = AgentDefinitionSchema.safeParse(agent);
          expect(schemaResult.success, `Schema validation failed for ${file}: ${JSON.stringify(schemaResult.error?.issues)}`).toBe(true);
        }

        console.log(`✅ Successfully validated ${mdFiles.length} production agent files`);

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.warn('⚠️  Production agents directory not found - this is expected in some test environments');
          expect(true).toBe(true); // Test passes if directory doesn't exist
        } else {
          throw error;
        }
      }
    });

    it('should load all production agents via loadAgents function', async () => {
      const projectRoot = path.resolve('.');

      try {
        const agents = await loadAgents(projectRoot);
        const agentNames = Object.keys(agents);

        console.log(`🔄 Loaded ${agentNames.length} agents via loadAgents()`);
        console.log(`📋 Agent names: ${agentNames.join(', ')}`);

        // Verify we have a reasonable number of agents
        expect(agentNames.length).toBeGreaterThan(0);

        // Verify each loaded agent has required properties
        agentNames.forEach(name => {
          const agent = agents[name];
          expect(agent.name).toBe(name);
          expect(agent.description).toBeTruthy();
          expect(agent.prompt).toBeTruthy();
          expect(agent.model).toBeTruthy();
        });

        console.log(`✅ All ${agentNames.length} agents loaded successfully`);

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.warn('⚠️  No agents directory found - this is expected behavior');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Parser Implementation Validation', () => {
    it('should handle realistic agent definitions correctly', () => {
      const realisticAgent = `---
name: senior-developer
description: Implements complex features and maintains high code quality
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, LSP
model: sonnet
skills: debugging, performance-optimization, architecture-design
---

You are a senior software developer with expertise in multiple programming languages and frameworks. When implementing features:

1. **Code Quality**: Write clean, maintainable, well-documented code
2. **Testing**: Ensure comprehensive test coverage
3. **Performance**: Consider performance implications
4. **Security**: Follow security best practices
5. **Architecture**: Make sound architectural decisions

## Workflow

1. Analyze requirements thoroughly
2. Design the implementation approach
3. Write the code with proper error handling
4. Add comprehensive tests
5. Document the implementation
6. Review and refactor if needed

Always follow the existing code style and conventions in the project.`;

      const agent = parseAgentMarkdown(realisticAgent);

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('senior-developer');
      expect(agent?.description).toContain('complex features');
      expect(agent?.tools).toEqual(['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LSP']);
      expect(agent?.model).toBe('sonnet');
      expect(agent?.skills).toEqual(['debugging', 'performance-optimization', 'architecture-design']);
      expect(agent?.prompt).toContain('## Workflow');
      expect(agent?.prompt).toContain('Always follow the existing code style');
    });

    it('should handle edge case formatting that exists in production', () => {
      // Based on real agent files that might have formatting variations
      const edgeCaseAgent = `---
name: edge-case-agent
description: Agent with edge case formatting
tools: Read,Write,Bash
model: opus
---

You are an agent that tests edge cases.

Some common patterns:
- Bullet points
- Multiple paragraphs

And numbered lists:
1. First item
2. Second item

Code examples:
\`\`\`javascript
function example() {
  return "test";
}
\`\`\`

That's all!`;

      const agent = parseAgentMarkdown(edgeCaseAgent);

      expect(agent).not.toBeNull();
      expect(agent?.tools).toEqual(['Read', 'Write', 'Bash']); // Should handle no spaces after commas
      expect(agent?.prompt).toContain('```javascript');
      expect(agent?.prompt).toContain('function example()');
    });

    it('should validate parser robustness with different YAML styles', () => {
      const yamlVariations = [
        // Array style 1 - flow syntax
        `---
name: array-test-1
description: Test array formats
tools: [Read, Write, Bash]
skills: [debug, test]
---
Flow syntax test`,

        // Array style 2 - block syntax
        `---
name: array-test-2
description: Test array formats
tools:
  - Read
  - Write
  - Bash
skills:
  - debug
  - test
---
Block syntax test`,

        // Mixed quotes
        `---
name: "quoted-name"
description: 'Single quoted description'
tools: "Read,Write,Bash"
---
Mixed quotes test`
      ];

      yamlVariations.forEach((yaml, index) => {
        const agent = parseAgentMarkdown(yaml);
        expect(agent, `Variation ${index + 1} failed`).not.toBeNull();
        expect(agent?.name).toBeTruthy();
        expect(agent?.description).toBeTruthy();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle various malformed agent files gracefully', () => {
      const malformedCases = [
        // No frontmatter
        `This is just markdown content without any frontmatter.`,

        // Incomplete frontmatter
        `---
name: incomplete
`,

        // Invalid YAML
        `---
name: invalid
description: "Unclosed quote
tools: [malformed
---
Content`,

        // Empty frontmatter
        `---
---
Just content`,

        // Missing required fields
        `---
name: missing-desc
---
No description provided`
      ];

      malformedCases.forEach((content, index) => {
        const agent = parseAgentMarkdown(content);
        // All malformed cases should return null without throwing
        expect(agent, `Case ${index + 1} should return null`).toBeNull();
      });
    });

    it('should handle Unicode and special characters correctly', () => {
      const unicodeAgent = `---
name: unicode-agent
description: Agent with émojis 🚀 and special chars ñáéíóú
tools: Read, Write
---

你好! This is an agent that supports:
- Unicode characters: αβγδε
- Emojis: 🎯🔧🚀💻
- Special symbols: ©®™℠
- Accented characters: café, naïve, résumé

Всё должно работать правильно!`;

      const agent = parseAgentMarkdown(unicodeAgent);

      expect(agent).not.toBeNull();
      expect(agent?.description).toContain('émojis 🚀');
      expect(agent?.prompt).toContain('你好');
      expect(agent?.prompt).toContain('αβγδε');
      expect(agent?.prompt).toContain('Всё должно');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large agent definitions efficiently', () => {
      const largeSections = Array(100).fill(0).map((_, i) =>
        `## Section ${i + 1}\n\nThis is section ${i + 1} with detailed content about various aspects of the agent's behavior and capabilities.`
      ).join('\n\n');

      const largeAgent = `---
name: large-agent
description: Agent with very large prompt content
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

# Large Agent Prompt

This agent has extensive documentation and capabilities.

${largeSections}

## Final Section

This concludes the large agent definition.`;

      const startTime = performance.now();
      const agent = parseAgentMarkdown(largeAgent);
      const endTime = performance.now();
      const parseTime = endTime - startTime;

      expect(agent).not.toBeNull();
      expect(parseTime).toBeLessThan(100); // Should parse in under 100ms
      expect(agent?.prompt.length).toBeGreaterThan(10000);

      console.log(`⚡ Parsed large agent (${agent?.prompt.length} chars) in ${parseTime.toFixed(2)}ms`);
    });

    it('should validate current parser handles all known good patterns', () => {
      // Test patterns that are known to work in production
      const knownGoodPatterns = [
        // Standard agent
        {
          pattern: 'standard',
          content: `---
name: standard-agent
description: Standard production agent
tools: Read, Write
model: sonnet
---
Standard prompt content`
        },

        // Agent with all fields
        {
          pattern: 'complete',
          content: `---
name: complete-agent
description: Complete agent definition
tools: Read, Write, Edit, Bash
model: opus
skills: analysis, debugging
---
Complete prompt with all features`
        },

        // Minimal agent
        {
          pattern: 'minimal',
          content: `---
name: minimal-agent
description: Minimal agent
---
Minimal prompt`
        }
      ];

      knownGoodPatterns.forEach(({ pattern, content }) => {
        const agent = parseAgentMarkdown(content);
        expect(agent, `Pattern '${pattern}' should work`).not.toBeNull();
        expect(agent?.name).toContain('agent');

        // Validate schema compliance
        const schemaResult = AgentDefinitionSchema.safeParse(agent);
        expect(schemaResult.success, `Pattern '${pattern}' should pass schema validation`).toBe(true);
      });
    });
  });
});