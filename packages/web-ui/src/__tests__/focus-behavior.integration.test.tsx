/**
 * Integration tests for focus behavior on web UI form elements
 *
 * Tests verify focus behavior in React web components:
 * - Button component focus handling
 * - Focus ring application
 * - Keyboard navigation
 * - ARIA and accessibility features
 */

import React, { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Button } from '../components/ui/Button';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | null)[]) =>
    classes.filter(Boolean).join(' ')
}));

// Test form components
const TestForm: React.FC<{
  onSubmit?: (data: FormData) => void;
  'data-testid'?: string;
}> = ({ onSubmit, 'data-testid': testId }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    category: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData as any);
  };

  return (
    <form onSubmit={handleSubmit} data-testid={testId}>
      <div>
        <label htmlFor="name">Name:</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          data-testid={`${testId}-name`}
        />
      </div>
      <div>
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          data-testid={`${testId}-email`}
        />
      </div>
      <div>
        <label htmlFor="category">Category:</label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          data-testid={`${testId}-category`}
        >
          <option value="">Select...</option>
          <option value="feature">Feature Request</option>
          <option value="bug">Bug Report</option>
          <option value="question">Question</option>
        </select>
      </div>
      <div>
        <label htmlFor="message">Message:</label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          data-testid={`${testId}-message`}
          rows={4}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        data-testid={`${testId}-submit`}
      >
        Submit
      </Button>
    </form>
  );
};

const FocusTrackingComponent: React.FC<{
  'data-testid'?: string;
}> = ({ 'data-testid': testId }) => {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [focusHistory, setFocusHistory] = useState<string[]>([]);

  const handleFocus = (elementName: string) => {
    setFocusedElement(elementName);
    setFocusHistory(prev => [...prev, elementName]);
  };

  const handleBlur = () => {
    setFocusedElement(null);
  };

  return (
    <div data-testid={testId}>
      <input
        onFocus={() => handleFocus('input1')}
        onBlur={handleBlur}
        data-testid={`${testId}-input1`}
        placeholder="Input 1"
      />
      <input
        onFocus={() => handleFocus('input2')}
        onBlur={handleBlur}
        data-testid={`${testId}-input2`}
        placeholder="Input 2"
      />
      <Button
        onFocus={() => handleFocus('button1')}
        onBlur={handleBlur}
        data-testid={`${testId}-button1`}
      >
        Button 1
      </Button>
      <Button
        variant="secondary"
        onFocus={() => handleFocus('button2')}
        onBlur={handleBlur}
        data-testid={`${testId}-button2`}
      >
        Button 2
      </Button>
      <span data-testid={`${testId}-current-focus`}>
        {focusedElement || 'none'}
      </span>
      <span data-testid={`${testId}-focus-history`}>
        {focusHistory.join(',')}
      </span>
    </div>
  );
};

const AccessibilityTestComponent: React.FC<{
  'data-testid'?: string;
}> = ({ 'data-testid': testId }) => {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <div data-testid={testId}>
      <Button
        onClick={() => setIsVisible(!isVisible)}
        data-testid={`${testId}-toggle`}
        aria-label="Toggle content visibility"
      >
        Toggle Content
      </Button>

      {isVisible && (
        <div role="region" aria-label="Content area">
          <input
            aria-label="Name input"
            data-testid={`${testId}-name-input`}
            placeholder="Enter your name"
          />
          <Button
            variant="danger"
            data-testid={`${testId}-delete-button`}
            aria-label="Delete item"
          >
            Delete
          </Button>
        </div>
      )}

      <Button
        disabled
        data-testid={`${testId}-disabled-button`}
        aria-label="Disabled action"
      >
        Disabled Button
      </Button>
    </div>
  );
};

