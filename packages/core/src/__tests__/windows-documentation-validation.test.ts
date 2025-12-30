import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Test suite to validate Windows documentation completeness and accuracy.
 * This tests the Windows documentation implementation completed in v0.4.0.
 */
describe('Windows Documentation Validation Tests', () => {
  const rootPath = process.cwd();

  describe('README.md Windows Content', () => {
    it('should contain comprehensive Windows installation instructions', () => {
      const readmePath = join(rootPath, 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const content = readFileSync(readmePath, 'utf8');

      // Check for Windows-specific installation section
      expect(content).toContain('### Windows-Specific Installation');
      expect(content).toContain('Windows users');
      expect(content).toContain('winget install OpenJS.NodeJS');

      // Check for Windows prerequisites
      expect(content).toContain('**Windows Prerequisites:**');
      expect(content).toContain('Node.js 18+');
      expect(content).toContain('Git for Windows');
      expect(content).toContain('PowerShell 5.1+');
    });

    it('should document Windows platform support status', () => {
      const readmePath = join(rootPath, 'README.md');
      const content = readFileSync(readmePath, 'utf8');

      // Check for platform support table
      expect(content).toContain('## Platform Support');
      expect(content).toContain('| **Windows** | ✅ Core Support |');

      // Check for Windows compatibility section
      expect(content).toContain('### Windows Compatibility');
      expect(content).toContain('✅ **Core Features**');
      expect(content).toContain('✅ **Build & Test**');
      expect(content).toContain('✅ **Git Operations**');
      expect(content).toContain('⚠️ **Service Management**');
    });

    it('should provide Windows-specific usage examples', () => {
      const readmePath = join(rootPath, 'README.md');
      const content = readFileSync(readmePath, 'utf8');

      // Check for Windows environment variable examples
      expect(content).toContain('# Windows Command Prompt');
      expect(content).toContain('set ANTHROPIC_API_KEY=');
      expect(content).toContain('# Windows PowerShell');
      expect(content).toContain('$env:ANTHROPIC_API_KEY=');

      // Check for Windows user note
      expect(content).toContain('**Windows Users:**');
      expect(content).toContain('Command Prompt, PowerShell, or Windows Terminal');
    });

    it('should link to Windows installation guide', () => {
      const readmePath = join(rootPath, 'README.md');
      const content = readFileSync(readmePath, 'utf8');

      // Check for Windows installation guide link in documentation table
      expect(content).toContain('[Windows Installation Guide](docs/windows-installation.md)');
      expect(content).toContain('Windows-specific setup and configuration');
    });
  });

  describe('Windows Installation Guide', () => {
    it('should exist and be properly structured', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      expect(existsSync(guidePath)).toBe(true);

      const content = readFileSync(guidePath, 'utf8');
      expect(content).toContain('# Windows Installation Guide');
      expect(content.length).toBeGreaterThan(1000); // Substantial content
    });

    it('should document system requirements', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for system requirements section
      expect(content).toContain('## System Requirements');
      expect(content).toContain('### Supported Windows Versions');
      expect(content).toContain('Windows 10');
      expect(content).toContain('Windows 11');
      expect(content).toContain('Windows Server');

      // Check for prerequisites
      expect(content).toContain('### Prerequisites');
      expect(content).toContain('#### Essential Requirements');
      expect(content).toContain('Node.js 18 or higher');
      expect(content).toContain('Git for Windows');
      expect(content).toContain('Terminal Application');
    });

    it('should provide multiple installation methods', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for installation methods
      expect(content).toContain('## Installation Methods');
      expect(content).toContain('### Method 1: Using npm (Recommended)');
      expect(content).toContain('### Method 2: Using Windows Package Manager (winget)');
      expect(content).toContain('### Method 3: Development Installation');

      // Check for step-by-step instructions
      expect(content).toContain('#### Step 1:');
      expect(content).toContain('#### Step 2:');
      expect(content).toContain('#### Step 3:');
    });

    it('should document API key configuration methods', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for API key setup section
      expect(content).toContain('### API Key Setup');
      expect(content).toContain('#### Method 1: Environment Variable (Session-based)');
      expect(content).toContain('#### Method 2: Permanent Environment Variable');

      // Check for different approaches
      expect(content).toContain('**PowerShell:**');
      expect(content).toContain('**Command Prompt:**');
      expect(content).toContain('**Option A: System Properties GUI**');
      expect(content).toContain('**Option B: PowerShell (Administrator required)**');
      expect(content).toContain('**Option C: Command Prompt (Administrator required)**');
    });

    it('should include troubleshooting section', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('### Common Issues and Solutions');

      // Check for specific issues
      expect(content).toContain('"apex is not recognized as an internal or external command"');
      expect(content).toContain('Permission Issues During Installation');
      expect(content).toContain('Node.js Installation Issues');
      expect(content).toContain('Git Operations Fail');
    });

    it('should document Windows-specific considerations', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      expect(content).toContain('## Windows-Specific Considerations');

      // Check for Windows-specific topics
      expect(content).toContain('### PATH Configuration');
      expect(content).toContain('### Terminal Selection');
      expect(content).toContain('### PowerShell Execution Policy');
      expect(content).toContain('### Windows Defender Considerations');
    });

    it('should provide service management alternatives', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      expect(content).toContain('### Service Management Alternative');
      expect(content).toContain('#### Option 1: Task Scheduler');
      expect(content).toContain('#### Option 2: Windows Services Wrapper (NSSM)');

      // Check for specific instructions
      expect(content).toContain('taskschd.msc');
      expect(content).toContain('nssm install');
    });

    it('should document what is supported on Windows', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      expect(content).toContain('## What\'s Supported on Windows');

      // Check for status indicators
      expect(content).toContain('✅ **Fully Supported:**');
      expect(content).toContain('⚠️ **Partial Support:**');
      expect(content).toContain('🔄 **Planned:**');

      // Check for specific supported features
      expect(content).toContain('Core APEX functionality');
      expect(content).toContain('CLI interface and all commands');
      expect(content).toContain('API server and WebSocket streaming');
      expect(content).toContain('Git operations and worktree management');
    });
  });

  describe('ROADMAP.md Windows Completion', () => {
    it('should mark Windows Compatibility as complete', () => {
      const roadmapPath = join(rootPath, 'ROADMAP.md');
      expect(existsSync(roadmapPath)).toBe(true);

      const content = readFileSync(roadmapPath, 'utf8');

      // Check that Windows Compatibility is marked as complete (🟢)
      expect(content).toContain('🟢 **Windows Compatibility**');

      // Verify the description mentions the key deliverables
      const windowsLine = content.match(/🟢 \*\*Windows Compatibility\*\* - (.+)/)?.[1];
      expect(windowsLine).toBeTruthy();
      expect(windowsLine).toContain('comprehensive documentation');
      expect(windowsLine).toContain('installation guide');
    });

    it('should be in the correct roadmap section', () => {
      const roadmapPath = join(rootPath, 'ROADMAP.md');
      const content = readFileSync(roadmapPath, 'utf8');

      // Find the section containing Windows Compatibility
      const lines = content.split('\n');
      const windowsLineIndex = lines.findIndex(line =>
        line.includes('🟢 **Windows Compatibility**')
      );
      expect(windowsLineIndex).toBeGreaterThan(-1);

      // Check that it's in a completed section (look for version markers above)
      const sectionContent = lines.slice(Math.max(0, windowsLineIndex - 50), windowsLineIndex).join('\n');
      expect(sectionContent).toMatch(/v\d+\.\d+\.\d+.*Complete/);
    });
  });

  describe('Documentation Link Consistency', () => {
    it('should have consistent links between README and Windows guide', () => {
      const readmePath = join(rootPath, 'README.md');
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');

      const readmeContent = readFileSync(readmePath, 'utf8');
      const guideContent = readFileSync(guidePath, 'utf8');

      // Check that README links to the guide
      expect(readmeContent).toContain('docs/windows-installation.md');

      // Check that guide links back to relevant README sections
      expect(guideContent).toContain('getting-started.md');
      expect(guideContent).toContain('configuration.md');
    });

    it('should reference WINDOWS_COMPATIBILITY.md appropriately', () => {
      const readmePath = join(rootPath, 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      // Check that README links to detailed Windows compatibility info
      expect(readmeContent).toContain('WINDOWS_COMPATIBILITY.md');
      expect(readmeContent).toContain('detailed Windows compatibility information');
    });
  });

  describe('Code Examples and Commands', () => {
    it('should provide valid PowerShell examples', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Extract PowerShell code blocks
      const powershellBlocks = content.match(/```powershell\n([\s\S]*?)\n```/g) || [];
      expect(powershellBlocks.length).toBeGreaterThan(0);

      // Check for valid PowerShell commands
      const hasValidCommands = powershellBlocks.some(block =>
        block.includes('winget install') ||
        block.includes('npm install') ||
        block.includes('$env:') ||
        block.includes('Get-ExecutionPolicy')
      );
      expect(hasValidCommands).toBe(true);
    });

    it('should provide valid Command Prompt examples', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for Command Prompt examples
      expect(content).toContain('```cmd');
      expect(content).toContain('set ANTHROPIC_API_KEY=');
      expect(content).toContain('setx ANTHROPIC_API_KEY');
    });

    it('should have consistent command examples across documents', () => {
      const readmePath = join(rootPath, 'README.md');
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');

      const readmeContent = readFileSync(readmePath, 'utf8');
      const guideContent = readFileSync(guidePath, 'utf8');

      // Check that both documents use the same basic commands
      expect(readmeContent).toContain('npm install -g @apexcli/cli');
      expect(guideContent).toContain('npm install -g @apexcli/cli');

      expect(readmeContent).toContain('apex init');
      expect(guideContent).toContain('apex init');
    });
  });

  describe('Content Quality and Completeness', () => {
    it('should have comprehensive content with good length', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check that the guide is substantial
      expect(content.length).toBeGreaterThan(5000); // At least 5KB of content

      // Check for multiple major sections
      const sectionCount = (content.match(/^##\s+/gm) || []).length;
      expect(sectionCount).toBeGreaterThanOrEqual(6);
    });

    it('should use proper Markdown structure', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for proper heading hierarchy
      expect(content).toMatch(/^#\s+Windows Installation Guide/m);
      expect(content).toMatch(/^##\s+/m);
      expect(content).toMatch(/^###\s+/m);

      // Check for code blocks
      expect(content).toContain('```powershell');
      expect(content).toContain('```cmd');
    });

    it('should have helpful context and explanations', () => {
      const guidePath = join(rootPath, 'docs', 'windows-installation.md');
      const content = readFileSync(guidePath, 'utf8');

      // Check for explanatory text that provides context
      expect(content).toContain('Windows users');
      expect(content).toContain('This guide provides');
      expect(content).toContain('comprehensive instructions');

      // Check for helpful notes and warnings
      expect(content).toContain('**Recommended');
      expect(content).toContain('**Solution:**');
      expect(content).toContain('**Note:**');
    });
  });
});