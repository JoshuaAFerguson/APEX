/**
 * Integration tests for AgentStatusIndicator types system
 * Tests the complete type system working together and validates acceptance criteria
 */

import { describe, it, expect } from 'vitest';
import type { Theme } from '../../../../types/theme.js';
import {
  // Import all types and utilities for integration testing
  type AgentStatus,
  type AgentStatusIndicatorSize,
  type AnimationState,
  type AgentStatusIndicatorProps,
  type StatusStyle,
  type SizeConfig,
  type AnimationConfig,
  STATUS_STYLES,
  SIZE_CONFIGS,
  ANIMATION_CONFIGS,
  ANIMATION_KEYFRAMES,
  DEFAULT_PROPS,
  getStatusStyle,
  getSizeConfig,
  getAnimationConfig,
  shouldAnimate,
  getDefaultTooltipText,
  getAccessibilityLabel,
  isValidAgentStatus,
  isValidIndicatorSize,
  isValidAnimationState,
} from '../AgentStatusIndicator.types.js';

// Complete mock theme for integration tests
const mockTheme: Theme = {
  name: 'integration-test',
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

describe('AgentStatusIndicator Integration Tests - Acceptance Criteria Validation', () => {
  describe('Types file exists with AgentStatusIndicatorProps', () => {
    it('should export AgentStatusIndicatorProps interface', () => {
      // This test verifies that the interface exists and can be used
      const props: AgentStatusIndicatorProps = {
        status: 'active',
        size: 'medium',
        label: 'Test Agent',
        animated: true,
        color: '#007acc',
        className: 'test-class',
        ariaLabel: 'Test label',
        showTooltip: true,
        tooltipText: 'Test tooltip',
      };

      expect(props).toBeDefined();
      expect(props.status).toBe('active');
      expect(props.size).toBe('medium');
    });

    it('should support all required props configurations', () => {
      const configurations: AgentStatusIndicatorProps[] = [
        { status: 'idle' },
        { status: 'active', size: 'large' },
        { status: 'error', size: 'small', animated: false },
        { status: 'idle', label: 'Waiting', showTooltip: false },
        { status: 'active', color: 'custom', className: 'custom' },
      ];

      configurations.forEach((config, index) => {
        expect(config).toBeDefined();
        expect(config.status).toBeTruthy();
        expect(['idle', 'active', 'error']).toContain(config.status);
      });
    });
  });

  describe('Status-to-style mappings', () => {
    it('should provide complete mappings for idle/active/error states', () => {
      const requiredStates: AgentStatus[] = ['idle', 'active', 'error'];

      requiredStates.forEach(state => {
        expect(STATUS_STYLES).toHaveProperty(state);

        const style = STATUS_STYLES[state];
        expect(style).toBeDefined();
        expect(typeof style.color).toBe('function');
        expect(style.animation).toBeDefined();
        expect(style.accessibility).toBeDefined();
        expect(style.accessibility.label).toBeTruthy();
        expect(style.accessibility.description).toBeTruthy();
      });
    });

    it('should work with theme integration', () => {
      const requiredStates: AgentStatus[] = ['idle', 'active', 'error'];

      requiredStates.forEach(state => {
        const style = getStatusStyle(state);
        const color = style.color(mockTheme.colors);

        expect(typeof color).toBe('string');
        expect(color.length).toBeGreaterThan(0);
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/); // Valid hex color
      });
    });

    it('should provide proper typing for all states', () => {
      // TypeScript compilation test - should not cause type errors
      const idleStyle: StatusStyle = STATUS_STYLES.idle;
      const activeStyle: StatusStyle = STATUS_STYLES.active;
      const errorStyle: StatusStyle = STATUS_STYLES.error;

      expect(idleStyle.animation).toBe('none');
      expect(activeStyle.animation).toBe('pulse');
      expect(errorStyle.animation).toBe('fade');
    });
  });

  describe('Animation constants', () => {
    it('should provide all animation configurations', () => {
      const requiredAnimations: AnimationState[] = ['none', 'pulse', 'spin', 'fade'];

      requiredAnimations.forEach(animation => {
        expect(ANIMATION_CONFIGS).toHaveProperty(animation);

        const config = ANIMATION_CONFIGS[animation];
        expect(config).toBeDefined();
        expect(typeof config.duration).toBe('number');
        expect(typeof config.easing).toBe('string');
        expect(config.iterationCount).toBeDefined();
      });
    });

    it('should provide keyframe names for CSS animations', () => {
      expect(ANIMATION_KEYFRAMES.pulse).toBe('agent-status-pulse');
      expect(ANIMATION_KEYFRAMES.spin).toBe('agent-status-spin');
      expect(ANIMATION_KEYFRAMES.fade).toBe('agent-status-fade');
    });

    it('should have consistent animation mappings', () => {
      // Status to animation mappings should be consistent
      expect(STATUS_STYLES.idle.animation).toBe('none');
      expect(STATUS_STYLES.active.animation).toBe('pulse');
      expect(STATUS_STYLES.error.animation).toBe('fade');

      // All status animations should have configurations
      Object.values(STATUS_STYLES).forEach(style => {
        expect(ANIMATION_CONFIGS).toHaveProperty(style.animation);
      });
    });
  });

  describe('Exports are properly typed', () => {
    it('should export all required types', () => {
      // This test verifies TypeScript compilation and proper exports
      const status: AgentStatus = 'active';
      const size: AgentStatusIndicatorSize = 'medium';
      const animation: AnimationState = 'pulse';

      expect(['idle', 'active', 'error']).toContain(status);
      expect(['small', 'medium', 'large']).toContain(size);
      expect(['none', 'pulse', 'spin', 'fade']).toContain(animation);
    });

    it('should export all required constants', () => {
      expect(STATUS_STYLES).toBeDefined();
      expect(SIZE_CONFIGS).toBeDefined();
      expect(ANIMATION_CONFIGS).toBeDefined();
      expect(ANIMATION_KEYFRAMES).toBeDefined();
      expect(DEFAULT_PROPS).toBeDefined();
    });

    it('should export all helper functions', () => {
      expect(typeof getStatusStyle).toBe('function');
      expect(typeof getSizeConfig).toBe('function');
      expect(typeof getAnimationConfig).toBe('function');
      expect(typeof shouldAnimate).toBe('function');
      expect(typeof getDefaultTooltipText).toBe('function');
      expect(typeof getAccessibilityLabel).toBe('function');
    });

    it('should export all type guards', () => {
      expect(typeof isValidAgentStatus).toBe('function');
      expect(typeof isValidIndicatorSize).toBe('function');
      expect(typeof isValidAnimationState).toBe('function');
    });
  });
});