const KeyboardNavigationTest: React.FC<{
  'data-testid'?: string;
}> = ({ 'data-testid': testId }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const items = ['Home', 'About', 'Services', 'Contact'];

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (index + 1) % items.length;
        setActiveIndex(nextIndex);
        itemsRef.current[nextIndex]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = (index - 1 + items.length) % items.length;
        setActiveIndex(prevIndex);
        itemsRef.current[prevIndex]?.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        // Simulate click
        itemsRef.current[index]?.click();
        break;
    }
  };

  return (
    <div data-testid={testId} role="menu">
      {items.map((item, index) => (
        <Button
          key={item}
          ref={(el) => {
            itemsRef.current[index] = el;
          }}
          variant={index === activeIndex ? 'primary' : 'ghost'}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setActiveIndex(index)}
          data-testid={`${testId}-item-${index}`}
          role="menuitem"
          tabIndex={index === 0 ? 0 : -1}
        >
          {item}
        </Button>
      ))}
      <span data-testid={`${testId}-active-index`}>
        {activeIndex}
      </span>
    </div>
  );
};

describe('Web UI Focus Behavior Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.focus();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Button Component Focus Behavior', () => {
    it('should apply focus styles on Button component', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      render(
        <Button
          onFocus={onFocus}
          onBlur={onBlur}
          data-testid="focus-button"
        >
          Focus Test Button
        </Button>
      );

      const button = screen.getByTestId('focus-button');

      await act(async () => {
        fireEvent.focus(button);
      });

      expect(onFocus).toHaveBeenCalledTimes(1);
      // Button should have focus ring classes
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:ring-apex-500');

      await act(async () => {
        fireEvent.blur(button);
      });

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle different button variants with focus', async () => {
      const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;

      render(
        <div>
          {variants.map(variant => (
            <Button
              key={variant}
              variant={variant}
              data-testid={`button-${variant}`}
            >
              {variant} Button
            </Button>
          ))}
        </div>
      );

      for (const variant of variants) {
        const button = screen.getByTestId(`button-${variant}`);

        await act(async () => {
          fireEvent.focus(button);
        });

        // All variants should have consistent focus ring
        expect(button).toHaveClass('focus-visible:ring-2');
        expect(button).toHaveClass('focus-visible:ring-apex-500');

        await act(async () => {
          fireEvent.blur(button);
        });
      }
    });

    it('should prevent focus on disabled buttons', async () => {
      const onFocus = vi.fn();

      render(
        <Button
          disabled
          onFocus={onFocus}
          data-testid="disabled-button"
        >
          Disabled Button
        </Button>
      );

      const button = screen.getByTestId('disabled-button');

      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:cursor-not-allowed');

      // Attempt to focus disabled button
      await act(async () => {
        fireEvent.focus(button);
      });

      // Focus event should not fire for disabled button
      expect(onFocus).toHaveBeenCalledTimes(0);
    });

    it('should show loading state without affecting focus', async () => {
      const onFocus = vi.fn();

      render(
        <Button
          loading
          onFocus={onFocus}
          data-testid="loading-button"
        >
          Loading Button
        </Button>
      );

      const button = screen.getByTestId('loading-button');

      expect(button).toBeDisabled();
      expect(screen.getByRole('button')).toBeInTheDocument();

      // Loading buttons should be disabled and not focusable
      await act(async () => {
        fireEvent.focus(button);
      });

      expect(onFocus).toHaveBeenCalledTimes(0);
    });
  });

  describe('Form Focus Flow', () => {
    it('should handle tab navigation through form elements', async () => {
      const onSubmit = vi.fn();

      render(<TestForm onSubmit={onSubmit} data-testid="test-form" />);

      const nameInput = screen.getByTestId('test-form-name');
      const emailInput = screen.getByTestId('test-form-email');
      const categorySelect = screen.getByTestId('test-form-category');
      const messageTextarea = screen.getByTestId('test-form-message');
      const submitButton = screen.getByTestId('test-form-submit');

      // Tab through form elements
      await act(async () => {
        fireEvent.focus(nameInput);
      });
      expect(document.activeElement).toBe(nameInput);

      // Simulate tab navigation
      await act(async () => {
        fireEvent.keyDown(nameInput, { key: 'Tab' });
        fireEvent.focus(emailInput);
      });
      expect(document.activeElement).toBe(emailInput);

      await act(async () => {
        fireEvent.keyDown(emailInput, { key: 'Tab' });
        fireEvent.focus(categorySelect);
      });
      expect(document.activeElement).toBe(categorySelect);

      await act(async () => {
        fireEvent.keyDown(categorySelect, { key: 'Tab' });
        fireEvent.focus(messageTextarea);
      });
      expect(document.activeElement).toBe(messageTextarea);

      await act(async () => {
        fireEvent.keyDown(messageTextarea, { key: 'Tab' });
        fireEvent.focus(submitButton);
      });
      expect(document.activeElement).toBe(submitButton);
    });

    it('should handle form submission via keyboard', async () => {
      const onSubmit = vi.fn();

      render(<TestForm onSubmit={onSubmit} data-testid="test-form" />);

      const submitButton = screen.getByTestId('test-form-submit');

      await act(async () => {
        fireEvent.focus(submitButton);
      });

      // Submit with Enter key
      await act(async () => {
        fireEvent.keyDown(submitButton, { key: 'Enter' });
        fireEvent.click(submitButton);
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus Tracking and State Management', () => {
    it('should track focus state across multiple elements', async () => {
      render(<FocusTrackingComponent data-testid="focus-tracker" />);

      const input1 = screen.getByTestId('focus-tracker-input1');
      const input2 = screen.getByTestId('focus-tracker-input2');
      const button1 = screen.getByTestId('focus-tracker-button1');
      const button2 = screen.getByTestId('focus-tracker-button2');
      const currentFocus = screen.getByTestId('focus-tracker-current-focus');
      const focusHistory = screen.getByTestId('focus-tracker-focus-history');

      expect(currentFocus).toHaveTextContent('none');
      expect(focusHistory).toHaveTextContent('');

      // Focus input1
      await act(async () => {
        fireEvent.focus(input1);
      });

      expect(currentFocus).toHaveTextContent('input1');
      expect(focusHistory).toHaveTextContent('input1');

      // Focus button1
      await act(async () => {
        fireEvent.focus(button1);
      });

      expect(currentFocus).toHaveTextContent('button1');
      expect(focusHistory).toHaveTextContent('input1,button1');

      // Focus input2
      await act(async () => {
        fireEvent.focus(input2);
      });

      expect(currentFocus).toHaveTextContent('input2');
      expect(focusHistory).toHaveTextContent('input1,button1,input2');

      // Blur current element
      await act(async () => {
        fireEvent.blur(input2);
      });

      expect(currentFocus).toHaveTextContent('none');
      expect(focusHistory).toHaveTextContent('input1,button1,input2');
    });
  });

  describe('Accessibility and ARIA Integration', () => {
    it('should handle focus with proper ARIA attributes', async () => {
      render(<AccessibilityTestComponent data-testid="a11y-test" />);

      const toggleButton = screen.getByTestId('a11y-test-toggle');
      const nameInput = screen.getByTestId('a11y-test-name-input');
      const deleteButton = screen.getByTestId('a11y-test-delete-button');
      const disabledButton = screen.getByTestId('a11y-test-disabled-button');

      // Check ARIA attributes
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle content visibility');
      expect(nameInput).toHaveAttribute('aria-label', 'Name input');
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete item');
      expect(disabledButton).toHaveAttribute('aria-label', 'Disabled action');

      // Focus elements and check accessibility
      await act(async () => {
        fireEvent.focus(toggleButton);
      });

      expect(document.activeElement).toBe(toggleButton);

      await act(async () => {
        fireEvent.focus(nameInput);
      });

      expect(document.activeElement).toBe(nameInput);

      // Disabled button should not be focusable
      expect(disabledButton).toBeDisabled();
    });

    it('should handle dynamic content visibility and focus', async () => {
      render(<AccessibilityTestComponent data-testid="a11y-test" />);

      const toggleButton = screen.getByTestId('a11y-test-toggle');

      // Initial state - content is visible
      expect(screen.getByTestId('a11y-test-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('a11y-test-delete-button')).toBeInTheDocument();

      // Hide content
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      // Content should be hidden
      expect(screen.queryByTestId('a11y-test-name-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('a11y-test-delete-button')).not.toBeInTheDocument();

      // Show content again
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      // Content should be visible again
      expect(screen.getByTestId('a11y-test-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('a11y-test-delete-button')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation Patterns', () => {
    it('should handle arrow key navigation in menu-like components', async () => {
      render(<KeyboardNavigationTest data-testid="keyboard-nav" />);

      const items = [0, 1, 2, 3].map(i =>
        screen.getByTestId(`keyboard-nav-item-${i}`)
      );
      const activeIndex = screen.getByTestId('keyboard-nav-active-index');

      // Start with first item
      expect(activeIndex).toHaveTextContent('0');

      // Focus first item
      await act(async () => {
        fireEvent.focus(items[0]);
      });

      // Navigate down with arrow key
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      });

      expect(activeIndex).toHaveTextContent('1');

      // Navigate down again
      await act(async () => {
        fireEvent.keyDown(items[1], { key: 'ArrowDown' });
      });

      expect(activeIndex).toHaveTextContent('2');

      // Navigate up
      await act(async () => {
        fireEvent.keyDown(items[2], { key: 'ArrowUp' });
      });

      expect(activeIndex).toHaveTextContent('1');

      // Navigate to last item and wrap around
      await act(async () => {
        fireEvent.keyDown(items[1], { key: 'ArrowDown' });
      });
      expect(activeIndex).toHaveTextContent('2');

      await act(async () => {
        fireEvent.keyDown(items[2], { key: 'ArrowDown' });
      });
      expect(activeIndex).toHaveTextContent('3');

      await act(async () => {
        fireEvent.keyDown(items[3], { key: 'ArrowDown' });
      });
      expect(activeIndex).toHaveTextContent('0'); // Should wrap to beginning
    });

    it('should handle Enter and Space key activation', async () => {
      const onItemClick = vi.fn();

      const TestMenuComponent: React.FC = () => {
        const handleClick = (item: string) => {
          onItemClick(item);
        };

        return (
          <div>
            <Button
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick('item1');
                }
              }}
              onClick={() => handleClick('item1')}
              data-testid="menu-item-1"
            >
              Item 1
            </Button>
          </div>
        );
      };

      render(<TestMenuComponent />);

      const menuItem = screen.getByTestId('menu-item-1');

      await act(async () => {
        fireEvent.focus(menuItem);
      });

      // Activate with Enter key
      await act(async () => {
        fireEvent.keyDown(menuItem, { key: 'Enter' });
      });

      expect(onItemClick).toHaveBeenCalledWith('item1');

      // Activate with Space key
      await act(async () => {
        fireEvent.keyDown(menuItem, { key: ' ' });
      });

      expect(onItemClick).toHaveBeenCalledTimes(2);
      expect(onItemClick).toHaveBeenLastCalledWith('item1');
    });
  });

  describe('Focus Ring and Visual Styling', () => {
    it('should apply consistent focus ring styles across components', async () => {
      render(
        <div>
          <Button variant="primary" data-testid="primary-button">Primary</Button>
          <Button variant="secondary" data-testid="secondary-button">Secondary</Button>
          <Button variant="ghost" data-testid="ghost-button">Ghost</Button>
          <Button variant="danger" data-testid="danger-button">Danger</Button>
        </div>
      );

      const buttons = [
        screen.getByTestId('primary-button'),
        screen.getByTestId('secondary-button'),
        screen.getByTestId('ghost-button'),
        screen.getByTestId('danger-button'),
      ];

      for (const button of buttons) {
        // Check that all buttons have consistent focus ring styles
        expect(button).toHaveClass('focus-visible:outline-none');
        expect(button).toHaveClass('focus-visible:ring-2');
        expect(button).toHaveClass('focus-visible:ring-apex-500');
        expect(button).toHaveClass('focus-visible:ring-offset-2');
        expect(button).toHaveClass('focus-visible:ring-offset-background');

        await act(async () => {
          fireEvent.focus(button);
        });

        // Focus should be applied
        expect(document.activeElement).toBe(button);

        await act(async () => {
          fireEvent.blur(button);
        });
      }
    });
  });
});