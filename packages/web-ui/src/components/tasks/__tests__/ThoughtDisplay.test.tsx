/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThoughtDisplay } from '../ThoughtDisplay'

describe('ThoughtDisplay', () => {
  const defaultProps = {
    content: 'This is test thought content that should be displayed when expanded.',
  }

  it('renders collapsed by default', () => {
    render(<ThoughtDisplay {...defaultProps} />)

    // Header should be visible
    expect(screen.getByText('Thinking...')).toBeInTheDocument()

    // Chevron should not be rotated (collapsed state)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands when clicked', () => {
    render(<ThoughtDisplay {...defaultProps} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Should be expanded
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Content should be visible
    expect(screen.getByText(defaultProps.content)).toBeInTheDocument()
  })

  it('collapses when clicked twice', () => {
    render(<ThoughtDisplay {...defaultProps} />)

    const button = screen.getByRole('button')

    // Expand
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Collapse
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('respects defaultExpanded prop', () => {
    render(<ThoughtDisplay {...defaultProps} defaultExpanded={true} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Content should be visible
    expect(screen.getByText(defaultProps.content)).toBeInTheDocument()
  })

  it('displays custom label', () => {
    const customLabel = 'Analyzing code...'
    render(<ThoughtDisplay {...defaultProps} label={customLabel} />)

    expect(screen.getByText(customLabel)).toBeInTheDocument()
  })

  it('displays timestamp when provided', () => {
    const timestamp = new Date('2024-01-15T10:30:00')
    render(<ThoughtDisplay {...defaultProps} timestamp={timestamp} />)

    // Should display formatted time
    expect(screen.getByText('10:30 AM')).toBeInTheDocument()
  })

  it('calls onToggle callback when state changes', () => {
    const mockOnToggle = jest.fn()
    render(<ThoughtDisplay {...defaultProps} onToggle={mockOnToggle} />)

    const button = screen.getByRole('button')

    // Expand
    fireEvent.click(button)
    expect(mockOnToggle).toHaveBeenCalledWith(true)

    // Collapse
    fireEvent.click(button)
    expect(mockOnToggle).toHaveBeenCalledWith(false)

    expect(mockOnToggle).toHaveBeenCalledTimes(2)
  })

  it('supports keyboard navigation', () => {
    render(<ThoughtDisplay {...defaultProps} />)

    const button = screen.getByRole('button')

    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Test Space key
    fireEvent.keyDown(button, { key: ' ' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('applies custom className', () => {
    const customClass = 'custom-thought-class'
    render(<ThoughtDisplay {...defaultProps} className={customClass} />)

    const container = screen.getByRole('button').closest('div')
    expect(container).toHaveClass(customClass)
  })

  it('preserves whitespace in content', () => {
    const multilineContent = 'Line 1\n\nLine 2 with  spaces\nLine 3'
    render(<ThoughtDisplay content={multilineContent} defaultExpanded={true} />)

    const contentElement = screen.getByText(multilineContent)
    expect(contentElement).toHaveClass('whitespace-pre-wrap')
  })

  it('has proper ARIA attributes for accessibility', () => {
    render(<ThoughtDisplay {...defaultProps} />)

    const button = screen.getByRole('button')
    const contentRegion = screen.getByRole('region')

    // Check ARIA relationships
    expect(button).toHaveAttribute('aria-controls', contentRegion.id)
    expect(contentRegion).toHaveAttribute('aria-labelledby', button.id)
  })
})