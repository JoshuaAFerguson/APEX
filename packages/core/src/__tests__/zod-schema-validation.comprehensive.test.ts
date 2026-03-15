/**
 * Comprehensive test suite for APEX Zod Schema Validation
 *
 * This test suite validates all Zod schema definitions found in the audit
 * to ensure type safety and runtime validation work as expected.
 *
 * Tests cover:
 * - Schema structure validation
 * - Type inference verification
 * - Default value handling
 * - Validation error quality
 * - Edge cases and boundary conditions
 * - Complex nested schemas
 * - Union and discriminated union schemas
 *
 * @author QA Engineer - Testing Stage
 * @date 2026-03-01
 */

import { describe, it, expect, test } from 'vitest';
import { ZodError } from 'zod';
import {
  // Core Configuration Schemas
  ApexConfigSchema,
  ProjectConfigSchema,
  AutonomyConfigSchema,
  ModelsConfigSchema,
  AiProvidersConfigSchema,
  GitConfigSchema,
  LimitsConfigSchema,
  UIConfigSchema,
  DaemonConfigSchema,
  LoggingConfigSchema,

  // Agent & Tool Management
  AgentDefinitionSchema,
  AgentModelSchema,
  AgentToolSchema,
  ToolCategorySchema,
  BaseToolPermissionConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,

  // Security & Access Control
  PermissionSchema,
  PermissionLevelSchema,
  DirectoryAccessConfigSchema,
  SecretScannerConfigSchema,
  PolicyConfigSchema,
  GuardrailConfigSchema,

  // MCP & Integration
  MCPConfigSchema,
  MCPServerConfigSchema,
  MCPConnectionConfigSchema,
  MCPEnvironmentVarSchema,

  // Workflow & Task Management
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  ApprovalGateSchema,

  // Browser Automation
  BrowserOperationSchema,
  BrowserToolInputSchema,
  BrowserToolOutputSchema,
  ConsoleMessageSchema,
  BrowserErrorSchema,
  ScreenshotComparisonResultSchema,

  // Type imports for validation
  type ApexConfig,
  type AgentDefinition,
  type WorkflowDefinition,
  type MCPConfig,
} from '../types.js';

