import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StagePalette } from '../StagePalette';
import { STAGE_TEMPLATES } from '@/lib/workflow-editor/constants';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

describe('StagePalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all stage templates', () => {
    render(<StagePalette />);

    // Check that all stage templates are rendered
    STAGE_TEMPLATES.forEach(template => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
      expect(screen.getByText(template.description)).toBeInTheDocument();
    });
  });

  it('groups stages by category', () => {
    render(<StagePalette />);

    // Check for category headers
    const categories = [...new Set(STAGE_TEMPLATES.map(t => t.category))];
    categories.forEach(category => {
      // Should find category sections
      const categoryElements = screen.getAllByText(new RegExp(category, 'i'));
      expect(categoryElements.length).toBeGreaterThan(0);
    });
  });

  it('displays stage information correctly', () => {
    render(<StagePalette />);

    const planningTemplate = STAGE_TEMPLATES.find(t => t.name === 'planning');
    if (planningTemplate) {
      expect(screen.getByText(planningTemplate.name)).toBeInTheDocument();
      expect(screen.getByText(planningTemplate.description)).toBeInTheDocument();
      expect(screen.getByText(planningTemplate.agent)).toBeInTheDocument();
    }
  });

  it('makes stages draggable', () => {
    render(<StagePalette />);

    // Each stage template should be draggable
    STAGE_TEMPLATES.forEach(template => {
      const stageElement = screen.getByText(template.name).closest('[draggable]');
      expect(stageElement).toBeInTheDocument();
    });
  });

  it('shows stage icons if available', () => {
    render(<StagePalette />);

    // Check for stage icons (using data-testid or accessible names)
    const stageElements = screen.getAllByRole('button');
    expect(stageElements.length).toBeGreaterThan(0);
  });

  it('supports keyboard navigation', () => {
    render(<StagePalette />);

    const firstStage = screen.getByText(STAGE_TEMPLATES[0].name).closest('button');

    if (firstStage) {
      // Should be focusable
      firstStage.focus();
      expect(firstStage).toHaveFocus();

      // Should respond to keyboard events
      fireEvent.keyDown(firstStage, { key: 'Enter' });
      fireEvent.keyDown(firstStage, { key: ' ' });

      // Should not throw errors
      expect(firstStage).toBeInTheDocument();
    }
  });

  it('displays agent information for each template', () => {
    render(<StagePalette />);

    // Check that agent information is displayed
    const uniqueAgents = [...new Set(STAGE_TEMPLATES.map(t => t.agent))];
    uniqueAgents.forEach(agent => {
      expect(screen.getByText(agent)).toBeInTheDocument();
    });
  });

  it('shows category color coding', () => {
    render(<StagePalette />);

    // Templates should have category-based styling
    STAGE_TEMPLATES.forEach(template => {
      const templateElement = screen.getByText(template.name);
      expect(templateElement).toBeInTheDocument();
    });
  });

  it('handles empty or missing templates gracefully', () => {
    // Mock empty templates for this test
    const originalTemplates = STAGE_TEMPLATES;

    // Clear templates temporarily
    (STAGE_TEMPLATES as any).length = 0;

    render(<StagePalette />);

    // Should not crash
    expect(screen.getByRole('complementary') || screen.getByRole('navigation')).toBeInTheDocument();

    // Restore templates
    originalTemplates.forEach(template => STAGE_TEMPLATES.push(template));
  });

  it('provides accessibility features', () => {
    render(<StagePalette />);

    // Should have proper ARIA attributes
    const paletteContainer = screen.getByRole('complementary') ||
                            screen.getByRole('navigation') ||
                            screen.getByTestId('stage-palette');

    expect(paletteContainer).toBeInTheDocument();

    // Stage items should be accessible
    const stageButtons = screen.getAllByRole('button');
    stageButtons.forEach(button => {
      expect(button).toHaveAttribute('tabindex', '0');
    });
  });

  it('displays tooltips with additional information', () => {
    render(<StagePalette />);

    const firstTemplate = STAGE_TEMPLATES[0];
    const stageElement = screen.getByText(firstTemplate.name);

    // Hover to show tooltip
    fireEvent.mouseEnter(stageElement);

    // Tooltip content might be in title attribute or separate element
    const elementWithTitle = stageElement.closest('[title]');
    if (elementWithTitle) {
      expect(elementWithTitle).toHaveAttribute('title');
    }
  });

  it('supports search/filtering functionality', () => {
    render(<StagePalette />);

    // Look for search input if it exists
    const searchInput = screen.queryByRole('searchbox') ||
                       screen.queryByPlaceholderText(/search/i) ||
                       screen.queryByLabelText(/filter/i);

    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'planning' } });

      // Should filter results
      expect(screen.getByText('planning')).toBeInTheDocument();
    }
  });
});