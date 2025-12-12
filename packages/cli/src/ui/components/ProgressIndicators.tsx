import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  showPercentage?: boolean;
  label?: string;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
}

/**
 * Customizable progress bar component
 */
export function ProgressBar({
  progress,
  width = 40,
  showPercentage = true,
  label,
  color = 'cyan',
  backgroundColor = 'gray',
  animated = false,
}: ProgressBarProps): React.ReactElement {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    if (!animated) {
      setAnimatedProgress(progress);
      return;
    }

    // Animate progress changes using setInterval for Node.js compatibility
    const duration = 500; // ms
    const startProgress = animatedProgress;
    const progressDiff = progress - startProgress;
    const startTime = Date.now();
    const frameRate = 30; // fps

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease-out animation
      const easedT = 1 - Math.pow(1 - t, 3);
      const currentProgress = startProgress + (progressDiff * easedT);

      setAnimatedProgress(currentProgress);

      if (t >= 1) {
        clearInterval(interval);
      }
    }, 1000 / frameRate);

    return () => clearInterval(interval);
  }, [progress, animated]); // removed animatedProgress to prevent loop

  const clampedProgress = Math.max(0, Math.min(100, animatedProgress));
  const filledWidth = Math.floor((clampedProgress / 100) * width);
  const emptyWidth = width - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return (
    <Box flexDirection="column">
      {label && (
        <Text>{label}</Text>
      )}
      <Box>
        <Text color={color}>{filled}</Text>
        <Text color={backgroundColor}>{empty}</Text>
        {showPercentage && (
          <Text color="gray"> {Math.round(clampedProgress)}%</Text>
        )}
      </Box>
    </Box>
  );
}

export interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
}

/**
 * Circular progress indicator
 */
export function CircularProgress({
  progress,
  size = 8,
  showPercentage = true,
  color = 'cyan',
  backgroundColor = 'gray',
}: CircularProgressProps): React.ReactElement {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const steps = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const stepIndex = Math.floor((clampedProgress / 100) * (steps.length - 1));
  const spinner = steps[stepIndex];

  return (
    <Box>
      <Text color={color}>{spinner}</Text>
      {showPercentage && (
        <Text color="gray"> {Math.round(clampedProgress)}%</Text>
      )}
    </Box>
  );
}

export interface LoadingSpinnerProps {
  type?: 'dots' | 'line' | 'pipe' | 'star' | 'flip' | 'hamburger' | 'growVertical';
  text?: string;
  color?: string;
}

/**
 * Enhanced loading spinner with various types
 */
export function LoadingSpinner({
  type = 'dots',
  text,
  color = 'cyan',
}: LoadingSpinnerProps): React.ReactElement {
  return (
    <Box>
      <Text color={color}>
        <Spinner type={type} />
      </Text>
      {text && (
        <Text color="gray"> {text}</Text>
      )}
    </Box>
  );
}

export interface StepProgressProps {
  steps: Array<{
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
    description?: string;
  }>;
  orientation?: 'horizontal' | 'vertical';
  showDescriptions?: boolean;
  compact?: boolean;
}

/**
 * Step-by-step progress indicator
 */
