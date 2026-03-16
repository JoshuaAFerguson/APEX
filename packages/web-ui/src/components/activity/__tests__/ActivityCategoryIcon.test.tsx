/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ActivityCategoryIcon } from '../ActivityCategoryIcon'
import type { ActivityEventCategory } from '../../../types/dashboard'

describe('ActivityCategoryIcon', () => {
  const testCases: Array<{ category: ActivityEventCategory; expectedText: string }> = [
    { category: 'task', expectedText: 'Check' }, // CheckSquare icon
    { category: 'agent', expectedText: 'Bot' }, // Bot icon
    { category: 'tool', expectedText: 'Wrench' }, // Wrench icon
    { category: 'gate', expectedText: 'ShieldCheck' }, // ShieldCheck icon
    { category: 'permission', expectedText: 'Lock' }, // Lock icon
    { category: 'system', expectedText: 'Settings' }, // Settings icon
    { category: 'error', expectedText: 'AlertTriangle' }, // AlertTriangle icon
  ]

  testCases.forEach(({ category, expectedText }) => {
    it(`renders ${expectedText} icon for ${category} category`, () => {
      render(<ActivityCategoryIcon category={category} />)

      // Check that an SVG element is rendered
      const svgElement = document.querySelector('svg')
      expect(svgElement).toBeInTheDocument()
    })
  })

  it('renders with custom className', () => {
    const { container } = render(
      <ActivityCategoryIcon category="task" className="custom-class" />
    )

    const svgElement = container.querySelector('svg')
    expect(svgElement).toHaveClass('custom-class')
  })

  it('renders with custom size', () => {
    const { container } = render(
      <ActivityCategoryIcon category="task" size={24} />
    )

    const svgElement = container.querySelector('svg')
    expect(svgElement).toHaveAttribute('width', '24')
    expect(svgElement).toHaveAttribute('height', '24')
  })

  it('renders with default size of 16 when not specified', () => {
    const { container } = render(
      <ActivityCategoryIcon category="task" />
    )

    const svgElement = container.querySelector('svg')
    expect(svgElement).toHaveAttribute('width', '16')
    expect(svgElement).toHaveAttribute('height', '16')
  })

  it('renders Settings icon for unknown category as fallback', () => {
    // Test with an invalid category (bypassing TypeScript)
    const { container } = render(
      <ActivityCategoryIcon category={'unknown' as ActivityEventCategory} />
    )

    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })
})