describe('Complete Workflow Integration Tests', () => {
  describe('Full component configuration workflow', () => {
    it('should support complete component setup for idle state', () => {
      const status: AgentStatus = 'idle';
      const size: AgentStatusIndicatorSize = 'medium';

      // Get all required configurations
      const statusStyle = getStatusStyle(status);
      const sizeConfig = getSizeConfig(size);
      const animationConfig = getAnimationConfig(statusStyle.animation);
      const shouldBeAnimated = shouldAnimate(status);
      const tooltipText = getDefaultTooltipText(status);
      const ariaLabel = getAccessibilityLabel(status);

      // Verify complete configuration
      expect(statusStyle.animation).toBe('none');
      expect(statusStyle.icon).toBe('○');
      expect(statusStyle.color(mockTheme.colors)).toBe('#6c757d');

      expect(sizeConfig.width).toBe(12);
      expect(sizeConfig.height).toBe(12);

      expect(animationConfig.duration).toBe(0);
      expect(animationConfig.iterationCount).toBe(1);

      expect(shouldBeAnimated).toBe(false);
      expect(tooltipText).toContain('not executing');
      expect(ariaLabel).toContain('idle');
    });

    it('should support complete component setup for active state', () => {
      const status: AgentStatus = 'active';
      const size: AgentStatusIndicatorSize = 'large';

      // Get all required configurations
      const statusStyle = getStatusStyle(status);
      const sizeConfig = getSizeConfig(size);
      const animationConfig = getAnimationConfig(statusStyle.animation);
      const shouldBeAnimated = shouldAnimate(status);
      const tooltipText = getDefaultTooltipText(status);
      const ariaLabel = getAccessibilityLabel(status);

      // Verify complete configuration
      expect(statusStyle.animation).toBe('pulse');
      expect(statusStyle.icon).toBe('●');
      expect(statusStyle.color(mockTheme.colors)).toBe('#17a2b8');

      expect(sizeConfig.width).toBe(16);
      expect(sizeConfig.height).toBe(16);

      expect(animationConfig.duration).toBe(1500);
      expect(animationConfig.iterationCount).toBe('infinite');

      expect(shouldBeAnimated).toBe(true);
      expect(tooltipText).toContain('executing');
      expect(ariaLabel).toContain('active');
    });

    it('should support complete component setup for error state', () => {
      const status: AgentStatus = 'error';
      const size: AgentStatusIndicatorSize = 'small';

      // Get all required configurations
      const statusStyle = getStatusStyle(status);
      const sizeConfig = getSizeConfig(size);
      const animationConfig = getAnimationConfig(statusStyle.animation);
      const shouldBeAnimated = shouldAnimate(status);
      const tooltipText = getDefaultTooltipText(status);
      const ariaLabel = getAccessibilityLabel(status, 'Custom error message');

      // Verify complete configuration
      expect(statusStyle.animation).toBe('fade');
      expect(statusStyle.icon).toBe('⚠');
      expect(statusStyle.color(mockTheme.colors)).toBe('#dc3545');

      expect(sizeConfig.width).toBe(8);
      expect(sizeConfig.height).toBe(8);

      expect(animationConfig.duration).toBe(1000);
      expect(animationConfig.iterationCount).toBe('infinite');

      expect(shouldBeAnimated).toBe(true);
      expect(tooltipText).toContain('error');
      expect(ariaLabel).toBe('Custom error message');
    });
  });

  describe('Dynamic state changes workflow', () => {
    it('should handle state transitions properly', () => {
      const states: AgentStatus[] = ['idle', 'active', 'error'];
      const results: Array<{
        status: AgentStatus;
        animation: AnimationState;
        shouldAnimate: boolean;
        color: string;
      }> = [];

      states.forEach(status => {
        const style = getStatusStyle(status);
        const shouldBeAnimated = shouldAnimate(status);
        const color = style.color(mockTheme.colors);

        results.push({
          status,
          animation: style.animation,
          shouldAnimate: shouldBeAnimated,
          color,
        });
      });

      // Verify each state has distinct characteristics
      expect(results[0].animation).toBe('none'); // idle
      expect(results[1].animation).toBe('pulse'); // active
      expect(results[2].animation).toBe('fade'); // error

      expect(results[0].shouldAnimate).toBe(false); // idle
      expect(results[1].shouldAnimate).toBe(true); // active
      expect(results[2].shouldAnimate).toBe(true); // error

      // All colors should be different
      const colors = results.map(r => r.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(3);
    });

    it('should support all size variations', () => {
      const sizes: AgentStatusIndicatorSize[] = ['small', 'medium', 'large'];
      const configs = sizes.map(size => ({
        size,
        config: getSizeConfig(size),
      }));

      // Verify progressive sizing
      expect(configs[0].config.width < configs[1].config.width).toBe(true);
      expect(configs[1].config.width < configs[2].config.width).toBe(true);

      // Verify all configurations are valid
      configs.forEach(({ size, config }) => {
        expect(config.width).toBeGreaterThan(0);
        expect(config.height).toBeGreaterThan(0);
        expect(config.fontSize).toBeGreaterThan(0);
        expect(config.borderRadius).toBeGreaterThan(0);
      });
    });
  });

  describe('Type safety and validation workflow', () => {
    it('should validate and handle unknown inputs safely', () => {
      const unknownInputs = [
        'unknown-status',
        'invalid-size',
        'bad-animation',
        123,
        null,
        undefined,
        {},
        []
      ];

      unknownInputs.forEach(input => {
        expect(isValidAgentStatus(input)).toBe(false);
        expect(isValidIndicatorSize(input)).toBe(false);
        expect(isValidAnimationState(input)).toBe(false);
      });
    });

    it('should provide proper type narrowing for valid inputs', () => {
      const validStatus = 'active';
      const validSize = 'medium';
      const validAnimation = 'pulse';

      if (isValidAgentStatus(validStatus)) {
        // Should compile without TypeScript errors
        const style = getStatusStyle(validStatus);
        expect(style).toBeDefined();
      }

      if (isValidIndicatorSize(validSize)) {
        // Should compile without TypeScript errors
        const config = getSizeConfig(validSize);
        expect(config).toBeDefined();
      }

      if (isValidAnimationState(validAnimation)) {
        // Should compile without TypeScript errors
        const config = getAnimationConfig(validAnimation);
        expect(config).toBeDefined();
      }
    });

    it('should work with default props merging', () => {
      const userProps: Partial<AgentStatusIndicatorProps> = {
        status: 'active',
        label: 'My Agent',
      };

      const finalProps: AgentStatusIndicatorProps = {
        ...DEFAULT_PROPS,
        ...userProps,
      };

      expect(finalProps.status).toBe('active');
      expect(finalProps.label).toBe('My Agent');
      expect(finalProps.size).toBe('medium'); // from DEFAULT_PROPS
      expect(finalProps.animated).toBe(true); // from DEFAULT_PROPS
      expect(finalProps.showTooltip).toBe(true); // from DEFAULT_PROPS
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should support agent panel display scenario', () => {
      const agents = [
        { name: 'planner', status: 'active' as AgentStatus },
        { name: 'architect', status: 'idle' as AgentStatus },
        { name: 'developer', status: 'error' as AgentStatus },
      ];

      const agentConfigs = agents.map(agent => {
        const style = getStatusStyle(agent.status);
        const size = getSizeConfig('medium');
        const shouldAnimateValue = shouldAnimate(agent.status);
        const tooltip = getDefaultTooltipText(agent.status);

        return {
          ...agent,
          color: style.color(mockTheme.colors),
          icon: style.icon,
          animated: shouldAnimateValue,
          tooltip,
          dimensions: size,
        };
      });

      expect(agentConfigs).toHaveLength(3);
      expect(agentConfigs[0].animated).toBe(true); // active
      expect(agentConfigs[1].animated).toBe(false); // idle
      expect(agentConfigs[2].animated).toBe(true); // error

      expect(agentConfigs[0].icon).toBe('●'); // active
      expect(agentConfigs[1].icon).toBe('○'); // idle
      expect(agentConfigs[2].icon).toBe('⚠'); // error
    });

    it('should support accessibility requirements scenario', () => {
      const accessibilityInfo = Object.keys(STATUS_STYLES).map(status => {
        const statusType = status as AgentStatus;
        const style = getStatusStyle(statusType);

        return {
          status: statusType,
          label: getAccessibilityLabel(statusType),
          customLabel: getAccessibilityLabel(statusType, `Custom ${status} label`),
          tooltip: getDefaultTooltipText(statusType),
          description: style.accessibility.description,
        };
      });

      accessibilityInfo.forEach(info => {
        expect(info.label).toBeTruthy();
        expect(info.customLabel).toContain('Custom');
        expect(info.tooltip).toBeTruthy();
        expect(info.description).toBeTruthy();

        // Labels should be different for different states
        expect(info.label).not.toBe(info.customLabel);
      });
    });

    it('should support theme customization scenario', () => {
      const customTheme: Theme = {
        ...mockTheme,
        colors: {
          ...mockTheme.colors,
          muted: '#custom-muted',
          info: '#custom-info',
          error: '#custom-error',
        },
      };

      const customColors = Object.keys(STATUS_STYLES).map(status => {
        const statusType = status as AgentStatus;
        const style = getStatusStyle(statusType);

        return {
          status: statusType,
          originalColor: style.color(mockTheme.colors),
          customColor: style.color(customTheme.colors),
        };
      });

      // Custom colors should be different from original
      customColors.forEach(({ originalColor, customColor }) => {
        expect(originalColor).not.toBe(customColor);
        expect(customColor).toMatch(/^#custom-/);
      });
    });
  });
});