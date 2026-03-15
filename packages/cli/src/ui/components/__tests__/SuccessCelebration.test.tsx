import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SuccessCelebration,
  Milestone,
  ProgressCelebration,
  QuickSuccess,
} from '../SuccessCelebration';

// Mock TypewriterText component
vi.mock('../StreamingText.js', () => ({
  TypewriterText: ({ text, color, bold }: any) => (
    <span data-testid="typewriter-text" style={{ color, fontWeight: bold ? 'bold' : 'normal' }}>
      {text}
    </span>
  ),
}));

// Helper function to check if element exists
const elementExists = (text: string | RegExp) => {
  try {
    screen.getByText(text);
    return true;
  } catch {
    return false;
  }
};

// Helper function to check if element doesn't exist
const elementNotExists = (text: string | RegExp) => {
  try {
    return screen.queryByText(text) === null;
  } catch {
    return true;
  }
};

describe('SuccessCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should render success message', async () => {
    render(
      <SuccessCelebration
        message="Test completed successfully!"
        showAnimation={false}
      />
    );

    expect(elementExists('Test completed successfully!')).toBe(true);
    // Ink renders text with emojis inline, use regex to match
    expect(elementExists(/Task Completed!/)).toBe(true);
  });

  it('should render different titles based on type', () => {
    const { rerender } = render(
      <SuccessCelebration type="milestone" showAnimation={false} />
    );
    // Ink renders text with emojis inline, use regex to match
    expect(elementExists(/Milestone Achieved!/)).toBe(true);

    rerender(<SuccessCelebration type="achievement" showAnimation={false} />);
    expect(elementExists(/Achievement Unlocked!/)).toBe(true);

    rerender(<SuccessCelebration type="simple" showAnimation={false} />);
    expect(elementExists(/Success!/)).toBe(true);
  });

  it('should display performance stats when provided', () => {
    const data = {
      tokensUsed: 1500,
      timeTaken: '2.5s',
      cost: '$0.05',
      filesChanged: 3,
      linesAdded: 150,
      linesRemoved: 25,
    };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(elementExists('Performance Summary')).toBe(true);
    expect(elementExists('Duration:')).toBe(true);
    expect(elementExists('2.5s')).toBe(true);
    expect(elementExists('Tokens Used:')).toBe(true);
    expect(elementExists('1,500')).toBe(true);
    expect(elementExists('Cost:')).toBe(true);
    expect(elementExists('$0.05')).toBe(true);
    expect(elementExists('Files Changed:')).toBe(true);
    expect(elementExists('3')).toBe(true);
    expect(elementExists('Lines:')).toBe(true);
    expect(elementExists('+150')).toBe(true);
    expect(elementExists('-25')).toBe(true);
  });

  it('should call onComplete after duration', () => {
    const mockOnComplete = vi.fn();

    render(
      <SuccessCelebration
        duration={1000}
        onComplete={mockOnComplete}
        showAnimation={false}
      />
    );

    expect(mockOnComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should show animation frames when animation is enabled', () => {
    render(
      <SuccessCelebration
        type="task"
        showAnimation={true}
      />
    );

    // Animation should start - use getAllByText since emojis appear in multiple places
    const emojis = screen.getAllByText(/🎉|✨|🎊|✅|💫|⭐|🌟|🎈|🎆/);
    expect(emojis.length).toBeGreaterThan(0);
  });

  it('should skip animation when disabled', () => {
    const mockOnComplete = vi.fn();

    render(
      <SuccessCelebration
        showAnimation={false}
        duration={1000}
        onComplete={mockOnComplete}
      />
    );

    // Should immediately show stats (with emojis inline)
    expect(elementExists(/Task Completed!/)).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should handle partial stats data', () => {
    const data = {
      tokensUsed: 1000,
      cost: '$0.02',
    };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(elementExists('1,000')).toBe(true);
    expect(elementExists('$0.02')).toBe(true);
    expect(elementNotExists('Duration:')).toBe(true);
    expect(elementNotExists('Files Changed:')).toBe(true);
  });

  it('should show only lines added when no lines removed', () => {
    const data = { linesAdded: 100 };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(elementExists('+100')).toBe(true);
    expect(elementNotExists(/^-/)).toBe(true);
  });

  it('should show only lines removed when no lines added', () => {
    const data = { linesRemoved: 50 };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(elementExists('-50')).toBe(true);
    expect(elementNotExists(/^\+/)).toBe(true);
  });
});

