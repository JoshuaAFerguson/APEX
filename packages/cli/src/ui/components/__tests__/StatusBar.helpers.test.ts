import { describe, it, expect } from 'vitest';

// Since the helper functions are not exported, we need to test them indirectly
// by examining the behavior through the StatusBar component output.
// However, we can create isolated unit tests by extracting the logic.

// Helper function implementations for testing (copied from StatusBar.tsx)
type AbbreviationMode = 'full' | 'abbreviated' | 'auto';

interface TestSegment {
  icon?: string;
  iconColor?: string;
  label?: string;
  abbreviatedLabel?: string;
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
}

function getEffectiveLabel(
  segment: TestSegment,
  abbreviationMode: AbbreviationMode,
  terminalWidth: number
): string | undefined {
  if (!segment.label) return undefined;

  const useAbbreviated =
    abbreviationMode === 'abbreviated' ||
    (abbreviationMode === 'auto' && terminalWidth < 80);
  // terminalWidth >= 80 uses full labels in auto mode

  if (useAbbreviated && segment.abbreviatedLabel != null) {
    // Empty string abbreviation means no label should be shown when abbreviated
    return segment.abbreviatedLabel === '' ? undefined : segment.abbreviatedLabel;
  }

  return segment.label;
}

function calculateMinWidth(
  segment: TestSegment,
  useAbbreviated: boolean
): number {
  const labelLength = useAbbreviated
    ? (segment.abbreviatedLabel?.length ?? segment.label?.length ?? 0)
    : (segment.label?.length ?? 0);

  const valueLength = segment.value.length;
  const iconLength = segment.icon ? segment.icon.length + 1 : 0;

  return labelLength + valueLength + iconLength;
}

