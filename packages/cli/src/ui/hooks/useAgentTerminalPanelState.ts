import { useState, useCallback, useMemo, useRef } from 'react';

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
  } = options;

  // Internal state for uncontrolled mode
  const [internalPanelStates, setInternalPanelStates] = useState<Record<string, PanelState>>(
    initialPanelStates
  );

  // Track whether we're in controlled mode
  const isControlled = controlledStates !== undefined;

  // Use controlled states if provided, otherwise use internal state
  const currentStates = isControlled ? controlledStates : internalPanelStates;

  // Ref to track current maximized panel for efficiency
  const maximizedPanelRef = useRef<string | null>(null);

  // Update maximized panel ref when states change
  useMemo(() => {
    const maximizedPanel = Object.entries(currentStates).find(
      ([, state]) => state === PanelState.Maximized
    );
    maximizedPanelRef.current = maximizedPanel ? maximizedPanel[0] : null;
  }, [currentStates]);

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

  return {
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
    getAllPanelStates,
  };
}