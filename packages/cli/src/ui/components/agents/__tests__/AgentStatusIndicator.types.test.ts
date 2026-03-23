/**
 * Comprehensive tests for AgentStatusIndicator types, constants, and helper functions
 * Verifies TypeScript compilation, type safety, and runtime behavior
 */

import { describe, it, expect } from 'vitest';
import type { Theme } from '../../../../types/theme.js';
import {
  // Types
  type AgentStatus,
  type AgentStatusIndicatorSize,
  type AnimationState,
  type AgentStatusIndicatorProps,
  type StatusStyle,
  type SizeConfig,
  type AnimationConfig,

  // Constants
  STATUS_STYLES,
  SIZE_CONFIGS,
  ANIMATION_CONFIGS,
  ANIMATION_KEYFRAMES,
  DEFAULT_PROPS,

  // Helper Functions
  getStatusStyle,
  getSizeConfig,
  getAnimationConfig,
  shouldAnimate,
  getDefaultTooltipText,
  getAccessibilityLabel,

  // Type Guards
  isValidAgentStatus,
  isValidIndicatorSize,
  isValidAnimationState,
} from '../AgentStatusIndicator.types.js';

// Mock theme for testing
const mockTheme: Theme = {
  name: 'test',
  colors: {
    primary: '#007acc',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    muted: '#6c757d',
    border: '#dee2e6',
    background: '#ffffff',
    backgroundMuted: '#f8f9fa',
    text: '#212529',
    textMuted: '#6c757d',
    textInverted: '#ffffff',
    syntax: {
      keyword: '#d73a49',
      string: '#032f62',
      comment: '#6a737d',
      number: '#005cc5',
      function: '#6f42c1',
      variable: '#e36209',
      type: '#005cc5',
      operator: '#d73a49',
    },
    agents: {
      planner: '#007acc',
      architect: '#28a745',
      developer: '#ffc107',
      reviewer: '#dc3545',
      tester: '#17a2b8',
      devops: '#6f42c1',
    },
  },
};

describe('AgentStatusIndicator Types - TypeScript Compilation', () => {
  describe('AgentStatusIndicatorProps Interface', () => {
    it('should compile with minimal required props', () => {
      const minimalProps: AgentStatusIndicatorProps = {
        status: 'idle',
      };

      expect(minimalProps.status).toBe('idle');
      expect(minimalProps.size).toBeUndefined();
      expect(minimalProps.label).toBeUndefined();
    });

    it('should compile with all optional props', () => {
      const fullProps: AgentStatusIndicatorProps = {
        status: 'active',
        size: 'large',
        label: 'Test Agent',
        animated: true,
        color: '#007acc',
        className: 'custom-class',
        ariaLabel: 'Agent is active',
        showTooltip: true,
        tooltipText: 'Custom tooltip',
      };

      expect(fullProps.status).toBe('active');
      expect(fullProps.size).toBe('large');
      expect(fullProps.label).toBe('Test Agent');
      expect(fullProps.animated).toBe(true);
      expect(fullProps.color).toBe('#007acc');
      expect(fullProps.className).toBe('custom-class');
      expect(fullProps.ariaLabel).toBe('Agent is active');
      expect(fullProps.showTooltip).toBe(true);
      expect(fullProps.tooltipText).toBe('Custom tooltip');
    });

    it('should enforce valid AgentStatus values', () => {
      const validStatuses: AgentStatus[] = ['idle', 'active', 'error'];

      validStatuses.forEach(status => {
        const props: AgentStatusIndicatorProps = { status };
        expect(props.status).toBe(status);
      });
    });

    it('should enforce valid size values', () => {
      const validSizes: AgentStatusIndicatorSize[] = ['small', 'medium', 'large'];

      validSizes.forEach(size => {
        const props: AgentStatusIndicatorProps = {
          status: 'idle',
          size,
        };
        expect(props.size).toBe(size);
      });
    });
  });

  describe('StatusStyle Interface', () => {
    it('should compile with valid StatusStyle objects', () => {
      const statusStyle: StatusStyle = {
        color: (colors) => colors.info,
        animation: 'pulse',
        icon: '●',
        accessibility: {
          label: 'Agent is active',
          description: 'The agent is currently executing tasks',
        },
      };

      expect(statusStyle.animation).toBe('pulse');
      expect(statusStyle.icon).toBe('●');
      expect(statusStyle.accessibility.label).toBe('Agent is active');
      expect(typeof statusStyle.color).toBe('function');
    });

    it('should work with color function', () => {
      const statusStyle: StatusStyle = {
        color: (colors) => colors.error,
        animation: 'fade',
        accessibility: {
          label: 'Error',
          description: 'Error occurred',
        },
      };

      const color = statusStyle.color(mockTheme.colors);
      expect(color).toBe('#dc3545');
    });
  });

  describe('SizeConfig Interface', () => {
    it('should compile with valid SizeConfig objects', () => {
      const sizeConfig: SizeConfig = {
        width: 16,
        height: 16,
        fontSize: 12,
        borderRadius: 8,
      };

      expect(sizeConfig.width).toBe(16);
      expect(sizeConfig.height).toBe(16);
      expect(sizeConfig.fontSize).toBe(12);
      expect(sizeConfig.borderRadius).toBe(8);
    });
  });

  describe('AnimationConfig Interface', () => {
    it('should compile with numeric iteration count', () => {
      const animationConfig: AnimationConfig = {
        duration: 1000,
        easing: 'ease-in-out',
        iterationCount: 3,
      };

      expect(animationConfig.iterationCount).toBe(3);
    });

    it('should compile with infinite iteration count', () => {
      const animationConfig: AnimationConfig = {
        duration: 1500,
        easing: 'linear',
        iterationCount: 'infinite',
      };

      expect(animationConfig.iterationCount).toBe('infinite');
    });
  });
});

