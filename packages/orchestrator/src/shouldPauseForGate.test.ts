import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex, WorkflowStage } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('shouldPauseForGate() Method Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-should-pause-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('shouldPauseForGate() unit tests', () => {
    beforeEach(async () => {
      // Create comprehensive gate configuration
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:
    - id: required-blocking-gate
      type: pre-stage
      name: Required Blocking Gate
      description: A gate that should block execution
      required: true
      autoApprove: false
    - id: auto-approve-gate
      type: pre-stage
      name: Auto Approve Gate
      description: A gate that auto-approves
      required: true
      autoApprove: true
    - id: optional-gate
      type: pre-stage
      name: Optional Gate
      description: An optional gate
      required: false
      autoApprove: false
    - id: optional-auto-gate
      type: pre-stage
      name: Optional Auto Gate
      description: An optional auto-approve gate
      required: false
      autoApprove: true

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      await orchestrator.initialize();
    });

    it('should return pause: false for stage without gate', () => {
      const stage: WorkflowStage = {
        name: 'no-gate-stage',
        agent: 'test-agent',
        description: 'Stage without gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });
    });

    it('should return pause: false for stage with empty gate string', () => {
      const stage: WorkflowStage = {
        name: 'empty-gate-stage',
        agent: 'test-agent',
        description: 'Stage with empty gate',
        gate: '',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });
    });

    it('should return pause: false for stage with non-existent gate and log warning', () => {
      const stage: WorkflowStage = {
        name: 'missing-gate-stage',
        agent: 'test-agent',
        description: 'Stage with missing gate',
        gate: 'non-existent-gate',
      };

      // Mock console.warn to verify warning is logged
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Gate "non-existent-gate" referenced by stage "missing-gate-stage" not found'
      );

      consoleSpy.mockRestore();
    });

    it('should return pause: true for stage with required blocking gate', () => {
      const stage: WorkflowStage = {
        name: 'blocking-stage',
        agent: 'test-agent',
        description: 'Stage with required blocking gate',
        gate: 'required-blocking-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result.pause).toBe(true);
      expect(result.gate).toBeDefined();
      expect(result.gate.id).toBe('required-blocking-gate');
      expect(result.gate.name).toBe('Required Blocking Gate');
      expect(result.gate.required).toBe(true);
      expect(result.gate.autoApprove).toBe(false);
    });

    it('should return pause: false for stage with auto-approve gate', () => {
      const stage: WorkflowStage = {
        name: 'auto-approve-stage',
        agent: 'test-agent',
        description: 'Stage with auto-approve gate',
        gate: 'auto-approve-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });
    });

    it('should return pause: false for stage with optional gate (not required)', () => {
      const stage: WorkflowStage = {
        name: 'optional-stage',
        agent: 'test-agent',
        description: 'Stage with optional gate',
        gate: 'optional-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });
    });

    it('should return pause: false for stage with optional auto-approve gate', () => {
      const stage: WorkflowStage = {
        name: 'optional-auto-stage',
        agent: 'test-agent',
        description: 'Stage with optional auto-approve gate',
        gate: 'optional-auto-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });
    });

    it('should handle case-sensitive gate names correctly', () => {
      const stage: WorkflowStage = {
        name: 'case-sensitive-stage',
        agent: 'test-agent',
        description: 'Stage with case-sensitive gate reference',
        gate: 'Required-Blocking-Gate', // Different case
      };

      // Mock console.warn to verify warning is logged for case mismatch
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result).toEqual({
        pause: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Gate "Required-Blocking-Gate" referenced by stage "case-sensitive-stage" not found'
      );

      consoleSpy.mockRestore();
    });

    it('should preserve gate object structure in return value', () => {
      const stage: WorkflowStage = {
        name: 'structure-test-stage',
        agent: 'test-agent',
        description: 'Stage for testing gate object structure',
        gate: 'required-blocking-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result.pause).toBe(true);
      expect(result.gate).toMatchObject({
        id: 'required-blocking-gate',
        name: 'Required Blocking Gate',
        description: 'A gate that should block execution',
        required: true,
        autoApprove: false,
        type: 'pre-stage',
        tags: [], // Default empty array
      });
    });

    it('should handle workflow-defined gates correctly', async () => {
      // Create workflow with its own gate definition
      const workflowContent = `
name: workflow-gate-test
description: Test workflow-defined gates
gates:
  - id: workflow-specific-gate
    name: Workflow Gate
    description: Gate defined in workflow
    required: true
    autoApprove: false
    timeout: 300
    tags: [workflow, specific]

stages:
  - name: workflow-stage
    agent: test-agent
    description: Stage with workflow gate
    gate: workflow-specific-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'workflow-gate-test.yaml'),
        workflowContent
      );

      // Reload to pick up workflow gates
      await orchestrator.initialize();

      const stage: WorkflowStage = {
        name: 'workflow-stage',
        agent: 'test-agent',
        description: 'Stage with workflow gate',
        gate: 'workflow-specific-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      expect(result.pause).toBe(true);
      expect(result.gate).toMatchObject({
        id: 'workflow-specific-gate',
        name: 'Workflow Gate',
        description: 'Gate defined in workflow',
        required: true,
        autoApprove: false,
        timeout: 300,
        tags: ['workflow', 'specific'],
      });
    });

    it('should handle multiple gates with same name from different sources', async () => {
      // Create workflow that overrides config gate
      const workflowContent = `
name: override-gate-test
description: Test gate override behavior
gates:
  - id: required-blocking-gate
    name: Overridden Gate Name
    description: This gate overrides the config gate
    required: false
    autoApprove: true

stages:
  - name: override-stage
    agent: test-agent
    description: Stage with overridden gate
    gate: required-blocking-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'override-gate-test.yaml'),
        workflowContent
      );

      // Reload to pick up workflow gates
      await orchestrator.initialize();

      const stage: WorkflowStage = {
        name: 'override-stage',
        agent: 'test-agent',
        description: 'Stage with overridden gate',
        gate: 'required-blocking-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);

      // Should use the workflow-defined gate (last loaded wins)
      expect(result.pause).toBe(false); // because autoApprove: true in workflow override
    });

    it('should handle malformed stage objects gracefully', () => {
      // Test with stage missing required properties
      const incompleteStage = {
        name: 'incomplete-stage',
        // Missing agent and description
        gate: 'required-blocking-gate',
      } as WorkflowStage;

      const result = (orchestrator as any).shouldPauseForGate(incompleteStage);

      expect(result.pause).toBe(true);
      expect(result.gate).toBeDefined();
      expect(result.gate.id).toBe('required-blocking-gate');
    });

    it('should handle null and undefined gate values', () => {
      const stageWithNull: WorkflowStage = {
        name: 'null-gate-stage',
        agent: 'test-agent',
        description: 'Stage with null gate',
        gate: null as any,
      };

      const stageWithUndefined: WorkflowStage = {
        name: 'undefined-gate-stage',
        agent: 'test-agent',
        description: 'Stage with undefined gate',
        gate: undefined as any,
      };

      const resultNull = (orchestrator as any).shouldPauseForGate(stageWithNull);
      const resultUndefined = (orchestrator as any).shouldPauseForGate(stageWithUndefined);

      expect(resultNull).toEqual({ pause: false });
      expect(resultUndefined).toEqual({ pause: false });
    });

    it('should verify gate lookup performance with many gates', async () => {
      // Create config with many gates to test lookup performance
      const manyGates = Array.from({ length: 100 }, (_, i) => `
    - id: gate-${i}
      name: Gate ${i}
      description: Gate number ${i}
      required: ${i % 2 === 0}
      autoApprove: ${i % 3 === 0}
`).join('');

      const configWithManyGates = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:${manyGates}

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configWithManyGates
      );

      await orchestrator.initialize();

      // Test lookup performance
      const stage: WorkflowStage = {
        name: 'performance-stage',
        agent: 'test-agent',
        description: 'Stage for performance testing',
        gate: 'gate-50', // Middle of the range
      };

      const startTime = performance.now();
      const result = (orchestrator as any).shouldPauseForGate(stage);
      const endTime = performance.now();

      // Should complete quickly (under 10ms for 100 gates)
      expect(endTime - startTime).toBeLessThan(10);

      // Should find the correct gate
      expect(result.pause).toBe(true); // gate-50: required=true, autoApprove=false
      expect(result.gate.id).toBe('gate-50');
    });
  });
});