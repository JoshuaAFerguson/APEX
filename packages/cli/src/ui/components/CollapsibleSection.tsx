import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface CollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;

  /** Content to render when expanded */
  children: React.ReactNode;

  /** Initial collapsed state (default: false) */
  defaultCollapsed?: boolean;

  /** Controlled collapsed state */
  collapsed?: boolean;

  /** Callback when collapse state changes */
  onToggle?: (collapsed: boolean) => void;

  /** Enable dimmed/gray styling for secondary content */
  dimmed?: boolean;

  /** Whether to show the animated arrow indicator (default: true) */
  showArrow?: boolean;

  /** Border style (default: 'single') */
  borderStyle?: 'single' | 'round' | 'double' | 'none';

  /** Border color (default: 'cyan', 'gray' when dimmed) */
  borderColor?: string;

  /** Custom width */
  width?: number;

  /** Display mode affects styling and information density */
  displayMode?: 'normal' | 'compact' | 'verbose';

  /** Additional header content (rendered after title) */
  headerExtra?: React.ReactNode;

  /** Whether keyboard input is enabled for toggling */
  allowKeyboardToggle?: boolean;

  /** Custom toggle key (default: Enter when focused, 'c' global) */
  toggleKey?: string;
}

interface ArrowIndicatorProps {
  collapsed: boolean;
  animated: boolean;
  dimmed?: boolean;
}

/**
 * Animated arrow indicator component with smooth rotation effect
 */
const ArrowIndicator: React.FC<ArrowIndicatorProps> = ({
  collapsed,
  animated,
  dimmed = false
}) => {
  const [rotation, setRotation] = useState(collapsed ? 0 : 90);

  useEffect(() => {
    if (!animated) {
      setRotation(collapsed ? 0 : 90);
      return;
    }

    const targetRotation = collapsed ? 0 : 90;
    const startRotation = rotation;
    const duration = 150; // ms
    const startTime = Date.now();
    const frameRate = 30;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 2); // ease-out

      const currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;
      setRotation(currentRotation);

      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 1000 / frameRate);

    return () => clearInterval(interval);
  }, [collapsed, animated, rotation]);

  // Use Unicode arrow characters based on rotation state
  // ▶ (collapsed, pointing right) → ▼ (expanded, pointing down)
  const arrow = rotation < 45 ? '▶' : '▼';

  return (
    <Text color={dimmed ? 'gray' : 'cyan'}>
      {arrow}{' '}
    </Text>
  );
};

/**
 * Helper function to get theme colors based on dimmed state and display mode
 */
const getColors = (dimmed: boolean, displayMode: 'normal' | 'compact' | 'verbose') => ({
  border: dimmed ? 'gray' : 'cyan',
  title: dimmed ? 'gray' : 'white',
  arrow: dimmed ? 'gray' : 'cyan',
  content: dimmed ? true : false, // dimColor prop value
});

/**
 * Generic CollapsibleSection component for expandable UI sections
 *
 * Features:
 * - Supports both controlled and uncontrolled patterns
 * - Animated arrow indicator with smooth transitions
 * - Dimmed styling support for secondary content
 * - Responsive display modes (normal, compact, verbose)
 * - Keyboard interaction support
 * - Customizable borders and styling
 */
export function CollapsibleSection({
  title,
  children,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onToggle,
  dimmed = false,
  showArrow = true,
  borderStyle = 'single',
  borderColor: customBorderColor,
  width,
  displayMode = 'normal',
  headerExtra,
  allowKeyboardToggle = true,
  toggleKey = 'c',
}: CollapsibleSectionProps): React.ReactElement {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  // Determine if controlled or uncontrolled
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggle = useCallback(() => {
    const newState = !collapsed;
    if (!isControlled) {
      setInternalCollapsed(newState);
    }
    onToggle?.(newState);
  }, [collapsed, isControlled, onToggle]);

  // Get colors based on dimmed state and display mode
  const colors = getColors(dimmed, displayMode);
  const finalBorderColor = customBorderColor || colors.border;

  // Handle keyboard input for toggling
  useInput((input, key) => {
    if (!allowKeyboardToggle) return;

    if (key.return || input === toggleKey) {
      handleToggle();
    }
  }, { isActive: allowKeyboardToggle });

  // Adjust display based on mode
  const getTitleContent = () => {
    switch (displayMode) {
      case 'compact':
        // Abbreviate title if too long in compact mode
        const maxTitleLength = 20;
        const displayTitle = title.length > maxTitleLength ? `${title.substring(0, maxTitleLength - 3)}...` : title;
        return (
          <Text color={colors.title} bold={!dimmed}>
            {displayTitle}
          </Text>
        );
      case 'verbose':
        // Show additional state information in verbose mode
        return (
          <Box>
            <Text color={colors.title} bold={!dimmed}>
              {title}
            </Text>
            <Text color="gray" dimColor> [{collapsed ? 'collapsed' : 'expanded'}]</Text>
          </Box>
        );
      case 'normal':
      default:
        return (
          <Text color={colors.title} bold={!dimmed}>
            {title}
          </Text>
        );
    }
  };

  // Handle collapsed state display for full component
  if (collapsed && borderStyle !== 'none') {
    return (
      <Box
        borderStyle={borderStyle}
        borderColor={finalBorderColor}
        width={width}
        paddingX={1}
        justifyContent="space-between"
        onClick={handleToggle}
      >
        <Box>
          {showArrow && <ArrowIndicator collapsed={collapsed} animated={true} dimmed={dimmed} />}
          {getTitleContent()}
        </Box>
        {headerExtra}
      </Box>
    );
  }

  if (collapsed && borderStyle === 'none') {
    return (
      <Box
        width={width}
        paddingX={1}
        justifyContent="space-between"
        onClick={handleToggle}
      >
        <Box>
          {showArrow && <ArrowIndicator collapsed={collapsed} animated={true} dimmed={dimmed} />}
          {getTitleContent()}
        </Box>
        {headerExtra}
      </Box>
    );
  }

  // Expanded state
  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle !== 'none' ? borderStyle : undefined}
      borderColor={borderStyle !== 'none' ? finalBorderColor : undefined}
      width={width}
    >
      {/* Header */}
      <Box
        paddingX={1}
        justifyContent="space-between"
        onClick={handleToggle}
      >
        <Box>
          {showArrow && <ArrowIndicator collapsed={collapsed} animated={true} dimmed={dimmed} />}
          {getTitleContent()}
        </Box>
        {headerExtra}
      </Box>

      {/* Content - conditionally rendered */}
      <Box flexDirection="column" paddingX={1} paddingY={displayMode === 'compact' ? 0 : 1}>
        {dimmed ? (
          <Box>
            <Text dimColor>{children}</Text>
          </Box>
        ) : (
          <Box>
            {children}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default CollapsibleSection;