import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Panel state enumeration for type safety
 */
export enum PanelState {
  Normal = 'normal',
  Minimized = 'minimized',
  Maximized = 'maximized',
}

/**
 * Configuration options for the hook
 */
export interface UseAgentTerminalPanelStateOptions {
  /**
   * External state for controlled mode
   */
  panelStates?: Record<string, PanelState>;

  /**
   * Callback for controlled mode state changes
   */
  onPanelStateChange?: (panelId: string, state: PanelState) => void;

  /**
   * Initial state for panels (uncontrolled mode)
   */
  initialPanelStates?: Record<string, PanelState>;

  /**
   * Default state for new panels
   */
  defaultPanelState?: PanelState;

  /**
   * Ordered list of panel IDs for Tab navigation
   * Order determines Tab sequence
   */
  panelIds?: string[];

  /**
   * Initially focused panel ID
   */
  initialFocusedPanelId?: string | null;

  /**
   * Callback when focus changes
   */
  onFocusChange?: (panelId: string | null, previousPanelId: string | null) => void;
}

/**
 * Panel state management object
 */
export interface PanelStateManager {
  /**
   * Minimize a specific panel
   */
  minimize: (panelId: string) => void;

  /**
   * Maximize a specific panel (minimizes others)
   */
  maximize: (panelId: string) => void;

  /**
   * Restore a specific panel to normal state
   */
  restore: (panelId: string) => void;

  /**
   * Restore all panels to normal state
   */
  restoreAll: () => void;

  /**
   * Get current state of a specific panel
   */
  getPanelState: (panelId: string) => PanelState;

  /**
   * Get all panel states (for debugging/testing)
   */
  getAllPanelStates: () => Record<string, PanelState>;

  /**
   * Move focus to next panel (wraps around)
   */
  focusNext: () => void;

  /**
   * Move focus to previous panel (wraps around)
   */
  focusPrevious: () => void;

  /**
   * Focus a specific panel by ID
   */
  focusPanel: (panelId: string) => void;

  /**
   * Clear current focus
   */
  clearFocus: () => void;

  /**
   * Check if a specific panel is focused
   */
  isPanelFocused: (panelId: string) => boolean;

  /**
   * Currently focused panel ID
   */
  focusedPanelId: string | null;

  /**
   * Index of focused panel in panel order (-1 if none)
   */
  focusedIndex: number;
}

/**
 * Custom hook for managing agent terminal panel minimize/maximize state
 *
 * Supports both controlled and uncontrolled patterns:
 * - Controlled: Pass panelStates and onPanelStateChange
 * - Uncontrolled: Use internal state management
 *
 * Features:
 * - Mutual exclusivity: Only one panel can be maximized at a time
 * - Type-safe panel states
 * - Memoized actions for performance
 *
 * @param options Configuration options
 * @returns Panel state management object
 */
