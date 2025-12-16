/**
 * Hook for managing agent handoff animation state
 * Tracks transitions between agents and provides animation state for visual indicators
 */

import { useState, useEffect, useRef } from 'react';

export interface HandoffAnimationState {
  /** Whether a handoff is currently being animated */
  isAnimating: boolean;
  /** Previous agent in the transition */
  previousAgent: string | null;
  /** Current agent in the transition */
  currentAgent: string | null;
  /** Animation progress (0-1) */
  progress: number;
  /** Whether the animation is in the fade-out phase */
  isFading: boolean;

  // Enhanced animation properties
  /** Current phase of the transition animation */
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  /** Pulse intensity for highlight effect (0-1, oscillates) */
  pulseIntensity: number;
  /** Current frame of animated arrow (0=→, 1=→→, 2=→→→) */
  arrowFrame: number;
  /** Timestamp when handoff animation started (for elapsed time) */
  handoffStartTime: Date | null;
}

export interface UseAgentHandoffOptions {
  /** Duration of the full animation in milliseconds */
  duration?: number;
  /** Duration of the fade-out phase in milliseconds */
  fadeDuration?: number;
  /** Frame rate for animation updates */
  frameRate?: number;
  /** Enable pulse effect on new agent */
  enablePulse?: boolean;
  /** Frequency of pulse cycles during animation */
  pulseFrequency?: number;
}

/**
 * Calculate transition phase based on progress
 * @param progress - Animation progress (0-1)
 * @returns Current transition phase
 */
function getTransitionPhase(progress: number): 'entering' | 'active' | 'exiting' | 'idle' {
  if (progress === 0) return 'idle';
  if (progress < 0.25) return 'entering';
  if (progress < 0.75) return 'active';
  return 'exiting';
}

/**
 * Calculate pulse intensity using sinusoidal wave
 * @param progress - Animation progress (0-1)
 * @param frequency - Number of pulse cycles (default: 4)
 * @returns Pulse intensity (0-1)
 */
function getPulseIntensity(progress: number, frequency: number = 4): number {
  return Math.sin(progress * Math.PI * frequency * 2) * 0.5 + 0.5;
}

/**
 * Get arrow frame for animated transition arrow
 * @param progress - Animation progress (0-1)
 * @returns Arrow frame index (0, 1, or 2)
 */
function getArrowFrame(progress: number): number {
  const totalFrames = 60; // At 30fps, 2 seconds = 60 frames
  const frameIndex = Math.floor(progress * totalFrames);
  return Math.min(Math.floor(frameIndex / 20), 2);
}

/**
 * Format handoff elapsed time with sub-second precision
 * @param startTime - When handoff started
 * @param currentTime - Current time (default: now)
 * @returns Formatted time string (e.g., "0.5s", "1.2s")
 */
function formatHandoffElapsed(startTime: Date, currentTime: Date = new Date()): string {
  const elapsedMs = currentTime.getTime() - startTime.getTime();
  const seconds = elapsedMs / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Custom hook for managing agent handoff animations
 * Follows the project pattern of setInterval-based animations for terminal compatibility
 */
export function useAgentHandoff(
  currentAgent: string | undefined,
  options: UseAgentHandoffOptions = {}
): HandoffAnimationState {
  const {
    duration = 2000,        // 2 seconds total
    fadeDuration = 500,     // 0.5 seconds fade out
    frameRate = 30,         // 30 fps for smooth animation
    enablePulse = true,     // Enable pulse effect
    pulseFrequency = 4      // 4 cycles during animation
  } = options;

  const [animationState, setAnimationState] = useState<HandoffAnimationState>({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
    transitionPhase: 'idle',
    pulseIntensity: 0,
    arrowFrame: 0,
    handoffStartTime: null,
  });

  // Track previous agent value for comparison
  const previousAgentRef = useRef<string | undefined>(currentAgent);
  const animationIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if agent has changed
    if (previousAgentRef.current !== currentAgent) {
      const prevAgent = previousAgentRef.current;
      previousAgentRef.current = currentAgent;

      // Only animate if both previous and current agents exist and are different
      if (prevAgent && currentAgent && prevAgent !== currentAgent) {
        startHandoffAnimation(prevAgent, currentAgent);
      }
    }
  }, [currentAgent]);

  const startHandoffAnimation = (prevAgent: string, newAgent: string) => {
    // Clear any existing animation
    if (animationIdRef.current) {
      clearInterval(animationIdRef.current);
    }

    const startTime = Date.now();
    const handoffStartTime = new Date();
    const frameInterval = 1000 / frameRate;

    // Initialize animation state
    setAnimationState({
      isAnimating: true,
      previousAgent: prevAgent,
      currentAgent: newAgent,
      progress: 0,
      isFading: false,
      transitionPhase: 'entering',
      pulseIntensity: enablePulse ? 0.5 : 0,
      arrowFrame: 0,
      handoffStartTime,
    });

    animationIdRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Calculate if we're in the fade phase (last portion of animation)
      const fadeStartTime = duration - fadeDuration;
      const isFading = elapsed >= fadeStartTime;

      // Calculate enhanced animation properties
      const transitionPhase = getTransitionPhase(progress);
      const pulseIntensity = enablePulse ? getPulseIntensity(progress, pulseFrequency) : 0;
      const arrowFrame = getArrowFrame(progress);

      setAnimationState(prev => ({
        ...prev,
        progress,
        isFading,
        transitionPhase,
        pulseIntensity,
        arrowFrame,
      }));

      // Complete animation when duration is reached
      if (progress >= 1) {
        if (animationIdRef.current) {
          clearInterval(animationIdRef.current);
          animationIdRef.current = null;
        }

        setAnimationState({
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
          transitionPhase: 'idle',
          pulseIntensity: 0,
          arrowFrame: 0,
          handoffStartTime: null,
        });
      }
    }, frameInterval);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationIdRef.current) {
        clearInterval(animationIdRef.current);
      }
    };
  }, []);

  return animationState;
}

// Export helper functions for use in components
export { formatHandoffElapsed };