describe('Zod Schema Validation - Core Configuration Schemas', () => {
  describe('ApexConfigSchema', () => {
    it('should validate a minimal configuration', () => {
      const minimalConfig = {
        project: { name: 'test-project' }
      };

      const result = ApexConfigSchema.parse(minimalConfig);
      expect(result).toBeDefined();
      expect(result.project.name).toBe('test-project');
      expect(result.version).toBe('1.0'); // Default value
    });

    it('should validate a complete configuration', () => {
      const completeConfig = {
        version: '1.0',
        project: {
          name: 'comprehensive-project',
          description: 'A comprehensive test project',
          version: '2.1.0',
          language: 'typescript'
        },
        autonomy: {
          level: 'review-before-commit',
          approvalRequired: ['shell', 'filesystem']
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
          default: 'sonnet'
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          autoCommit: false,
          autoPush: false
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
          maxRetries: 3
        },
        tools: {
          filesystem: {
            enabled: true,
            requireConfirmation: false,
            maxFileSize: 1048576,
            allowedExtensions: ['.ts', '.js', '.json'],
            blockedExtensions: ['.exe', '.bat']
          }
        },
        mcp: {
          enabled: true,
          servers: [{
            name: 'filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem', './'],
            env: { NODE_ENV: 'production' }
          }]
        }
      };

      const result = ApexConfigSchema.parse(completeConfig);
      expect(result).toBeDefined();
      expect(result.project.name).toBe('comprehensive-project');
      expect(result.models?.planning).toBe('opus');
      expect(result.limits?.maxTokensPerTask).toBe(500000);
    });

    it('should reject invalid configurations with descriptive errors', () => {
      const invalidConfig = {
        project: {
          name: 123 // Invalid type
        },
        autonomy: {
          level: 'invalid-autonomy-level' // Invalid enum value
        },
        models: {
          planning: 'gpt-4' // Invalid model name
        },
        limits: {
          maxTokensPerTask: -1, // Invalid negative value
          maxConcurrentTasks: 0 // Invalid zero value
        }
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow(ZodError);
    });

    it('should handle optional fields with defaults', () => {
      const configWithOptionals = {
        project: { name: 'optional-test' }
      };

      const result = ApexConfigSchema.parse(configWithOptionals);
      expect(result.version).toBe('1.0'); // Default from schema
      expect(result.autonomy).toBeUndefined();
      expect(result.models).toBeUndefined();
    });
  });

  describe('ProjectConfigSchema', () => {
    it('should validate minimal project config', () => {
      const projectConfig = {
        name: 'test-project'
      };

      const result = ProjectConfigSchema.parse(projectConfig);
      expect(result.name).toBe('test-project');
    });

    it('should validate complete project config', () => {
      const projectConfig = {
        name: 'comprehensive-project',
        description: 'A comprehensive test project',
        version: '2.1.0',
        language: 'typescript',
        author: 'Test Author',
        repository: 'https://github.com/test/project'
      };

      const result = ProjectConfigSchema.parse(projectConfig);
      expect(result.name).toBe('comprehensive-project');
      expect(result.language).toBe('typescript');
    });

    it('should reject invalid project names', () => {
      expect(() => ProjectConfigSchema.parse({ name: '' })).toThrow();
      expect(() => ProjectConfigSchema.parse({ name: 123 })).toThrow();
    });
  });

  describe('AutonomyConfigSchema', () => {
    it('should validate all autonomy levels', () => {
      const validLevels = [
        'full-autonomy',
        'review-before-commit',
        'review-each-step',
        'manual-approval'
      ];

      validLevels.forEach(level => {
        const config = { level };
        const result = AutonomyConfigSchema.parse(config);
        expect(result.level).toBe(level);
      });
    });

    it('should reject invalid autonomy levels', () => {
      const invalidConfig = { level: 'invalid-level' };
      expect(() => AutonomyConfigSchema.parse(invalidConfig)).toThrow(ZodError);
    });

    it('should handle approval requirements', () => {
      const config = {
        level: 'review-before-commit',
        approvalRequired: ['shell', 'filesystem', 'web']
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.approvalRequired).toHaveLength(3);
    });
  });

  describe('ModelsConfigSchema', () => {
    it('should validate all valid model names', () => {
      const validModels = ['opus', 'sonnet', 'haiku', 'inherit'];

      validModels.forEach(model => {
        const config = { planning: model };
        const result = ModelsConfigSchema.parse(config);
        expect(result.planning).toBe(model);
      });
    });

    it('should validate complete model configuration', () => {
      const modelConfig = {
        planning: 'opus',
        implementation: 'sonnet',
        review: 'haiku',
        default: 'sonnet'
      };

      const result = ModelsConfigSchema.parse(modelConfig);
      expect(result.planning).toBe('opus');
      expect(result.implementation).toBe('sonnet');
      expect(result.review).toBe('haiku');
      expect(result.default).toBe('sonnet');
    });

    it('should reject invalid model names', () => {
      const invalidConfig = { planning: 'gpt-4' };
      expect(() => ModelsConfigSchema.parse(invalidConfig)).toThrow(ZodError);
    });
  });

  describe('LimitsConfigSchema', () => {
    it('should validate positive numeric limits', () => {
      const limitsConfig = {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        dailyBudget: 100.0,
        maxTurns: 100,
        maxConcurrentTasks: 3,
        maxRetries: 3
      };

      const result = LimitsConfigSchema.parse(limitsConfig);
      expect(result.maxTokensPerTask).toBe(500000);
      expect(result.maxCostPerTask).toBe(10.0);
      expect(result.dailyBudget).toBe(100.0);
    });

    it('should reject negative or zero limits', () => {
      expect(() => LimitsConfigSchema.parse({ maxTokensPerTask: -1 })).toThrow();
      expect(() => LimitsConfigSchema.parse({ maxCostPerTask: 0 })).toThrow();
      expect(() => LimitsConfigSchema.parse({ maxConcurrentTasks: 0 })).toThrow();
    });

    it('should handle optional limits', () => {
      const minimalLimits = { maxTokensPerTask: 100000 };
      const result = LimitsConfigSchema.parse(minimalLimits);
      expect(result.maxTokensPerTask).toBe(100000);
    });
  });
});

