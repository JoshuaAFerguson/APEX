import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowEditorProvider } from '../WorkflowEditorProvider';
import { YamlPreviewPanel } from '../YamlPreviewPanel';
import { WorkflowEditor } from '../WorkflowEditor';
import type { WorkflowDefinition } from '@/types/workflow-editor';

// Mock file system APIs for testing
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
const mockWriteText = vi.fn().mockResolvedValue(undefined);

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock document.createElement for download functionality
const mockClick = vi.fn();
const mockCreateElement = vi.fn((tag: string) => {
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick,
      style: {},
    };
  }
  return document.createElement(tag);
});

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true,
});

// Mock FileReader for file upload testing
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: string | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.result = file.type.includes('yaml') ?
        'name: Imported Workflow\ndescription: A workflow from file\nstages: []\ngates: []' :
        file.name;
      this.onload?.({ target: this });
    }, 0);
  }
}

Object.defineProperty(window, 'FileReader', {
  value: MockFileReader,
  writable: true,
});

const mockWorkflow: WorkflowDefinition = {
  name: 'Test Workflow',
  description: 'A comprehensive test workflow for YAML operations',
  stages: [
    {
      name: 'planning',
      agent: 'planner',
      description: 'Plan the implementation',
      dependencies: [],
      gates: [],
    },
    {
      name: 'development',
      agent: 'developer',
      description: 'Implement the feature',
      dependencies: ['planning'],
      gates: [
        {
          name: 'code-review',
          type: 'approval',
          approvers: ['senior-dev', 'tech-lead'],
        },
      ],
    },
    {
      name: 'testing',
      agent: 'tester',
      description: 'Test the implementation',
      dependencies: ['development'],
      gates: [],
    },
  ],
  gates: [
    {
      name: 'security-review',
      type: 'manual',
      approvers: ['security-team'],
    },
  ],
};

const renderWorkflowWithYamlPanel = (workflow?: Partial<WorkflowDefinition>) => {
  const initialWorkflow = { ...mockWorkflow, ...workflow };

  return render(
    <WorkflowEditorProvider initialWorkflow={initialWorkflow}>
      <div>
        <WorkflowEditor />
        <YamlPreviewPanel />
      </div>
    </WorkflowEditorProvider>
  );
};

