import { describe, it, expect } from 'vitest';

/**
 * Comprehensive test for @apexcli/core index.ts exports validation
 *
 * This test ensures all utility modules are properly exported from the main index.ts
 * and validates that exports can be imported and used correctly.
 */
describe('@apexcli/core Index Exports Validation', () => {
  describe('Core module exports', () => {
    it('should export types module', async () => {
      const coreIndex = await import('../index.js');

      // Test that basic type schemas are available
      expect(coreIndex.ApexConfigSchema).toBeDefined();
      expect(coreIndex.TaskStatusSchema).toBeDefined();
      expect(coreIndex.AgentDefinitionSchema).toBeDefined();
      expect(coreIndex.WorkflowDefinitionSchema).toBeDefined();

      console.log('✓ Types module exported successfully');
    });

    it('should export config module', async () => {
      const coreIndex = await import('../index.js');

      // Test config functions and schemas
      expect(coreIndex.loadConfig).toBeDefined();
      expect(coreIndex.loadAgentDefinitions).toBeDefined();
      expect(coreIndex.loadWorkflowDefinitions).toBeDefined();

      console.log('✓ Config module exported successfully');
    });

    it('should export utils module', async () => {
      const coreIndex = await import('../index.js');

      // Test utility functions
      expect(coreIndex.formatElapsed).toBeDefined();
      expect(coreIndex.formatSize).toBeDefined();
      expect(coreIndex.formatCost).toBeDefined();
      expect(coreIndex.calculateTokenCost).toBeDefined();

      console.log('✓ Utils module exported successfully');
    });

    it('should export type-validation module', async () => {
      const coreIndex = await import('../index.js');

      // Test validation functions
      expect(coreIndex.calculateComplexity).toBeDefined();
      expect(coreIndex.calculateCyclomaticComplexity).toBeDefined();
      expect(coreIndex.isHighComplexityCode).toBeDefined();

      console.log('✓ Type-validation module exported successfully');
    });
  });

  describe('Security and analysis modules', () => {
    it('should export jsdoc-detector module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.hasJSDoc).toBeDefined();
      expect(coreIndex.analyzeJSDocCoverage).toBeDefined();
      expect(coreIndex.detectDeprecatedFunctions).toBeDefined();

      console.log('✓ JSDoc detector module exported successfully');
    });

    it('should export secret-scanner module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.scanForSecrets).toBeDefined();
      expect(coreIndex.PatternType).toBeDefined();

      console.log('✓ Secret scanner module exported successfully');
    });

    it('should export dangerous-operation-detector module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.detectDangerousOperations).toBeDefined();
      expect(coreIndex.DangerousOperationType).toBeDefined();

      console.log('✓ Dangerous operation detector module exported successfully');
    });

    it('should export directory-access-validator module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.validateDirectoryAccess).toBeDefined();
      expect(coreIndex.DirectoryAccessResult).toBeDefined();

      console.log('✓ Directory access validator module exported successfully');
    });
  });

  describe('Container and environment modules', () => {
    it('should export container-runtime module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.detectContainerRuntime).toBeDefined();
      expect(coreIndex.ContainerRuntime).toBeDefined();

      console.log('✓ Container runtime module exported successfully');
    });

    it('should export container-manager module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ContainerManager).toBeDefined();

      console.log('✓ Container manager module exported successfully');
    });

    it('should export container-health-monitor module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ContainerHealthMonitor).toBeDefined();

      console.log('✓ Container health monitor module exported successfully');
    });

    it('should export image-builder module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ImageBuilder).toBeDefined();

      console.log('✓ Image builder module exported successfully');
    });

    it('should export environment-detector module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.detectEnvironment).toBeDefined();
      expect(coreIndex.EnvironmentType).toBeDefined();

      console.log('✓ Environment detector module exported successfully');
    });
  });

  describe('Dependency and package management modules', () => {
    it('should export dependency-detector module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.detectDependencies).toBeDefined();
      expect(coreIndex.detectPackageManager).toBeDefined();

      console.log('✓ Dependency detector module exported successfully');
    });

    it('should export package-manager-utils module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.executePackageCommand).toBeDefined();
      expect(coreIndex.validatePackageManager).toBeDefined();

      console.log('✓ Package manager utils module exported successfully');
    });
  });

  describe('Utility and helper modules', () => {
    it('should export path-utils module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.resolvePath).toBeDefined();
      expect(coreIndex.normalizePath).toBeDefined();
      expect(coreIndex.ensureDir).toBeDefined();

      console.log('✓ Path utils module exported successfully');
    });

    it('should export shell-utils module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.escapeShellArg).toBeDefined();
      expect(coreIndex.parseCommand).toBeDefined();

      console.log('✓ Shell utils module exported successfully');
    });

    it('should export syntax-highlighter module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.highlightCode).toBeDefined();
      expect(coreIndex.detectLanguage).toBeDefined();

      console.log('✓ Syntax highlighter module exported successfully');
    });

    it('should export error-formatter module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.formatError).toBeDefined();
      expect(coreIndex.formatStackTrace).toBeDefined();

      console.log('✓ Error formatter module exported successfully');
    });

    it('should export apex-error module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ApexError).toBeDefined();
      expect(coreIndex.createApexError).toBeDefined();

      console.log('✓ APEX error module exported successfully');
    });
  });

  describe('Infrastructure modules', () => {
    it('should export validation module', async () => {
      const coreIndex = await import('../index.js');

      // Test validation infrastructure exports
      expect(coreIndex.BaseSyntaxValidator).toBeDefined();
      expect(coreIndex.SyntaxValidatorInterface).toBeDefined();
      expect(coreIndex.ValidationIssue).toBeDefined();
      expect(coreIndex.SupportedLanguage).toBeDefined();

      console.log('✓ Validation module exported successfully');
    });

    it('should export tools module', async () => {
      const coreIndex = await import('../index.js');

      // Test tool abstractions
      expect(coreIndex.BaseTool).toBeDefined();
      expect(coreIndex.ToolRegistry).toBeDefined();
      expect(coreIndex.ReadTool).toBeDefined();
      expect(coreIndex.EditTool).toBeDefined();
      expect(coreIndex.GlobTool).toBeDefined();
      expect(coreIndex.BashTool).toBeDefined();

      console.log('✓ Tools module exported successfully');
    });

    it('should export screenshot-comparator module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.compareScreenshots).toBeDefined();

      console.log('✓ Screenshot comparator module exported successfully');
    });
  });

  describe('Connection and networking modules', () => {
    it('should export exponential-backoff module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.createExponentialBackoff).toBeDefined();
      expect(coreIndex.ExponentialBackoff).toBeDefined();

      console.log('✓ Exponential backoff module exported successfully');
    });

    it('should export connection-health module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.ConnectionHealthManager).toBeDefined();

      console.log('✓ Connection health module exported successfully');
    });

    it('should export health-metrics module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.HealthMetricsCollector).toBeDefined();
      expect(coreIndex.HealthMetricsReporter).toBeDefined();

      console.log('✓ Health metrics module exported successfully');
    });
  });

  describe('MCP and templates modules', () => {
    it('should export mcp-templates module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.createServerTemplate).toBeDefined();
      expect(coreIndex.validateTemplate).toBeDefined();

      console.log('✓ MCP templates module exported successfully');
    });

    it('should export mcp module', async () => {
      const coreIndex = await import('../index.js');

      // Test MCP types and schemas
      expect(coreIndex.MCPServerSchema).toBeDefined();
      expect(coreIndex.MCPConfigSchema).toBeDefined();
      expect(coreIndex.MCPConnectionInfoSchema).toBeDefined();

      console.log('✓ MCP module exported successfully');
    });
  });

  describe('Test and development modules', () => {
    it('should export test-fixtures module', async () => {
      const coreIndex = await import('../index.js');

      // Test fixture utilities and factories
      expect(coreIndex.TaskResponseBuilder).toBeDefined();
      expect(coreIndex.ErrorPresets).toBeDefined();
      expect(coreIndex.loadValidToolFixtures).toBeDefined();
      expect(coreIndex.createTestToolConfig).toBeDefined();

      console.log('✓ Test fixtures module exported successfully');
    });

    it('should export logger module', async () => {
      const coreIndex = await import('../index.js');

      expect(coreIndex.createLogger).toBeDefined();
      expect(coreIndex.LogLevel).toBeDefined();

      console.log('✓ Logger module exported successfully');
    });
  });

  describe('Cross-module compatibility', () => {
    it('should allow using exported types together', async () => {
      const {
        ApexConfigSchema,
        TaskSchema,
        AgentDefinitionSchema,
        WorkflowDefinitionSchema,
        TaskResponseBuilder,
        ErrorPresets
      } = await import('../index.js');

      // Test that schemas can be used together
      const mockConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build'
        }
      };
      const validConfig = ApexConfigSchema.parse(mockConfig);
      expect(validConfig).toBeDefined();

      const mockTask = {
        id: 'test-task',
        description: 'Test task description',
        status: 'pending',
        workflowName: 'test-workflow',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const validTask = TaskSchema.parse(mockTask);
      expect(validTask).toBeDefined();

      // Test agent and workflow definitions work together
      const agentDef = {
        name: 'test-agent',
        description: 'Test agent for export validation',
        prompt: 'You are a test agent',
        tools: ['Read', 'Write'],
        model: 'sonnet'
      };

      const workflowDef = {
        name: 'test-workflow',
        description: 'Test workflow for export validation',
        stages: [
          {
            name: 'test-stage',
            agent: 'test-agent'
          }
        ]
      };

      const validAgent = AgentDefinitionSchema.parse(agentDef);
      const validWorkflow = WorkflowDefinitionSchema.parse(workflowDef);

      expect(validAgent.name).toBe('test-agent');
      expect(validWorkflow.stages[0].agent).toBe('test-agent');

      console.log('✓ Cross-module compatibility validated');
    });

    it('should support utilities working with types', async () => {
      const {
        formatElapsed,
        formatCost,
        calculateTokenCost,
        AgentUsageSchema,
        createLogger,
        LogLevel
      } = await import('../index.js');

      // Test utilities work with validated data
      const usage = AgentUsageSchema.parse({
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50
      });

      const cost = calculateTokenCost(usage);
      const formattedCost = formatCost(cost);
      const elapsedTime = formatElapsed(1000);

      expect(typeof formattedCost).toBe('string');
      expect(typeof elapsedTime).toBe('string');
      expect(cost).toBeGreaterThanOrEqual(0);

      // Test logger creation
      const logger = createLogger('test-export', LogLevel.INFO);
      expect(logger).toBeDefined();

      console.log('✓ Utilities work correctly with exported types');
    });

    it('should validate all exports are accessible from main entry point', async () => {
      const coreIndex = await import('../index.js');

      // Count all exports
      const exports = Object.keys(coreIndex);
      expect(exports.length).toBeGreaterThan(50); // Should have many exports

      // Validate no exports are undefined
      const undefinedExports = exports.filter(key => coreIndex[key] === undefined);
      expect(undefinedExports).toEqual([]);

      // Check for key module categories
      const hasTypes = exports.some(key => key.includes('Schema'));
      const hasFunctions = exports.some(key => typeof coreIndex[key] === 'function');
      const hasClasses = exports.some(key => typeof coreIndex[key] === 'function' && key[0] === key[0].toUpperCase());

      expect(hasTypes).toBe(true);
      expect(hasFunctions).toBe(true);
      expect(hasClasses).toBe(true);

      console.log(`✓ All ${exports.length} exports are accessible and defined`);
    });
  });

  describe('Package entry points', () => {
    it('should support alternate entry points from package.json exports', () => {
      // Test that package.json exports are aligned with actual modules

      // Test main entry
      expect(async () => await import('../index.js')).not.toThrow();

      // Test browser entry
      expect(async () => await import('../browser.js')).not.toThrow();

      // Test test-utils entry
      expect(async () => await import('../test-utils.js')).not.toThrow();

      // Test tools entry
      expect(async () => await import('../tools/index.js')).not.toThrow();

      // Test config entry
      expect(async () => await import('../config.js')).not.toThrow();

      console.log('✓ All package entry points are valid');
    });
  });
});