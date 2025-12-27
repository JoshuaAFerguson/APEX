/**
 * Test Suite for Container Isolation Documentation Validation
 *
 * This test suite validates that the container isolation documentation examples
 * in docs/container-isolation.md are accurate, complete, and functional.
 */

import { describe, it, expect } from 'vitest';
import { ApexConfigSchema, ContainerConfigSchema, WorkspaceConfigSchema } from '@apexcli/core';
import { readFileSync } from 'fs';
import path from 'path';

describe('Container Isolation Documentation Validation', () => {

  describe('Documentation exists and is complete', () => {
    it('should have container isolation documentation file', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      expect(() => readFileSync(docPath, 'utf8')).not.toThrow();
    });

    it('should contain all required sections', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const requiredSections = [
        '# Container Isolation',
        '## Overview',
        '## Prerequisites',
        '### Container Runtime',
        '### Docker',
        '### Podman',
        '## Getting Started',
        '### Basic Configuration',
        '### Running Tasks in Containers',
        '### Container Configuration Options',
        '### Per-Task Resource Overrides',
        '### Custom Dockerfile',
        '## Container vs Worktree Isolation',
        '## Architecture',
        '### Component Overview',
        '### Container Lifecycle',
        '### Data Flow',
        '### Key Components',
        '### Container Events',
        '## Troubleshooting',
        '### Common Issues',
        '### Debug Mode',
        '### Health Monitoring',
        '## Best Practices'
      ];

      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    });
  });

  describe('Configuration examples validation', () => {
    it('should validate basic container configuration example', () => {
      const basicConfig = {
        version: "1.0",
        project: {
          name: "my-project",
          language: "typescript"
        },
        workspace: {
          defaultStrategy: "container",
          cleanupOnComplete: true,
          container: {
            image: "node:20-alpine",
            resourceLimits: {
              cpu: 2,
              memory: "4g"
            }
          }
        }
      };

      expect(() => ApexConfigSchema.parse(basicConfig)).not.toThrow();

      const validConfig = ApexConfigSchema.parse(basicConfig);
      expect(validConfig.workspace?.defaultStrategy).toBe('container');
      expect(validConfig.workspace?.container?.image).toBe('node:20-alpine');
      expect(validConfig.workspace?.container?.resourceLimits?.cpu).toBe(2);
      expect(validConfig.workspace?.container?.resourceLimits?.memory).toBe('4g');
    });

    it('should validate comprehensive container configuration example', () => {
      const comprehensiveConfig = {
        version: "1.0",
        project: {
          name: "test-project",
          language: "typescript"
        },
        workspace: {
          defaultStrategy: "container",
          cleanupOnComplete: true,
          container: {
            image: "node:20-alpine",
            dockerfile: ".apex/Dockerfile",
            buildContext: ".",
            imageTag: "my-project:latest",
            resourceLimits: {
              cpu: 2,
              memory: "4g",
              memoryReservation: "2g",
              memorySwap: "8g",
              cpuShares: 1024,
              pidsLimit: 1000
            },
            networkMode: "bridge",
            environment: {
              NODE_ENV: "development",
              NPM_CONFIG_UPDATE_NOTIFIER: "false"
            },
            workingDir: "/workspace",
            user: "1000:1000",
            volumes: {
              "./data": "/app/data"
            },
            autoRemove: true,
            autoDependencyInstall: true,
            useFrozenLockfile: true,
            installTimeout: 300000,
            installRetries: 2,
            privileged: false,
            securityOpts: ["no-new-privileges:true"],
            capDrop: ["ALL"],
            capAdd: ["NET_BIND_SERVICE"]
          }
        }
      };

      expect(() => ApexConfigSchema.parse(comprehensiveConfig)).not.toThrow();

      const validConfig = ApexConfigSchema.parse(comprehensiveConfig);
      expect(validConfig.workspace?.container?.image).toBe('node:20-alpine');
      expect(validConfig.workspace?.container?.dockerfile).toBe('.apex/Dockerfile');
      expect(validConfig.workspace?.container?.resourceLimits?.cpu).toBe(2);
      expect(validConfig.workspace?.container?.resourceLimits?.memory).toBe('4g');
      expect(validConfig.workspace?.container?.networkMode).toBe('bridge');
      expect(validConfig.workspace?.container?.environment?.NODE_ENV).toBe('development');
      expect(validConfig.workspace?.container?.user).toBe('1000:1000');
      expect(validConfig.workspace?.container?.autoRemove).toBe(true);
      expect(validConfig.workspace?.container?.privileged).toBe(false);
    });

    it('should validate minimum Docker version requirements mentioned in docs', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that minimum versions are documented
      expect(content).toContain('Docker 20.10.0 or later');
      expect(content).toContain('Docker 24.0+');
      expect(content).toContain('Podman 4.0.0 or later');
      expect(content).toContain('Podman 4.7+');
    });

    it('should validate container vs worktree comparison table accuracy', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that the comparison table contains expected entries
      const expectedFeatures = [
        'Isolation Level',
        'Performance',
        'Resource Control',
        'Environment Isolation',
        'Dependency Isolation',
        'Reproducibility',
        'Setup Overhead',
        'Cleanup',
        'Multi-branch Support',
        'Network Isolation'
      ];

      for (const feature of expectedFeatures) {
        expect(content).toContain(feature);
      }

      // Check workspace strategies are documented
      const strategies = ['Container', 'Worktree', 'Directory', 'None'];
      for (const strategy of strategies) {
        expect(content).toContain(strategy);
      }
    });
  });

  describe('Code examples syntax validation', () => {
    it('should validate YAML configuration examples', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      // Extract YAML blocks and validate they parse correctly
      const yamlBlocks = content.match(/```yaml\n([\s\S]*?)\n```/g) || [];

      expect(yamlBlocks.length).toBeGreaterThan(0);

      // Note: We don't actually parse YAML here since we'd need to add yaml dependency
      // But we check that the blocks contain expected structure
      for (const block of yamlBlocks) {
        expect(block).toMatch(/version:/);
        if (block.includes('workspace:')) {
          expect(block).toMatch(/defaultStrategy:|container:/);
        }
      }
    });

    it('should validate bash command examples', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];

      expect(bashBlocks.length).toBeGreaterThan(0);

      // Check for expected commands
      const allBashContent = bashBlocks.join('\n');
      const expectedCommands = [
        'docker --version',
        'docker info',
        'podman --version',
        'podman info',
        'apex run',
        'apex status'
      ];

      for (const command of expectedCommands) {
        expect(allBashContent).toContain(command);
      }
    });

    it('should validate Dockerfile example', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const dockerfileBlocks = content.match(/```dockerfile\n([\s\S]*?)\n```/g) || [];

      expect(dockerfileBlocks.length).toBeGreaterThan(0);

      const dockerfileContent = dockerfileBlocks[0];
      expect(dockerfileContent).toContain('FROM node:20-alpine');
      expect(dockerfileContent).toContain('WORKDIR /workspace');
      expect(dockerfileContent).toContain('RUN');
    });
  });

  describe('Resource limits validation', () => {
    it('should validate CPU limit examples are within documented constraints', () => {
      const cpuExamples = [0.1, 0.5, 1, 2, 4, 8, 64];

      for (const cpu of cpuExamples) {
        const config = {
          image: 'node:20-alpine',
          resourceLimits: { cpu }
        };

        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      }
    });

    it('should validate memory limit format examples', () => {
      const memoryExamples = ['512m', '1g', '2g', '4g', '8g', '256MiB', '1GiB'];

      for (const memory of memoryExamples) {
        const config = {
          image: 'node:20-alpine',
          resourceLimits: { memory }
        };

        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      }
    });

    it('should validate security options examples', () => {
      const securityConfig = {
        image: 'node:20-alpine',
        privileged: false,
        securityOpts: ['no-new-privileges:true', 'apparmor=unconfined'],
        capDrop: ['ALL'],
        capAdd: ['NET_BIND_SERVICE', 'SYS_ADMIN']
      };

      expect(() => ContainerConfigSchema.parse(securityConfig)).not.toThrow();
    });
  });

  describe('Environment variable examples', () => {
    it('should validate environment variable configuration', () => {
      const envConfig = {
        image: 'node:20-alpine',
        environment: {
          NODE_ENV: 'development',
          NPM_CONFIG_UPDATE_NOTIFIER: 'false',
          API_KEY: 'secret-key',
          PATH: '/usr/local/bin:/usr/bin:/bin'
        }
      };

      expect(() => ContainerConfigSchema.parse(envConfig)).not.toThrow();

      const validConfig = ContainerConfigSchema.parse(envConfig);
      expect(validConfig.environment?.NODE_ENV).toBe('development');
      expect(validConfig.environment?.NPM_CONFIG_UPDATE_NOTIFIER).toBe('false');
    });
  });

  describe('Volume mount examples', () => {
    it('should validate volume mount configuration', () => {
      const volumeConfig = {
        image: 'node:20-alpine',
        volumes: {
          './data': '/app/data',
          '/host/path': '/container/path',
          './config': '/app/config'
        }
      };

      expect(() => ContainerConfigSchema.parse(volumeConfig)).not.toThrow();

      const validConfig = ContainerConfigSchema.parse(volumeConfig);
      expect(validConfig.volumes?.['./data']).toBe('/app/data');
      expect(validConfig.volumes?.['/host/path']).toBe('/container/path');
    });
  });

  describe('Workspace strategy examples', () => {
    it('should validate all documented workspace strategies', () => {
      const strategies = ['container', 'worktree', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        const config = {
          defaultStrategy: strategy,
          cleanupOnComplete: true
        };

        expect(() => WorkspaceConfigSchema.parse(config)).not.toThrow();

        const validConfig = WorkspaceConfigSchema.parse(config);
        expect(validConfig.defaultStrategy).toBe(strategy);
      }
    });
  });

  describe('Architecture diagrams validation', () => {
    it('should contain mermaid diagram for data flow', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('```mermaid');
      expect(content).toContain('sequenceDiagram');

      // Check for key components mentioned in diagram
      const diagramComponents = [
        'User',
        'CLI',
        'Orchestrator',
        'WorkspaceManager',
        'ContainerManager',
        'Docker/Podman'
      ];

      for (const component of diagramComponents) {
        expect(content).toContain(component);
      }
    });

    it('should contain ASCII diagrams for component overview and lifecycle', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      // Check for ASCII art diagrams
      expect(content).toContain('┌─');
      expect(content).toContain('└─');
      expect(content).toContain('│');
      expect(content).toContain('▶');

      // Check lifecycle stages
      expect(content).toContain('Create');
      expect(content).toContain('Start');
      expect(content).toContain('Execute');
      expect(content).toContain('Stop');
    });
  });

  describe('Troubleshooting section validation', () => {
    it('should contain common error scenarios and solutions', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const commonIssues = [
        'No container runtime available',
        'Container startup timeout',
        'Dependency installation fails',
        'Permission denied errors',
        'Out of memory errors'
      ];

      for (const issue of commonIssues) {
        expect(content).toContain(issue);
      }
    });

    it('should provide debug commands', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const debugCommands = [
        'apex run "task" --verbose --debug',
        'docker ps -a',
        'docker logs'
      ];

      for (const command of debugCommands) {
        expect(content).toContain(command);
      }
    });
  });

  describe('Best practices validation', () => {
    it('should contain security and performance best practices', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const bestPractices = [
        'Use specific image tags',
        'Set appropriate resource limits',
        'Use frozen lockfiles',
        'Drop unnecessary capabilities',
        'Enable auto-cleanup'
      ];

      for (const practice of bestPractices) {
        expect(content).toContain(practice);
      }
    });
  });

  describe('Cross-references validation', () => {
    it('should contain valid references to other documentation', () => {
      const docPath = path.join(__dirname, '../../docs/container-isolation.md');
      const content = readFileSync(docPath, 'utf8');

      const expectedReferences = [
        'Configuration Reference',
        'Workflows',
        'Agents',
        'Best Practices'
      ];

      for (const reference of expectedReferences) {
        expect(content).toContain(reference);
      }
    });
  });
});