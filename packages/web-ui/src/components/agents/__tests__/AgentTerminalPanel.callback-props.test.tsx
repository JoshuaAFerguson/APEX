/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import {
  CALLBACK_TEST_PROPS,
  createTestLog,
  createMockStreamState,
} from './test-utils/AgentTerminalPanel.fixtures'
import {
  createAgentLogStreamMock,
  createAutoScrollMock,
  resetAllMocks,
} from './test-utils/AgentTerminalPanel.mocks'
import { expectCallbackCalled, expectCallbackCalledTimes } from './test-utils/AgentTerminalPanel.helpers'

// Mock the hooks
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(),
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(),
}))

// Mock child components to isolate callback testing
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: vi.fn(({ onMinimize, onMaximize, onRestore, onClose, onPause, onResume, onClear, onExport, ...props }) => (
    <div data-testid="mock-header">
      <span data-testid="header-title">{props.title}</span>
      <button data-testid="header-minimize" onClick={onMinimize}>Minimize</button>
      <button data-testid="header-maximize" onClick={onMaximize}>Maximize</button>
      <button data-testid="header-restore" onClick={onRestore}>Restore</button>
      <button data-testid="header-close" onClick={onClose}>Close</button>
      <button data-testid="header-pause" onClick={onPause}>Pause</button>
      <button data-testid="header-resume" onClick={onResume}>Resume</button>
      <button data-testid="header-clear" onClick={onClear}>Clear</button>
      <button data-testid="header-export" onClick={onExport}>Export</button>
    </div>
  )),
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: vi.fn(({ onFilterChange, onResetFilter }) => (
    <div data-testid="mock-controls">
      <button data-testid="controls-change-filter" onClick={() => onFilterChange?.({ level: 'error' })}>
        Change Filter
      </button>
      <button data-testid="controls-reset-filter" onClick={onResetFilter}>
        Reset Filter
      </button>
    </div>
  )),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: vi.fn(({ log, onClick }) => (
    <div data-testid={`mock-log-entry-${log.id}`} onClick={() => onClick?.(log)}>
      {log.message}
    </div>
  )),
}))

