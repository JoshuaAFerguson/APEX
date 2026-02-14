import { describe, it, expect } from 'vitest';
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApprovalGate,
  createTaskResourceLimits,
  createAgentAutonomyOverride,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
  isValidAutonomyConfig,
} from '../autonomy-fixtures';
import {
  AutonomyConfigSchema,
  ApexConfigSchema,
  AutonomyLevel,
  RejectionBehavior,
} from '../../types';

describe('Autonomy Test Fixtures', () => {
  describe('AutonomyFixtures', () => {
    it('should provide valid fullAuto configuration', () => {
      const config = AutonomyFixtures.fullAuto;

      expect(config.level).toBe('full-auto');
      expect(config.rejectionBehavior).toBe('abort');
      expect(config.gates).toEqual([]);
      expect(config.limits?.maxTokensPerTask).toBe(1000000);
      expect(config.limits?.maxCostPerTask).toBe(10.0);
      expect(config.stageOverrides).toEqual({});
      expect(config.agentOverrides).toEqual({});

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid reviewBeforeCommit configuration', () => {
      const config = AutonomyFixtures.reviewBeforeCommit;

      expect(config.level).toBe('review-before-commit');
      expect(config.gates).toHaveLength(1);
      expect(config.gates[0].type).toBe('commit');
      expect(config.gates[0].required).toBe(true);
      expect(config.limits?.maxTokensPerTask).toBe(500000);

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid reviewAll configuration', () => {
      const config = AutonomyFixtures.reviewAll;

      expect(config.level).toBe('review-all');
      expect(config.rejectionBehavior).toBe('skip');
      expect(config.gates).toHaveLength(3);
      expect(config.gates.map(g => g.type)).toContain('code_change');
      expect(config.gates.map(g => g.type)).toContain('commit');
      expect(config.gates.map(g => g.type)).toContain('deployment');

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid semiAutoWithStageOverrides configuration', () => {
      const config = AutonomyFixtures.semiAutoWithStageOverrides;

      expect(config.level).toBe('review-before-commit');
      expect(config.stageOverrides?.planning).toBe('full-auto');
      expect(config.stageOverrides?.implementation).toBe('review-before-commit');
      expect(config.stageOverrides?.testing).toBe('review-all');

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid withAgentOverrides configuration', () => {
      const config = AutonomyFixtures.withAgentOverrides;

      expect(config.level).toBe('review-before-commit');
      expect(config.agentOverrides?.developer).toBe('full-auto');
      expect(typeof config.agentOverrides?.tester).toBe('object');
      expect(config.agentOverrides?.reviewer).toBe('review-before-commit');

      // Check the complex agent override
      const testerOverride = config.agentOverrides?.tester;
      if (typeof testerOverride === 'object' && testerOverride !== null) {
        expect(testerOverride.level).toBe('review-all');
        expect(testerOverride.approvalTimeout).toBe(10);
        expect(testerOverride.rejectionBehavior).toBe('skip');
      }

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid comprehensiveGates configuration', () => {
      const config = AutonomyFixtures.comprehensiveGates;

      expect(config.level).toBe('review-before-commit');
      expect(config.gates).toHaveLength(4);

      const gateTypes = config.gates.map(g => g.type);
      expect(gateTypes).toContain('planning');
      expect(gateTypes).toContain('code_change');
      expect(gateTypes).toContain('commit');
      expect(gateTypes).toContain('deployment');

      // Check required vs optional gates
      const planningGate = config.gates.find(g => g.type === 'planning');
      const codeChangeGate = config.gates.find(g => g.type === 'code_change');
      expect(planningGate?.required).toBe(true);
      expect(codeChangeGate?.required).toBe(false);

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should provide valid minimal configuration', () => {
      const config = AutonomyFixtures.minimal;

      expect(config.level).toBe('review-before-commit');
      // Minimal config should only have the level set
      expect(Object.keys(config)).toEqual(['level']);
    });
  });

  describe('createAutonomyConfig factory', () => {
    it('should create default configuration when called with no arguments', () => {
      const config = createAutonomyConfig();

      expect(config.level).toBe('review-before-commit');
      expect(config.rejectionBehavior).toBe('abort');
      expect(config.gates).toEqual([]);
      expect(config.limits?.maxTokensPerTask).toBe(500000);
      expect(config.limits?.maxCostPerTask).toBe(5.0);
      expect(config.limits?.timeoutMinutes).toBe(30);
      expect(config.stageOverrides).toEqual({});
      expect(config.agentOverrides).toEqual({});

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should apply overrides correctly', () => {
      const config = createAutonomyConfig({
        level: 'full-auto',
        rejectionBehavior: 'skip',
        limits: { maxTokensPerTask: 1000000 },
        stageOverrides: { testing: 'review-all' },
      });

      expect(config.level).toBe('full-auto');
      expect(config.rejectionBehavior).toBe('skip');
      expect(config.limits?.maxTokensPerTask).toBe(1000000);
      expect(config.limits?.maxCostPerTask).toBe(5.0); // Default preserved
      expect(config.stageOverrides?.testing).toBe('review-all');

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    it('should deep merge nested objects correctly', () => {
      const config = createAutonomyConfig({
        limits: { maxTokensPerTask: 999999 },
        stageOverrides: { planning: 'full-auto' },
        agentOverrides: { developer: 'review-all' },
      });

      // Should preserve other limit fields
      expect(config.limits?.maxTokensPerTask).toBe(999999);
      expect(config.limits?.maxCostPerTask).toBe(5.0);
      expect(config.limits?.timeoutMinutes).toBe(30);

      // Should contain the override
      expect(config.stageOverrides?.planning).toBe('full-auto');
      expect(config.agentOverrides?.developer).toBe('review-all');

      // Validate with Zod schema
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('createApprovalGate factory', () => {
    it('should create default approval gate', () => {
      const gate = createApprovalGate();

      expect(gate.type).toBe('commit');
      expect(gate.description).toBe('Test approval gate');
      expect(gate.required).toBe(true);
      expect(gate.stage).toBe('implementation');
    });

    it('should apply overrides correctly', () => {
      const gate = createApprovalGate({
        type: 'deployment',
        description: 'Custom deployment gate',
        required: false,
        stage: 'deployment',
      });

      expect(gate.type).toBe('deployment');
      expect(gate.description).toBe('Custom deployment gate');
      expect(gate.required).toBe(false);
      expect(gate.stage).toBe('deployment');
    });
  });

  describe('createTaskResourceLimits factory', () => {
    it('should create default resource limits', () => {
      const limits = createTaskResourceLimits();

      expect(limits.maxTokensPerTask).toBe(500000);
      expect(limits.maxCostPerTask).toBe(5.0);
      expect(limits.timeoutMinutes).toBe(30);
    });

    it('should apply overrides correctly', () => {
      const limits = createTaskResourceLimits({
        maxTokensPerTask: 1000000,
        timeoutMinutes: 60,
      });

      expect(limits.maxTokensPerTask).toBe(1000000);
      expect(limits.maxCostPerTask).toBe(5.0); // Default preserved
      expect(limits.timeoutMinutes).toBe(60);
    });
  });

  describe('createAgentAutonomyOverride factory', () => {
    it('should create default agent autonomy override', () => {
      const override = createAgentAutonomyOverride();

      expect(override.level).toBe('review-before-commit');
      expect(override.approvalTimeout).toBe(15);
      expect(override.rejectionBehavior).toBe('abort');
    });

    it('should apply overrides correctly', () => {
      const override = createAgentAutonomyOverride({
        level: 'full-auto',
        approvalTimeout: 30,
        rejectionBehavior: 'skip',
      });

      expect(override.level).toBe('full-auto');
      expect(override.approvalTimeout).toBe(30);
      expect(override.rejectionBehavior).toBe('skip');
    });
  });

  describe('createApexConfigWithAutonomy factory', () => {
    it('should create default APEX config with autonomy', () => {
      const config = createApexConfigWithAutonomy();

      expect(config.version).toBe('1.0');
      expect(config.project.name).toBe('test-project');
      expect(config.project.language).toBe('typescript');
      expect(config.autonomy?.level).toBe('review-before-commit');
      expect(config.agents?.enabled).toContain('planner');
      expect(config.git?.branchPrefix).toBe('apex/');

      // Validate with Zod schema
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });

    it('should apply autonomy config overrides', () => {
      const config = createApexConfigWithAutonomy(
        { level: 'full-auto', rejectionBehavior: 'skip' },
        { project: { name: 'custom-project' } }
      );

      expect(config.autonomy?.level).toBe('full-auto');
      expect(config.autonomy?.rejectionBehavior).toBe('skip');
      expect(config.project.name).toBe('custom-project');
      expect(config.project.language).toBe('typescript'); // Default preserved

      // Validate with Zod schema
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });

    it('should deep merge nested objects correctly', () => {
      const config = createApexConfigWithAutonomy(
        {},
        {
          project: { name: 'custom-name' },
          limits: { maxTokensPerTask: 750000 },
          git: { defaultBranch: 'develop' }
        }
      );

      // Should have custom values
      expect(config.project.name).toBe('custom-name');
      expect(config.limits?.maxTokensPerTask).toBe(750000);
      expect(config.git?.defaultBranch).toBe('develop');

      // Should preserve defaults
      expect(config.project.language).toBe('typescript');
      expect(config.limits?.maxCostPerTask).toBe(5.0);
      expect(config.git?.branchPrefix).toBe('apex/');

      // Validate with Zod schema
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('getAutonomyConfigVariations utility', () => {
    it('should provide multiple autonomy config variations', () => {
      const variations = getAutonomyConfigVariations();

      // Should have predefined fixtures
      expect(variations.fullAuto).toBeDefined();
      expect(variations.reviewBeforeCommit).toBeDefined();
      expect(variations.reviewAll).toBeDefined();
      expect(variations.withStageOverrides).toBeDefined();
      expect(variations.withAgentOverrides).toBeDefined();
      expect(variations.comprehensiveGates).toBeDefined();

      // Should have custom variations
      expect(variations.customMinimal).toBeDefined();
      expect(variations.customStrict).toBeDefined();

      // Validate all variations
      Object.values(variations).forEach(config => {
        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should provide distinct configurations', () => {
      const variations = getAutonomyConfigVariations();

      // Different autonomy levels
      expect(variations.fullAuto.level).toBe('full-auto');
      expect(variations.reviewBeforeCommit.level).toBe('review-before-commit');
      expect(variations.reviewAll.level).toBe('review-all');
      expect(variations.customMinimal.level).toBe('full-auto');
      expect(variations.customStrict.level).toBe('review-all');

      // Different configurations
      expect(variations.fullAuto.gates).toHaveLength(0);
      expect(variations.reviewAll.gates.length).toBeGreaterThan(0);
      expect(variations.withStageOverrides.stageOverrides).not.toEqual({});
      expect(variations.withAgentOverrides.agentOverrides).not.toEqual({});
    });
  });

  describe('isValidAutonomyConfig utility', () => {
    it('should validate correct autonomy configs', () => {
      expect(isValidAutonomyConfig(AutonomyFixtures.fullAuto)).toBe(true);
      expect(isValidAutonomyConfig(AutonomyFixtures.reviewBeforeCommit)).toBe(true);
      expect(isValidAutonomyConfig(createAutonomyConfig())).toBe(true);
    });

    it('should reject invalid configs', () => {
      expect(isValidAutonomyConfig(null)).toBe(false);
      expect(isValidAutonomyConfig(undefined)).toBe(false);
      expect(isValidAutonomyConfig({})).toBe(false);
      expect(isValidAutonomyConfig({ level: 'invalid' })).toBe(false);
      expect(isValidAutonomyConfig({ level: 'full-auto', rejectionBehavior: 'invalid' })).toBe(false);
      expect(isValidAutonomyConfig('string')).toBe(false);
      expect(isValidAutonomyConfig(123)).toBe(false);
    });

    it('should handle optional fields correctly', () => {
      expect(isValidAutonomyConfig({ level: 'full-auto' })).toBe(true);
      expect(isValidAutonomyConfig({
        level: 'review-before-commit',
        gates: [],
        limits: {},
        stageOverrides: {},
        agentOverrides: {}
      })).toBe(true);
    });
  });

  describe('Integration with existing autonomy levels', () => {
    it('should use valid autonomy level enum values', () => {
      const validLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];

      // Check all fixtures use valid levels
      expect(validLevels).toContain(AutonomyFixtures.fullAuto.level);
      expect(validLevels).toContain(AutonomyFixtures.reviewBeforeCommit.level);
      expect(validLevels).toContain(AutonomyFixtures.reviewAll.level);
      expect(validLevels).toContain(AutonomyFixtures.semiAutoWithStageOverrides.level);
      expect(validLevels).toContain(AutonomyFixtures.withAgentOverrides.level);

      // Check variations
      const variations = getAutonomyConfigVariations();
      Object.values(variations).forEach(config => {
        expect(validLevels).toContain(config.level);
      });
    });

    it('should use valid rejection behavior values', () => {
      const validBehaviors: RejectionBehavior[] = ['skip', 'abort'];

      // Check all fixtures use valid rejection behaviors
      expect(validBehaviors).toContain(AutonomyFixtures.fullAuto.rejectionBehavior);
      expect(validBehaviors).toContain(AutonomyFixtures.reviewBeforeCommit.rejectionBehavior);
      expect(validBehaviors).toContain(AutonomyFixtures.reviewAll.rejectionBehavior);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty overrides gracefully', () => {
      expect(() => createAutonomyConfig({})).not.toThrow();
      expect(() => createApprovalGate({})).not.toThrow();
      expect(() => createTaskResourceLimits({})).not.toThrow();
      expect(() => createAgentAutonomyOverride({})).not.toThrow();
      expect(() => createApexConfigWithAutonomy({}, {})).not.toThrow();
    });

    it('should handle partial overrides correctly', () => {
      const config = createAutonomyConfig({
        limits: { maxTokensPerTask: 999999 }
        // Other fields not specified
      });

      expect(config.limits?.maxTokensPerTask).toBe(999999);
      expect(config.limits?.maxCostPerTask).toBe(5.0); // Default
      expect(config.level).toBe('review-before-commit'); // Default
    });

    it('should preserve type safety', () => {
      // These should compile without TypeScript errors
      const config1: typeof AutonomyFixtures.fullAuto = AutonomyFixtures.fullAuto;
      const config2 = createAutonomyConfig({ level: 'full-auto' as AutonomyLevel });
      const variations = getAutonomyConfigVariations();

      expect(config1.level).toBe('full-auto');
      expect(config2.level).toBe('full-auto');
      expect(Object.keys(variations)).toContain('fullAuto');
    });
  });
});

describe('Usage Examples', () => {
  it('should support common test patterns', () => {
    // Example 1: Testing with different autonomy levels
    const levels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];
    levels.forEach(level => {
      const config = createAutonomyConfig({ level });
      expect(config.level).toBe(level);
      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
    });

    // Example 2: Testing with pre-built fixtures
    const fixtures = [
      AutonomyFixtures.fullAuto,
      AutonomyFixtures.reviewBeforeCommit,
      AutonomyFixtures.reviewAll,
    ];
    fixtures.forEach(fixture => {
      expect(isValidAutonomyConfig(fixture)).toBe(true);
      expect(() => AutonomyConfigSchema.parse(fixture)).not.toThrow();
    });

    // Example 3: Creating complete APEX configs for integration tests
    const apexConfig = createApexConfigWithAutonomy(
      { level: 'full-auto' },
      { project: { name: 'integration-test' } }
    );
    expect(apexConfig.project.name).toBe('integration-test');
    expect(apexConfig.autonomy?.level).toBe('full-auto');
    expect(() => ApexConfigSchema.parse(apexConfig)).not.toThrow();
  });
});