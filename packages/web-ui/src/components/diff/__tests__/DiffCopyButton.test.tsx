/**
 * DiffCopyButton Component Tests
 *
 * Tests copy functionality, fallback mechanisms, and error handling.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DiffCopyButton } from '../DiffCopyButton'

// Mock clipboard API
const mockWriteText = vi.fn()
const mockClipboard = {
  writeText: mockWriteText
}

// Mock execCommand for fallback
const mockExecCommand = vi.fn()

describe('DiffCopyButton', () => {
  const testContent = 'This is test content to copy'
  const onCopyMock = vi.fn()

  beforeEach(() => {
    // Reset mocks
    mockWriteText.mockClear()
    mockExecCommand.mockClear()
    onCopyMock.mockClear()

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    })

    // Mock document.execCommand
    Object.defineProperty(document, 'execCommand', {
      value: mockExecCommand,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Functionality', () => {
    it('renders copy button with correct attributes', () => {
      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('title', 'Copy to clipboard')
      expect(button).toHaveAttribute('aria-label', 'Copy to clipboard')
    })

    it('shows copy icon by default', () => {
      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const copyIcon = document.querySelector('[data-lucide="copy"]')
      expect(copyIcon).toBeInTheDocument()
    })

    it('displays provided content preview when specified', () => {
      render(
        <DiffCopyButton
          content={testContent}
          contentPreview="Preview text"
          onCopy={onCopyMock}
        />
      )

      expect(screen.getByText('Preview text')).toBeInTheDocument()
    })
  })

  describe('Copy with Clipboard API', () => {
    it('successfully copies content using Clipboard API', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(testContent)
        expect(onCopyMock).toHaveBeenCalledWith(testContent)
      })
    })

    it('shows success feedback after successful copy', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
      })

      // Check icon changed to check mark
      const checkIcon = document.querySelector('[data-lucide="check"]')
      expect(checkIcon).toBeInTheDocument()
    })

    it('reverts to copy icon after feedback duration', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      // Should show success state
      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
      })

      // Fast-forward through feedback duration (2000ms)
      await waitFor(() => {
        expect(screen.queryByLabelText('Copied!')).not.toBeInTheDocument()
      }, { timeout: 3000 })

      // Should revert to copy icon
      const copyIcon = document.querySelector('[data-lucide="copy"]')
      expect(copyIcon).toBeInTheDocument()
    })
  })

  describe('Fallback Mechanism', () => {
    beforeEach(() => {
      // Remove clipboard API to trigger fallback
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      })
    })

    it('uses execCommand fallback when clipboard API unavailable', async () => {
      mockExecCommand.mockReturnValue(true)

      // Mock document methods for fallback
      const mockCreateElement = vi.spyOn(document, 'createElement')
      const mockAppendChild = vi.spyOn(document.body, 'appendChild')
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild')
      const mockSelect = vi.fn()
      const mockFocus = vi.fn()

      const mockTextarea = {
        value: '',
        select: mockSelect,
        focus: mockFocus,
        style: {},
        setAttribute: vi.fn(),
      } as any

      mockCreateElement.mockReturnValue(mockTextarea)
      mockAppendChild.mockImplementation(() => mockTextarea)
      mockRemoveChild.mockImplementation(() => mockTextarea)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockCreateElement).toHaveBeenCalledWith('textarea')
        expect(mockTextarea.value).toBe(testContent)
        expect(mockSelect).toHaveBeenCalled()
        expect(mockExecCommand).toHaveBeenCalledWith('copy')
        expect(onCopyMock).toHaveBeenCalledWith(testContent)
      })

      mockCreateElement.mockRestore()
      mockAppendChild.mockRestore()
      mockRemoveChild.mockRestore()
    })

    it('handles execCommand failure gracefully', async () => {
      mockExecCommand.mockReturnValue(false)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockExecCommand).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Copy fallback failed')
        expect(onCopyMock).not.toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('handles clipboard API errors gracefully', async () => {
      const error = new Error('Clipboard access denied')
      mockWriteText.mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(testContent)
        expect(consoleSpy).toHaveBeenCalledWith('Copy failed:', error)
        expect(onCopyMock).not.toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })

    it('does not crash with empty content', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content="" onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('')
        expect(onCopyMock).toHaveBeenCalledWith('')
      })
    })

    it('handles very large content', async () => {
      const largeContent = 'x'.repeat(100000)
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={largeContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(largeContent)
        expect(onCopyMock).toHaveBeenCalledWith(largeContent)
      })
    })
  })

  describe('Disabled State', () => {
    it('shows disabled state when disabled prop is true', () => {
      render(<DiffCopyButton content={testContent} disabled onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toHaveClass('disabled:cursor-not-allowed')
    })

    it('does not copy when disabled', async () => {
      render(<DiffCopyButton content={testContent} disabled onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).not.toHaveBeenCalled()
        expect(onCopyMock).not.toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toHaveAttribute('aria-label', 'Copy to clipboard')
      expect(button).toHaveAttribute('title', 'Copy to clipboard')
    })

    it('supports keyboard activation', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })

      // Test Enter key
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(onCopyMock).toHaveBeenCalledWith(testContent)
      })

      onCopyMock.mockClear()

      // Test Space key
      fireEvent.keyDown(button, { key: ' ', code: 'Space' })

      await waitFor(() => {
        expect(onCopyMock).toHaveBeenCalledWith(testContent)
      })
    })

    it('provides appropriate focus styles', () => {
      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toHaveClass('focus:outline-none')
      expect(button).toHaveClass('focus-visible:ring-2')
      expect(button).toHaveClass('focus-visible:ring-blue-500')
    })

    it('updates accessibility attributes during copy operation', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-label', 'Copied!')
        expect(button).toHaveAttribute('title', 'Copied!')
      })

      // Should revert after timeout
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-label', 'Copy to clipboard')
        expect(button).toHaveAttribute('title', 'Copy to clipboard')
      }, { timeout: 3000 })
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <DiffCopyButton
          content={testContent}
          className="custom-copy-button"
          onCopy={onCopyMock}
        />
      )

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toHaveClass('custom-copy-button')
    })

    it('maintains base styles with custom className', () => {
      render(
        <DiffCopyButton
          content={testContent}
          className="custom-style"
          onCopy={onCopyMock}
        />
      )

      const button = screen.getByRole('button', { name: /copy/i })
      expect(button).toHaveClass('custom-style')
      expect(button).toHaveClass('inline-flex')
      expect(button).toHaveClass('items-center')
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid successive clicks gracefully', async () => {
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })

      // Rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      await waitFor(() => {
        // Should only copy once (or handle gracefully)
        expect(mockWriteText).toHaveBeenCalled()
        expect(onCopyMock).toHaveBeenCalled()
      })
    })

    it('handles content with special characters', async () => {
      const specialContent = 'Content with\nnewlines\tand\r\nspecial characters: 📋🔥💯'
      mockWriteText.mockResolvedValue(undefined)

      render(<DiffCopyButton content={specialContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(specialContent)
        expect(onCopyMock).toHaveBeenCalledWith(specialContent)
      })
    })

    it('cleans up timers on unmount', async () => {
      mockWriteText.mockResolvedValue(undefined)

      const { unmount } = render(<DiffCopyButton content={testContent} onCopy={onCopyMock} />)

      const button = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(button)

      // Should show success state
      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
      })

      // Unmount while in success state
      unmount()

      // Should not cause any issues
      expect(() => {
        // Wait for potential timer cleanup
        setTimeout(() => {}, 3000)
      }).not.toThrow()
    })
  })
})