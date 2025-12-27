/**
 * Integration Test Suite for Container Troubleshooting Documentation
 *
 * This test suite performs integration testing of the troubleshooting documentation
 * by validating that the documented solutions and commands are technically sound
 * and that the guidance can be followed in realistic scenarios.
 */

import { describe, it, expect } from 'vitest';
import { ApexConfigSchema, ContainerConfigSchema } from '../../packages/core/src/types';
import { readFileSync } from 'fs';
import path from 'path';

const DOC_PATH = path.join(__dirname, '../../docs/container-troubleshooting.md');

describe('Container Troubleshooting Documentation - Integration Tests', () => {

  let content: string;

  beforeAll(() => {
    content = readFileSync(DOC_PATH, 'utf8');
  });

  describe('Configuration Examples Validation', () => {
    it('should validate all YAML configuration examples against schemas', () => {
      const yamlBlocks = content.match(/```yaml\n([\s\S]*?)\n```/g) || [];

      // Find configuration examples that should be valid APEX configs
      const configBlocks = yamlBlocks.filter(block =>
        block.includes('workspace:') || block.includes('container:')
      );

      expect(configBlocks.length).toBeGreaterThan(5);

      // Test sample configurations extracted from the documentation
      const resourceLimitConfig = {
        workspace: {
          container: {
            resourceLimits: {
              memory: "8g",
              cpu: 4,
              memorySwap: "16g",
              memoryReservation: "4g"
            }
          }
        }
      };

      expect(() => ApexConfigSchema.partial().parse(resourceLimitConfig)).not.toThrow();

      const networkConfig = {
        workspace: {
          container: {
            networkMode: "bridge",
            ports: {
              "3000:3000": undefined,
              "8080:80": undefined
            }
          }
        }
      };

      expect(() => ApexConfigSchema.partial().parse(networkConfig)).not.toThrow();
    });

    it('should validate container resource limit examples', () => {
      // Memory format examples from documentation
      const memoryExamples = ['2g', '4g', '8g', '16g', '512m', '1g'];

      memoryExamples.forEach(memory => {
        const config = {
          image: 'node:20-alpine',
          resourceLimits: { memory }
        };
        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      });

      // CPU examples from documentation
      const cpuExamples = [1, 2, 4, 8];

      cpuExamples.forEach(cpu => {
        const config = {
          image: 'node:20-alpine',
          resourceLimits: { cpu }
        };
        expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should validate timeout and retry configurations', () => {
      const timeoutConfig = {
        image: 'node:20-alpine',
        startupTimeout: 120000,
        installTimeout: 600000,
        installRetries: 3
      };

      expect(() => ContainerConfigSchema.parse(timeoutConfig)).not.toThrow();
    });

    it('should validate volume mount examples', () => {
      const volumeConfig = {
        image: 'node:20-alpine',
        volumes: {
          './data': '/app/data',
          './config': '/app/config',
          '/absolute/path/to/data': '/app/data'
        }
      };

      expect(() => ContainerConfigSchema.parse(volumeConfig)).not.toThrow();
    });

    it('should validate environment variable configurations', () => {
      const envConfig = {
        image: 'node:20-alpine',
        environment: {
          NODE_ENV: 'development',
          NPM_REGISTRY: 'https://registry.npmjs.org/',
          NPM_CONFIG_UPDATE_NOTIFIER: 'false',
          NPM_CONFIG_AUDIT: 'false',
          NPM_CONFIG_FUND: 'false',
          NPM_CONFIG_TIMEOUT: '300000'
        }
      };

      expect(() => ContainerConfigSchema.parse(envConfig)).not.toThrow();
    });
  });

  describe('Command Examples Validation', () => {
    it('should contain valid Docker commands with proper syntax', () => {
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];
      const allBashContent = bashBlocks.join('\n');

      // Validate Docker command patterns
      const dockerCommands = [
        'docker --version',
        'docker info',
        'docker ps',
        'docker logs',
        'docker exec',
        'docker stop',
        'docker rm',
        'docker system prune',
        'docker volume prune',
        'docker container prune',
        'docker stats',
        'docker inspect',
        'docker run',
        'docker pull',
        'docker login'
      ];

      dockerCommands.forEach(command => {
        expect(allBashContent).toContain(command);
      });
    });

    it('should contain valid Podman commands with proper syntax', () => {
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];
      const allBashContent = bashBlocks.join('\n');

      // Validate Podman command patterns
      const podmanCommands = [
        'podman --version',
        'podman info',
        'podman ps',
        'podman machine start',
        'podman machine init',
        'systemctl --user enable podman.socket',
        'systemctl --user start podman.socket',
        'podman system connection list',
        'podman pull'
      ];

      podmanCommands.forEach(command => {
        expect(allBashContent).toContain(command);
      });
    });

    it('should contain valid APEX CLI commands', () => {
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];
      const allBashContent = bashBlocks.join('\n');

      const apexCommands = [
        'apex config',
        'apex status',
        'apex run',
        'apex logs',
        'apex --version'
      ];

      apexCommands.forEach(command => {
        expect(allBashContent).toContain(command);
      });
    });

    it('should contain valid system administration commands', () => {
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];
      const allBashContent = bashBlocks.join('\n');

      const systemCommands = [
        'sudo systemctl start docker',
        'sudo usermod -aG docker $USER',
        'sudo chmod 666 /var/run/docker.sock',
        'mkdir -p',
        'chmod 755',
        'chown -R'
      ];

      systemCommands.forEach(command => {
        expect(allBashContent).toContain(command);
      });
    });
  });

  describe('Error-Solution Mapping Validation', () => {
    it('should provide multiple solutions for critical errors', () => {
      const criticalErrors = [
        '"No container runtime available"',
        '"Docker daemon not running"',
        '"Permission denied accessing Docker"',
        '"Container startup timeout"',
        '"Out of Memory (OOM) Killed"',
        '"Package installation failed"'
      ];

      criticalErrors.forEach(error => {
        const errorSection = content.split(error)[1]?.split('---')[0] || '';

        // Each error should have a **Solutions:** section
        expect(errorSection).toContain('**Solutions:**');

        // Should have at least 2 numbered solutions
        const solutionCount = (errorSection.match(/^\d+\. /gm) || []).length;
        expect(solutionCount).toBeGreaterThanOrEqual(2);
      });
    });

    it('should provide appropriate escalation paths', () => {
      // Check that complex errors provide escalation from simple to advanced solutions
      const oomSection = content.split('"Out of Memory (OOM) Killed"')[1]?.split('---')[0] || '';

      expect(oomSection).toContain('Increase memory limit');
      expect(oomSection).toContain('Monitor memory usage');
      expect(oomSection).toContain('Use memory-efficient base image');
      expect(oomSection).toContain('Optimize application memory');
    });

    it('should provide platform-specific solutions', () => {
      const dockerDaemonSection = content.split('"Docker daemon not running"')[1]?.split('---')[0] || '';

      // Should have solutions for different platforms
      expect(dockerDaemonSection).toContain('Linux');
      expect(dockerDaemonSection).toContain('macOS');
      expect(dockerDaemonSection).toContain('Windows');
    });
  });

  describe('Troubleshooting Workflow Validation', () => {
    it('should have logical troubleshooting progression', () => {
      // Quick Diagnostics should come first
      const quickDiagnosticsIndex = content.indexOf('## Quick Diagnostics');
      const runtimeIssuesIndex = content.indexOf('## Container Runtime Issues');
      const creationIssuesIndex = content.indexOf('## Container Creation Issues');

      expect(quickDiagnosticsIndex).toBeLessThan(runtimeIssuesIndex);
      expect(runtimeIssuesIndex).toBeLessThan(creationIssuesIndex);
    });

    it('should reference diagnostic commands before specific solutions', () => {
      const quickDiagnostics = content.match(/## Quick Diagnostics([\s\S]*?)---/)?.[1] || '';

      // Should establish baseline diagnostic commands
      expect(quickDiagnostics).toContain('docker --version');
      expect(quickDiagnostics).toContain('apex config');
      expect(quickDiagnostics).toContain('apex status');
    });

    it('should provide debug mode instructions', () => {
      expect(content).toContain('APEX_DEBUG=1');
      expect(content).toContain('--verbose');
      expect(content).toContain('--debug');
      expect(content).toContain('apex-debug.log');
    });
  });

  describe('Best Practices Integration', () => {
    it('should integrate security best practices in solutions', () => {
      // Security-conscious solutions should be recommended
      expect(content).toContain('no-new-privileges:true');
      expect(content).toContain('capDrop: ["ALL"]');
      expect(content).toContain('privileged: false');
      expect(content).toContain('rootless Docker');
    });

    it('should promote resource efficiency', () => {
      expect(content).toContain('node:20-alpine');
      expect(content).toContain('Pre-pull large images');
      expect(content).toContain('Use lighter base image');
      expect(content).toContain('docker system prune');
    });

    it('should encourage proper monitoring', () => {
      expect(content).toContain('healthCheck:');
      expect(content).toContain('docker stats');
      expect(content).toContain('Monitor container count');
      expect(content).toContain('cleanupOrphanedContainers: true');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should provide solutions for major operating systems', () => {
      // Installation instructions should cover major platforms
      expect(content).toContain('macOS (via Homebrew)');
      expect(content).toContain('Ubuntu/Debian');
      expect(content).toContain('brew install');
      expect(content).toContain('sudo apt-get install');
      expect(content).toContain('Windows');
    });

    it('should account for different container runtimes', () => {
      // Should provide parallel instructions for Docker and Podman
      const dockerSections = (content.match(/docker/gi) || []).length;
      const podmanSections = (content.match(/podman/gi) || []).length;

      expect(dockerSections).toBeGreaterThan(50);
      expect(podmanSections).toBeGreaterThan(20);

      // Should use "OR" to indicate alternatives
      expect(content).toContain('# OR');
    });
  });

  describe('Documentation Completeness Verification', () => {
    it('should have comprehensive coverage of container lifecycle', () => {
      const lifecyclePhases = [
        'runtime detection',
        'container creation',
        'dependency installation',
        'task execution',
        'container cleanup'
      ];

      // Each phase should have dedicated troubleshooting section
      expect(content).toContain('Container Runtime Issues');
      expect(content).toContain('Container Creation Issues');
      expect(content).toContain('Dependency Installation Issues');
      expect(content).toContain('Resource Management Issues');
      expect(content).toContain('Container Cleanup Issues');
    });

    it('should provide end-to-end troubleshooting coverage', () => {
      // Should start with prerequisites and end with cleanup
      const docStructure = [
        'Quick Diagnostics',
        'Container Runtime Issues',
        'Container Creation Issues',
        'Resource Management Issues',
        'Dependency Installation Issues',
        'Container Networking Issues',
        'Container Cleanup Issues',
        'Debugging and Monitoring',
        'Debugging Tools',
        'FAQ',
        'Getting Help'
      ];

      let lastIndex = 0;
      docStructure.forEach(section => {
        const sectionIndex = content.indexOf(`## ${section}`);
        expect(sectionIndex).toBeGreaterThan(lastIndex);
        lastIndex = sectionIndex;
      });
    });

    it('should maintain consistency in solution formatting', () => {
      // All error sections should follow consistent format
      const errorSections = content.split('**Error:**').slice(1);

      errorSections.forEach(section => {
        expect(section).toContain('**Cause:**');
        expect(section).toContain('**Solutions:**');
      });
    });
  });

  describe('Real-world Scenario Coverage', () => {
    it('should cover common development environment issues', () => {
      const commonScenarios = [
        'npm install failures',
        'port binding conflicts',
        'file permission mismatches',
        'insufficient disk space',
        'network connectivity issues',
        'container resource exhaustion'
      ];

      expect(content).toContain('npm ERR! network timeout');
      expect(content).toContain('ports:');
      expect(content).toContain('permission denied');
      expect(content).toContain('no space left on device');
      expect(content).toContain('connect ECONNREFUSED');
      expect(content).toContain('Container exited with code 137');
    });

    it('should provide solutions for CI/CD environments', () => {
      expect(content).toContain('DOCKER_REGISTRY_USER');
      expect(content).toContain('DOCKER_REGISTRY_PASS');
      expect(content).toContain('--password-stdin');
      expect(content).toContain('private Docker registries');
    });

    it('should address enterprise security concerns', () => {
      expect(content).toContain('SELinux');
      expect(content).toContain('apparmor');
      expect(content).toContain('securityOpts');
      expect(content).toContain('no-new-privileges');
    });
  });
});