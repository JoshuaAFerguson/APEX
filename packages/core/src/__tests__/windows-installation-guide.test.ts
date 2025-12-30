import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Comprehensive test suite for Windows Installation Guide content validation.
 * Tests all aspects of the Windows installation documentation for completeness and accuracy.
 */
describe('Windows Installation Guide Content Tests', () => {
  const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
  let content: string;

  beforeAll(() => {
    expect(existsSync(guidePath)).toBe(true);
    content = readFileSync(guidePath, 'utf8');
  });

  describe('Guide Structure and Navigation', () => {
    it('should have proper title and introduction', () => {
      expect(content).toMatch(/^#\s+Windows Installation Guide/m);
      expect(content).toContain('comprehensive instructions for installing');
      expect(content).toContain('Windows systems');
    });

    it('should have all required major sections', () => {
      const requiredSections = [
        'System Requirements',
        'Installation Methods',
        'Configuration',
        'Windows-Specific Considerations',
        'Usage Examples',
        'Troubleshooting',
        'Additional Resources'
      ];

      requiredSections.forEach(section => {
        expect(content).toMatch(new RegExp(`##\\s+${section}`, 'm'));
      });
    });

    it('should have proper subsection organization', () => {
      // System Requirements subsections
      expect(content).toContain('### Supported Windows Versions');
      expect(content).toContain('### Prerequisites');

      // Installation Methods subsections
      expect(content).toContain('### Method 1: Using npm');
      expect(content).toContain('### Method 2: Using Windows Package Manager');
      expect(content).toContain('### Method 3: Development Installation');

      // Configuration subsections
      expect(content).toContain('### API Key Setup');
      expect(content).toContain('### Verify Configuration');
    });
  });

  describe('System Requirements Documentation', () => {
    it('should document supported Windows versions', () => {
      expect(content).toContain('Windows 10 (version 1903 or later)');
      expect(content).toContain('Windows 11');
      expect(content).toContain('Windows Server 2019 or later');
    });

    it('should list essential requirements with links', () => {
      expect(content).toContain('#### Essential Requirements');
      expect(content).toContain('Node.js 18 or higher');
      expect(content).toContain('[Download from nodejs.org](https://nodejs.org/)');
      expect(content).toContain('Git for Windows');
      expect(content).toContain('[Download Git for Windows](https://git-scm.com/download/win)');
    });

    it('should document terminal applications', () => {
      expect(content).toContain('Terminal Application');
      expect(content).toContain('Windows Terminal');
      expect(content).toContain('[Microsoft Store](https://aka.ms/terminal)');
      expect(content).toContain('Command Prompt (built-in)');
      expect(content).toContain('PowerShell 5.1+ (built-in)');
      expect(content).toContain('Git Bash (included with Git for Windows)');
    });

    it('should mention recommended development tools', () => {
      expect(content).toContain('#### Recommended for Development');
      expect(content).toContain('Windows Subsystem for Linux (WSL2)');
      expect(content).toContain('Visual Studio Code');
      expect(content).toContain('Windows Package Manager (winget)');
    });
  });

  describe('Installation Methods Documentation', () => {
    it('should provide detailed npm installation steps', () => {
      expect(content).toContain('#### Step 1: Install Node.js');
      expect(content).toContain('winget install OpenJS.NodeJS');
      expect(content).toContain('#### Step 2: Install APEX globally');
      expect(content).toContain('npm install -g @apexcli/cli');
      expect(content).toContain('#### Step 3: Verify installation');
      expect(content).toContain('apex --version');
    });

    it('should document winget installation method', () => {
      expect(content).toContain('Using Windows Package Manager (winget)');
      expect(content).toContain('winget install OpenJS.NodeJS');
    });

    it('should provide development installation instructions', () => {
      expect(content).toContain('Development Installation');
      expect(content).toContain('git clone https://github.com/JoshuaAFerguson/apex.git');
      expect(content).toContain('npm install');
      expect(content).toContain('npm run build');
      expect(content).toContain('npm link');
    });
  });

  describe('API Key Configuration Documentation', () => {
    it('should document session-based environment variables', () => {
      expect(content).toContain('Method 1: Environment Variable (Session-based)');
      expect(content).toContain('**PowerShell:**');
      expect(content).toContain('$env:ANTHROPIC_API_KEY="your_api_key_here"');
      expect(content).toContain('**Command Prompt:**');
      expect(content).toContain('set ANTHROPIC_API_KEY=your_api_key_here');
    });

    it('should document permanent environment variable methods', () => {
      expect(content).toContain('Method 2: Permanent Environment Variable');
      expect(content).toContain('Option A: System Properties GUI');
      expect(content).toContain('Win + R');
      expect(content).toContain('sysdm.cpl');
      expect(content).toContain('Environment Variables');
    });

    it('should provide PowerShell and CMD permanent setup', () => {
      expect(content).toContain('Option B: PowerShell (Administrator required)');
      expect(content).toContain('[Environment]::SetEnvironmentVariable');
      expect(content).toContain('Option C: Command Prompt (Administrator required)');
      expect(content).toContain('setx ANTHROPIC_API_KEY');
    });

    it('should include verification steps', () => {
      expect(content).toContain('### Verify Configuration');
      expect(content).toContain('apex --version');
      expect(content).toContain('apex config');
      expect(content).toContain('apex init');
    });
  });

  describe('Windows-Specific Considerations', () => {
    it('should document PATH configuration issues', () => {
      expect(content).toContain('### PATH Configuration');
      expect(content).toContain('apex command is not recognized');
      expect(content).toContain('npm config get prefix');
      expect(content).toContain('Add to PATH environment variable');
    });

    it('should provide terminal selection guidance', () => {
      expect(content).toContain('### Terminal Selection');
      expect(content).toContain('**Windows Terminal (Recommended):**');
      expect(content).toContain('Unicode and color support');
      expect(content).toContain('**PowerShell:**');
      expect(content).toContain('**Command Prompt:**');
      expect(content).toContain('**Git Bash:**');
    });

    it('should document PowerShell execution policy', () => {
      expect(content).toContain('### PowerShell Execution Policy');
      expect(content).toContain('Get-ExecutionPolicy');
      expect(content).toContain('Set-ExecutionPolicy -ExecutionPolicy RemoteSigned');
      expect(content).toContain('Set-ExecutionPolicy -ExecutionPolicy Unrestricted');
    });

    it('should address Windows Defender considerations', () => {
      expect(content).toContain('### Windows Defender Considerations');
      expect(content).toContain('Windows Defender may occasionally flag');
      expect(content).toContain('Add npm global directory to exclusions');
      expect(content).toContain('%APPDATA%\\npm');
    });
  });

  describe('Usage Examples', () => {
    it('should provide basic project setup example', () => {
      expect(content).toContain('### Basic Project Setup');
      expect(content).toContain('cd C:\\Users\\<username>\\Projects\\my-project');
      expect(content).toContain('apex init');
      expect(content).toContain('apex run "Add a health check endpoint to the API"');
    });

    it('should demonstrate API server usage', () => {
      expect(content).toContain('### Running the API Server');
      expect(content).toContain('apex serve');
      expect(content).toContain('apex serve --port 3000 --host 0.0.0.0');
    });

    it('should provide service management alternatives', () => {
      expect(content).toContain('### Service Management Alternative');
      expect(content).toContain('Windows service management is not yet implemented');
      expect(content).toContain('#### Option 1: Task Scheduler');
      expect(content).toContain('taskschd.msc');
      expect(content).toContain('#### Option 2: Windows Services Wrapper (NSSM)');
      expect(content).toContain('nssm install apex-service');
    });
  });

  describe('Troubleshooting Section', () => {
    it('should address command recognition issues', () => {
      expect(content).toContain('### Common Issues and Solutions');
      expect(content).toContain('"apex is not recognized as an internal or external command"');
      expect(content).toContain('Ensure npm global directory is in PATH');
      expect(content).toContain('npm uninstall -g @apexcli/cli && npm install -g @apexcli/cli');
    });

    it('should address permission issues', () => {
      expect(content).toContain('#### Permission Issues During Installation');
      expect(content).toContain('Run terminal as Administrator');
      expect(content).toContain('npm config set prefix %APPDATA%\\npm');
    });

    it('should address Node.js installation issues', () => {
      expect(content).toContain('#### Node.js Installation Issues');
      expect(content).toContain('Download Node.js installer directly');
      expect(content).toContain('Run as Administrator');
      expect(content).toContain('Add to PATH');
    });

    it('should address Git operation failures', () => {
      expect(content).toContain('#### Git Operations Fail');
      expect(content).toContain('Ensure Git for Windows is installed');
      expect(content).toContain('C:\\Program Files\\Git\\bin');
      expect(content).toContain('git --version');
    });
  });

  describe('Performance and Development Sections', () => {
    it('should provide performance optimization tips', () => {
      expect(content).toContain('### Performance Optimization');
      expect(content).toContain('#### For Better Performance:');
      expect(content).toContain('Use Windows Terminal');
      expect(content).toContain('Windows Defender exclusions');
      expect(content).toContain('Use an SSD');
    });

    it('should provide development recommendations', () => {
      expect(content).toContain('#### For Development:');
      expect(content).toContain('Enable Developer Mode');
      expect(content).toContain('Use WSL2');
      expect(content).toContain('Windows Terminal Preview');
    });
  });

  describe('Additional Resources', () => {
    it('should link to related documentation', () => {
      expect(content).toContain('### Documentation');
      expect(content).toContain('[Getting Started Guide](getting-started.md)');
      expect(content).toContain('[Troubleshooting Guide](troubleshooting.md)');
      expect(content).toContain('[Configuration Guide](configuration.md)');
    });

    it('should provide Windows-specific tool links', () => {
      expect(content).toContain('### Windows-Specific Tools');
      expect(content).toContain('[Windows Terminal](https://github.com/microsoft/terminal)');
      expect(content).toContain('[Windows Package Manager](https://github.com/microsoft/winget-cli)');
      expect(content).toContain('[PowerShell](https://docs.microsoft.com/en-us/powershell/)');
    });

    it('should provide community support links', () => {
      expect(content).toContain('### Community Support');
      expect(content).toContain('[GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues)');
      expect(content).toContain('[GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions)');
    });
  });

  describe('Windows Support Status', () => {
    it('should clearly document fully supported features', () => {
      expect(content).toContain('## What\'s Supported on Windows');
      expect(content).toContain('✅ **Fully Supported:**');
      expect(content).toContain('Core APEX functionality');
      expect(content).toContain('CLI interface and all commands');
      expect(content).toContain('API server and WebSocket streaming');
      expect(content).toContain('Git operations and worktree management');
      expect(content).toContain('Build, test, and development workflows');
    });

    it('should document partial support features', () => {
      expect(content).toContain('⚠️ **Partial Support:**');
      expect(content).toContain('Service management');
      expect(content).toContain('manual alternatives available');
      expect(content).toContain('Unix-specific file operations');
      expect(content).toContain('automatically skipped in tests');
    });

    it('should document planned features', () => {
      expect(content).toContain('🔄 **Planned:**');
      expect(content).toContain('Native Windows service integration');
      expect(content).toContain('PowerShell-specific optimizations');
      expect(content).toContain('Windows-specific deployment options');
    });
  });

  describe('Code Block Validation', () => {
    it('should have valid PowerShell code examples', () => {
      const powershellBlocks = content.match(/```powershell\n([\s\S]*?)\n```/g) || [];
      expect(powershellBlocks.length).toBeGreaterThan(5);

      // Check for common PowerShell patterns
      const powershellContent = powershellBlocks.join('');
      expect(powershellContent).toContain('winget install');
      expect(powershellContent).toContain('$env:');
      expect(powershellContent).toContain('Get-ExecutionPolicy');
      expect(powershellContent).toContain('[Environment]::SetEnvironmentVariable');
    });

    it('should have valid Command Prompt examples', () => {
      const cmdBlocks = content.match(/```cmd\n([\s\S]*?)\n```/g) || [];
      expect(cmdBlocks.length).toBeGreaterThan(0);

      const cmdContent = cmdBlocks.join('');
      expect(cmdContent).toContain('set ANTHROPIC_API_KEY=');
      expect(cmdContent).toContain('setx ANTHROPIC_API_KEY');
    });

    it('should not have syntax errors in code blocks', () => {
      // Extract all code blocks and check for obvious syntax issues
      const codeBlocks = content.match(/```\w*\n([\s\S]*?)\n```/g) || [];

      codeBlocks.forEach((block, index) => {
        // Check for common syntax errors
        expect(block).not.toContain('undefined');
        expect(block).not.toContain('null');
        expect(block).not.toContain('TODO');
        expect(block).not.toContain('FIXME');
      });
    });
  });

  describe('Accessibility and Readability', () => {
    it('should use proper markdown formatting', () => {
      // Check for proper heading levels
      expect(content).toMatch(/^#\s+Windows Installation Guide$/m);
      expect(content).toMatch(/^##\s+[A-Za-z]/m);
      expect(content).toMatch(/^###\s+[A-Za-z]/m);
      expect(content).toMatch(/^\*\*[A-Za-z]/m); // Bold text

      // Check for proper list formatting
      expect(content).toMatch(/^\s*\d+\.\s+/m); // Numbered lists
      expect(content).toMatch(/^\s*-\s+/m); // Bulleted lists
    });

    it('should have helpful visual indicators', () => {
      expect(content).toContain('✅');
      expect(content).toContain('⚠️');
      expect(content).toContain('🔄');
      expect(content).toContain('**Recommended');
      expect(content).toContain('**Solution:**');
      expect(content).toContain('**Note:**');
    });

    it('should provide clear step-by-step instructions', () => {
      // Check for numbered steps
      expect(content).toContain('#### Step 1:');
      expect(content).toContain('#### Step 2:');
      expect(content).toContain('#### Step 3:');

      // Check for option labels
      expect(content).toContain('**Option A:');
      expect(content).toContain('**Option B:');
      expect(content).toContain('**Option C:');
    });
  });

  describe('Content Quality Metrics', () => {
    it('should have substantial content', () => {
      expect(content.length).toBeGreaterThan(8000); // At least 8KB of content
      const wordCount = content.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(1200); // At least 1200 words
    });

    it('should have comprehensive coverage', () => {
      const sectionCount = (content.match(/^##\s+/gm) || []).length;
      expect(sectionCount).toBeGreaterThanOrEqual(7);

      const subsectionCount = (content.match(/^###\s+/gm) || []).length;
      expect(subsectionCount).toBeGreaterThanOrEqual(15);
    });

    it('should be internally consistent', () => {
      // Check that all APEX CLI commands use consistent format
      const apexCommands = content.match(/apex\s+\w+/g) || [];
      apexCommands.forEach(cmd => {
        expect(cmd).toMatch(/^apex\s+(init|run|serve|config|--version|--help)$/);
      });

      // Check that all file paths use consistent Windows format where applicable
      const windowsPaths = content.match(/C:\\[A-Za-z\\<>]+/g) || [];
      windowsPaths.forEach(path => {
        expect(path).not.toContain('/'); // Should use backslashes
      });
    });
  });
});