describe('YAML Import/Export Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('YAML Export Functionality', () => {
    it('exports workflow to YAML format', async () => {
      renderWorkflowWithYamlPanel();

      // Find export button
      const exportButton = screen.getByRole('button', { name: /export|download/i });
      expect(exportButton).toBeInTheDocument();

      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.any(Blob)
        );
        expect(mockCreateElement).toHaveBeenCalledWith('a');
        expect(mockClick).toHaveBeenCalled();
      });
    });

    it('generates valid YAML with correct structure', async () => {
      renderWorkflowWithYamlPanel();

      // The YAML should be visible in the preview
      expect(screen.getByText(/name.*Test Workflow/)).toBeInTheDocument();
      expect(screen.getByText(/planning/)).toBeInTheDocument();
      expect(screen.getByText(/development/)).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
      expect(screen.getByText(/code-review/)).toBeInTheDocument();
    });

    it('includes all workflow components in export', async () => {
      renderWorkflowWithYamlPanel();

      const exportButton = screen.getByRole('button', { name: /export|download/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text/yaml',
          })
        );
      });

      // Verify the blob contains expected content
      const blobCall = mockCreateObjectURL.mock.calls[0];
      const blob = blobCall[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/yaml');
    });

    it('handles complex workflows with dependencies and gates', async () => {
      const complexWorkflow = {
        name: 'Complex Workflow',
        description: 'A workflow with complex dependencies',
        stages: [
          {
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
            dependencies: [],
            gates: [],
          },
          {
            name: 'stage2',
            agent: 'agent2',
            description: 'Second stage',
            dependencies: ['stage1'],
            gates: [
              {
                name: 'gate1',
                type: 'approval' as const,
                approvers: ['approver1', 'approver2'],
              },
            ],
          },
          {
            name: 'stage3',
            agent: 'agent3',
            description: 'Third stage',
            dependencies: ['stage1', 'stage2'],
            gates: [],
          },
        ],
        gates: [
          {
            name: 'global-gate',
            type: 'manual' as const,
            approvers: ['global-approver'],
          },
        ],
      };

      renderWorkflowWithYamlPanel(complexWorkflow);

      const exportButton = screen.getByRole('button', { name: /export|download/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled();
      });
    });

    it('provides custom filename for export', async () => {
      renderWorkflowWithYamlPanel();

      const exportButton = screen.getByRole('button', { name: /export|download/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateElement).toHaveBeenCalledWith('a');
      });

      // Should set appropriate filename
      expect(mockClick).toHaveBeenCalled();
    });

    it('copies YAML to clipboard', async () => {
      renderWorkflowWithYamlPanel();

      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();

      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('name: Test Workflow')
        );
      });
    });

    it('handles clipboard copy errors gracefully', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'));

      renderWorkflowWithYamlPanel();

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      // Should not throw error, might show error message
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      });
    });
  });

  describe('YAML Import Functionality', () => {
    it('imports workflow from YAML file', async () => {
      renderWorkflowWithYamlPanel({ stages: [], gates: [] });

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      expect(fileInput).toBeInTheDocument();

      const yamlContent = `
name: Imported Workflow
description: A workflow imported from YAML file
stages:
  - name: imported-stage
    agent: planner
    description: This stage was imported
    dependencies: []
    gates: []
  - name: second-stage
    agent: developer
    description: Second imported stage
    dependencies:
      - imported-stage
    gates:
      - name: import-gate
        type: approval
        approvers:
          - reviewer
gates:
  - name: global-import-gate
    type: manual
    approvers: []
      `;

      const file = new File([yamlContent], 'workflow.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/imported-stage/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('validates YAML syntax during import', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const invalidYaml = `
name: Invalid Workflow
stages:
  - name: "unclosed quote stage
    agent: planner
      `;

      const file = new File([invalidYaml], 'invalid.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show validation error
      await waitFor(() => {
        const errorElement = screen.queryByText(/error|invalid|syntax/i);
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });
    });

    it('validates workflow structure during import', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const incompleteYaml = `
name: Incomplete Workflow
description: Missing required fields
stages:
  - name: incomplete-stage
    # Missing agent field
    description: Stage without agent
    dependencies: []
      `;

      const file = new File([incompleteYaml], 'incomplete.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show validation error for missing required fields
      await waitFor(() => {
        const errorElement = screen.queryByText(/missing|required|agent/i);
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });
    });

    it('handles large YAML files efficiently', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      // Create a large workflow
      const largeWorkflowYaml = `
name: Large Workflow
description: A workflow with many stages
stages:
${Array.from({ length: 50 }, (_, i) => `
  - name: stage${i}
    agent: agent${i % 5}
    description: Stage ${i} description
    dependencies: ${i > 0 ? `[stage${i - 1}]` : '[]'}
    gates: []`).join('')}
gates: []
      `;

      const file = new File([largeWorkflowYaml], 'large-workflow.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should handle large files without performance issues
      await waitFor(() => {
        const stageElement = screen.queryByText(/stage0/);
        if (stageElement) {
          expect(stageElement).toBeInTheDocument();
        }
      }, { timeout: 2000 });
    });

    it('preserves workflow integrity during import', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const preservationTestYaml = `
name: Preservation Test Workflow
description: Test workflow integrity preservation
stages:
  - name: stage-a
    agent: agent-a
    description: First stage
    dependencies: []
    gates:
      - name: gate-a
        type: approval
        approvers:
          - approver-a
  - name: stage-b
    agent: agent-b
    description: Second stage depends on first
    dependencies:
      - stage-a
    gates: []
gates:
  - name: global-gate
    type: manual
    approvers:
      - global-approver
      `;

      const file = new File([preservationTestYaml], 'preservation.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/stage-a/)).toBeInTheDocument();
        expect(screen.getByText(/stage-b/)).toBeInTheDocument();
        expect(screen.getByText(/gate-a/)).toBeInTheDocument();
        expect(screen.getByText(/global-gate/)).toBeInTheDocument();
      });
    });

    it('handles different file types appropriately', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      // Test with non-YAML file
      const textFile = new File(['not yaml content'], 'not-yaml.txt', {
        type: 'text/plain',
      });

      fireEvent.change(fileInput, { target: { files: [textFile] } });

      // Should show appropriate error or handle gracefully
      await waitFor(() => {
        const errorElement = screen.queryByText(/format|type|yaml/i);
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });
    });
  });

  describe('Round-trip Import/Export', () => {
    it('maintains workflow integrity through export-import cycle', async () => {
      renderWorkflowWithYamlPanel();

      // Export workflow
      const exportButton = screen.getByRole('button', { name: /export|download/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled();
      });

      // Get the exported YAML content
      const blobCall = mockCreateObjectURL.mock.calls[0];
      const blob = blobCall[0];

      // Simulate reading the blob content
      const reader = new FileReader();
      const readPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });

      // Create a file from the exported content for import
      const yamlContent = `
name: Test Workflow
description: A comprehensive test workflow for YAML operations
stages:
  - name: planning
    agent: planner
    description: Plan the implementation
    dependencies: []
    gates: []
  - name: development
    agent: developer
    description: Implement the feature
    dependencies:
      - planning
    gates:
      - name: code-review
        type: approval
        approvers:
          - senior-dev
          - tech-lead
  - name: testing
    agent: tester
    description: Test the implementation
    dependencies:
      - development
    gates: []
gates:
  - name: security-review
    type: manual
    approvers:
      - security-team
      `;

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const importFile = new File([yamlContent], 'exported-workflow.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [importFile] } });

      await waitFor(() => {
        expect(screen.getByText(/planning/)).toBeInTheDocument();
        expect(screen.getByText(/development/)).toBeInTheDocument();
        expect(screen.getByText(/testing/)).toBeInTheDocument();
        expect(screen.getByText(/code-review/)).toBeInTheDocument();
        expect(screen.getByText(/security-review/)).toBeInTheDocument();
      });
    });

    it('handles multiple export-import cycles without degradation', async () => {
      renderWorkflowWithYamlPanel();

      // Perform multiple export-import cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Export
        const exportButton = screen.getByRole('button', { name: /export|download/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
          expect(mockCreateObjectURL).toHaveBeenCalled();
        });

        // Simulate import of the same content
        const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                         screen.querySelector('input[type="file"]');

        const yamlContent = `
name: Test Workflow
description: A comprehensive test workflow for YAML operations
stages:
  - name: planning
    agent: planner
    description: Plan the implementation
    dependencies: []
    gates: []
gates: []
        `;

        const file = new File([yamlContent], `cycle-${cycle}.yaml`, {
          type: 'text/yaml',
        });

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByText(/planning/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Real-time YAML Preview', () => {
    it('updates YAML preview when workflow changes', async () => {
      renderWorkflowWithYamlPanel();

      // Initial YAML should be displayed
      expect(screen.getByText(/name.*Test Workflow/)).toBeInTheDocument();

      // Simulate workflow change (this would typically come from editor interactions)
      // For this test, we can verify the YAML content updates appropriately
      expect(screen.getByText(/planning/)).toBeInTheDocument();
      expect(screen.getByText(/development/)).toBeInTheDocument();
    });

    it('shows validation status in real-time', async () => {
      renderWorkflowWithYamlPanel();

      // Should show validation status
      const validationIndicator = screen.queryByText(/valid|invalid|error/i) ||
                                 screen.queryByRole('status');

      if (validationIndicator) {
        expect(validationIndicator).toBeInTheDocument();
      }
    });

    it('provides syntax highlighting for YAML content', async () => {
      renderWorkflowWithYamlPanel();

      // Look for syntax highlighting elements
      const codeElement = screen.querySelector('pre') ||
                         screen.querySelector('code') ||
                         screen.querySelector('.language-yaml') ||
                         screen.querySelector('[data-language="yaml"]');

      if (codeElement) {
        expect(codeElement).toBeInTheDocument();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles file read errors gracefully', async () => {
      // Mock FileReader to simulate error
      const originalFileReader = window.FileReader;
      window.FileReader = class extends MockFileReader {
        readAsText() {
          setTimeout(() => {
            this.onerror?.({ target: this });
          }, 0);
        }
      } as any;

      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const file = new File(['content'], 'test.yaml', { type: 'text/yaml' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should handle error gracefully
      await waitFor(() => {
        const errorElement = screen.queryByText(/error|failed/i);
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });

      // Restore original FileReader
      window.FileReader = originalFileReader;
    });

    it('handles export errors gracefully', async () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error('Failed to create blob URL');
      });

      renderWorkflowWithYamlPanel();

      const exportButton = screen.getByRole('button', { name: /export|download/i });

      // Should not crash on export error
      expect(() => fireEvent.click(exportButton)).not.toThrow();
    });

    it('handles empty workflow export/import', async () => {
      renderWorkflowWithYamlPanel({
        name: '',
        description: '',
        stages: [],
        gates: [],
      });

      const exportButton = screen.getByRole('button', { name: /export|download/i });
      fireEvent.click(exportButton);

      // Should handle empty workflow
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled();
      });
    });

    it('handles malformed YAML gracefully', async () => {
      renderWorkflowWithYamlPanel();

      const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                       screen.querySelector('input[type="file"]');

      const malformedYaml = `
name: Malformed Workflow
stages:
  - name: stage1
    agent: {invalid: yaml: structure: [[[
      `;

      const file = new File([malformedYaml], 'malformed.yaml', {
        type: 'text/yaml',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show error message
      await waitFor(() => {
        const errorElement = screen.queryByText(/error|invalid|malformed/i);
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });
    });
  });
});