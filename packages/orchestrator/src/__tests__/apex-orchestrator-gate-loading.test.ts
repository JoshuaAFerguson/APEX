/**
 * @fileoverview Tests for ApexOrchestrator gate configuration loading
 *
 * This test suite verifies that ApexOrchestrator correctly:
 * 1. Loads gates from config.autonomy.gates array
 * 2. Loads gates from workflow.gates definitions
 * 3. Creates default gates for workflow stage.gate references
 * 4. Makes gates accessible via the private gates map
 * 5. Handles missing or empty gate configurations gracefully
 */

import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';

describe('ApexOrchestrator Gate Loading', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-gate-test-'));

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    const workflowsDir = join(apexDir, 'workflows');
    await mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Config Gates Loading', () => {
    it('should load gates from config.autonomy.gates array', async () => {
      // Create config file with gates
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided
  gates:
    - id: security-review
      name: Security Review
      description: Security team review checkpoint
      required: true
      autoApprove: false
      tags:
        - security
        - review
    - id: performance-check
      name: Performance Check
      description: Performance validation checkpoint
      required: false
      autoApprove: true
      timeout: 30

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await orchestrator.initialize();

      // Access the private gates map through reflection
      const gates = (orchestrator as any).gates;

      expect(gates.size).toBe(2);

      const securityGate = gates.get('security-review');
      expect(securityGate).toBeDefined();
      expect(securityGate.name).toBe('Security Review');
      expect(securityGate.description).toBe('Security team review checkpoint');
      expect(securityGate.required).toBe(true);
      expect(securityGate.autoApprove).toBe(false);
      expect(securityGate.tags).toContain('security');
      expect(securityGate.tags).toContain('review');

      const performanceGate = gates.get('performance-check');
      expect(performanceGate).toBeDefined();
      expect(performanceGate.name).toBe('Performance Check');
      expect(performanceGate.required).toBe(false);
      expect(performanceGate.autoApprove).toBe(true);
      expect(performanceGate.timeout).toBe(30);
    });

    it('should handle config without gates gracefully', async () => {
      // Create config file without gates
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify gates map is empty
      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(0);
    });
  });

  describe('Workflow Gates Loading', () => {
    it('should load gates from workflow.gates definitions', async () => {
      // Create config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Create workflow with gates
      const workflowContent = `
name: Feature Development
description: Complete feature development workflow

gates:
  - id: code-review
    name: Code Review
    description: Peer code review checkpoint
    required: true
    autoApprove: false
    tags:
      - code-quality
  - id: qa-approval
    name: QA Approval
    description: Quality assurance approval
    required: true
    timeout: 60

stages:
  - role: planner
    description: Plan the implementation
  - role: developer
    description: Implement the feature
  - role: reviewer
    description: Review the code
`;

      await writeFile(join(tempDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await orchestrator.initialize();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(2);

      const codeReviewGate = gates.get('code-review');
      expect(codeReviewGate).toBeDefined();
      expect(codeReviewGate.name).toBe('Code Review');
      expect(codeReviewGate.description).toBe('Peer code review checkpoint');
      expect(codeReviewGate.required).toBe(true);
      expect(codeReviewGate.autoApprove).toBe(false);
      expect(codeReviewGate.tags).toContain('code-quality');

      const qaGate = gates.get('qa-approval');
      expect(qaGate).toBeDefined();
      expect(qaGate.name).toBe('QA Approval');
      expect(qaGate.timeout).toBe(60);
    });

    it('should create default gates for workflow stage.gate references', async () => {
      // Create config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Create workflow with stage gate references
      const workflowContent = `
name: Feature Development
description: Complete feature development workflow

stages:
  - role: planner
    description: Plan the implementation
  - role: developer
    description: Implement the feature
    gate: implementation-approval
  - role: reviewer
    description: Review the code
    gate: review-approval
`;

      await writeFile(join(tempDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await orchestrator.initialize();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(2);

      const implGate = gates.get('implementation-approval');
      expect(implGate).toBeDefined();
      expect(implGate.name).toBe('implementation-approval');
      expect(implGate.description).toBe('Approval gate for stage developer in workflow feature');
      expect(implGate.required).toBe(true);
      expect(implGate.autoApprove).toBe(false);
      expect(implGate.tags).toContain('workflow:feature');
      expect(implGate.tags).toContain('stage:developer');

      const reviewGate = gates.get('review-approval');
      expect(reviewGate).toBeDefined();
      expect(reviewGate.name).toBe('review-approval');
      expect(reviewGate.description).toBe('Approval gate for stage reviewer in workflow feature');
      expect(reviewGate.tags).toContain('workflow:feature');
      expect(reviewGate.tags).toContain('stage:reviewer');
    });

    it('should not duplicate gates when stage references existing workflow gate', async () => {
      // Create config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Create workflow with both gate definition and stage reference
      const workflowContent = `
name: Feature Development
description: Complete feature development workflow

gates:
  - id: code-review
    name: Code Review
    description: Peer code review checkpoint
    required: true
    autoApprove: false

stages:
  - role: planner
    description: Plan the implementation
  - role: developer
    description: Implement the feature
  - role: reviewer
    description: Review the code
    gate: code-review
`;

      await writeFile(join(tempDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await orchestrator.initialize();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(1);

      const codeReviewGate = gates.get('code-review');
      expect(codeReviewGate).toBeDefined();
      expect(codeReviewGate.name).toBe('Code Review'); // Should keep the original definition
      expect(codeReviewGate.description).toBe('Peer code review checkpoint');
    });
  });

  describe('Combined Configuration', () => {
    it('should load gates from both config and workflows', async () => {
      // Create config file with gates
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided
  gates:
    - id: security-review
      name: Security Review
      description: Security team review checkpoint
      required: true

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Create workflow with gates
      const workflowContent = `
name: Feature Development
description: Complete feature development workflow

gates:
  - id: qa-approval
    name: QA Approval
    description: Quality assurance approval
    required: true

stages:
  - role: planner
    description: Plan the implementation
  - role: developer
    description: Implement the feature
    gate: implementation-check
`;

      await writeFile(join(tempDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await orchestrator.initialize();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(3);

      expect(gates.has('security-review')).toBe(true); // from config
      expect(gates.has('qa-approval')).toBe(true); // from workflow gates
      expect(gates.has('implementation-check')).toBe(true); // from stage reference
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty workflows directory', async () => {
      // Create config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(0);
    });

    it('should handle workflows without gates or stages', async () => {
      // Create config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Create simple workflow
      const workflowContent = `
name: Simple Workflow
description: A simple workflow without gates
`;

      await writeFile(join(tempDir, '.apex', 'workflows', 'simple.yaml'), workflowContent);

      orchestrator = new ApexOrchestrator({ projectPath: tempDir });
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      const gates = (orchestrator as any).gates;
      expect(gates.size).toBe(0);
    });
  });
});