describe('Milestone', () => {
  it('should render milestone with title and description', () => {
    render(
      <Milestone
        title="First Deployment"
        description="Successfully deployed your first application"
      />
    );

    expect(elementExists('First Deployment')).toBe(true);
    expect(elementExists('Successfully deployed your first application')).toBe(true);
  });

  it('should render custom icon', () => {
    render(
      <Milestone
        title="Custom Achievement"
        description="Test achievement"
        icon="🚀"
      />
    );

    expect(screen.getAllByText('🚀')).toHaveLength(2); // Icon appears twice
  });

  it('should show rarity badges correctly', () => {
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    const expectedTexts = [
      '🏅 ACHIEVEMENT 🏅',
      '⭐ RARE ⭐',
      '💎 EPIC 💎',
      '✨ LEGENDARY ✨',
    ];

    rarities.forEach((rarity, index) => {
      const { unmount } = render(
        <Milestone
          title="Test"
          description="Test"
          rarity={rarity}
          showBadge={true}
        />
      );

      expect(elementExists(expectedTexts[index])).toBe(true);
      unmount();
    });
  });

  it('should hide badge when showBadge is false', () => {
    render(
      <Milestone
        title="Hidden Badge"
        description="Test achievement"
        showBadge={false}
      />
    );

    expect(elementNotExists(/ACHIEVEMENT|RARE|EPIC|LEGENDARY/)).toBe(true);
  });
});

describe('ProgressCelebration', () => {
  let usingFakeTimers = true;

  beforeEach(() => {
    usingFakeTimers = true;
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
  });

  afterEach(() => {
    if (usingFakeTimers) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    vi.restoreAllMocks();
  });

  it('should render progress celebration message', () => {
    act(() => {
      render(
        <ProgressCelebration
          previousProgress={50}
          newProgress={75}
          message="Quarter milestone reached!"
        />
      );
    });

    expect(elementExists('🎯 Quarter milestone reached!')).toBe(true);
    expect(elementExists(/Progress: \d+%/)).toBe(true);
  });

  it('should show progress bar when enabled', () => {
    act(() => {
      render(
        <ProgressCelebration
          previousProgress={25}
          newProgress={50}
          showProgressBar={true}
        />
      );
    });

    expect(elementExists(/Progress: \d+%/)).toBe(true);
    // Progress bar should be rendered with filled and unfilled blocks - multiple elements
    const blocks = screen.getAllByText(/█|░/);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('should hide progress bar when disabled', () => {
    act(() => {
      render(
        <ProgressCelebration
          previousProgress={25}
          newProgress={50}
          showProgressBar={false}
        />
      );
    });

    expect(elementNotExists(/Progress: \d+%/)).toBe(true);
    expect(elementNotExists(/█|░/)).toBe(true);
  });

  it('should animate progress from previous to new value', () => {
    act(() => {
      render(
        <ProgressCelebration
          previousProgress={0}
          newProgress={100}
        />
      );
    });

    // Should render with initial progress display
    expect(elementExists(/Progress: \d+%/)).toBe(true);

    // Advance animation - animation uses setInterval with Date.now() so fake timers work
    act(() => {
      vi.advanceTimersByTime(750); // Half of 1.5 second animation
    });

    // Progress text should still be visible
    expect(elementExists(/Progress: \d+%/)).toBe(true);
  });

  it('should call onComplete after animation finishes', async () => {
    // Use real timers for this test since Date.now() is used
    usingFakeTimers = false;
    vi.useRealTimers();
    const mockOnComplete = vi.fn();

    act(() => {
      render(
        <ProgressCelebration
          previousProgress={0}
          newProgress={100}
          onComplete={mockOnComplete}
        />
      );
    });

    expect(mockOnComplete).not.toHaveBeenCalled();

    // Wait for animation (1.5s) + delay (1s) = 2.5s minimum
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should show decorative sparkles', () => {
    act(() => {
      render(
        <ProgressCelebration
          previousProgress={25}
          newProgress={75}
        />
      );
    });

    // Multiple sparkle elements may be rendered
    const sparkles = screen.getAllByText('✨ ⭐ ✨');
    expect(sparkles.length).toBeGreaterThan(0);
  });
});

describe('QuickSuccess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should render quick success message with icon', () => {
    render(
      <QuickSuccess
        message="File saved successfully"
        icon="💾"
      />
    );

    expect(elementExists('💾 File saved successfully')).toBe(true);
  });

  it('should use default icon when none provided', () => {
    render(
      <QuickSuccess message="Task completed" />
    );

    expect(elementExists('✅ Task completed')).toBe(true);
  });

  it('should call onComplete after duration', () => {
    const mockOnComplete = vi.fn();

    render(
      <QuickSuccess
        message="Test message"
        duration={1000}
        onComplete={mockOnComplete}
      />
    );

    expect(mockOnComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should use custom duration', () => {
    const mockOnComplete = vi.fn();

    render(
      <QuickSuccess
        message="Test message"
        duration={500}
        onComplete={mockOnComplete}
      />
    );

    vi.advanceTimersByTime(499);
    expect(mockOnComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should apply custom color', () => {
    const { container } = render(
      <QuickSuccess
        message="Custom colored message"
        color="blue"
      />
    );

    // Note: Since we can't easily test Ink colors, we just ensure it renders
    expect(elementExists('✅ Custom colored message')).toBe(true);
  });

  it('should cleanup timeout on unmount', () => {
    const mockOnComplete = vi.fn();

    const { unmount } = render(
      <QuickSuccess
        message="Test message"
        duration={1000}
        onComplete={mockOnComplete}
      />
    );

    unmount();

    vi.advanceTimersByTime(1000);

    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});