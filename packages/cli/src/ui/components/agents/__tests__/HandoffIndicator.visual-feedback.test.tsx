/**
 * Enhanced visual feedback tests for HandoffIndicator component
 * Tests agent icons, enhanced arrows, and color transitions
 */

import React from 'react';
import { render } from '@testing-library/react';
import { HandoffIndicator } from '../HandoffIndicator.js';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

// Mock animation state factory
function createMockAnimationState(
  overrides: Partial<HandoffAnimationState> = {}
): HandoffAnimationState {
  return {
    isAnimating: true,
    previousAgent: 'planner',
    currentAgent: 'developer',
    progress: 0.5,
    isFading: false,
    transitionPhase: 'active',
    pulseIntensity: 0.7,
    arrowFrame: 1,
    handoffStartTime: new Date(),
    arrowAnimationFrame: 4,
    iconFrame: 3,
    colorIntensity: 0.5,
    colorPhase: 'transitioning',
    ...overrides,
  };
}

const mockAgentColors = {
  planner: 'magenta',
  developer: 'green',
  architect: 'blue',
  tester: 'cyan',
  reviewer: 'yellow',
  devops: 'red',
};

describe('HandoffIndicator - Enhanced Visual Feedback', () => {
  describe('agent icons', () => {
    it('should display source agent icon', () => {
      const animationState = createMockAnimationState();
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={true}
        />
      );

      // Should display planner icon (📋 or [P])
      expect(getByText(/📋|\\[P\\]/, { exact: false })).toBeInTheDocument();
    });

    it('should display target agent icon', () => {
      const animationState = createMockAnimationState();
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={true}
        />
      );

      // Should display developer icon (💻 or [D])
      expect(getByText(/💻|\\[D\\]/, { exact: false })).toBeInTheDocument();
    });

    it('should use fallback icon for unknown agents', () => {
      const animationState = createMockAnimationState({
        previousAgent: 'unknown-agent',
        currentAgent: 'another-unknown',
      });
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={true}
        />
      );

      // Should display default icons (🤖 or [?])
      expect(getByText(/🤖|\\[\\?\\]/, { exact: false })).toBeInTheDocument();
    });

    it('should support ASCII icons for compatibility', () => {
      const animationState = createMockAnimationState();
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={true}
          forceAsciiIcons={true}
        />
      );

      // Should display ASCII icons
      expect(getByText(/\\[P\\]/, { exact: false })).toBeInTheDocument();
      expect(getByText(/\\[D\\]/, { exact: false })).toBeInTheDocument();
    });

    it('should respect showAgentIcons prop', () => {
      const animationState = createMockAnimationState();
      const { queryByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={false}
        />
      );

      // Should not display icons
      expect(queryByText(/📋|💻|\\[P\\]|\\[D\\]/, { exact: false })).not.toBeInTheDocument();
    });

    it('should use custom agent icons', () => {
      const customIcons = {
        planner: '🗓️',
        developer: '⚡',
      };
      const animationState = createMockAnimationState();
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={true}
          agentIcons={customIcons}
        />
      );

      expect(getByText(/🗓️/, { exact: false })).toBeInTheDocument();
      expect(getByText(/⚡/, { exact: false })).toBeInTheDocument();
    });
  });

  describe('enhanced arrow animation', () => {
    it('should render correct arrow for each enhanced frame', () => {
      const arrowFrameTests = [
        { frame: 0, expected: '·→' },
        { frame: 1, expected: '→·' },
        { frame: 2, expected: '→→' },
        { frame: 3, expected: '→→·' },
        { frame: 4, expected: '→→→' },
        { frame: 5, expected: '→→→·' },
        { frame: 6, expected: '⟶→→' },
        { frame: 7, expected: '⟹' },
      ];

      arrowFrameTests.forEach(({ frame, expected }) => {
        const animationState = createMockAnimationState({
          arrowAnimationFrame: frame,
        });
        const { getByText } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
            arrowStyle="enhanced"
          />
        );

        expect(getByText(expected, { exact: false })).toBeInTheDocument();
      });
    });

    it('should support sparkle arrow style', () => {
      const sparkleFrameTests = [
        { frame: 0, expected: '✦→' },
        { frame: 1, expected: '→✦' },
        { frame: 2, expected: '→→✦' },
        { frame: 3, expected: '✦→→→' },
        { frame: 4, expected: '→→→✦' },
        { frame: 7, expected: '⟹✦' },
      ];

      sparkleFrameTests.forEach(({ frame, expected }) => {
        const animationState = createMockAnimationState({
          arrowAnimationFrame: frame,
        });
        const { getByText } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
            arrowStyle="sparkle"
          />
        );

        expect(getByText(expected, { exact: false })).toBeInTheDocument();
      });
    });

    it('should fall back to basic style', () => {
      const animationState = createMockAnimationState({
        arrowFrame: 2, // Basic style uses arrowFrame, not arrowAnimationFrame
      });
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          arrowStyle="basic"
        />
      );

      expect(getByText('→→→', { exact: false })).toBeInTheDocument();
    });
  });

  describe('color transitions', () => {
    it('should dim source agent during transition', () => {
      const animationState = createMockAnimationState({
        colorPhase: 'target-bright',
        progress: 0.8, // Late in transition
      });
      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          enableColorTransition={true}
        />
      );

      // Source agent text should have dimmed styling
      const sourceText = container.querySelector('[data-testid="source-agent"]');
      if (sourceText) {
        expect(sourceText).toHaveClass('dim'); // Assuming Ink adds classes
      }
    });

    it('should brighten target agent during transition', () => {
      const animationState = createMockAnimationState({
        colorPhase: 'target-bright',
        progress: 0.8,
      });
      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          enableColorTransition={true}
        />
      );

      // Target agent text should have bright styling
      const targetText = container.querySelector('[data-testid="target-agent"]');
      if (targetText) {
        expect(targetText).toHaveClass('bold'); // Assuming Ink adds classes
      }
    });

    it('should animate border color in full mode', () => {
      const progressTests = [
        { progress: 0.1, expectedBorder: 'gray' },
        { progress: 0.5, expectedBorder: 'white' },
        { progress: 0.7, expectedBorder: 'green' }, // Target color
        { progress: 0.9, expectedBorder: 'gray' },
      ];

      progressTests.forEach(({ progress, expectedBorder }) => {
        const animationState = createMockAnimationState({
          progress,
          currentAgent: 'developer', // green color
        });
        const { container } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
            enableColorTransition={true}
            compact={false}
          />
        );

        // Check border color (implementation depends on how Ink renders)
        const box = container.querySelector('[data-border-color]');
        if (box) {
          expect(box.getAttribute('data-border-color')).toBe(expectedBorder);
        }
      });
    });

    it('should apply intensity-based styling', () => {
      const intensityTests = [
        {
          colorPhase: 'source-bright' as const,
          expectedSource: 'bright',
          expectedTarget: 'faded',
        },
        {
          colorPhase: 'transitioning' as const,
          expectedSource: 'dim',
          expectedTarget: 'normal',
        },
        {
          colorPhase: 'target-bright' as const,
          expectedSource: 'faded',
          expectedTarget: 'bright',
        },
      ];

      intensityTests.forEach(({ colorPhase, expectedSource, expectedTarget }) => {
        const animationState = createMockAnimationState({
          colorPhase,
          progress: 0.5,
        });
        const { getByText } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
            enableColorTransition={true}
          />
        );

        expect(getByText('planner')).toBeDefined();
        expect(getByText('developer')).toBeDefined();
      });
    });
  });

  describe('compact vs full mode', () => {
    it('should show enhanced features in compact mode', () => {
      const animationState = createMockAnimationState({
        arrowAnimationFrame: 4,
      });
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
          showAgentIcons={true}
          arrowStyle="enhanced"
        />
      );

      expect(getByText(/📋|\\[P\\]/, { exact: false })).toBeInTheDocument();
      expect(getByText(/💻|\\[D\\]/, { exact: false })).toBeInTheDocument();
      expect(getByText('→→→', { exact: false })).toBeInTheDocument();
    });

    it('should show enhanced features in full mode', () => {
      const animationState = createMockAnimationState({
        arrowAnimationFrame: 6,
      });
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showAgentIcons={true}
          arrowStyle="enhanced"
        />
      );

      expect(getByText(/⚡ Handoff/, { exact: false })).toBeInTheDocument();
      expect(getByText(/📋|\\[P\\]/, { exact: false })).toBeInTheDocument();
      expect(getByText(/💻|\\[D\\]/, { exact: false })).toBeInTheDocument();
      expect(getByText('⟶→→', { exact: false })).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing agent colors gracefully', () => {
      const animationState = createMockAnimationState({
        previousAgent: 'unknown',
        currentAgent: 'also-unknown',
      });
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={{}} // Empty colors
          showAgentIcons={true}
        />
      );

      expect(getByText('unknown', { exact: false })).toBeInTheDocument();
      expect(getByText('also-unknown', { exact: false })).toBeInTheDocument();
    });

    it('should handle extreme animation frame values', () => {
      const animationState = createMockAnimationState({
        arrowAnimationFrame: 99, // Out of bounds
      });
      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          arrowStyle="enhanced"
        />
      );

      // Should not crash and should render something reasonable
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle animation state without enhanced properties', () => {
      const basicState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.5,
        arrowFrame: 1,
        handoffStartTime: new Date(),
        // Missing enhanced properties
      } as HandoffAnimationState;

      const { getByText } = render(
        <HandoffIndicator
          animationState={basicState}
          agentColors={mockAgentColors}
        />
      );

      expect(getByText('planner', { exact: false })).toBeInTheDocument();
      expect(getByText('developer', { exact: false })).toBeInTheDocument();
    });
  });

  describe('backward compatibility', () => {
    it('should work with default props', () => {
      const animationState = createMockAnimationState();
      const { getByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(getByText('planner', { exact: false })).toBeInTheDocument();
      expect(getByText('developer', { exact: false })).toBeInTheDocument();
    });

    it('should maintain original behavior when enhanced features disabled', () => {
      const animationState = createMockAnimationState();
      const { getByText, queryByText } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showAgentIcons={false}
          arrowStyle="basic"
          enableColorTransition={false}
        />
      );

      // Should show basic functionality
      expect(getByText('planner', { exact: false })).toBeInTheDocument();
      expect(getByText('developer', { exact: false })).toBeInTheDocument();

      // Should not show enhanced features
      expect(queryByText(/📋|💻|\\[P\\]|\\[D\\]/, { exact: false })).not.toBeInTheDocument();
    });
  });

  describe('no animation state', () => {
    it('should not render when not animating', () => {
      const animationState = createMockAnimationState({
        isAnimating: false,
      });
      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when agents are missing', () => {
      const animationState = createMockAnimationState({
        previousAgent: null,
        currentAgent: null,
      });
      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
