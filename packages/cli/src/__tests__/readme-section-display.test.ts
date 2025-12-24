/**
 * README Section Display Tests
 * Tests the CLI display functionality for missing README sections analysis
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { commands, CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { MissingReadmeSection, ReadmeSection } from '@apexcli/core';

// Mock orchestrator for controlled testing
vi.mock('@apexcli/orchestrator');

describe('README Section Display', () => {
  let tempDir: string;
  let ctx: CliContext;
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let consoleSpy: MockedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create temp directory for test project
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-readme-sections-'));

    mockOrchestrator = {
      getDocumentationAnalysis: vi.fn().mockResolvedValue([]),
      getMissingReadmeSections: vi.fn().mockResolvedValue([]),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    ctx = {
      cwd: tempDir,
      initialized: true,
      config: {
        project: { name: 'test-project' },
        documentation: {
          enabled: true,
          readmeSections: {
            enabled: true,
            requiredSections: ['installation', 'usage', 'license'],
            recommendedSections: ['api', 'examples'],
            optionalSections: ['faq', 'troubleshooting']
          },
        },
      } as any,
      orchestrator: mockOrchestrator as ApexOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('Required Sections Display', () => {
    it('should display required missing sections with red styling', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Instructions for installing the package'
        },
        {
          section: 'license',
          priority: 'required',
          description: 'License information for the project'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Verify headers
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📝 Missing README Sections:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔴 Required Sections:'));

      // Verify sections are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('installation'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('license'));

      // Verify descriptions are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Instructions for installing'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('License information'));
    });

    it('should not show required sections header when no required sections missing', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'api',
          priority: 'recommended',
          description: 'API documentation'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🔴 Required Sections:'));
    });
  });

  describe('Recommended Sections Display', () => {
    it('should display recommended missing sections with yellow styling', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'api',
          priority: 'recommended',
          description: 'Detailed API documentation'
        },
        {
          section: 'examples',
          priority: 'recommended',
          description: 'Usage examples and code samples'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🟡 Recommended Sections:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('api'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('examples'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Detailed API documentation'));
    });

    it('should not show recommended sections header when no recommended sections missing', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation instructions'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🟡 Recommended Sections:'));
    });
  });

  describe('Optional Sections Display', () => {
    it('should display optional missing sections with blue styling', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'faq',
          priority: 'optional',
          description: 'Frequently asked questions'
        },
        {
          section: 'troubleshooting',
          priority: 'optional',
          description: 'Common issues and solutions'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔵 Optional Sections:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('faq'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('troubleshooting'));
    });

    it('should not show optional sections header when no optional sections missing', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'usage',
          priority: 'required',
          description: 'Usage instructions'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🔵 Optional Sections:'));
    });
  });

  describe('Mixed Priority Sections Display', () => {
    it('should display all priority levels in correct order', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'How to install'
        },
        {
          section: 'api',
          priority: 'recommended',
          description: 'API docs'
        },
        {
          section: 'faq',
          priority: 'optional',
          description: 'FAQ section'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Find the indices of the different sections in the call order
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      const requiredIndex = calls.findIndex(call => call.includes('🔴 Required Sections:'));
      const recommendedIndex = calls.findIndex(call => call.includes('🟡 Recommended Sections:'));
      const optionalIndex = calls.findIndex(call => call.includes('🔵 Optional Sections:'));

      // Required should come before recommended, which should come before optional
      expect(requiredIndex).toBeLessThan(recommendedIndex);
      expect(recommendedIndex).toBeLessThan(optionalIndex);

      // All three sections should be displayed
      expect(requiredIndex).toBeGreaterThan(-1);
      expect(recommendedIndex).toBeGreaterThan(-1);
      expect(optionalIndex).toBeGreaterThan(-1);
    });

    it('should handle multiple sections of the same priority correctly', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'How to install'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'How to use'
        },
        {
          section: 'license',
          priority: 'required',
          description: 'License info'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should display all three required sections
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('installation'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('usage'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('license'));

      // Should only show the required sections header once
      const requiredHeaderCalls = consoleSpy.mock.calls.filter(call =>
        call[0].includes('🔴 Required Sections:')
      );
      expect(requiredHeaderCalls).toHaveLength(1);
    });
  });

  describe('Section Emoji Display', () => {
    it('should display appropriate emojis for different section types', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation instructions'
        },
        {
          section: 'api',
          priority: 'recommended',
          description: 'API documentation'
        },
        {
          section: 'license',
          priority: 'required',
          description: 'License information'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Each section should be displayed with its emoji and name
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/•.*installation/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/•.*api/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/•.*license/));
    });

    it('should handle all defined README section types', async () => {
      const allSectionTypes: ReadmeSection[] = [
        'title', 'description', 'installation', 'usage', 'api',
        'examples', 'contributing', 'license', 'changelog',
        'troubleshooting', 'faq', 'dependencies'
      ];

      const missingSections: MissingReadmeSection[] = allSectionTypes.map(section => ({
        section,
        priority: 'optional',
        description: `Description for ${section}`
      }));

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // All sections should be displayed
      allSectionTypes.forEach(sectionName => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(sectionName));
      });
    });
  });

  describe('No Missing Sections', () => {
    it('should not show missing README sections header when no sections are missing', async () => {
      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('📝 Missing README Sections:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🔴 Required Sections:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🟡 Recommended Sections:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🔵 Optional Sections:'));
    });

    it('should show success message when no documentation issues found', async () => {
      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;

      getMissingReadmeSections.mockResolvedValue([]);
      getDocumentationAnalysis.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('✓ No outdated documentation detected.');
    });
  });

  describe('Integration with Outdated Documentation', () => {
    it('should show separator between missing sections and outdated docs when both exist', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation instructions'
        }
      ];

      const outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch' as const,
          description: 'Version mismatch',
          severity: 'high' as const
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;

      getMissingReadmeSections.mockResolvedValue(missingSections);
      getDocumentationAnalysis.mockResolvedValue(outdatedDocs);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should show both sections
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📝 Missing README Sections:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📋 Outdated Documentation Issues:'));

      // Should show separator
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('─'.repeat(60)));
    });

    it('should not show separator when only missing sections exist', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'usage',
          priority: 'required',
          description: 'Usage instructions'
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;

      getMissingReadmeSections.mockResolvedValue(missingSections);
      getDocumentationAnalysis.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📝 Missing README Sections:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('─'.repeat(60)));
    });

    it('should not show separator when only outdated docs exist', async () => {
      const outdatedDocs = [
        {
          file: 'docs/api.md',
          type: 'deprecated-api' as const,
          description: 'Deprecated API usage',
          severity: 'medium' as const
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;

      getMissingReadmeSections.mockResolvedValue([]);
      getDocumentationAnalysis.mockResolvedValue(outdatedDocs);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('📝 Missing README Sections:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📋 Outdated Documentation Issues:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('─'.repeat(60)));
    });
  });

  describe('Error Handling', () => {
    it('should handle getMissingReadmeSections throwing an error', async () => {
      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockRejectedValue(new Error('Missing sections analysis failed'));

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should show error message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to analyze documentation')
      );
    });

    it('should continue with outdated docs analysis even if missing sections fails', async () => {
      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;

      getMissingReadmeSections.mockRejectedValue(new Error('Missing sections failed'));
      getDocumentationAnalysis.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should still call the documentation analysis
      expect(getDocumentationAnalysis).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty section descriptions gracefully', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: ''
        },
        {
          section: 'usage',
          priority: 'required',
          description: '   '
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should still display the sections
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('installation'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('usage'));
    });

    it('should handle very long section descriptions', async () => {
      const longDescription = 'A'.repeat(500) + ' very long description that continues on and on';

      const missingSections: MissingReadmeSection[] = [
        {
          section: 'api',
          priority: 'recommended',
          description: longDescription
        }
      ];

      const getMissingReadmeSections = mockOrchestrator.getMissingReadmeSections as MockedFunction<any>;
      getMissingReadmeSections.mockResolvedValue(missingSections);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Should handle long descriptions without crashing
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('api'));
    });
  });
});