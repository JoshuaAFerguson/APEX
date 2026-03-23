import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAgentLogStream } from '../useAgentLogStream'

// Mock the WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    isConnected: vi.fn(() => true),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
    })),
  },
}))

describe('useAgentLogStream - Minimal Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize without crashing', () => {
    const { result } = renderHook(() =>
      useAgentLogStream({
        agentId: 'test-agent',
        autoConnect: false
      })
    )

    expect(result.current).toBeDefined()
    expect(typeof result.current.connect).toBe('function')
    expect(Array.isArray(result.current.logs)).toBe(true)
  })
})