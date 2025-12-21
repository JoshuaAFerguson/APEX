/**
 * Integration tests for ThoughtDisplay component
 * Tests component behavior in realistic scenarios
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThoughtDisplay } from '../ThoughtDisplay'

describe('ThoughtDisplay Integration Tests', () => {
  const user = userEvent.setup()

  describe('Real-world usage scenarios', () => {
    it('should handle a typical code analysis scenario', async () => {
      const codeAnalysisContent = `Analyzing the component structure:

1. Props interface looks good
2. State management is clean
3. Need to add error handling for edge cases
4. Consider memoization for performance

Next steps:
- Review accessibility
- Add unit tests
- Optimize rendering`

      render(
        <ThoughtDisplay
          content={codeAnalysisContent}
          label="Code Analysis"
          defaultExpanded={false}
        />
      )

      // Should start collapsed
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Analyzing the component structure')).not.toBeInTheDocument()

      // Expand to see content
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText(codeAnalysisContent)).toBeInTheDocument()
    })

    it('should handle a debugging session workflow', async () => {
      const debugContent = `Bug investigation:

Error: "Cannot read property 'length' of undefined"
Location: utils/stringHelper.js:42
Stack trace shows issue in data processing

Root cause: Missing null check before string operation
Fix: Add defensive programming checks`

      const onToggle = jest.fn()

      render(
        <ThoughtDisplay
          content={debugContent}
          label="Debug Session"
          onToggle={onToggle}
          timestamp={new Date('2024-01-15T14:30:00')}
        />
      )

      // Verify timestamp display
      expect(screen.getByText(/2:30/)).toBeInTheDocument() // Formatted time

      // Test toggle callback
      const button = screen.getByRole('button')
      await user.click(button)

      expect(onToggle).toHaveBeenCalledWith(true)
    })

    it('should handle long architectural planning content', async () => {
      const longPlanningContent = `
System Architecture Planning:

1. Frontend Architecture:
   - React 18 with Concurrent Features
   - TypeScript for type safety
   - Vite for build tooling
   - Tailwind CSS for styling

2. Backend Architecture:
   - Node.js with Express
   - PostgreSQL for primary data
   - Redis for caching
   - JWT for authentication

3. Infrastructure:
   - Docker containerization
   - Kubernetes orchestration
   - AWS cloud deployment
   - CI/CD with GitHub Actions

4. Development Workflow:
   - Feature branching strategy
   - Pull request reviews
   - Automated testing
   - Code quality gates

5. Performance Considerations:
   - Code splitting
   - Lazy loading
   - Image optimization
   - CDN distribution

This architecture should support:
- High scalability
- Developer productivity
- Maintainability
- Security best practices
      `.trim()

      render(
        <ThoughtDisplay
          content={longPlanningContent}
          label="Architecture Planning"
          defaultExpanded={true}
        />
      )

      // Should be expanded by default
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'true')

      // Should preserve multiline formatting
      const content = screen.getByText(longPlanningContent)
      expect(content).toHaveClass('whitespace-pre-wrap')
    })

    it('should handle rapid toggle interactions', async () => {
      const onToggle = jest.fn()

      render(
        <ThoughtDisplay
          content="Test content for rapid interactions"
          label="Rapid Test"
          onToggle={onToggle}
        />
      )

      const button = screen.getByRole('button')

      // Rapidly toggle multiple times
      await user.click(button) // Expand
      await user.click(button) // Collapse
      await user.click(button) // Expand
      await user.click(button) // Collapse

      expect(onToggle).toHaveBeenCalledTimes(4)
      expect(onToggle).toHaveBeenNthCalledWith(1, true)
      expect(onToggle).toHaveBeenNthCalledWith(2, false)
      expect(onToggle).toHaveBeenNthCalledWith(3, true)
      expect(onToggle).toHaveBeenNthCalledWith(4, false)
    })
  })

  describe('Accessibility integration', () => {
    it('should work with keyboard navigation flow', async () => {
      render(
        <ThoughtDisplay
          content="Accessibility test content"
          label="A11y Test"
        />
      )

      const button = screen.getByRole('button')

      // Tab to button and activate with Enter
      button.focus()
      await user.keyboard('{Enter}')
      expect(button).toHaveAttribute('aria-expanded', 'true')

      // Toggle with Space
      await user.keyboard(' ')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('should maintain focus after toggle', async () => {
      render(
        <ThoughtDisplay
          content="Focus test content"
          label="Focus Test"
        />
      )

      const button = screen.getByRole('button')

      // Click and verify focus is maintained
      await user.click(button)
      expect(document.activeElement).toBe(button)
    })

    it('should announce state changes to screen readers', async () => {
      render(
        <ThoughtDisplay
          content="Screen reader test content"
          label="SR Test"
        />
      )

      const button = screen.getByRole('button')
      const contentRegion = screen.getByRole('region')

      // Verify ARIA live regions and state announcements
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(contentRegion).toHaveAttribute('aria-labelledby', button.id)

      await user.click(button)

      expect(button).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Performance integration', () => {
    it('should handle large content without performance degradation', async () => {
      const largeContent = 'Large content block. '.repeat(1000) // ~20KB

      const startTime = performance.now()

      render(
        <ThoughtDisplay
          content={largeContent}
          label="Performance Test"
        />
      )

      const renderTime = performance.now() - startTime

      // Should render quickly even with large content
      expect(renderTime).toBeLessThan(100)

      // Should still be interactive
      const button = screen.getByRole('button')
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('should efficiently update when content changes', async () => {
      const currentContent = 'Initial content'

      const { rerender } = render(
        <ThoughtDisplay
          content={currentContent}
          label="Update Test"
        />
      )

      // Expand to show content
      const button = screen.getByRole('button')
      await user.click(button)
      expect(screen.getByText(currentContent)).toBeInTheDocument()

      // Update content multiple times
      const updates = ['Updated content 1', 'Updated content 2', 'Updated content 3']

      for (const newContent of updates) {
        const updateStart = performance.now()

        rerender(
          <ThoughtDisplay
            content={newContent}
            label="Update Test"
          />
        )

        const updateTime = performance.now() - updateStart
        expect(updateTime).toBeLessThan(50)

        // Content should update
        await waitFor(() => {
          expect(screen.getByText(newContent)).toBeInTheDocument()
        })
      }
    })
  })

  describe('Error boundaries and edge cases', () => {
    it('should handle malformed timestamp gracefully', () => {
      render(
        <ThoughtDisplay
          content="Invalid timestamp test"
          label="Timestamp Test"
          timestamp="invalid-date-string"
        />
      )

      // Component should still render without crashing
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle extremely long labels', () => {
      const longLabel = 'Very long label '.repeat(50)

      render(
        <ThoughtDisplay
          content="Long label test"
          label={longLabel}
        />
      )

      // Should truncate or handle long labels gracefully
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle special characters in all props', () => {
      const specialContent = 'Content with <script>alert("xss")</script> and other special chars: ñáéíóú 🎯'
      const specialLabel = 'Label with <div>tags</div> and "quotes" & symbols'

      render(
        <ThoughtDisplay
          content={specialContent}
          label={specialLabel}
          className="special-class <script>alert</script>"
        />
      )

      // Should render safely without executing any embedded scripts
      expect(screen.getByRole('button')).toBeInTheDocument()

      // Expand to verify content is properly escaped
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Content should be displayed as text, not executed
      expect(screen.getByText(specialContent)).toBeInTheDocument()
    })

    it('should handle rapid prop changes without breaking', async () => {
      let toggle = false
      let counter = 0

      const { rerender } = render(
        <ThoughtDisplay
          content={`Content ${counter}`}
          label={`Label ${counter}`}
          defaultExpanded={toggle}
        />
      )

      // Rapidly change props
      for (let i = 0; i < 100; i++) {
        counter = i
        toggle = !toggle

        rerender(
          <ThoughtDisplay
            content={`Content ${counter}`}
            label={`Label ${counter}`}
            defaultExpanded={toggle}
          />
        )
      }

      // Component should still work after rapid changes
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      await user.click(button)
    })
  })

  describe('Multi-component integration', () => {
    it('should handle multiple ThoughtDisplay components on same page', async () => {
      const thoughts = [
        { content: 'First thought', label: 'Agent 1' },
        { content: 'Second thought', label: 'Agent 2' },
        { content: 'Third thought', label: 'Agent 3' },
      ]

      render(
        <div>
          {thoughts.map((thought, index) => (
            <ThoughtDisplay
              key={index}
              content={thought.content}
              label={thought.label}
            />
          ))}
        </div>
      )

      // All buttons should be present
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)

      // Each should work independently
      await user.click(buttons[0])
      await user.click(buttons[2])

      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true')
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false')
      expect(buttons[2]).toHaveAttribute('aria-expanded', 'true')
    })

    it('should maintain unique IDs across multiple instances', () => {
      render(
        <div>
          <ThoughtDisplay content="First" label="First" />
          <ThoughtDisplay content="Second" label="Second" />
          <ThoughtDisplay content="Third" label="Third" />
        </div>
      )

      const buttons = screen.getAllByRole('button')
      const regions = screen.getAllByRole('region')

      // All should have unique IDs
      const buttonIds = buttons.map(b => b.id)
      const regionIds = regions.map(r => r.id)

      expect(new Set(buttonIds).size).toBe(buttonIds.length)
      expect(new Set(regionIds).size).toBe(regionIds.length)
    })
  })

  describe('Real-time updates simulation', () => {
    it('should handle content streaming updates', async () => {
      const content = 'Starting analysis'

      const { rerender } = render(
        <ThoughtDisplay
          content={content}
          label="Live Analysis"
          defaultExpanded={true}
        />
      )

      // Simulate streaming updates
      const updates = [
        'Starting analysis...',
        'Starting analysis... Loading data',
        'Starting analysis... Loading data... Processing',
        'Starting analysis... Loading data... Processing... Complete!'
      ]

      for (const update of updates) {
        rerender(
          <ThoughtDisplay
            content={update}
            label="Live Analysis"
            defaultExpanded={true}
          />
        )

        await waitFor(() => {
          expect(screen.getByText(update)).toBeInTheDocument()
        })
      }
    })

    it('should handle dynamic label changes', async () => {
      const { rerender } = render(
        <ThoughtDisplay
          content="Static content"
          label="Initial Label"
          defaultExpanded={true}
        />
      )

      const labelUpdates = [
        'Processing...',
        'Almost done...',
        'Complete!'
      ]

      for (const label of labelUpdates) {
        rerender(
          <ThoughtDisplay
            content="Static content"
            label={label}
            defaultExpanded={true}
          />
        )

        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })
  })
});