export function StepProgress({
  steps,
  orientation = 'vertical',
  showDescriptions = true,
  compact = false,
}: StepProgressProps): React.ReactElement {
  const getStepIcon = (status: string): { icon: string; color: string } => {
    switch (status) {
      case 'completed':
        return { icon: '✅', color: 'green' };
      case 'in-progress':
        return { icon: '🔄', color: 'cyan' };
      case 'failed':
        return { icon: '❌', color: 'red' };
      case 'skipped':
        return { icon: '⏭️', color: 'yellow' };
      default:
        return { icon: '⚪', color: 'gray' };
    }
  };

  const getConnector = (index: number): string => {
    if (index === steps.length - 1) return '';
    return orientation === 'horizontal' ? '──' : '│';
  };

  if (orientation === 'horizontal') {
    return (
      <Box flexDirection="column">
        <Box>
          {steps.map((step, index) => {
            const { icon, color } = getStepIcon(step.status);
            return (
              <Box key={index}>
                <Text color={color}>{icon}</Text>
                <Text color={color}>{getConnector(index)}</Text>
              </Box>
            );
          })}
        </Box>
        {!compact && (
          <Box>
            {steps.map((step, index) => (
              <Box key={index} width={6} justifyContent="center">
                <Text color="gray" dimColor>{step.name}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {steps.map((step, index) => {
        const { icon, color } = getStepIcon(step.status);
        return (
          <Box key={index} flexDirection="column">
            <Box>
              <Text color={color}>{icon} </Text>
              <Text color={step.status === 'in-progress' ? 'cyan' : 'white'} bold={step.status === 'in-progress'}>
                {step.name}
              </Text>
              {step.status === 'in-progress' && !compact && (
                <LoadingSpinner type="dots" />
              )}
            </Box>
            {showDescriptions && step.description && !compact && (
              <Box marginLeft={2}>
                <Text color="gray" dimColor>{step.description}</Text>
              </Box>
            )}
            {getConnector(index) && (
              <Box marginLeft={1}>
                <Text color="gray">{getConnector(index)}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export interface TaskProgressProps {
  taskName: string;
  currentStep?: string;
  progress?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  estimatedTime?: string;
  elapsed?: string;
  showSpinner?: boolean;
}

/**
 * Comprehensive task progress display
 */
export function TaskProgress({
  taskName,
  currentStep,
  progress,
  status,
  estimatedTime,
  elapsed,
  showSpinner = true,
}: TaskProgressProps): React.ReactElement {
  const getStatusDisplay = () => {
    switch (status) {
      case 'completed':
        return { icon: '✅', color: 'green', text: 'Completed' };
      case 'failed':
        return { icon: '❌', color: 'red', text: 'Failed' };
      case 'in-progress':
        return { icon: '🔄', color: 'cyan', text: 'In Progress' };
      default:
        return { icon: '⏳', color: 'gray', text: 'Pending' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={statusDisplay.color}>{statusDisplay.icon} </Text>
          <Text bold>{taskName}</Text>
        </Box>
        <Text color="gray">{statusDisplay.text}</Text>
      </Box>

      {/* Current step */}
      {currentStep && status === 'in-progress' && (
        <Box marginTop={1}>
          {showSpinner && <LoadingSpinner type="dots" />}
          <Text color="cyan">{currentStep}</Text>
        </Box>
      )}

      {/* Progress bar */}
      {progress !== undefined && status === 'in-progress' && (
        <Box marginTop={1}>
          <ProgressBar
            progress={progress}
            width={50}
            showPercentage={true}
            animated={true}
          />
        </Box>
      )}

      {/* Time information */}
      {(estimatedTime || elapsed) && (
        <Box marginTop={1} justifyContent="space-between">
          {elapsed && (
            <Text color="gray">Elapsed: {elapsed}</Text>
          )}
          {estimatedTime && (
            <Text color="gray">ETA: {estimatedTime}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export interface MultiTaskProgressProps {
  tasks: Array<{
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    progress?: number;
    currentStep?: string;
  }>;
  title?: string;
  compact?: boolean;
}

/**
 * Multi-task progress display
 */
export function MultiTaskProgress({
  tasks,
  title = 'Tasks',
  compact = false,
}: MultiTaskProgressProps): React.ReactElement {
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
        <Text color="gray">{completedTasks}/{totalTasks} completed</Text>
      </Box>

      {/* Overall progress */}
      {!compact && (
        <ProgressBar
          progress={overallProgress}
          width={60}
          showPercentage={true}
          label="Overall Progress"
          animated={true}
        />
      )}

      {/* Individual tasks */}
      <Box flexDirection="column" marginTop={1}>
        {tasks.map(task => {
          const { icon, color } = (() => {
            switch (task.status) {
              case 'completed':
                return { icon: '✅', color: 'green' };
              case 'in-progress':
                return { icon: '🔄', color: 'cyan' };
              case 'failed':
                return { icon: '❌', color: 'red' };
              default:
                return { icon: '⏳', color: 'gray' };
            }
          })();

          return (
            <Box key={task.id} marginBottom={compact ? 0 : 1}>
              <Text color={color}>{icon} </Text>
              <Text color={task.status === 'in-progress' ? 'cyan' : 'white'}>
                {task.name}
              </Text>
              {task.status === 'in-progress' && task.currentStep && !compact && (
                <Text color="gray"> - {task.currentStep}</Text>
              )}
              {task.progress !== undefined && task.status === 'in-progress' && !compact && (
                <Text color="gray"> ({Math.round(task.progress)}%)</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export {
  Spinner as InkSpinner,
};