describe('AgentStatusIndicator Types - Constants and Mappings', () => {
  describe('STATUS_STYLES constant', () => {
    it('should contain all required status mappings', () => {
      expect(STATUS_STYLES).toHaveProperty('idle');
      expect(STATUS_STYLES).toHaveProperty('active');
      expect(STATUS_STYLES).toHaveProperty('error');
    });

    it('should have valid idle status configuration', () => {
      const idleStyle = STATUS_STYLES.idle;

      expect(typeof idleStyle.color).toBe('function');
      expect(idleStyle.animation).toBe('none');
      expect(idleStyle.icon).toBe('○');
      expect(idleStyle.accessibility.label).toBe('Agent is idle');
      expect(idleStyle.accessibility.description).toContain('not executing');

      // Test color function
      const color = idleStyle.color(mockTheme.colors);
      expect(color).toBe('#6c757d'); // muted color
    });

    it('should have valid active status configuration', () => {
      const activeStyle = STATUS_STYLES.active;

      expect(typeof activeStyle.color).toBe('function');
      expect(activeStyle.animation).toBe('pulse');
      expect(activeStyle.icon).toBe('●');
      expect(activeStyle.accessibility.label).toBe('Agent is active');
      expect(activeStyle.accessibility.description).toContain('executing');

      // Test color function
      const color = activeStyle.color(mockTheme.colors);
      expect(color).toBe('#17a2b8'); // info color
    });

    it('should have valid error status configuration', () => {
      const errorStyle = STATUS_STYLES.error;

      expect(typeof errorStyle.color).toBe('function');
      expect(errorStyle.animation).toBe('fade');
      expect(errorStyle.icon).toBe('⚠');
      expect(errorStyle.accessibility.label).toBe('Agent has encountered an error');
      expect(errorStyle.accessibility.description).toContain('error');

      // Test color function
      const color = errorStyle.color(mockTheme.colors);
      expect(color).toBe('#dc3545'); // error color
    });

    it('should be immutable (as const)', () => {
      // TypeScript should prevent modification at compile time
      // Runtime test for const assertion behavior
      const originalKeys = Object.keys(STATUS_STYLES);
      expect(originalKeys).toEqual(['idle', 'active', 'error']);

      // Test that the original object maintains its structure
      expect(STATUS_STYLES).toHaveProperty('idle');
      expect(STATUS_STYLES).toHaveProperty('active');
      expect(STATUS_STYLES).toHaveProperty('error');
    });
  });

  describe('SIZE_CONFIGS constant', () => {
    it('should contain all required size mappings', () => {
      expect(SIZE_CONFIGS).toHaveProperty('small');
      expect(SIZE_CONFIGS).toHaveProperty('medium');
      expect(SIZE_CONFIGS).toHaveProperty('large');
    });

    it('should have valid small size configuration', () => {
      const smallConfig = SIZE_CONFIGS.small;

      expect(smallConfig.width).toBe(8);
      expect(smallConfig.height).toBe(8);
      expect(smallConfig.fontSize).toBe(8);
      expect(smallConfig.borderRadius).toBe(4);
    });

    it('should have valid medium size configuration', () => {
      const mediumConfig = SIZE_CONFIGS.medium;

      expect(mediumConfig.width).toBe(12);
      expect(mediumConfig.height).toBe(12);
      expect(mediumConfig.fontSize).toBe(10);
      expect(mediumConfig.borderRadius).toBe(6);
    });

    it('should have valid large size configuration', () => {
      const largeConfig = SIZE_CONFIGS.large;

      expect(largeConfig.width).toBe(16);
      expect(largeConfig.height).toBe(16);
      expect(largeConfig.fontSize).toBe(12);
      expect(largeConfig.borderRadius).toBe(8);
    });

    it('should have progressive sizing', () => {
      const { small, medium, large } = SIZE_CONFIGS;

      expect(small.width < medium.width).toBe(true);
      expect(medium.width < large.width).toBe(true);
      expect(small.fontSize < medium.fontSize).toBe(true);
      expect(medium.fontSize < large.fontSize).toBe(true);
    });
  });

  describe('ANIMATION_CONFIGS constant', () => {
    it('should contain all required animation mappings', () => {
      expect(ANIMATION_CONFIGS).toHaveProperty('none');
      expect(ANIMATION_CONFIGS).toHaveProperty('pulse');
      expect(ANIMATION_CONFIGS).toHaveProperty('spin');
      expect(ANIMATION_CONFIGS).toHaveProperty('fade');
    });

    it('should have valid none animation configuration', () => {
      const noneConfig = ANIMATION_CONFIGS.none;

      expect(noneConfig.duration).toBe(0);
      expect(noneConfig.easing).toBe('linear');
      expect(noneConfig.iterationCount).toBe(1);
    });

    it('should have valid pulse animation configuration', () => {
      const pulseConfig = ANIMATION_CONFIGS.pulse;

      expect(pulseConfig.duration).toBe(1500);
      expect(pulseConfig.easing).toBe('ease-in-out');
      expect(pulseConfig.iterationCount).toBe('infinite');
    });

    it('should have valid spin animation configuration', () => {
      const spinConfig = ANIMATION_CONFIGS.spin;

      expect(spinConfig.duration).toBe(2000);
      expect(spinConfig.easing).toBe('linear');
      expect(spinConfig.iterationCount).toBe('infinite');
    });

    it('should have valid fade animation configuration', () => {
      const fadeConfig = ANIMATION_CONFIGS.fade;

      expect(fadeConfig.duration).toBe(1000);
      expect(fadeConfig.easing).toBe('ease-in-out');
      expect(fadeConfig.iterationCount).toBe('infinite');
    });
  });

  describe('ANIMATION_KEYFRAMES constant', () => {
    it('should contain all keyframe names', () => {
      expect(ANIMATION_KEYFRAMES).toHaveProperty('pulse');
      expect(ANIMATION_KEYFRAMES).toHaveProperty('spin');
      expect(ANIMATION_KEYFRAMES).toHaveProperty('fade');
    });

    it('should have consistent naming convention', () => {
      expect(ANIMATION_KEYFRAMES.pulse).toBe('agent-status-pulse');
      expect(ANIMATION_KEYFRAMES.spin).toBe('agent-status-spin');
      expect(ANIMATION_KEYFRAMES.fade).toBe('agent-status-fade');
    });

    it('should be immutable', () => {
      expect(typeof ANIMATION_KEYFRAMES).toBe('object');
      expect(Object.keys(ANIMATION_KEYFRAMES)).toHaveLength(3);
    });
  });

  describe('DEFAULT_PROPS constant', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PROPS.size).toBe('medium');
      expect(DEFAULT_PROPS.animated).toBe(true);
      expect(DEFAULT_PROPS.showTooltip).toBe(true);
    });

    it('should be properly typed', () => {
      // TypeScript compilation test - these should not cause errors
      const size: AgentStatusIndicatorSize = DEFAULT_PROPS.size;
      const animated: boolean = DEFAULT_PROPS.animated;
      const showTooltip: boolean = DEFAULT_PROPS.showTooltip;

      expect(size).toBe('medium');
      expect(animated).toBe(true);
      expect(showTooltip).toBe(true);
    });
  });
});

