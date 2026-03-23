/**
 * Comprehensive tests for AgentTerminalPanel types and interfaces
 *
 * Tests the newly added keyboard accessibility props:
 * - allowKeyboardInput (boolean)
 * - onMinimize, onMaximize, onRestore callbacks
 * - panelState prop for controlled mode
 * - PanelState enum integration
 *
 * Also tests type safety, validation, and compatibility with existing interfaces.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  AgentTerminalPanelProps,
  AgentExecution,
  AgentExecutionStatus,
  TerminalPanelDisplayMode,
  TerminalPanelBorderStyle,
  ProcessedExecutionData,
  ResponsiveTerminalPanelConfig,
  ExecutionVisualState
} from '../AgentTerminalPanel.types.js';
import {
  PanelState,
  mapExecutionStatusToAgentStatus,
  EXECUTION_STATUS_TO_AGENT_STATUS,
  getExecutionVisualState,
  EXECUTION_VISUAL_STATES,
  getResponsiveTerminalPanelConfig,
  RESPONSIVE_TERMINAL_PANEL_CONFIGS,
  processExecutionData,
  DEFAULT_TERMINAL_PANEL_PROPS,
  isValidDisplayMode,
  isValidBorderStyle,
  isValidPanelState
} from '../AgentTerminalPanel.types.js';

describe('AgentTerminalPanelProps - Keyboard Accessibility', () => {
  // Mock agent execution for testing
  const createMockExecution = (overrides?: Partial<AgentExecution>): AgentExecution => ({
    id: 'test-execution-id',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'running' as AgentExecutionStatus,
    stage: 'testing',
    progress: 50,
    startedAt: new Date('2024-01-01T00:00:00Z'),
    tokensUsed: 100,
    taskDescription: 'Test task',
    ...overrides
  });

  describe('allowKeyboardInput prop', () => {
    it('should accept boolean values for allowKeyboardInput', () => {
      const propsWithKeyboard: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        allowKeyboardInput: true
      };

      const propsWithoutKeyboard: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        allowKeyboardInput: false
      };

      // Type assertions to ensure compilation
      expect(propsWithKeyboard.allowKeyboardInput).toBe(true);
      expect(propsWithoutKeyboard.allowKeyboardInput).toBe(false);
      expect(typeof propsWithKeyboard.allowKeyboardInput).toBe('boolean');
      expect(typeof propsWithoutKeyboard.allowKeyboardInput).toBe('boolean');
    });

    it('should be optional and default to true according to DEFAULT_TERMINAL_PANEL_PROPS', () => {
      const propsWithoutExplicitKeyboard: AgentTerminalPanelProps = {
        execution: createMockExecution()
      };

      // Should not require allowKeyboardInput
      expect(propsWithoutExplicitKeyboard.execution).toBeDefined();
      expect(DEFAULT_TERMINAL_PANEL_PROPS.allowKeyboardInput).toBe(true);
    });
  });

  describe('callback props (onMinimize, onMaximize, onRestore)', () => {
    let mockOnMinimize: ReturnType<typeof vi.fn>;
    let mockOnMaximize: ReturnType<typeof vi.fn>;
    let mockOnRestore: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockOnMinimize = vi.fn();
      mockOnMaximize = vi.fn();
      mockOnRestore = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should accept callback functions with proper signatures', () => {
      const execution = createMockExecution();
      const props: AgentTerminalPanelProps = {
        execution,
        allowKeyboardInput: true,
        onMinimize: mockOnMinimize,
        onMaximize: mockOnMaximize,
        onRestore: mockOnRestore
      };

      expect(props.onMinimize).toBe(mockOnMinimize);
      expect(props.onMaximize).toBe(mockOnMaximize);
      expect(props.onRestore).toBe(mockOnRestore);
      expect(typeof props.onMinimize).toBe('function');
      expect(typeof props.onMaximize).toBe('function');
      expect(typeof props.onRestore).toBe('function');
    });

    it('should allow callbacks to be undefined (optional)', () => {
      const props: AgentTerminalPanelProps = {
        execution: createMockExecution()
      };

      expect(props.onMinimize).toBeUndefined();
      expect(props.onMaximize).toBeUndefined();
      expect(props.onRestore).toBeUndefined();
    });

    it('should call callbacks with the correct AgentExecution parameter', () => {
      const execution = createMockExecution({
        id: 'specific-id',
        agentName: 'Specific Agent'
      });

      const props: AgentTerminalPanelProps = {
        execution,
        onMinimize: mockOnMinimize,
        onMaximize: mockOnMaximize,
        onRestore: mockOnRestore
      };

      // Simulate calling the callbacks (as the component would)
      props.onMinimize?.(execution);
      props.onMaximize?.(execution);
      props.onRestore?.(execution);

      expect(mockOnMinimize).toHaveBeenCalledWith(execution);
      expect(mockOnMaximize).toHaveBeenCalledWith(execution);
      expect(mockOnRestore).toHaveBeenCalledWith(execution);
      expect(mockOnMinimize).toHaveBeenCalledTimes(1);
      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
      expect(mockOnRestore).toHaveBeenCalledTimes(1);
    });

    it('should handle callback with different execution instances', () => {
      const execution1 = createMockExecution({ id: 'exec-1', agentName: 'Agent 1' });
      const execution2 = createMockExecution({ id: 'exec-2', agentName: 'Agent 2' });

      const onMinimize = vi.fn();
      const props: AgentTerminalPanelProps = {
        execution: execution1,
        onMinimize
      };

      // Test with original execution
      props.onMinimize?.(execution1);
      expect(onMinimize).toHaveBeenCalledWith(execution1);

      // Test with different execution (simulating panel switch)
      props.onMinimize?.(execution2);
      expect(onMinimize).toHaveBeenCalledWith(execution2);
      expect(onMinimize).toHaveBeenCalledTimes(2);
    });
  });

  describe('panelState prop for controlled mode', () => {
    it('should accept PanelState enum values', () => {
      const propsNormal: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        panelState: PanelState.Normal
      };

      const propsMinimized: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        panelState: PanelState.Minimized
      };

      const propsMaximized: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        panelState: PanelState.Maximized
      };

      expect(propsNormal.panelState).toBe(PanelState.Normal);
      expect(propsMinimized.panelState).toBe(PanelState.Minimized);
      expect(propsMaximized.panelState).toBe(PanelState.Maximized);
      expect(propsNormal.panelState).toBe('normal');
      expect(propsMinimized.panelState).toBe('minimized');
      expect(propsMaximized.panelState).toBe('maximized');
    });

    it('should be optional for uncontrolled mode', () => {
      const props: AgentTerminalPanelProps = {
        execution: createMockExecution()
      };

      expect(props.panelState).toBeUndefined();
      // Should still be a valid props object
      expect(props.execution).toBeDefined();
    });

    it('should work with controlled mode pattern', () => {
      const mockStateChange = vi.fn();
      const props: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        panelState: PanelState.Normal,
        onMinimize: (execution) => mockStateChange(execution.id, PanelState.Minimized),
        onMaximize: (execution) => mockStateChange(execution.id, PanelState.Maximized),
        onRestore: (execution) => mockStateChange(execution.id, PanelState.Normal)
      };

      // Simulate controlled state changes
      const execution = props.execution;
      props.onMinimize?.(execution);
      props.onMaximize?.(execution);
      props.onRestore?.(execution);

      expect(mockStateChange).toHaveBeenNthCalledWith(1, execution.id, PanelState.Minimized);
      expect(mockStateChange).toHaveBeenNthCalledWith(2, execution.id, PanelState.Maximized);
      expect(mockStateChange).toHaveBeenNthCalledWith(3, execution.id, PanelState.Normal);
    });
  });

  describe('full keyboard accessibility integration', () => {
    it('should support complete keyboard accessibility props together', () => {
      const execution = createMockExecution();
      const mockOnMinimize = vi.fn();
      const mockOnMaximize = vi.fn();
      const mockOnRestore = vi.fn();

      const fullKeyboardProps: AgentTerminalPanelProps = {
        execution,
        allowKeyboardInput: true,
        onMinimize: mockOnMinimize,
        onMaximize: mockOnMaximize,
        onRestore: mockOnRestore,
        panelState: PanelState.Normal
      };

      // Verify all props are properly typed and accessible
      expect(fullKeyboardProps.allowKeyboardInput).toBe(true);
      expect(fullKeyboardProps.onMinimize).toBe(mockOnMinimize);
      expect(fullKeyboardProps.onMaximize).toBe(mockOnMaximize);
      expect(fullKeyboardProps.onRestore).toBe(mockOnRestore);
      expect(fullKeyboardProps.panelState).toBe(PanelState.Normal);

      // Test that all callbacks work
      fullKeyboardProps.onMinimize?.(execution);
      fullKeyboardProps.onMaximize?.(execution);
      fullKeyboardProps.onRestore?.(execution);

      expect(mockOnMinimize).toHaveBeenCalledWith(execution);
      expect(mockOnMaximize).toHaveBeenCalledWith(execution);
      expect(mockOnRestore).toHaveBeenCalledWith(execution);
    });

    it('should work alongside existing props without conflicts', () => {
      const props: AgentTerminalPanelProps = {
        execution: createMockExecution(),

        // Existing props
        displayMode: 'compact',
        focused: true,
        animated: false,
        width: 80,
        borderStyle: 'round',
        borderColor: 'blue',
        showElapsedTime: true,
        showProgress: false,
        onSelect: vi.fn(),
        testId: 'test-panel',

        // New keyboard accessibility props
        allowKeyboardInput: true,
        onMinimize: vi.fn(),
        onMaximize: vi.fn(),
        onRestore: vi.fn(),
        panelState: PanelState.Maximized
      };

      // Verify all props coexist properly
      expect(props.displayMode).toBe('compact');
      expect(props.focused).toBe(true);
      expect(props.allowKeyboardInput).toBe(true);
      expect(props.panelState).toBe(PanelState.Maximized);
      expect(props.onMinimize).toBeDefined();
      expect(props.onMaximize).toBeDefined();
      expect(props.onRestore).toBeDefined();
    });

    it('should maintain type safety with partial props', () => {
      // Test various combinations to ensure type safety
      const minimalProps: AgentTerminalPanelProps = {
        execution: createMockExecution()
      };

      const keyboardOnlyProps: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        allowKeyboardInput: false
      };

      const callbacksOnlyProps: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        onMinimize: vi.fn()
      };

      const stateOnlyProps: AgentTerminalPanelProps = {
        execution: createMockExecution(),
        panelState: PanelState.Minimized
      };

      // All should be valid
      expect(minimalProps.execution).toBeDefined();
      expect(keyboardOnlyProps.allowKeyboardInput).toBe(false);
      expect(callbacksOnlyProps.onMinimize).toBeDefined();
      expect(stateOnlyProps.panelState).toBe(PanelState.Minimized);
    });
  });
});

describe('AgentExecution Interface', () => {
  it('should support all required properties', () => {
    const execution: AgentExecution = {
      id: 'test-id',
      agentId: 'agent-123',
      agentName: 'Test Agent',
      status: 'running',
      progress: 75
    };

    expect(execution.id).toBe('test-id');
    expect(execution.agentId).toBe('agent-123');
    expect(execution.agentName).toBe('Test Agent');
    expect(execution.status).toBe('running');
    expect(execution.progress).toBe(75);
  });

  it('should support all optional properties', () => {
    const fullExecution: AgentExecution = {
      id: 'test-id',
      agentId: 'agent-123',
      agentName: 'Test Agent',
      status: 'completed',
      progress: 100,
      stage: 'implementation',
      startedAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: new Date('2024-01-01T01:00:00Z'),
      durationMs: 3600000,
      error: null,
      tokensUsed: 500,
      taskDescription: 'Complete the implementation',
      metadata: {
        customField: 'value',
        priority: 'high',
        tags: ['urgent', 'feature']
      }
    };

    expect(fullExecution.stage).toBe('implementation');
    expect(fullExecution.startedAt).toBeInstanceOf(Date);
    expect(fullExecution.completedAt).toBeInstanceOf(Date);
    expect(fullExecution.durationMs).toBe(3600000);
    expect(fullExecution.error).toBeNull();
    expect(fullExecution.tokensUsed).toBe(500);
    expect(fullExecution.taskDescription).toBe('Complete the implementation');
    expect(fullExecution.metadata).toEqual({
      customField: 'value',
      priority: 'high',
      tags: ['urgent', 'feature']
    });
  });

  it('should support all AgentExecutionStatus values', () => {
    const statuses: AgentExecutionStatus[] = [
      'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
    ];

    statuses.forEach(status => {
      const execution: AgentExecution = {
        id: 'test',
        agentId: 'test',
        agentName: 'Test',
        status,
        progress: 0
      };
      expect(execution.status).toBe(status);
    });
  });

  it('should work with error string and null', () => {
    const executionWithError: AgentExecution = {
      id: 'test',
      agentId: 'test',
      agentName: 'Test',
      status: 'failed',
      progress: 0,
      error: 'Something went wrong'
    };

    const executionWithNullError: AgentExecution = {
      id: 'test',
      agentId: 'test',
      agentName: 'Test',
      status: 'completed',
      progress: 100,
      error: null
    };

    expect(executionWithError.error).toBe('Something went wrong');
    expect(executionWithNullError.error).toBeNull();
  });
});

describe('PanelState Integration', () => {
  it('should export PanelState enum correctly', () => {
    expect(PanelState.Normal).toBe('normal');
    expect(PanelState.Minimized).toBe('minimized');
    expect(PanelState.Maximized).toBe('maximized');

    // Test enum values
    expect(Object.values(PanelState)).toEqual(['normal', 'minimized', 'maximized']);
    expect(Object.keys(PanelState)).toEqual(['Normal', 'Minimized', 'Maximized']);
  });

  it('should validate PanelState with type guard', () => {
    expect(isValidPanelState('normal')).toBe(true);
    expect(isValidPanelState('minimized')).toBe(true);
    expect(isValidPanelState('maximized')).toBe(true);
    expect(isValidPanelState('invalid')).toBe(false);
    expect(isValidPanelState(123)).toBe(false);
    expect(isValidPanelState(null)).toBe(false);
    expect(isValidPanelState(undefined)).toBe(false);
  });

  it('should work in controlled mode scenarios', () => {
    // Simulate how the component would be used in controlled mode
    let currentState = PanelState.Normal;
    const handleStateChange = (panelId: string, newState: PanelState) => {
      currentState = newState;
    };

    const props: AgentTerminalPanelProps = {
      execution: {
        id: 'test',
        agentId: 'test',
        agentName: 'Test',
        status: 'running',
        progress: 50
      },
      panelState: currentState,
      onMinimize: (execution) => handleStateChange(execution.id, PanelState.Minimized),
      onMaximize: (execution) => handleStateChange(execution.id, PanelState.Maximized),
      onRestore: (execution) => handleStateChange(execution.id, PanelState.Normal)
    };

    // Test state transitions
    expect(currentState).toBe(PanelState.Normal);

    props.onMinimize?.(props.execution);
    expect(currentState).toBe(PanelState.Minimized);

    props.onMaximize?.(props.execution);
    expect(currentState).toBe(PanelState.Maximized);

    props.onRestore?.(props.execution);
    expect(currentState).toBe(PanelState.Normal);
  });
});

describe('Type Guards and Utility Functions', () => {
  describe('isValidDisplayMode', () => {
    it('should validate TerminalPanelDisplayMode values', () => {
      expect(isValidDisplayMode('normal')).toBe(true);
      expect(isValidDisplayMode('compact')).toBe(true);
      expect(isValidDisplayMode('verbose')).toBe(true);
      expect(isValidDisplayMode('invalid')).toBe(false);
      expect(isValidDisplayMode(123)).toBe(false);
      expect(isValidDisplayMode(null)).toBe(false);
    });
  });

  describe('isValidBorderStyle', () => {
    it('should validate TerminalPanelBorderStyle values', () => {
      expect(isValidBorderStyle('single')).toBe(true);
      expect(isValidBorderStyle('round')).toBe(true);
      expect(isValidBorderStyle('double')).toBe(true);
      expect(isValidBorderStyle('none')).toBe(true);
      expect(isValidBorderStyle('invalid')).toBe(false);
      expect(isValidBorderStyle(123)).toBe(false);
    });
  });

  describe('mapExecutionStatusToAgentStatus', () => {
    it('should map all execution statuses correctly', () => {
      expect(mapExecutionStatusToAgentStatus('idle')).toBe('idle');
      expect(mapExecutionStatusToAgentStatus('queued')).toBe('idle');
      expect(mapExecutionStatusToAgentStatus('running')).toBe('active');
      expect(mapExecutionStatusToAgentStatus('paused')).toBe('idle');
      expect(mapExecutionStatusToAgentStatus('completed')).toBe('idle');
      expect(mapExecutionStatusToAgentStatus('failed')).toBe('error');
      expect(mapExecutionStatusToAgentStatus('cancelled')).toBe('idle');
    });

    it('should use the mapping constant correctly', () => {
      Object.entries(EXECUTION_STATUS_TO_AGENT_STATUS).forEach(([execStatus, agentStatus]) => {
        expect(mapExecutionStatusToAgentStatus(execStatus as AgentExecutionStatus))
          .toBe(agentStatus);
      });
    });
  });

  describe('getExecutionVisualState', () => {
    it('should return visual state for all execution statuses', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ];

      statuses.forEach(status => {
        const visualState = getExecutionVisualState(status);
        expect(visualState).toBeDefined();
        expect(visualState.focusedBorderColor).toBeDefined();
        expect(visualState.unfocusedBorderColor).toBeDefined();
        expect(typeof visualState.showPulse).toBe('boolean');
        expect(visualState.nameColor).toBeDefined();
        expect(visualState.stageColor).toBeDefined();
      });
    });

    it('should match EXECUTION_VISUAL_STATES constant', () => {
      Object.entries(EXECUTION_VISUAL_STATES).forEach(([status, expectedState]) => {
        const actualState = getExecutionVisualState(status as AgentExecutionStatus);
        expect(actualState).toEqual(expectedState);
      });
    });
  });

  describe('getResponsiveTerminalPanelConfig', () => {
    it('should return config for all breakpoints', () => {
      const breakpoints = ['narrow', 'compact', 'normal', 'wide'] as const;

      breakpoints.forEach(breakpoint => {
        const config = getResponsiveTerminalPanelConfig(breakpoint);
        expect(config).toBeDefined();
        expect(typeof config.showBorder).toBe('boolean');
        expect(typeof config.showProgress).toBe('boolean');
        expect(typeof config.showStage).toBe('boolean');
        expect(typeof config.showElapsedTime).toBe('boolean');
        expect(typeof config.maxNameLength).toBe('number');
        expect(typeof config.progressBarWidth).toBe('number');
        expect(typeof config.showError).toBe('boolean');
        expect(typeof config.maxErrorLength).toBe('number');
      });
    });

    it('should match RESPONSIVE_TERMINAL_PANEL_CONFIGS constant', () => {
      Object.entries(RESPONSIVE_TERMINAL_PANEL_CONFIGS).forEach(([breakpoint, expectedConfig]) => {
        const actualConfig = getResponsiveTerminalPanelConfig(breakpoint as any);
        expect(actualConfig).toEqual(expectedConfig);
      });
    });
  });

  describe('processExecutionData', () => {
    it('should process execution data correctly', () => {
      const execution: AgentExecution = {
        id: 'test',
        agentId: 'test',
        agentName: 'Very Long Agent Name That Should Be Truncated',
        status: 'running',
        stage: 'implementation',
        progress: 75,
        error: 'A very long error message that should be truncated for display purposes'
      };

      const config: ResponsiveTerminalPanelConfig = {
        showBorder: true,
        showProgress: true,
        showStage: true,
        showElapsedTime: true,
        maxNameLength: 20,
        progressBarWidth: 30,
        showError: true,
        maxErrorLength: 30
      };

      const processed = processExecutionData(execution, config);

      expect(processed.displayName).toBe('Very Long Agent Na..');
      expect(processed.displayStage).toBe('implementation');
      expect(processed.progress).toBe(75);
      expect(processed.errorMessage).toBe('A very long error message t...');
      expect(processed.indicatorStatus).toBe('active');
      expect(processed.visualState).toBeDefined();
    });

    it('should handle truncation and optional fields', () => {
      const execution: AgentExecution = {
        id: 'test',
        agentId: 'test',
        agentName: 'Short',
        status: 'completed',
        progress: 100
        // No stage, no error
      };

      const config: ResponsiveTerminalPanelConfig = {
        showBorder: true,
        showProgress: true,
        showStage: false,
        showElapsedTime: true,
        maxNameLength: 20,
        progressBarWidth: 30,
        showError: false,
        maxErrorLength: 30
      };

      const processed = processExecutionData(execution, config);

      expect(processed.displayName).toBe('Short');
      expect(processed.displayStage).toBeNull();
      expect(processed.errorMessage).toBeNull();
      expect(processed.indicatorStatus).toBe('idle');
    });
  });
});

describe('Default Props Configuration', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_TERMINAL_PANEL_PROPS.displayMode).toBe('normal');
    expect(DEFAULT_TERMINAL_PANEL_PROPS.focused).toBe(false);
    expect(DEFAULT_TERMINAL_PANEL_PROPS.animated).toBe(true);
    expect(DEFAULT_TERMINAL_PANEL_PROPS.borderStyle).toBe('single');
    expect(DEFAULT_TERMINAL_PANEL_PROPS.showElapsedTime).toBe(true);
    expect(DEFAULT_TERMINAL_PANEL_PROPS.showProgress).toBe(true);
    expect(DEFAULT_TERMINAL_PANEL_PROPS.allowKeyboardInput).toBe(true);
  });

  it('should include the new allowKeyboardInput default', () => {
    // Ensure the new keyboard input prop is included in defaults
    expect('allowKeyboardInput' in DEFAULT_TERMINAL_PANEL_PROPS).toBe(true);
    expect(DEFAULT_TERMINAL_PANEL_PROPS.allowKeyboardInput).toBe(true);
  });

  it('should match the props interface defaults', () => {
    // Test that defaults are compatible with the full interface
    const propsWithDefaults: AgentTerminalPanelProps = {
      execution: {
        id: 'test',
        agentId: 'test',
        agentName: 'Test',
        status: 'running',
        progress: 50
      },
      ...DEFAULT_TERMINAL_PANEL_PROPS
    };

    expect(propsWithDefaults.displayMode).toBe('normal');
    expect(propsWithDefaults.allowKeyboardInput).toBe(true);
  });
});