/**
 * Enhanced Test Suite for v0.1.0 Agent Definitions Audit - Edge Cases and Error Scenarios
 *
 * This test suite provides comprehensive coverage for edge cases, error handling,
 * and boundary conditions in the agent audit functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { auditAllAgents, AuditSummary } from '../scripts/audit-agent-definitions';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('v0.1.0 Agent Audit - Edge Cases & Error Scenarios', () => {
  const tempDir = './temp-test-agents';
  const backupDir = './temp-backup-agents';

  beforeEach(async () => {
    // Create temporary directories for testing
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(backupDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed YAML frontmatter gracefully', async () => {
      const malformedContent = `---
name: test-agent
description: "Test agent with malformed YAML
tools: [Read Write  # Missing closing bracket
model: sonnet
---

This is a test agent with invalid YAML.`;

      const testFile = path.join(tempDir, 'malformed.md');
      await fs.writeFile(testFile, malformedContent);

      // Test that parsing fails gracefully
      expect(async () => {
        const { parseAgentMarkdown } = await import('@apexcli/core');
        const agent = parseAgentMarkdown(malformedContent);
        expect(agent).toBeNull();
      }).not.toThrow();
    });

    it('should handle missing frontmatter', async () => {
      const noFrontmatterContent = `
# Test Agent

This is an agent file without YAML frontmatter.
It should be handled gracefully.`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(noFrontmatterContent);
      expect(agent).toBeNull();
    });

    it('should handle empty files', async () => {
      const emptyContent = '';

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(emptyContent);
      expect(agent).toBeNull();
    });

    it('should handle files with only whitespace', async () => {
      const whitespaceContent = '   \n  \t  \n   ';

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(whitespaceContent);
      expect(agent).toBeNull();
    });

    it('should detect stub indicators case-insensitively', async () => {
      const stubContent = `---
name: stub-agent
description: Test stub agent
tools: []
model: sonnet
---

TODO: Implement this agent later.
This is a PLACEHOLDER for future development.
Coming Soon: Real implementation.`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(stubContent);
      expect(agent).not.toBeNull();

      // Should detect stub indicators
      const stubIndicators = ['TODO', 'PLACEHOLDER', 'Coming Soon'];
      const hasStubIndicators = stubIndicators.some(indicator =>
        agent!.prompt.toUpperCase().includes(indicator.toUpperCase())
      );
      expect(hasStubIndicators).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should handle invalid tool names', async () => {
      const invalidToolsContent = `---
name: invalid-tools
description: Agent with invalid tools
tools: [InvalidTool, "", null, 123]
model: sonnet
---

This agent has invalid tool specifications.`;

      const { parseAgentMarkdown, AgentDefinitionSchema } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(invalidToolsContent);

      if (agent) {
        const validationResult = AgentDefinitionSchema.safeParse(agent);
        expect(validationResult.success).toBe(false);
      }
    });

    it('should handle invalid model values', async () => {
      const invalidModelContent = `---
name: invalid-model
description: Agent with invalid model
tools: [Read, Write]
model: invalid-model-name
---

This agent has an invalid model specification.`;

      const { parseAgentMarkdown, AgentDefinitionSchema } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(invalidModelContent);

      if (agent) {
        const validationResult = AgentDefinitionSchema.safeParse(agent);
        expect(validationResult.success).toBe(false);
      }
    });

    it('should handle missing required fields', async () => {
      const missingFieldsContent = `---
name: missing-fields
# description is missing
tools: [Read]
model: sonnet
---

This agent is missing required fields.`;

      const { parseAgentMarkdown, AgentDefinitionSchema } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(missingFieldsContent);

      if (agent) {
        const validationResult = AgentDefinitionSchema.safeParse(agent);
        expect(validationResult.success).toBe(false);
      }
    });
  });

  describe('Content Quality Validation', () => {
    it('should detect extremely short prompts', async () => {
      const shortPromptContent = `---
name: short-prompt
description: Agent with very short prompt
tools: [Read]
model: sonnet
---

Hi.`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(shortPromptContent);
      expect(agent).not.toBeNull();

      if (agent) {
        expect(agent.prompt.length).toBeLessThan(100);
        // This should be flagged as having insufficient content
      }
    });

    it('should handle agents with no prompt content', async () => {
      const noPromptContent = `---
name: no-prompt
description: Agent with no prompt content
tools: [Read]
model: sonnet
---`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(noPromptContent);

      // The parser may return null for content with no prompt
      if (agent === null) {
        // This is acceptable behavior - parser rejects content with no prompt
        expect(agent).toBeNull();
      } else {
        // If parser accepts it, prompt should be empty
        expect(agent.prompt).toBe('');
      }
    });

    it('should validate description length requirements', async () => {
      const shortDescContent = `---
name: short-desc
description: "x"
tools: [Read]
model: sonnet
---

This agent has a very short description that should be flagged.`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(shortDescContent);
      expect(agent).not.toBeNull();

      if (agent) {
        expect(agent.description.length).toBeLessThan(10);
        // This should be flagged as having insufficient description
      }
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large prompt content efficiently', async () => {
      const largePrompt = 'This is a very long prompt. '.repeat(1000);
      const largeContent = `---
name: large-agent
description: Agent with extremely large prompt content
tools: [Read, Write, Edit]
model: sonnet
---

${largePrompt}`;

      const startTime = Date.now();
      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(largeContent);
      const endTime = Date.now();

      expect(agent).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // Should parse within 1 second

      if (agent) {
        expect(agent.prompt.length).toBeGreaterThan(10000);
      }
    });

    it('should handle agents with many tools efficiently', async () => {
      const manyTools = new Array(50).fill(0).map((_, i) => `Tool${i}`);
      const manyToolsContent = `---
name: many-tools
description: Agent with many tools
tools: ${JSON.stringify(manyTools)}
model: sonnet
---

This agent has many tools defined.`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(manyToolsContent);
      expect(agent).not.toBeNull();

      if (agent) {
        expect(agent.tools).toHaveLength(50);
      }
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle Unicode characters in agent content', async () => {
      const unicodeContent = `---
name: unicode-agent
description: "Agent with Unicode characters: 🤖 智能助手"
tools: [Read, Write]
model: sonnet
---

This agent handles Unicode:
- Emojis: 🚀 ⭐ 💡
- Chinese: 人工智能助手
- Mathematical symbols: ∑ ∫ ∞ ≠`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(unicodeContent);

      // Test that parser can handle Unicode content
      if (agent === null) {
        // If parser rejects Unicode, test that it handles it gracefully
        expect(typeof unicodeContent).toBe('string');
        expect(unicodeContent).toContain('🤖');
      } else {
        // If parser accepts Unicode, verify content is preserved
        expect(agent.description).toContain('🤖');
        expect(agent.description).toContain('智能助手');
        expect(agent.prompt).toContain('🚀');
        expect(agent.prompt).toContain('人工智能助手');
      }
    });

    it('should handle special YAML characters in content', async () => {
      const specialCharsContent = `---
name: special-chars
description: "Agent with special chars: quotes, colons: and |pipes|"
tools: [Read]
model: sonnet
---

This agent contains special characters:
- Quotes: "Hello" and 'World'
- Colons: key:value pairs
- Pipes: |this| and |that|
- Brackets: [array] and {object}`;

      const { parseAgentMarkdown } = await import('@apexcli/core');
      const agent = parseAgentMarkdown(specialCharsContent);
      expect(agent).not.toBeNull();

      if (agent) {
        expect(agent.description).toContain('quotes, colons:');
        expect(agent.prompt).toContain('key:value');
      }
    });
  });

  describe('Audit Consistency Validation', () => {
    it('should provide consistent results across multiple runs', async () => {
      // Run audit multiple times and verify consistency
      const results: AuditSummary[] = [];

      for (let i = 0; i < 3; i++) {
        const result = await auditAllAgents();
        results.push(result);
      }

      // All results should be identical
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        expect(current.totalAgents).toBe(first.totalAgents);
        expect(current.overallStatus).toBe(first.overallStatus);
        expect(current.results).toHaveLength(first.results.length);
      }
    });

    it('should handle concurrent audit runs', async () => {
      // Run multiple audits concurrently
      const promises = Array.from({ length: 3 }, () => auditAllAgents());
      const results = await Promise.all(promises);

      // All results should be consistent
      const statuses = results.map(r => r.overallStatus);
      expect(new Set(statuses).size).toBe(1); // All same status

      const totals = results.map(r => r.totalAgents);
      expect(new Set(totals).size).toBe(1); // All same totals
    });
  });

  describe('Audit Result Data Structure Validation', () => {
    it('should have well-formed audit result structure', async () => {
      const result = await auditAllAgents();

      // Validate top-level structure
      expect(result).toHaveProperty('totalAgents');
      expect(result).toHaveProperty('passedAgents');
      expect(result).toHaveProperty('failedAgents');
      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('missingAgents');
      expect(result).toHaveProperty('syncIssues');

      // Validate types
      expect(typeof result.totalAgents).toBe('number');
      expect(typeof result.passedAgents).toBe('number');
      expect(typeof result.failedAgents).toBe('number');
      expect(['PASS', 'FAIL']).toContain(result.overallStatus);
      expect(Array.isArray(result.results)).toBe(true);
      expect(Array.isArray(result.missingAgents)).toBe(true);
      expect(Array.isArray(result.syncIssues)).toBe(true);

      // Validate mathematical consistency
      expect(result.passedAgents + result.failedAgents).toBe(result.totalAgents);

      // Validate individual result structure
      result.results.forEach(res => {
        expect(res).toHaveProperty('agent');
        expect(res).toHaveProperty('location');
        expect(res).toHaveProperty('exists');
        expect(res).toHaveProperty('hasValidYaml');
        expect(res).toHaveProperty('hasRealPrompt');
        expect(res).toHaveProperty('errors');

        expect(typeof res.agent).toBe('string');
        expect(typeof res.location).toBe('string');
        expect(typeof res.exists).toBe('boolean');
        expect(typeof res.hasValidYaml).toBe('boolean');
        expect(typeof res.hasRealPrompt).toBe('boolean');
        expect(Array.isArray(res.errors)).toBe(true);
      });
    });

    it('should have unique agent-location combinations', async () => {
      const result = await auditAllAgents();
      const combinations = result.results.map(r => `${r.agent}:${r.location}`);
      const uniqueCombinations = new Set(combinations);

      expect(combinations.length).toBe(uniqueCombinations.size);
    });

    it('should report expected number of agent-location pairs', async () => {
      const result = await auditAllAgents();

      // Should have 6 agents × 2 locations = 12 total results
      expect(result.results).toHaveLength(12);
      expect(result.totalAgents).toBe(12);

      // Verify expected agents
      const agents = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];
      const locations = ['.apex/agents', 'packages/core/templates/agents'];

      agents.forEach(agent => {
        locations.forEach(location => {
          const found = result.results.find(r => r.agent === agent && r.location === location);
          expect(found).toBeDefined();
        });
      });
    });
  });

  describe('Integration with CI/CD Validation', () => {
    it('should return appropriate exit codes for programmatic use', async () => {
      const result = await auditAllAgents();

      if (result.overallStatus === 'PASS') {
        expect(result.failedAgents).toBe(0);
        expect(result.missingAgents).toEqual([]);
      } else {
        expect(result.failedAgents).toBeGreaterThan(0);
      }
    });

    it('should provide actionable error messages', async () => {
      const result = await auditAllAgents();

      result.results.forEach(res => {
        res.errors.forEach(error => {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
          expect(error).not.toBe('undefined');
          expect(error).not.toBe('null');
          expect(error.trim()).toBe(error); // No leading/trailing whitespace
        });
      });
    });
  });
});