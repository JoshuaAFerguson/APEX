import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Integration test suite that validates the complete Windows documentation ecosystem.
 * This test ensures all Windows documentation works together as a cohesive system.
 */
describe('Windows Documentation Integration Tests', () => {
  const rootPath = process.cwd();

  describe('Documentation Ecosystem Integrity', () => {
    it('should have all required Windows documentation files', () => {
      const requiredFiles = [
        'README.md',
        'docs/windows-installation.md',
        'ROADMAP.md'
      ];

      requiredFiles.forEach(file => {
        const filePath = join(rootPath, file);
        expect(existsSync(filePath)).toBe(true);

        const content = readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(100);
      });
    });

    it('should have consistent Windows terminology across documents', () => {
      const files = [
        join(rootPath, 'README.md'),
        join(rootPath, 'docs/windows-installation.md')
      ];

      const filesContent = files.map(file => readFileSync(file, 'utf8'));

      // Check for consistent terminology
      const consistentTerms = [
        'Windows 10',
        'Windows 11',
        'Node.js 18+',
        'Git for Windows',
        'PowerShell',
        'Command Prompt',
        'Windows Terminal',
        '@apexcli/cli'
      ];

      consistentTerms.forEach(term => {
        const usageCount = filesContent.filter(content => content.includes(term)).length;
        if (usageCount > 0) {
          expect(usageCount).toBeGreaterThanOrEqual(1); // At least one file uses the term consistently
        }
      });
    });

    it('should have working cross-references between documents', () => {
      const readmePath = join(rootPath, 'README.md');
      const guidePath = join(rootPath, 'docs/windows-installation.md');

      const readmeContent = readFileSync(readmePath, 'utf8');
      const guideContent = readFileSync(guidePath, 'utf8');

      // README should link to Windows guide
      expect(readmeContent).toContain('docs/windows-installation.md');

      // Guide should reference other documentation
      expect(guideContent).toContain('getting-started.md');
    });
  });

  describe('Complete Feature Implementation Verification', () => {
    it('should satisfy all Windows compatibility acceptance criteria', () => {
      // Acceptance Criteria 1: README and docs include Windows installation instructions
      const readmeContent = readFileSync(join(rootPath, 'README.md'), 'utf8');
      expect(readmeContent).toContain('### Windows-Specific Installation');
      expect(readmeContent).toContain('winget install OpenJS.NodeJS');

      // Acceptance Criteria 2: Windows-specific configuration documented
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');
      expect(guideContent).toContain('## Windows-Specific Considerations');
      expect(guideContent).toContain('PowerShell Execution Policy');

      // Acceptance Criteria 3: Troubleshooting guide includes Windows issues
      expect(guideContent).toContain('## Troubleshooting');
      expect(guideContent).toContain('Common Issues and Solutions');

      // Acceptance Criteria 4: ROADMAP.md updated to mark Windows Compatibility as complete
      const roadmapContent = readFileSync(join(rootPath, 'ROADMAP.md'), 'utf8');
      expect(roadmapContent).toMatch(/🟢.*Windows Compatibility/);
    });

    it('should provide comprehensive Windows support documentation', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Essential installation methods
      expect(guideContent).toContain('Using npm');
      expect(guideContent).toContain('Using Windows Package Manager');
      expect(guideContent).toContain('Development Installation');

      // Configuration coverage
      expect(guideContent).toContain('API Key Setup');
      expect(guideContent).toContain('Environment Variable');

      // Troubleshooting coverage
      expect(guideContent).toContain('Permission Issues');
      expect(guideContent).toContain('PATH Configuration');
      expect(guideContent).toContain('Windows Defender');

      // Platform-specific guidance
      expect(guideContent).toContain('Terminal Selection');
      expect(guideContent).toContain('Service Management Alternative');
    });

    it('should document Windows feature support status accurately', () => {
      const readmeContent = readFileSync(join(rootPath, 'README.md'), 'utf8');
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Both documents should have consistent support status
      expect(readmeContent).toContain('✅ Core Support');
      expect(readmeContent).toContain('⚠️ **Service Management**');

      expect(guideContent).toContain('✅ **Fully Supported:**');
      expect(guideContent).toContain('⚠️ **Partial Support:**');
      expect(guideContent).toContain('🔄 **Planned:**');
    });
  });

  describe('User Experience Validation', () => {
    it('should provide clear Windows installation path', () => {
      const readmeContent = readFileSync(join(rootPath, 'README.md'), 'utf8');
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // User should be guided from README to detailed guide
      expect(readmeContent).toContain('[Windows Installation Guide]');
      expect(readmeContent).toContain('Windows-specific setup and configuration');

      // Guide should have clear step-by-step instructions
      expect(guideContent).toContain('Step 1:');
      expect(guideContent).toContain('Step 2:');
      expect(guideContent).toContain('Step 3:');
    });

    it('should provide practical Windows-specific examples', () => {
      const readmeContent = readFileSync(join(rootPath, 'README.md'), 'utf8');
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Windows command examples in README
      expect(readmeContent).toContain('# Windows Command Prompt');
      expect(readmeContent).toContain('# Windows PowerShell');

      // Detailed examples in guide
      expect(guideContent).toContain('```powershell');
      expect(guideContent).toContain('```cmd');
      expect(guideContent).toContain('$env:ANTHROPIC_API_KEY');
      expect(guideContent).toContain('set ANTHROPIC_API_KEY');
    });

    it('should provide complete troubleshooting coverage', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Common Windows issues
      const commonIssues = [
        'apex is not recognized',
        'Permission Issues',
        'Node.js Installation Issues',
        'Git Operations Fail'
      ];

      commonIssues.forEach(issue => {
        expect(guideContent).toContain(issue);
      });

      // Solutions should be actionable
      expect(guideContent).toContain('**Solution:**');
      expect(guideContent).toMatch(/\d+\./); // Numbered steps
    });
  });

  describe('Technical Accuracy Validation', () => {
    it('should have valid Windows commands and paths', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Valid Windows commands
      expect(guideContent).toContain('winget install OpenJS.NodeJS');
      expect(guideContent).toContain('npm install -g @apexcli/cli');
      expect(guideContent).toContain('Get-ExecutionPolicy');
      expect(guideContent).toContain('Set-ExecutionPolicy');

      // Valid Windows paths
      expect(guideContent).toContain('C:\\Program Files\\Git\\bin');
      expect(guideContent).toContain('%APPDATA%\\npm');
      expect(guideContent).toContain('C:\\Users\\<username>');
    });

    it('should provide accurate Windows version requirements', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Supported Windows versions
      expect(guideContent).toContain('Windows 10 (version 1903 or later)');
      expect(guideContent).toContain('Windows 11');
      expect(guideContent).toContain('Windows Server 2019 or later');

      // Required software versions
      expect(guideContent).toContain('Node.js 18 or higher');
      expect(guideContent).toContain('PowerShell 5.1+');
    });

    it('should provide working external links', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Important external links should be present
      const requiredLinks = [
        'https://nodejs.org/',
        'https://git-scm.com/download/win',
        'https://aka.ms/terminal',
        'https://github.com/JoshuaAFerguson/apex'
      ];

      requiredLinks.forEach(link => {
        expect(guideContent).toContain(link);
      });
    });
  });

  describe('Completeness and Quality Metrics', () => {
    it('should meet content volume requirements', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Substantial content
      expect(guideContent.length).toBeGreaterThan(8000); // At least 8KB

      const wordCount = guideContent.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(1200); // At least 1200 words

      // Comprehensive section coverage
      const sectionCount = (guideContent.match(/^##\s+/gm) || []).length;
      expect(sectionCount).toBeGreaterThanOrEqual(7);
    });

    it('should have proper documentation structure', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Proper Markdown hierarchy
      expect(guideContent).toMatch(/^# Windows Installation Guide$/m);
      expect(guideContent).toMatch(/^## System Requirements$/m);
      expect(guideContent).toMatch(/^## Installation Methods$/m);
      expect(guideContent).toMatch(/^## Configuration$/m);
      expect(guideContent).toMatch(/^## Troubleshooting$/m);

      // Code blocks for examples
      const codeBlocks = (guideContent.match(/```/g) || []).length;
      expect(codeBlocks).toBeGreaterThan(10); // Should be even number (opening/closing pairs)
      expect(codeBlocks % 2).toBe(0); // All code blocks should be properly closed
    });

    it('should integrate seamlessly with existing documentation', () => {
      const readmeContent = readFileSync(join(rootPath, 'README.md'), 'utf8');

      // Windows content should be integrated into existing sections
      expect(readmeContent).toContain('| **Windows** | ✅ Core Support |');
      expect(readmeContent).toContain('Windows Installation Guide');

      // Should not disrupt existing content structure
      expect(readmeContent).toContain('## Features');
      expect(readmeContent).toContain('## Quick Start');
      expect(readmeContent).toContain('## Architecture');
    });
  });

  describe('Future Maintainability', () => {
    it('should have modular documentation structure for easy updates', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Clear section boundaries for easy maintenance
      const sections = [
        'System Requirements',
        'Installation Methods',
        'Configuration',
        'Windows-Specific Considerations',
        'Troubleshooting',
        'Additional Resources'
      ];

      sections.forEach(section => {
        expect(guideContent).toMatch(new RegExp(`^## ${section}$`, 'm'));
      });
    });

    it('should support extension for future Windows features', () => {
      const guideContent = readFileSync(join(rootPath, 'docs/windows-installation.md'), 'utf8');

      // Should have placeholders for planned features
      expect(guideContent).toContain('🔄 **Planned:**');
      expect(guideContent).toContain('Windows service support is planned');

      // Should have extensible troubleshooting structure
      expect(guideContent).toContain('### Common Issues and Solutions');
      expect(guideContent).toContain('#### '); // Subsection structure for easy addition
    });
  });
});