export function useAgentTerminalPanelState(
  options: UseAgentTerminalPanelStateOptions = {}
): PanelStateManager {
  const {
    panelStates: controlledStates,
    onPanelStateChange,
    initialPanelStates = {},
    defaultPanelState = PanelState.Normal,
    panelIds = [],
    initialFocusedPanelId = null,
    onFocusChange,
  } = options;

  // Internal state for uncontrolled mode
  const [internalPanelStates, setInternalPanelStates] = useState<Record<string, PanelState>>(
    initialPanelStates
  );

  // Focus state management
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(initialFocusedPanelId);
  const [currentPanelIds, setCurrentPanelIds] = useState<string[]>(panelIds);

  // Track whether we're in controlled mode
  const isControlled = controlledStates !== undefined;

  // Use controlled states if provided, otherwise use internal state
  const currentStates = isControlled ? controlledStates : internalPanelStates;

  // Update panel IDs when they change externally
  useEffect(() => {
    setCurrentPanelIds(panelIds);
  }, [panelIds]);

  // Clear focus if focused panel is no longer in panel list
  useEffect(() => {
    if (focusedPanelId && !currentPanelIds.includes(focusedPanelId)) {
      setFocusedPanelId(null);
    }
  }, [focusedPanelId, currentPanelIds]);

  // Ref to track current maximized panel for efficiency
  const maximizedPanelRef = useRef<string | null>(null);

  // Update maximized panel ref when states change
  useMemo(() => {
    const maximizedPanel = Object.entries(currentStates).find(
      ([, state]) => state === PanelState.Maximized
    );
    maximizedPanelRef.current = maximizedPanel ? maximizedPanel[0] : null;
  }, [currentStates]);

  // Calculate focused index
  const focusedIndex = useMemo(() => {
    if (!focusedPanelId || currentPanelIds.length === 0) return -1;
    return currentPanelIds.indexOf(focusedPanelId);
  }, [focusedPanelId, currentPanelIds]);

  // Helper function to calculate next index for focus navigation with wrapping
  const calculateNextIndex = useCallback(
    (currentIndex: number, direction: 'next' | 'previous'): number => {
      const totalPanels = currentPanelIds.length;
      if (totalPanels === 0) return -1;
      if (currentIndex === -1) {
        // No current focus, start at first or last
        return direction === 'next' ? 0 : totalPanels - 1;
      }

      if (direction === 'next') {
        // Wrap from last to first
        return (currentIndex + 1) % totalPanels;
      } else {
        // Wrap from first to last
        return (currentIndex - 1 + totalPanels) % totalPanels;
      }
    },
    [currentPanelIds]
  );

  // Helper function to handle focus changes
  const handleFocusChange = useCallback(
    (newPanelId: string | null) => {
      const previousPanelId = focusedPanelId;
      if (previousPanelId !== newPanelId) {
        setFocusedPanelId(newPanelId);
        onFocusChange?.(newPanelId, previousPanelId);
      }
    },
    [focusedPanelId, onFocusChange]
  );

  /**
   * Internal state update function that works for both controlled and uncontrolled modes
   */
  const updatePanelState = useCallback(
    (panelId: string, newState: PanelState) => {
      if (isControlled) {
        // In controlled mode, notify parent component
        onPanelStateChange?.(panelId, newState);
      } else {
        // In uncontrolled mode, update internal state
        setInternalPanelStates((prevStates) => ({
          ...prevStates,
          [panelId]: newState,
        }));
      }
    },
    [isControlled, onPanelStateChange]
  );

  /**
   * Batch update multiple panels (for efficiency when maximizing)
   */
  const batchUpdatePanelStates = useCallback(
    (updates: Record<string, PanelState>) => {
      if (isControlled) {
        // In controlled mode, call onPanelStateChange for each update
        Object.entries(updates).forEach(([panelId, state]) => {
          onPanelStateChange?.(panelId, state);
        });
      } else {
        // In uncontrolled mode, batch update internal state
        setInternalPanelStates((prevStates) => ({
          ...prevStates,
          ...updates,
        }));
      }
    },
    [isControlled, onPanelStateChange]
  );

  /**
   * Minimize a specific panel
   */
  const minimize = useCallback(
    (panelId: string) => {
      updatePanelState(panelId, PanelState.Minimized);
    },
    [updatePanelState]
  );

  /**
   * Maximize a specific panel
   * Ensures mutual exclusivity by minimizing other maximized panels
   */
  const maximize = useCallback(
    (panelId: string) => {
      if (isControlled) {
        // In controlled mode, find currently maximized panel
        const currentMaximizedEntry = Object.entries(currentStates).find(
          ([, state]) => state === PanelState.Maximized
        );
        const currentMaximized = currentMaximizedEntry ? currentMaximizedEntry[0] : null;

        if (currentMaximized && currentMaximized !== panelId) {
          // If another panel is maximized, restore it and maximize the new one
          onPanelStateChange?.(currentMaximized, PanelState.Normal);
          onPanelStateChange?.(panelId, PanelState.Maximized);
        } else if (!currentMaximized || currentMaximized !== panelId) {
          // No other panel is maximized, just maximize this one
          onPanelStateChange?.(panelId, PanelState.Maximized);
        }
      } else {
        // In uncontrolled mode, use state updater function to ensure consistency
        setInternalPanelStates((prevStates) => {
          const currentMaximizedEntry = Object.entries(prevStates).find(
            ([, state]) => state === PanelState.Maximized
          );
          const currentMaximized = currentMaximizedEntry ? currentMaximizedEntry[0] : null;

          if (currentMaximized && currentMaximized !== panelId) {
            // If another panel is maximized, restore it and maximize the new one
            return {
              ...prevStates,
              [currentMaximized]: PanelState.Normal,
              [panelId]: PanelState.Maximized,
            };
          } else if (!currentMaximized || currentMaximized !== panelId) {
            // No other panel is maximized, just maximize this one
            return {
              ...prevStates,
              [panelId]: PanelState.Maximized,
            };
          }

          // If the same panel is already maximized, do nothing
          return prevStates;
        });
      }
    },
    [isControlled, onPanelStateChange, currentStates]
  );

  /**
   * Restore a specific panel to normal state
   */
  const restore = useCallback(
    (panelId: string) => {
      updatePanelState(panelId, PanelState.Normal);
    },
    [updatePanelState]
  );

  /**
   * Restore all panels to normal state
   */
  const restoreAll = useCallback(() => {
    const updates: Record<string, PanelState> = {};

    // Find all panels that are not in normal state
    Object.entries(currentStates).forEach(([panelId, state]) => {
      if (state !== PanelState.Normal) {
        updates[panelId] = PanelState.Normal;
      }
    });

    // Only update if there are changes to make
    if (Object.keys(updates).length > 0) {
      batchUpdatePanelStates(updates);
    }
  }, [currentStates, batchUpdatePanelStates]);

  /**
   * Get current state of a specific panel
   */
  const getPanelState = useCallback(
    (panelId: string): PanelState => {
      return currentStates[panelId] ?? defaultPanelState;
    },
    [currentStates, defaultPanelState]
  );

  /**
   * Get all panel states (useful for debugging and testing)
   */
  const getAllPanelStates = useCallback((): Record<string, PanelState> => {
    return { ...currentStates };
  }, [currentStates]);

  /**
   * Move focus to next panel (wraps around)
   */
  const focusNext = useCallback(() => {
    const nextIndex = calculateNextIndex(focusedIndex, 'next');
    if (nextIndex >= 0 && nextIndex < currentPanelIds.length) {
      const nextPanelId = currentPanelIds[nextIndex];
      handleFocusChange(nextPanelId);
    }
  }, [calculateNextIndex, focusedIndex, currentPanelIds, handleFocusChange]);

  /**
   * Move focus to previous panel (wraps around)
   */
  const focusPrevious = useCallback(() => {
    const prevIndex = calculateNextIndex(focusedIndex, 'previous');
    if (prevIndex >= 0 && prevIndex < currentPanelIds.length) {
      const prevPanelId = currentPanelIds[prevIndex];
      handleFocusChange(prevPanelId);
    }
  }, [calculateNextIndex, focusedIndex, currentPanelIds, handleFocusChange]);

  /**
   * Focus a specific panel by ID
   */
  const focusPanel = useCallback(
    (panelId: string) => {
      if (currentPanelIds.includes(panelId)) {
        handleFocusChange(panelId);
      }
    },
    [currentPanelIds, handleFocusChange]
  );

  /**
   * Clear current focus
   */
  const clearFocus = useCallback(() => {
    handleFocusChange(null);
  }, [handleFocusChange]);

  /**
   * Check if a specific panel is focused
   */
  const isPanelFocused = useCallback(
    (panelId: string): boolean => {
      return focusedPanelId === panelId;
    },
    [focusedPanelId]
  );

  return {
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
    getAllPanelStates,
    focusNext,
    focusPrevious,
    focusPanel,
    clearFocus,
    isPanelFocused,
    focusedPanelId,
    focusedIndex,
  };
}