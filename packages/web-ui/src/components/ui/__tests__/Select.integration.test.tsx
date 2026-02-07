/**
 * Integration tests for Select component
 *
 * TECHNICAL DESIGN DOCUMENT
 * ========================
 *
 * This file serves as both the test implementation scaffold and the architectural
 * design record for the Select component integration tests.
 *
 * ## Architecture Decision Record (ADR)
 *
 * ### Context
 * The Select component is a custom single-select dropdown with full keyboard
 * navigation support. It needs comprehensive integration tests covering:
 * - Opening dropdown (click and keyboard)
 * - Selecting an option (mouse and keyboard)
 * - Closing dropdown (click outside, escape, selection)
 * - Keyboard navigation (arrow keys, enter, space, escape, tab)
 * - Disabled state (component-level and option-level)
 * - Form state integration (selected value reflects correctly)
 *
 * ### Decision
 * We will follow the established testing patterns in the codebase:
 *
 * 1. **Test Framework**: Vitest + React Testing Library + @testing-library/user-event
 *    - Consistent with existing tests (ThoughtDisplay, focus-behavior tests)
 *    - jsdom environment configured in vitest.config.ts
 *
 * 2. **File Location**: `packages/web-ui/src/components/ui/__tests__/Select.integration.test.tsx`
 *    - Follows pattern of component tests being in __tests__ subdirectory
 *    - Named `.integration.test.tsx` matching vitest include patterns
 *
 * 3. **Test Structure**:
 *    - Grouped by behavior category using `describe` blocks
 *    - Each acceptance criterion maps to one or more test cases
 *    - Use `userEvent` for realistic user interactions (not just fireEvent)
 *
 * 4. **Component Props Interface**:
 *    - `options: SelectOption[]` - array of {value, label, description?, disabled?}
 *    - `value: string` - controlled value
 *    - `onChange: (value: string) => void` - change handler
 *    - `placeholder?: string` - placeholder text
 *    - `disabled?: boolean` - disabled state
 *    - `error?: string` - error message
 *    - `data-testid?: string` - test identifier
 *
 * 5. **Mock Strategy**:
 *    - Mock `@/lib/utils` cn function (consistent with focus-behavior tests)
 *    - No external API mocks needed (component is self-contained)
 *
 * 6. **ARIA Compliance Testing**:
 *    - Test `aria-expanded`, `aria-haspopup="listbox"`, `aria-selected`
 *    - Test `role="listbox"` and `role="option"` semantics
 *    - Verify disabled options have `aria-disabled`
 *
 * ### Test Categories
 *
 * 1. **Opening Dropdown Tests**
 *    - Click trigger button opens dropdown
 *    - Keyboard Enter/Space opens dropdown
 *    - ArrowDown opens dropdown and focuses first option
 *    - Disabled component does not open
 *
 * 2. **Selecting an Option Tests**
 *    - Click on option selects it and closes dropdown
 *    - Keyboard Enter on focused option selects it
 *    - Space on focused option selects it
 *    - Selected value reflected in trigger button
 *    - Disabled options cannot be selected
 *
 * 3. **Closing Dropdown Tests**
 *    - Escape key closes dropdown
 *    - Click outside closes dropdown
 *    - Tab key closes dropdown
 *    - Selection closes dropdown
 *
 * 4. **Keyboard Navigation Tests**
 *    - ArrowDown moves focus to next option
 *    - ArrowUp moves focus to previous option
 *    - Focus wraps at boundaries (stays within bounds)
 *    - Focus visual indicator updates correctly
 *
 * 5. **Disabled State Tests**
 *    - Disabled component shows disabled styles
 *    - Disabled component does not respond to interactions
 *    - Individual disabled options are skipped/non-selectable
 *
 * 6. **Form State Integration Tests**
 *    - onChange callback receives correct value
 *    - Controlled value prop updates display
 *    - Form submission includes selected value
 *    - Error state displays error message
 *
 * ### Implementation Notes
 *
 * - Use `userEvent.setup()` for realistic async event handling
 * - Use `data-testid` props for reliable element selection
 * - Test component in isolation and within form context
 * - Verify state changes through UI assertions (not implementation details)
 *
 * ### Consequences
 *
 * - Tests will be maintainable and consistent with codebase patterns
 * - Tests cover all acceptance criteria comprehensively
 * - ARIA compliance ensures accessibility
 * - Form integration tests ensure real-world usability
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectOption } from '../Select';

// Mock the utils function consistent with other tests
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(' ')
}));

// Test data fixtures
const defaultOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const optionsWithDisabled: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const optionsWithDescriptions: SelectOption[] = [
  { value: 'apple', label: 'Apple', description: 'A red fruit' },
  { value: 'banana', label: 'Banana', description: 'A yellow fruit' },
  { value: 'cherry', label: 'Cherry', description: 'A small red fruit' },
];

// Controlled Select wrapper for form integration tests
const ControlledSelect: React.FC<{
  initialValue?: string;
  options?: SelectOption[];
  disabled?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
  'data-testid'?: string;
}> = ({
  initialValue = '',
  options = defaultOptions,
  disabled = false,
  error,
  onValueChange,
  'data-testid': testId = 'select'
}) => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <Select
      options={options}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      error={error}
      data-testid={testId}
      placeholder="Select a fruit..."
    />
  );
};

// Form integration test wrapper
const FormWithSelect: React.FC<{
  onSubmit?: (formData: { fruit: string }) => void;
}> = ({ onSubmit }) => {
  const [selectedFruit, setSelectedFruit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ fruit: selectedFruit });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="form">
      <label htmlFor="fruit-select">Select a fruit:</label>
      <Select
        options={defaultOptions}
        value={selectedFruit}
        onChange={setSelectedFruit}
        data-testid="fruit-select"
        placeholder="Choose..."
      />
      <button type="submit" data-testid="submit-button">Submit</button>
      <span data-testid="selected-value">{selectedFruit || 'none'}</span>
    </form>
  );
};

describe('Select Component Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Opening Dropdown', () => {
    it('should open dropdown when trigger button is clicked', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should open dropdown when Enter key is pressed', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();

      await user.keyboard('{Enter}');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should open dropdown when Space key is pressed', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();

      await user.keyboard(' ');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should open dropdown and focus first option when ArrowDown is pressed', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();

      await user.keyboard('{ArrowDown}');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      // First option should have focus indicator (bg-accent class)
      const firstOption = screen.getByTestId('select-option-apple');
      expect(firstOption).toHaveClass('bg-accent');
    });

    it('should not open dropdown when component is disabled', async () => {
      render(<ControlledSelect disabled />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toBeDisabled();

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should have correct ARIA attributes on trigger', () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Selecting an Option', () => {
    it('should select option when clicked and close dropdown', async () => {
      const onValueChange = vi.fn();
      render(<ControlledSelect onValueChange={onValueChange} />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      const bananaOption = screen.getByTestId('select-option-banana');
      await user.click(bananaOption);

      expect(onValueChange).toHaveBeenCalledWith('banana');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveTextContent('Banana');
    });

    it('should select focused option when Enter key is pressed', async () => {
      const onValueChange = vi.fn();
      render(<ControlledSelect onValueChange={onValueChange} />);

      const trigger = screen.getByTestId('select');
      trigger.focus();

      // Open dropdown
      await user.keyboard('{Enter}');
      // First option is focused, press Enter to select
      await user.keyboard('{Enter}');

      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should select focused option when Space key is pressed', async () => {
      const onValueChange = vi.fn();
      render(<ControlledSelect onValueChange={onValueChange} />);

      const trigger = screen.getByTestId('select');
      trigger.focus();

      // Open dropdown
      await user.keyboard(' ');
      // First option is focused, press Space to select
      await user.keyboard(' ');

      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should display selected option label in trigger', async () => {
      render(<ControlledSelect initialValue="cherry" />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveTextContent('Cherry');
    });

    it('should not select disabled option when clicked', async () => {
      const onValueChange = vi.fn();
      render(
        <ControlledSelect
          options={optionsWithDisabled}
          onValueChange={onValueChange}
        />
      );

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      const disabledOption = screen.getByTestId('select-option-banana');
      expect(disabledOption).toHaveAttribute('aria-disabled', 'true');

      await user.click(disabledOption);

      // Dropdown should still be open (selection did not happen)
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should show checkmark indicator for selected option', async () => {
      render(<ControlledSelect initialValue="apple" />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      const selectedOption = screen.getByTestId('select-option-apple');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      // Should have visual indicator (svg checkmark)
      expect(selectedOption.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Closing Dropdown', () => {
    it('should close dropdown when Escape key is pressed', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <ControlledSelect />
          <button data-testid="outside-button">Outside</button>
        </div>
      );

      const trigger = screen.getByTestId('select');
      await user.click(trigger);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      const outsideButton = screen.getByTestId('outside-button');
      await act(async () => {
        fireEvent.mouseDown(outsideButton);
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should close dropdown when Tab key is pressed', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{Enter}'); // Open dropdown

      await user.keyboard('{Tab}');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should close dropdown after selecting an option', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      await user.click(screen.getByTestId('select-option-banana'));

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should move focus down with ArrowDown key', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // Open and focus first

      // First option should be focused
      expect(screen.getByTestId('select-option-apple')).toHaveClass('bg-accent');

      await user.keyboard('{ArrowDown}'); // Move to second

      expect(screen.getByTestId('select-option-apple')).not.toHaveClass('bg-accent');
      expect(screen.getByTestId('select-option-banana')).toHaveClass('bg-accent');
    });

    it('should move focus up with ArrowUp key', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // Open
      await user.keyboard('{ArrowDown}'); // Focus second option

      expect(screen.getByTestId('select-option-banana')).toHaveClass('bg-accent');

      await user.keyboard('{ArrowUp}'); // Move back to first

      expect(screen.getByTestId('select-option-apple')).toHaveClass('bg-accent');
    });

    it('should not wrap focus at first option boundary', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // Open and focus first

      await user.keyboard('{ArrowUp}'); // Try to go before first

      // Should stay on first option
      expect(screen.getByTestId('select-option-apple')).toHaveClass('bg-accent');
    });

    it('should not wrap focus at last option boundary', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // Open and focus first
      await user.keyboard('{ArrowDown}'); // Second
      await user.keyboard('{ArrowDown}'); // Third (last)

      expect(screen.getByTestId('select-option-cherry')).toHaveClass('bg-accent');

      await user.keyboard('{ArrowDown}'); // Try to go past last

      // Should stay on last option
      expect(screen.getByTestId('select-option-cherry')).toHaveClass('bg-accent');
    });

    it('should select focused option with Enter after navigation', async () => {
      const onValueChange = vi.fn();
      render(<ControlledSelect onValueChange={onValueChange} />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // Open and focus first
      await user.keyboard('{ArrowDown}'); // Move to second
      await user.keyboard('{Enter}'); // Select second

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });
  });

  describe('Disabled State', () => {
    it('should show disabled styles when disabled prop is true', () => {
      render(<ControlledSelect disabled />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveClass('disabled:cursor-not-allowed');
      expect(trigger).toHaveClass('disabled:opacity-50');
    });

    it('should not respond to click when disabled', async () => {
      const onValueChange = vi.fn();
      render(<ControlledSelect disabled onValueChange={onValueChange} />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should not respond to keyboard when disabled', async () => {
      render(<ControlledSelect disabled />);

      const trigger = screen.getByTestId('select');
      trigger.focus();
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should render disabled options with disabled styles', async () => {
      render(<ControlledSelect options={optionsWithDisabled} />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);

      const disabledOption = screen.getByTestId('select-option-banana');
      expect(disabledOption).toHaveClass('cursor-not-allowed');
      expect(disabledOption).toHaveClass('opacity-50');
    });
  });

  describe('Form State Integration', () => {
    it('should pass selected value to form submission', async () => {
      const onSubmit = vi.fn();
      render(<FormWithSelect onSubmit={onSubmit} />);

      // Select an option
      const trigger = screen.getByTestId('fruit-select');
      await user.click(trigger);
      await user.click(screen.getByTestId('fruit-select-option-cherry'));

      // Verify displayed value
      expect(screen.getByTestId('selected-value')).toHaveTextContent('cherry');

      // Submit form
      await user.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({ fruit: 'cherry' });
    });

    it('should update display when controlled value prop changes', async () => {
      const { rerender } = render(
        <Select
          options={defaultOptions}
          value=""
          onChange={() => {}}
          data-testid="select"
          placeholder="Select..."
        />
      );

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveTextContent('Select...');

      rerender(
        <Select
          options={defaultOptions}
          value="banana"
          onChange={() => {}}
          data-testid="select"
          placeholder="Select..."
        />
      );

      expect(trigger).toHaveTextContent('Banana');
    });

    it('should display error message when error prop is provided', () => {
      render(<ControlledSelect error="Please select a fruit" />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a fruit');
    });

    it('should show placeholder when no value is selected', () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveTextContent('Select a fruit...');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles and attributes', async () => {
      render(<ControlledSelect initialValue="apple" />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');

      await user.click(trigger);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Options');

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      const selectedOption = screen.getByTestId('select-option-apple');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should have correct aria-expanded state', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should support description text for options', async () => {
      render(<ControlledSelect options={optionsWithDescriptions} />);

      await user.click(screen.getByTestId('select'));

      expect(screen.getByText('A red fruit')).toBeInTheDocument();
      expect(screen.getByText('A yellow fruit')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should display "No options available" when options array is empty', async () => {
      render(
        <Select
          options={[]}
          value=""
          onChange={() => {}}
          data-testid="empty-select"
        />
      );

      await user.click(screen.getByTestId('empty-select'));

      expect(screen.getByText('No options available')).toBeInTheDocument();
    });

    it('should handle rapid open/close interactions', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');

      // Rapidly toggle
      await user.click(trigger);
      await user.click(trigger);
      await user.click(trigger);
      await user.click(trigger);

      // Should be in closed state (even number of clicks)
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should maintain focus on trigger after closing', async () => {
      render(<ControlledSelect />);

      const trigger = screen.getByTestId('select');
      await user.click(trigger);
      await user.keyboard('{Escape}');

      // Focus should remain on trigger for keyboard accessibility
      expect(document.activeElement).toBe(trigger);
    });
  });
});
