'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Options for the useAutoScroll hook
 */
export interface UseAutoScrollOptions {
  /**
   * Distance from bottom (in pixels) to consider "at bottom"
   * @default 50
   */
  bottomThreshold?: number

  /**
   * Whether auto-scroll starts enabled
   * @default true
   */
  initialAutoScroll?: boolean

  /**
   * Callback when auto-scroll state changes
   */
  onAutoScrollChange?: (enabled: boolean) => void

  /**
   * Callback when new content is available while scrolled up
   */
  onNewContentWhileScrolledUp?: (count: number) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Return type for useAutoScroll hook
 */
export interface UseAutoScrollReturn {
  /**
   * Whether auto-scroll is currently enabled
   */
  autoScroll: boolean

  /**
   * Number of new items since user scrolled away from bottom
   */
  newItemsSinceScroll: number

  /**
   * Whether the container is currently at or near the bottom
   */
  isAtBottom: boolean

  /**
   * Ref to attach to the scrollable container
   */
  containerRef: React.RefObject<HTMLDivElement>

  /**
   * Handle scroll events (attach to onScroll)
   */
  handleScroll: () => void

  /**
   * Scroll to bottom smoothly and re-enable auto-scroll
   */
  scrollToBottom: () => void

  /**
   * Manually enable/disable auto-scroll
   */
  setAutoScroll: (enabled: boolean) => void

  /**
   * Reset new items counter
   */
  resetNewItemsCounter: () => void

  /**
   * Notify that new items were added (call when content updates)
   */
  notifyNewItems: (count?: number) => void
}

/**
 * Hook for managing auto-scroll behavior in a scrollable container
 *
 * Automatically scrolls to bottom when new content arrives, but pauses
 * auto-scroll when user manually scrolls up. Resumes when user scrolls
 * back to bottom.
 *
 * @example
 * ```tsx
 * function LogViewer({ logs }: { logs: LogEntry[] }) {
 *   const {
 *     containerRef,
 *     handleScroll,
 *     scrollToBottom,
 *     autoScroll,
 *     newItemsSinceScroll,
 *     notifyNewItems,
 *   } = useAutoScroll({
 *     bottomThreshold: 50,
 *     onNewContentWhileScrolledUp: (count) => console.log(`${count} new logs`),
 *   })
 *
 *   // Notify when logs change
 *   const prevLogsLength = useRef(logs.length)
 *   useEffect(() => {
 *     if (logs.length > prevLogsLength.current) {
 *       notifyNewItems(logs.length - prevLogsLength.current)
 *     }
 *     prevLogsLength.current = logs.length
 *   }, [logs.length, notifyNewItems])
 *
 *   return (
 *     <div>
 *       <div
 *         ref={containerRef}
 *         onScroll={handleScroll}
 *         className="h-96 overflow-y-auto"
 *       >
 *         {logs.map(log => <LogEntry key={log.id} log={log} />)}
 *       </div>
 *       {!autoScroll && newItemsSinceScroll > 0 && (
 *         <button onClick={scrollToBottom}>
 *           {newItemsSinceScroll} new logs ↓
 *         </button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAutoScroll({
  bottomThreshold = 50,
  initialAutoScroll = true,
  onAutoScrollChange,
  onNewContentWhileScrolledUp,
  debug = false,
}: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const [autoScroll, setAutoScrollState] = useState(initialAutoScroll)
  const [newItemsSinceScroll, setNewItemsSinceScroll] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(autoScroll)
  const isAtBottomRef = useRef(isAtBottom)

  // Keep refs in sync with state
  useEffect(() => {
    autoScrollRef.current = autoScroll
  }, [autoScroll])

  useEffect(() => {
    isAtBottomRef.current = isAtBottom
  }, [isAtBottom])

  /**
   * Debug logging utility
   */
  const debugLog = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[useAutoScroll] ${message}`, ...args)
      }
    },
    [debug]
  )

  /**
   * Check if the container is at or near the bottom
   */
  const checkIfAtBottom = useCallback(
    (container: HTMLElement): boolean => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const atBottom = distanceFromBottom <= bottomThreshold

      debugLog('Scroll check:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceFromBottom,
        atBottom,
        threshold: bottomThreshold,
      })

      return atBottom
    },
    [bottomThreshold, debugLog]
  )

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const wasAtBottom = isAtBottomRef.current
    const nowAtBottom = checkIfAtBottom(container)

    setIsAtBottom(nowAtBottom)

    // If user scrolled to bottom, re-enable auto-scroll and reset counter
    if (nowAtBottom && !autoScrollRef.current) {
      debugLog('User scrolled to bottom, enabling auto-scroll')
      setAutoScrollState(true)
      setNewItemsSinceScroll(0)
      onAutoScrollChange?.(true)
    }
    // If user scrolled away from bottom, disable auto-scroll
    else if (!nowAtBottom && autoScrollRef.current) {
      debugLog('User scrolled away from bottom, disabling auto-scroll')
      setAutoScrollState(false)
      onAutoScrollChange?.(false)
    }
  }, [checkIfAtBottom, onAutoScrollChange, debugLog])

  /**
   * Scroll to bottom smoothly
   */
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    debugLog('Scrolling to bottom')

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })

    // Re-enable auto-scroll and reset counter
    setAutoScrollState(true)
    setIsAtBottom(true)
    setNewItemsSinceScroll(0)
    onAutoScrollChange?.(true)
  }, [onAutoScrollChange, debugLog])

  /**
   * Manually set auto-scroll state
   */
  const setAutoScroll = useCallback(
    (enabled: boolean) => {
      debugLog('Manually setting auto-scroll:', enabled)
      setAutoScrollState(enabled)
      onAutoScrollChange?.(enabled)

      if (enabled) {
        setNewItemsSinceScroll(0)
        // Scroll to bottom if enabling
        const container = containerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
          setIsAtBottom(true)
        }
      }
    },
    [onAutoScrollChange, debugLog]
  )

  /**
   * Reset new items counter
   */
  const resetNewItemsCounter = useCallback(() => {
    debugLog('Resetting new items counter')
    setNewItemsSinceScroll(0)
  }, [debugLog])

  /**
   * Notify that new items were added
   */
  const notifyNewItems = useCallback(
    (count = 1) => {
      const container = containerRef.current
      if (!container) return

      debugLog('New items added:', count, 'autoScroll:', autoScrollRef.current)

      // If auto-scroll is enabled, scroll to bottom
      if (autoScrollRef.current) {
        // Small delay to ensure DOM updates are complete
        requestAnimationFrame(() => {
          if (container && autoScrollRef.current) {
            container.scrollTop = container.scrollHeight
          }
        })
      } else {
        // Track new items and notify callback
        setNewItemsSinceScroll(prev => {
          const newCount = prev + count
          onNewContentWhileScrolledUp?.(newCount)
          return newCount
        })
      }
    },
    [onNewContentWhileScrolledUp, debugLog]
  )

  return {
    autoScroll,
    newItemsSinceScroll,
    isAtBottom,
    containerRef,
    handleScroll,
    scrollToBottom,
    setAutoScroll,
    resetNewItemsCounter,
    notifyNewItems,
  }
}

export default useAutoScroll