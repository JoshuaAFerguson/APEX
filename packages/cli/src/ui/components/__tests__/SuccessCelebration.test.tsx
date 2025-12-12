import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByText('Test completed successfully!')).toBeInTheDocument();
    expect(screen.getByText('Task Completed!')).toBeInTheDocument();
  });

  it('should render different titles based on type', () => {
    const { rerender } = render(
      <SuccessCelebration type="milestone" showAnimation={false} />
    );
    expect(screen.getByText('Milestone Achieved!')).toBeInTheDocument();

    rerender(<SuccessCelebration type="achievement" showAnimation={false} />);
    expect(screen.getByText('Achievement Unlocked!')).toBeInTheDocument();

    rerender(<SuccessCelebration type="simple" showAnimation={false} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
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

    expect(screen.getByText('Performance Summary')).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('2.5s')).toBeInTheDocument();
    expect(screen.getByText('Tokens Used:')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('Cost:')).toBeInTheDocument();
    expect(screen.getByText('$0.05')).toBeInTheDocument();
    expect(screen.getByText('Files Changed:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Lines:')).toBeInTheDocument();
    expect(screen.getByText('+150')).toBeInTheDocument();
    expect(screen.getByText('-25')).toBeInTheDocument();
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

    // Animation should start
    expect(screen.getByText(/🎉|✨|🎊|✅/)).toBeInTheDocument();
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

    // Should immediately show stats
    expect(screen.getByText('Task Completed!')).toBeInTheDocument();

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

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('$0.02')).toBeInTheDocument();
    expect(screen.queryByText('Duration:')).not.toBeInTheDocument();
    expect(screen.queryByText('Files Changed:')).not.toBeInTheDocument();
  });

  it('should show only lines added when no lines removed', () => {
    const data = { linesAdded: 100 };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument();
  });

  it('should show only lines removed when no lines added', () => {
    const data = { linesRemoved: 50 };

    render(
      <SuccessCelebration
        data={data}
        showAnimation={false}
      />
    );

    expect(screen.getByText('-50')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
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

    expect(screen.getByText('First Deployment')).toBeInTheDocument();
    expect(screen.getByText('Successfully deployed your first application')).toBeInTheDocument();
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

      expect(screen.getByText(expectedTexts[index])).toBeInTheDocument();
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

    expect(screen.queryByText(/ACHIEVEMENT|RARE|EPIC|LEGENDARY/)).not.toBeInTheDocument();
  });
});

describe('ProgressCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should render progress celebration message', () => {
    render(
      <ProgressCelebration
        previousProgress={50}
        newProgress={75}
        message="Quarter milestone reached!"
      />
    );

    expect(screen.getByText('🎯 Quarter milestone reached!')).toBeInTheDocument();
    expect(screen.getByText(/Progress: \d+%/)).toBeInTheDocument();
  });

  it('should show progress bar when enabled', () => {
    render(
      <ProgressCelebration
        previousProgress={25}
        newProgress={50}
        showProgressBar={true}
      />
    );

    expect(screen.getByText(/Progress: \d+%/)).toBeInTheDocument();
    // Progress bar should be rendered with filled and unfilled blocks
    expect(screen.getByText(/█|░/)).toBeInTheDocument();
  });

  it('should hide progress bar when disabled', () => {
    render(
      <ProgressCelebration
        previousProgress={25}
        newProgress={50}
        showProgressBar={false}
      />
    );

    expect(screen.queryByText(/Progress: \d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/█|░/)).not.toBeInTheDocument();
  });

  it('should animate progress from previous to new value', async () => {
    const { container } = render(
      <ProgressCelebration
        previousProgress={0}
        newProgress={100}
      />
    );

    // Should start at previous progress
    expect(screen.getByText('Progress: 0%')).toBeInTheDocument();

    // Advance animation
    vi.advanceTimersByTime(750); // Half of 1.5 second animation

    // Progress should be somewhere between 0 and 100
    await waitFor(() => {
      const progressText = screen.getByText(/Progress: \d+%/);
      const match = progressText.textContent?.match(/Progress: (\d+)%/);
      const currentProgress = match ? parseInt(match[1], 10) : 0;
      expect(currentProgress).toBeGreaterThan(0);
      expect(currentProgress).toBeLessThan(100);
    });
  });

  it('should call onComplete after animation finishes', () => {
    const mockOnComplete = vi.fn();

    render(
      <ProgressCelebration
        previousProgress={0}
        newProgress={100}
        onComplete={mockOnComplete}
      />
    );

    expect(mockOnComplete).not.toHaveBeenCalled();

    // Complete animation (1.5s) + delay (1s)
    vi.advanceTimersByTime(2500);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should show decorative sparkles', () => {
    render(
      <ProgressCelebration
        previousProgress={25}
        newProgress={75}
      />
    );

    expect(screen.getByText('✨ ⭐ ✨')).toBeInTheDocument();
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

    expect(screen.getByText('💾 File saved successfully')).toBeInTheDocument();
  });

  it('should use default icon when none provided', () => {
    render(
      <QuickSuccess message="Task completed" />
    );

    expect(screen.getByText('✅ Task completed')).toBeInTheDocument();
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
    expect(screen.getByText('✅ Custom colored message')).toBeInTheDocument();
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