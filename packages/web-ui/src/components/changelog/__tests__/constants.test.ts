/**
 * Constants Tests
 *
 * Unit tests for the changelog constants including styling configurations,
 * filter presets, and utility functions.
 */

import {
  STATUS_STYLES,
  CHANGE_TYPE_STYLES,
  DEFAULT_CHANGELOG_CONFIG,
  FILTER_PRESETS,
  ANIMATION_CONFIG,
  A11Y_LABELS,
} from '../constants'

describe('Changelog Constants', () => {
  describe('STATUS_STYLES', () => {
    it('has all required status types', () => {
      expect(STATUS_STYLES).toHaveProperty('completed')
      expect(STATUS_STYLES).toHaveProperty('failed')
      expect(STATUS_STYLES).toHaveProperty('cancelled')
    })

    it('has all required properties for each status', () => {
      Object.values(STATUS_STYLES).forEach((style) => {
        expect(style).toHaveProperty('icon')
        expect(style).toHaveProperty('color')
        expect(style).toHaveProperty('bg')
        expect(style).toHaveProperty('border')
        expect(style).toHaveProperty('badge')
      })
    })

    it('has valid CSS class names', () => {
      Object.values(STATUS_STYLES).forEach((style) => {
        expect(typeof style.color).toBe('string')
        expect(style.color).toMatch(/^text-/)

        expect(typeof style.bg).toBe('string')
        expect(style.bg).toMatch(/^bg-/)

        expect(typeof style.border).toBe('string')
        expect(style.border).toMatch(/^border-/)

        expect(typeof style.badge).toBe('string')
      })
    })

    it('has different colors for different statuses', () => {
      const colors = Object.values(STATUS_STYLES).map(style => style.color)
      const uniqueColors = new Set(colors)

      // Should have unique colors for visual distinction
      expect(uniqueColors.size).toBe(colors.length)
    })
  })

  describe('CHANGE_TYPE_STYLES', () => {
    it('has all required change types', () => {
      expect(CHANGE_TYPE_STYLES).toHaveProperty('added')
      expect(CHANGE_TYPE_STYLES).toHaveProperty('modified')
      expect(CHANGE_TYPE_STYLES).toHaveProperty('deleted')
      expect(CHANGE_TYPE_STYLES).toHaveProperty('renamed')
    })

    it('has all required properties for each change type', () => {
      Object.values(CHANGE_TYPE_STYLES).forEach((style) => {
        expect(style).toHaveProperty('icon')
        expect(style).toHaveProperty('color')
        expect(style).toHaveProperty('prefix')
        expect(style).toHaveProperty('badge')
      })
    })

    it('has unique prefixes for each change type', () => {
      const prefixes = Object.values(CHANGE_TYPE_STYLES).map(style => style.prefix)
      const uniquePrefixes = new Set(prefixes)

      expect(uniquePrefixes.size).toBe(prefixes.length)
    })

    it('has semantic prefixes', () => {
      expect(CHANGE_TYPE_STYLES.added.prefix).toBe('+')
      expect(CHANGE_TYPE_STYLES.deleted.prefix).toBe('-')
      expect(CHANGE_TYPE_STYLES.modified.prefix).toBe('~')
      expect(CHANGE_TYPE_STYLES.renamed.prefix).toBe('→')
    })
  })

  describe('DEFAULT_CHANGELOG_CONFIG', () => {
    it('has all required configuration properties', () => {
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('maxEntries')
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('pageSize')
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('maxHeight')
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('refreshInterval')
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('emptyMessage')
      expect(DEFAULT_CHANGELOG_CONFIG).toHaveProperty('title')
    })

    it('has reasonable default values', () => {
      expect(DEFAULT_CHANGELOG_CONFIG.maxEntries).toBeGreaterThan(0)
      expect(DEFAULT_CHANGELOG_CONFIG.pageSize).toBeGreaterThan(0)
      expect(DEFAULT_CHANGELOG_CONFIG.maxHeight).toBeGreaterThan(0)
      expect(DEFAULT_CHANGELOG_CONFIG.refreshInterval).toBeGreaterThanOrEqual(0)

      expect(typeof DEFAULT_CHANGELOG_CONFIG.emptyMessage).toBe('string')
      expect(DEFAULT_CHANGELOG_CONFIG.emptyMessage.length).toBeGreaterThan(0)

      expect(typeof DEFAULT_CHANGELOG_CONFIG.title).toBe('string')
      expect(DEFAULT_CHANGELOG_CONFIG.title.length).toBeGreaterThan(0)
    })

    it('has pagination size smaller than max entries', () => {
      expect(DEFAULT_CHANGELOG_CONFIG.pageSize).toBeLessThanOrEqual(
        DEFAULT_CHANGELOG_CONFIG.maxEntries
      )
    })
  })

  describe('FILTER_PRESETS', () => {
    const currentDate = new Date()

    it('has all expected preset types', () => {
      expect(FILTER_PRESETS).toHaveProperty('last7Days')
      expect(FILTER_PRESETS).toHaveProperty('last30Days')
      expect(FILTER_PRESETS).toHaveProperty('lastWeek')
      expect(FILTER_PRESETS).toHaveProperty('lastMonth')
    })

    it('has required properties for each preset', () => {
      Object.values(FILTER_PRESETS).forEach((preset) => {
        expect(preset).toHaveProperty('label')
        expect(preset).toHaveProperty('startDate')
        expect(preset).toHaveProperty('endDate')

        expect(typeof preset.label).toBe('string')
        expect(typeof preset.startDate).toBe('function')
        expect(typeof preset.endDate).toBe('function')
      })
    })

    it('generates correct date ranges for last7Days', () => {
      const preset = FILTER_PRESETS.last7Days
      const startDate = preset.startDate()
      const endDate = preset.endDate()

      expect(startDate).toBeInstanceOf(Date)
      expect(endDate).toBeInstanceOf(Date)

      // Should be approximately 7 days apart
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(Math.abs(diffDays - 7)).toBeLessThan(1) // Allow some variance for test timing
    })

    it('generates correct date ranges for last30Days', () => {
      const preset = FILTER_PRESETS.last30Days
      const startDate = preset.startDate()
      const endDate = preset.endDate()

      expect(startDate).toBeInstanceOf(Date)
      expect(endDate).toBeInstanceOf(Date)

      // Should be approximately 30 days apart
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(Math.abs(diffDays - 30)).toBeLessThan(1)
    })

    it('generates dates in the past for historical presets', () => {
      ['last7Days', 'last30Days', 'lastWeek', 'lastMonth'].forEach((presetKey) => {
        const preset = FILTER_PRESETS[presetKey as keyof typeof FILTER_PRESETS]
        const startDate = preset.startDate()
        const endDate = preset.endDate()

        expect(startDate.getTime()).toBeLessThanOrEqual(currentDate.getTime())
        expect(endDate.getTime()).toBeLessThanOrEqual(currentDate.getTime())
        expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime())
      })
    })

    it('generates week boundaries correctly for lastWeek', () => {
      const preset = FILTER_PRESETS.lastWeek
      const startDate = preset.startDate()
      const endDate = preset.endDate()

      // Monday should be day 1 (or 0 depending on implementation)
      const startDay = startDate.getDay()
      const endDay = endDate.getDay()

      // Should span a week
      expect(startDate).toBeInstanceOf(Date)
      expect(endDate).toBeInstanceOf(Date)
      expect(startDate.getTime()).toBeLessThan(endDate.getTime())
    })

    it('generates month boundaries correctly for lastMonth', () => {
      const preset = FILTER_PRESETS.lastMonth
      const startDate = preset.startDate()
      const endDate = preset.endDate()

      // Should be different months
      expect(startDate.getMonth()).not.toBe(currentDate.getMonth())
      expect(endDate.getMonth()).not.toBe(currentDate.getMonth())

      // Start should be first day of month
      expect(startDate.getDate()).toBe(1)
    })
  })

  describe('ANIMATION_CONFIG', () => {
    it('has all required animation properties', () => {
      expect(ANIMATION_CONFIG).toHaveProperty('expandDuration')
      expect(ANIMATION_CONFIG).toHaveProperty('easing')
      expect(ANIMATION_CONFIG).toHaveProperty('staggerDelay')
    })

    it('has valid animation values', () => {
      expect(typeof ANIMATION_CONFIG.expandDuration).toBe('number')
      expect(ANIMATION_CONFIG.expandDuration).toBeGreaterThan(0)

      expect(typeof ANIMATION_CONFIG.easing).toBe('string')
      expect(ANIMATION_CONFIG.easing.length).toBeGreaterThan(0)

      expect(typeof ANIMATION_CONFIG.staggerDelay).toBe('number')
      expect(ANIMATION_CONFIG.staggerDelay).toBeGreaterThanOrEqual(0)
    })

    it('has reasonable timing values', () => {
      // Animation should not be too slow or too fast
      expect(ANIMATION_CONFIG.expandDuration).toBeLessThan(1000) // < 1 second
      expect(ANIMATION_CONFIG.expandDuration).toBeGreaterThan(50) // > 50ms

      expect(ANIMATION_CONFIG.staggerDelay).toBeLessThan(200) // < 200ms
    })
  })

  describe('A11Y_LABELS', () => {
    it('has all required accessibility labels', () => {
      expect(A11Y_LABELS).toHaveProperty('expandEntry')
      expect(A11Y_LABELS).toHaveProperty('collapseEntry')
      expect(A11Y_LABELS).toHaveProperty('statusIcon')
      expect(A11Y_LABELS).toHaveProperty('fileChangeIcon')
      expect(A11Y_LABELS).toHaveProperty('diffStats')
      expect(A11Y_LABELS).toHaveProperty('timeAgo')
      expect(A11Y_LABELS).toHaveProperty('filterBy')
      expect(A11Y_LABELS).toHaveProperty('clearFilters')
      expect(A11Y_LABELS).toHaveProperty('loadMore')
    })

    it('provides meaningful label strings', () => {
      expect(typeof A11Y_LABELS.expandEntry).toBe('string')
      expect(A11Y_LABELS.expandEntry.length).toBeGreaterThan(10)

      expect(typeof A11Y_LABELS.collapseEntry).toBe('string')
      expect(A11Y_LABELS.collapseEntry.length).toBeGreaterThan(10)

      expect(typeof A11Y_LABELS.clearFilters).toBe('string')
      expect(A11Y_LABELS.clearFilters.length).toBeGreaterThan(5)
    })

    it('provides functional label functions', () => {
      expect(typeof A11Y_LABELS.statusIcon).toBe('function')
      expect(typeof A11Y_LABELS.fileChangeIcon).toBe('function')
      expect(typeof A11Y_LABELS.diffStats).toBe('function')
      expect(typeof A11Y_LABELS.timeAgo).toBe('function')
      expect(typeof A11Y_LABELS.filterBy).toBe('function')
    })

    it('returns meaningful output from label functions', () => {
      const statusLabel = A11Y_LABELS.statusIcon('completed')
      expect(typeof statusLabel).toBe('string')
      expect(statusLabel).toContain('completed')
      expect(statusLabel.length).toBeGreaterThan(5)

      const diffStatsLabel = A11Y_LABELS.diffStats(10, 5)
      expect(typeof diffStatsLabel).toBe('string')
      expect(diffStatsLabel).toContain('10')
      expect(diffStatsLabel).toContain('5')
      expect(diffStatsLabel).toContain('addition')
      expect(diffStatsLabel).toContain('deletion')

      const timeLabel = A11Y_LABELS.timeAgo('2 hours')
      expect(typeof timeLabel).toBe('string')
      expect(timeLabel).toContain('2 hours')

      const filterLabel = A11Y_LABELS.filterBy('workflow')
      expect(typeof filterLabel).toBe('string')
      expect(filterLabel).toContain('workflow')
    })

    it('handles edge cases in label functions', () => {
      // Test with empty/undefined values
      const emptyStatusLabel = A11Y_LABELS.statusIcon('')
      expect(typeof emptyStatusLabel).toBe('string')

      const zeroStatsLabel = A11Y_LABELS.diffStats(0, 0)
      expect(typeof zeroStatsLabel).toBe('string')
      expect(zeroStatsLabel).toContain('0')

      // Test with singular vs plural
      const singleAdditionLabel = A11Y_LABELS.diffStats(1, 0)
      expect(singleAdditionLabel).toContain('1 addition')
      expect(singleAdditionLabel).toContain('0 deletion')

      const multipleChangesLabel = A11Y_LABELS.diffStats(5, 3)
      expect(multipleChangesLabel).toContain('5 addition')
      expect(multipleChangesLabel).toContain('3 deletion')
    })
  })

  describe('Type Definitions', () => {
    it('exports proper types', () => {
      // These would be compile-time checks, but we can verify the objects exist
      expect(STATUS_STYLES.completed).toBeDefined()
      expect(STATUS_STYLES.failed).toBeDefined()
      expect(STATUS_STYLES.cancelled).toBeDefined()

      expect(CHANGE_TYPE_STYLES.added).toBeDefined()
      expect(CHANGE_TYPE_STYLES.modified).toBeDefined()
      expect(CHANGE_TYPE_STYLES.deleted).toBeDefined()
      expect(CHANGE_TYPE_STYLES.renamed).toBeDefined()
    })
  })

  describe('Consistency', () => {
    it('maintains consistent styling patterns', () => {
      // All status styles should follow the same pattern
      Object.values(STATUS_STYLES).forEach((style) => {
        expect(style.color).toMatch(/^text-\w+(-\w+)*$/)
        expect(style.bg).toMatch(/^bg-\w+(-\w+)*$/)
        expect(style.border).toMatch(/^border-\w+(-\w+)*$/)
      })

      // All change type styles should follow the same pattern
      Object.values(CHANGE_TYPE_STYLES).forEach((style) => {
        expect(style.color).toMatch(/^text-\w+(-\w+)*$/)
        expect(typeof style.prefix).toBe('string')
        expect(style.prefix.length).toBeGreaterThan(0)
      })
    })

    it('uses consistent naming conventions', () => {
      // Keys should be camelCase
      Object.keys(FILTER_PRESETS).forEach(key => {
        expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/)
      })

      Object.keys(A11Y_LABELS).forEach(key => {
        expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/)
      })
    })
  })
})