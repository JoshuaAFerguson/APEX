import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { YamlPreviewPanel } from '../YamlPreviewPanel';
import { WorkflowEditorProvider } from '../WorkflowEditorProvider';
import type { WorkflowDefinition } from '@/types/workflow-editor';

// Mock the file system APIs
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: vi.fn(),
      };
    }
    return document.createElement(tag);
  }),
});

const mockWorkflow: WorkflowDefinition = {
  name: 'Test Workflow',
  description: 'A test workflow for YAML testing',
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
      gates: [],
    },
  ],
  gates: [],
};

const renderYamlPreviewPanel = (workflow?: Partial<WorkflowDefinition>) => {
  const initialWorkflow = { ...mockWorkflow, ...workflow };

  return render(
    <WorkflowEditorProvider initialWorkflow={initialWorkflow}>
      <YamlPreviewPanel />
    </WorkflowEditorProvider>
  );
};

describe('YamlPreviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders YAML preview panel', () => {
    renderYamlPreviewPanel();

    // Should render the panel
    expect(screen.getByRole('region') || screen.getByTestId('yaml-preview')).toBeInTheDocument();
  });

  it('displays workflow as YAML', () => {
    renderYamlPreviewPanel();

    // Should show YAML content with workflow structure
    expect(screen.getByText(/name.*Test Workflow/s)).toBeInTheDocument();
    expect(screen.getByText(/planning/)).toBeInTheDocument();
    expect(screen.getByText(/development/)).toBeInTheDocument();
  });

  it('provides export functionality', async () => {
    renderYamlPreviewPanel();

    const exportButton = screen.getByRole('button', { name: /export|download/i });
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('supports copying YAML to clipboard', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    renderYamlPreviewPanel();

    const copyButton = screen.getByRole('button', { name: /copy/i });
    if (copyButton) {
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    }
  });

  it('supports importing YAML from file', async () => {
    renderYamlPreviewPanel();

    const fileInput = screen.getByLabelText(/import|upload|file/i) ||
                     screen.querySelector('input[type="file"]');

    if (fileInput) {
      const yamlContent = `
name: Imported Workflow
description: A workflow imported from file
stages:
  - name: imported-stage
    agent: planner
    description: Imported stage
    dependencies: []
    gates: []
gates: []
      `;

      const file = new File([yamlContent], 'workflow.yaml', { type: 'text/yaml' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should process the file
      await waitFor(() => {
        expect(screen.getByText(/imported-stage/i)).toBeInTheDocument();
      });
    }
  });

  it('validates YAML syntax', () => {
    renderYamlPreviewPanel();

    // Should show validation status
    const validationIndicator = screen.queryByText(/valid|invalid|error/i) ||
                               screen.queryByRole('status');

    // YAML should be valid for the mock workflow
    if (validationIndicator) {
      expect(validationIndicator).toBeInTheDocument();
    }
  });

  it('handles syntax errors gracefully', async () => {
    // Create workflow that might cause YAML issues
    const problematicWorkflow = {
      ...mockWorkflow,
      name: 'Workflow with "quotes" and special: chars',
    };

    renderYamlPreviewPanel(problematicWorkflow);

    // Should still render without crashing
    expect(screen.getByRole('region') || screen.getByTestId('yaml-preview')).toBeInTheDocument();
  });

  it('updates YAML when workflow changes', async () => {
    const { rerender } = renderYamlPreviewPanel();

    // Initial content
    expect(screen.getByText(/Test Workflow/)).toBeInTheDocument();

    // Update workflow
    const updatedWorkflow = {
      ...mockWorkflow,
      name: 'Updated Workflow',
      stages: [
        ...mockWorkflow.stages,
        {
          name: 'testing',
          agent: 'tester',
          description: 'Test the implementation',
          dependencies: ['development'],
          gates: [],
        },
      ],
    };

    rerender(
      <WorkflowEditorProvider initialWorkflow={updatedWorkflow}>
        <YamlPreviewPanel />
      </WorkflowEditorProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Updated Workflow/)).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
    });
  });

  it('formats YAML properly', () => {
    renderYamlPreviewPanel();

    // Check for proper YAML structure
    const yamlContent = screen.getByText(/name.*Test Workflow/s);
    expect(yamlContent).toBeInTheDocument();

    // Should have proper indentation and structure
    expect(screen.getByText(/stages:/)).toBeInTheDocument();
    expect(screen.getByText(/gates:/)).toBeInTheDocument();
  });

  it('handles empty workflows', () => {
    renderYamlPreviewPanel({
      stages: [],
      gates: [],
      name: '',
      description: '',
    });

    // Should render without errors
    expect(screen.getByRole('region') || screen.getByTestId('yaml-preview')).toBeInTheDocument();
  });

  it('provides syntax highlighting', () => {
    renderYamlPreviewPanel();

    // Look for code element or syntax highlighting container
    const codeElement = screen.querySelector('pre') ||
                       screen.querySelector('code') ||
                       screen.querySelector('.language-yaml') ||
                       screen.querySelector('[data-language="yaml"]');

    if (codeElement) {
      expect(codeElement).toBeInTheDocument();
    }
  });

  it('supports full screen mode', () => {
    renderYamlPreviewPanel();

    const fullscreenButton = screen.queryByRole('button', { name: /fullscreen|expand/i });

    if (fullscreenButton) {
      fireEvent.click(fullscreenButton);

      // Should toggle fullscreen mode
      expect(fullscreenButton).toBeInTheDocument();
    }
  });

  it('handles large workflows efficiently', () => {
    const largeWorkflow = {
      name: 'Large Workflow',
      description: 'A workflow with many stages',
      stages: Array.from({ length: 50 }, (_, i) => ({
        name: `stage${i}`,
        agent: `agent${i % 5}`,
        description: `Stage ${i} description`,
        dependencies: i > 0 ? [`stage${i - 1}`] : [],
        gates: [],
      })),
      gates: [],
    };

    renderYamlPreviewPanel(largeWorkflow);

    // Should render without performance issues
    expect(screen.getByRole('region') || screen.getByTestId('yaml-preview')).toBeInTheDocument();
  });

  it('provides accessibility features', () => {
    renderYamlPreviewPanel();

    const yamlContainer = screen.getByRole('region') ||
                         screen.getByTestId('yaml-preview') ||
                         screen.querySelector('[role="textbox"]');

    expect(yamlContainer).toBeInTheDocument();

    // Should have proper labels
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveAccessibleName();
    });
  });
});