describe('Zod Schema Validation - Agent & Tool Management', () => {
  describe('AgentDefinitionSchema', () => {
    it('should validate minimal agent definition', () => {
      const agentDef = {
        name: 'test-agent',
        description: 'A test agent',
        model: 'sonnet' as const,
        prompt: 'You are a test agent.'
      };

      const result = AgentDefinitionSchema.parse(agentDef);
      expect(result.name).toBe('test-agent');
      expect(result.model).toBe('sonnet');
    });

    it('should validate complete agent definition', () => {
      const agentDef = {
        name: 'comprehensive-agent',
        description: 'A comprehensive test agent',
        model: 'opus' as const,
        tools: ['Read', 'Write', 'Edit', 'Bash'],
        skills: ['typescript', 'testing', 'debugging'],
        prompt: 'You are a comprehensive test agent with multiple capabilities.',
        promptVersion: '1.0'
      };

      const result = AgentDefinitionSchema.parse(agentDef);
      expect(result.name).toBe('comprehensive-agent');
      expect(result.tools).toHaveLength(4);
      expect(result.skills).toContain('typescript');
    });

    it('should validate agent models', () => {
      const validModels = ['opus', 'sonnet', 'haiku', 'inherit'];

      validModels.forEach(model => {
        const agentDef = {
          name: 'model-test-agent',
          description: 'Model test',
          model: model as any,
          prompt: 'Test prompt'
        };

        const result = AgentDefinitionSchema.parse(agentDef);
        expect(result.model).toBe(model);
      });
    });

    it('should reject invalid agent model', () => {
      const agentDef = {
        name: 'invalid-agent',
        description: 'Invalid model test',
        model: 'gpt-4',
        prompt: 'Test prompt'
      };

      expect(() => AgentDefinitionSchema.parse(agentDef)).toThrow();
    });

    it('should reject empty prompt', () => {
      const agentDef = {
        name: 'empty-prompt-agent',
        description: 'Agent with empty prompt',
        model: 'sonnet',
        prompt: ''
      };

      expect(() => AgentDefinitionSchema.parse(agentDef)).toThrow();
    });
  });

  describe('Tool Configuration Schemas', () => {
    describe('FilesystemToolConfigSchema', () => {
      it('should validate filesystem tool configuration', () => {
        const toolConfig = {
          enabled: true,
          requireConfirmation: false,
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js', '.json'],
          blockedExtensions: ['.exe', '.bat'],
          allowedDirectories: ['/src', '/tests'],
          blockedDirectories: ['/node_modules', '/dist']
        };

        const result = FilesystemToolConfigSchema.parse(toolConfig);
        expect(result.enabled).toBe(true);
        expect(result.maxFileSize).toBe(1048576);
        expect(result.allowedExtensions).toHaveLength(3);
      });

      it('should reject invalid file size', () => {
        const invalidConfig = {
          enabled: true,
          maxFileSize: -1
        };

        expect(() => FilesystemToolConfigSchema.parse(invalidConfig)).toThrow();
      });
    });

    describe('ShellToolConfigSchema', () => {
      it('should validate shell tool configuration', () => {
        const toolConfig = {
          enabled: true,
          requireConfirmation: true,
          blockedCommands: ['rm -rf /', 'format', 'sudo'],
          allowElevatedPrivileges: false,
          environment: { NODE_ENV: 'development', PATH: '/usr/bin' }
        };

        const result = ShellToolConfigSchema.parse(toolConfig);
        expect(result.enabled).toBe(true);
        expect(result.blockedCommands).toHaveLength(3);
        expect(result.environment?.NODE_ENV).toBe('development');
      });
    });

    describe('WebToolConfigSchema', () => {
      it('should validate web tool configuration', () => {
        const toolConfig = {
          enabled: true,
          requireConfirmation: false,
          allowedDomains: ['api.openai.com', 'api.anthropic.com'],
          blockedDomains: ['malicious.com'],
          maxResponseSize: 5242880,
          followRedirects: true,
          timeout: 30000
        };

        const result = WebToolConfigSchema.parse(toolConfig);
        expect(result.enabled).toBe(true);
        expect(result.allowedDomains).toHaveLength(2);
        expect(result.maxResponseSize).toBe(5242880);
      });
    });

    describe('BrowserToolConfigSchema', () => {
      it('should validate browser tool configuration', () => {
        const toolConfig = {
          enabled: true,
          requireConfirmation: true,
          allowedDomains: ['localhost', 'test.example.com'],
          engine: 'chromium' as const,
          backend: 'playwright' as const,
          headless: true,
          viewport: { width: 1920, height: 1080 },
          timeout: 30000
        };

        const result = BrowserToolConfigSchema.parse(toolConfig);
        expect(result.enabled).toBe(true);
        expect(result.engine).toBe('chromium');
        expect(result.viewport?.width).toBe(1920);
      });

      it('should validate browser engines', () => {
        const validEngines = ['chromium', 'firefox', 'webkit'];

        validEngines.forEach(engine => {
          const config = {
            enabled: true,
            engine: engine as any,
            backend: 'playwright' as const
          };

          const result = BrowserToolConfigSchema.parse(config);
          expect(result.engine).toBe(engine);
        });
      });
    });
  });
});

