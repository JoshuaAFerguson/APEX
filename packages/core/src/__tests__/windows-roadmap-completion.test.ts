import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Test suite to verify Windows Compatibility is properly marked as complete in ROADMAP.md
 * and that all acceptance criteria have been met.
 */
describe('Windows Roadmap Completion Tests', () => {
  const roadmapPath = join(process.cwd(), 'ROADMAP.md');
  let roadmapContent: string;

  beforeAll(() => {
    expect(existsSync(roadmapPath)).toBe(true);
    roadmapContent = readFileSync(roadmapPath, 'utf8');
  });

  describe('Windows Compatibility Status', () => {
    it('should mark Windows Compatibility as complete with green checkmark', () => {
      // Look for the Windows Compatibility line with complete status
      expect(roadmapContent).toMatch(/🟢.*Windows Compatibility/);
    });

    it('should include comprehensive description of Windows compatibility completion', () => {
      // Find the Windows Compatibility line
      const windowsCompatibilityMatch = roadmapContent.match(/🟢.*Windows Compatibility.*-\s*(.+)/);
      expect(windowsCompatibilityMatch).toBeTruthy();

      const description = windowsCompatibilityMatch![1];
      expect(description).toContain('Full core functionality support');
      expect(description).toContain('comprehensive documentation');
      expect(description).toContain('Windows-specific installation guide');
      expect(description).toContain('troubleshooting');
    });

    it('should be located in a completed version section', () => {
      const lines = roadmapContent.split('\n');
      const windowsLineIndex = lines.findIndex(line =>
        line.includes('🟢') && line.includes('Windows Compatibility')
      );

      expect(windowsLineIndex).toBeGreaterThan(-1);

      // Look backwards for the version header
      let versionHeader = '';
      for (let i = windowsLineIndex - 1; i >= 0; i--) {
        if (lines[i].match(/^##\s+v\d+\.\d+\.\d+/)) {
          versionHeader = lines[i];
          break;
        }
      }

      expect(versionHeader).toBeTruthy();
      expect(versionHeader).toContain('Complete');
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('should verify README includes Windows installation instructions', () => {
      const readmePath = join(process.cwd(), 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = readFileSync(readmePath, 'utf8');

      // Check for Windows installation section
      expect(readmeContent).toContain('### Windows-Specific Installation');
      expect(readmeContent).toContain('Windows Prerequisites');
      expect(readmeContent).toContain('winget install OpenJS.NodeJS');
    });

    it('should verify Windows-specific configuration is documented', () => {
      const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
      expect(existsSync(guidePath)).toBe(true);

      const guideContent = readFileSync(guidePath, 'utf8');

      // Check for Windows-specific configuration sections
      expect(guideContent).toContain('## Windows-Specific Considerations');
      expect(guideContent).toContain('### PowerShell Execution Policy');
      expect(guideContent).toContain('### Windows Defender Considerations');
      expect(guideContent).toContain('### PATH Configuration');
    });

    it('should verify troubleshooting guide includes Windows issues', () => {
      const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
      const guideContent = readFileSync(guidePath, 'utf8');

      expect(guideContent).toContain('## Troubleshooting');
      expect(guideContent).toContain('### Common Issues and Solutions');

      // Check for specific Windows troubleshooting issues
      expect(guideContent).toContain('"apex is not recognized as an internal or external command"');
      expect(guideContent).toContain('Permission Issues During Installation');
      expect(guideContent).toContain('Node.js Installation Issues');
      expect(guideContent).toContain('Git Operations Fail');
    });

    it('should verify ROADMAP.md is properly updated', () => {
      // This is the test we're currently in, but we can verify the format
      const windowsLines = roadmapContent.split('\n').filter(line =>
        line.includes('Windows Compatibility')
      );

      expect(windowsLines.length).toBe(1); // Should appear exactly once
      expect(windowsLines[0]).toMatch(/^-\s*🟢.*Windows Compatibility/);
    });
  });

  describe('Documentation Completeness Validation', () => {
    it('should ensure all required documentation files exist', () => {
      const requiredFiles = [
        'README.md',
        'docs/windows-installation.md',
        'ROADMAP.md'
      ];

      requiredFiles.forEach(file => {
        const filePath = join(process.cwd(), file);
        expect(existsSync(filePath)).toBe(true);
      });
    });

    it('should verify cross-references between documentation files', () => {
      const readmePath = join(process.cwd(), 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      // README should link to Windows installation guide
      expect(readmeContent).toContain('docs/windows-installation.md');
      expect(readmeContent).toContain('Windows Installation Guide');
    });

    it('should verify Windows compatibility documentation exists', () => {
      // Check if WINDOWS_COMPATIBILITY.md exists and is referenced
      const windowsCompatPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const readmePath = join(process.cwd(), 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      if (existsSync(windowsCompatPath)) {
        expect(readmeContent).toContain('WINDOWS_COMPATIBILITY.md');
      }
    });
  });

  describe('Feature Implementation Verification', () => {
    it('should verify Windows support is documented in README platform table', () => {
      const readmePath = join(process.cwd(), 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      expect(readmeContent).toContain('## Platform Support');
      expect(readmeContent).toContain('| **Windows** | ✅ Core Support |');
    });

    it('should verify Windows installation methods are comprehensive', () => {
      const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
      const guideContent = readFileSync(guidePath, 'utf8');

      // Check for multiple installation methods
      expect(guideContent).toContain('## Installation Methods');
      expect(guideContent).toContain('Method 1: Using npm');
      expect(guideContent).toContain('Method 2: Using Windows Package Manager');
      expect(guideContent).toContain('Method 3: Development Installation');
    });

    it('should verify service management alternatives are provided', () => {
      const guidePath = join(process.cwd(), 'docs', 'windows-installation.md');
      const guideContent = readFileSync(guidePath, 'utf8');

      // Since Windows service management is not implemented, alternatives should be provided
      expect(guideContent).toContain('Service Management Alternative');
      expect(guideContent).toContain('Task Scheduler');
      expect(guideContent).toContain('NSSM');
    });
  });

  describe('Quality Assurance', () => {
    it('should verify roadmap formatting is consistent', () => {
      // Check that Windows Compatibility follows the same format as other items
      const completedItems = roadmapContent.match(/^-\s*🟢.*$/gm) || [];
      expect(completedItems.length).toBeGreaterThan(0);

      const windowsItem = completedItems.find(item => item.includes('Windows Compatibility'));
      expect(windowsItem).toBeTruthy();
      expect(windowsItem).toMatch(/^-\s*🟢\s*\*\*Windows Compatibility\*\*\s*-\s*.+$/);
    });

    it('should verify the roadmap entry includes all key deliverables', () => {
      const windowsCompatibilityMatch = roadmapContent.match(/🟢.*Windows Compatibility.*-\s*(.+)/);
      expect(windowsCompatibilityMatch).toBeTruthy();

      const description = windowsCompatibilityMatch![1];

      // Should mention key deliverables from acceptance criteria
      expect(description.toLowerCase()).toMatch(/(comprehensive|complete|full).*documentation/);
      expect(description.toLowerCase()).toMatch(/installation.*guide/);
      expect(description.toLowerCase()).toMatch(/windows.*specific/);
    });

    it('should verify roadmap placement in correct version', () => {
      const lines = roadmapContent.split('\n');
      const windowsLineIndex = lines.findIndex(line =>
        line.includes('🟢') && line.includes('Windows Compatibility')
      );

      // Look for version context
      let currentSection = '';
      for (let i = windowsLineIndex - 1; i >= 0; i--) {
        if (lines[i].match(/^##\s+v\d+\.\d+\.\d+/)) {
          currentSection = lines[i];
          break;
        }
      }

      expect(currentSection).toBeTruthy();
      // Should be in a version marked as Complete
      expect(currentSection).toMatch(/Complete\)|Complete$/);
    });
  });

  describe('Status Legend Verification', () => {
    it('should verify roadmap uses correct status legend', () => {
      // The roadmap should have a legend explaining the status symbols
      expect(roadmapContent).toContain('🟢 Complete');
      expect(roadmapContent).toContain('🟡 In Progress');
      expect(roadmapContent).toContain('⚪ Planned');

      // Windows Compatibility should use the complete symbol
      expect(roadmapContent).toMatch(/🟢.*Windows Compatibility/);
    });

    it('should not have Windows compatibility in any other status', () => {
      // Ensure Windows Compatibility is not marked as in progress or planned
      expect(roadmapContent).not.toMatch(/🟡.*Windows Compatibility/);
      expect(roadmapContent).not.toMatch(/⚪.*Windows Compatibility/);
      expect(roadmapContent).not.toMatch(/💡.*Windows Compatibility/);
    });
  });

  describe('Content Integration', () => {
    it('should verify Windows documentation is properly integrated with existing docs', () => {
      const readmePath = join(process.cwd(), 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      // Check documentation table includes Windows guide
      const docTableMatch = readmeContent.match(/\|\s*Document\s*\|\s*Description\s*\|([\s\S]*?)\n\n/);
      expect(docTableMatch).toBeTruthy();

      const docTable = docTableMatch![1];
      expect(docTable).toContain('Windows Installation Guide');
      expect(docTable).toContain('windows-installation.md');
    });

    it('should verify Windows platform is properly documented in features', () => {
      const readmePath = join(process.cwd(), 'README.md');
      const readmeContent = readFileSync(readmePath, 'utf8');

      // Should have platform-specific feature documentation
      expect(readmeContent).toContain('Windows Compatibility');
      expect(readmeContent).toContain('Core functionality works');
      expect(readmeContent).toContain('service management in development');
    });
  });
});