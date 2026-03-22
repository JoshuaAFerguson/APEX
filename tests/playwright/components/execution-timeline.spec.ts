import { test, expect } from '@playwright/test'

test.describe('ExecutionTimeline Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page with ExecutionTimeline component
    // This would typically be a Storybook story or a dedicated test page
    await page.goto('http://localhost:3000/test/execution-timeline')
    await page.waitForLoadState('networkidle')
  })

  test('renders basic timeline with multiple stages', async ({ page }) => {
    // Test basic timeline rendering
    await expect(page.locator('[data-testid="execution-timeline"]')).toBeVisible()

    // Take screenshot for visual regression testing
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-basic.png')
  })

  test('renders timeline with current stage highlighted', async ({ page }) => {
    // Navigate to timeline with current stage
    await page.goto('http://localhost:3000/test/execution-timeline?currentStage=implementation')

    // Verify current stage has highlight animation
    const currentStage = page.locator('[data-testid="stage-implementation"]')
    await expect(currentStage).toHaveClass(/animate-pulse/)

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-current-stage.png')
  })

  test('renders compact timeline correctly', async ({ page }) => {
    // Navigate to compact timeline
    await page.goto('http://localhost:3000/test/execution-timeline?compact=true')

    // Verify compact styling
    const timeline = page.locator('[data-testid="execution-timeline"]')
    await expect(timeline).toBeVisible()

    // Take screenshot
    await expect(timeline).toHaveScreenshot('execution-timeline-compact.png')
  })

  test('renders timeline with timing information', async ({ page }) => {
    // Navigate to timeline with timing
    await page.goto('http://localhost:3000/test/execution-timeline?showTiming=true')

    // Verify timing elements are present
    await expect(page.locator('[data-testid="stage-timing"]').first()).toBeVisible()

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-with-timing.png')
  })

  test('renders timeline with failed stage', async ({ page }) => {
    // Navigate to timeline with failed stage
    await page.goto('http://localhost:3000/test/execution-timeline?failedStage=implementation')

    // Verify failed stage styling
    const failedStage = page.locator('[data-testid="stage-implementation"]')
    await expect(failedStage.locator('svg')).toHaveClass(/text-red-500/)

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-failed-stage.png')
  })

  test('renders timeline with progress bar', async ({ page }) => {
    // Navigate to timeline with progress bar
    await page.goto('http://localhost:3000/test/execution-timeline?animated=true')

    // Verify progress bar is present
    await expect(page.locator('[data-testid="timeline-progress"]')).toBeVisible()

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-progress-bar.png')
  })

  test('renders empty timeline state', async ({ page }) => {
    // Navigate to empty timeline
    await page.goto('http://localhost:3000/test/execution-timeline?empty=true')

    // Verify empty state message
    await expect(page.getByText('No execution stages to display')).toBeVisible()

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-empty.png')
  })

  test('renders timeline with long stage names', async ({ page }) => {
    // Navigate to timeline with long names
    await page.goto('http://localhost:3000/test/execution-timeline?longNames=true')

    // Verify text truncation
    const timeline = page.locator('[data-testid="execution-timeline"]')
    await expect(timeline).toBeVisible()

    // Take screenshot
    await expect(timeline).toHaveScreenshot('execution-timeline-long-names.png')
  })

  test('renders timeline hover states', async ({ page }) => {
    // Navigate to interactive timeline
    await page.goto('http://localhost:3000/test/execution-timeline?interactive=true')

    // Hover over first stage
    const firstStage = page.locator('[data-testid^="stage-"]').first()
    await firstStage.hover()

    // Take screenshot of hover state
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-hover.png')
  })

  test('renders timeline in dark mode', async ({ page }) => {
    // Set dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('http://localhost:3000/test/execution-timeline')

    // Take screenshot in dark mode
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-dark-mode.png')
  })

  test('renders timeline at different viewport sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:3000/test/execution-timeline?responsive=true')

    // Take mobile screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-mobile.png')

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()

    // Take tablet screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-tablet.png')

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.reload()

    // Take desktop screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-desktop.png')
  })
})

test.describe('ExecutionTimeline Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test/execution-timeline?interactive=true')
    await page.waitForLoadState('networkidle')
  })

  test('stage click interactions', async ({ page }) => {
    // Click on a stage
    const stage = page.locator('[data-testid="stage-planning"]')
    await stage.click()

    // Verify click effect (this would depend on implementation)
    await expect(stage).toHaveClass(/scale-105|hover:scale-105/)

    // Take screenshot of clicked state
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-clicked.png')
  })

  test('keyboard navigation', async ({ page }) => {
    // Tab through stages
    await page.keyboard.press('Tab')

    // Verify focus state
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()

    // Press Enter on focused stage
    await page.keyboard.press('Enter')

    // Take screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-keyboard-nav.png')
  })

  test('animation states', async ({ page }) => {
    // Navigate to animated timeline
    await page.goto('http://localhost:3000/test/execution-timeline?animated=true&currentStage=implementation')

    // Wait for animation to start
    await page.waitForTimeout(500)

    // Verify animation classes are present
    const animatedElement = page.locator('.animate-pulse')
    await expect(animatedElement).toBeVisible()

    // Take screenshot during animation
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-animated.png')
  })
})

test.describe('ExecutionTimeline Performance Tests', () => {
  test('renders large timeline efficiently', async ({ page }) => {
    // Navigate to timeline with many stages
    await page.goto('http://localhost:3000/test/execution-timeline?stageCount=20')

    // Measure performance
    const start = Date.now()
    await expect(page.locator('[data-testid="execution-timeline"]')).toBeVisible()
    const end = Date.now()

    // Verify performance is acceptable (adjust threshold as needed)
    expect(end - start).toBeLessThan(1000)

    // Take screenshot of large timeline
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-large.png')
  })

  test('handles rapid updates without flickering', async ({ page }) => {
    await page.goto('http://localhost:3000/test/execution-timeline?rapidUpdates=true')

    // Wait for updates to complete
    await page.waitForTimeout(2000)

    // Verify timeline is still stable
    await expect(page.locator('[data-testid="execution-timeline"]')).toBeVisible()

    // Take final screenshot
    await expect(page.locator('[data-testid="execution-timeline"]')).toHaveScreenshot('execution-timeline-rapid-updates.png')
  })
})

test.describe('ExecutionTimeline Accessibility Tests', () => {
  test('has proper accessibility attributes', async ({ page }) => {
    await page.goto('http://localhost:3000/test/execution-timeline?interactive=true')

    // Check ARIA attributes
    const timeline = page.locator('[data-testid="execution-timeline"]')
    await expect(timeline).toBeVisible()

    // Verify clickable stages have proper roles
    const buttons = page.locator('[role="button"]')
    const buttonCount = await buttons.count()
    expect(buttonCount).toBeGreaterThan(0)

    // Verify each button has proper accessibility attributes
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      await expect(button).toHaveAttribute('tabindex', '0')
    }
  })

  test('works with screen reader simulation', async ({ page }) => {
    await page.goto('http://localhost:3000/test/execution-timeline?interactive=true')

    // Simulate screen reader navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    // Verify accessibility is maintained
    const timeline = page.locator('[data-testid="execution-timeline"]')
    await expect(timeline).toBeVisible()

    // Take screenshot for accessibility testing
    await expect(timeline).toHaveScreenshot('execution-timeline-accessibility.png')
  })
})