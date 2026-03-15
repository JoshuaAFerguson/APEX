import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressIndicator } from '../ProgressIndicator'

describe('ProgressIndicator', () => {
  it('renders with default props', () => {
    const { container } = render(<ProgressIndicator />)
    const indicator = container.firstChild as HTMLElement
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveClass('relative', 'rounded-full', 'overflow-hidden', 'h-2', 'bg-background-tertiary')
  })

  it('renders with specified progress value', () => {
    const { container } = render(<ProgressIndicator value={50} />)
    const progressFill = container.querySelector('div div') as HTMLElement
    expect(progressFill).toHaveStyle('width: 50%')
  })

  it('clamps value between 0 and 100', () => {
    const { container, rerender } = render(<ProgressIndicator value={150} />)
    let progressFill = container.querySelector('div div') as HTMLElement
    expect(progressFill).toHaveStyle('width: 100%')

    rerender(<ProgressIndicator value={-10} />)
    progressFill = container.querySelector('div div') as HTMLElement
    expect(progressFill).toHaveStyle('width: 0%')
  })

  it('applies indeterminate animation', () => {
    const { container } = render(<ProgressIndicator indeterminate />)
    const progressFill = container.querySelector('div div') as HTMLElement
    expect(progressFill).toHaveClass('animate-pulse')
    expect(progressFill).toHaveStyle('width: 100%')
  })

  it('applies size variants correctly', () => {
    const { container, rerender } = render(<ProgressIndicator size="sm" />)
    let indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('h-1')

    rerender(<ProgressIndicator size="md" />)
    indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('h-2')

    rerender(<ProgressIndicator size="lg" />)
    indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('h-3')
  })

  it('applies color variants correctly', () => {
    const { container, rerender } = render(<ProgressIndicator variant="success" />)
    let indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('bg-green-950/30')

    rerender(<ProgressIndicator variant="error" />)
    indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('bg-red-950/30')

    rerender(<ProgressIndicator variant="warning" />)
    indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('bg-yellow-950/30')

    rerender(<ProgressIndicator variant="info" />)
    indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('bg-apex-950/30')
  })

  it('applies custom className', () => {
    const { container } = render(<ProgressIndicator className="custom-class" />)
    const indicator = container.firstChild as HTMLElement
    expect(indicator).toHaveClass('custom-class')
  })
})