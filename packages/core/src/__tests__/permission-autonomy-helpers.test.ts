/**
 * @fileoverview Comprehensive tests for permission and autonomy test helpers
 *
 * This test file demonstrates the usage and validates the functionality of the
 * permission and autonomy test helpers, covering various scenarios including
 * approval flows, permission denials, and autonomy boundary conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  PermissionTestScenarios,
  AutonomyTestScenarios,
  apexTestHelpers,
} from './helpers';
import type {
  Permission,
  PermissionLevel,
  AutonomyLevel,
  ApprovalCheckpointType,
} from '../types';

describe('Permission Test Helpers', () => {
  let helpers: PermissionTestHelpers;

  beforeEach(() => {
    helpers = new PermissionTestHelpers();
  });

  describe('Basic Permission Creation', () => {
    it('should create a basic permission with allow-always level', () => {
      const permission = helpers.createPermission('Write', 'allow-always');

      expect(permission).toMatchObject({
        tool: 'Write',
        level: 'allow-always',
        scope: undefined,
      });
      expect(permission.createdAt).toBeInstanceOf(Date);
    });

    it('should create permission with scope and expiry', () => {
      const expiry = new Date(Date.now() + 3600000); // 1 hour from now
      const permission = helpers.createPermission('Shell', 'allow-once', {
        scope: '/tmp',
        expiry,
      });

      expect(permission).toMatchObject({
        tool: 'Shell',
        level: 'allow-once',
        scope: '/tmp',
        expiry,
      });
    });

    it('should create extended permission with metadata', () => {
      const extendedPermission = helpers.createExtendedPermission('HTTP', 'deny', {
        scope: 'sensitive.example.com',
        grantReason: 'Blocked for security',
        grantedBy: 'security-team',
        tags: ['security', 'blocked'],
      });

      expect(extendedPermission).toMatchObject({
        tool: 'HTTP',
        level: 'deny',
        scope: 'sensitive.example.com',
        grantReason: 'Blocked for security',
        grantedBy: 'security-team',
        tags: ['security', 'blocked'],
      });
    });
  });

  describe('Permission Check Simulations', () => {
    it('should simulate permission approval', () => {
      const result = helpers.simulatePermissionApproval('Read');

      expect(result).toMatchObject({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
        consumed: false,
      });
      expect(result.reason).toContain('Permission granted');
    });

    it('should simulate permission denial', () => {
      const result = helpers.simulatePermissionDenial('Write', '/etc', 'System directory access denied');

      expect(result).toMatchObject({
        allowed: false,
        level: 'deny',
        requiresConfirmation: false,
        reason: 'System directory access denied',
        consumed: false,
      });
    });

    it('should simulate permission requiring confirmation', () => {
      const result = helpers.simulatePermissionRequiringConfirmation('Shell', 'sudo rm -rf');

      expect(result).toMatchObject({
        allowed: false,
        level: null,
        requiresConfirmation: true,
        reason: 'User confirmation required',
        consumed: false,
      });
    });

    it('should simulate allow-once permission consumption', () => {
      const result = helpers.simulateAllowOnceConsumption('Git', 'commit');

      expect(result).toMatchObject({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: false,
        consumed: true,
      });
      expect(result.reason).toContain('Allow-once permission consumed');
    });
  });

  describe('Approval Flow Creation', () => {
    it('should create approval request', () => {
      const request = helpers.createApprovalRequest({
        requestId: 'test-123',
        taskId: 'task-456',
        gateName: 'Code Review',
        gateType: 'before-commit',
        description: 'Review code changes',
        timeoutMinutes: 30,
        approvers: ['senior-dev', 'tech-lead'],
      });

      expect(request).toMatchObject({
        requestId: 'test-123',
        id: 'test-123',
        taskId: 'task-456',
        gateName: 'Code Review',
        gateType: 'before-commit',
        description: 'Review code changes',
        timeoutMinutes: 30,
        approvers: ['senior-dev', 'tech-lead'],
        minApprovals: 1,
      });
      expect(request.requestedAt).toBeInstanceOf(Date);
      expect(request.expiresAt).toBeInstanceOf(Date);
    });

    it('should create approval response (approved)', () => {
      const response = helpers.createApprovalResponse(
        'test-123',
        'task-456',
        'Code Review',
        true,
        'Changes look good'
      );

      expect(response).toMatchObject({
        requestId: 'test-123',
        approvalId: 'test-123',
        taskId: 'task-456',
        gateName: 'Code Review',
        action: 'approve',
        response: 'approved',
        approver: 'test-user',
        reason: 'Changes look good',
      });
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.responseTimeMs).toBe(60000);
    });

    it('should create approval response (denied)', () => {
      const response = helpers.createApprovalResponse(
        'test-123',
        'task-456',
        'Code Review',
        false,
        'Issues found'
      );

      expect(response).toMatchObject({
        action: 'deny',
        response: 'denied',
        reason: 'Issues found',
      });
    });
  });

  describe('Mock Permission Manager', () => {
    it('should configure and check permissions correctly', () => {
      const manager = helpers.getMockPermissionManager();

      // Configure a permission scenario
      manager.configurePermissionCheck('Write', '/tmp', {
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      // Check the configured permission
      const result = manager.checkPermission('Write', { scope: '/tmp' });

      expect(result).toMatchObject({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });
    });

    it('should return default denial for unconfigured permissions', () => {
      const manager = helpers.getMockPermissionManager();
      const result = manager.checkPermission('UnknownTool');

      expect(result).toMatchObject({
        allowed: false,
        level: null,
        requiresConfirmation: true,
        reason: 'No permission found',
      });
    });
  });

  describe('Common Permission Scenarios', () => {
    it('should create common permission scenarios', () => {
      const scenarios = helpers.createCommonPermissionScenarios();

      expect(scenarios.fileWrite).toMatchObject({
        tool: 'Write',
        level: 'allow-always',
      });

      expect(scenarios.fileDelete).toMatchObject({
        tool: 'Delete',
        level: 'deny',
      });

      expect(scenarios.gitCommit).toMatchObject({
        tool: 'Git',
        level: 'allow-once',
        scope: 'commit',
      });
    });
  });

  describe('Permission Test Scenarios', () => {
    it('should apply full access scenario', () => {
      PermissionTestScenarios.fullAccess(helpers);
      const manager = helpers.getMockPermissionManager();

      expect(manager.checkPermission('Write')).toMatchObject({
        allowed: true,
        level: 'allow-always',
      });
      expect(manager.checkPermission('Read')).toMatchObject({
        allowed: true,
        level: 'allow-always',
      });
    });

    it('should apply no access scenario', () => {
      PermissionTestScenarios.noAccess(helpers);
      const manager = helpers.getMockPermissionManager();

      expect(manager.checkPermission('Write')).toMatchObject({
        allowed: false,
        level: 'deny',
      });
      expect(manager.checkPermission('Shell')).toMatchObject({
        allowed: false,
        level: 'deny',
      });
    });
  });
});

describe('Autonomy Test Helpers', () => {
  let helpers: AutonomyTestHelpers;

  beforeEach(() => {
    helpers = new AutonomyTestHelpers();
  });

  describe('Autonomy Configuration Creation', () => {
    it('should create basic autonomy config', () => {
      const config = helpers.createAutonomyConfig('full-auto');

      expect(config).toMatchObject({
        level: 'full-auto',
        rejectionBehavior: 'abort',
      });
    });

    it('should create autonomy config with gates and limits', () => {
      const config = helpers.createAutonomyConfig('review-all', {
        includeGates: true,
        includeResourceLimits: true,
        rejectionBehavior: 'skip',
        approvalTimeout: 45,
      });

      expect(config).toMatchObject({
        level: 'review-all',
        rejectionBehavior: 'skip',
        approvalTimeout: 45,
      });
      expect(config.gates).toBeDefined();
      expect(config.limits).toBeDefined();
      expect(config.gates!.length).toBeGreaterThan(0);
    });

    it('should create autonomy config with overrides', () => {
      const config = helpers.createAutonomyConfig('review-before-commit', {
        stageOverrides: { testing: 'full-auto' },
        agentOverrides: { developer: 'supervised' },
      });

      expect(config.stageOverrides).toMatchObject({
        testing: 'full-auto',
      });
      expect(config.agentOverrides).toMatchObject({
        developer: 'supervised',
      });
    });
  });

  describe('Approval Gate Creation', () => {
    it('should create basic approval gate', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');

      expect(gate).toMatchObject({
        id: 'test-gate',
        name: 'Test Gate',
        type: 'before-commit',
        required: true,
        autoApprove: false,
      });
    });

    it('should create approval gate with custom config', () => {
      const gate = helpers.createApprovalGate('deploy-gate', 'Deploy Gate', 'before-deploy', {
        timeout: 60,
        minApprovals: 2,
        approvers: ['lead-1', 'lead-2'],
        autoApprove: false,
      });

      expect(gate).toMatchObject({
        id: 'deploy-gate',
        name: 'Deploy Gate',
        type: 'before-deploy',
        timeout: 60,
        minApprovals: 2,
        approvers: ['lead-1', 'lead-2'],
      });
    });
  });

  describe('Approval Flow Simulation', () => {
    it('should simulate approved flow', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
      const response = helpers.simulateApprovalFlow({
        gate,
        outcome: 'approved',
        responseTimeMs: 3000,
      });

      expect(response).toMatchObject({
        action: 'approve',
        response: 'approved',
        approver: 'test-user',
        reason: 'Approved by test user',
        responseTimeMs: 3000,
      });
    });

    it('should simulate denied flow', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
      const response = helpers.simulateApprovalFlow({
        gate,
        outcome: 'denied',
        responseTimeMs: 5000,
      });

      expect(response).toMatchObject({
        action: 'deny',
        response: 'denied',
        reason: 'Denied by test user',
        responseTimeMs: 5000,
      });
    });

    it('should simulate timeout scenario', () => {
      const response = helpers.simulateApprovalTimeout('before-commit', 30);

      expect(response).toMatchObject({
        action: 'deny',
        response: 'denied',
        reason: 'Approval timeout exceeded',
        responseTimeMs: 30 * 60 * 1000, // 30 minutes in milliseconds
      });
    });
  });

  describe('Autonomy Boundary Testing', () => {
    it('should test full-auto boundaries (no approval required)', () => {
      const result = helpers.testAutonomyBoundary({
        autonomyLevel: 'full-auto',
        action: 'write-file',
        shouldRequireApproval: false,
      });

      expect(result).toMatchObject({
        requiresApproval: false,
        checkpointType: null,
        reason: 'Full autonomy - no approval required',
      });
    });

    it('should test review-before-commit boundaries', () => {
      const commitResult = helpers.testAutonomyBoundary({
        autonomyLevel: 'review-before-commit',
        action: 'git-commit',
        shouldRequireApproval: true,
        expectedCheckpoint: 'before-commit',
      });

      expect(commitResult).toMatchObject({
        requiresApproval: true,
        checkpointType: 'before-commit',
      });

      const readResult = helpers.testAutonomyBoundary({
        autonomyLevel: 'review-before-commit',
        action: 'read-file',
        shouldRequireApproval: false,
      });

      expect(readResult).toMatchObject({
        requiresApproval: false,
        checkpointType: null,
      });
    });

    it('should test supervised boundaries (always requires approval)', () => {
      const result = helpers.testAutonomyBoundary({
        autonomyLevel: 'supervised',
        action: 'simple-read',
        shouldRequireApproval: true,
        expectedCheckpoint: 'custom',
      });

      expect(result).toMatchObject({
        requiresApproval: true,
        checkpointType: 'custom',
        reason: 'Supervised mode - all actions require approval',
      });
    });
  });

  describe('Mock Approval System', () => {
    it('should track approval requests and responses', () => {
      const approvalSystem = helpers.getMockApprovalSystem();

      const request = helpers.createApprovalRequest({
        requestId: 'test-approval',
        taskId: 'test-task',
        gateName: 'Test Gate',
        gateType: 'before-commit',
      });

      approvalSystem.createApprovalRequest(request);
      expect(approvalSystem.isPending('test-approval')).toBe(true);
      expect(approvalSystem.getPendingApprovals()).toHaveLength(1);

      const response = helpers.createApprovalResponse(
        'test-approval',
        'test-task',
        'Test Gate',
        true
      );

      approvalSystem.respondToApproval('test-approval', response);
      expect(approvalSystem.isPending('test-approval')).toBe(false);
      expect(approvalSystem.getApprovalResponse('test-approval')).toEqual(response);
    });
  });

  describe('Common Autonomy Scenarios', () => {
    it('should create all autonomy level configs', () => {
      const configs = helpers.createCommonAutonomyScenarios();

      expect(configs.fullAutomation.config.level).toBe('full-auto');
      expect(configs.reviewBeforeCommit.config.level).toBe('review-before-commit');
      expect(configs.reviewAll.config.level).toBe('review-all');
      expect(configs.fullSupervision.config.level).toBe('supervised');
    });
  });

  describe('Autonomy Test Scenarios', () => {
    it('should test boundary conditions for all autonomy levels', () => {
      const boundaries = AutonomyTestScenarios.boundaryConditions(helpers);

      expect(boundaries).toHaveLength(4);

      // Full-auto should not require approval
      const fullAutoResult = boundaries.find(b => b.scenario.autonomyLevel === 'full-auto');
      expect(fullAutoResult?.result.requiresApproval).toBe(false);

      // Supervised should always require approval
      const supervisedResult = boundaries.find(b => b.scenario.autonomyLevel === 'supervised');
      expect(supervisedResult?.result.requiresApproval).toBe(true);
    });
  });
});

describe('Combined APEX Test Helpers', () => {
  beforeEach(() => {
    apexTestHelpers.reset();
  });

  it('should provide access to both permission and autonomy helpers', () => {
    expect(apexTestHelpers.permission).toBeInstanceOf(PermissionTestHelpers);
    expect(apexTestHelpers.autonomy).toBeInstanceOf(AutonomyTestHelpers);
  });

  it('should create integrated scenarios', () => {
    const scenario = apexTestHelpers.createIntegratedScenario('review-before-commit', 'allow-always');

    expect(scenario.autonomyConfig.level).toBe('review-before-commit');
    expect(scenario.permissionScenarios).toBeDefined();
    expect(scenario.approvalFlow).toBeDefined();
    expect(scenario.permissionManager).toBeDefined();
  });

  it('should reset both helper systems', () => {
    // Set up some state
    apexTestHelpers.permission.getMockPermissionManager().configurePermissionCheck('Write', undefined, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });

    apexTestHelpers.autonomy.getMockApprovalSystem().createApprovalRequest({
      requestId: 'test',
      id: 'test',
      taskId: 'task',
      gateName: 'gate',
      gateType: 'before-commit',
      requestedAt: new Date(),
    });

    // Reset should clear all state
    apexTestHelpers.reset();

    // Verify state is cleared
    const permissionResult = apexTestHelpers.permission.getMockPermissionManager().checkPermission('Write');
    expect(permissionResult.allowed).toBe(false);

    const approvals = apexTestHelpers.autonomy.getMockApprovalSystem().getPendingApprovals();
    expect(approvals).toHaveLength(0);
  });
});