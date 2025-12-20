/**
 * Agent icon mappings and utilities for HandoffIndicator enhanced visuals
 * Provides both emoji and ASCII fallback support for terminal compatibility
 */

/**
 * Agent icon definitions using Unicode emoji for visual recognition
 */
export const AGENT_ICONS: Record<string, string> = {
  planner: '📋',     // Planning/clipboard
  architect: '🏗️',   // Building/architecture
  developer: '💻',   // Computer/coding
  tester: '🧪',      // Test tube/testing
  reviewer: '👁️',    // Eye/review
  devops: '⚙️',      // Gear/operations
  default: '🤖',     // Robot for unknown agents
};

/**
 * ASCII fallback icons for terminals without emoji support
 */
export const AGENT_ICONS_ASCII: Record<string, string> = {
  planner: '[P]',
  architect: '[A]',
  developer: '[D]',
  tester: '[T]',
  reviewer: '[R]',
  devops: '[O]',
  default: '[?]',
};

/**
 * Get icon for agent with fallback handling
 * @param agentName - Name of the agent
 * @param useAscii - Whether to use ASCII icons instead of emoji
 * @param customIcons - Optional custom icon mappings
 * @returns Agent icon string
 */
export function getAgentIcon(
  agentName: string,
  useAscii: boolean = false,
  customIcons?: Record<string, string>
): string {
  // Check custom icons first
  if (customIcons?.[agentName]) {
    return customIcons[agentName];
  }

  // Use appropriate icon set
  const iconSet = useAscii ? AGENT_ICONS_ASCII : AGENT_ICONS;

  // Return agent-specific icon or default
  return iconSet[agentName] || iconSet.default;
}

/**
 * Icon transition states for different phases of handoff animation
 */
export type IconTransitionState = 'source' | 'moving' | 'target';

/**
 * Configuration for icon animation during transition
 */
export interface IconAnimationConfig {
  showSourceIcon: boolean;
  showTargetIcon: boolean;
  sourceOpacity: 'full' | 'dim';  // Maps to Ink bold/dimColor styling
  targetOpacity: 'full' | 'dim';
  iconFrame: number;  // For icon-specific animations if needed
}

/**
 * Calculate icon animation configuration based on animation progress
 * @param progress - Animation progress (0-1)
 * @returns Icon animation configuration
 */
export function getIconAnimationConfig(progress: number): IconAnimationConfig {
  if (progress < 0.25) {
    // Entering phase: Source icon prominent, target dim
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'full',
      targetOpacity: 'dim',
      iconFrame: 0,
    };
  } else if (progress < 0.75) {
    // Active phase: Both icons visible and prominent
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'full',
      targetOpacity: 'full',
      iconFrame: Math.floor((progress - 0.25) * 8), // 8 frames during active phase
    };
  } else {
    // Exiting phase: Source dims, target becomes prominent
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'dim',
      targetOpacity: 'full',
      iconFrame: 7,
    };
  }
}

/**
 * Detect if terminal likely supports emoji
 * @returns Boolean indicating probable emoji support
 */
export function detectEmojiSupport(): boolean {
  // Check environment variables that suggest emoji support
  const term = process.env.TERM || '';
  const colorterm = process.env.COLORTERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';

  // Modern terminals that typically support emoji
  const supportedTerminals = [
    'xterm-256color',
    'screen-256color',
    'tmux-256color'
  ];

  const supportedColorTerms = [
    'truecolor',
    '24bit'
  ];

  const supportedPrograms = [
    'iTerm.app',
    'Apple_Terminal',
    'vscode',
    'hyper'
  ];

  return (
    supportedTerminals.includes(term) ||
    supportedColorTerms.includes(colorterm) ||
    supportedPrograms.includes(termProgram) ||
    // Default to true for unknown terminals - emoji are widely supported now
    (!term && !colorterm && !termProgram)
  );
}

/**
 * Automatically determine whether to use ASCII icons based on environment
 * @param forceAscii - Override to force ASCII icons
 * @returns Whether ASCII icons should be used
 */
export function shouldUseAsciiIcons(forceAscii?: boolean): boolean {
  if (forceAscii !== undefined) {
    return forceAscii;
  }

  // Auto-detect based on environment
  return !detectEmojiSupport();
}