describe('AgentStatusIndicator Types - Helper Functions', () => {
  describe('getStatusStyle function', () => {
    it('should return correct style for idle status', () => {
      const style = getStatusStyle('idle');
      expect(style).toBe(STATUS_STYLES.idle);
      expect(style.animation).toBe('none');
      expect(style.icon).toBe('○');
    });

    it('should return correct style for active status', () => {
      const style = getStatusStyle('active');
      expect(style).toBe(STATUS_STYLES.active);
      expect(style.animation).toBe('pulse');
      expect(style.icon).toBe('●');
    });

    it('should return correct style for error status', () => {
      const style = getStatusStyle('error');
      expect(style).toBe(STATUS_STYLES.error);
      expect(style.animation).toBe('fade');
      expect(style.icon).toBe('⚠');
    });
  });

  describe('getSizeConfig function', () => {
    it('should return correct config for small size', () => {
      const config = getSizeConfig('small');
      expect(config).toBe(SIZE_CONFIGS.small);
      expect(config.width).toBe(8);
      expect(config.height).toBe(8);
    });

    it('should return correct config for medium size', () => {
      const config = getSizeConfig('medium');
      expect(config).toBe(SIZE_CONFIGS.medium);
      expect(config.width).toBe(12);
      expect(config.height).toBe(12);
    });

    it('should return correct config for large size', () => {
      const config = getSizeConfig('large');
      expect(config).toBe(SIZE_CONFIGS.large);
      expect(config.width).toBe(16);
      expect(config.height).toBe(16);
    });
  });

  describe('getAnimationConfig function', () => {
    it('should return correct config for none animation', () => {
      const config = getAnimationConfig('none');
      expect(config).toBe(ANIMATION_CONFIGS.none);
      expect(config.duration).toBe(0);
      expect(config.iterationCount).toBe(1);
    });

    it('should return correct config for pulse animation', () => {
      const config = getAnimationConfig('pulse');
      expect(config).toBe(ANIMATION_CONFIGS.pulse);
      expect(config.duration).toBe(1500);
      expect(config.iterationCount).toBe('infinite');
    });

    it('should return correct config for spin animation', () => {
      const config = getAnimationConfig('spin');
      expect(config).toBe(ANIMATION_CONFIGS.spin);
      expect(config.duration).toBe(2000);
      expect(config.iterationCount).toBe('infinite');
    });

    it('should return correct config for fade animation', () => {
      const config = getAnimationConfig('fade');
      expect(config).toBe(ANIMATION_CONFIGS.fade);
      expect(config.duration).toBe(1000);
      expect(config.iterationCount).toBe('infinite');
    });
  });

  describe('shouldAnimate function', () => {
    it('should return false for idle status (none animation)', () => {
      expect(shouldAnimate('idle')).toBe(false);
    });

    it('should return true for active status (pulse animation)', () => {
      expect(shouldAnimate('active')).toBe(true);
    });

    it('should return true for error status (fade animation)', () => {
      expect(shouldAnimate('error')).toBe(true);
    });
  });

  describe('getDefaultTooltipText function', () => {
    it('should return correct tooltip for idle status', () => {
      const tooltip = getDefaultTooltipText('idle');
      expect(tooltip).toBe('The agent is currently not executing any tasks');
    });

    it('should return correct tooltip for active status', () => {
      const tooltip = getDefaultTooltipText('active');
      expect(tooltip).toBe('The agent is currently executing tasks');
    });

    it('should return correct tooltip for error status', () => {
      const tooltip = getDefaultTooltipText('error');
      expect(tooltip).toBe('The agent has encountered an error during execution');
    });
  });

  describe('getAccessibilityLabel function', () => {
    it('should return default label when no custom label provided', () => {
      expect(getAccessibilityLabel('idle')).toBe('Agent is idle');
      expect(getAccessibilityLabel('active')).toBe('Agent is active');
      expect(getAccessibilityLabel('error')).toBe('Agent has encountered an error');
    });

    it('should return custom label when provided', () => {
      expect(getAccessibilityLabel('idle', 'Custom idle label')).toBe('Custom idle label');
      expect(getAccessibilityLabel('active', 'Custom active label')).toBe('Custom active label');
      expect(getAccessibilityLabel('error', 'Custom error label')).toBe('Custom error label');
    });

    it('should handle undefined custom label', () => {
      expect(getAccessibilityLabel('idle', undefined)).toBe('Agent is idle');
      expect(getAccessibilityLabel('active', undefined)).toBe('Agent is active');
      expect(getAccessibilityLabel('error', undefined)).toBe('Agent has encountered an error');
    });

    it('should handle empty string custom label', () => {
      expect(getAccessibilityLabel('idle', '')).toBe('Agent is idle');
      expect(getAccessibilityLabel('active', '')).toBe('Agent is active');
      expect(getAccessibilityLabel('error', '')).toBe('Agent has encountered an error');
    });
  });
});