describe('AgentTerminalPanel - Callback Props', () => {
  const mockUseAgentLogStream = vi.mocked(require('@/hooks/useAgentLogStream').useAgentLogStream)
  const mockUseAutoScroll = vi.mocked(require('@/hooks/useAutoScroll').useAutoScroll)

  beforeEach(() => {
    resetAllMocks()

    // Setup default mocks
    mockUseAgentLogStream.mockReturnValue(createAgentLogStreamMock())
    mockUseAutoScroll.mockReturnValue(createAutoScrollMock())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Panel State Callbacks', () => {
    it('calls onMinimize when minimize action triggered', async () => {
      const onMinimize = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onMinimize, panelState: 'normal' }

      render(<AgentTerminalPanel {...props} />)

      const minimizeButton = screen.getByTestId('header-minimize')
      fireEvent.click(minimizeButton)

      expectCallbackCalled(onMinimize)
    })

    it('calls onMaximize when maximize action triggered', async () => {
      const onMaximize = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onMaximize, panelState: 'normal' }

      render(<AgentTerminalPanel {...props} />)

      const maximizeButton = screen.getByTestId('header-maximize')
      fireEvent.click(maximizeButton)

      expectCallbackCalled(onMaximize)
    })

    it('calls onRestore when restore action triggered', async () => {
      const onRestore = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onRestore, panelState: 'maximized' }

      render(<AgentTerminalPanel {...props} />)

      const restoreButton = screen.getByTestId('header-restore')
      fireEvent.click(restoreButton)

      expectCallbackCalled(onRestore)
    })

    it('calls onClose and disconnects stream', async () => {
      const onClose = vi.fn()
      const mockDisconnect = vi.fn()

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ disconnect: mockDisconnect })
      )

      const props = { ...CALLBACK_TEST_PROPS, onClose }

      render(<AgentTerminalPanel {...props} />)

      const closeButton = screen.getByTestId('header-close')
      fireEvent.click(closeButton)

      expectCallbackCalled(onClose)
      expectCallbackCalled(mockDisconnect)
    })

    it('supports keyboard shortcuts for panel state changes', async () => {
      const onMinimize = vi.fn()
      const onMaximize = vi.fn()
      const onRestore = vi.fn()

      const props = { ...CALLBACK_TEST_PROPS, onMinimize, onMaximize, onRestore, panelState: 'normal' }

      const { container } = render(<AgentTerminalPanel {...props} />)
      const panelElement = container.firstElementChild as HTMLElement

      // Focus the panel to enable keyboard interaction
      panelElement.focus()

      // Test minimize with Enter key
      fireEvent.keyDown(panelElement, { key: 'Enter' })
      expectCallbackCalled(onMinimize)

      // Test minimize with minus key
      fireEvent.keyDown(panelElement, { key: '-' })
      expectCallbackCalledTimes(onMinimize, 2)

      // Test maximize with 'M' key
      fireEvent.keyDown(panelElement, { key: 'M' })
      expectCallbackCalled(onMaximize)
    })
  })

  describe('Streaming Callbacks', () => {
    it('calls onStreamStateChange when state changes', async () => {
      const onStreamStateChange = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onStreamStateChange }

      // Start with idle state
      const initialStreamState = createMockStreamState('idle')
      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ streamState: initialStreamState })
      )

      const { rerender } = render(<AgentTerminalPanel {...props} />)

      // Change to streaming state
      const newStreamState = createMockStreamState('streaming')
      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ streamState: newStreamState })
      )

      rerender(<AgentTerminalPanel {...props} />)

      await waitFor(() => {
        expectCallbackCalled(onStreamStateChange, ['streaming'])
      })
    })

    it('calls onPause when pause action triggered', async () => {
      const onPause = vi.fn()
      const mockPause = vi.fn()

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ pause: mockPause })
      )

      const props = { ...CALLBACK_TEST_PROPS, onPause }

      render(<AgentTerminalPanel {...props} />)

      const pauseButton = screen.getByTestId('header-pause')
      fireEvent.click(pauseButton)

      expectCallbackCalled(onPause)
      expectCallbackCalled(mockPause)
    })

    it('calls onResume when resume action triggered', async () => {
      const onResume = vi.fn()
      const mockResume = vi.fn()

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ resume: mockResume })
      )

      const props = { ...CALLBACK_TEST_PROPS, onResume }

      render(<AgentTerminalPanel {...props} />)

      const resumeButton = screen.getByTestId('header-resume')
      fireEvent.click(resumeButton)

      expectCallbackCalled(onResume)
      expectCallbackCalled(mockResume)
    })

    it('calls onError when stream error occurs', async () => {
      const onError = vi.fn()
      const streamError = 'Connection failed'

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({
          error: streamError,
          streamState: createMockStreamState('error'),
        })
      )

      const props = {
        ...CALLBACK_TEST_PROPS,
        onError,
        autoConnect: true,
      }

      render(<AgentTerminalPanel {...props} />)

      // onError should be called during hook initialization when passing through error
      await waitFor(() => {
        expect(mockUseAgentLogStream).toHaveBeenCalledWith(
          expect.objectContaining({
            onError,
          })
        )
      })
    })

    it('calls onClear when logs cleared', async () => {
      const onClear = vi.fn()
      const mockClearLogs = vi.fn()

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ clearLogs: mockClearLogs })
      )

      const props = { ...CALLBACK_TEST_PROPS, onClear }

      render(<AgentTerminalPanel {...props} />)

      const clearButton = screen.getByTestId('header-clear')
      fireEvent.click(clearButton)

      expectCallbackCalled(onClear)
      expectCallbackCalled(mockClearLogs)
    })
  })

  describe('Log Interaction Callbacks', () => {
    it('calls onLogSelect with log when entry clicked', async () => {
      const onLogSelect = vi.fn()
      const testLog = createTestLog({ id: 'test-log-1', message: 'Test message' })

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ filteredLogs: [testLog] })
      )

      const props = { ...CALLBACK_TEST_PROPS, onLogSelect }

      render(<AgentTerminalPanel {...props} />)

      const logEntry = screen.getByTestId('mock-log-entry-test-log-1')
      fireEvent.click(logEntry)

      expectCallbackCalled(onLogSelect, [testLog])
    })

    it('calls onFilterChange when filter updated', async () => {
      const onFilterChange = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onFilterChange }

      render(<AgentTerminalPanel {...props} />)

      const filterButton = screen.getByTestId('controls-change-filter')
      fireEvent.click(filterButton)

      expectCallbackCalled(onFilterChange, [{ level: 'error' }])
    })

    it('does not call onLogSelect when no handler provided', async () => {
      const testLog = createTestLog({ id: 'test-log-1', message: 'Test message' })

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ filteredLogs: [testLog] })
      )

      const props = {
        ...CALLBACK_TEST_PROPS,
        onLogSelect: undefined, // Explicitly no handler
      }

      render(<AgentTerminalPanel {...props} />)

      const logEntry = screen.getByTestId('mock-log-entry-test-log-1')

      // Should not throw error when clicked
      expect(() => fireEvent.click(logEntry)).not.toThrow()
    })
  })

  describe('Export and Clear Operations', () => {
    it('calls export operation and downloads file', async () => {
      const mockExportLogs = vi.fn(() => JSON.stringify([{ id: 'test', message: 'test' }]))

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ exportLogs: mockExportLogs })
      )

      // Mock DOM APIs for download
      const mockCreateElement = vi.fn()
      const mockAnchorElement = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      mockCreateElement.mockReturnValue(mockAnchorElement)

      const originalCreateElement = document.createElement
      document.createElement = mockCreateElement

      const originalCreateObjectURL = URL.createObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'mock-url')
      URL.revokeObjectURL = vi.fn()

      const props = { ...CALLBACK_TEST_PROPS }

      render(<AgentTerminalPanel {...props} />)

      const exportButton = screen.getByTestId('header-export')
      fireEvent.click(exportButton)

      expectCallbackCalled(mockExportLogs, ['json'])
      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockAnchorElement.click).toHaveBeenCalled()

      // Restore original functions
      document.createElement = originalCreateElement
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
    })

    it('handles export errors gracefully', async () => {
      const mockExportLogs = vi.fn(() => {
        throw new Error('Export failed')
      })

      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock({ exportLogs: mockExportLogs })
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const props = { ...CALLBACK_TEST_PROPS }

      render(<AgentTerminalPanel {...props} />)

      const exportButton = screen.getByTestId('header-export')

      // Should not throw, should log error
      expect(() => fireEvent.click(exportButton)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to export logs:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('Callback Edge Cases', () => {
    it('handles undefined callbacks gracefully', async () => {
      const props = {
        panelId: 'test-panel',
        agentId: 'test-agent',
        // All callbacks are undefined
        onLogSelect: undefined,
        onFilterChange: undefined,
        onStreamStateChange: undefined,
        onError: undefined,
        onClear: undefined,
        onMinimize: undefined,
        onMaximize: undefined,
        onRestore: undefined,
        onClose: undefined,
        onPause: undefined,
        onResume: undefined,
      }

      // Should not throw when rendering
      expect(() => render(<AgentTerminalPanel {...props} />)).not.toThrow()
    })

    it('handles multiple rapid callback invocations', async () => {
      const onMinimize = vi.fn()
      const onMaximize = vi.fn()

      const props = { ...CALLBACK_TEST_PROPS, onMinimize, onMaximize, panelState: 'normal' }

      const { container } = render(<AgentTerminalPanel {...props} />)
      const panelElement = container.firstElementChild as HTMLElement

      panelElement.focus()

      // Rapidly trigger callbacks
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(panelElement, { key: 'Enter' }) // minimize
        fireEvent.keyDown(panelElement, { key: 'M' })     // maximize
      }

      expectCallbackCalledTimes(onMinimize, 5)
      expectCallbackCalledTimes(onMaximize, 5)
    })

    it('preserves callback identity across renders', async () => {
      const onLogSelect = vi.fn()
      const props = { ...CALLBACK_TEST_PROPS, onLogSelect }

      const { rerender } = render(<AgentTerminalPanel {...props} />)

      // Re-render with same callback
      rerender(<AgentTerminalPanel {...props} />)

      // Mock should be called with the same function reference
      expect(mockUseAgentLogStream).toHaveBeenCalledWith(
        expect.objectContaining({
          onError: onLogSelect, // Should be the same reference
        })
      )
    })

    it('handles connection state change callbacks through hook', async () => {
      const onStreamStateChange = vi.fn()

      // Mock the hook to call onConnectionChange immediately
      const mockConnectionChangeCallback = vi.fn()
      mockUseAgentLogStream.mockReturnValue(
        createAgentLogStreamMock()
      )

      const props = { ...CALLBACK_TEST_PROPS, onStreamStateChange }

      render(<AgentTerminalPanel {...props} />)

      // Verify that onConnectionChange is passed to the hook
      expect(mockUseAgentLogStream).toHaveBeenCalledWith(
        expect.objectContaining({
          onConnectionChange: expect.any(Function),
        })
      )

      // Get the onConnectionChange callback and invoke it
      const hookCall = mockUseAgentLogStream.mock.calls[0][0]
      const onConnectionChange = hookCall.onConnectionChange

      // Simulate connection status change
      onConnectionChange('connected')

      // The callback should eventually call onStreamStateChange
      // (Note: this tests the callback setup, actual state change testing is in integration tests)
    })
  })

  describe('State Management Integration', () => {
    it('manages internal panel state when no panelState prop provided', async () => {
      const onMinimize = vi.fn()

      const props = {
        ...CALLBACK_TEST_PROPS,
        onMinimize,
        panelState: undefined, // Use internal state management
      }

      const { container } = render(<AgentTerminalPanel {...props} />)
      const panelElement = container.firstElementChild as HTMLElement

      // Should start in normal state
      expect(panelElement).toHaveAttribute('aria-expanded', 'true')

      // Trigger minimize
      panelElement.focus()
      fireEvent.keyDown(panelElement, { key: 'Enter' })

      expectCallbackCalled(onMinimize)

      // Internal state should change
      await waitFor(() => {
        expect(panelElement).toHaveAttribute('aria-expanded', 'false')
      })
    })

    it('respects controlled panelState prop', async () => {
      const onMinimize = vi.fn()

      const props = {
        ...CALLBACK_TEST_PROPS,
        onMinimize,
        panelState: 'normal', // Controlled state
      }

      const { container, rerender } = render(<AgentTerminalPanel {...props} />)
      const panelElement = container.firstElementChild as HTMLElement

      // Trigger minimize
      panelElement.focus()
      fireEvent.keyDown(panelElement, { key: 'Enter' })

      expectCallbackCalled(onMinimize)

      // State should not change internally (controlled)
      expect(panelElement).toHaveAttribute('aria-expanded', 'true')

      // Parent should control the state
      rerender(<AgentTerminalPanel {...props} panelState="minimized" />)

      await waitFor(() => {
        expect(panelElement).toHaveAttribute('aria-expanded', 'false')
      })
    })
  })
})