describe('Zod Schema Validation - Security & Access Control', () => {
  describe('PermissionSchema', () => {
    it('should validate permission with expiry', () => {
      const permission = {
        level: 'allow-once' as const,
        granted: new Date('2026-03-01T10:00:00Z'),
        expires: new Date('2026-03-01T11:00:00Z'),
        scope: 'filesystem',
        grantedBy: 'user'
      };

      const result = PermissionSchema.parse(permission);
      expect(result.level).toBe('allow-once');
      expect(result.scope).toBe('filesystem');
    });

    it('should validate permission levels', () => {
      const validLevels = ['allow-always', 'allow-once', 'deny'];

      validLevels.forEach(level => {
        const permission = {
          level: level as any,
          granted: new Date(),
          scope: 'test'
        };

        const result = PermissionSchema.parse(permission);
        expect(result.level).toBe(level);
      });
    });
  });

  describe('DirectoryAccessConfigSchema', () => {
    it('should validate directory access patterns', () => {
      const accessConfig = {
        allowedPatterns: ['/src/**', '/tests/**'],
        blockedPatterns: ['/node_modules/**', '/dist/**'],
        defaultAllow: false
      };

      const result = DirectoryAccessConfigSchema.parse(accessConfig);
      expect(result.allowedPatterns).toHaveLength(2);
      expect(result.defaultAllow).toBe(false);
    });
  });

  describe('SecretScannerConfigSchema', () => {
    it('should validate secret scanner configuration', () => {
      const scannerConfig = {
        enabled: true,
        patterns: [
          { name: 'API Key', pattern: 'api[_-]?key[_-]?[=:]\\s*[\'"]?([a-zA-Z0-9]{32,})', severity: 'high' },
          { name: 'Password', pattern: 'password[_-]?[=:]\\s*[\'"]?([^\\s\'";]{8,})', severity: 'medium' }
        ],
        maskSecrets: true,
        failOnSecrets: true
      };

      const result = SecretScannerConfigSchema.parse(scannerConfig);
      expect(result.enabled).toBe(true);
      expect(result.patterns).toHaveLength(2);
      expect(result.maskSecrets).toBe(true);
    });
  });
});

describe('Zod Schema Validation - MCP & Integration', () => {
  describe('MCPConfigSchema', () => {
    it('should validate MCP configuration', () => {
      const mcpConfig = {
        enabled: true,
        servers: [{
          name: 'filesystem',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', './'],
          env: { NODE_ENV: 'production' },
          cwd: '/opt/mcp',
          timeout: 30000
        }],
        globalEnv: { PYTHONPATH: '/opt/mcp-servers' }
      };

      const result = MCPConfigSchema.parse(mcpConfig);
      expect(result.enabled).toBe(true);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('filesystem');
    });

    it('should validate multiple MCP servers', () => {
      const mcpConfig = {
        enabled: true,
        servers: [
          {
            name: 'database',
            command: 'python',
            args: ['-m', 'mcp_server_postgresql'],
            env: { DB_HOST: 'localhost' }
          },
          {
            name: 'monitoring',
            command: 'node',
            args: ['monitoring-server.js'],
            cwd: '/opt/monitoring'
          }
        ]
      };

      const result = MCPConfigSchema.parse(mcpConfig);
      expect(result.servers).toHaveLength(2);
      expect(result.servers[0].name).toBe('database');
      expect(result.servers[1].name).toBe('monitoring');
    });
  });

  describe('MCPServerConfigSchema', () => {
    it('should validate minimal MCP server config', () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js']
      };

      const result = MCPServerConfigSchema.parse(serverConfig);
      expect(result.name).toBe('test-server');
      expect(result.command).toBe('node');
    });

    it('should validate complete MCP server config', () => {
      const serverConfig = {
        name: 'complete-server',
        command: 'python',
        args: ['-m', 'server_module'],
        env: { SERVER_PORT: '3000', DEBUG: 'true' },
        cwd: '/opt/servers/complete',
        timeout: 60000
      };

      const result = MCPServerConfigSchema.parse(serverConfig);
      expect(result.name).toBe('complete-server');
      expect(result.env?.SERVER_PORT).toBe('3000');
      expect(result.timeout).toBe(60000);
    });
  });
});

