/**
 * Agent Frontmatter Schema Validation Tests
 *
 * This test suite focuses specifically on the YAML frontmatter schema validation
 * for agent definitions, testing all possible field combinations, validation rules,
 * and edge cases in the AgentDefinitionSchema.
 */

import { describe, it, expect } from 'vitest';
import {
  parseAgentMarkdown,
  AgentDefinitionSchema,
  AgentModelSchema,
  AgentDefinition
} from '@apexcli/core';

describe('Agent Frontmatter Schema Validation', () => {
  describe('Required Field Validation', () => {
    it('should require name field', () => {
      const agentWithoutName = {
        description: 'Agent without name',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agentWithoutName);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toContain('name');
    });

    it('should require description field', () => {
      const agentWithoutDescription = {
        name: 'test-agent',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agentWithoutDescription);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toContain('description');
    });

    it('should require prompt field', () => {
      const agentWithoutPrompt = {
        name: 'test-agent',
        description: 'Test agent',
      };

      const result = AgentDefinitionSchema.safeParse(agentWithoutPrompt);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toContain('prompt');
    });

    it('should accept minimal valid agent with required fields only', () => {
      const minimalAgent = {
        name: 'minimal-agent',
        description: 'Minimal test agent',
        prompt: 'You are a minimal agent.',
      };

      const result = AgentDefinitionSchema.safeParse(minimalAgent);
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe('sonnet'); // Default value
    });
  });

  describe('Model Field Validation', () => {
    const validModels = ['opus', 'sonnet', 'haiku', 'inherit'];

    validModels.forEach(model => {
      it(`should accept valid model: ${model}`, () => {
        const agent = {
          name: 'model-test-agent',
          description: 'Agent for model testing',
          prompt: 'Test prompt',
          model,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(true);
        expect(result.data?.model).toBe(model);
      });
    });

    it('should reject invalid model values', () => {
      const invalidModels = ['gpt4', 'claude', 'invalid', '', 123];

      invalidModels.forEach(model => {
        const agent = {
          name: 'invalid-model-agent',
          description: 'Agent with invalid model',
          prompt: 'Test prompt',
          model,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });

    it('should default to sonnet when model is not specified', () => {
      const agent = {
        name: 'default-model-agent',
        description: 'Agent with default model',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe('sonnet');
    });
  });

  describe('Tools Field Validation', () => {
    it('should accept valid string array for tools', () => {
      const agent = {
        name: 'tools-agent',
        description: 'Agent with tools',
        prompt: 'Test prompt',
        tools: ['Read', 'Write', 'Edit', 'Bash'],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
    });

    it('should accept empty array for tools', () => {
      const agent = {
        name: 'empty-tools-agent',
        description: 'Agent with empty tools',
        prompt: 'Test prompt',
        tools: [],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.tools).toEqual([]);
    });

    it('should accept undefined tools (optional field)', () => {
      const agent = {
        name: 'no-tools-agent',
        description: 'Agent without tools',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.tools).toBeUndefined();
    });

    it('should reject non-string array values for tools', () => {
      const invalidTools = [
        'string-not-array',
        123,
        null,
        { tool: 'object' },
        [123, 456], // Numbers in array
        ['Read', 123], // Mixed types
      ];

      invalidTools.forEach(tools => {
        const agent = {
          name: 'invalid-tools-agent',
          description: 'Agent with invalid tools',
          prompt: 'Test prompt',
          tools,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Skills Field Validation', () => {
    it('should accept valid string array for skills', () => {
      const agent = {
        name: 'skills-agent',
        description: 'Agent with skills',
        prompt: 'Test prompt',
        skills: ['typescript', 'testing', 'debugging'],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.skills).toEqual(['typescript', 'testing', 'debugging']);
    });

    it('should accept empty array for skills', () => {
      const agent = {
        name: 'empty-skills-agent',
        description: 'Agent with empty skills',
        prompt: 'Test prompt',
        skills: [],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.skills).toEqual([]);
    });

    it('should accept undefined skills (optional field)', () => {
      const agent = {
        name: 'no-skills-agent',
        description: 'Agent without skills',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.skills).toBeUndefined();
    });

    it('should reject non-string array values for skills', () => {
      const invalidSkills = [
        'string-not-array',
        123,
        null,
        { skill: 'object' },
        [123, 456], // Numbers in array
        ['typescript', 123], // Mixed types
      ];

      invalidSkills.forEach(skills => {
        const agent = {
          name: 'invalid-skills-agent',
          description: 'Agent with invalid skills',
          prompt: 'Test prompt',
          skills,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Field Type Validation', () => {
    it('should require name to be a string', () => {
      const invalidNames = [123, null, undefined, [], {}];

      invalidNames.forEach(name => {
        const agent = {
          name,
          description: 'Test description',
          prompt: 'Test prompt',
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });

    it('should require description to be a string', () => {
      const invalidDescriptions = [123, null, undefined, [], {}];

      invalidDescriptions.forEach(description => {
        const agent = {
          name: 'test-agent',
          description,
          prompt: 'Test prompt',
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });

    it('should require prompt to be a string', () => {
      const invalidPrompts = [123, null, undefined, [], {}];

      invalidPrompts.forEach(prompt => {
        const agent = {
          name: 'test-agent',
          description: 'Test description',
          prompt,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });

    it('should accept empty strings for required fields', () => {
      const agent = {
        name: '',
        description: '',
        prompt: '',
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
    });
  });

  describe('Complete Agent Definition Validation', () => {
    it('should validate complex agent with all fields', () => {
      const complexAgent = {
        name: 'complex-test-agent',
        description: 'Complex agent with all fields defined',
        prompt: 'You are a complex agent with comprehensive configuration.',
        model: 'opus',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        skills: ['typescript', 'react', 'testing', 'debugging', 'architecture'],
      };

      const result = AgentDefinitionSchema.safeParse(complexAgent);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(complexAgent);
    });

    it('should strip unknown properties from agent definition', () => {
      const agentWithExtra = {
        name: 'extra-props-agent',
        description: 'Agent with extra properties',
        prompt: 'Test prompt',
        model: 'sonnet',
        // Unknown properties
        version: '1.0.0',
        author: 'test-author',
        config: { setting: 'value' },
      };

      const result = AgentDefinitionSchema.safeParse(agentWithExtra);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('extra-props-agent');
      expect(result.data?.model).toBe('sonnet');
      // Unknown properties should be stripped
      expect((result.data as any).version).toBeUndefined();
      expect((result.data as any).author).toBeUndefined();
      expect((result.data as any).config).toBeUndefined();
    });
  });

  describe('Integration with Markdown Parser', () => {
    it('should validate parsed agent from valid markdown', () => {
      const markdown = `---
name: integration-test-agent
description: Agent for integration testing
model: opus
tools: Read, Write, Edit
skills: integration, testing
---

# Integration Test Agent

You are an agent used for integration testing between the markdown parser
and the schema validation system.

## Tools
- Read files
- Write content
- Edit existing files

## Skills
- Integration testing
- System validation`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();

      // Validate against schema
      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('integration-test-agent');
      expect(result.data?.model).toBe('opus');
      expect(result.data?.tools).toEqual(['Read', 'Write', 'Edit']);
      expect(result.data?.skills).toEqual(['integration', 'testing']);
    });

    it('should reject agent with invalid markdown structure', () => {
      const invalidMarkdown = `---
name: "unclosed quote
description: Invalid YAML structure
---
This markdown has invalid YAML.`;

      const agent = parseAgentMarkdown(invalidMarkdown);
      expect(agent).toBeNull();
    });

    it('should handle tools parsing from comma-separated strings', () => {
      const markdown = `---
name: comma-separated-agent
description: Agent with comma-separated tools
tools: "Read, Write, Edit, Bash"
skills: "javascript, typescript, node.js"
---
Tools and skills as comma-separated strings.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
      expect(agent?.skills).toEqual(['javascript', 'typescript', 'node.js']);

      // Validate against schema
      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
    });

    it('should handle tools and skills with extra whitespace', () => {
      const markdown = `---
name: whitespace-test-agent
description: Agent with whitespace in tools/skills
tools: " Read , Write , Edit "
skills: " javascript , typescript "
---
Tools with extra whitespace.`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent?.tools).toEqual(['Read', 'Write', 'Edit']); // Should be trimmed
      expect(agent?.skills).toEqual(['javascript', 'typescript']);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very long field values', () => {
      const longName = 'a'.repeat(1000);
      const longDescription = 'b'.repeat(10000);
      const longPrompt = 'c'.repeat(50000);

      const agent = {
        name: longName,
        description: longDescription,
        prompt: longPrompt,
      };

      const startTime = process.hrtime.bigint();
      const result = AgentDefinitionSchema.safeParse(agent);
      const endTime = process.hrtime.bigint();

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(longName);
      expect(result.data?.description).toBe(longDescription);
      expect(result.data?.prompt).toBe(longPrompt);

      // Should validate within reasonable time
      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(100);
    });

    it('should handle very large arrays', () => {
      const largeToolsArray = Array.from({ length: 1000 }, (_, i) => `Tool${i}`);
      const largeSkillsArray = Array.from({ length: 1000 }, (_, i) => `Skill${i}`);

      const agent = {
        name: 'large-arrays-agent',
        description: 'Agent with large arrays',
        prompt: 'Test prompt',
        tools: largeToolsArray,
        skills: largeSkillsArray,
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);
      expect(result.data?.tools).toHaveLength(1000);
      expect(result.data?.skills).toHaveLength(1000);
    });

    it('should handle Unicode characters in all fields', () => {
      const unicodeAgent = {
        name: 'unicode-测试-агент-🤖',
        description: 'Unicode description with 中文, العربية, русский, and emojis 🚀',
        prompt: `You are a Unicode agent that can handle:
- Chinese: 你好世界
- Arabic: مرحبا بالعالم
- Russian: Привет мир
- Japanese: こんにちは世界
- Emojis: 🌍🌎🌏`,
        tools: ['读取-Read', 'كتابة-Write', 'редактировать-Edit'],
        skills: ['多语言-multilingual', 'Unicode-support', 'emoji-handling-🎯'],
      };

      const result = AgentDefinitionSchema.safeParse(unicodeAgent);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('unicode-测试-агент-🤖');
      expect(result.data?.tools).toContain('读取-Read');
      expect(result.data?.skills).toContain('emoji-handling-🎯');
    });

    it('should handle circular references gracefully', () => {
      const circularObject: any = {
        name: 'circular-agent',
        description: 'Agent with circular reference',
        prompt: 'Test prompt',
      };

      // Create circular reference
      circularObject.self = circularObject;

      // Zod actually handles circular references by stripping them during parsing
      const result = AgentDefinitionSchema.safeParse(circularObject);
      expect(result.success).toBe(true); // Zod strips unknown properties including circular ones
      expect((result.data as any).self).toBeUndefined(); // Circular property should be stripped
    });
  });

  describe('Schema Evolution and Backward Compatibility', () => {
    it('should maintain compatibility with legacy agent formats', () => {
      // Test with minimal legacy format
      const legacyAgent = {
        name: 'legacy-agent',
        description: 'Legacy agent format',
        prompt: 'Legacy prompt content',
        // No model specified - should default to sonnet
        // No tools or skills
      };

      const result = AgentDefinitionSchema.safeParse(legacyAgent);
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe('sonnet');
    });

    it('should validate all required AgentDefinition type properties', () => {
      // Ensure our schema matches the TypeScript type definition
      const fullyTypedAgent: AgentDefinition = {
        name: 'typed-agent',
        description: 'Fully typed agent',
        prompt: 'Typed prompt',
        model: 'opus',
        tools: ['Read', 'Write'],
        skills: ['typescript'],
      };

      const result = AgentDefinitionSchema.safeParse(fullyTypedAgent);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fullyTypedAgent);
    });
  });
});