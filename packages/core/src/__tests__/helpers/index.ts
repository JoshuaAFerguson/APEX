/**
 * Test helpers for permission notification integration tests and autonomy/permission scenarios
 */
export { EventCollector } from './EventCollector';
export { WSTestClient } from './WSTestClient';
export { MockPermissionTrigger } from './MockPermissionTrigger';

// Permission and autonomy test helpers
export {
  PermissionTestHelpers,
  MockPermissionManager,
  PermissionTestScenarios,
  permissionTestHelpers,
} from './permission-test-helpers';

export type {
  TestPermissionConfig,
  PermissionCheckScenario,
  ApprovalFlowConfig,
} from './permission-test-helpers';

export {
  AutonomyTestHelpers,
  MockApprovalSystem,
  AutonomyTestScenarios,
  autonomyTestHelpers,
} from './autonomy-test-helpers';

export type {
  TestAutonomyConfig,
  ApprovalFlowScenario,
  AutonomyBoundaryScenario,
} from './autonomy-test-helpers';

/**
 * Combined test helpers for comprehensive testing scenarios
 */
export class ApexTestHelpers {
  public readonly permission = new PermissionTestHelpers();
  public readonly autonomy = new AutonomyTestHelpers();

  /**
   * Create a comprehensive test scenario combining permissions and autonomy
   */
  createIntegratedScenario(autonomyLevel: string, permissionLevel: string) {
    // Implementation would combine both helper systems
    return {
      autonomyConfig: this.autonomy.createAutonomyConfig(autonomyLevel as any),
      permissionScenarios: this.permission.createCommonPermissionScenarios(),
      approvalFlow: this.autonomy.getMockApprovalSystem(),
      permissionManager: this.permission.getMockPermissionManager(),
    };
  }

  /**
   * Reset all test state across both helper systems
   */
  reset(): void {
    this.permission.reset();
    this.autonomy.reset();
  }
}

/**
 * Singleton instance for convenience
 */
export const apexTestHelpers = new ApexTestHelpers();