describe('Zod Schema Validation - Workflow & Task Management', () => {
  describe('WorkflowDefinitionSchema', () => {
    it('should validate minimal workflow definition', () => {
      const workflow = {
        name: 'simple-workflow',
        description: 'A simple test workflow',
        stages: [{
          name: 'planning',
          agent: 'planner',
          description: 'Plan the task'
        }]
      };

      const result = WorkflowDefinitionSchema.parse(workflow);
      expect(result.name).toBe('simple-workflow');
      expect(result.stages).toHaveLength(1);
    });

    it('should validate complex workflow definition', () => {
      const workflow = {
        name: 'feature-development',
        description: 'Complete feature development workflow',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Analyze requirements and create implementation plan'
          },
          {
            name: 'architecture',
            agent: 'architect',
            description: 'Design system architecture and data models'
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the planned features'
          },
          {
            name: 'testing',
            agent: 'tester',
            description: 'Create and run comprehensive tests'
          }
        ],
        approvalGates: ['after-planning', 'before-deployment']
      };

      const result = WorkflowDefinitionSchema.parse(workflow);
      expect(result.stages).toHaveLength(4);
      expect(result.approvalGates).toHaveLength(2);
    });

    it('should reject workflow with empty stages', () => {
      const invalidWorkflow = {
        name: 'empty-workflow',
        description: 'Workflow with no stages',
        stages: []
      };

      expect(() => WorkflowDefinitionSchema.parse(invalidWorkflow)).toThrow();
    });
  });

  describe('WorkflowStageSchema', () => {
    it('should validate stage with required fields', () => {
      const stage = {
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the feature'
      };

      const result = WorkflowStageSchema.parse(stage);
      expect(result.name).toBe('implementation');
      expect(result.agent).toBe('developer');
    });

    it('should validate stage with optional fields', () => {
      const stage = {
        name: 'testing',
        agent: 'tester',
        description: 'Run comprehensive tests',
        timeout: 3600,
        retries: 2,
        dependencies: ['implementation'],
        approvalRequired: true
      };

      const result = WorkflowStageSchema.parse(stage);
      expect(result.timeout).toBe(3600);
      expect(result.dependencies).toContain('implementation');
      expect(result.approvalRequired).toBe(true);
    });
  });
});

describe('Zod Schema Validation - Browser Automation', () => {
  describe('BrowserOperationSchema', () => {
    it('should validate all supported browser operations', () => {
      const validOperations = [
        'navigate', 'click', 'type', 'scroll', 'screenshot',
        'wait', 'evaluate', 'select', 'hover', 'press_key',
        'upload_file', 'download_file', 'get_element_text'
      ];

      validOperations.forEach(operation => {
        const result = BrowserOperationSchema.parse(operation);
        expect(result).toBe(operation);
      });
    });

    it('should reject invalid browser operations', () => {
      expect(() => BrowserOperationSchema.parse('invalid-operation')).toThrow();
    });
  });

  describe('BrowserToolInputSchema', () => {
    it('should validate navigate operation input', () => {
      const navigateInput = {
        operation: 'navigate' as const,
        url: 'https://example.com',
        waitFor: 'load',
        timeout: 30000
      };

      const result = BrowserToolInputSchema.parse(navigateInput);
      expect(result.operation).toBe('navigate');
      expect(result.url).toBe('https://example.com');
    });

    it('should validate click operation input', () => {
      const clickInput = {
        operation: 'click' as const,
        selector: '#submit-button',
        timeout: 5000
      };

      const result = BrowserToolInputSchema.parse(clickInput);
      expect(result.operation).toBe('click');
      expect(result.selector).toBe('#submit-button');
    });
  });

  describe('ConsoleMessageSchema', () => {
    it('should validate console message', () => {
      const consoleMsg = {
        type: 'error' as const,
        text: 'ReferenceError: undefined variable',
        timestamp: new Date(),
        location: { url: 'https://example.com/script.js', lineNumber: 42 }
      };

      const result = ConsoleMessageSchema.parse(consoleMsg);
      expect(result.type).toBe('error');
      expect(result.location?.lineNumber).toBe(42);
    });
  });

  describe('BrowserErrorSchema', () => {
    it('should validate browser error', () => {
      const browserError = {
        name: 'TimeoutError',
        message: 'Element not found within timeout',
        stack: 'TimeoutError: Element not found...',
        timestamp: new Date(),
        operation: 'click',
        selector: '#missing-element'
      };

      const result = BrowserErrorSchema.parse(browserError);
      expect(result.name).toBe('TimeoutError');
      expect(result.operation).toBe('click');
    });
  });
});

