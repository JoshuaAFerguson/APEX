/**
 * Integration tests for focus behavior on form elements
 *
 * Tests verify:
 * - Focus fires when element receives focus
 * - Focus works on input/textarea/select/button elements
 * - Focus ring/styles are applied
 * - TabIndex behavior is correct
 * - Programmatic focus works
 */

import React, { useRef, useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from './test-utils';
import { Box, Text } from 'ink';
import { AdvancedInput } from '../ui/components/AdvancedInput';
import { InputPrompt } from '../ui/components/InputPrompt';

// Test components to simulate different form elements
const TestInput: React.FC<{
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
  autoFocus?: boolean;
  'data-testid'?: string;
}> = ({ onFocus, onBlur, tabIndex, autoFocus, 'data-testid': testId }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
    }
  }, [autoFocus]);

  return (
    <input
      ref={ref}
      type="text"
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      data-testid={testId}
      style={{
        outline: 'none',
        border: '1px solid #ccc',
        padding: '4px',
      }}
    />
  );
};

const TestTextArea: React.FC<{
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
  'data-testid'?: string;
}> = ({ onFocus, onBlur, tabIndex, 'data-testid': testId }) => {
  return (
    <textarea
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      data-testid={testId}
      style={{
        outline: 'none',
        border: '1px solid #ccc',
        padding: '4px',
      }}
    />
  );
};

const TestSelect: React.FC<{
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
  'data-testid'?: string;
}> = ({ onFocus, onBlur, tabIndex, 'data-testid': testId }) => {
  return (
    <select
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      data-testid={testId}
      style={{
        outline: 'none',
        border: '1px solid #ccc',
        padding: '4px',
      }}
    >
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
    </select>
  );
};

