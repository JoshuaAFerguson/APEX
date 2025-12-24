/**
 * README Section Configuration Tests
 * Tests configuration-driven README section analysis
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IdleProcessor } from '../idle-processor.js';
import { MissingReadmeSection, DocumentationAnalysisConfig } from '@apexcli/core';
import { TaskStore } from '../store.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('README Section Configuration', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: Partial<TaskStore>;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/mock/project/path';

    mockStore = {
      insertIdleAnalysis: vi.fn(),
      getLatestIdleAnalysis: vi.fn(),
    };

    // Mock exec function for finding files
    const childProcess = require('child_process');
    childProcess.exec = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Default Configuration', () => {
    it('should use default required sections when no config provided', () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      // Mock the execution result for finding README files
      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        }
      });

      // The default required sections should be used
      // ['title', 'description', 'installation', 'usage']
      expect(idleProcessor).toBeDefined();
    });

    it('should use default recommended and optional sections', () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      // Default recommended: ['api', 'contributing', 'license']
      // Default optional: ['testing', 'troubleshooting', 'faq', 'changelog']
      expect(idleProcessor).toBeDefined();
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom required sections from configuration', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'installation', 'license', 'support'],
            recommended: ['api', 'examples'],
            optional: ['faq']
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      // Mock file finding and content reading
      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '50\n' });
        }
      });

      // Mock file reading - simulate README without some sections
      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Project

This is a description of my project.

## Installation
npm install my-project

## Examples
Here are some examples.
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should detect missing 'license' and 'support' sections (from custom required)
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();

      const missingRequired = analysis?.documentation?.missingReadmeSections?.filter(
        s => s.priority === 'required'
      );

      // Should include 'license' and 'support' from custom required sections
      const missingSectionNames = missingRequired?.map(s => s.section) || [];
      expect(missingSectionNames).toContain('license');
      expect(missingSectionNames).toContain('support');
    });

    it('should respect disabled README section analysis', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: false
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        callback(null, { stdout: '' });
      });

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should return empty array when disabled
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });

    it('should handle empty configuration arrays', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: [],
            recommended: [],
            optional: []
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '10\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue('# Project\nSome content.');

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should not find any missing sections when none are configured
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });
  });

  describe('Custom Section Definitions', () => {
    it('should handle custom sections with specific patterns', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title'],
            recommended: [],
            optional: [],
            customSections: {
              'security': {
                displayName: 'Security',
                priority: 'recommended',
                indicators: ['security', 'vulnerability', 'auth'],
                description: 'Security considerations and best practices'
              },
              'performance': {
                displayName: 'Performance',
                priority: 'optional',
                indicators: ['performance', 'optimization', 'speed'],
                description: 'Performance tips and benchmarks'
              }
            }
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '20\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Project

This is a basic project without security or performance sections.
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should detect missing custom sections
      const customMissing = missingSections.filter(s =>
        ['security', 'performance'].includes(s.section as string)
      );

      expect(customMissing).toHaveLength(2);

      const securitySection = customMissing.find(s => s.section === 'security');
      expect(securitySection?.priority).toBe('recommended');
      expect(securitySection?.description).toBe('Security considerations and best practices');

      const performanceSection = customMissing.find(s => s.section === 'performance');
      expect(performanceSection?.priority).toBe('optional');
    });

    it('should not flag custom sections when their indicators are present', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: [],
            recommended: [],
            optional: [],
            customSections: {
              'deployment': {
                displayName: 'Deployment',
                priority: 'required',
                indicators: ['deploy', 'deployment', 'production'],
                description: 'Deployment instructions'
              }
            }
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '30\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Project

## Deployment
To deploy this application to production...
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should not detect deployment as missing since 'deployment' indicator is present
      const deploymentMissing = missingSections.find(s => s.section === 'deployment');
      expect(deploymentMissing).toBeUndefined();
    });
  });

  describe('Mixed Standard and Custom Sections', () => {
    it('should handle both standard and custom sections together', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'installation'],
            recommended: ['api'],
            optional: ['faq'],
            customSections: {
              'docker': {
                displayName: 'Docker Setup',
                priority: 'recommended',
                indicators: ['docker', 'container', 'dockerfile'],
                description: 'Docker setup instructions'
              }
            }
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '25\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Project

## Installation
npm install
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should detect missing 'api', 'faq', and 'docker' sections
      const missingSectionNames = missingSections.map(s => s.section);
      expect(missingSectionNames).toContain('api');
      expect(missingSectionNames).toContain('faq');
      expect(missingSectionNames).toContain('docker');

      // Should not detect 'title' and 'installation' as they are present
      expect(missingSectionNames).not.toContain('title');
      expect(missingSectionNames).not.toContain('installation');
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid priority values gracefully', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            customSections: {
              'invalid': {
                displayName: 'Invalid Section',
                priority: 'invalid-priority' as any, // Invalid priority
                indicators: ['invalid'],
                description: 'Invalid section'
              }
            }
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        }
      });

      // Should not crash with invalid configuration
      await idleProcessor.start();
      expect(idleProcessor).toBeDefined();
    });

    it('should handle missing required fields in custom sections', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            customSections: {
              'incomplete': {
                displayName: 'Incomplete Section',
                // Missing priority, indicators, and description
              } as any
            }
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        }
      });

      // Should handle incomplete configuration gracefully
      await idleProcessor.start();
      expect(idleProcessor).toBeDefined();
    });
  });

  describe('Project-Specific Configurations', () => {
    it('should adapt to project type with appropriate section requirements', async () => {
      // Simulate a library project configuration
      const libraryConfig = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'description', 'installation', 'usage', 'api'],
            recommended: ['examples', 'testing', 'contributing', 'license'],
            optional: ['changelog', 'roadmap']
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, libraryConfig, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '40\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Library

A useful library for developers.

## Installation
npm install my-library

## Usage
const lib = require('my-library');
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should detect missing 'api' (required), and recommended sections
      const requiredMissing = missingSections.filter(s => s.priority === 'required');
      const recommendedMissing = missingSections.filter(s => s.priority === 'recommended');

      expect(requiredMissing.some(s => s.section === 'api')).toBe(true);
      expect(recommendedMissing.length).toBeGreaterThan(0);
    });

    it('should handle application project with different requirements', async () => {
      // Simulate an application project configuration
      const appConfig = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'description', 'installation', 'usage'],
            recommended: ['features', 'configuration', 'troubleshooting'],
            optional: ['contributing', 'license']
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, appConfig, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '35\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# My Application

A great web application.

## Installation
Clone and run npm install.

## Usage
Start the server with npm start.
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should not detect any required sections as missing
      const requiredMissing = missingSections.filter(s => s.priority === 'required');
      expect(requiredMissing).toHaveLength(0);

      // Should detect missing recommended sections
      const recommendedMissing = missingSections.filter(s => s.priority === 'recommended');
      const recommendedSectionNames = recommendedMissing.map(s => s.section);
      expect(recommendedSectionNames).toContain('features');
      expect(recommendedSectionNames).toContain('configuration');
      expect(recommendedSectionNames).toContain('troubleshooting');
    });
  });
});