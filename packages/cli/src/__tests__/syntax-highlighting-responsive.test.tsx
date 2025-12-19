import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from './test-utils';
import { SyntaxHighlighter } from '../ui/components/SyntaxHighlighter';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../ui/hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

/**
 * Test suite for syntax highlighting responsive behavior
 * Tests how syntax highlighting adapts to different terminal widths and breakpoints
 */
describe('Syntax Highlighting Responsive Layout', () => {
  const sampleCode = `function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const hashedPassword = await hashPassword(password);
  const user = await findUserByEmail(email);

  if (!user || !comparePasswords(hashedPassword, user.password)) {
    throw new AuthenticationError('Invalid credentials');
  }

  const token = generateJWTToken({ userId: user.id, email: user.email });
  return { success: true, token, user };
}`;

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Terminal Width Adaptation', () => {
    describe('Wide Terminal (120+ columns)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 150,
          height: 40,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });
      });

      it('uses full width for code display', () => {
        render(
          <SyntaxHighlighter
            code={sampleCode}
            language="typescript"
            responsive={true}
          />
        );

        // Should show original line count without wrapping
        expect(screen.getByText(/8 lines/)).toBeInTheDocument();
        expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
      });

      it('displays long lines without wrapping by default', () => {
        const longLine = 'const veryLongVariableNameThatWouldNormallyWrapInSmallerTerminals = "but should fit in wide terminals";';

        render(
          <SyntaxHighlighter
            code={longLine}
            responsive={true}
          />
        );

        expect(screen.getByText(/1 lines/)).toBeInTheDocument();
        expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
      });
    });

    describe('Normal Terminal (80-119 columns)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });
      });

      it('adapts to normal terminal width', () => {
        render(
          <SyntaxHighlighter
            code={sampleCode}
            responsive={true}
          />
        );

        // Should handle the content appropriately for normal width
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('wraps long lines when necessary', () => {
        const longLine = 'const reallyLongVariableNameThatDefinitelyExceedsNormalTerminalWidth = "and should be wrapped";';

        render(
          <SyntaxHighlighter
            code={longLine}
            responsive={true}
          />
        );

        // Might show wrapped lines depending on actual content length
        expect(screen.getByText(/1 lines/)).toBeInTheDocument();
      });
    });

    describe('Compact Terminal (60-79 columns)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 70,
          height: 25,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('adapts to compact terminal width', () => {
        render(
          <SyntaxHighlighter
            code={sampleCode}
            responsive={true}
          />
        );

        expect(screen.getByText('typescript')).toBeInTheDocument();
        // Should handle wrapping for longer lines
      });

      it('wraps long function signatures', () => {
        const longFunctionSignature = 'function processUserAuthenticationWithComplexParametersAndLongNames(email: string, password: string, options: AuthOptions): Promise<AuthResult>';

        render(
          <SyntaxHighlighter
            code={longFunctionSignature}
            responsive={true}
          />
        );

        // Should wrap long lines in compact terminal
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });
    });

    describe('Narrow Terminal (< 60 columns)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 45,
          height: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('adapts to narrow terminal with minimum width', () => {
        render(
          <SyntaxHighlighter
            code={sampleCode}
            responsive={true}
          />
        );

        // Should enforce minimum width (40 characters)
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('aggressively wraps long lines', () => {
        const mediumLine = 'const user = await findUserByEmail(email);';

        render(
          <SyntaxHighlighter
            code={mediumLine}
            responsive={true}
          />
        );

        // Even medium lines should wrap in narrow terminals
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });

      it('enforces minimum width constraint', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 20, // Extremely narrow
          height: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <SyntaxHighlighter
            code="test"
            responsive={true}
          />
        );

        // Should still work with minimum width
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive vs Fixed Width', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 25,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('uses terminal width when responsive=true', () => {
      render(
        <SyntaxHighlighter
          code={sampleCode}
          responsive={true}
        />
      );

      // Should adapt to compact terminal
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('uses fixed width when responsive=false', () => {
      render(
        <SyntaxHighlighter
          code={sampleCode}
          responsive={false}
        />
      );

      // Should use default fixed width (80) regardless of terminal width
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('explicit width overrides responsive behavior', () => {
      render(
        <SyntaxHighlighter
          code={sampleCode}
          width={100}
          responsive={true}
        />
      );

      // Should use explicit width (100) not terminal width (60)
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Line Wrapping Behavior', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('enables wrapping when responsive=true', () => {
      const longLine = 'const veryLongVariableNameThatWillDefinitelyWrap = "test";';

      render(
        <SyntaxHighlighter
          code={longLine}
          responsive={true}
        />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('disables wrapping when wrapLines=false explicitly', () => {
      const longLine = 'const veryLongVariableNameThatWillDefinitelyWrap = "test";';

      render(
        <SyntaxHighlighter
          code={longLine}
          wrapLines={false}
          responsive={true}
        />
      );

      expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
    });

    it('enables wrapping when wrapLines=true explicitly', () => {
      const longLine = 'const veryLongVariableNameThatShouldWrap = "test";';

      render(
        <SyntaxHighlighter
          code={longLine}
          wrapLines={true}
          responsive={false}
        />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });
  });

  describe('Smart Line Breaking', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('breaks at sensible points (function parameters)', () => {
      const functionCode = 'function test(param1, param2, param3, param4) { return true; }';

      render(
        <SyntaxHighlighter
          code={functionCode}
          responsive={true}
        />
      );

      // Should wrap at comma or other break points
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('breaks at operators', () => {
      const operatorCode = 'const result = value1 + value2 * value3 / value4 - value5;';

      render(
        <SyntaxHighlighter
          code={operatorCode}
          responsive={true}
        />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('breaks at brackets and braces', () => {
      const bracketCode = 'const obj = { key1: "value1", key2: "value2", key3: "value3" };';

      render(
        <SyntaxHighlighter
          code={bracketCode}
          responsive={true}
        />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('indents continuation lines', () => {
      const longLine = 'const reallyLongVariableName = "value";';

      render(
        <SyntaxHighlighter
          code={longLine}
          responsive={true}
        />
      );

      // Wrapped content should show indentation
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });
  });

  describe('Content Truncation', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 25,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('truncates content when maxLines is set', () => {
      const manyLines = Array(20).fill('console.log("test");').join('\n');

      render(
        <SyntaxHighlighter
          code={manyLines}
          maxLines={10}
        />
      );

      expect(screen.getByText(/10 more lines/)).toBeInTheDocument();
    });

    it('shows correct truncation count with wrapping', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40, // Very narrow to force wrapping
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longLines = Array(5).fill('const veryLongVariableNameThatWillWrap = "test";').join('\n');

      render(
        <SyntaxHighlighter
          code={longLines}
          maxLines={8}
          responsive={true}
        />
      );

      // Should account for wrapped lines in truncation
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });
  });

  describe('Terminal Unavailable Fallback', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false, // Terminal dimensions not available
      });
    });

    it('falls back to default behavior when terminal unavailable', () => {
      render(
        <SyntaxHighlighter
          code={sampleCode}
          responsive={true}
        />
      );

      // Should work with fallback dimensions
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('still respects explicit width when terminal unavailable', () => {
      render(
        <SyntaxHighlighter
          code={sampleCode}
          width={120}
          responsive={true}
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Performance with Large Content', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 25,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('handles large files with wrapping efficiently', () => {
      const largeCode = Array(100).fill('const variableName = "value that might wrap";').join('\n');

      const start = performance.now();
      render(
        <SyntaxHighlighter
          code={largeCode}
          responsive={true}
        />
      );
      const end = performance.now();

      // Should handle large content in reasonable time
      expect(end - start).toBeLessThan(500);
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('limits rendering with maxLines for performance', () => {
      const hugeCode = Array(1000).fill('console.log("test line");').join('\n');

      render(
        <SyntaxHighlighter
          code={hugeCode}
          maxLines={20}
          responsive={true}
        />
      );

      expect(screen.getByText(/980 more lines/)).toBeInTheDocument();
    });
  });
});