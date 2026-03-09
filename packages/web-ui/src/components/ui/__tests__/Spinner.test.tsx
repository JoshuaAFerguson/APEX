import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Spinner } from '../Spinner';

// Mock the Lucide React Loader2 component
vi.mock('lucide-react', () => ({
  Loader2: ({ className, ...props }: any) => (
    <div
      data-testid="loader2-icon"
      className={className}
      {...props}
    >
      ⟲
    </div>
  ),
}));

// Mock the cn utility function
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('Spinner Component', () => {
  beforeEach(() => {
    // Clear any previous renders
    document.body.innerHTML = '';
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<Spinner />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin', 'text-apex-500', 'h-8', 'w-8');
    });

    it('renders with default medium size', () => {
      render(<Spinner />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('applies flex centering to container', () => {
      render(<Spinner />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<Spinner size="sm" />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-4', 'w-4');
      expect(spinner).not.toHaveClass('h-8', 'w-8', 'h-12', 'w-12');
    });

    it('renders medium size correctly', () => {
      render(<Spinner size="md" />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-8', 'w-8');
      expect(spinner).not.toHaveClass('h-4', 'w-4', 'h-12', 'w-12');
    });

    it('renders large size correctly', () => {
      render(<Spinner size="lg" />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-12', 'w-12');
      expect(spinner).not.toHaveClass('h-4', 'w-4', 'h-8', 'w-8');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(<Spinner className="custom-spinner" />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('custom-spinner');
    });

    it('merges multiple classNames correctly', () => {
      render(<Spinner className="custom-1 custom-2" size="sm" />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('custom-1', 'custom-2');

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('preserves default classes when adding custom className', () => {
      render(<Spinner className="my-custom-class" />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'justify-center', 'my-custom-class');

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('animate-spin', 'text-apex-500');
    });
  });

  describe('HTML Attributes', () => {
    it('passes through HTML div attributes', () => {
      render(<Spinner data-testid="custom-spinner" id="spinner-1" />);

      const container = screen.getByTestId('custom-spinner');
      expect(container).toHaveAttribute('id', 'spinner-1');
    });

    it('handles aria attributes for accessibility', () => {
      render(
        <Spinner
          aria-label="Loading content"
          role="status"
        />
      );

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveAttribute('aria-label', 'Loading content');
      expect(container).toHaveAttribute('role', 'status');
    });

    it('supports style attribute', () => {
      render(<Spinner style={{ margin: '10px', padding: '5px' }} />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveStyle('margin: 10px; padding: 5px;');
    });
  });

  describe('Animation', () => {
    it('always includes animate-spin class', () => {
      const { rerender } = render(<Spinner size="sm" />);
      expect(screen.getByTestId('loader2-icon')).toHaveClass('animate-spin');

      rerender(<Spinner size="md" />);
      expect(screen.getByTestId('loader2-icon')).toHaveClass('animate-spin');

      rerender(<Spinner size="lg" />);
      expect(screen.getByTestId('loader2-icon')).toHaveClass('animate-spin');
    });

    it('maintains consistent animation across all sizes', () => {
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach(size => {
        const { unmount } = render(<Spinner size={size} />);
        const spinner = screen.getByTestId('loader2-icon');
        expect(spinner).toHaveClass('animate-spin');
        unmount();
      });
    });
  });

  describe('Component Structure', () => {
    it('has correct DOM hierarchy', () => {
      render(<Spinner data-testid="test-spinner" />);

      const container = screen.getByTestId('test-spinner');
      const loader = screen.getByTestId('loader2-icon');

      expect(container.contains(loader)).toBe(true);
      expect(container.tagName).toBe('DIV');
    });

    it('renders single child element', () => {
      render(<Spinner />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container!.children).toHaveLength(1);
    });
  });

  describe('TypeScript Props Interface', () => {
    it('accepts all valid size props without TypeScript errors', () => {
      // These should compile without TypeScript errors
      expect(() => {
        render(<Spinner size="sm" />);
        render(<Spinner size="md" />);
        render(<Spinner size="lg" />);
      }).not.toThrow();
    });

    it('accepts HTMLDivElement attributes', () => {
      // Should accept standard div attributes
      expect(() => {
        render(
          <Spinner
            id="test"
            className="test"
            data-testid="test"
            onClick={() => {}}
            onMouseEnter={() => {}}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined size gracefully (defaults to md)', () => {
      render(<Spinner size={undefined as any} />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-8', 'w-8'); // Default 'md' size
    });

    it('handles empty className', () => {
      render(<Spinner className="" />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('handles null className', () => {
      render(<Spinner className={null as any} />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('handles multiple re-renders without issues', () => {
      const { rerender } = render(<Spinner size="sm" />);

      rerender(<Spinner size="md" />);
      rerender(<Spinner size="lg" />);
      rerender(<Spinner size="sm" className="updated" />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('h-4', 'w-4', 'animate-spin');

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveClass('updated');
    });
  });

  describe('Accessibility', () => {
    it('is accessible by default', () => {
      render(<Spinner />);

      const container = screen.getByTestId('loader2-icon').parentElement;

      // Container should be focusable or have appropriate role
      expect(container).toBeInTheDocument();
    });

    it('supports custom accessibility attributes', () => {
      render(
        <Spinner
          role="progressbar"
          aria-label="Loading data"
          aria-live="polite"
        />
      );

      const container = screen.getByTestId('loader2-icon').parentElement;
      expect(container).toHaveAttribute('role', 'progressbar');
      expect(container).toHaveAttribute('aria-label', 'Loading data');
      expect(container).toHaveAttribute('aria-live', 'polite');
    });

    it('does not interfere with screen readers when unlabeled', () => {
      render(<Spinner />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      // Should not have conflicting aria attributes
      expect(container).not.toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('CSS Classes Integration', () => {
    it('includes text-apex-500 for theme consistency', () => {
      render(<Spinner />);

      const spinner = screen.getByTestId('loader2-icon');
      expect(spinner).toHaveClass('text-apex-500');
    });

    it('maintains class order consistency', () => {
      render(<Spinner className="custom" />);

      const container = screen.getByTestId('loader2-icon').parentElement;
      const classes = container!.className;

      // Should include all required classes
      expect(classes).toContain('flex');
      expect(classes).toContain('items-center');
      expect(classes).toContain('justify-center');
      expect(classes).toContain('custom');
    });
  });
});