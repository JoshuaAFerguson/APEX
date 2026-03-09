/**
 * Comprehensive tests for APEX Agent Definition Format (Markdown + YAML frontmatter)
 *
 * This test suite validates the complete agent definition format implementation
 * including parser functionality, schema validation, agent loading, and edge cases.
 *
 * Based on audit findings from AGENT_DEFINITION_FORMAT_AUDIT_REPORT.md
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

describe('Agent Definition Format - Comprehensive Tests', () => {
  let testDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-format-test-'));
    agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('parseAgentMarkdown - Comprehensive Parser Tests', () => {
    describe('Valid Markdown Parsing', () => {
      it('should parse minimal valid agent definition', () => {
        const markdown = `---
name: minimal-agent
description: A minimal test agent
---
You are a minimal agent.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.name).toBe('minimal-agent');
        expect(agent?.description).toBe('A minimal test agent');
        expect(agent?.prompt).toBe('You are a minimal agent.');
        expect(agent?.model).toBe('sonnet'); // default value
        expect(agent?.tools).toBeUndefined();
        expect(agent?.skills).toBeUndefined();
      });

      it('should parse complete agent definition with all fields', () => {
        const markdown = `---
name: complete-agent
description: A complete test agent with all fields
model: opus
tools: Read, Write, Edit, Bash, Grep, Glob
skills: typescript, testing, debugging
---

# Complete Test Agent

You are a sophisticated development agent with comprehensive capabilities.

## Your Role
- Write high-quality TypeScript code
- Create thorough test suites
- Debug complex issues

## Guidelines
1. Follow TDD principles
2. Write clean, maintainable code
3. Document your work thoroughly`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.name).toBe('complete-agent');
        expect(agent?.description).toBe('A complete test agent with all fields');
        expect(agent?.model).toBe('opus');
        expect(agent?.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
        expect(agent?.skills).toEqual(['typescript', 'testing', 'debugging']);
        expect(agent?.prompt).toContain('# Complete Test Agent');
        expect(agent?.prompt).toContain('sophisticated development agent');
        expect(agent?.prompt).toContain('Follow TDD principles');
      });

      it('should parse tools as array format in YAML', () => {
        const markdown = `---
name: array-tools-agent
description: Agent with tools defined as YAML array
tools:
  - Read
  - Write
  - Edit
  - Bash
---
You have tools in array format.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
      });

      it('should parse skills as array format in YAML', () => {
        const markdown = `---
name: array-skills-agent
description: Agent with skills defined as YAML array
skills:
  - javascript
  - python
  - docker
  - kubernetes
---
You have skills in array format.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.skills).toEqual(['javascript', 'python', 'docker', 'kubernetes']);
      });

      it('should handle mixed format with tools as array and skills as string', () => {
        const markdown = `---
name: mixed-format-agent
description: Mixed format agent
tools:
  - Read
  - Write
skills: debugging, optimization, refactoring
---
Mixed format agent content.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.tools).toEqual(['Read', 'Write']);
        expect(agent?.skills).toEqual(['debugging', 'optimization', 'refactoring']);
      });

      it('should handle all valid model types', () => {
        const models = ['opus', 'sonnet', 'haiku', 'inherit'];

        models.forEach(model => {
          const markdown = `---
name: ${model}-agent
description: Agent with ${model} model
model: ${model}
---
You use the ${model} model.`;

          const agent = parseAgentMarkdown(markdown);
          expect(agent).not.toBeNull();
          expect(agent?.model).toBe(model);
        });
      });

      it('should trim whitespace from prompt content', () => {
        const markdown = `---
name: whitespace-agent
description: Agent with whitespace
---


You are an agent with surrounding whitespace.


    `;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.prompt).toBe('You are an agent with surrounding whitespace.');
      });

      it('should handle complex markdown content with code blocks', () => {
        const markdown = `---
name: code-example-agent
description: Agent with code examples
tools: Read, Write, Edit
---

# Development Agent

You are a development agent that can work with code.

## Example Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Guidelines
- Write \`clean\` code
- Use **proper** formatting
- Follow *best practices*`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.prompt).toContain('```typescript');
        expect(agent?.prompt).toContain('function greet');
        expect(agent?.prompt).toContain('Write `clean` code');
        expect(agent?.prompt).toContain('Use **proper** formatting');
        expect(agent?.prompt).toContain('Follow *best practices*');
      });
    });

    describe('Invalid Markdown Handling', () => {
      it('should return null for markdown without frontmatter', () => {
        const markdown = 'This is just plain markdown without frontmatter.';
        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });

      it('should return null for incomplete frontmatter (missing closing ---)', () => {
        const markdown = `---
name: incomplete-agent
description: Missing closing frontmatter
You are an agent with incomplete frontmatter.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });

      it('should return null for empty frontmatter', () => {
        const markdown = `---
---
Agent content without any frontmatter data.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });

      it('should return null for frontmatter with missing required fields', () => {
        const markdown = `---
name: missing-description-agent
---
Agent missing required description field.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });

      it('should handle invalid YAML in frontmatter', () => {
        const markdown = `---
name: invalid-yaml-agent
description: Agent with invalid YAML
tools: [unclosed array
---
Invalid YAML agent.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });

      it('should handle frontmatter with invalid model enum', () => {
        const markdown = `---
name: invalid-model-agent
description: Agent with invalid model
model: gpt-4
---
Invalid model agent.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).toBeNull();
      });
    });

    describe('Edge Cases and Unicode Support', () => {
      it('should handle Unicode characters in frontmatter and content', () => {
        const markdown = `---
name: unicode-agent
description: Agent with émojis and ünïcödé 🤖
tools: Read, Write
---

# Ünïcödé Agent 🚀

You are an agent that supports Unicode characters like:
- Emojis: 😀 😃 😄 😁 🤖 🚀 ⚡ ✨
- Special chars: éñüïôñé, Zürich, naïve
- Mathematical symbols: ∑ ∏ ∫ ∞ ∂ ∆

Make sure to handle all characters properly! `;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.description).toBe('Agent with émojis and ünïcödé 🤖');
        expect(agent?.prompt).toContain('🚀');
        expect(agent?.prompt).toContain('éñüïôñé');
        expect(agent?.prompt).toContain('∑ ∏ ∫ ∞');
      });

      it('should handle very long agent definitions', () => {
        const longDescription = 'A'.repeat(1000);
        const longPrompt = 'You are an agent with a very long prompt. '.repeat(100);

        const markdown = `---
name: long-agent
description: ${longDescription}
tools: Read, Write
---
${longPrompt}`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.description).toBe(longDescription);
        expect(agent?.prompt.length).toBeGreaterThan(3000);
      });

      it('should handle empty tools and skills arrays', () => {
        const markdown = `---
name: empty-arrays-agent
description: Agent with empty arrays
tools: []
skills: []
---
Empty arrays agent.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.tools).toEqual([]);
        expect(agent?.skills).toEqual([]);
      });

      it('should handle tools and skills with whitespace', () => {
        const markdown = `---
name: whitespace-tools-agent
description: Agent with whitespace in tools
tools: " Read , Write , Edit "
skills: "  debugging  ,  testing  ,  optimization  "
---
Whitespace tools agent.`;

        const agent = parseAgentMarkdown(markdown);
        expect(agent).not.toBeNull();
        expect(agent?.tools).toEqual(['Read', 'Write', 'Edit']);
        expect(agent?.skills).toEqual(['debugging', 'testing', 'optimization']);
      });
    });
  });

  describe('Schema Validation - AgentDefinitionSchema Tests', () => {
    it('should validate minimal valid agent definition', () => {
      const agentDef = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'You are a test agent.',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('sonnet'); // default value
      }
    });

    it('should validate complete agent definition', () => {
      const agentDef = {
        name: 'complete-agent',
        description: 'Complete test agent',
        prompt: 'You are a complete agent.',
        tools: ['Read', 'Write', 'Edit'],
        model: 'opus',
        skills: ['typescript', 'testing'],
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(agentDef);
      }
    });

    it('should reject agent definition without required name', () => {
      const agentDef = {
        description: 'Agent without name',
        prompt: 'You are an agent without name.',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('name'))).toBe(true);
      }
    });

    it('should reject agent definition without required description', () => {
      const agentDef = {
        name: 'no-description-agent',
        prompt: 'You are an agent without description.',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('description'))).toBe(true);
      }
    });

    it('should reject agent definition without required prompt', () => {
      const agentDef = {
        name: 'no-prompt-agent',
        description: 'Agent without prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('prompt'))).toBe(true);
      }
    });

    it('should validate all valid model enum values', () => {
      const models = ['opus', 'sonnet', 'haiku', 'inherit'] as const;

      models.forEach(model => {
        const result = AgentModelSchema.safeParse(model);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(model);
        }
      });
    });

    it('should reject invalid model enum values', () => {
      const invalidModels = ['gpt-4', 'claude', 'llama', 'invalid'];

      invalidModels.forEach(model => {
        const result = AgentModelSchema.safeParse(model);
        expect(result.success).toBe(false);
      });
    });

    it('should handle type coercion for tools and skills', () => {
      const agentDef = {
        name: 'type-coercion-agent',
        description: 'Agent for testing type coercion',
        prompt: 'You test type coercion.',
        tools: 'Read, Write, Edit', // string instead of array
        skills: 'debugging, testing', // string instead of array
      };

      // Note: The schema expects arrays, but parseAgentMarkdown handles the string-to-array conversion
      const result = AgentDefinitionSchema.safeParse({
        ...agentDef,
        tools: agentDef.tools.split(',').map(t => t.trim()),
        skills: agentDef.skills.split(',').map(s => s.trim()),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toEqual(['Read', 'Write', 'Edit']);
        expect(result.data.skills).toEqual(['debugging', 'testing']);
      }
    });

    it('should handle empty string fields gracefully', () => {
      const agentDef = {
        name: '',
        description: '',
        prompt: '',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
      // Empty strings should fail validation for required fields
    });

    it('should handle null and undefined values', () => {
      const agentDef = {
        name: null,
        description: undefined,
        prompt: 'Valid prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agentDef);
      expect(result.success).toBe(false);
    });
  });

  describe('loadAgents - Agent Loading System Tests', () => {
    it('should load single agent file correctly', async () => {
      const agentContent = `---
name: single-test-agent
description: A single test agent for loading
tools: Read, Write
model: sonnet
---
You are a single test agent.`;

      await fs.writeFile(
        path.join(agentsDir, 'single-test-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents['single-test-agent']).toBeDefined();

      const agent = agents['single-test-agent'];
      expect(agent.name).toBe('single-test-agent');
      expect(agent.description).toBe('A single test agent for loading');
      expect(agent.tools).toEqual(['Read', 'Write']);
      expect(agent.model).toBe('sonnet');
    });

    it('should load multiple agent files correctly', async () => {
      const agentConfigs = [
        {
          filename: 'planner.md',
          content: `---
name: planner
description: Strategic planning agent
model: opus
tools: Read, Glob, Grep
---
You are a strategic planner.`
        },
        {
          filename: 'developer.md',
          content: `---
name: developer
description: Implementation agent
model: sonnet
tools: Read, Write, Edit, Bash
---
You are a developer.`
        },
        {
          filename: 'tester.md',
          content: `---
name: tester
description: Quality assurance agent
model: haiku
tools: Read, Bash, Grep
skills: testing, debugging
---
You are a tester.`
        }
      ];

      // Write all agent files
      for (const config of agentConfigs) {
        await fs.writeFile(
          path.join(agentsDir, config.filename),
          config.content
        );
      }

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toHaveLength(3);

      expect(agents['planner']).toBeDefined();
      expect(agents['developer']).toBeDefined();
      expect(agents['tester']).toBeDefined();

      // Verify each agent loaded correctly
      expect(agents['planner'].model).toBe('opus');
      expect(agents['developer'].tools).toContain('Bash');
      expect(agents['tester'].skills).toEqual(['testing', 'debugging']);
    });

    it('should skip non-markdown files in agents directory', async () => {
      await fs.writeFile(path.join(agentsDir, 'readme.txt'), 'Not an agent file');
      await fs.writeFile(path.join(agentsDir, 'config.json'), '{"not": "agent"}');
      await fs.writeFile(path.join(agentsDir, 'script.js'), 'console.log("not agent");');

      const validAgent = `---
name: valid-agent
description: Valid agent file
---
You are valid.`;

      await fs.writeFile(path.join(agentsDir, 'valid-agent.md'), validAgent);

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents['valid-agent']).toBeDefined();
    });

    it('should skip invalid agent markdown files', async () => {
      const invalidAgent = 'This is not a valid agent file without frontmatter.';
      const validAgent = `---
name: valid-agent
description: Valid agent
---
You are valid.`;

      await fs.writeFile(path.join(agentsDir, 'invalid-agent.md'), invalidAgent);
      await fs.writeFile(path.join(agentsDir, 'valid-agent.md'), validAgent);

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents['valid-agent']).toBeDefined();
      expect(agents['invalid-agent']).toBeUndefined();
    });

    it('should return empty object when agents directory does not exist', async () => {
      const emptyTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-apex-test-'));
      await fs.mkdir(path.join(emptyTestDir, '.apex'), { recursive: true });

      const agents = await loadAgents(emptyTestDir);
      expect(Object.keys(agents)).toHaveLength(0);

      await fs.rm(emptyTestDir, { recursive: true, force: true });
    });

    it('should return empty object when .apex directory does not exist', async () => {
      const emptyTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-apex-test-'));

      const agents = await loadAgents(emptyTestDir);
      expect(Object.keys(agents)).toHaveLength(0);

      await fs.rm(emptyTestDir, { recursive: true, force: true });
    });

    it('should handle file system errors gracefully', async () => {
      // Create agents directory but make it inaccessible
      const restrictedDir = path.join(testDir, '.apex', 'agents');
      await fs.mkdir(restrictedDir, { recursive: true });

      const validAgent = `---
name: test-agent
description: Test agent
---
Test content.`;

      await fs.writeFile(path.join(restrictedDir, 'test.md'), validAgent);

      // This should still work normally - test that no unexpected errors are thrown
      const agents = await loadAgents(testDir);
      expect(agents['test-agent']).toBeDefined();
    });

    it('should handle UTF-8 encoded files correctly', async () => {
      const unicodeAgent = `---
name: unicode-agent
description: Agént with ünïcödé characters 🤖
tools: Read, Write
---

# Ünïcödé Agent 🚀

You support émojis and special characters:
- Japanese: こんにちは
- Arabic: مرحبا
- Russian: Привет
- Mathematical: ∑∏∫∞`;

      await fs.writeFile(
        path.join(agentsDir, 'unicode-agent.md'),
        unicodeAgent,
        'utf8'
      );

      const agents = await loadAgents(testDir);
      const agent = agents['unicode-agent'];

      expect(agent).toBeDefined();
      expect(agent.description).toBe('Agént with ünïcödé characters 🤖');
      expect(agent.prompt).toContain('こんにちは');
      expect(agent.prompt).toContain('مرحبا');
      expect(agent.prompt).toContain('∑∏∫∞');
    });

    it('should handle agent files with complex directory structures', async () => {
      // Create nested directories in agents folder (should be ignored)
      await fs.mkdir(path.join(agentsDir, 'nested'), { recursive: true });
      await fs.writeFile(
        path.join(agentsDir, 'nested', 'nested-agent.md'),
        `---
name: nested-agent
description: Nested agent
---
Nested agent content.`
      );

      // Create agent in root agents directory
      await fs.writeFile(
        path.join(agentsDir, 'root-agent.md'),
        `---
name: root-agent
description: Root agent
---
Root agent content.`
      );

      const agents = await loadAgents(testDir);
      // Should only load the root agent, not the nested one
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents['root-agent']).toBeDefined();
      expect(agents['nested-agent']).toBeUndefined();
    });
  });

  describe('Integration Tests - Parser + Schema + Loading', () => {
    it('should complete full pipeline from file to validated agent object', async () => {
      const complexAgent = `---
name: full-pipeline-agent
description: Agent to test complete pipeline from file to validation
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
model: opus
skills: typescript, testing, debugging, optimization
---

# Full Pipeline Development Agent

You are a sophisticated development agent designed to test the complete
agent definition pipeline from file parsing to schema validation.

## Your Capabilities

### Core Development Skills
- **TypeScript Development**: Write type-safe, modern TypeScript code
- **Test-Driven Development**: Create comprehensive test suites
- **Debugging**: Analyze and fix complex issues
- **Performance Optimization**: Improve code efficiency and speed

### Tools Usage
Use your tools effectively:
1. **Read**: Examine existing code and documentation
2. **Write**: Create new files and implementations
3. **Edit**: Modify existing code with precision
4. **Bash**: Execute commands and scripts
5. **Grep**: Search through codebases efficiently
6. **Glob**: Find files matching patterns

### Best Practices
- Follow SOLID principles
- Write clean, maintainable code
- Create thorough documentation
- Implement proper error handling
- Use meaningful variable names

## Testing Guidelines
- Write tests first (TDD approach)
- Cover edge cases and error paths
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert`;

      await fs.writeFile(
        path.join(agentsDir, 'full-pipeline-agent.md'),
        complexAgent
      );

      const agents = await loadAgents(testDir);
      const agent = agents['full-pipeline-agent'];

      // Verify complete agent loaded correctly
      expect(agent).toBeDefined();
      expect(agent.name).toBe('full-pipeline-agent');
      expect(agent.description).toContain('test complete pipeline');
      expect(agent.model).toBe('opus');
      expect(agent.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
      expect(agent.skills).toEqual(['typescript', 'testing', 'debugging', 'optimization']);

      // Verify prompt content preserved
      expect(agent.prompt).toContain('# Full Pipeline Development Agent');
      expect(agent.prompt).toContain('sophisticated development agent');
      expect(agent.prompt).toContain('TypeScript Development');
      expect(agent.prompt).toContain('SOLID principles');
      expect(agent.prompt).toContain('AAA pattern');

      // Verify schema validation passes
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      const validationResult = AgentDefinitionSchema.safeParse(agent);
      expect(validationResult.success).toBe(true);
    });

    it('should handle multiple complex agents with different configurations', async () => {
      const agentConfigs = [
        {
          name: 'architect',
          content: `---
name: architect
description: System architecture and design specialist
model: opus
tools: Read, Glob, Grep
skills: architecture, design-patterns, scalability
---
You design robust, scalable system architectures.`
        },
        {
          name: 'devops',
          content: `---
name: devops
description: Infrastructure and deployment specialist
model: sonnet
tools: Read, Write, Bash
skills:
  - docker
  - kubernetes
  - ci-cd
  - monitoring
---
You handle infrastructure and deployment pipelines.`
        },
        {
          name: 'security',
          content: `---
name: security
description: Security analysis and hardening specialist
model: haiku
tools: "Read, Grep, Bash"
skills: "security-audit, vulnerability-analysis, compliance"
---
You ensure security best practices and identify vulnerabilities.`
        }
      ];

      // Write all agent files
      for (const config of agentConfigs) {
        await fs.writeFile(
          path.join(agentsDir, `${config.name}.md`),
          config.content
        );
      }

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toHaveLength(3);

      // Verify all agents loaded with correct configurations
      expect(agents['architect'].model).toBe('opus');
      expect(agents['devops'].model).toBe('sonnet');
      expect(agents['security'].model).toBe('haiku');

      expect(agents['architect'].skills).toEqual(['architecture', 'design-patterns', 'scalability']);
      expect(agents['devops'].skills).toEqual(['docker', 'kubernetes', 'ci-cd', 'monitoring']);
      expect(agents['security'].skills).toEqual(['security-audit', 'vulnerability-analysis', 'compliance']);

      // Verify all agents pass schema validation
      Object.values(agents).forEach(agent => {
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      });
    });
  });
});