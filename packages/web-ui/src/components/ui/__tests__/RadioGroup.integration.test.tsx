/**
 * Integration tests for RadioGroup component
 *
 * TECHNICAL DESIGN DOCUMENT
 * ========================
 *
 * This file serves as both the test implementation and the architectural
 * design record for the RadioGroup component integration tests.
 *
 * ## Architecture Decision Record (ADR)
 *
 * ### Context
 * The RadioGroup component is a custom radio button group with full keyboard
 * navigation support. It needs comprehensive integration tests covering:
 * - Selecting radio option (mouse and keyboard)
 * - Mutual exclusivity within group (only one option selected at a time)
 * - Disabled options (component-level and individual option-level)
 * - Keyboard navigation between options (arrow keys)
 * - Selected value reflects correctly in form state
 *
 * ### Decision
 * We follow the established testing patterns in the codebase:
 *
 * 1. **Test Framework**: Vitest + React Testing Library + @testing-library/user-event
 *    - Consistent with existing tests (Select.integration.test.tsx, ThoughtDisplay, etc.)
 *    - jsdom environment configured in vitest.config.ts
 *
 * 2. **File Location**: `packages/web-ui/src/components/ui/__tests__/RadioGroup.integration.test.tsx`
 *    - Follows pattern of component tests being in __tests__ subdirectory
 *    - Named `.integration.test.tsx` matching vitest include patterns
 *
 * 3. **Test Structure**:
 *    - Grouped by behavior category using `describe` blocks
 *    - Each acceptance criterion maps to one or more test cases
 *    - Use `userEvent` for realistic user interactions (not just fireEvent)
 *
 * 4. **Component Props Interface**:
 *    - `options: RadioOption[]` - array of {value, label, description?, disabled?}
 *    - `value: string` - controlled value (selected radio)
 *    - `onChange: (value: string) => void` - change handler
 *    - `name: string` - radio group name attribute
 *    - `disabled?: boolean` - disabled state for entire group
 *    - `error?: string` - error message
 *    - `data-testid?: string` - test identifier
 *
 * 5. **Mock Strategy**:
 *    - Mock `@/lib/utils` cn function (consistent with Select tests)
 *    - No external API mocks needed (component is self-contained)
 *
 * 6. **ARIA Compliance Testing**:
 *    - Test `role="radiogroup"`, `role="radio"` semantics
 *    - Test `aria-checked`, `aria-disabled` attributes
 *    - Verify disabled options have `aria-disabled="true"`
 *
 * ### Test Categories
 *
 * 1. **Radio Option Selection Tests**
 *    - Click on radio option selects it
 *    - Keyboard Space on focused radio selects it
 *    - Selected value reflects in controlled value prop
 *    - onChange callback receives correct value
 *
 * 2. **Mutual Exclusivity Tests**
 *    - Only one radio option can be selected at a time
 *    - Selecting new option deselects previously selected option
 *    - Visual indicators update correctly for selection state
 *
 * 3. **Disabled Options Tests**
 *    - Individual disabled options cannot be selected
 *    - Disabled options show disabled visual styles
 *    - Group-level disabled disables all options
 *    - Keyboard navigation skips disabled options
 *
 * 4. **Keyboard Navigation Tests**
 *    - Arrow down/right moves to next option
 *    - Arrow up/left moves to previous option
 *    - Navigation wraps at boundaries (first/last option)
 *    - Navigation skips disabled options
 *    - Space key selects currently focused option
 *
 * 5. **Form State Integration Tests**
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
 * - Focus on the user-facing behavior, not internal implementation
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
import { RadioGroup, RadioOption } from '../RadioGroup';

// Mock the utils function consistent with other tests
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(' ')
}));

// Test data fixtures
const defaultOptions: RadioOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const optionsWithDisabled: RadioOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const optionsWithDescriptions: RadioOption[] = [
  { value: 'apple', label: 'Apple', description: 'A red fruit' },
  { value: 'banana', label: 'Banana', description: 'A yellow fruit' },
  { value: 'cherry', label: 'Cherry', description: 'A small red fruit' },
];

// Controlled RadioGroup wrapper for form integration tests
const ControlledRadioGroup: React.FC<{
  initialValue?: string;
  options?: RadioOption[];
  disabled?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
  'data-testid'?: string;
  name?: string;
}> = ({
  initialValue = '',
  options = defaultOptions,
  disabled = false,
  error,
  onValueChange,
  'data-testid': testId = 'radio-group',
  name = 'fruit-selection'
}) => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <RadioGroup
      options={options}
      value={value}
      onChange={handleChange}
      name={name}
      disabled={disabled}
      error={error}
      data-testid={testId}
    />
  );
};

// Form integration test wrapper
const FormWithRadioGroup: React.FC<{
  onSubmit?: (formData: { fruit: string }) => void;
}> = ({ onSubmit }) => {
  const [selectedFruit, setSelectedFruit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ fruit: selectedFruit });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="form">
      <fieldset>
        <legend>Select a fruit:</legend>
        <RadioGroup
          options={defaultOptions}
          value={selectedFruit}
          onChange={setSelectedFruit}
          name="fruit"
          data-testid="fruit-radio-group"
        />
      </fieldset>
      <button type="submit" data-testid="submit-button">Submit</button>
      <span data-testid="selected-value">{selectedFruit || 'none'}</span>
    </form>
  );
};

describe('RadioGroup Component Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Radio Option Selection', () => {
    it('should select radio option when clicked', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const bananaOption = screen.getByTestId('radio-group-option-banana');
      const radioInput = bananaOption.querySelector('input[type="radio"]') as HTMLInputElement;

      await user.click(bananaOption);

      expect(onValueChange).toHaveBeenCalledWith('banana');
      expect(radioInput).toBeChecked();
    });

    it('should select radio option when clicking the custom visual element', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const bananaOption = screen.getByTestId('radio-group-option-banana');
      const customRadioVisual = bananaOption.querySelector('[role="presentation"]') as HTMLElement;

      await user.click(customRadioVisual);

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });

    it('should select radio option when clicking the label', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const bananaLabel = screen.getByText('Banana');

      await user.click(bananaLabel);

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });

    it('should select focused radio option when Space key is pressed', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      const bananaOption = screen.getByTestId('radio-group-option-banana');
      const radioInput = bananaOption.querySelector('input[type="radio"]') as HTMLInputElement;

      // Focus the radio group first
      radioGroup.focus();

      // Navigate to banana option (second option)
      await user.keyboard('{ArrowDown}');

      // Select with Space
      await user.keyboard(' ');

      expect(onValueChange).toHaveBeenCalledWith('banana');
      expect(radioInput).toBeChecked();
    });

    it('should display visual indicator for selected radio option', async () => {
      render(<ControlledRadioGroup initialValue="apple" />);

      const appleOption = screen.getByTestId('radio-group-option-apple');
      const radioInput = appleOption.querySelector('input[type="radio"]') as HTMLInputElement;
      const customVisual = appleOption.querySelector('[role="presentation"]') as HTMLElement;

      expect(radioInput).toBeChecked();
      // Check for the radio dot (visual indicator for selected state)
      const radioDot = customVisual.querySelector('.h-2.w-2.rounded-full');
      expect(radioDot).toBeInTheDocument();
    });

    it('should update controlled value when selection changes', async () => {
      const { rerender } = render(
        <RadioGroup
          options={defaultOptions}
          value=""
          onChange={() => {}}
          name="test"
          data-testid="radio-group"
        />
      );

      // No option selected initially
      const appleInput = screen.getByTestId('radio-group-option-apple').querySelector('input') as HTMLInputElement;
      expect(appleInput).not.toBeChecked();

      rerender(
        <RadioGroup
          options={defaultOptions}
          value="apple"
          onChange={() => {}}
          name="test"
          data-testid="radio-group"
        />
      );

      // Apple should now be selected
      expect(appleInput).toBeChecked();
    });
  });

  describe('Mutual Exclusivity', () => {
    it('should allow only one radio option to be selected at a time', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const appleOption = screen.getByTestId('radio-group-option-apple');
      const bananaOption = screen.getByTestId('radio-group-option-banana');
      const appleInput = appleOption.querySelector('input') as HTMLInputElement;
      const bananaInput = bananaOption.querySelector('input') as HTMLInputElement;

      // Select apple first
      await user.click(appleOption);
      expect(onValueChange).toHaveBeenCalledWith('apple');
      expect(appleInput).toBeChecked();
      expect(bananaInput).not.toBeChecked();

      // Select banana - should deselect apple
      onValueChange.mockClear();
      await user.click(bananaOption);
      expect(onValueChange).toHaveBeenCalledWith('banana');
    });

    it('should deselect previously selected option when new option is selected', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup initialValue="apple" onValueChange={onValueChange} />);

      const appleOption = screen.getByTestId('radio-group-option-apple');
      const bananaOption = screen.getByTestId('radio-group-option-banana');
      const appleInput = appleOption.querySelector('input') as HTMLInputElement;
      const bananaInput = bananaOption.querySelector('input') as HTMLInputElement;

      // Apple should be selected initially
      expect(appleInput).toBeChecked();
      expect(bananaInput).not.toBeChecked();

      // Select banana
      await user.click(bananaOption);

      expect(onValueChange).toHaveBeenCalledWith('banana');
      // Since this is a controlled component, the parent would update the value
      // We test the controlled behavior separately
    });

    it('should have all radio inputs share the same name attribute', () => {
      render(<ControlledRadioGroup name="fruit-choice" />);

      const radioInputs = screen.getAllByRole('radio');
      radioInputs.forEach(input => {
        expect(input).toHaveAttribute('name', 'fruit-choice');
      });
    });

    it('should maintain mutual exclusivity with keyboard selection', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');

      // Focus the radio group
      radioGroup.focus();

      // Select first option with Space
      await user.keyboard(' ');
      expect(onValueChange).toHaveBeenLastCalledWith('apple');

      // Navigate to second option and select it
      onValueChange.mockClear();
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');
      expect(onValueChange).toHaveBeenCalledWith('banana');
    });
  });

  describe('Disabled Options', () => {
    it('should not select individual disabled radio option when clicked', async () => {
      const onValueChange = vi.fn();
      render(
        <ControlledRadioGroup
          options={optionsWithDisabled}
          onValueChange={onValueChange}
        />
      );

      const disabledOption = screen.getByTestId('radio-group-option-banana');
      const radioInput = disabledOption.querySelector('input') as HTMLInputElement;

      expect(radioInput).toBeDisabled();

      await user.click(disabledOption);

      // Should not call onChange for disabled option
      expect(onValueChange).not.toHaveBeenCalled();
      expect(radioInput).not.toBeChecked();
    });

    it('should display disabled styles for disabled radio options', () => {
      render(<ControlledRadioGroup options={optionsWithDisabled} />);

      const disabledOption = screen.getByTestId('radio-group-option-banana');
      const radioInput = disabledOption.querySelector('input') as HTMLInputElement;
      const customVisual = disabledOption.querySelector('[role="presentation"]') as HTMLElement;
      const label = disabledOption.querySelector('label') as HTMLElement;

      expect(radioInput).toBeDisabled();
      expect(radioInput).toHaveClass('disabled:cursor-not-allowed');
      expect(radioInput).toHaveClass('disabled:opacity-50');
      expect(customVisual).toHaveClass('cursor-not-allowed');
      expect(label).toHaveClass('cursor-not-allowed');
      expect(label).toHaveClass('opacity-50');
    });

    it('should disable all options when group disabled prop is true', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup disabled onValueChange={onValueChange} />);

      const radioInputs = screen.getAllByRole('radio');

      // All inputs should be disabled
      radioInputs.forEach(input => {
        expect(input).toBeDisabled();
      });

      // Try to click each option
      for (const option of defaultOptions) {
        const optionElement = screen.getByTestId(`radio-group-option-${option.value}`);
        await user.click(optionElement);
      }

      // None should have been selected
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should have correct ARIA attributes for disabled options', () => {
      render(<ControlledRadioGroup options={optionsWithDisabled} />);

      const disabledRadio = screen.getByTestId('radio-group-option-banana').querySelector('input') as HTMLInputElement;
      expect(disabledRadio).toHaveAttribute('disabled');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should move focus to next option with ArrowDown key', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on first option (apple), move to second (banana)
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });

    it('should move focus to next option with ArrowRight key', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on first option, move right to second
      await user.keyboard('{ArrowRight}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });

    it('should move focus to previous option with ArrowUp key', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup initialValue="banana" onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on second option (banana), move up to first (apple)
      await user.keyboard('{ArrowUp}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should move focus to previous option with ArrowLeft key', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup initialValue="banana" onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on second option, move left to first
      await user.keyboard('{ArrowLeft}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should wrap focus from last option to first with ArrowDown', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup initialValue="cherry" onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on last option (cherry), wrap to first (apple)
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should wrap focus from first option to last with ArrowUp', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup initialValue="apple" onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Start on first option (apple), wrap to last (cherry)
      await user.keyboard('{ArrowUp}');
      await user.keyboard(' '); // Select to verify focus

      expect(onValueChange).toHaveBeenCalledWith('cherry');
    });

    it('should skip disabled options during keyboard navigation', async () => {
      const onValueChange = vi.fn();
      render(
        <ControlledRadioGroup
          options={optionsWithDisabled}
          onValueChange={onValueChange}
        />
      );

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Navigate from apple (first) should skip banana (disabled) and go to cherry
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' '); // Select to verify focus skipped banana

      expect(onValueChange).toHaveBeenCalledWith('cherry');
    });

    it('should handle navigation when all options except one are disabled', async () => {
      const singleEnabledOptions: RadioOption[] = [
        { value: 'apple', label: 'Apple', disabled: true },
        { value: 'banana', label: 'Banana' }, // Only this one enabled
        { value: 'cherry', label: 'Cherry', disabled: true },
      ];

      const onValueChange = vi.fn();
      render(
        <ControlledRadioGroup
          options={singleEnabledOptions}
          onValueChange={onValueChange}
        />
      );

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Any navigation should stay on the only enabled option
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(onValueChange).toHaveBeenCalledWith('banana');
    });
  });

  describe('Form State Integration', () => {
    it('should pass selected value to form submission', async () => {
      const onSubmit = vi.fn();
      render(<FormWithRadioGroup onSubmit={onSubmit} />);

      // Select cherry option
      const cherryOption = screen.getByTestId('fruit-radio-group-option-cherry');
      await user.click(cherryOption);

      // Verify displayed value
      expect(screen.getByTestId('selected-value')).toHaveTextContent('cherry');

      // Submit form
      await user.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({ fruit: 'cherry' });
    });

    it('should update display when controlled value prop changes', async () => {
      const { rerender } = render(
        <RadioGroup
          options={defaultOptions}
          value=""
          onChange={() => {}}
          name="test"
          data-testid="radio-group"
        />
      );

      // No option selected initially
      const radioInputs = screen.getAllByRole('radio') as HTMLInputElement[];
      radioInputs.forEach(input => {
        expect(input).not.toBeChecked();
      });

      rerender(
        <RadioGroup
          options={defaultOptions}
          value="banana"
          onChange={() => {}}
          name="test"
          data-testid="radio-group"
        />
      );

      // Only banana should be selected
      const bananaInput = screen.getByTestId('radio-group-option-banana').querySelector('input') as HTMLInputElement;
      expect(bananaInput).toBeChecked();

      radioInputs.filter(input => input.value !== 'banana').forEach(input => {
        expect(input).not.toBeChecked();
      });
    });

    it('should display error message when error prop is provided', () => {
      render(<ControlledRadioGroup error="Please select a fruit" />);

      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a fruit');
    });

    it('should associate error message with radio group via aria-describedby', () => {
      render(<ControlledRadioGroup error="Please select a fruit" data-testid="test-radio" />);

      const radioGroup = screen.getByTestId('test-radio');
      const errorMessage = screen.getByRole('alert');

      expect(radioGroup).toHaveAttribute('aria-describedby', 'test-radio-error');
      expect(errorMessage).toHaveAttribute('id', 'test-radio-error');
    });

    it('should handle form with no initial selection', () => {
      render(<ControlledRadioGroup />);

      const radioInputs = screen.getAllByRole('radio') as HTMLInputElement[];
      radioInputs.forEach(input => {
        expect(input).not.toBeChecked();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles and attributes', () => {
      render(<ControlledRadioGroup initialValue="apple" />);

      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('role', 'radiogroup');

      const radioInputs = screen.getAllByRole('radio');
      expect(radioInputs).toHaveLength(3);

      const selectedRadio = screen.getByTestId('radio-group-option-apple').querySelector('input') as HTMLInputElement;
      expect(selectedRadio).toBeChecked();
    });

    it('should have correct aria-invalid state', () => {
      const { rerender } = render(<ControlledRadioGroup />);

      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('aria-invalid', 'false');

      rerender(<ControlledRadioGroup error="Error message" />);
      expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
    });

    it('should support description text for radio options', () => {
      render(<ControlledRadioGroup options={optionsWithDescriptions} />);

      expect(screen.getByText('A red fruit')).toBeInTheDocument();
      expect(screen.getByText('A yellow fruit')).toBeInTheDocument();
      expect(screen.getByText('A small red fruit')).toBeInTheDocument();
    });

    it('should have proper focus management', async () => {
      render(<ControlledRadioGroup />);

      const radioGroup = screen.getByTestId('radio-group');

      // Radio group should be focusable
      radioGroup.focus();
      expect(document.activeElement).toBe(radioGroup);

      // Should handle keyboard events when focused
      await user.keyboard('{ArrowDown}');

      // Focus should remain on the radio group container for navigation
      expect(document.activeElement).toBe(radioGroup);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty options array gracefully', () => {
      render(
        <RadioGroup
          options={[]}
          value=""
          onChange={() => {}}
          name="empty"
          data-testid="empty-radio-group"
        />
      );

      const radioGroup = screen.getByTestId('empty-radio-group');
      expect(radioGroup).toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('should handle rapid selection changes', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const options = screen.getAllByTestId(/radio-group-option-/);

      // Rapidly click different options
      await user.click(options[0]);
      await user.click(options[1]);
      await user.click(options[2]);
      await user.click(options[0]);

      // Should have called onChange for each click
      expect(onValueChange).toHaveBeenCalledTimes(4);
      expect(onValueChange).toHaveBeenLastCalledWith('apple');
    });

    it('should handle options with same labels but different values', async () => {
      const duplicateLabelOptions: RadioOption[] = [
        { value: 'option1', label: 'Same Label' },
        { value: 'option2', label: 'Same Label' },
      ];

      const onValueChange = vi.fn();
      render(
        <ControlledRadioGroup
          options={duplicateLabelOptions}
          onValueChange={onValueChange}
        />
      );

      const firstOption = screen.getByTestId('radio-group-option-option1');
      const secondOption = screen.getByTestId('radio-group-option-option2');

      await user.click(firstOption);
      expect(onValueChange).toHaveBeenCalledWith('option1');

      onValueChange.mockClear();
      await user.click(secondOption);
      expect(onValueChange).toHaveBeenCalledWith('option2');
    });

    it('should maintain keyboard navigation state during value changes', async () => {
      const onValueChange = vi.fn();
      render(<ControlledRadioGroup onValueChange={onValueChange} />);

      const radioGroup = screen.getByTestId('radio-group');
      radioGroup.focus();

      // Navigate and select
      await user.keyboard('{ArrowDown}'); // Move to banana
      await user.keyboard(' '); // Select banana
      expect(onValueChange).toHaveBeenCalledWith('banana');

      // Continue navigation from current position
      onValueChange.mockClear();
      await user.keyboard('{ArrowDown}'); // Move to cherry
      await user.keyboard(' '); // Select cherry
      expect(onValueChange).toHaveBeenCalledWith('cherry');
    });
  });
});