import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Service Management Documentation', () => {
  const docsPath = join(process.cwd(), 'docs', 'service-management.md');
  let docContent: string;

  // Load the documentation content
  try {
    docContent = readFileSync(docsPath, 'utf-8');
  } catch (error) {
    throw new Error(`Service management documentation not found at ${docsPath}`);
  }

  describe('Documentation Structure', () => {
    it('should have proper title and overview', () => {
      expect(docContent).toContain('# Service Management Guide');
      expect(docContent).toContain('## Overview');
      expect(docContent).toContain('APEX can run as a system service');
    });

    it('should have table of contents', () => {
      expect(docContent).toContain('## Table of Contents');
      expect(docContent).toContain('[Prerequisites](#prerequisites)');
      expect(docContent).toContain('[Linux (systemd) Service Management](#linux-systemd-service-management)');
      expect(docContent).toContain('[macOS (launchd) Service Management](#macos-launchd-service-management)');
    });

    it('should have all required sections', () => {
      const requiredSections = [
        '## Prerequisites',
        '## Linux (systemd) Service Management',
        '## macOS (launchd) Service Management',
        '## Configuration',
        '## Service Logging',
        '## Auto-Start Configuration',
        '## Troubleshooting',
        '## Platform Comparison'
      ];

      for (const section of requiredSections) {
        expect(docContent).toContain(section);
      }
    });
  });

  describe('Installation Coverage (Acceptance Criteria)', () => {
    it('should cover Linux installation', () => {
      expect(docContent).toContain('Install APEX as a systemd user service');
      expect(docContent).toContain('apex install-service');
      expect(docContent).toContain('systemd unit file');
      expect(docContent).toContain('~/.config/systemd/user/apex-daemon.service');
    });

    it('should cover macOS installation', () => {
      expect(docContent).toContain('Install APEX as a launchd LaunchAgent');
      expect(docContent).toContain('property list (.plist) file');
      expect(docContent).toContain('~/Library/LaunchAgents/com.apex.daemon.plist');
    });

    it('should provide installation commands', () => {
      expect(docContent).toContain('# Basic installation');
      expect(docContent).toContain('apex install-service');
      expect(docContent).toContain('# Install and enable for boot startup');
      expect(docContent).toContain('apex install-service --enable');
    });
  });

  describe('Uninstallation Coverage (Acceptance Criteria)', () => {
    it('should cover Linux uninstallation', () => {
      expect(docContent).toContain('# Uninstall service');
      expect(docContent).toContain('apex uninstall-service');
      expect(docContent).toContain('systemctl --user stop');
      expect(docContent).toContain('systemctl --user disable');
    });

    it('should cover macOS uninstallation', () => {
      expect(docContent).toContain('launchctl unload');
      expect(docContent).toContain('Removes plist file');
    });

    it('should provide force uninstall options', () => {
      expect(docContent).toContain('# Force uninstall');
      expect(docContent).toContain('apex uninstall-service --force');
    });
  });

  describe('Auto-Start Configuration Coverage (Acceptance Criteria)', () => {
    it('should cover enabling boot startup', () => {
      expect(docContent).toContain('## Auto-Start Configuration');
      expect(docContent).toContain('### Enabling Boot Startup');
      expect(docContent).toContain('During installation');
      expect(docContent).toContain('After installation');
    });

    it('should provide Linux auto-start commands', () => {
      expect(docContent).toContain('systemctl --user enable apex-daemon');
      expect(docContent).toContain('enable-linger');
    });

    it('should provide macOS auto-start commands', () => {
      expect(docContent).toContain('launchctl load -w');
      expect(docContent).toContain('RunAtLoad');
    });

    it('should cover disabling auto-start', () => {
      expect(docContent).toContain('### Disabling Boot Startup');
      expect(docContent).toContain('systemctl --user disable');
      expect(docContent).toContain('launchctl unload -w');
    });

    it('should cover checking boot status', () => {
      expect(docContent).toContain('### Checking Boot Status');
      expect(docContent).toContain('systemctl --user is-enabled');
      expect(docContent).toContain('launchctl list | grep');
    });
  });

  describe('Troubleshooting Coverage (Acceptance Criteria)', () => {
    it('should have comprehensive troubleshooting section', () => {
      expect(docContent).toContain('## Troubleshooting');
      expect(docContent).toContain('### Common Issues');
    });

    it('should cover permission issues', () => {
      expect(docContent).toContain('Permission denied');
      expect(docContent).toContain('mkdir -p ~/.config/systemd/user');
      expect(docContent).toContain('mkdir -p ~/Library/LaunchAgents');
      expect(docContent).toContain('Check directory permissions');
    });

    it('should cover service startup issues', () => {
      expect(docContent).toContain('Service Won\'t Start');
      expect(docContent).toContain('Failed to start service');
      expect(docContent).toContain('systemctl --user status');
      expect(docContent).toContain('APEX not initialized');
      expect(docContent).toContain('Invalid configuration');
    });

    it('should cover port permission issues', () => {
      expect(docContent).toContain('Port Permission Issues');
      expect(docContent).toContain('EACCES: permission denied');
      expect(docContent).toContain('Use non-privileged port');
      expect(docContent).toContain('setcap');
    });

    it('should cover platform-specific troubleshooting', () => {
      expect(docContent).toContain('### Platform-Specific Issues');
      expect(docContent).toContain('#### Linux (systemd)');
      expect(docContent).toContain('#### macOS (launchd)');
      expect(docContent).toContain('User service won\'t start after reboot');
      expect(docContent).toContain('Service loads but doesn\'t stay running');
    });

    it('should provide diagnostic commands', () => {
      expect(docContent).toContain('### Diagnostic Commands');
      expect(docContent).toContain('**Check service status**');
      expect(docContent).toContain('**Verify service configuration**');
      expect(docContent).toContain('**Test manual startup**');
    });
  });

  describe('Service Logging Coverage (Acceptance Criteria)', () => {
    it('should cover service logging section', () => {
      expect(docContent).toContain('## Service Logging');
      expect(docContent).toContain('### Linux (systemd) Logging');
      expect(docContent).toContain('### macOS (launchd) Logging');
    });

    it('should cover Linux logging commands', () => {
      expect(docContent).toContain('journalctl --user -u apex-daemon');
      expect(docContent).toContain('journalctl --user -u apex-daemon -f');
      expect(docContent).toContain('--since "1 hour ago"');
      expect(docContent).toContain('System journal');
    });

    it('should cover macOS logging commands', () => {
      expect(docContent).toContain('tail -f /path/to/project/.apex/daemon.out.log');
      expect(docContent).toContain('tail -f /path/to/project/.apex/daemon.err.log');
      expect(docContent).toContain('log stream --predicate');
    });

    it('should specify log locations', () => {
      expect(docContent).toContain('**Log location**: System journal');
      expect(docContent).toContain('**Log locations**:');
      expect(docContent).toContain('stdout**: `PROJECT_PATH/.apex/daemon.out.log`');
      expect(docContent).toContain('stderr**: `PROJECT_PATH/.apex/daemon.err.log`');
    });

    it('should cover log configuration', () => {
      expect(docContent).toContain('### Log Configuration');
      expect(docContent).toContain('logLevel: info');
      expect(docContent).toContain('logFormat: json');
      expect(docContent).toContain('logFile: .apex/daemon.log');
    });
  });

  describe('Platform Coverage', () => {
    it('should support both Linux and macOS', () => {
      expect(docContent).toContain('Linux (systemd)');
      expect(docContent).toContain('macOS (launchd)');
      expect(docContent).not.toContain('Windows'); // Should acknowledge Windows not supported
    });

    it('should have platform comparison', () => {
      expect(docContent).toContain('## Platform Comparison');
      expect(docContent).toContain('| Feature | Linux (systemd) | macOS (launchd) |');
      expect(docContent).toContain('**Use systemd (Linux) when**');
      expect(docContent).toContain('**Use launchd (macOS) when**');
    });
  });

  describe('Code Examples and Commands', () => {
    it('should provide working systemd service file example', () => {
      expect(docContent).toContain('[Unit]');
      expect(docContent).toContain('Description=APEX Daemon');
      expect(docContent).toContain('[Service]');
      expect(docContent).toContain('Type=simple');
      expect(docContent).toContain('ExecStart=');
      expect(docContent).toContain('[Install]');
      expect(docContent).toContain('WantedBy=');
    });

    it('should provide working plist file example', () => {
      expect(docContent).toContain('<?xml version="1.0"');
      expect(docContent).toContain('<plist version="1.0">');
      expect(docContent).toContain('<key>Label</key>');
      expect(docContent).toContain('<key>ProgramArguments</key>');
      expect(docContent).toContain('<key>RunAtLoad</key>');
      expect(docContent).toContain('<key>KeepAlive</key>');
    });

    it('should have consistent command syntax', () => {
      // Check that commands are properly formatted
      const commandBlocks = docContent.match(/```bash\n([\s\S]*?)\n```/g);
      expect(commandBlocks).toBeTruthy();
      expect(commandBlocks!.length).toBeGreaterThan(10);

      // Verify some key commands are present
      expect(docContent).toContain('systemctl --user start');
      expect(docContent).toContain('systemctl --user stop');
      expect(docContent).toContain('launchctl load');
      expect(docContent).toContain('launchctl unload');
    });
  });

  describe('Content Quality', () => {
    it('should have proper documentation length', () => {
      const lineCount = docContent.split('\n').length;
      expect(lineCount).toBeGreaterThan(600); // Should be comprehensive
      expect(lineCount).toBeLessThan(1000);   // But not overwhelming
    });

    it('should use consistent formatting', () => {
      // Check for proper markdown formatting
      expect(docContent).toMatch(/^# [A-Z]/m); // Title
      expect(docContent).toMatch(/^## [A-Z]/m); // Sections
      expect(docContent).toMatch(/^### [A-Z]/m); // Subsections

      // Check for code blocks
      expect(docContent).toContain('```bash');
      expect(docContent).toContain('```yaml');
      expect(docContent).toContain('```ini');
      expect(docContent).toContain('```xml');
    });

    it('should have proper cross-references', () => {
      expect(docContent).toContain('[CLI Guide](cli-guide.md)');
      expect(docContent).toContain('[Configuration Guide](configuration.md)');
      expect(docContent).toContain('[Troubleshooting Guide](troubleshooting.md)');
    });

    it('should not have broken internal links', () => {
      // Extract all internal links (those starting with #)
      const internalLinks = docContent.match(/\[([^\]]+)\]\(#([^)]+)\)/g);
      if (internalLinks) {
        for (const link of internalLinks) {
          const match = link.match(/\[([^\]]+)\]\(#([^)]+)\)/);
          if (match) {
            const [, , anchor] = match;
            // Convert anchor to section header format
            const expectedHeader = anchor
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            // Check that a corresponding header exists (flexible matching)
            const hasMatchingHeader = docContent.includes(expectedHeader) ||
                                    docContent.includes(anchor.replace(/-/g, ' '));
            expect(hasMatchingHeader).toBe(true);
          }
        }
      }
    });
  });

  describe('Prerequisites Coverage', () => {
    it('should cover all prerequisites', () => {
      expect(docContent).toContain('## Prerequisites');
      expect(docContent).toContain('APEX must be initialized');
      expect(docContent).toContain('apex init');
      expect(docContent).toContain('Valid configuration');
      expect(docContent).toContain('.apex/config.yaml');
      expect(docContent).toContain('Proper permissions');
    });

    it('should cover platform-specific requirements', () => {
      expect(docContent).toContain('**Platform-specific requirements**');
      expect(docContent).toContain('systemd available');
      expect(docContent).toContain('systemctl --version');
      expect(docContent).toContain('macOS with launchd');
    });
  });

  describe('Configuration Coverage', () => {
    it('should cover service configuration', () => {
      expect(docContent).toContain('## Configuration');
      expect(docContent).toContain('### Service Configuration');
      expect(docContent).toContain('Configure service behavior');
      expect(docContent).toContain('daemon:');
      expect(docContent).toContain('service:');
    });

    it('should cover environment variables', () => {
      expect(docContent).toContain('### Environment Variables');
      expect(docContent).toContain('NODE_ENV=production');
      expect(docContent).toContain('APEX_PROJECT_PATH');
      expect(docContent).toContain('ANTHROPIC_API_KEY');
    });

    it('should cover restart policies', () => {
      expect(docContent).toContain('### Restart Policies');
      expect(docContent).toContain('always');
      expect(docContent).toContain('on-failure');
      expect(docContent).toContain('never');
      expect(docContent).toContain('Restart=always');
      expect(docContent).toContain('KeepAlive=true');
    });
  });
});