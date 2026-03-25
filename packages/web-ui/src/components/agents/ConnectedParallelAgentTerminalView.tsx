'use client'

import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
  useRef,
  useCallback
} from 'react'
import { ParallelAgentTerminalView } from './ParallelAgentTerminalView'
import type { ParallelAgentTerminalViewRef } from './ParallelAgentTerminalView.types'
import { useAgentTerminals } from '@/hooks/useAgentTerminals'
import type {
  ConnectedParallelAgentTerminalViewProps,
  ConnectedParallelAgentTerminalViewRef,
} from './ConnectedParallelAgentTerminalView.types'

/**
 * ConnectedParallelAgentTerminalView - Integration wrapper for ParallelAgentTerminalView + useAgentTerminals
 *
 * This component connects the ParallelAgentTerminalView grid layout component to the
 * useAgentTerminals WebSocket log streaming hook, providing a fully-integrated experience
 * for monitoring multiple parallel agent executions.
 *
 * Key Features:
 * - Automatic agent registration/unregistration based on agents prop
 * - Centralized WebSocket connection management via useAgentTerminals
 * - Combined ref API exposing both panel controls and streaming controls
 * - Single-component solution for parallel agent monitoring with live data
 *
 * @example
 * ```tsx
 * const agentConfigs = [
 *   { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
 *   { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
 * ]
 *
 * <ConnectedParallelAgentTerminalView
 *   agents={agentConfigs}
 *   gap="md"
 *   autoConnect={true}
 *   onLogs={(agentId, logs) => console.log(`Agent ${agentId} logs:`, logs)}
 * />
 * ```
 */
export const ConnectedParallelAgentTerminalView = forwardRef<
  ConnectedParallelAgentTerminalViewRef,
  ConnectedParallelAgentTerminalViewProps
