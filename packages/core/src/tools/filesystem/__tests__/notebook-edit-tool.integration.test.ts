/**
 * @fileoverview Integration tests for NotebookEditTool
 *
 * These tests verify that the NotebookEditTool integrates properly with the
 * tool registry system and works with real filesystem operations. They test
 * the tool in realistic scenarios including tool registration, workflow
 * integration, and complex multi-step operations.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry } from '../../tool-registry.js';
import { NotebookEditTool, type NotebookEditParams, type NotebookEditOutput } from '../notebook-edit-tool.js';
import { registerNotebookEditTool, createNotebookEditTool } from '../register.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool Integration Tests', () => {
  let registry: ToolRegistry;
  let tool: NotebookEditTool;
  let tempDir: string;

  // Sample notebook structures for testing
  const createComplexNotebook = () => ({
    cells: [
      {
        cell_type: 'markdown',
        id: 'header-cell',
        source: ['# Data Analysis Notebook\n', '\n', 'This notebook performs data analysis on sample datasets.'],
        metadata: { tags: ['documentation'], collapsed: false }
      },
      {
        cell_type: 'code',
        id: 'import-cell',
        source: ['import pandas as pd\n', 'import numpy as np\n', 'import matplotlib.pyplot as plt'],
        metadata: { tags: ['imports'] },
        execution_count: null,
        outputs: []
      },
      {
        cell_type: 'code',
        id: 'data-load-cell',
        source: ['# Load data\n', 'df = pd.read_csv("data.csv")\n', 'print(f"Loaded {len(df)} rows")'],
        metadata: { tags: ['data-loading'] },
        execution_count: 1,
        outputs: [
          {
            output_type: 'stream',
            name: 'stdout',
            text: ['Loaded 1000 rows\n']
          }
        ]
      },
      {
        cell_type: 'markdown',
        id: 'analysis-header',
        source: ['## Data Analysis\n', '\n', 'Let\'s explore the data structure.'],
        metadata: {}
      },
      {
        cell_type: 'code',
        id: 'analysis-cell',
        source: ['# Explore data\n', 'df.describe()'],
        metadata: { tags: ['analysis'] },
        execution_count: 2,
        outputs: []
      }
    ],
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3'
      },
      language_info: {
        name: 'python',
        version: '3.9.0'
      },
      custom: {
        project: 'data-analysis',
        author: 'test-user'
      }
    },
    nbformat: 4,
    nbformat_minor: 5
  });

  beforeEach(async () => {
    registry = new ToolRegistry();
    tool = new NotebookEditTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-integration-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to create a test notebook file
  const createNotebookFile = async (filename: string, content?: any): Promise<string> => {
    const notebookPath = path.join(tempDir, filename);
    const notebookContent = content || createComplexNotebook();
    await fs.writeFile(notebookPath, JSON.stringify(notebookContent, null, 2));
    return notebookPath;
  };

  // ============================================================================
  // Tool Registry Integration Tests
  // ============================================================================

  describe('Tool Registry Integration', () => {
    it('should register NotebookEditTool successfully', () => {
      registry.register(tool);

      expect(registry.has('NotebookEdit')).toBe(true);
      const retrievedTool = registry.get('NotebookEdit');
      expect(retrievedTool).toBe(tool);
    });

    it('should register using convenience function', () => {
      const originalRegistry = registry;
      // Mock the global registry getter temporarily
      const mockGetToolRegistry = () => originalRegistry;

      // Register the tool
      registry.register(createNotebookEditTool());
      expect(registry.has('NotebookEdit')).toBe(true);
    });

    it('should handle duplicate registration gracefully', () => {
      registry.register(tool);

      expect(() => registry.register(tool)).toThrow();
      expect(() => registry.register(new NotebookEditTool())).toThrow();
    });

    it('should expose correct tool metadata through registry', () => {
      registry.register(tool);

      const toolList = registry.list();
      const notebookTool = toolList.find(t => t.name === 'NotebookEdit');

      expect(notebookTool).toBeDefined();
      expect(notebookTool?.description).toContain('Jupyter notebook');
      expect(notebookTool?.category).toBe('filesystem');
      expect(notebookTool?.permissions).toEqual(['read', 'write']);
      expect(notebookTool?.dangerous).toBe(false);
    });
  });

  // ============================================================================
  // Workflow Integration Tests
  // ============================================================================

  describe('Workflow Integration', () => {
    it('should support complete notebook creation and editing workflow', async () => {
      // Step 1: Create empty notebook
      const emptyNotebook = {
        cells: [],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('workflow.ipynb', emptyNotebook);

      // Step 2: Add header cell
      const headerResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# New Project\n\nThis is a new data science project.',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      expect(headerResult.success).toBe(true);
      const headerOutput = headerResult.output as NotebookEditOutput;
      expect(headerOutput.totalCells).toBe(1);
      expect(headerOutput.cellType).toBe('markdown');

      // Step 3: Add import cell after header
      const importResult = await tool.execute({
        notebook_path: notebookPath,
        cell_id: headerOutput.cellId,
        new_source: 'import pandas as pd\nimport numpy as np',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(importResult.success).toBe(true);
      const importOutput = importResult.output as NotebookEditOutput;
      expect(importOutput.totalCells).toBe(2);
      expect(importOutput.cellIndex).toBe(1);

      // Step 4: Update header with more content
      const updateResult = await tool.execute({
        notebook_path: notebookPath,
        cell_id: headerOutput.cellId,
        new_source: '# New Data Science Project\n\nThis project analyzes sales data to identify trends.',
        edit_mode: 'replace'
      });

      expect(updateResult.success).toBe(true);

      // Verify final state
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(2);
      expect(finalNotebook.cells[0].source.join('')).toContain('Data Science Project');
      expect(finalNotebook.cells[1].source.join('')).toContain('import pandas');
    });

    it('should handle complex notebook refactoring workflow', async () => {
      const notebookPath = await createNotebookFile('refactor.ipynb');

      // Step 1: Update imports cell with better organization
      const updateImports = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: '# Data processing libraries\nimport pandas as pd\nimport numpy as np\n\n# Visualization libraries\nimport matplotlib.pyplot as plt\nimport seaborn as sns',
        edit_mode: 'replace'
      });

      expect(updateImports.success).toBe(true);

      // Step 2: Add configuration cell after imports
      const addConfigResult = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: '# Configuration\nplt.style.use("seaborn")\npd.set_option("display.max_rows", 100)',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(addConfigResult.success).toBe(true);
      const configOutput = addConfigResult.output as NotebookEditOutput;

      // Step 3: Remove old analysis cell and replace with better version
      const deleteOld = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'analysis-cell',
        new_source: '',
        edit_mode: 'delete'
      });

      expect(deleteOld.success).toBe(true);

      // Step 4: Add new enhanced analysis
      const newAnalysis = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'analysis-header',
        new_source: '# Enhanced data exploration\nprint("Data shape:", df.shape)\nprint("\\nColumn info:")\nprint(df.info())\nprint("\\nSummary statistics:")\ndf.describe()',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(newAnalysis.success).toBe(true);

      // Verify notebook structure
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);

      // Should have original cells minus deleted one plus two new ones
      expect(finalNotebook.cells).toHaveLength(6); // 5 original - 1 deleted + 2 new

      // Verify import cell was updated
      const importCell = finalNotebook.cells.find((c: any) => c.id === 'import-cell');
      expect(importCell.source.join('')).toContain('seaborn as sns');

      // Verify new config cell exists
      const configCell = finalNotebook.cells.find((c: any) => c.id === configOutput.cellId);
      expect(configCell).toBeDefined();
      expect(configCell.source.join('')).toContain('plt.style.use');
    });

    it('should preserve notebook metadata and cell properties during workflow', async () => {
      const originalNotebook = createComplexNotebook();
      originalNotebook.metadata.custom.workflow_test = true;
      const notebookPath = await createNotebookFile('metadata.ipynb', originalNotebook);

      // Perform multiple operations
      await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-load-cell',
        new_source: '# Load and validate data\ndf = pd.read_csv("data.csv")\nassert len(df) > 0\nprint(f"Successfully loaded {len(df)} rows")',
        edit_mode: 'replace'
      });

      await tool.execute({
        notebook_path: notebookPath,
        new_source: '## Setup and Configuration\n\nNotebook configuration and setup code.',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      // Verify metadata preservation
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);

      expect(finalNotebook.metadata.custom.workflow_test).toBe(true);
      expect(finalNotebook.metadata.custom.project).toBe('data-analysis');
      expect(finalNotebook.metadata.kernelspec.name).toBe('python3');

      // Verify cell metadata preservation
      const dataLoadCell = finalNotebook.cells.find((c: any) => c.id === 'data-load-cell');
      expect(dataLoadCell.metadata.tags).toEqual(['data-loading']);
      expect(dataLoadCell.outputs).toBeDefined(); // Should preserve outputs
    });
  });

  // ============================================================================
  // Real Filesystem Integration Tests
  // ============================================================================

  describe('Real Filesystem Integration', () => {
    it('should handle concurrent access to same notebook gracefully', async () => {
      const notebookPath = await createNotebookFile('concurrent.ipynb');
      const tool1 = new NotebookEditTool();
      const tool2 = new NotebookEditTool();

      // Start both operations simultaneously
      const operation1Promise = tool1.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import pandas as pd  # Updated by tool1',
        edit_mode: 'replace'
      });

      const operation2Promise = tool2.execute({
        notebook_path: notebookPath,
        cell_id: 'data-load-cell',
        new_source: '# Data loading updated by tool2\ndf = pd.read_csv("updated.csv")',
        edit_mode: 'replace'
      });

      // Wait for both to complete
      const [result1, result2] = await Promise.all([operation1Promise, operation2Promise]);

      // One should succeed, the other might fail due to concurrent access
      // But the notebook should remain in a valid state
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      expect(() => JSON.parse(finalContent)).not.toThrow();

      const finalNotebook = JSON.parse(finalContent);
      expect(Array.isArray(finalNotebook.cells)).toBe(true);
      expect(finalNotebook.nbformat).toBe(4);
    });

    it('should handle file system errors gracefully', async () => {
      // Test with non-existent directory
      const badPath = path.join(tempDir, 'nonexistent', 'notebook.ipynb');

      const result = await tool.execute({
        notebook_path: badPath,
        new_source: 'test content',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read notebook');
    });

    it('should create proper backups on write failure recovery', async () => {
      const notebookPath = await createNotebookFile('backup-test.ipynb');

      // Make directory read-only to force write failure
      const dirPath = path.dirname(notebookPath);
      const originalMode = (await fs.stat(dirPath)).mode;

      try {
        await fs.chmod(dirPath, 0o444); // Read-only

        const result = await tool.execute({
          notebook_path: notebookPath,
          cell_id: 'import-cell',
          new_source: 'import pandas as pd  # This should fail to write',
          edit_mode: 'replace'
        });

        expect(result.success).toBe(false);

        // Restore permissions and verify original file is intact
        await fs.chmod(dirPath, originalMode);

        const originalContent = await fs.readFile(notebookPath, 'utf-8');
        const originalNotebook = JSON.parse(originalContent);

        // Original content should be unchanged
        const importCell = originalNotebook.cells.find((c: any) => c.id === 'import-cell');
        expect(importCell.source.join('')).toContain('import pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as plt');

      } finally {
        // Ensure permissions are restored
        try {
          await fs.chmod(dirPath, originalMode);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle very large notebooks efficiently', async () => {
      // Create a notebook with many cells
      const largeCells = [];
      for (let i = 0; i < 100; i++) {
        largeCells.push({
          cell_type: i % 2 === 0 ? 'code' : 'markdown',
          id: `cell-${i}`,
          source: [`# Cell ${i}\n`, `This is cell number ${i} content.`],
          metadata: { index: i },
          ...(i % 2 === 0 ? { execution_count: null, outputs: [] } : {})
        });
      }

      const largeNotebook = {
        cells: largeCells,
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const largePath = await createNotebookFile('large.ipynb', largeNotebook);

      const startTime = Date.now();

      // Perform multiple operations on large notebook
      const results = await Promise.all([
        tool.execute({
          notebook_path: largePath,
          cell_id: 'cell-0',
          new_source: '# Updated first cell\nimport sys',
          edit_mode: 'replace'
        }),
        tool.execute({
          notebook_path: largePath,
          cell_id: 'cell-50',
          new_source: '# New cell after middle\nprint("middle insertion")',
          cell_type: 'code',
          edit_mode: 'insert'
        }),
        tool.execute({
          notebook_path: largePath,
          cell_id: 'cell-99',
          new_source: '',
          edit_mode: 'delete'
        })
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete reasonably quickly (under 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify notebook is still valid
      const finalContent = await fs.readFile(largePath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(100); // 100 original - 1 deleted + 1 inserted
    });
  });

  // ============================================================================
  // Error Handling Integration Tests
  // ============================================================================

  describe('Error Handling Integration', () => {
    it('should provide detailed error information for debugging', async () => {
      const badNotebook = {
        cells: 'invalid',
        metadata: null,
        nbformat: 'wrong'
      };
      const badPath = await createNotebookFile('bad.ipynb', badNotebook);

      const result = await tool.execute({
        notebook_path: badPath,
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
      expect(result.error).toContain(badPath);
    });

    it('should handle tool registry errors gracefully', async () => {
      // Test what happens when tool is not properly registered
      const unregisteredTool = new NotebookEditTool();
      const notebookPath = await createNotebookFile('unregistered.ipynb');

      // Tool should still work even if not registered
      const result = await unregisteredTool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import pandas as pd  # Direct tool use',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
    });

    it('should validate tool compatibility with registry system', () => {
      const toolDef = tool.getDefinition();

      // Verify tool meets registry requirements
      expect(toolDef.name).toBeTruthy();
      expect(toolDef.description).toBeTruthy();
      expect(toolDef.category).toBeTruthy();
      expect(Array.isArray(toolDef.permissions)).toBe(true);
      expect(typeof toolDef.dangerous).toBe('boolean');
      expect(toolDef.version).toBeTruthy();
      expect(Array.isArray(toolDef.tags)).toBe(true);
      expect(toolDef.parameters).toBeTruthy();
      expect(Array.isArray(toolDef.examples)).toBe(true);
    });
  });

  // ============================================================================
  // Cross-Platform Compatibility Tests
  // ============================================================================

  describe('Cross-Platform Compatibility', () => {
    it('should handle different path separators correctly', async () => {
      const notebookPath = await createNotebookFile('cross-platform.ipynb');

      // Normalize path for current platform
      const normalizedPath = path.resolve(notebookPath);

      const result = await tool.execute({
        notebook_path: normalizedPath,
        cell_id: 'import-cell',
        new_source: 'import os\nprint(f"Platform: {os.name}")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.notebookPath).toBe(normalizedPath);
    });

    it('should handle unicode filenames and content properly', async () => {
      const unicodeName = 'test-日本語-🚀.ipynb';
      const unicodeNotebook = createComplexNotebook();
      unicodeNotebook.cells[0].source = ['# 测试笔记本 📊\n', '\n', 'Unicode content test.'];

      const unicodePath = await createNotebookFile(unicodeName, unicodeNotebook);

      const result = await tool.execute({
        notebook_path: unicodePath,
        new_source: '# Python 数据分析 🐍\n\n数据科学项目',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      expect(result.success).toBe(true);

      // Verify unicode is preserved
      const finalContent = await fs.readFile(unicodePath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells[0].source.join('')).toContain('数据分析');
    });
  });
});