/**
 * Simple compilation test for approval functionality
 */

import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, Task } from '@apexcli/core';

// Test basic instantiation and method call
const testConfig: PolicyConfig = {
  enabled: true,
  version: '1.0',
  enforcement: 'warn',
  tags: [],
  approvalRules: {
    enabled: true,
    rules: [{
      id: 'test-rule',
      name: 'Test Rule',
      enabled: true,
      tags: [],
      approvers: [],
      minApprovals: 1,
      priority: 0,
      requireAllConditions: false,
      urgency: 'normal',
      timeoutAction: 'reject',
      conditions: [{
        type: 'operation',
        operations: ['deploy'],
      }],
    }],
    defaultTimeoutMinutes: 60,
    defaultTimeoutAction: 'reject',
    globalApprovers: [],
    notificationsEnabled: true,
    auditLog: true,
  },
};

const enforcer = new PolicyEnforcer(testConfig);

const mockTask: Task = {
  id: 'test-task',
  description: 'Test task',
  acceptanceCriteria: 'Test criteria',
  workflow: 'test-workflow',
  autonomy: 'full-auto',
  status: 'pending',
  priority: 'normal',
  effort: 'medium',
  currentStage: 'implementation',
  projectPath: '/test',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCost: 1.0,
  },
  logs: [],
  artifacts: [],
};

// Test the new method
const result = enforcer.checkApprovalRequired(mockTask, 'deploy');

console.log('Compilation test passed!');
console.log('Approval required:', result.required);
console.log('Reason:', result.reason);

export { enforcer, mockTask, result };