>(({
  agents,
  gap = 'md',
  maxHeight = 'auto',
  panelStates,
  onPanelStateChange,
  onPanelClose,
  className,
  testId = 'connected-parallel-agent-terminal-view',
  displayMode = 'normal',
  showLoadingSkeleton = false,
  autoConnect = true,
  defaultMaxLogs = 500,
  onLogs,
  onError,
  onConnectionChange,
  debug = false,
}, ref) => {

  // ============================================================================
  // Refs and State
  // ============================================================================

  // Ref to the underlying ParallelAgentTerminalView
  const viewRef = useRef<ParallelAgentTerminalViewRef>(null)

  // Track previous agents for registration diff
  const prevAgentIdsRef = useRef<Set<string>>(new Set())

  // ============================================================================
  // Hook Integration
  // ============================================================================

  // Initialize useAgentTerminals hook with options
  const {
    agents: agentStates,
    agentIds,
    connectionHealth,
    aggregateStats,
    getAgentState,
    getAgentLogs,
    getAgentFilteredLogs,
    getAgentConnectionStatus,
    registerAgent,
    unregisterAgent,
    isAgentRegistered,
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,
    connect,
    disconnect,
    isConnected,
    isReconnecting,
  } = useAgentTerminals({
    autoConnect,
    defaultMaxLogs,
    onLogs,
    onError,
    onConnectionChange,
    debug,
  })

  // ============================================================================
  // Auto-registration Logic
  // ============================================================================

  /**
   * Auto-register/unregister agents when agents prop changes
   * This implements the declarative agent management pattern
   */
  useEffect(() => {
    const currentAgentIds = new Set(agents.map(a => a.agentId))
    const prevAgentIds = prevAgentIdsRef.current

    // Register new agents
    agents.forEach(agent => {
      if (!prevAgentIds.has(agent.agentId) && !isAgentRegistered(agent.agentId)) {
        try {
          registerAgent({
            agentId: agent.agentId,
            agentName: agent.title,
            maxLogs: agent.maxLogs,
            initialFilter: agent.initialFilter,
            autoStart: agent.autoStart,
          })

          if (debug) {
            console.log('[ConnectedParallelAgentTerminalView] Registered agent:', agent.agentId)
          }
        } catch (error) {
          console.error('[ConnectedParallelAgentTerminalView] Failed to register agent:', agent.agentId, error)
          onError?.(agent.agentId, error instanceof Error ? error.message : 'Registration failed')
        }
      }
    })

    // Unregister removed agents
    prevAgentIds.forEach(id => {
      if (!currentAgentIds.has(id)) {
        try {
          unregisterAgent(id)

          if (debug) {
            console.log('[ConnectedParallelAgentTerminalView] Unregistered agent:', id)
          }
        } catch (error) {
          console.error('[ConnectedParallelAgentTerminalView] Failed to unregister agent:', id, error)
        }
      }
    })

    // Update tracking ref
    prevAgentIdsRef.current = currentAgentIds

    // Cleanup function for unmount
    return () => {
      currentAgentIds.forEach(id => {
        if (isAgentRegistered(id)) {
          try {
            unregisterAgent(id)
            if (debug) {
              console.log('[ConnectedParallelAgentTerminalView] Cleanup unregistered agent:', id)
            }
          } catch (error) {
            console.error('[ConnectedParallelAgentTerminalView] Failed to cleanup agent:', id, error)
          }
        }
      })
    }
  }, [agents, registerAgent, unregisterAgent, isAgentRegistered, onError, debug])

  // ============================================================================
  // Panel Config Transformation
  // ============================================================================

  /**
   * Transform ConnectedAgentConfig[] to AgentTerminalPanelConfig[]
   * This bridges the gap between the hook's data and the view's requirements
   */
  const panelConfigs = useMemo(() => {
    return agents.map(agent => {
      const agentState = getAgentState(agent.agentId)

      // Note: We set autoConnect: false because connection is managed centrally
      // The individual panels don't need to manage their own WebSocket connections
      return {
        panelId: agent.panelId,
        agentId: agent.agentId,
        title: agent.title,
        agentStatus: agent.agentStatus,
        initialState: agent.initialState,
        autoConnect: false, // Managed centrally by useAgentTerminals
        panelProps: {
          ...agent.panelProps,
          // Future enhancement: inject logs when AgentTerminalPanel supports controlled mode
          // logs: agentState?.filteredLogs,
          // streamState: agentState?.streamState,
        },
      }
    })
  }, [agents, getAgentState])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle panel close - also unregister the associated agent
   */
  const handlePanelClose = useCallback((panelId: string) => {
    const agent = agents.find(a => a.panelId === panelId)
    if (agent) {
      try {
        unregisterAgent(agent.agentId)

        if (debug) {
          console.log('[ConnectedParallelAgentTerminalView] Panel closed, unregistered agent:', agent.agentId)
        }
      } catch (error) {
        console.error('[ConnectedParallelAgentTerminalView] Failed to unregister agent on close:', agent.agentId, error)
        onError?.(agent.agentId, error instanceof Error ? error.message : 'Unregistration failed')
      }
    }

    // Call parent callback
    onPanelClose?.(panelId)
  }, [agents, unregisterAgent, onPanelClose, onError, debug])

  // ============================================================================
  // Imperative Handle (Ref API)
  // ============================================================================

  /**
   * Expose combined ref API that includes both view controls and stream controls
   */
  useImperativeHandle(ref, () => ({
    // === Panel View Controls (delegated to ParallelAgentTerminalView) ===
    minimizeAll: () => viewRef.current?.minimizeAll(),
    restoreAll: () => viewRef.current?.restoreAll(),
    getAllStates: () => viewRef.current?.getAllStates() ?? {},
    maximizePanel: (panelId: string) => viewRef.current?.maximizePanel(panelId),
    focusPanel: (panelId: string) => viewRef.current?.focusPanel(panelId),

    // === Per-Agent Stream Controls ===
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    getAgentLogs,
    getAgentFilteredLogs,

    // === Bulk Stream Controls ===
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,

    // === Agent Registration ===
    registerAgent,
    unregisterAgent,
    isAgentRegistered,

    // === Status ===
    getAggregateStats: () => aggregateStats,
    isConnected,
    isReconnecting,
  }), [
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    getAgentLogs,
    getAgentFilteredLogs,
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,
    registerAgent,
    unregisterAgent,
    isAgentRegistered,
    aggregateStats,
    isConnected,
    isReconnecting,
  ])

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <ParallelAgentTerminalView
      ref={viewRef}
      panels={panelConfigs}
      gap={gap}
      maxHeight={maxHeight}
      panelStates={panelStates}
      onPanelStateChange={onPanelStateChange}
      onPanelClose={handlePanelClose}
      className={className}
      testId={testId}
      displayMode={displayMode}
      showLoadingSkeleton={showLoadingSkeleton}
    />
  )
})

ConnectedParallelAgentTerminalView.displayName = 'ConnectedParallelAgentTerminalView'