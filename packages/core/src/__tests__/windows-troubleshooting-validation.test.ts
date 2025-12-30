import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Test suite to validate Windows troubleshooting documentation completeness.
 * Ensures all common Windows issues are documented with practical solutions.
 */
describe('Windows Troubleshooting Documentation Tests', () => {
  const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
  let content: string;

  beforeAll(() => {
    expect(existsSync(guidePath)).toBe(true);
    content = readFileSync(guidePath, 'utf8');
  });

  describe('Troubleshooting Section Structure', () => {
    it('should have comprehensive troubleshooting section', () => {
      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('### Common Issues and Solutions');
    });

    it('should have performance optimization section', () => {
      expect(content).toContain('### Performance Optimization');
      expect(content).toContain('#### For Better Performance:');
      expect(content).toContain('#### For Development:');
    });

    it('should organize issues with clear headers', () => {
      // Check for issue-specific headers
      expect(content).toMatch(/####.*"apex is not recognized/);
      expect(content).toMatch(/####.*Permission Issues/);
      expect(content).toMatch(/####.*Node\.js Installation Issues/);
      expect(content).toMatch(/####.*Git Operations Fail/);
    });
  });

  describe('Command Recognition Issues', () => {
    it('should document apex command not found issue', () => {
      expect(content).toContain('"apex is not recognized as an internal or external command"');
    });

    it('should provide PATH configuration solution', () => {
      expect(content).toContain('Ensure npm global directory is in PATH');
      expect(content).toContain('Restart your terminal');
      expect(content).toContain('npm uninstall -g @apexcli/cli && npm install -g @apexcli/cli');
    });

    it('should explain npm global directory detection', () => {
      expect(content).toContain('npm config get prefix');
      expect(content).toContain('C:\\Users\\<username>\\AppData\\Roaming\\npm');
    });
  });

  describe('Permission and Installation Issues', () => {
    it('should address permission issues during installation', () => {
      expect(content).toContain('#### Permission Issues During Installation');
      expect(content).toContain('Run terminal as Administrator');
      expect(content).toContain('npm config set prefix %APPDATA%\\npm');
    });

    it('should provide Node.js installation troubleshooting', () => {
      expect(content).toContain('#### Node.js Installation Issues');
      expect(content).toContain('Download Node.js installer directly');
      expect(content).toContain('Run as Administrator');
      expect(content).toContain('Add to PATH');
      expect(content).toContain('Restart your computer if necessary');
    });

    it('should address Git installation and configuration', () => {
      expect(content).toContain('#### Git Operations Fail');
      expect(content).toContain('Ensure Git for Windows is installed');
      expect(content).toContain('C:\\Program Files\\Git\\bin');
      expect(content).toContain('git --version');
    });
  });

  describe('Windows-Specific Configuration Issues', () => {
    it('should address PowerShell execution policy', () => {
      expect(content).toContain('### PowerShell Execution Policy');
      expect(content).toContain('script execution errors in PowerShell');
      expect(content).toContain('Get-ExecutionPolicy');
      expect(content).toContain('Set-ExecutionPolicy -ExecutionPolicy RemoteSigned');
      expect(content).toContain('Set-ExecutionPolicy -ExecutionPolicy Unrestricted');
    });

    it('should address Windows Defender interference', () => {
      expect(content).toContain('### Windows Defender Considerations');
      expect(content).toContain('Windows Defender may occasionally flag');
      expect(content).toContain('Add npm global directory to exclusions');
      expect(content).toContain('%APPDATA%\\npm');
      expect(content).toContain('Add your project directories to exclusions');
    });

    it('should provide PATH configuration guidance', () => {
      expect(content).toContain('### PATH Configuration');
      expect(content).toContain('apex command is not recognized');
      expect(content).toContain('Find npm global installation path');
      expect(content).toContain('Add to PATH environment variable');
    });
  });

  describe('Performance Troubleshooting', () => {
    it('should provide performance optimization recommendations', () => {
      expect(content).toContain('#### For Better Performance:');
      expect(content).toContain('Use Windows Terminal');
      expect(content).toContain('Windows Defender exclusions');
      expect(content).toContain('Use an SSD');
      expect(content).toContain('PowerShell buffer size');
    });

    it('should provide development environment optimization', () => {
      expect(content).toContain('#### For Development:');
      expect(content).toContain('Enable Developer Mode');
      expect(content).toContain('Use WSL2');
      expect(content).toContain('Windows Terminal Preview');
    });
  });

  describe('Terminal and Environment Issues', () => {
    it('should provide terminal selection guidance', () => {
      expect(content).toContain('### Terminal Selection');
      expect(content).toContain('**Windows Terminal (Recommended):**');
      expect(content).toContain('Unicode and color support');
      expect(content).toContain('**PowerShell:**');
      expect(content).toContain('Native Windows scripting');
      expect(content).toContain('**Command Prompt:**');
      expect(content).toContain('Basic but reliable');
      expect(content).toContain('**Git Bash:**');
      expect(content).toContain('Unix-like environment');
    });

    it('should explain environment variable configuration methods', () => {
      // Should reference the API key setup methods as troubleshooting context
      expect(content).toContain('Environment Variable');
      expect(content).toContain('sysdm.cpl');
      expect(content).toContain('[Environment]::SetEnvironmentVariable');
      expect(content).toContain('setx');
    });
  });

  describe('Service Management Alternatives', () => {
    it('should document service management limitations', () => {
      expect(content).toContain('### Service Management Alternative');
      expect(content).toContain('Windows service management is not yet implemented');
    });

    it('should provide Task Scheduler alternative', () => {
      expect(content).toContain('#### Option 1: Task Scheduler');
      expect(content).toContain('Win + R');
      expect(content).toContain('taskschd.msc');
      expect(content).toContain('Create Basic Task');
      expect(content).toContain('When the computer starts');
    });

    it('should provide NSSM wrapper alternative', () => {
      expect(content).toContain('#### Option 2: Windows Services Wrapper (NSSM)');
      expect(content).toContain('winget install NSSM.NSSM');
      expect(content).toContain('nssm install apex-service');
      expect(content).toContain('Application path');
      expect(content).toContain('Startup directory');
    });
  });

  describe('Solution Quality and Completeness', () => {
    it('should provide step-by-step solutions', () => {
      // Each troubleshooting section should have numbered or clear steps
      const solutionSections = content.match(/\*\*Solution:\*\*([\s\S]*?)(?=####|\n\n###|\n\n##|$)/g) || [];
      expect(solutionSections.length).toBeGreaterThan(3);

      solutionSections.forEach(section => {
        // Should have either numbered steps or clear instructions
        expect(section).toMatch(/\d+\.|(-\s)|(\*\s)|(Try:)/);
      });
    });

    it('should include verification steps', () => {
      // Solutions should include how to verify they worked
      expect(content).toContain('apex --version');
      expect(content).toContain('git --version');
      expect(content).toContain('npm config get prefix');
      expect(content).toContain('Restart your terminal');
    });

    it('should provide fallback options', () => {
      // Should offer alternative approaches when primary solution fails
      expect(content).toContain('Or');
      expect(content).toContain('Alternative');
      expect(content).toContain('If that doesn\'t work');
      expect(content).toContain('manually');
    });
  });

  describe('Error Message Coverage', () => {
    it('should include actual error messages users might see', () => {
      expect(content).toContain('"apex is not recognized as an internal or external command"');
    });

    it('should provide context for when issues occur', () => {
      expect(content).toContain('during installation');
      expect(content).toContain('after installation');
      expect(content).toContain('when running');
      expect(content).toContain('if you encounter');
    });

    it('should explain why issues occur', () => {
      // Should explain root causes, not just symptoms
      expect(content).toContain('Windows Defender may occasionally flag');
      expect(content).toContain('PATH environment variable');
      expect(content).toContain('Administrator privileges');
      expect(content).toContain('execution policy');
    });
  });

  describe('Cross-Reference Validation', () => {
    it('should reference other documentation sections appropriately', () => {
      // Troubleshooting should reference installation methods
      expect(content).toContain('Installation');
      expect(content).toContain('Configuration');
    });

    it('should link to external resources when helpful', () => {
      expect(content).toContain('nodejs.org');
      expect(content).toContain('git-scm.com');
      expect(content).toContain('Microsoft Store');
    });

    it('should provide community support options', () => {
      expect(content).toContain('### Community Support');
      expect(content).toContain('GitHub Issues');
      expect(content).toContain('GitHub Discussions');
      expect(content).toContain('Windows-specific issues');
    });
  });

  describe('Accessibility and Usability', () => {
    it('should use clear, non-technical language where possible', () => {
      // Should explain technical terms
      expect(content).toMatch(/PATH.*environment variable/);
      expect(content).toMatch(/execution policy.*PowerShell/);
    });

    it('should use helpful formatting for readability', () => {
      // Should use bold for important terms and actions
      expect(content).toMatch(/\*\*Solution:\*\*/);
      expect(content).toMatch(/\*\*Recommended\*\*/);
      expect(content).toMatch(/\*\*PowerShell:\*\*/);
      expect(content).toMatch(/\*\*Command Prompt:\*\*/);
    });

    it('should provide copy-pasteable commands', () => {
      // Commands should be in code blocks for easy copying
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      expect(codeBlocks.length).toBeGreaterThan(10);

      // Should include common troubleshooting commands
      const allCodeBlocks = codeBlocks.join('');
      expect(allCodeBlocks).toContain('npm config get prefix');
      expect(allCodeBlocks).toContain('winget install');
      expect(allCodeBlocks).toContain('Get-ExecutionPolicy');
    });
  });

  describe('Completeness Metrics', () => {
    it('should cover all major categories of Windows issues', () => {
      const categories = [
        'command recognition',
        'permissions',
        'installation',
        'configuration',
        'performance',
        'environment variables',
        'terminal selection',
        'service management'
      ];

      categories.forEach(category => {
        // Each category should be represented in some form
        const categoryRegex = new RegExp(category.replace(' ', '.*'), 'i');
        expect(content).toMatch(categoryRegex);
      });
    });

    it('should have substantial troubleshooting content', () => {
      const troubleshootingMatch = content.match(/## Troubleshooting([\s\S]*?)(?=## |\Z)/);
      expect(troubleshootingMatch).toBeTruthy();

      const troubleshootingContent = troubleshootingMatch![1];
      expect(troubleshootingContent.length).toBeGreaterThan(2000); // At least 2KB of troubleshooting content
    });

    it('should provide comprehensive Windows-specific guidance', () => {
      // Count Windows-specific sections
      const windowsSpecificSections = [
        'PowerShell Execution Policy',
        'Windows Defender Considerations',
        'PATH Configuration',
        'Terminal Selection',
        'Service Management Alternative'
      ];

      windowsSpecificSections.forEach(section => {
        expect(content).toContain(section);
      });
    });
  });
});