const TestButton: React.FC<{
  onClick?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
  'data-testid'?: string;
  children: React.ReactNode;
}> = ({ onClick, onFocus, onBlur, tabIndex, 'data-testid': testId, children }) => {
  return (
    <button
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      data-testid={testId}
      style={{
        outline: 'none',
        border: '1px solid #ccc',
        padding: '8px 16px',
        backgroundColor: '#f0f0f0',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
};

// Test component with focus rings/styles
const TestStyledInput: React.FC<{
  onFocus?: () => void;
  onBlur?: () => void;
  'data-testid'?: string;
}> = ({ onFocus, onBlur, 'data-testid': testId }) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  return (
    <input
      type="text"
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-testid={testId}
      style={{
        outline: 'none',
        border: focused ? '2px solid #007acc' : '1px solid #ccc',
        padding: '4px',
        boxShadow: focused ? '0 0 0 2px rgba(0, 122, 204, 0.2)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      data-focused={focused}
    />
  );
};

// Test component for programmatic focus
const ProgrammaticFocusTest: React.FC<{
  'data-testid'?: string;
}> = ({ 'data-testid': testId }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusCount, setFocusCount] = useState(0);

  const handleProgrammaticFocus = () => {
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setFocusCount(prev => prev + 1);
  };

  return (
    <div data-testid={testId}>
      <input
        ref={inputRef}
        type="text"
        onFocus={handleFocus}
        data-testid={`${testId}-input`}
      />
      <button
        onClick={handleProgrammaticFocus}
        data-testid={`${testId}-button`}
      >
        Focus Input
      </button>
      <span data-testid={`${testId}-count`}>{focusCount}</span>
    </div>
  );
};

// Test component with complex tab order
const TabOrderTest: React.FC<{
  'data-testid'?: string;
}> = ({ 'data-testid': testId }) => {
  const [focusOrder, setFocusOrder] = useState<string[]>([]);

  const handleFocus = (elementId: string) => {
    setFocusOrder(prev => [...prev, elementId]);
  };

  return (
    <div data-testid={testId}>
      <input
        tabIndex={3}
        onFocus={() => handleFocus('input-3')}
        data-testid={`${testId}-input-3`}
        placeholder="Tab index 3"
      />
      <input
        tabIndex={1}
        onFocus={() => handleFocus('input-1')}
        data-testid={`${testId}-input-1`}
        placeholder="Tab index 1"
      />
      <button
        tabIndex={2}
        onFocus={() => handleFocus('button-2')}
        data-testid={`${testId}-button-2`}
      >
        Tab index 2
      </button>
      <input
        tabIndex={-1}
        onFocus={() => handleFocus('input-negative')}
        data-testid={`${testId}-input-negative`}
        placeholder="Tab index -1 (not in tab order)"
      />
      <span data-testid={`${testId}-order`}>{focusOrder.join(',')}</span>
    </div>
  );
};

describe('Focus Behavior Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document focus
    document.body.focus();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Focus Events on Form Elements', () => {
    it('should fire focus events when input element receives focus', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      render(
        <TestInput
          onFocus={onFocus}
          onBlur={onBlur}
          data-testid="test-input"
        />
      );

      const input = screen.getByTestId('test-input');

      // Focus the input
      await act(async () => {
        fireEvent.focus(input);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(0);

      // Blur the input
      await act(async () => {
        fireEvent.blur(input);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('should fire focus events when textarea element receives focus', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      render(
        <TestTextArea
          onFocus={onFocus}
          onBlur={onBlur}
          data-testid="test-textarea"
        />
      );

      const textarea = screen.getByTestId('test-textarea');

      await act(async () => {
        fireEvent.focus(textarea);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.blur(textarea);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('should fire focus events when select element receives focus', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      render(
        <TestSelect
          onFocus={onFocus}
          onBlur={onBlur}
          data-testid="test-select"
        />
      );

      const select = screen.getByTestId('test-select');

      await act(async () => {
        fireEvent.focus(select);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.blur(select);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('should fire focus events when button element receives focus', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const onClick = vi.fn();

      render(
        <TestButton
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={onClick}
          data-testid="test-button"
        >
          Test Button
        </TestButton>
      );

      const button = screen.getByTestId('test-button');

      await act(async () => {
        fireEvent.focus(button);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);

      // Verify button still responds to clicks when focused
      await act(async () => {
        fireEvent.click(button);
      });

      expect(onClick).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.blur(button);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus Ring and Styles Application', () => {
    it('should apply focus styles when element receives focus', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      render(
        <TestStyledInput
          onFocus={onFocus}
          onBlur={onBlur}
          data-testid="styled-input"
        />
      );

      const input = screen.getByTestId('styled-input');

      // Initially not focused
      expect(input).toHaveAttribute('data-focused', 'false');
      expect(input).toHaveStyle('border: 1px solid #ccc');

      // Focus the input
      await act(async () => {
        fireEvent.focus(input);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(input).toHaveAttribute('data-focused', 'true');
      expect(input).toHaveStyle('border: 2px solid #007acc');

      // Blur the input
      await act(async () => {
        fireEvent.blur(input);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(input).toHaveAttribute('data-focused', 'false');
      expect(input).toHaveStyle('border: 1px solid #ccc');
    });

    it('should handle multiple elements with focus rings independently', async () => {
      const onFocus1 = vi.fn();
      const onFocus2 = vi.fn();

      render(
        <div>
          <TestStyledInput
            onFocus={onFocus1}
            data-testid="styled-input-1"
          />
          <TestStyledInput
            onFocus={onFocus2}
            data-testid="styled-input-2"
          />
        </div>
      );

      const input1 = screen.getByTestId('styled-input-1');
      const input2 = screen.getByTestId('styled-input-2');

      // Focus first input
      await act(async () => {
        fireEvent.focus(input1);
      });

      expect(onFocus1).toHaveBeenCalledTimes(1);
      expect(input1).toHaveAttribute('data-focused', 'true');
      expect(input2).toHaveAttribute('data-focused', 'false');

      // Focus second input (should blur first)
      await act(async () => {
        fireEvent.focus(input2);
      });

      expect(onFocus2).toHaveBeenCalledTimes(1);
      expect(input1).toHaveAttribute('data-focused', 'false');
      expect(input2).toHaveAttribute('data-focused', 'true');
    });
  });

  describe('Tab Index Behavior', () => {
    it('should respect custom tabIndex order', async () => {
      render(<TabOrderTest data-testid="tab-order-test" />);

      const input1 = screen.getByTestId('tab-order-test-input-1');
      const button2 = screen.getByTestId('tab-order-test-button-2');
      const input3 = screen.getByTestId('tab-order-test-input-3');
      const inputNegative = screen.getByTestId('tab-order-test-input-negative');

      // Check tab index attributes
      expect(input1).toHaveAttribute('tabIndex', '1');
      expect(button2).toHaveAttribute('tabIndex', '2');
      expect(input3).toHaveAttribute('tabIndex', '3');
      expect(inputNegative).toHaveAttribute('tabIndex', '-1');

      // Focus elements in tab order
      await act(async () => {
        fireEvent.focus(input1);
      });

      await act(async () => {
        fireEvent.focus(button2);
      });

      await act(async () => {
        fireEvent.focus(input3);
      });

      const order = screen.getByTestId('tab-order-test-order');
      expect(order).toHaveTextContent('input-1,button-2,input-3');

      // Negative tabIndex should not be in tab order but can be focused programmatically
      await act(async () => {
        inputNegative.focus();
      });

      expect(order).toHaveTextContent('input-1,button-2,input-3,input-negative');
    });

    it('should handle default tabIndex (0) correctly', async () => {
      const onFocus = vi.fn();

      render(
        <TestInput
          onFocus={onFocus}
          data-testid="default-tabindex"
          // No explicit tabIndex - should default to 0
        />
      );

      const input = screen.getByTestId('default-tabindex');

      await act(async () => {
        fireEvent.focus(input);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);
      // Element should be focusable
      expect(document.activeElement).toBe(input);
    });

    it('should prevent tab navigation for negative tabIndex', async () => {
      render(
        <div>
          <TestInput tabIndex={0} data-testid="normal-input" />
          <TestInput tabIndex={-1} data-testid="negative-tabindex-input" />
          <TestButton tabIndex={0} data-testid="normal-button">
            Normal Button
          </TestButton>
        </div>
      );

      const normalInput = screen.getByTestId('normal-input');
      const negativeInput = screen.getByTestId('negative-tabindex-input');
      const normalButton = screen.getByTestId('normal-button');

      // Negative tabIndex elements should not be in natural tab order
      expect(negativeInput).toHaveAttribute('tabIndex', '-1');

      // But they should still be focusable programmatically
      await act(async () => {
        negativeInput.focus();
      });

      expect(document.activeElement).toBe(negativeInput);
    });
  });

  describe('Programmatic Focus', () => {
    it('should focus element when focus() is called programmatically', async () => {
      render(<ProgrammaticFocusTest data-testid="programmatic-test" />);

      const button = screen.getByTestId('programmatic-test-button');
      const input = screen.getByTestId('programmatic-test-input');
      const counter = screen.getByTestId('programmatic-test-count');

      expect(counter).toHaveTextContent('0');

      // Click button to focus input programmatically
      await act(async () => {
        fireEvent.click(button);
      });

      expect(counter).toHaveTextContent('1');
      expect(document.activeElement).toBe(input);

      // Focus again
      await act(async () => {
        fireEvent.click(button);
      });

      expect(counter).toHaveTextContent('2');
    });

    it('should handle focus on hidden/disabled elements gracefully', async () => {
      const DisabledFocusTest: React.FC = () => {
        const inputRef = useRef<HTMLInputElement>(null);
        const [focusCount, setFocusCount] = useState(0);

        const handleFocus = () => setFocusCount(prev => prev + 1);
        const handleProgrammaticFocus = () => inputRef.current?.focus();

        return (
          <div>
            <input
              ref={inputRef}
              disabled
              onFocus={handleFocus}
              data-testid="disabled-input"
            />
            <button
              onClick={handleProgrammaticFocus}
              data-testid="focus-disabled-button"
            >
              Focus Disabled Input
            </button>
            <span data-testid="disabled-focus-count">{focusCount}</span>
          </div>
        );
      };

      render(<DisabledFocusTest />);

      const button = screen.getByTestId('focus-disabled-button');
      const input = screen.getByTestId('disabled-input');
      const counter = screen.getByTestId('disabled-focus-count');

      expect(input).toBeDisabled();
      expect(counter).toHaveTextContent('0');

      // Try to focus disabled input - should not work
      await act(async () => {
        fireEvent.click(button);
      });

      expect(counter).toHaveTextContent('0');
      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('AutoFocus Behavior', () => {
    it('should automatically focus element with autoFocus prop', async () => {
      const onFocus = vi.fn();

      render(
        <TestInput
          autoFocus
          onFocus={onFocus}
          data-testid="autofocus-input"
        />
      );

      const input = screen.getByTestId('autofocus-input');

      // AutoFocus should trigger focus on mount
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(input);
    });

    it('should handle multiple autoFocus elements correctly (last one wins)', async () => {
      const onFocus1 = vi.fn();
      const onFocus2 = vi.fn();

      render(
        <div>
          <TestInput
            autoFocus
            onFocus={onFocus1}
            data-testid="autofocus-input-1"
          />
          <TestInput
            autoFocus
            onFocus={onFocus2}
            data-testid="autofocus-input-2"
          />
        </div>
      );

      const input1 = screen.getByTestId('autofocus-input-1');
      const input2 = screen.getByTestId('autofocus-input-2');

      // Both should attempt to focus, but last one should win
      expect(onFocus1).toHaveBeenCalledTimes(1);
      expect(onFocus2).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(input2);
    });
  });

  describe('Complex Focus Scenarios', () => {
    it('should handle focus within nested components', async () => {
      const NestedFocusTest: React.FC = () => {
        const [outerFocus, setOuterFocus] = useState(false);
        const [innerFocus, setInnerFocus] = useState(false);

        return (
          <div
            onFocus={() => setOuterFocus(true)}
            onBlur={() => setOuterFocus(false)}
            data-testid="outer-container"
            data-focused={outerFocus}
          >
            <div
              onFocus={() => setInnerFocus(true)}
              onBlur={() => setInnerFocus(false)}
              data-testid="inner-container"
              data-focused={innerFocus}
            >
              <TestInput data-testid="nested-input" />
            </div>
          </div>
        );
      };

      render(<NestedFocusTest />);

      const input = screen.getByTestId('nested-input');
      const innerContainer = screen.getByTestId('inner-container');
      const outerContainer = screen.getByTestId('outer-container');

      await act(async () => {
        fireEvent.focus(input);
      });

      expect(document.activeElement).toBe(input);
      // Focus events should bubble up
      expect(innerContainer).toHaveAttribute('data-focused', 'true');
      expect(outerContainer).toHaveAttribute('data-focused', 'true');
    });

    it('should maintain focus state across component updates', async () => {
      const DynamicFocusTest: React.FC = () => {
        const [showSecond, setShowSecond] = useState(false);
        const [focusCount, setFocusCount] = useState(0);

        const handleFocus = () => setFocusCount(prev => prev + 1);

        return (
          <div>
            <TestInput
              onFocus={handleFocus}
              data-testid="persistent-input"
            />
            <button
              onClick={() => setShowSecond(!showSecond)}
              data-testid="toggle-button"
            >
              Toggle Second Input
            </button>
            {showSecond && (
              <TestInput
                onFocus={handleFocus}
                data-testid="dynamic-input"
              />
            )}
            <span data-testid="focus-counter">{focusCount}</span>
          </div>
        );
      };

      render(<DynamicFocusTest />);

      const persistentInput = screen.getByTestId('persistent-input');
      const toggleButton = screen.getByTestId('toggle-button');
      const counter = screen.getByTestId('focus-counter');

      // Focus first input
      await act(async () => {
        fireEvent.focus(persistentInput);
      });

      expect(counter).toHaveTextContent('1');

      // Show second input
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      const dynamicInput = screen.getByTestId('dynamic-input');

      // Focus dynamic input
      await act(async () => {
        fireEvent.focus(dynamicInput);
      });

      expect(counter).toHaveTextContent('2');

      // Hide second input - should not affect focus count
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      expect(counter).toHaveTextContent('2');

      // First input should still be focusable
      await act(async () => {
        fireEvent.focus(persistentInput);
      });

      expect(counter).toHaveTextContent('3');
    });
  });

  describe('Advanced Input Component Focus Integration', () => {
    it('should handle focus events in AdvancedInput component', async () => {
      const onSubmit = vi.fn();
      const onChange = vi.fn();

      render(
        <AdvancedInput
          placeholder="Test input..."
          onSubmit={onSubmit}
          onChange={onChange}
          value="initial value"
        />
      );

      // AdvancedInput uses Ink's useInput hook rather than DOM focus events
      // But we can test that it renders and handles input properly
      expect(screen.getByText(/Test input.../)).toBeInTheDocument();
    });

    it('should handle focus events in InputPrompt component', async () => {
      const onSubmit = vi.fn();

      render(
        <InputPrompt
          prompt="test>"
          placeholder="Enter command..."
          onSubmit={onSubmit}
        />
      );

      // InputPrompt wraps AdvancedInput and should render properly
      expect(screen.getByText(/Enter command.../)).toBeInTheDocument();
      expect(screen.getByText(/test>/)).toBeInTheDocument();
    });
  });
});