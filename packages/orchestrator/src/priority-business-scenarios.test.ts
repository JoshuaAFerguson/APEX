import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, TaskPriority, TaskEffort } from '@apexcli/core';

describe('Priority Tie-Breaking Business Scenarios', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-business-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Sprint Planning Scenarios', () => {
    it('should prioritize quick wins (high priority, low effort) in a sprint backlog', async () => {
      // Simulate a sprint planning scenario
      const sprintTasks = [
        createTestTask({
          id: 'feature_major_complex',
          description: 'Major feature implementation',
          priority: 'high',
          effort: 'xl',
        }),
        createTestTask({
          id: 'bug_critical_quick',
          description: 'Critical bug fix',
          priority: 'urgent',
          effort: 'small',
        }),
        createTestTask({
          id: 'feature_minor_quick',
          description: 'Minor feature addition',
          priority: 'high',
          effort: 'xs',
        }),
        createTestTask({
          id: 'refactor_cleanup',
          description: 'Code cleanup',
          priority: 'normal',
          effort: 'medium',
        }),
        createTestTask({
          id: 'documentation_update',
          description: 'Update documentation',
          priority: 'low',
          effort: 'small',
        }),
      ];

      for (const task of sprintTasks) {
        await store.createTask(task);
      }

      const prioritizedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = prioritizedTasks.map(t => t.id);

      // Expected order: urgent (small effort), then high priority by effort, then normal, then low
      expect(taskIds).toEqual([
        'bug_critical_quick',     // urgent + small effort - immediate fix needed
        'feature_minor_quick',    // high + xs effort - quick win
        'feature_major_complex',  // high + xl effort - important but time-consuming
        'refactor_cleanup',       // normal + medium effort
        'documentation_update',   // low + small effort
      ]);
    });

    it('should handle production incident triage correctly', async () => {
      // Simulate a production incident with multiple urgent issues
      const incidentTasks = [
        createTestTask({
          id: 'database_performance',
          description: 'Database performance degradation',
          priority: 'urgent',
          effort: 'large', // Requires investigation and optimization
        }),
        createTestTask({
          id: 'user_auth_broken',
          description: 'User authentication completely broken',
          priority: 'urgent',
          effort: 'medium', // Known issue with clear fix
        }),
        createTestTask({
          id: 'ui_button_missing',
          description: 'Critical UI button not visible',
          priority: 'urgent',
          effort: 'xs', // CSS fix
        }),
        createTestTask({
          id: 'monitoring_alert',
          description: 'Setup monitoring for similar issues',
          priority: 'high',
          effort: 'small', // Quick prevention measure
        }),
      ];

      for (const task of incidentTasks) {
        await store.createTask(task);
      }

      const triagePriority = await store.listTasks({ orderByPriority: true });
      const taskIds = triagePriority.map(t => t.id);

      // In production incident: fix quickest urgent issues first to restore service
      expect(taskIds).toEqual([
        'ui_button_missing',      // urgent + xs - immediate visual fix
        'user_auth_broken',       // urgent + medium - restore auth quickly
        'database_performance',   // urgent + large - complex but critical
        'monitoring_alert',       // high + small - prevention measure
      ]);
    });
  });

  describe('Resource Allocation Scenarios', () => {
    it('should optimize for team capacity with effort-based allocation', async () => {
      // Simulate tasks for a small team with limited capacity
      const teamTasks = [
        createTestTask({
          id: 'senior_complex_task',
          description: 'Complex architecture design',
          priority: 'high',
          effort: 'xl', // Senior developer needed
        }),
        createTestTask({
          id: 'junior_simple_task1',
          description: 'Add validation messages',
          priority: 'high',
          effort: 'xs', // Junior developer can handle
        }),
        createTestTask({
          id: 'junior_simple_task2',
          description: 'Update error messages',
          priority: 'high',
          effort: 'small', // Junior developer can handle
        }),
        createTestTask({
          id: 'mid_level_task',
          description: 'API endpoint implementation',
          priority: 'high',
          effort: 'medium', // Mid-level developer task
        }),
      ];

      for (const task of teamTasks) {
        await store.createTask(task);
      }

      const allocatedTasks = await store.listTasks({ orderByPriority: true });
      const taskIds = allocatedTasks.map(t => t.id);

      // Smaller tasks first allows parallel work and quicker wins
      expect(taskIds).toEqual([
        'junior_simple_task1',    // high + xs - quick win for junior dev
        'junior_simple_task2',    // high + small - another quick task
        'mid_level_task',         // high + medium - mid-level dev
        'senior_complex_task',    // high + xl - requires senior attention
      ]);
    });

    it('should handle deadline-driven prioritization', async () => {
      const now = new Date();
      const urgent_deadline = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour overdue
      const close_deadline = new Date(now.getTime() + 60 * 60 * 1000);  // 1 hour away
      const far_deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day away

      // Simulate deadline-driven work
      const deadlineTasks = [
        createTestTask({
          id: 'overdue_large_task',
          description: 'Overdue feature delivery',
          priority: 'urgent',
          effort: 'large',
          createdAt: urgent_deadline, // Use creation time as proxy for deadline
        }),
        createTestTask({
          id: 'overdue_quick_fix',
          description: 'Overdue hotfix',
          priority: 'urgent',
          effort: 'xs',
          createdAt: urgent_deadline,
        }),
        createTestTask({
          id: 'close_deadline_medium',
          description: 'Feature due soon',
          priority: 'high',
          effort: 'medium',
          createdAt: close_deadline,
        }),
        createTestTask({
          id: 'far_deadline_complex',
          description: 'Complex feature for next release',
          priority: 'normal',
          effort: 'xl',
          createdAt: far_deadline,
        }),
      ];

      for (const task of deadlineTasks) {
        await store.createTask(task);
      }

      const deadlinePriority = await store.listTasks({ orderByPriority: true });
      const taskIds = deadlinePriority.map(t => t.id);

      // Urgent tasks by effort (quick wins first), then high priority, then normal
      expect(taskIds).toEqual([
        'overdue_quick_fix',      // urgent + xs - fastest to complete
        'overdue_large_task',     // urgent + large - important but takes time
        'close_deadline_medium',  // high + medium - important with time pressure
        'far_deadline_complex',   // normal + xl - can be done when capacity allows
      ]);
    });
  });

  describe('Maintenance and Technical Debt Scenarios', () => {
    it('should balance feature work with technical debt', async () => {
      const maintenanceTasks = [
        createTestTask({
          id: 'new_customer_feature',
          description: 'New customer-facing feature',
          priority: 'high',
          effort: 'large',
        }),
        createTestTask({
          id: 'security_vulnerability',
          description: 'Fix security vulnerability',
          priority: 'urgent',
          effort: 'medium',
        }),
        createTestTask({
          id: 'performance_optimization',
          description: 'Optimize slow query',
          priority: 'high',
          effort: 'small',
        }),
        createTestTask({
          id: 'code_refactoring',
          description: 'Refactor legacy code',
          priority: 'normal',
          effort: 'large',
        }),
        createTestTask({
          id: 'dependency_update',
          description: 'Update critical dependency',
          priority: 'high',
          effort: 'xs',
        }),
      ];

      for (const task of maintenanceTasks) {
        await store.createTask(task);
      }

      const balancedPriority = await store.listTasks({ orderByPriority: true });
      const taskIds = balancedPriority.map(t => t.id);

      // Security first, then high-priority quick wins, then larger features
      expect(taskIds).toEqual([
        'security_vulnerability',     // urgent + medium - security always first
        'dependency_update',          // high + xs - quick maintenance win
        'performance_optimization',   // high + small - quick performance improvement
        'new_customer_feature',       // high + large - important feature work
        'code_refactoring',           // normal + large - technical debt when capacity allows
      ]);
    });

    it('should prioritize bug fixes appropriately', async () => {
      const bugFixTasks = [
        createTestTask({
          id: 'ui_cosmetic_bug',
          description: 'Minor UI alignment issue',
          priority: 'low',
          effort: 'xs',
        }),
        createTestTask({
          id: 'data_corruption_bug',
          description: 'User data corruption issue',
          priority: 'urgent',
          effort: 'large',
        }),
        createTestTask({
          id: 'form_validation_bug',
          description: 'Form validation not working',
          priority: 'high',
          effort: 'small',
        }),
        createTestTask({
          id: 'performance_regression',
          description: 'Page load speed regression',
          priority: 'high',
          effort: 'medium',
        }),
        createTestTask({
          id: 'login_edge_case',
          description: 'Login fails in edge case',
          priority: 'normal',
          effort: 'xs',
        }),
      ];

      for (const task of bugFixTasks) {
        await store.createTask(task);
      }

      const bugPriority = await store.listTasks({ orderByPriority: true });
      const taskIds = bugPriority.map(t => t.id);

      // Critical bugs first, then high priority by effort, then normal, then low
      expect(taskIds).toEqual([
        'data_corruption_bug',      // urgent + large - data integrity critical
        'form_validation_bug',      // high + small - user-facing, quick fix
        'performance_regression',   // high + medium - user experience important
        'login_edge_case',          // normal + xs - edge case, quick fix
        'ui_cosmetic_bug',          // low + xs - cosmetic, lowest priority
      ]);
    });
  });

  describe('Continuous Integration/Deployment Scenarios', () => {
    it('should handle build pipeline failures appropriately', async () => {
      const pipelineTasks = [
        createTestTask({
          id: 'production_build_broken',
          description: 'Production build pipeline broken',
          priority: 'urgent',
          effort: 'medium',
        }),
        createTestTask({
          id: 'test_flaky_quick_fix',
          description: 'Fix flaky test causing CI failures',
          priority: 'high',
          effort: 'xs',
        }),
        createTestTask({
          id: 'deployment_script_update',
          description: 'Update deployment scripts',
          priority: 'high',
          effort: 'small',
        }),
        createTestTask({
          id: 'test_coverage_improvement',
          description: 'Improve test coverage',
          priority: 'normal',
          effort: 'large',
        }),
        createTestTask({
          id: 'ci_optimization',
          description: 'Optimize CI pipeline performance',
          priority: 'normal',
          effort: 'medium',
        }),
      ];

      for (const task of pipelineTasks) {
        await store.createTask(task);
      }

      const pipelinePriority = await store.listTasks({ orderByPriority: true });
      const taskIds = pipelinePriority.map(t => t.id);

      // Production issues first, then preventive measures by effort
      expect(taskIds).toEqual([
        'production_build_broken',    // urgent + medium - blocks deployments
        'test_flaky_quick_fix',       // high + xs - quick CI stability improvement
        'deployment_script_update',   // high + small - deployment reliability
        'ci_optimization',            // normal + medium - performance improvement
        'test_coverage_improvement',  // normal + large - long-term quality
      ]);
    });
  });

  describe('Customer Support Driven Scenarios', () => {
    it('should prioritize customer-impacting issues correctly', async () => {
      const customerTasks = [
        createTestTask({
          id: 'customer_data_export_broken',
          description: 'Customer cannot export data',
          priority: 'urgent',
          effort: 'small',
        }),
        createTestTask({
          id: 'enterprise_sso_integration',
          description: 'Enterprise customer SSO not working',
          priority: 'urgent',
          effort: 'large',
        }),
        createTestTask({
          id: 'ui_confusing_workflow',
          description: 'UI workflow confusing to users',
          priority: 'high',
          effort: 'medium',
        }),
        createTestTask({
          id: 'feature_request_popular',
          description: 'Highly requested feature',
          priority: 'high',
          effort: 'xl',
        }),
        createTestTask({
          id: 'documentation_gap',
          description: 'Documentation missing for feature',
          priority: 'normal',
          effort: 'small',
        }),
      ];

      for (const task of customerTasks) {
        await store.createTask(task);
      }

      const customerPriority = await store.listTasks({ orderByPriority: true });
      const taskIds = customerPriority.map(t => t.id);

      // Customer-blocking issues first (by effort), then improvements
      expect(taskIds).toEqual([
        'customer_data_export_broken', // urgent + small - immediate customer pain
        'enterprise_sso_integration',   // urgent + large - enterprise blocker
        'ui_confusing_workflow',        // high + medium - user experience
        'feature_request_popular',      // high + xl - customer value, but large effort
        'documentation_gap',            // normal + small - support burden reduction
      ]);
    });
  });

  describe('Release Planning Scenarios', () => {
    it('should optimize release content by effort and priority', async () => {
      const releaseTasks = [
        createTestTask({
          id: 'release_blocker_fix',
          description: 'Fix release blocker bug',
          priority: 'urgent',
          effort: 'medium',
        }),
        createTestTask({
          id: 'quick_enhancement1',
          description: 'Quick UI enhancement',
          priority: 'high',
          effort: 'xs',
        }),
        createTestTask({
          id: 'quick_enhancement2',
          description: 'Quick API improvement',
          priority: 'high',
          effort: 'small',
        }),
        createTestTask({
          id: 'major_feature',
          description: 'Major new feature',
          priority: 'high',
          effort: 'xl',
        }),
        createTestTask({
          id: 'nice_to_have',
          description: 'Nice to have improvement',
          priority: 'normal',
          effort: 'medium',
        }),
      ];

      for (const task of releaseTasks) {
        await store.createTask(task);
      }

      const releasePriority = await store.listTasks({ orderByPriority: true });
      const taskIds = releasePriority.map(t => t.id);

      // Release blockers first, then package smaller wins before large features
      expect(taskIds).toEqual([
        'release_blocker_fix',    // urgent + medium - must be fixed for release
        'quick_enhancement1',     // high + xs - quick wins for release notes
        'quick_enhancement2',     // high + small - more quick wins
        'major_feature',          // high + xl - major deliverable but time-consuming
        'nice_to_have',           // normal + medium - include if time permits
      ]);
    });
  });
});