import { describe, it, expect } from 'vitest';

/**
 * Core Index Exports Validation Test
 *
 * This test ensures all utility modules are properly exported from the main index.ts
 * and validates that exports can be imported and used correctly.
 *
 * Acceptance Criteria: All utility modules are exported from index.ts, no missing exports
 */
describe('@apexcli/core Index Exports Validation', () => {
  describe('Essential module exports', () => {
    it('should export all essential modules from main index', async () => {
      const coreIndex = await import('../index.js');

      // Count total exports
      const exports = Object.keys(coreIndex);
      expect(exports.length).toBeGreaterThan(20); // Should have many exports

      // Check for no undefined exports
      const undefinedExports = exports.filter(key => coreIndex[key] === undefined);
      expect(undefinedExports).toEqual([]);

      console.log(`✓ ${exports.length} exports are defined and accessible`);
    });

    it('should export core types and schemas', async () => {
      const coreIndex = await import('../index.js');

      // Core type schemas should be available
      expect(coreIndex.ApexConfigSchema).toBeDefined();
      expect(coreIndex.AgentDefinitionSchema).toBeDefined();
      expect(coreIndex.WorkflowDefinitionSchema).toBeDefined();
      expect(coreIndex.TaskSchema).toBeDefined();

      console.log('✓ Core type schemas exported successfully');
    });

    it('should export configuration functions', async () => {
      const coreIndex = await import('../index.js');

      // Config loading functions
      expect(coreIndex.loadConfig).toBeDefined();
      expect(coreIndex.loadAgentDefinitions).toBeDefined();
      expect(coreIndex.loadWorkflowDefinitions).toBeDefined();

      console.log('✓ Configuration functions exported successfully');
    });

    it('should export utility functions', async () => {
      const coreIndex = await import('../index.js');

      // Core utilities
      expect(coreIndex.formatElapsed).toBeDefined();
      expect(coreIndex.formatSize).toBeDefined();
      expect(coreIndex.formatCost).toBeDefined();
      expect(coreIndex.calculateTokenCost).toBeDefined();

      console.log('✓ Utility functions exported successfully');
    });
  });

  describe('Security and validation modules', () => {
    it('should export security scanning functions', async () => {
      const coreIndex = await import('../index.js');

      // Security scanning
      expect(coreIndex.scanForSecrets).toBeDefined();
      expect(coreIndex.detectDangerousOperations).toBeDefined();
      expect(coreIndex.validateDirectoryAccess).toBeDefined();

      console.log('✓ Security scanning functions exported successfully');
    });

    it('should export analysis functions', async () => {
      const coreIndex = await import('../index.js');

      // Code analysis
      expect(coreIndex.hasJSDoc).toBeDefined();
      expect(coreIndex.analyzeJSDocCoverage).toBeDefined();
      expect(coreIndex.calculateComplexity).toBeDefined();
      expect(coreIndex.calculateCyclomaticComplexity).toBeDefined();

      console.log('✓ Code analysis functions exported successfully');
    });
  });

  describe('Environment and container modules', () => {
    it('should export environment detection functions', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.detectEnvironment).toBeDefined();
      expect(coreIndex.detectContainerRuntime).toBeDefined();
      expect(coreIndex.detectDependencies).toBeDefined();
      expect(coreIndex.detectPackageManager).toBeDefined();

      console.log('✓ Environment detection functions exported successfully');
    });

    it('should export container management classes', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ContainerManager).toBeDefined();
      expect(coreIndex.ContainerHealthMonitor).toBeDefined();
      expect(coreIndex.ImageBuilder).toBeDefined();

      console.log('✓ Container management classes exported successfully');
    });
  });

  describe('Utility and helper modules', () => {
    it('should export path and shell utilities', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.resolvePath).toBeDefined();
      expect(coreIndex.normalizePath).toBeDefined();
      expect(coreIndex.ensureDir).toBeDefined();
      expect(coreIndex.escapeShellArg).toBeDefined();
      expect(coreIndex.parseCommand).toBeDefined();

      console.log('✓ Path and shell utilities exported successfully');
    });

    it('should export formatting and error handling', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.highlightCode).toBeDefined();
      expect(coreIndex.detectLanguage).toBeDefined();
      expect(coreIndex.formatError).toBeDefined();
      expect(coreIndex.formatStackTrace).toBeDefined();
      expect(coreIndex.ApexError).toBeDefined();
      expect(coreIndex.createApexError).toBeDefined();

      console.log('✓ Formatting and error handling exported successfully');
    });

    it('should export package management utilities', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.executePackageCommand).toBeDefined();
      expect(coreIndex.validatePackageManager).toBeDefined();

      console.log('✓ Package management utilities exported successfully');
    });
  });

  describe('Tool and infrastructure modules', () => {
    it('should export base tool abstractions', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.BaseTool).toBeDefined();
      expect(coreIndex.ToolRegistry).toBeDefined();

      console.log('✓ Base tool abstractions exported successfully');
    });

    it('should export infrastructure components', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.compareScreenshots).toBeDefined();
      expect(coreIndex.createExponentialBackoff).toBeDefined();
      expect(coreIndex.ExponentialBackoff).toBeDefined();
      expect(coreIndex.ConnectionHealthManager).toBeDefined();

      console.log('✓ Infrastructure components exported successfully');
    });

    it('should export logging functionality', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.createLogger).toBeDefined();

      console.log('✓ Logging functionality exported successfully');
    });
  });

  describe('MCP and health modules', () => {
    it('should export MCP templates and types', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.createServerTemplate).toBeDefined();
      expect(coreIndex.validateTemplate).toBeDefined();
      expect(coreIndex.MCPServerSchema).toBeDefined();
      expect(coreIndex.MCPConfigSchema).toBeDefined();

      console.log('✓ MCP templates and types exported successfully');
    });

    it('should export health metrics components', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.HealthMetricsCollector).toBeDefined();
      expect(coreIndex.HealthMetricsReporter).toBeDefined();

      console.log('✓ Health metrics components exported successfully');
    });
  });

  describe('Test fixtures and validation', () => {
    it('should export test fixture utilities', async () => {
      const coreIndex = await import('../index.js');

      // Test fixture infrastructure
      expect(coreIndex.loadValidToolFixtures).toBeDefined();
      expect(coreIndex.createTestToolConfig).toBeDefined();
      expect(coreIndex.ErrorPresets).toBeDefined();

      console.log('✓ Test fixture utilities exported successfully');
    });

    it('should export validation infrastructure', async () => {
      const coreIndex = await import('../index.js');

      // Validation classes and interfaces
      expect(coreIndex.BaseSyntaxValidator).toBeDefined();

      console.log('✓ Validation infrastructure exported successfully');
    });
  });

  describe('Cross-module functionality', () => {
    it('should support cross-module type compatibility', async () => {
      const {
        ApexConfigSchema,
        AgentDefinitionSchema,
        formatElapsed,
        calculateTokenCost,
        createLogger
      } = await import('../index.js');

      // Test that types work together
      const config = {
        version: '1.0',
        project: {
          name: 'test-export-validation',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build'
        }
      };

      const validConfig = ApexConfigSchema.parse(config);
      expect(validConfig.project.name).toBe('test-export-validation');

      const agentDef = {
        name: 'test-agent',
        description: 'Test agent for export validation',
        prompt: 'You are a test agent',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      const validAgent = AgentDefinitionSchema.parse(agentDef);
      expect(validAgent.name).toBe('test-agent');

      // Test utilities work
      const elapsed = formatElapsed(1000);
      expect(typeof elapsed).toBe('string');

      const cost = calculateTokenCost({
        inputTokens: 100,
        outputTokens: 50
      });
      expect(typeof cost).toBe('number');

      const logger = createLogger('export-test');
      expect(logger).toBeDefined();

      console.log('✓ Cross-module functionality validated');
    });

    it('should validate all major export categories are present', async () => {
      const coreIndex = await import('../index.js');
      const exports = Object.keys(coreIndex);

      // Check for presence of different types of exports
      const hasSchemas = exports.some(key => key.endsWith('Schema'));
      const hasFunctions = exports.some(key => typeof coreIndex[key] === 'function');
      const hasClasses = exports.some(key =>
        typeof coreIndex[key] === 'function' &&
        key[0] === key[0].toUpperCase()
      );
      const hasConstants = exports.some(key =>
        typeof coreIndex[key] === 'object' &&
        key[0] === key[0].toUpperCase()
      );

      expect(hasSchemas).toBe(true);
      expect(hasFunctions).toBe(true);
      expect(hasClasses).toBe(true);

      console.log('✓ All major export categories are present');
      console.log(`  - Schemas: ${hasSchemas}`);
      console.log(`  - Functions: ${hasFunctions}`);
      console.log(`  - Classes: ${hasClasses}`);
      console.log(`  - Constants: ${hasConstants}`);
    });
  });

  describe('Package entry points validation', () => {
    it('should support documented entry points', async () => {
      // These should all be importable without errors
      await expect(import('../index.js')).resolves.toBeDefined();
      await expect(import('../browser.js')).resolves.toBeDefined();
      await expect(import('../test-utils.js')).resolves.toBeDefined();
      await expect(import('../tools/index.js')).resolves.toBeDefined();
      await expect(import('../config.js')).resolves.toBeDefined();

      console.log('✓ All documented entry points are importable');
    });

    it('should validate the main index contains expected core exports', async () => {
      const coreIndex = await import('../index.js');
      const exports = Object.keys(coreIndex);

      // Verify we have a reasonable number of exports
      expect(exports.length).toBeGreaterThan(50);

      // Verify no circular reference issues (all exports are defined)
      const definedExports = exports.filter(key => coreIndex[key] !== undefined);
      expect(definedExports.length).toBe(exports.length);

      // Check for specific key exports that should always be present
      const requiredExports = [
        'ApexConfigSchema',
        'loadConfig',
        'formatElapsed',
        'scanForSecrets',
        'createLogger'
      ];

      for (const required of requiredExports) {
        expect(coreIndex[required]).toBeDefined();
      }

      console.log(`✓ Main index has ${exports.length} well-defined exports`);
      console.log(`✓ All ${requiredExports.length} required exports present`);
    });
  });
});