describe('StatusBar Helper Functions', () => {
  describe('getEffectiveLabel', () => {
    describe('abbreviation mode handling', () => {
      it('returns full label when mode is "full"', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'full', 70);
        expect(result).toBe('tokens:');
      });

      it('returns abbreviated label when mode is "abbreviated"', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'abbreviated', 120);
        expect(result).toBe('tok:');
      });

      it('returns full label in auto mode when terminal width >= 80', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 80);
        expect(result).toBe('tokens:');
      });

      it('returns abbreviated label in auto mode when terminal width < 80', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 79);
        expect(result).toBe('tok:');
      });
    });

    describe('boundary conditions', () => {
      it('handles exactly 80 columns correctly', () => {
        const segment: TestSegment = {
          label: 'model:',
          abbreviatedLabel: 'mod:',
          value: 'opus',
          valueColor: 'blue',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 80);
        expect(result).toBe('model:'); // >= 80 should use full labels
      });

      it('handles 79 columns correctly', () => {
        const segment: TestSegment = {
          label: 'model:',
          abbreviatedLabel: 'mod:',
          value: 'opus',
          valueColor: 'blue',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 79);
        expect(result).toBe('mod:'); // < 80 should use abbreviated labels
      });
    });

    describe('missing label handling', () => {
      it('returns undefined when segment has no label', () => {
        const segment: TestSegment = {
          value: 'main',
          valueColor: 'yellow',
          minWidth: 5,
        };

        const result = getEffectiveLabel(segment, 'full', 120);
        expect(result).toBeUndefined();
      });

      it('returns undefined when segment has empty label', () => {
        const segment: TestSegment = {
          label: '',
          value: 'main',
          valueColor: 'yellow',
          minWidth: 5,
        };

        const result = getEffectiveLabel(segment, 'full', 120);
        expect(result).toBeUndefined();
      });
    });

    describe('abbreviatedLabel edge cases', () => {
      it('returns full label when abbreviatedLabel is undefined', () => {
        const segment: TestSegment = {
          label: 'custom:',
          // abbreviatedLabel is undefined
          value: 'value',
          valueColor: 'white',
          minWidth: 8,
        };

        const result = getEffectiveLabel(segment, 'abbreviated', 120);
        expect(result).toBe('custom:');
      });

      it('returns undefined when abbreviatedLabel is empty string', () => {
        const segment: TestSegment = {
          label: 'cost:',
          abbreviatedLabel: '', // Empty string means no label when abbreviated
          value: '$0.1234',
          valueColor: 'green',
          minWidth: 8,
        };

        const result = getEffectiveLabel(segment, 'abbreviated', 120);
        expect(result).toBeUndefined();
      });

      it('handles null abbreviatedLabel gracefully', () => {
        const segment: TestSegment = {
          label: 'test:',
          abbreviatedLabel: null as any, // Edge case
          value: 'value',
          valueColor: 'white',
          minWidth: 8,
        };

        const result = getEffectiveLabel(segment, 'abbreviated', 120);
        expect(result).toBe('test:'); // Should fallback to full label
      });
    });

    describe('extreme terminal widths', () => {
      it('handles very narrow terminal (1 column)', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 1);
        expect(result).toBe('tok:');
      });

      it('handles zero terminal width', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 0);
        expect(result).toBe('tok:');
      });

      it('handles very wide terminal', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 10,
        };

        const result = getEffectiveLabel(segment, 'auto', 1000);
        expect(result).toBe('tokens:');
      });
    });
  });

  describe('calculateMinWidth', () => {
    describe('basic width calculations', () => {
      it('calculates width with icon, label, and value', () => {
        const segment: TestSegment = {
          icon: '⚡',
          label: 'agent:',
          abbreviatedLabel: 'agt:',
          value: 'planner',
          valueColor: 'white',
          minWidth: 0, // Will be calculated
        };

        const width = calculateMinWidth(segment, false); // Use full label
        // Icon (1) + space (1) + label (6) + value (7) = 15
        expect(width).toBe(15);
      });

      it('calculates width with abbreviated label', () => {
        const segment: TestSegment = {
          icon: '⚡',
          label: 'agent:',
          abbreviatedLabel: 'agt:',
          value: 'planner',
          valueColor: 'white',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, true); // Use abbreviated label
        // Icon (1) + space (1) + abbreviated label (4) + value (7) = 13
        expect(width).toBe(13);
      });

      it('calculates width without icon', () => {
        const segment: TestSegment = {
          label: 'tokens:',
          abbreviatedLabel: 'tok:',
          value: '800',
          valueColor: 'cyan',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, false);
        // Label (7) + value (3) = 10
        expect(width).toBe(10);

        const widthAbbreviated = calculateMinWidth(segment, true);
        // Abbreviated label (4) + value (3) = 7
        expect(widthAbbreviated).toBe(7);
      });

      it('calculates width without label', () => {
        const segment: TestSegment = {
          icon: '●',
          value: 'connected',
          valueColor: 'green',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, false);
        // Icon (1) + space (1) + value (9) = 11
        expect(width).toBe(11);
      });

      it('calculates width with only value', () => {
        const segment: TestSegment = {
          value: 'main',
          valueColor: 'yellow',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, false);
        // Value (4) = 4
        expect(width).toBe(4);
      });
    });

    describe('edge cases', () => {
      it('handles empty strings correctly', () => {
        const segment: TestSegment = {
          icon: '',
          label: '',
          abbreviatedLabel: '',
          value: '',
          valueColor: 'white',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, false);
        expect(width).toBe(0);
      });

      it('handles undefined abbreviatedLabel when abbreviated mode requested', () => {
        const segment: TestSegment = {
          label: 'custom:',
          // abbreviatedLabel is undefined
          value: 'value',
          valueColor: 'white',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, true);
        // Should fallback to full label length: custom: (7) + value (5) = 12
        expect(width).toBe(12);
      });

      it('handles empty abbreviatedLabel correctly', () => {
        const segment: TestSegment = {
          label: 'cost:',
          abbreviatedLabel: '', // Empty abbreviation
          value: '$0.1234',
          valueColor: 'green',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, true);
        // Empty abbreviation (0) + value (7) = 7
        expect(width).toBe(7);
      });

      it('handles missing label and abbreviatedLabel', () => {
        const segment: TestSegment = {
          icon: '●',
          value: 'status',
          valueColor: 'green',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, true);
        // Icon (1) + space (1) + value (6) = 8
        expect(width).toBe(8);
      });

      it('handles unicode icons correctly', () => {
        const segment: TestSegment = {
          icon: '🔍', // Multi-byte unicode character
          label: 'mode:',
          value: 'verbose',
          valueColor: 'cyan',
          minWidth: 0,
        };

        const width = calculateMinWidth(segment, false);
        // Unicode icon (2 bytes but .length = 2) + space (1) + label (5) + value (7) = 15
        expect(width).toBe(15);
      });
    });

    describe('comparison between full and abbreviated', () => {
      it('abbreviated width should be less than or equal to full width', () => {
        const testCases: TestSegment[] = [
          {
            label: 'tokens:',
            abbreviatedLabel: 'tok:',
            value: '800',
            valueColor: 'cyan',
            minWidth: 0,
          },
          {
            label: 'model:',
            abbreviatedLabel: 'mod:',
            value: 'opus',
            valueColor: 'blue',
            minWidth: 0,
          },
          {
            label: 'session:',
            abbreviatedLabel: 'sess:',
            value: '$1.2345',
            valueColor: 'yellow',
            minWidth: 0,
          },
          {
            label: 'active:',
            abbreviatedLabel: 'act:',
            value: '2m30s',
            valueColor: 'green',
            minWidth: 0,
          },
        ];

        testCases.forEach((segment) => {
          const fullWidth = calculateMinWidth(segment, false);
          const abbreviatedWidth = calculateMinWidth(segment, true);
          expect(abbreviatedWidth).toBeLessThanOrEqual(fullWidth);
        });
      });

      it('handles equal length labels correctly', () => {
        const segment: TestSegment = {
          label: 'api:',
          abbreviatedLabel: 'api:', // Same as full label
          value: '4000',
          valueColor: 'green',
          minWidth: 0,
        };

        const fullWidth = calculateMinWidth(segment, false);
        const abbreviatedWidth = calculateMinWidth(segment, true);
        expect(fullWidth).toBe(abbreviatedWidth);
      });
    });

    describe('real-world scenarios', () => {
      it('calculates correct widths for common StatusBar segments', () => {
        const scenarios = [
          {
            name: 'Token counter',
            segment: {
              label: 'tokens:',
              abbreviatedLabel: 'tok:',
              value: '1.5k',
              valueColor: 'cyan',
              minWidth: 0,
            },
            expectedFull: 11, // tokens: (7) + 1.5k (4) = 11
            expectedAbbreviated: 8, // tok: (4) + 1.5k (4) = 8
          },
          {
            name: 'Cost display',
            segment: {
              label: 'cost:',
              abbreviatedLabel: '',
              value: '$0.1234',
              valueColor: 'green',
              minWidth: 0,
            },
            expectedFull: 12, // cost: (5) + $0.1234 (7) = 12
            expectedAbbreviated: 7, // empty (0) + $0.1234 (7) = 7
          },
          {
            name: 'Model name',
            segment: {
              label: 'model:',
              abbreviatedLabel: 'mod:',
              value: 'opus',
              valueColor: 'blue',
              minWidth: 0,
            },
            expectedFull: 10, // model: (6) + opus (4) = 10
            expectedAbbreviated: 8, // mod: (4) + opus (4) = 8
          },
        ];

        scenarios.forEach(({ name, segment, expectedFull, expectedAbbreviated }) => {
          const fullWidth = calculateMinWidth(segment, false);
          const abbreviatedWidth = calculateMinWidth(segment, true);

          expect(fullWidth).toBe(expectedFull);
          expect(abbreviatedWidth).toBe(expectedAbbreviated);
        });
      });
    });
  });
});
