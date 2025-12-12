import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { TypewriterText } from './StreamingText.js';

export interface SuccessCelebrationProps {
  message?: string;
  type?: 'task' | 'milestone' | 'achievement' | 'simple';
  duration?: number;
  showAnimation?: boolean;
  onComplete?: () => void;
  data?: {
    tokensUsed?: number;
    timeTaken?: string;
    cost?: string;
    filesChanged?: number;
    linesAdded?: number;
    linesRemoved?: number;
  };
}

/**
 * Success celebration component with animations and stats
 */
export function SuccessCelebration({
  message = 'Task completed successfully!',
  type = 'task',
  duration = 3000,
  showAnimation = true,
  onComplete,
  data,
}: SuccessCelebrationProps): React.ReactElement {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showStats, setShowStats] = useState(false);

  // Different celebration animations
  const animations = {
    simple: ['🎉'],
    task: ['🎉', '✨', '🎊', '✅', '🎉'],
    milestone: ['🎉', '🏆', '⭐', '🎊', '💫', '🎯', '🎉'],
    achievement: ['🎉', '🏆', '👑', '⭐', '🎊', '💎', '✨', '🎯', '🎉'],
  };

  const sparkles = ['✨', '💫', '⭐', '🌟', '💥'];
  const confetti = ['🎊', '🎉', '🎈', '🎆'];

  const animationFrames = animations[type];

  useEffect(() => {
    if (!showAnimation) {
      setShowStats(true);
      return undefined;
    }

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= animationFrames.length - 1) {
          clearInterval(interval);
          setShowStats(true);
          return prev;
        }
        return prev + 1;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [showAnimation, animationFrames.length]);

  useEffect(() => {
    if (showStats) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showStats, duration, onComplete]);

  const getRandomSparkle = () => sparkles[Math.floor(Math.random() * sparkles.length)];
  const getRandomConfetti = () => confetti[Math.floor(Math.random() * confetti.length)];

  const getMainIcon = () => {
    switch (type) {
      case 'milestone':
        return '🏆';
      case 'achievement':
        return '👑';
      case 'simple':
        return '✅';
      default:
        return '🎉';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'milestone':
        return 'Milestone Achieved!';
      case 'achievement':
        return 'Achievement Unlocked!';
      case 'simple':
        return 'Success!';
      default:
        return 'Task Completed!';
    }
  };

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      {/* Animated celebration */}
      {showAnimation && currentFrame < animationFrames.length && (
        <Box flexDirection="column" alignItems="center">
          {/* Main animation */}
          <Box justifyContent="center" marginBottom={1}>
            {[...Array(5)].map((_, i) => (
              <Text key={i} color="yellow">
                {i === 2 ? animationFrames[currentFrame] : getRandomSparkle()}
              </Text>
            ))}
          </Box>

          {/* Decorative elements */}
          <Box justifyContent="center" marginBottom={1}>
            {[...Array(7)].map((_, i) => (
              <Text key={i} color={i % 2 === 0 ? 'magenta' : 'cyan'}>
                {i === 3 ? getMainIcon() : getRandomConfetti()}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Success message */}
      {(showStats || !showAnimation) && (
        <Box flexDirection="column" alignItems="center" borderStyle="double" borderColor="green" paddingX={4} paddingY={2}>
          {/* Header */}
          <Box marginBottom={1}>
            <Text color="green" bold>
              {getMainIcon()} {getTitle()} {getMainIcon()}
            </Text>
          </Box>

          {/* Message */}
          <Box marginBottom={2}>
            <TypewriterText
              text={message}
              speed={80}
              color="white"
              bold={true}
            />
          </Box>

          {/* Stats */}
          {data && (
            <Box flexDirection="column" alignItems="center">
              <Text color="cyan" bold underline>Performance Summary</Text>

              <Box flexDirection="column" marginTop={1}>
                {data.timeTaken && (
                  <Box justifyContent="space-between" width={40}>
                    <Text color="gray">Duration:</Text>
                    <Text color="green" bold>{data.timeTaken}</Text>
                  </Box>
                )}

                {data.tokensUsed && (
                  <Box justifyContent="space-between" width={40}>
                    <Text color="gray">Tokens Used:</Text>
                    <Text color="blue" bold>{data.tokensUsed.toLocaleString()}</Text>
                  </Box>
                )}

                {data.cost && (
                  <Box justifyContent="space-between" width={40}>
                    <Text color="gray">Cost:</Text>
                    <Text color="yellow" bold>{data.cost}</Text>
                  </Box>
                )}

                {data.filesChanged && (
                  <Box justifyContent="space-between" width={40}>
                    <Text color="gray">Files Changed:</Text>
                    <Text color="magenta" bold>{data.filesChanged}</Text>
                  </Box>
                )}

                {(data.linesAdded || data.linesRemoved) && (
                  <Box justifyContent="space-between" width={40}>
                    <Text color="gray">Lines:</Text>
                    <Text>
                      {data.linesAdded && (
                        <Text color="green">+{data.linesAdded}</Text>
                      )}
                      {data.linesAdded && data.linesRemoved && (
                        <Text color="gray"> / </Text>
                      )}
                      {data.linesRemoved && (
                        <Text color="red">-{data.linesRemoved}</Text>
                      )}
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Decorative border */}
          <Box marginTop={2}>
            <Text color="green">
              {'═'.repeat(50)}
            </Text>
          </Box>
        </Box>
      )}

      {/* Floating particles effect */}
      {showAnimation && (
        <Box marginTop={1}>
          {[...Array(3)].map((_, i) => (
            <Text key={i} color="yellow">
              {getRandomSparkle()}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export interface MilestoneProps {
  title: string;
  description: string;
  icon?: string;
  color?: string;
  showBadge?: boolean;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

/**
 * Milestone achievement display
 */
export function Milestone({
  title,
  description,
  icon = '🏆',
  color = 'gold',
  showBadge = true,
  rarity = 'common',
}: MilestoneProps): React.ReactElement {
  const getBadgeColor = () => {
    switch (rarity) {
      case 'legendary': return 'magentaBright';
      case 'epic': return 'blueBright';
      case 'rare': return 'greenBright';
      default: return 'gray';
    }
  };

  const getRarityText = () => {
    switch (rarity) {
      case 'legendary': return '✨ LEGENDARY ✨';
      case 'epic': return '💎 EPIC 💎';
      case 'rare': return '⭐ RARE ⭐';
      default: return '🏅 ACHIEVEMENT 🏅';
    }
  };

  return (
    <Box flexDirection="column" alignItems="center" borderStyle="double" borderColor={getBadgeColor()} paddingX={3} paddingY={2}>
      {showBadge && (
        <Box marginBottom={1}>
          <Text color={getBadgeColor()} bold>
            {getRarityText()}
          </Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text color={color}>{icon} </Text>
        <Text color="white" bold>{title}</Text>
        <Text color={color}> {icon}</Text>
      </Box>

      <Text color="gray" italic>{description}</Text>
    </Box>
  );
}

export interface ProgressCelebrationProps {
  previousProgress: number;
  newProgress: number;
  message?: string;
  showProgressBar?: boolean;
  onComplete?: () => void;
}

/**
 * Progress milestone celebration
 */
export function ProgressCelebration({
  previousProgress,
  newProgress,
  message = 'Great progress!',
  showProgressBar = true,
  onComplete,
}: ProgressCelebrationProps): React.ReactElement {
  const [displayProgress, setDisplayProgress] = useState(previousProgress);

  useEffect(() => {
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const progressDiff = newProgress - previousProgress;
    const frameRate = 30;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease-out animation
      const easedT = 1 - Math.pow(1 - t, 3);
      const currentProgress = previousProgress + (progressDiff * easedT);

      setDisplayProgress(currentProgress);

      if (t >= 1) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      }
    }, 1000 / frameRate);

    return () => clearInterval(interval);
  }, [previousProgress, newProgress, onComplete]);

  return (
    <Box flexDirection="column" alignItems="center" borderStyle="single" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>🎯 {message}</Text>
      </Box>

      {showProgressBar && (
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="gray">Progress: {Math.round(displayProgress)}%</Text>
          </Box>

          {/* Progress bar */}
          <Box>
            {[...Array(20)].map((_, i) => {
              const threshold = (i / 19) * 100;
              const filled = displayProgress >= threshold;
              return (
                <Text key={i} color={filled ? 'green' : 'gray'}>
                  {filled ? '█' : '░'}
                </Text>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Sparkles */}
      <Box>
        <Text color="yellow">✨ ⭐ ✨</Text>
      </Box>
    </Box>
  );
}

export interface QuickSuccessProps {
  message: string;
  icon?: string;
  duration?: number;
  color?: string;
  onComplete?: () => void;
}

/**
 * Quick, minimal success indicator
 */
export function QuickSuccess({
  message,
  icon = '✅',
  duration = 1500,
  color = 'green',
  onComplete,
}: QuickSuccessProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <Box>
      <Text color={color}>{icon} {message}</Text>
    </Box>
  );
}

export default SuccessCelebration;