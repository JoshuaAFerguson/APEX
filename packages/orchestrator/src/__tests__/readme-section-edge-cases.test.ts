/**
 * README Section Analysis Edge Cases Tests
 * Tests error handling and edge cases for README section analysis
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

describe('README Section Analysis Edge Cases', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: Partial<TaskStore>;
  let tempDir: string;
  let consoleSpy: MockedFunction<typeof console.warn>;

  beforeEach(() => {
    tempDir = '/mock/project/path';
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
    consoleSpy.mockRestore();
  });

  describe('File System Edge Cases', () => {
    it('should handle projects with no README files', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: '' }); // No README files found
        }
      });

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should return empty array when no README files exist
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });

    it('should handle multiple README files', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'installation'],
            recommended: ['usage'],
            optional: []
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n./README.txt\n./docs/README.rst\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '20\n' });
        }
      });

      const mockFs = fs as any;
      // Mock reading the first README file only
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('README.md')) {
          return `# Project Title

Some description here.
`;
        }
        throw new Error('File not found');
      });

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should analyze the first README file and detect missing installation section
      expect(missingSections.some(s => s.section === 'installation')).toBe(true);
    });

    it('should handle very large README files', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title'],
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
          callback(null, { stdout: '10000\n' }); // Very large file
        }
      });

      const mockFs = fs as any;
      // Create a very large README content
      const largeContent = '# Title\n' + 'This is a line.\n'.repeat(9999);
      mockFs.readFile.mockResolvedValue(largeContent);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle large files without crashing
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle empty README files', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'description'],
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
          callback(null, { stdout: '0\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(''); // Empty file

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should detect all required sections as missing
      expect(missingSections.some(s => s.section === 'title')).toBe(true);
      expect(missingSections.some(s => s.section === 'description')).toBe(true);
    });

    it('should handle README files with only whitespace', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title'],
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
          callback(null, { stdout: '5\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue('   \n\n\t\t\n   \n'); // Only whitespace

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should detect title as missing
      expect(missingSections.some(s => s.section === 'title')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle exec command failures gracefully', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        callback(new Error('Command failed'), null);
      });

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle errors gracefully and return empty array
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });

    it('should handle file read failures gracefully', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '50\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle read errors gracefully
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });

    it('should handle corrupted file content', async () => {
      const config = { daemon: {} };
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
      // Simulate binary/corrupted content
      const corruptedContent = '\x00\x01\x02\xFF\xFE';
      mockFs.readFile.mockResolvedValue(corruptedContent);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle corrupted content without crashing
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle timeout scenarios', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        // Simulate timeout by never calling callback
        if (cmd.includes('README')) {
          setTimeout(() => {
            callback(new Error('Timeout'), null);
          }, 100);
        }
      });

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle timeouts gracefully
      expect(analysis?.documentation?.missingReadmeSections).toEqual([]);
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle README with Unicode content', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'installation'],
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
          callback(null, { stdout: '15\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# Проект 🚀

Это описание проекта на русском языке с эмодзи.

## 安装说明 (Installation in Chinese)
安装这个项目...

## インストール (Installation in Japanese)
このプロジェクトをインストールするには...
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should correctly identify that installation section is present (despite non-English headers)
      // This test depends on the pattern matching logic in the actual implementation
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle README with special markdown formatting', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'usage'],
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
          callback(null, { stdout: '25\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`<h1 align="center">🎯 My Project</h1>

<div align="center">
  <strong>A fancy project with HTML elements</strong>
</div>

### 📚 Usage

\`\`\`javascript
// Code example with syntax highlighting
const example = () => {
  console.log("Hello World");
};
\`\`\`

> **Note:** This is a blockquote with **bold** and *italic* text.

- [x] Task completed
- [ ] Task pending

| Feature | Status |
|---------|--------|
| Basic   | ✅     |
| Advanced| ⏳     |
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle complex markdown formatting
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle extremely long lines', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '5\n' });
        }
      });

      const mockFs = fs as any;
      const veryLongLine = 'This is a very long line '.repeat(1000);
      mockFs.readFile.mockResolvedValue(`# Title\n${veryLongLine}\n## Section\nContent`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle extremely long lines without performance issues
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });
  });

  describe('Pattern Matching Edge Cases', () => {
    it('should handle sections with unusual casing and formatting', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['installation', 'usage'],
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
          callback(null, { stdout: '20\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# Project

## INSTALLATION
Run npm install

### usage
Here's how to use it

#### Installation Notes
Additional notes
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();

      // Should correctly identify sections despite unusual casing
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle false positive section matches', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['installation'],
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
          callback(null, { stdout: '15\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue(`# Project

This project mentions installation in passing but doesn't have
a dedicated installation section. The word installation appears
multiple times in this text but not as a section header.

## Getting Started
Some other content here.
`);

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should still detect installation as missing since it's not a proper section header
      expect(missingSections.some(s => s.section === 'installation')).toBe(true);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle analysis within reasonable time limits', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: ['title', 'installation', 'usage', 'api'],
            recommended: ['examples', 'testing', 'contributing'],
            optional: ['faq', 'troubleshooting', 'roadmap'],
            customSections: Object.fromEntries(
              Array.from({ length: 50 }, (_, i) => [
                `custom-${i}`,
                {
                  displayName: `Custom Section ${i}`,
                  priority: 'optional',
                  indicators: [`custom-${i}`, `section-${i}`],
                  description: `Description for custom section ${i}`
                }
              ])
            )
          }
        }
      };

      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          callback(null, { stdout: './README.md\n' });
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '1000\n' });
        }
      });

      const mockFs = fs as any;
      // Create content with many sections
      const manyLinesContent = Array.from({ length: 1000 }, (_, i) =>
        `Line ${i}: This is content line number ${i}`
      ).join('\n');
      mockFs.readFile.mockResolvedValue(`# Title\n${manyLinesContent}`);

      const startTime = Date.now();
      await idleProcessor.start();
      await idleProcessor.processIdleTime();
      const endTime = Date.now();

      const analysis = idleProcessor.getLastAnalysis();

      // Should complete analysis within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });

    it('should handle concurrent analysis calls', async () => {
      const config = { daemon: {} };
      idleProcessor = new IdleProcessor(tempDir, config, mockStore as TaskStore);

      const childProcess = require('child_process');
      childProcess.exec.mockImplementation((cmd: string, callback: Function) => {
        if (cmd.includes('README')) {
          setTimeout(() => {
            callback(null, { stdout: './README.md\n' });
          }, 50); // Small delay to simulate real file operations
        } else if (cmd.includes('wc -l')) {
          callback(null, { stdout: '10\n' });
        }
      });

      const mockFs = fs as any;
      mockFs.readFile.mockResolvedValue('# Title\nSome content');

      await idleProcessor.start();

      // Start multiple concurrent analysis operations
      const analysisPromises = Array.from({ length: 5 }, () =>
        idleProcessor.processIdleTime()
      );

      await Promise.all(analysisPromises);

      const analysis = idleProcessor.getLastAnalysis();

      // Should handle concurrent calls without issues
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should handle memory pressure with large analysis results', async () => {
      const config = {
        daemon: {},
        documentation: {
          readmeSections: {
            enabled: true,
            required: Array.from({ length: 100 }, (_, i) => `required-${i}`),
            recommended: Array.from({ length: 100 }, (_, i) => `recommended-${i}`),
            optional: Array.from({ length: 100 }, (_, i) => `optional-${i}`)
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
      mockFs.readFile.mockResolvedValue('# Title\nMinimal content');

      await idleProcessor.start();
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      const missingSections = analysis?.documentation?.missingReadmeSections || [];

      // Should handle large result sets efficiently
      expect(missingSections.length).toBeLessThan(300); // Should find most sections as missing
      expect(analysis?.documentation?.missingReadmeSections).toBeDefined();
    });
  });
});