describe('AgentStatusIndicator Types - Type Guards', () => {
  describe('isValidAgentStatus function', () => {
    it('should return true for valid status strings', () => {
      expect(isValidAgentStatus('idle')).toBe(true);
      expect(isValidAgentStatus('active')).toBe(true);
      expect(isValidAgentStatus('error')).toBe(true);
    });

    it('should return false for invalid status strings', () => {
      expect(isValidAgentStatus('invalid')).toBe(false);
      expect(isValidAgentStatus('running')).toBe(false);
      expect(isValidAgentStatus('stopped')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidAgentStatus(123)).toBe(false);
      expect(isValidAgentStatus(null)).toBe(false);
      expect(isValidAgentStatus(undefined)).toBe(false);
      expect(isValidAgentStatus({})).toBe(false);
      expect(isValidAgentStatus([])).toBe(false);
      expect(isValidAgentStatus(true)).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const unknownValue: unknown = 'active';

      if (isValidAgentStatus(unknownValue)) {
        // TypeScript should now know this is AgentStatus
        expect(unknownValue).toBe('active');
        // This line should compile without TypeScript errors
        const style = getStatusStyle(unknownValue);
        expect(style).toBe(STATUS_STYLES.active);
      }
    });
  });

  describe('isValidIndicatorSize function', () => {
    it('should return true for valid size strings', () => {
      expect(isValidIndicatorSize('small')).toBe(true);
      expect(isValidIndicatorSize('medium')).toBe(true);
      expect(isValidIndicatorSize('large')).toBe(true);
    });

    it('should return false for invalid size strings', () => {
      expect(isValidIndicatorSize('extra-small')).toBe(false);
      expect(isValidIndicatorSize('extra-large')).toBe(false);
      expect(isValidIndicatorSize('xl')).toBe(false);
      expect(isValidIndicatorSize('sm')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidIndicatorSize(16)).toBe(false);
      expect(isValidIndicatorSize(null)).toBe(false);
      expect(isValidIndicatorSize(undefined)).toBe(false);
      expect(isValidIndicatorSize({})).toBe(false);
      expect(isValidIndicatorSize([])).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const unknownValue: unknown = 'large';

      if (isValidIndicatorSize(unknownValue)) {
        // TypeScript should now know this is AgentStatusIndicatorSize
        expect(unknownValue).toBe('large');
        // This line should compile without TypeScript errors
        const config = getSizeConfig(unknownValue);
        expect(config).toBe(SIZE_CONFIGS.large);
      }
    });
  });

  describe('isValidAnimationState function', () => {
    it('should return true for valid animation strings', () => {
      expect(isValidAnimationState('none')).toBe(true);
      expect(isValidAnimationState('pulse')).toBe(true);
      expect(isValidAnimationState('spin')).toBe(true);
      expect(isValidAnimationState('fade')).toBe(true);
    });

    it('should return false for invalid animation strings', () => {
      expect(isValidAnimationState('bounce')).toBe(false);
      expect(isValidAnimationState('shake')).toBe(false);
      expect(isValidAnimationState('slide')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidAnimationState(1500)).toBe(false);
      expect(isValidAnimationState(null)).toBe(false);
      expect(isValidAnimationState(undefined)).toBe(false);
      expect(isValidAnimationState({})).toBe(false);
      expect(isValidAnimationState([])).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const unknownValue: unknown = 'pulse';

      if (isValidAnimationState(unknownValue)) {
        // TypeScript should now know this is AnimationState
        expect(unknownValue).toBe('pulse');
        // This line should compile without TypeScript errors
        const config = getAnimationConfig(unknownValue);
        expect(config).toBe(ANIMATION_CONFIGS.pulse);
      }
    });
  });
});

