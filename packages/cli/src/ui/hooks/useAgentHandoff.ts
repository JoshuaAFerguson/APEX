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

  // ====== NEW: Enhanced Visual Properties ======
  /** Enhanced arrow animation frame (0-7 for smoother animation) */
  arrowAnimationFrame: number;
  /** Icon animation frame for agent icons */
  iconFrame: number;
  /** Color intensity for gradient-like transitions (0-1) */
  colorIntensity: number;
  /** Current color transition phase */
  colorPhase: 'source-bright' | 'transitioning' | 'target-bright';
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

  // ====== NEW: Enhanced Visual Options ======
  /** Arrow animation style */
  arrowStyle?: 'basic' | 'enhanced' | 'sparkle';
  /** Enable agent icons during handoff */
  enableIcons?: boolean;
  /** Enable smooth color transitions */
  enableColorTransition?: boolean;
  /** Use ASCII icons instead of emoji (for terminal compatibility) */
  useAsciiIcons?: boolean;
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
 * Easing function for smooth animation transitions
 * @param t - Progress value (0-1)
 * @returns Eased progress value (0-1)
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Arrow animation style type
 */
export type ArrowStyle = 'basic' | 'enhanced' | 'sparkle';

/**
 * Get enhanced arrow frame for smoother animation
 * @param progress - Animation progress (0-1)
 * @param style - Arrow animation style
 * @returns Arrow frame index
 */
function getEnhancedArrowFrame(progress: number, style: ArrowStyle = 'enhanced'): number {
  const frameCount = style === 'basic' ? 3 : 8;
  const totalFrames = 60; // At 30fps, 2 seconds = 60 frames

  if (style === 'basic') {
    // Use original calculation for basic style
    const frameIndex = Math.floor(progress * totalFrames);
    return Math.min(Math.floor(frameIndex / 20), 2);
  }

  // Enhanced: More granular frame distribution with easing
  const easedProgress = easeInOutCubic(progress);
  return Math.min(Math.floor(easedProgress * frameCount), frameCount - 1);
}

/**
 * Get icon animation frame
 * @param progress - Animation progress (0-1)
 * @returns Icon frame for coordinated animation
 */
function getIconFrame(progress: number): number {
  // Icon frame coordinates with color transitions
  if (progress < 0.25) return 0; // Source prominent
  if (progress < 0.75) return Math.floor((progress - 0.25) * 8); // Transition
  return 7; // Target prominent
}

/**
 * Calculate color intensity for gradient-like transitions
 * @param progress - Animation progress (0-1)
 * @returns Color intensity (0-1)
 */
function getColorIntensity(progress: number): number {
  // Smooth transition from source to target emphasis
  return progress;
}

/**
 * Get color transition phase based on progress
 * @param progress - Animation progress (0-1)
 * @returns Current color phase
 */
function getColorPhase(progress: number): 'source-bright' | 'transitioning' | 'target-bright' {
  if (progress < 0.3) return 'source-bright';
  if (progress < 0.7) return 'transitioning';
  return 'target-bright';
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
    pulseFrequency = 4,     // 4 cycles during animation

    // Enhanced visual options with sensible defaults
    arrowStyle = 'enhanced',      // Use enhanced arrows by default
    enableIcons = true,           // Show agent icons by default
    enableColorTransition = true, // Enable color transitions by default
    useAsciiIcons = false        // Use emoji by default, fallback available
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

    // Enhanced visual properties
    arrowAnimationFrame: 0,
    iconFrame: 0,
    colorIntensity: 0,
    colorPhase: 'source-bright',
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

      // Enhanced visual properties
      arrowAnimationFrame: 0,
      iconFrame: 0,
      colorIntensity: 0,
      colorPhase: 'source-bright',
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

      // Calculate new enhanced visual properties
      const arrowAnimationFrame = getEnhancedArrowFrame(progress, arrowStyle);
      const iconFrame = enableIcons ? getIconFrame(progress) : 0;
      const colorIntensity = enableColorTransition ? getColorIntensity(progress) : 0;
      const colorPhase = enableColorTransition ? getColorPhase(progress) : 'source-bright';

      setAnimationState(prev => ({
        ...prev,
        progress,
        isFading,
        transitionPhase,
        pulseIntensity,
        arrowFrame,

        // Enhanced visual properties
        arrowAnimationFrame,
        iconFrame,
        colorIntensity,
        colorPhase,
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

          // Enhanced visual properties reset
          arrowAnimationFrame: 0,
          iconFrame: 0,
          colorIntensity: 0,
          colorPhase: 'source-bright',
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