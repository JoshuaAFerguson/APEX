/**
 * Test Suite for Container Troubleshooting Documentation Validation
 *
 * This test suite validates that the container troubleshooting documentation
 * in docs/container-troubleshooting.md is accurate, complete, and comprehensive.
 * It tests all acceptance criteria including common errors, runtime detection,
 * permission problems, resource exhaustion, cleanup failures, debugging tips, and FAQ.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const DOC_PATH = path.join(__dirname, '../../docs/container-troubleshooting.md');

describe('Container Troubleshooting Documentation Validation', () => {

  let content: string;

  beforeAll(() => {
    content = readFileSync(DOC_PATH, 'utf8');
  });

  describe('Document Structure and Completeness', () => {
    it('should exist and be readable', () => {
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have proper document title', () => {
      expect(content).toContain('# Container Troubleshooting Guide');
    });

    it('should have proper introduction with cross-references', () => {
      expect(content).toContain('Container Isolation Guide');
      expect(content).toContain('Container Configuration Reference');
      expect(content).toContain('./container-isolation.md');
      expect(content).toContain('./container-configuration.md');
    });

    it('should contain all required top-level sections', () => {
      const requiredSections = [
        '# Container Troubleshooting Guide',
        '## Quick Diagnostics',
        '## Container Runtime Issues',
        '## Container Creation Issues',
        '## Resource Management Issues',
        '## Dependency Installation Issues',
        '## Container Networking Issues',
        '## Container Cleanup Issues',
        '## Debugging and Monitoring',
        '## Debugging Tools',
        '## FAQ',
        '## Getting Help'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should have proper navigation structure', () => {
      // Check for proper markdown hierarchy
      const h2Sections = content.match(/^## [^#]/gm) || [];
      const h3Sections = content.match(/^### [^#]/gm) || [];

      expect(h2Sections.length).toBeGreaterThan(8); // At least 9 main sections
      expect(h3Sections.length).toBeGreaterThan(20); // Multiple subsections
    });
  });

  describe('Quick Diagnostics Section', () => {
    it('should contain comprehensive diagnostic commands', () => {
      const diagnosticsSection = content.match(/## Quick Diagnostics([\s\S]*?)---/)?.[1] || '';

      const expectedCommands = [
        'docker --version && docker info',
        'podman --version && podman info',
        'apex config',
        'docker ps --filter "label=apex.managed=true"',
        'podman ps --filter "label=apex.managed=true"',
        'apex status',
        'apex run "echo \'Container test\'" --workspace-strategy container --dry-run'
      ];

      expectedCommands.forEach(command => {
        expect(diagnosticsSection).toContain(command);
      });
    });

    it('should provide both Docker and Podman commands', () => {
      const diagnosticsSection = content.match(/## Quick Diagnostics([\s\S]*?)---/)?.[1] || '';

      expect(diagnosticsSection).toContain('docker');
      expect(diagnosticsSection).toContain('podman');
      expect(diagnosticsSection).toContain('# OR');
    });
  });

  describe('Container Runtime Issues - Acceptance Criteria Coverage', () => {
    it('should cover "No container runtime available" error', () => {
      expect(content).toContain('"No container runtime available"');
      expect(content).toContain('Error: No container runtime available. Please install Docker or Podman.');

      // Should provide installation instructions for both Docker and Podman
      expect(content).toContain('Install Docker:');
      expect(content).toContain('Install Podman:');
      expect(content).toContain('brew install --cask docker');
      expect(content).toContain('brew install podman');
      expect(content).toContain('curl -fsSL https://get.docker.com');
      expect(content).toContain('sudo apt-get install -y podman');
    });

    it('should cover "Docker daemon not running" error', () => {
      expect(content).toContain('"Docker daemon not running"');
      expect(content).toContain('Cannot connect to the Docker daemon');

      // Should provide solutions for different platforms
      expect(content).toContain('sudo systemctl start docker');
      expect(content).toContain('open /Applications/Docker.app');
      expect(content).toContain('Docker Desktop from Start menu');
    });

    it('should cover permission denied errors', () => {
      expect(content).toContain('"Permission denied accessing Docker"');
      expect(content).toContain('permission denied while trying to connect');
      expect(content).toContain('sudo usermod -aG docker $USER');
      expect(content).toContain('sudo chmod 666 /var/run/docker.sock');
    });

    it('should cover Podman socket connection issues', () => {
      expect(content).toContain('"Podman socket connection failed"');
      expect(content).toContain('unable to connect to Podman socket');
      expect(content).toContain('systemctl --user enable podman.socket');
      expect(content).toContain('podman machine start');
    });
  });

  describe('Container Creation Issues', () => {
    it('should cover image not found errors', () => {
      expect(content).toContain('"Image not found"');
      expect(content).toContain('pull access denied');
      expect(content).toContain('repository does not exist');

      // Should provide solutions
      expect(content).toContain('docker pull node:20-alpine');
      expect(content).toContain('podman pull node:20-alpine');
      expect(content).toContain('Use correct image');
    });

    it('should cover container startup timeout issues', () => {
      expect(content).toContain('"Container startup timeout"');
      expect(content).toContain('timeout waiting for container to start');
      expect(content).toContain('startupTimeout: 120000');
      expect(content).toContain('node:20-alpine');
    });

    it('should cover volume mount failures', () => {
      expect(content).toContain('"Volume mount failed"');
      expect(content).toContain('invalid bind mount spec');
      expect(content).toContain('./data": "/app/data');
      expect(content).toContain('mkdir -p ./data');
      expect(content).toContain('chmod 755 ./data');
    });
  });

  describe('Resource Management Issues - Acceptance Criteria Coverage', () => {
    it('should cover Out of Memory (OOM) killed scenarios', () => {
      expect(content).toContain('"Out of Memory (OOM) Killed"');
      expect(content).toContain('Container exited with code 137');
      expect(content).toContain('exceeded memory limit');

      // Should provide solutions
      expect(content).toContain('memory: "8g"');
      expect(content).toContain('memorySwap: "16g"');
      expect(content).toContain('docker stats');
    });

    it('should cover CPU throttling issues', () => {
      expect(content).toContain('"CPU throttling detected"');
      expect(content).toContain('Task running slowly, CPU throttling detected');
      expect(content).toContain('cpu: 4');
      expect(content).toContain('cpuShares: 2048');
    });

    it('should cover disk space exhaustion', () => {
      expect(content).toContain('"Disk space exhausted"');
      expect(content).toContain('no space left on device');
      expect(content).toContain('docker system prune -a -f');
      expect(content).toContain('docker volume prune -f');
      expect(content).toContain('storageLimit: "10g"');
    });
  });

  describe('Dependency Installation Issues', () => {
    it('should cover package installation failures', () => {
      expect(content).toContain('"Package installation failed"');
      expect(content).toContain('npm ERR! network timeout');
      expect(content).toContain('network connectivity');

      // Should provide solutions
      expect(content).toContain('installTimeout: 600000');
      expect(content).toContain('installRetries: 3');
      expect(content).toContain('NPM_REGISTRY');
    });

    it('should cover permission denied writing to node_modules', () => {
      expect(content).toContain('"Permission denied writing to node_modules"');
      expect(content).toContain('EACCES: permission denied, mkdir \'/workspace/node_modules\'');
      expect(content).toContain('user: "1000:1000"');
      expect(content).toContain('echo "UID: $(id -u), GID: $(id -g)"');
    });
  });

  describe('Container Networking Issues', () => {
    it('should cover network connection refused errors', () => {
      expect(content).toContain('"Network connection refused"');
      expect(content).toContain('connect ECONNREFUSED 127.0.0.1:3000');
      expect(content).toContain('networkMode: "bridge"');
      expect(content).toContain('host.docker.internal');
    });

    it('should cover DNS resolution failures', () => {
      expect(content).toContain('"DNS resolution failed"');
      expect(content).toContain('getaddrinfo ENOTFOUND');
      expect(content).toContain('dns:');
      expect(content).toContain('8.8.8.8');
      expect(content).toContain('1.1.1.1');
    });
  });

  describe('Container Cleanup Issues - Acceptance Criteria Coverage', () => {
    it('should cover container removal failed scenarios', () => {
      expect(content).toContain('"Container removal failed"');
      expect(content).toContain('cannot remove container: container is running');

      // Should provide cleanup solutions
      expect(content).toContain('docker stop $(docker ps -q --filter "label=apex.managed=true")');
      expect(content).toContain('docker rm -f $(docker ps -a -q --filter "label=apex.managed=true")');
      expect(content).toContain('cleanupOnComplete: true');
      expect(content).toContain('autoRemove: true');
    });

    it('should cover orphaned containers consuming resources', () => {
      expect(content).toContain('"Orphaned containers consuming resources"');
      expect(content).toContain('System running slow, many old APEX containers found');

      // Should provide automated cleanup script
      expect(content).toContain('cleanup-apex-containers.sh');
      expect(content).toContain('docker container prune --filter "label=apex.managed=true" -f');
      expect(content).toContain('maxConcurrentContainers: 10');
    });
  });

  describe('Debugging and Monitoring - Debugging Tips Coverage', () => {
    it('should contain container health monitoring section', () => {
      expect(content).toContain('### Container Health Monitoring');
      expect(content).toContain('docker stats');
      expect(content).toContain('docker logs');
      expect(content).toContain('healthCheck:');
      expect(content).toContain('enabled: true');
    });

    it('should contain container inspection tools', () => {
      expect(content).toContain('### Container Inspection');
      expect(content).toContain('docker inspect');
      expect(content).toContain('docker exec <container-id> ps aux');
      expect(content).toContain('jq \'.[].Config\'');
    });

    it('should contain log analysis section', () => {
      expect(content).toContain('### Log Analysis');
      expect(content).toContain('apex logs');
      expect(content).toContain('docker logs $container_id --follow --timestamps');
      expect(content).toContain('grep -E "(ERROR|WARN|error|warn)"');
    });

    it('should contain performance profiling tools', () => {
      expect(content).toContain('### Performance Profiling');
      expect(content).toContain('docker stats --no-stream');
      expect(content).toContain('cat /proc/meminfo');
      expect(content).toContain('iostat -x 1');
    });
  });

  describe('Debugging Tools Section', () => {
    it('should contain container shell access instructions', () => {
      expect(content).toContain('### Container Shell Access');
      expect(content).toContain('docker exec -it <container-id> /bin/sh');
      expect(content).toContain('docker exec -it <container-id> /bin/bash');
      expect(content).toContain('docker exec -u root -it <container-id> /bin/sh');
    });

    it('should contain network debugging tools', () => {
      expect(content).toContain('### Network Debugging');
      expect(content).toContain('docker exec <container-id> ping 8.8.8.8');
      expect(content).toContain('docker exec <container-id> nslookup google.com');
      expect(content).toContain('docker exec <container-id> curl -I https://registry.npmjs.org');
    });

    it('should contain file system debugging tools', () => {
      expect(content).toContain('### File System Debugging');
      expect(content).toContain('docker exec <container-id> mount | grep workspace');
      expect(content).toContain('docker exec <container-id> ls -la /workspace');
      expect(content).toContain('docker exec <container-id> du -h /workspace');
    });
  });

  describe('FAQ Section - Acceptance Criteria Coverage', () => {
    it('should contain comprehensive FAQ section', () => {
      expect(content).toContain('## FAQ');

      const faqQuestions = [
        'Can I use APEX containers with Podman instead of Docker?',
        'How do I use custom base images for specific projects?',
        'How can I speed up container startup times?',
        'What\'s the difference between container vs worktree isolation?',
        'How do I handle private Docker registries?',
        'Can I run multiple containers for one task?',
        'How do I persist data between container runs?',
        'What happens if a container crashes during a task?',
        'How can I optimize container resource usage?'
      ];

      faqQuestions.forEach(question => {
        expect(content).toContain(question);
      });
    });

    it('should provide comprehensive answers with code examples', () => {
      // Check that FAQ answers contain code examples
      const faqSection = content.match(/## FAQ([\s\S]*?)## Getting Help/)?.[1] || '';

      expect(faqSection).toContain('```yaml');
      expect(faqSection).toContain('```bash');
      expect(faqSection).toContain('```dockerfile');
    });

    it('should contain container vs worktree comparison table', () => {
      expect(content).toContain('| Aspect | Container | Worktree |');
      expect(content).toContain('| **Isolation Level** | Full OS-level');
      expect(content).toContain('| **Performance** | Moderate');
      expect(content).toContain('| **Security** | High | Medium |');
    });
  });

  describe('Code Examples Validation', () => {
    it('should contain valid YAML configuration examples', () => {
      const yamlBlocks = content.match(/```yaml\n([\s\S]*?)\n```/g) || [];
      expect(yamlBlocks.length).toBeGreaterThan(10);

      // Check common YAML structure elements
      const allYamlContent = yamlBlocks.join('\n');
      expect(allYamlContent).toContain('workspace:');
      expect(allYamlContent).toContain('container:');
      expect(allYamlContent).toContain('resourceLimits:');
      expect(allYamlContent).toContain('memory:');
      expect(allYamlContent).toContain('cpu:');
    });

    it('should contain valid bash command examples', () => {
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g) || [];
      expect(bashBlocks.length).toBeGreaterThan(20);

      const allBashContent = bashBlocks.join('\n');
      const expectedCommands = [
        'docker --version',
        'docker info',
        'docker ps',
        'docker logs',
        'docker exec',
        'docker system prune',
        'podman --version',
        'podman info',
        'apex config',
        'apex status',
        'apex run'
      ];

      expectedCommands.forEach(command => {
        expect(allBashContent).toContain(command);
      });
    });

    it('should contain valid Dockerfile examples', () => {
      const dockerfileBlocks = content.match(/```dockerfile\n([\s\S]*?)\n```/g) || [];
      expect(dockerfileBlocks.length).toBeGreaterThan(0);

      const dockerfileContent = dockerfileBlocks.join('\n');
      expect(dockerfileContent).toContain('FROM node:20-alpine');
      expect(dockerfileContent).toContain('WORKDIR');
      expect(dockerfileContent).toContain('COPY');
    });
  });

  describe('Error Messages and Solutions', () => {
    it('should provide exact error message patterns', () => {
      const errorPatterns = [
        'Error: No container runtime available',
        'Cannot connect to the Docker daemon',
        'permission denied while trying to connect',
        'Error response from daemon: pull access denied',
        'Container creation failed: timeout waiting',
        'invalid bind mount spec',
        'Container exited with code 137',
        'Task running slowly, CPU throttling detected',
        'Error: no space left on device',
        'npm ERR! network timeout',
        'EACCES: permission denied',
        'Error: connect ECONNREFUSED',
        'getaddrinfo ENOTFOUND',
        'cannot remove container: container is running'
      ];

      errorPatterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
    });

    it('should provide multiple solution approaches for each error', () => {
      // Check that major error sections have multiple numbered solutions
      const errorSections = content.split('**Error:**').slice(1);

      errorSections.forEach(section => {
        // Each error should have a **Solutions:** section
        expect(section).toContain('**Solutions:**');

        // Should have numbered solutions (1., 2., etc.)
        const solutionCount = (section.match(/^\d+\. /gm) || []).length;
        expect(solutionCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Getting Help Section', () => {
    it('should contain comprehensive help resources', () => {
      expect(content).toContain('## Getting Help');
      expect(content).toContain('### Additional Resources');
      expect(content).toContain('### Reporting Container Issues');
      expect(content).toContain('### Community Support');
      expect(content).toContain('### Debug Mode');
    });

    it('should provide specific commands for issue reporting', () => {
      const helpSection = content.match(/## Getting Help([\s\S]*)$/)?.[1] || '';

      const expectedCommands = [
        'apex --version',
        'docker --version',
        'docker info',
        'apex config --json',
        'docker ps -a --filter "label=apex.managed=true"',
        'apex logs <task-id> --level error'
      ];

      expectedCommands.forEach(command => {
        expect(helpSection).toContain(command);
      });
    });

    it('should reference related documentation', () => {
      expect(content).toContain('[Container Isolation Guide](./container-isolation.md)');
      expect(content).toContain('[Container Configuration Reference](./container-configuration.md)');
      expect(content).toContain('[Best Practices](./best-practices.md)');
      expect(content).toContain('[API Reference](./api-reference.md)');
    });

    it('should provide community support links', () => {
      expect(content).toContain('GitHub Issues');
      expect(content).toContain('GitHub Discussions');
      expect(content).toContain('https://github.com/JoshuaAFerguson/apex/issues');
      expect(content).toContain('https://github.com/JoshuaAFerguson/apex/discussions');
    });
  });

  describe('Cross-References and Navigation', () => {
    it('should reference main troubleshooting guide', () => {
      expect(content).toContain('main troubleshooting guide');
      expect(content).toContain('./troubleshooting.md');
    });

    it('should contain proper internal anchor links', () => {
      const anchorLinks = content.match(/\(#[^)]+\)/g) || [];
      expect(anchorLinks.length).toBeGreaterThan(0);
    });

    it('should have consistent section formatting', () => {
      // All main error sections should follow the pattern:
      // ### "Error Title"
      // **Error:**
      // **Cause:**
      // **Solutions:**
      const errorSectionPattern = /### "[^"]+"\n\n\*\*Error:\*\*[\s\S]*?\*\*Cause:\*\*[\s\S]*?\*\*Solutions:\*\*/g;
      const errorSections = content.match(errorSectionPattern) || [];

      expect(errorSections.length).toBeGreaterThan(10); // Should have many structured error sections
    });
  });

  describe('Document Quality and Completeness', () => {
    it('should meet minimum length requirements for comprehensive troubleshooting', () => {
      // Should be a substantial document with comprehensive coverage
      expect(content.length).toBeGreaterThan(50000); // Should be over 50KB of content
    });

    it('should have proper markdown formatting', () => {
      // Check for proper markdown elements
      expect(content).toMatch(/^#\s+/m); // H1 headers
      expect(content).toMatch(/^##\s+/m); // H2 headers
      expect(content).toMatch(/^###\s+/m); // H3 headers
      expect(content).toContain('```'); // Code blocks
      expect(content).toContain('**'); // Bold text
      expect(content).toContain('- '); // Bullet points
    });

    it('should cover all acceptance criteria topics', () => {
      const acceptanceCriteria = [
        'common errors and solutions',
        'runtime detection issues',
        'permission problems',
        'resource exhaustion',
        'cleanup failures',
        'debugging tips',
        'FAQ section'
      ];

      // Verify coverage through section headers and content
      expect(content).toContain('Container Runtime Issues');
      expect(content).toContain('permission denied');
      expect(content).toContain('Resource Management Issues');
      expect(content).toContain('Container Cleanup Issues');
      expect(content).toContain('Debugging');
      expect(content).toContain('FAQ');
    });
  });
});