describe('AgentStatusIndicator Types - Edge Cases and Error Handling', () => {
  describe('Color function edge cases', () => {
    it('should handle partial theme colors gracefully', () => {
      const partialTheme = {
        muted: '#999',
        info: '#17a2b8',
        error: '#dc3545',
      } as Theme['colors'];

      expect(() => STATUS_STYLES.idle.color(partialTheme)).not.toThrow();
      expect(() => STATUS_STYLES.active.color(partialTheme)).not.toThrow();
      expect(() => STATUS_STYLES.error.color(partialTheme)).not.toThrow();
    });

    it('should return expected colors with complete theme', () => {
      const colors = mockTheme.colors;

      expect(STATUS_STYLES.idle.color(colors)).toBe('#6c757d');
      expect(STATUS_STYLES.active.color(colors)).toBe('#17a2b8');
      expect(STATUS_STYLES.error.color(colors)).toBe('#dc3545');
    });
  });

  describe('Integration with React component props', () => {
    it('should work with React component prop spreading', () => {
      const baseProps: AgentStatusIndicatorProps = {
        status: 'active',
        size: 'medium',
      };

      const extendedProps: AgentStatusIndicatorProps = {
        ...baseProps,
        animated: false,
        label: 'Test Agent',
      };

      expect(extendedProps.status).toBe('active');
      expect(extendedProps.size).toBe('medium');
      expect(extendedProps.animated).toBe(false);
      expect(extendedProps.label).toBe('Test Agent');
    });

    it('should support partial prop updates', () => {
      const originalProps: AgentStatusIndicatorProps = {
        status: 'idle',
        size: 'small',
        animated: true,
      };

      const updatedProps: AgentStatusIndicatorProps = {
        ...originalProps,
        status: 'active',
        size: 'large',
      };

      expect(updatedProps.status).toBe('active');
      expect(updatedProps.size).toBe('large');
      expect(updatedProps.animated).toBe(true); // Should be preserved
    });
  });

  describe('Accessibility compliance', () => {
    it('should provide meaningful accessibility labels', () => {
      const statuses: AgentStatus[] = ['idle', 'active', 'error'];
      statuses.forEach(status => {
        const style = STATUS_STYLES[status];
        expect(style.accessibility.label).toBeTruthy();
        expect(style.accessibility.description).toBeTruthy();
        expect(style.accessibility.label.length).toBeGreaterThan(0);
        expect(style.accessibility.description.length).toBeGreaterThan(0);
      });
    });

    it('should have distinct labels for different statuses', () => {
      const statuses: AgentStatus[] = ['idle', 'active', 'error'];
      const labels = statuses.map(status => STATUS_STYLES[status].accessibility.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it('should have distinct descriptions for different statuses', () => {
      const statuses: AgentStatus[] = ['idle', 'active', 'error'];
      const descriptions = statuses.map(status => STATUS_STYLES[status].accessibility.description);
      const uniqueDescriptions = new Set(descriptions);
      expect(uniqueDescriptions.size).toBe(descriptions.length);
    });
  });

  describe('Animation consistency', () => {
    it('should have consistent animation states across status mappings', () => {
      const statuses: AgentStatus[] = ['idle', 'active', 'error'];
      statuses.forEach(status => {
        const style = STATUS_STYLES[status];
        expect(isValidAnimationState(style.animation)).toBe(true);
      });
    });

    it('should map to existing animation configurations', () => {
      const statuses: AgentStatus[] = ['idle', 'active', 'error'];
      statuses.forEach(status => {
        const style = STATUS_STYLES[status];
        expect(ANIMATION_CONFIGS).toHaveProperty(style.animation);
      });
    });
  });

  describe('Size configuration consistency', () => {
    it('should have reasonable size relationships', () => {
      const sizes = Object.keys(SIZE_CONFIGS) as AgentStatusIndicatorSize[];

      for (let i = 0; i < sizes.length - 1; i++) {
        const currentSize = getSizeConfig(sizes[i]);
        const nextSize = getSizeConfig(sizes[i + 1]);

        // Each size should be smaller than the next
        expect(currentSize.width).toBeLessThanOrEqual(nextSize.width);
        expect(currentSize.height).toBeLessThanOrEqual(nextSize.height);
        expect(currentSize.fontSize).toBeLessThanOrEqual(nextSize.fontSize);
      }
    });

    it('should have consistent aspect ratios', () => {
      Object.keys(SIZE_CONFIGS).forEach(size => {
        const config = SIZE_CONFIGS[size as AgentStatusIndicatorSize];
        // Width and height should be equal (square indicators)
        expect(config.width).toBe(config.height);
        // Border radius should be half the width for circular indicators
        expect(config.borderRadius).toBe(config.width / 2);
      });
    });
  });
});