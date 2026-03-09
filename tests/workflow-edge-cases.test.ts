/**
 * Edge Case Tests for APEX Workflow System
 *
 * Tests edge cases, boundary conditions, and error scenarios for:
 * - Workflow YAML parsing edge cases
 * - Schema validation boundary conditions
 * - Malformed YAML handling
 * - Resource exhaustion scenarios
 * - Cross-platform compatibility
 * - Security-related edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'os';
import { loadWorkflows } from '@apexcli/core';
import { WorkflowDefinitionSchema, WorkflowStageSchema, WorkflowGateSchema } from '@apexcli/core';

describe('Workflow Edge Case Tests', () => {
  let testDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(path.tmpdir(), 'workflow-edge-test-'));
    workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('YAML Parsing Edge Cases', () => {
    it('should handle extremely deep YAML nesting', async () => {
      const deepNestedWorkflow = `name: deep-nested-workflow
description: Workflow with deeply nested structures
stages:
  - name: deep-stage
    agent: deep-agent
    description: >
      This is a very long description that spans multiple lines
      and contains various special characters: !@#$%^&*()_+-={}[]|\\:";'<>?,./
      It also contains unicode: 你好世界 🌍 café naïve résumé
    inputs:
      - input-with-special-chars: "value!@#$%"
      - unicode-input: "值🔥测试"
      - nested-object-like-string: "{key: {nested: {deep: value}}}"
    outputs:
      - complex-output-name: "output-with-special-chars!@#"
    condition: >
      (inputs["input-with-special-chars"] !== null) &&
      (environment.NODE_ENV === "test") &&
      (config.feature_flags.enable_deep_nesting === true)
    actions:
      - "run-command --param='value with spaces' --flag"
      - "complex-command | grep pattern | sort | head -10"
      - "multi\\nline\\ncommand"`;

      await fs.writeFile(path.join(workflowsDir, 'deep-nested.yaml'), deepNestedWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['deep-nested-workflow']).toBeDefined();

      const workflow = workflows['deep-nested-workflow'];
      expect(workflow.stages[0].description).toContain('special characters');
      expect(workflow.stages[0].description).toContain('unicode');
      expect(workflow.stages[0].condition).toContain('feature_flags');
    });

    it('should handle YAML with various quote styles and escaping', async () => {
      const quotedWorkflow = `name: 'quoted-workflow'
description: "Workflow with various quote styles"
trigger:
  - 'single-quoted-trigger'
  - "double-quoted-trigger"
  - unquoted-trigger
stages:
  - name: "quoted-stage"
    agent: 'quoted-agent'
    description: 'Description with "inner double quotes" and escaped \\'single quotes\\''
    condition: "environment.MODE === 'production' && config.enabled === true"
    actions:
      - 'echo "Hello World"'
      - "echo 'Hello World'"
      - echo "Mixed quotes work 'here' too"
      - 'Complex command with "nested quotes" and \\$special \\$vars'`;

      await fs.writeFile(path.join(workflowsDir, 'quoted.yaml'), quotedWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['quoted-workflow']).toBeDefined();

      const workflow = workflows['quoted-workflow'];
      expect(workflow.trigger).toContain('single-quoted-trigger');
      expect(workflow.trigger).toContain('double-quoted-trigger');
      expect(workflow.trigger).toContain('unquoted-trigger');
    });

    it('should handle YAML with multi-line strings and folding', async () => {
      const multilineWorkflow = `name: multiline-workflow
description: |
  This is a literal block scalar that preserves newlines.
  Line 1
  Line 2
  Line 3

  Blank lines are preserved too.
stages:
  - name: multiline-stage
    agent: multiline-agent
    description: >
      This is a folded block scalar that folds newlines into spaces.
      This very long line will be folded
      into a single line with spaces.


      Multiple blank lines become one.
    condition: |
      if (environment.complex_condition) {
        return (
          config.feature_a === true &&
          config.feature_b === false &&
          runtime.memory_usage < 0.8
        );
      }
      return false;
    actions:
      - |
        #!/bin/bash
        set -e
        echo "Multi-line script"
        for i in {1..10}; do
          echo "Processing item $i"
        done
        echo "Script completed"
      - >
        This is a folded action that
        spans multiple lines but will be
        treated as a single line command`;

      await fs.writeFile(path.join(workflowsDir, 'multiline.yaml'), multilineWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['multiline-workflow']).toBeDefined();

      const workflow = workflows['multiline-workflow'];
      expect(workflow.description).toContain('Line 1\nLine 2\nLine 3');
      expect(workflow.stages[0].condition).toContain('if (environment.complex_condition)');
      expect(workflow.stages[0].actions![0]).toContain('#!/bin/bash');
    });

    it('should handle YAML with anchors and aliases', async () => {
      const anchoredWorkflow = `name: anchored-workflow
description: Workflow demonstrating YAML anchors and aliases

# Define reusable configurations
common-config: &common
  maxRetries: 3
  parallel: false

frontend-config: &frontend
  <<: *common
  agent: frontend-agent
  outputs: [frontend-artifacts]

backend-config: &backend
  <<: *common
  agent: backend-agent
  outputs: [backend-artifacts]

stages:
  - name: build-frontend
    <<: *frontend
    description: Build frontend application

  - name: test-frontend
    <<: *frontend
    description: Test frontend application
    dependsOn: [build-frontend]

  - name: build-backend
    <<: *backend
    description: Build backend application

  - name: test-backend
    <<: *backend
    description: Test backend application
    dependsOn: [build-backend]`;

      await fs.writeFile(path.join(workflowsDir, 'anchored.yaml'), anchoredWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['anchored-workflow']).toBeDefined();

      const workflow = workflows['anchored-workflow'];
      expect(workflow.stages).toHaveLength(4);

      // Verify anchor/alias resolution
      const frontendStage = workflow.stages.find(s => s.name === 'build-frontend')!;
      expect(frontendStage.agent).toBe('frontend-agent');
      expect(frontendStage.maxRetries).toBe(3);
      expect(frontendStage.parallel).toBe(false);

      const backendStage = workflow.stages.find(s => s.name === 'build-backend')!;
      expect(backendStage.agent).toBe('backend-agent');
      expect(backendStage.maxRetries).toBe(3);
    });

    it('should handle YAML with comments in various positions', async () => {
      const commentedWorkflow = `# Top-level comment
name: commented-workflow  # Inline comment after field
# Comment before description
description: "Workflow with comprehensive commenting"

# Comment before trigger
trigger:
  - manual    # Trigger comment
  - scheduled # Another trigger comment

# Main stages section
stages:
  # First stage comment
  - name: stage-1  # Stage name comment
    agent: agent-1 # Agent comment
    # Description comment
    description: "First stage with comments"
    # Dependencies comment
    dependsOn: [] # Empty dependencies with comment

  # Second stage with block comment
  - name: stage-2
    agent: agent-2
    description: |
      Multi-line description
      # This looks like a comment but it's part of the string
      Still part of description
    dependsOn: [stage-1] # Comment after array

# Comment before gates
gates: # Inline gates comment
  # Gate definition comment
  - id: test-gate # Gate ID comment
    name: "Test Gate" # Gate name comment
    description: "Gate for testing comments"
    trigger: "stage:stage-1:completed" # Trigger comment
    required: true # Required comment

# Final comment`;

      await fs.writeFile(path.join(workflowsDir, 'commented.yaml'), commentedWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['commented-workflow']).toBeDefined();

      const workflow = workflows['commented-workflow'];
      expect(workflow.stages).toHaveLength(2);
      expect(workflow.gates).toHaveLength(1);
      expect(workflow.stages[1].description).toContain('# This looks like a comment');
    });
  });

  describe('Schema Validation Boundary Tests', () => {
    it('should handle minimum and maximum string lengths', async () => {
      const emptyString = '';
      const maxString = 'a'.repeat(100000); // Very long string

      const boundaryWorkflow = {
        name: 'a', // Minimal name
        description: maxString, // Maximum length description
        stages: [
          {
            name: emptyString || 'empty-name-fallback',
            agent: 'a' // Minimal agent name
          },
          {
            name: maxString.substring(0, 1000), // Truncated for practical reasons
            agent: maxString.substring(0, 100)
          }
        ]
      };

      const result = WorkflowDefinitionSchema.safeParse(boundaryWorkflow);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe('a');
        expect(result.data.description.length).toBe(100000);
      }
    });

    it('should handle extreme array sizes', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`);

      const arrayWorkflow = {
        name: 'array-test',
        description: 'Test large arrays',
        trigger: largeArray,
        stages: [
          {
            name: 'array-stage',
            agent: 'array-agent',
            dependsOn: largeArray,
            inputs: largeArray,
            outputs: largeArray,
            actions: largeArray
          }
        ]
      };

      const result = WorkflowDefinitionSchema.safeParse(arrayWorkflow);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.trigger).toHaveLength(10000);
        expect(result.data.stages[0].dependsOn).toHaveLength(10000);
      }
    });

    it('should handle extreme numeric values', async () => {
      const extremeNumbers = {
        name: 'numeric-extremes',
        description: 'Test extreme numeric values',
        stages: [
          {
            name: 'zero-retries',
            agent: 'agent-1',
            maxRetries: 0
          },
          {
            name: 'negative-retries',
            agent: 'agent-2',
            maxRetries: -2147483648 // Min 32-bit integer
          },
          {
            name: 'max-retries',
            agent: 'agent-3',
            maxRetries: 2147483647 // Max 32-bit integer
          },
          {
            name: 'float-retries',
            agent: 'agent-4',
            maxRetries: 3.14159
          }
        ]
      };

      const result = WorkflowDefinitionSchema.safeParse(extremeNumbers);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.stages[0].maxRetries).toBe(0);
        expect(result.data.stages[1].maxRetries).toBe(-2147483648);
        expect(result.data.stages[2].maxRetries).toBe(2147483647);
        expect(result.data.stages[3].maxRetries).toBe(3.14159);
      }
    });

    it('should handle special Unicode characters and emojis', async () => {
      const unicodeWorkflow = {
        name: '测试工作流-🚀🔥💯',
        description: 'Unicode test: Iñtërnâtiônàlizætiøn 中文测试 العربية עברית Русский 🌍🌎🌏',
        stages: [
          {
            name: '阶段一-🎯',
            agent: 'агент-тест',
            description: '这是一个测试阶段 with mixed languages and emojis 🔧⚙️'
          },
          {
            name: '🏗️-建设阶段',
            agent: '👷‍♂️-worker',
            dependsOn: ['阶段一-🎯'],
            inputs: ['输入-📥'],
            outputs: ['输出-📤'],
            actions: ['执行命令-🖥️']
          }
        ]
      };

      const result = WorkflowDefinitionSchema.safeParse(unicodeWorkflow);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe('测试工作流-🚀🔥💯');
        expect(result.data.stages[0].agent).toBe('агент-тест');
        expect(result.data.stages[1].name).toBe('🏗️-建设阶段');
      }
    });

    it('should handle null and undefined edge cases correctly', async () => {
      // Test various null/undefined scenarios
      const nullTestCases = [
        {
          name: 'null-test-1',
          description: 'Test with null gate',
          stages: [
            {
              name: 'stage-with-null-gate',
              agent: 'agent-1',
              gate: null
            }
          ]
        },
        {
          name: 'null-test-2',
          description: 'Test with undefined optional fields',
          stages: [
            {
              name: 'minimal-stage',
              agent: 'agent-2'
              // All optional fields are undefined
            }
          ]
        }
      ];

      for (const testCase of nullTestCases) {
        const result = WorkflowDefinitionSchema.safeParse(testCase);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Malformed YAML Handling', () => {
    it('should gracefully handle various YAML syntax errors', async () => {
      const malformedCases = [
        {
          name: 'unclosed-quote.yaml',
          content: `name: "unclosed quote workflow
description: This workflow has an unclosed quote
stages:
  - name: test
    agent: test`
        },
        {
          name: 'mismatched-brackets.yaml',
          content: `name: bracket-mismatch
description: Workflow with bracket mismatch
stages:
  - name: test
    agent: test
    dependsOn: [stage1, stage2, stage3`
        },
        {
          name: 'invalid-indentation.yaml',
          content: `name: indentation-error
description: Invalid indentation
stages:
- name: test
    agent: test
  description: wrong indent`
        },
        {
          name: 'tab-characters.yaml',
          content: `name: tab-workflow
description: Workflow with tab characters
stages:
\t- name: test
\t  agent: test`
        },
        {
          name: 'mixed-indentation.yaml',
          content: `name: mixed-indent
description: Mixed spaces and tabs
stages:
  - name: stage1
    agent: agent1
\t- name: stage2
\t  agent: agent2`
        }
      ];

      for (const testCase of malformedCases) {
        await fs.writeFile(path.join(workflowsDir, testCase.name), testCase.content);

        await expect(loadWorkflows(testDir)).rejects.toThrow();

        // Clean up for next test
        await fs.unlink(path.join(workflowsDir, testCase.name));
      }
    });

    it('should handle invalid schema combinations', async () => {
      const invalidCombinations = [
        {
          name: 'type-mismatch-1',
          content: `name: 123
description: Numeric name should fail
stages:
  - name: test
    agent: test`
        },
        {
          name: 'type-mismatch-2',
          content: `name: valid-name
description: Boolean description should fail
stages: true`
        },
        {
          name: 'type-mismatch-3',
          content: `name: valid-name
description: Valid description
stages:
  - name: test
    agent: 456`
        },
        {
          name: 'invalid-boolean',
          content: `name: valid-name
description: Valid description
stages:
  - name: test
    agent: test
    parallel: "not a boolean"`
        }
      ];

      for (const testCase of invalidCombinations) {
        await fs.writeFile(path.join(workflowsDir, testCase.name), testCase.content);

        await expect(loadWorkflows(testDir)).rejects.toThrow();

        // Clean up for next test
        await fs.unlink(path.join(workflowsDir, testCase.name));
      }
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory-intensive workflow parsing', async () => {
      // Create a workflow that uses significant memory
      const stageCount = 1000;
      const stages = [];

      for (let i = 0; i < stageCount; i++) {
        // Create stages with large string fields
        const largeDescription = `Stage ${i}: ${'x'.repeat(1000)}`;
        const largeDependsList = Array.from({ length: 100 }, (_, j) => `dep-${i}-${j}`);

        stages.push(`  - name: memory-stage-${i}
    agent: memory-agent-${i}
    description: "${largeDescription}"
    dependsOn: ${JSON.stringify(largeDependsList).replace(/"/g, '')}
    inputs: ${JSON.stringify(Array.from({ length: 50 }, (_, j) => `input-${i}-${j}`)).replace(/"/g, '')}
    outputs: ${JSON.stringify(Array.from({ length: 50 }, (_, j) => `output-${i}-${j}`)).replace(/"/g, '')}
    maxRetries: ${i % 10}`);
      }

      const memoryIntensiveWorkflow = `name: memory-intensive-workflow
description: "Workflow designed to test memory handling with ${stageCount} stages"
stages:
${stages.join('\n')}`;

      await fs.writeFile(path.join(workflowsDir, 'memory-intensive.yaml'), memoryIntensiveWorkflow);

      // Monitor memory usage during parsing
      const beforeMemory = process.memoryUsage();

      const workflows = await loadWorkflows(testDir);

      const afterMemory = process.memoryUsage();

      expect(workflows['memory-intensive-workflow']).toBeDefined();
      expect(workflows['memory-intensive-workflow'].stages).toHaveLength(stageCount);

      // Ensure memory usage doesn't explode (rough check)
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
    });

    it('should handle concurrent workflow loading stress test', async () => {
      // Create multiple workflow files
      const workflowCount = 50;
      const promises = [];

      for (let i = 0; i < workflowCount; i++) {
        const workflowContent = `name: concurrent-workflow-${i}
description: Concurrent workflow ${i}
stages:
  - name: stage-${i}-1
    agent: agent-${i}-1
  - name: stage-${i}-2
    agent: agent-${i}-2
    dependsOn: [stage-${i}-1]`;

        promises.push(
          fs.writeFile(path.join(workflowsDir, `concurrent-${i}.yaml`), workflowContent)
        );
      }

      await Promise.all(promises);

      // Load workflows concurrently multiple times
      const concurrentLoads = Array(10).fill(null).map(() => loadWorkflows(testDir));

      const results = await Promise.all(concurrentLoads);

      // All results should be identical
      for (const result of results) {
        expect(Object.keys(result)).toHaveLength(workflowCount);
        expect(result[`concurrent-workflow-0`]).toBeDefined();
        expect(result[`concurrent-workflow-${workflowCount - 1}`]).toBeDefined();
      }
    });
  });

  describe('Security-Related Edge Cases', () => {
    it('should handle potential security issues in YAML content', async () => {
      // Test content that could be problematic if not handled correctly
      const securityTestWorkflow = `name: security-test
description: Workflow testing potential security edge cases
stages:
  - name: injection-test
    agent: security-agent
    description: "Test with potential injection: '; DROP TABLE workflows; --"
    condition: "user.input === '\\'; rm -rf /*; echo '"
    actions:
      - "echo 'Safe command with dangerous looking content: $(rm -rf /)'"
      - 'Command with single quotes and "double quotes" mixed'
      - |
        # Multi-line script that looks suspicious
        echo "This is safe"
        # But contains comments that look like shell injection
        echo 'Still safe: $(dangerous-command)'
  - name: path-traversal-test
    agent: path-agent
    description: "Path traversal test: ../../../etc/passwd"
    inputs: ["../../../etc/passwd", "../../../../etc/hosts"]
    outputs: ["../../../tmp/output", "../../../../var/log/test"]
  - name: unicode-security
    agent: unicode-agent
    description: "Unicode security test: \u0041\u0042\u0043"  # ABC in unicode
    condition: "input !== '\\u0000\\u0001\\u0002'"`;

      await fs.writeFile(path.join(workflowsDir, 'security-test.yaml'), securityTestWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['security-test']).toBeDefined();

      const workflow = workflows['security-test'];
      expect(workflow.stages).toHaveLength(3);

      // Verify content is preserved as-is (no execution/interpretation)
      expect(workflow.stages[0].description).toContain('DROP TABLE');
      expect(workflow.stages[1].inputs).toContain('../../../etc/passwd');
      expect(workflow.stages[2].description).toContain('\\u0041\\u0042\\u0043');
    });

    it('should handle very long field values that could cause buffer issues', async () => {
      const veryLongString = 'A'.repeat(1000000); // 1MB string

      const longFieldWorkflow = `name: long-field-test
description: "${veryLongString}"
stages:
  - name: long-stage
    agent: long-agent
    description: "${veryLongString.substring(0, 50000)}"`;

      await fs.writeFile(path.join(workflowsDir, 'long-field.yaml'), longFieldWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['long-field-test']).toBeDefined();

      const workflow = workflows['long-field-test'];
      expect(workflow.description.length).toBe(1000000);
      expect(workflow.stages[0].description!.length).toBe(50000);
    });

    it('should handle workflows with binary-like content', async () => {
      // Test content that includes binary-like sequences
      const binaryLikeWorkflow = `name: binary-like-test
description: Workflow with binary-like content
stages:
  - name: binary-stage
    agent: binary-agent
    description: "Content with null bytes and control chars: \\x00\\x01\\x02\\x03"
    condition: "data.includes('\\x00') === false"
    actions:
      - "echo 'Binary-like string: \\xFF\\xFE\\xFD'"
      - "process --input='\\x41\\x42\\x43'"`; // ABC in hex

      await fs.writeFile(path.join(workflowsDir, 'binary-like.yaml'), binaryLikeWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['binary-like-test']).toBeDefined();

      const workflow = workflows['binary-like-test'];
      expect(workflow.stages[0].description).toContain('\\x00\\x01\\x02\\x03');
      expect(workflow.stages[0].actions![0]).toContain('\\xFF\\xFE\\xFD');
    });
  });

  describe('Cross-Platform Compatibility Edge Cases', () => {
    it('should handle different line ending styles', async () => {
      const workflows = [
        {
          name: 'unix-line-endings.yaml',
          content: 'name: unix-workflow\ndescription: Unix line endings\nstages:\n  - name: test\n    agent: test'
        },
        {
          name: 'windows-line-endings.yaml',
          content: 'name: windows-workflow\r\ndescription: Windows line endings\r\nstages:\r\n  - name: test\r\n    agent: test'
        },
        {
          name: 'mac-line-endings.yaml',
          content: 'name: mac-workflow\rdescription: Mac line endings\rstages:\r  - name: test\r    agent: test'
        },
        {
          name: 'mixed-line-endings.yaml',
          content: 'name: mixed-workflow\r\ndescription: Mixed line endings\nstages:\r  - name: test\n    agent: test'
        }
      ];

      for (const workflow of workflows) {
        await fs.writeFile(path.join(workflowsDir, workflow.name), workflow.content);
      }

      const loadedWorkflows = await loadWorkflows(testDir);

      expect(loadedWorkflows['unix-workflow']).toBeDefined();
      expect(loadedWorkflows['windows-workflow']).toBeDefined();
      expect(loadedWorkflows['mac-workflow']).toBeDefined();
      expect(loadedWorkflows['mixed-workflow']).toBeDefined();

      // All should have the same structure regardless of line endings
      for (const [name, workflow] of Object.entries(loadedWorkflows)) {
        expect(workflow.stages).toHaveLength(1);
        expect(workflow.stages[0].name).toBe('test');
        expect(workflow.stages[0].agent).toBe('test');
      }
    });

    it('should handle file encoding variations', async () => {
      // Test different UTF-8 BOM scenarios
      const bomWorkflow = `name: bom-test-workflow
description: Workflow to test BOM handling
stages:
  - name: bom-stage
    agent: bom-agent`;

      // Write with UTF-8 BOM
      const bomBuffer = Buffer.concat([
        Buffer.from([0xEF, 0xBB, 0xBF]), // UTF-8 BOM
        Buffer.from(bomWorkflow, 'utf8')
      ]);

      await fs.writeFile(path.join(workflowsDir, 'bom-workflow.yaml'), bomBuffer);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['bom-test-workflow']).toBeDefined();

      const workflow = workflows['bom-test-workflow'];
      expect(workflow.name).toBe('bom-test-workflow');
      expect(workflow.stages).toHaveLength(1);
    });
  });
});