describe('Zod Schema Validation - Type Inference', () => {
  it('should properly infer ApexConfig type', () => {
    const config = {
      project: { name: 'type-inference-test' },
      models: { planning: 'opus' as const, implementation: 'sonnet' as const }
    };

    const parsed = ApexConfigSchema.parse(config);

    // TypeScript should infer these types correctly
    const projectName: string = parsed.project.name;
    const planningModel: 'opus' | 'sonnet' | 'haiku' | 'inherit' | undefined = parsed.models?.planning;

    expect(projectName).toBe('type-inference-test');
    expect(planningModel).toBe('opus');
  });

  it('should properly infer AgentDefinition type', () => {
    const agentDef = {
      name: 'inference-agent',
      description: 'Type inference test agent',
      model: 'sonnet' as const,
      tools: ['Read', 'Write'] as const,
      prompt: 'You are a test agent.'
    };

    const parsed = AgentDefinitionSchema.parse(agentDef);

    // TypeScript should infer these types correctly
    const agentName: string = parsed.name;
    const agentModel: 'opus' | 'sonnet' | 'haiku' | 'inherit' = parsed.model;
    const agentTools: string[] | undefined = parsed.tools;

    expect(agentName).toBe('inference-agent');
    expect(agentModel).toBe('sonnet');
    expect(agentTools).toEqual(['Read', 'Write']);
  });
});

describe('Zod Schema Validation - Error Handling Quality', () => {
  it('should provide detailed error messages for validation failures', () => {
    const invalidConfig = {
      project: {
        name: '', // Empty string should fail
        version: 123 // Wrong type
      },
      autonomy: {
        level: 'invalid-level' // Invalid enum
      },
      limits: {
        maxTokensPerTask: -1, // Negative number
        maxConcurrentTasks: 0 // Zero value
      }
    };

    try {
      ApexConfigSchema.parse(invalidConfig);
      expect.fail('Should have thrown validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;

      // Should have multiple validation issues
      expect(zodError.issues.length).toBeGreaterThan(0);

      // Check that error paths are correct
      const projectNameError = zodError.issues.find(issue =>
        issue.path.includes('name')
      );
      expect(projectNameError).toBeDefined();

      const autonomyLevelError = zodError.issues.find(issue =>
        issue.path.includes('level')
      );
      expect(autonomyLevelError).toBeDefined();
    }
  });

  it('should provide clear error messages for enum violations', () => {
    const invalidAgentModel = {
      name: 'test-agent',
      description: 'Test agent',
      model: 'gpt-4', // Invalid model
      prompt: 'Test prompt'
    };

    try {
      AgentDefinitionSchema.parse(invalidAgentModel);
      expect.fail('Should have thrown validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;

      const modelError = zodError.issues.find(issue =>
        issue.path.includes('model')
      );
      expect(modelError).toBeDefined();
      expect(modelError?.code).toBe('invalid_enum_value');
    }
  });

  it('should provide context for nested validation errors', () => {
    const invalidNestedConfig = {
      project: { name: 'test' },
      tools: {
        filesystem: {
          enabled: true,
          maxFileSize: -1, // Invalid negative
          allowedExtensions: 'not-an-array' // Wrong type
        }
      }
    };

    try {
      ApexConfigSchema.parse(invalidNestedConfig);
      expect.fail('Should have thrown validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;

      // Should have errors with proper nested paths
      const fileSystemErrors = zodError.issues.filter(issue =>
        issue.path.includes('filesystem')
      );
      expect(fileSystemErrors.length).toBeGreaterThan(0);
    }
  });
});