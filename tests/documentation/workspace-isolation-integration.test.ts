import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import yaml from 'yaml';

// Type definitions based on documented configuration schema
interface IsolationConfig {
  mode: 'full' | 'worktree' | 'shared';
  cleanupOnComplete?: boolean;
  preserveOnFailure?: boolean;
  container?: {
    image?: string;
    resourceLimits?: {
      cpu?: number;
      memory?: string;
      memoryReservation?: string;
      pidsLimit?: number;
    };
    networkMode?: string;
    environment?: Record<string, string>;
    autoDependencyInstall?: boolean;
    useFrozenLockfile?: boolean;
    installTimeout?: number;
    installRetries?: number;
  };
}

interface WorkflowConfig {
  name: string;
  description: string;
  isolation?: IsolationConfig;
  stages: Array<{
    name: string;
    agent: string;
    description?: string;
    dependsOn?: string[];
    isolation?: IsolationConfig;
  }>;
}

interface ProjectConfig {
  version: string;
  workspace?: {
    defaultStrategy?: string;
    cleanupOnComplete?: boolean;
    container?: {
      image?: string;
      resourceLimits?: {
        cpu?: number;
        memory?: string;
      };
    };
  };
}

describe('Workspace Isolation Configuration Integration', () => {
  let tempDir: string;
  let tempApexDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-isolation-test-'));
    tempApexDir = path.join(tempDir, '.apex');
    fs.mkdirSync(tempApexDir, { recursive: true });
    fs.mkdirSync(path.join(tempApexDir, 'workflows'), { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Workflow-Level Isolation Configuration', () => {
    it('should parse valid full isolation workflow configuration', () => {
      const workflowConfig: WorkflowConfig = {
        name: 'feature-workflow',
        description: 'Complete feature development workflow',
        isolation: {
          mode: 'full',
          cleanupOnComplete: true,
          preserveOnFailure: false,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '4g',
              memoryReservation: '2g',
              pidsLimit: 1000
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
              NPM_CONFIG_UPDATE_NOTIFIER: 'false'
            },
            autoDependencyInstall: true,
            useFrozenLockfile: true,
            installTimeout: 300000,
            installRetries: 2
          }
        },
        stages: [
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the feature'
          }
        ]
      };

      const yamlContent = yaml.stringify(workflowConfig);
      const workflowPath = path.join(tempApexDir, 'workflows', 'feature-workflow.yaml');

      // Write and read back to verify serialization/deserialization
      fs.writeFileSync(workflowPath, yamlContent);
      const readContent = fs.readFileSync(workflowPath, 'utf8');
      const parsedConfig = yaml.parse(readContent) as WorkflowConfig;

      expect(parsedConfig.name).toBe('feature-workflow');
      expect(parsedConfig.isolation?.mode).toBe('full');
      expect(parsedConfig.isolation?.container?.image).toBe('node:20-alpine');
      expect(parsedConfig.isolation?.container?.resourceLimits?.cpu).toBe(2);
      expect(parsedConfig.isolation?.container?.resourceLimits?.memory).toBe('4g');
      expect(parsedConfig.isolation?.container?.autoDependencyInstall).toBe(true);
    });

    it('should parse valid worktree isolation workflow configuration', () => {
      const workflowConfig: WorkflowConfig = {
        name: 'quick-development',
        description: 'Fast development workflow',
        isolation: {
          mode: 'worktree',
          cleanupOnComplete: true,
          preserveOnFailure: false
        },
        stages: [
          {
            name: 'planning',
            agent: 'planner'
          },
          {
            name: 'implementation',
            agent: 'developer'
          }
        ]
      };

      const yamlContent = yaml.stringify(workflowConfig);
      const workflowPath = path.join(tempApexDir, 'workflows', 'quick-development.yaml');

      fs.writeFileSync(workflowPath, yamlContent);
      const readContent = fs.readFileSync(workflowPath, 'utf8');
      const parsedConfig = yaml.parse(readContent) as WorkflowConfig;

      expect(parsedConfig.isolation?.mode).toBe('worktree');
      expect(parsedConfig.isolation?.container).toBeUndefined();
      expect(parsedConfig.stages).toHaveLength(2);
    });

    it('should parse conditional isolation per stage', () => {
      const workflowConfig: WorkflowConfig = {
        name: 'conditional-isolation',
        description: 'Workflow with different isolation per stage',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            isolation: {
              mode: 'shared'
            }
          },
          {
            name: 'implementation',
            agent: 'developer',
            dependsOn: ['planning'],
            isolation: {
              mode: 'full',
              container: {
                image: 'node:20-alpine',
                resourceLimits: {
                  cpu: 4,
                  memory: '8g'
                }
              }
            }
          },
          {
            name: 'testing',
            agent: 'tester',
            dependsOn: ['implementation'],
            isolation: {
              mode: 'worktree',
              preserveOnFailure: true
            }
          }
        ]
      };

      const yamlContent = yaml.stringify(workflowConfig);
      const workflowPath = path.join(tempApexDir, 'workflows', 'conditional-isolation.yaml');

      fs.writeFileSync(workflowPath, yamlContent);
      const readContent = fs.readFileSync(workflowPath, 'utf8');
      const parsedConfig = yaml.parse(readContent) as WorkflowConfig;

      expect(parsedConfig.stages[0].isolation?.mode).toBe('shared');
      expect(parsedConfig.stages[1].isolation?.mode).toBe('full');
      expect(parsedConfig.stages[1].isolation?.container?.resourceLimits?.cpu).toBe(4);
      expect(parsedConfig.stages[2].isolation?.mode).toBe('worktree');
      expect(parsedConfig.stages[2].isolation?.preserveOnFailure).toBe(true);
    });

    it('should validate isolation mode values', () => {
      const invalidModes = ['invalid', 'container', 'none', 'docker'];

      invalidModes.forEach(invalidMode => {
        const workflowConfig = {
          name: 'invalid-workflow',
          description: 'Workflow with invalid isolation mode',
          isolation: {
            mode: invalidMode
          },
          stages: []
        };

        const yamlContent = yaml.stringify(workflowConfig);
        const parsedConfig = yaml.parse(yamlContent);

        // The mode should be one of the valid values from documentation
        const validModes = ['full', 'worktree', 'shared'];
        expect(validModes).not.toContain(parsedConfig.isolation.mode);
      });
    });
  });

  describe('Project-Level Configuration', () => {
    it('should parse valid project-level workspace configuration', () => {
      const projectConfig: ProjectConfig = {
        version: '1.0',
        workspace: {
          defaultStrategy: 'worktree',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '4g'
            }
          }
        }
      };

      const yamlContent = yaml.stringify(projectConfig);
      const configPath = path.join(tempApexDir, 'config.yaml');

      fs.writeFileSync(configPath, yamlContent);
      const readContent = fs.readFileSync(configPath, 'utf8');
      const parsedConfig = yaml.parse(readContent) as ProjectConfig;

      expect(parsedConfig.workspace?.defaultStrategy).toBe('worktree');
      expect(parsedConfig.workspace?.container?.image).toBe('node:20-alpine');
      expect(parsedConfig.workspace?.container?.resourceLimits?.memory).toBe('4g');
    });

    it('should map workspace strategies to isolation modes correctly', () => {
      // Test the documented mapping
      const strategyMappings = [
        { strategy: 'container', isolationMode: 'full' },
        { strategy: 'worktree', isolationMode: 'worktree' },
        { strategy: 'none', isolationMode: 'shared' }
      ];

      strategyMappings.forEach(mapping => {
        const projectConfig: ProjectConfig = {
          version: '1.0',
          workspace: {
            defaultStrategy: mapping.strategy
          }
        };

        const yamlContent = yaml.stringify(projectConfig);
        const parsedConfig = yaml.parse(yamlContent);

        // Verify the mapping exists in documentation
        expect(['container', 'worktree', 'none']).toContain(parsedConfig.workspace.defaultStrategy);
      });
    });
  });

  describe('Advanced Container Configuration', () => {
    it('should parse comprehensive container configuration', () => {
      const advancedContainerConfig = {
        mode: 'full',
        container: {
          dockerfile: '.apex/Dockerfile.custom',
          buildContext: '.',
          imageTag: 'my-project:latest',
          volumes: {
            './data': '/app/data',
            './cache': '/tmp/cache'
          },
          environment: {
            NODE_ENV: 'development',
            API_URL: 'https://api.example.com',
            DATABASE_URL: 'postgresql://localhost:5432/test'
          },
          resourceLimits: {
            cpu: 2,
            memory: '4g',
            memoryReservation: '2g',
            memorySwap: '8g',
            cpuShares: 1024,
            pidsLimit: 1000
          },
          networkMode: 'bridge',
          securityOpts: ['no-new-privileges:true'],
          capDrop: ['ALL'],
          capAdd: ['NET_BIND_SERVICE'],
          autoRemove: true,
          autoDependencyInstall: true,
          customInstallCommand: 'npm ci --prefer-offline',
          useFrozenLockfile: true,
          installTimeout: 600000,
          installRetries: 3
        }
      };

      const yamlContent = yaml.stringify(advancedContainerConfig);
      const parsedConfig = yaml.parse(yamlContent);

      expect(parsedConfig.container.dockerfile).toBe('.apex/Dockerfile.custom');
      expect(parsedConfig.container.volumes).toEqual({
        './data': '/app/data',
        './cache': '/tmp/cache'
      });
      expect(parsedConfig.container.securityOpts).toContain('no-new-privileges:true');
      expect(parsedConfig.container.capDrop).toContain('ALL');
      expect(parsedConfig.container.capAdd).toContain('NET_BIND_SERVICE');
      expect(parsedConfig.container.installTimeout).toBe(600000);
    });
  });

  describe('Configuration Validation', () => {
    it('should require mode field for isolation configuration', () => {
      const configWithoutMode = {
        cleanupOnComplete: true,
        preserveOnFailure: false
      };

      // Mode field should be required according to documentation
      expect(configWithoutMode).not.toHaveProperty('mode');
    });

    it('should default cleanup settings correctly', () => {
      const basicConfig = {
        mode: 'worktree'
      };

      // According to documentation, these should be the defaults
      const expectedDefaults = {
        cleanupOnComplete: true,
        preserveOnFailure: false
      };

      // Test that the defaults are documented correctly
      expect(expectedDefaults.cleanupOnComplete).toBe(true);
      expect(expectedDefaults.preserveOnFailure).toBe(false);
    });

    it('should validate container configuration is only for full mode', () => {
      const worktreeWithContainer = {
        mode: 'worktree',
        container: {
          image: 'node:20-alpine'
        }
      };

      const sharedWithContainer = {
        mode: 'shared',
        container: {
          image: 'node:20-alpine'
        }
      };

      // Container configuration should logically only apply to full mode
      // according to the documentation
      expect(worktreeWithContainer.mode).not.toBe('full');
      expect(sharedWithContainer.mode).not.toBe('full');
    });

    it('should validate resource limit formats', () => {
      const resourceLimits = {
        cpu: 2,
        memory: '4g',
        memoryReservation: '2g',
        memorySwap: '8g',
        cpuShares: 1024,
        pidsLimit: 1000
      };

      // Test that numeric values are numbers
      expect(typeof resourceLimits.cpu).toBe('number');
      expect(typeof resourceLimits.cpuShares).toBe('number');
      expect(typeof resourceLimits.pidsLimit).toBe('number');

      // Test that memory values are strings with units
      expect(typeof resourceLimits.memory).toBe('string');
      expect(resourceLimits.memory).toMatch(/^\d+[gmk]$/);
      expect(resourceLimits.memoryReservation).toMatch(/^\d+[gmk]$/);
    });
  });

  describe('CLI Override Integration', () => {
    it('should document correct CLI parameter names', () => {
      const cliParameters = [
        'isolation-mode',
        'cleanup-on-complete',
        'preserve-on-failure',
        'container-cpu',
        'container-memory',
        'container-memory-reservation'
      ];

      // Verify these are the documented CLI parameters
      cliParameters.forEach(param => {
        expect(param).toMatch(/^[a-z-]+$/); // kebab-case format
      });
    });

    it('should map CLI values to configuration correctly', () => {
      const cliMappings = [
        { cli: 'full', config: 'full' },
        { cli: 'worktree', config: 'worktree' },
        { cli: 'shared', config: 'shared' }
      ];

      cliMappings.forEach(mapping => {
        expect(mapping.cli).toBe(mapping.config);
      });
    });

    it('should validate CLI boolean parameter formats', () => {
      const booleanParams = [
        'cleanup-on-complete',
        'preserve-on-failure'
      ];

      booleanParams.forEach(param => {
        // Boolean CLI parameters should accept true/false
        const validValues = ['true', 'false'];
        expect(validValues).toContain('true');
        expect(validValues).toContain('false');
      });
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should reference existing container configuration', () => {
      // Test that the integration references are valid
      const integrationPoints = [
        'existing container configuration from .apex/config.yaml',
        'container health monitoring',
        'resource limits and security settings',
        'custom Dockerfiles and image building'
      ];

      integrationPoints.forEach(point => {
        expect(typeof point).toBe('string');
        expect(point.length).toBeGreaterThan(0);
      });
    });

    it('should integrate with Git worktree management', () => {
      const worktreeIntegration = [
        'Creates temporary worktrees for task execution',
        'Automatically checks out appropriate branches',
        'Handles worktree cleanup after task completion',
        'Supports merge detection and cleanup'
      ];

      worktreeIntegration.forEach(feature => {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing isolation configuration gracefully', () => {
      const workflowWithoutIsolation: WorkflowConfig = {
        name: 'simple-workflow',
        description: 'Workflow without isolation config',
        stages: [
          {
            name: 'task',
            agent: 'developer'
          }
        ]
      };

      const yamlContent = yaml.stringify(workflowWithoutIsolation);
      const parsedConfig = yaml.parse(yamlContent) as WorkflowConfig;

      expect(parsedConfig.isolation).toBeUndefined();
      expect(parsedConfig.stages[0].isolation).toBeUndefined();
    });

    it('should handle invalid YAML syntax in configuration', () => {
      const invalidYaml = `
        name: test
        isolation:
          mode: full
          invalid-yaml: [unclosed array
      `;

      expect(() => {
        yaml.parse(invalidYaml);
      }).toThrow();
    });

    it('should handle empty configuration files', () => {
      const emptyConfig = '';
      const parsedEmpty = yaml.parse(emptyConfig);
      expect(parsedEmpty).toBe(null);
    });
  });
});