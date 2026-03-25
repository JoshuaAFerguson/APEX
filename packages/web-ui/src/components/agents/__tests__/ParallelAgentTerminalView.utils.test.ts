/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest'
import {
  getExtendedGridLayoutClasses,
  getGridLayoutWithGap,
  validatePanelConfigurations,
  generatePanelId,
  getResponsiveWarning,
  getRecommendedDisplayMode,
  getPerformanceWarning,
  getOverflowClasses,
  EXTENDED_GRID_CONFIGS,
  GAP_CONFIGS,
} from '../ParallelAgentTerminalView.utils'
import type { AgentTerminalPanelConfig } from '../ParallelAgentTerminalView.types'

describe('ParallelAgentTerminalView.utils', () => {
  describe('EXTENDED_GRID_CONFIGS', () => {
    it('should contain configurations for 1-12 panels', () => {
      for (let i = 1; i <= 12; i++) {
        expect(EXTENDED_GRID_CONFIGS[i]).toBeDefined()
        expect(typeof EXTENDED_GRID_CONFIGS[i]).toBe('string')
      }
    })

    it('should contain proper CSS grid classes', () => {
      Object.values(EXTENDED_GRID_CONFIGS).forEach((config) => {
        expect(config).toMatch(/grid/)
        expect(config).toMatch(/grid-cols-/)
        expect(config).toMatch(/gap-/)
      })
    })

    it('should have responsive breakpoints', () => {
      const config = EXTENDED_GRID_CONFIGS[8]
      expect(config).toMatch(/sm:grid-cols-/)
      expect(config).toMatch(/lg:grid-cols-/)
      expect(config).toMatch(/xl:grid-cols-/)
    })
  })

  describe('GAP_CONFIGS', () => {
    it('should provide correct gap classes', () => {
      expect(GAP_CONFIGS.sm).toBe('gap-2')
      expect(GAP_CONFIGS.md).toBe('gap-4')
      expect(GAP_CONFIGS.lg).toBe('gap-6')
    })
  })

  describe('getExtendedGridLayoutClasses', () => {
    it('should return single column for maximized state', () => {
      const result = getExtendedGridLayoutClasses(6, true)
      expect(result).toBe('grid grid-cols-1')
    })

    it('should return correct grid classes for valid panel counts', () => {
      const testCases = [1, 2, 3, 4, 6, 8, 10, 12]

      testCases.forEach((count) => {
        const result = getExtendedGridLayoutClasses(count, false)
        expect(result).toBe(EXTENDED_GRID_CONFIGS[count])
      })
    })

    it('should clamp panel count to 1-12 range', () => {
      // Test lower bound
      expect(getExtendedGridLayoutClasses(0, false)).toBe(EXTENDED_GRID_CONFIGS[1])
      expect(getExtendedGridLayoutClasses(-5, false)).toBe(EXTENDED_GRID_CONFIGS[1])

      // Test upper bound
      expect(getExtendedGridLayoutClasses(15, false)).toBe(EXTENDED_GRID_CONFIGS[12])
      expect(getExtendedGridLayoutClasses(100, false)).toBe(EXTENDED_GRID_CONFIGS[12])
    })

    it('should handle decimal panel counts', () => {
      expect(getExtendedGridLayoutClasses(4.7, false)).toBe(EXTENDED_GRID_CONFIGS[4])
      expect(getExtendedGridLayoutClasses(8.9, false)).toBe(EXTENDED_GRID_CONFIGS[8])
    })
  })

  describe('getGridLayoutWithGap', () => {
    it('should replace default gap with custom gap', () => {
      const result = getGridLayoutWithGap(4, false, 'lg')
      expect(result).toMatch(/gap-6/)
      expect(result).not.toMatch(/gap-2/)
    })

    it('should use medium gap by default', () => {
      const result = getGridLayoutWithGap(4, false)
      expect(result).toMatch(/gap-4/)
    })

    it('should handle all gap sizes', () => {
      const gapSizes = ['sm', 'md', 'lg'] as const
      gapSizes.forEach((gap) => {
        const result = getGridLayoutWithGap(4, false, gap)
        expect(result).toMatch(new RegExp(GAP_CONFIGS[gap]))
      })
    })

    it('should work with maximized state', () => {
      const result = getGridLayoutWithGap(6, true, 'sm')
      expect(result).toBe('grid grid-cols-1')
    })
  })

  describe('validatePanelConfigurations', () => {
    it('should validate valid panel configurations', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
        { panelId: 'panel-2', agentId: 'agent-2' },
      ]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validatedPanels).toHaveLength(2)
      expect(result.validatedPanels[0].title).toBe('Agent agent-1')
      expect(result.validatedPanels[0].autoConnect).toBe(true)
      expect(result.validatedPanels[0].initialState).toBe('normal')
    })

    it('should handle empty panels array', () => {
      const result = validatePanelConfigurations([])

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('No panels provided - component will show empty state')
      expect(result.validatedPanels).toHaveLength(0)
    })

    it('should reject non-array input', () => {
      const result = validatePanelConfigurations(null as any)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Panels must be an array')
    })

    it('should validate required fields', () => {
      const panels = [
        { panelId: '', agentId: 'agent-1' },
        { panelId: 'panel-2', agentId: '' },
      ] as AgentTerminalPanelConfig[]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Panel at index 0 missing required 'panelId' field")
      expect(result.errors).toContain("Panel 'panel-2' missing required 'agentId' field")
    })

    it('should detect duplicate panel IDs', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
        { panelId: 'panel-1', agentId: 'agent-2' },
      ]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Duplicate panelId 'panel-1' found")
    })

    it('should warn about duplicate agent IDs', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
        { panelId: 'panel-2', agentId: 'agent-1' },
      ]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain("Duplicate agentId 'agent-1' found in panels")
    })

    it('should validate initialState values', () => {
      const panels = [
        { panelId: 'panel-1', agentId: 'agent-1', initialState: 'invalid-state' as any },
      ]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Panel 'panel-1' has invalid initialState 'invalid-state'")
    })

    it('should limit panels to maximum of 12', () => {
      const panels = Array.from({ length: 15 }, (_, i) => ({
        panelId: `panel-${i + 1}`,
        agentId: `agent-${i + 1}`,
      }))

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Maximum 12 panels supported. 15 panels provided, will use first 12.')
      expect(result.validatedPanels).toHaveLength(12)
    })

    it('should warn about multiple maximized panels', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', initialState: 'maximized' },
        { panelId: 'panel-2', agentId: 'agent-2', initialState: 'maximized' },
      ]

      const result = validatePanelConfigurations(panels)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Multiple panels set to maximized state: panel-1, panel-2. Only the first will be maximized.')
    })

    it('should provide defaults for optional fields', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
      ]

      const result = validatePanelConfigurations(panels)
      const panel = result.validatedPanels[0]

      expect(panel.title).toBe('Agent agent-1')
      expect(panel.autoConnect).toBe(true)
      expect(panel.initialState).toBe('normal')
      expect(panel.panelProps).toEqual({})
    })

    it('should preserve custom values when provided', () => {
      const panels: AgentTerminalPanelConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          title: 'Custom Title',
          autoConnect: false,
          initialState: 'minimized',
          panelProps: { showFilters: true }
        },
      ]

      const result = validatePanelConfigurations(panels)
      const panel = result.validatedPanels[0]

      expect(panel.title).toBe('Custom Title')
      expect(panel.autoConnect).toBe(false)
      expect(panel.initialState).toBe('minimized')
      expect(panel.panelProps).toEqual({ showFilters: true })
    })
  })

  describe('generatePanelId', () => {
    it('should generate panel ID from agent ID and index', () => {
      expect(generatePanelId('agent-1', 0)).toBe('panel-agent-1-0')
      expect(generatePanelId('my-agent', 5)).toBe('panel-my-agent-5')
    })
  })

  describe('getResponsiveWarning', () => {
    it('should return null for 6 or fewer panels', () => {
      expect(getResponsiveWarning(1)).toBeNull()
      expect(getResponsiveWarning(6)).toBeNull()
    })

    it('should return mobile experience warning for 7-9 panels', () => {
      expect(getResponsiveWarning(7)).toBe('Consider using fewer panels for better mobile experience')
      expect(getResponsiveWarning(9)).toBe('Consider using fewer panels for better mobile experience')
    })

    it('should return performance warning for 10-12 panels', () => {
      expect(getResponsiveWarning(10)).toBe('High panel count may impact performance and usability on smaller screens')
      expect(getResponsiveWarning(12)).toBe('High panel count may impact performance and usability on smaller screens')
    })

    it('should return maximum exceeded warning for more than 12 panels', () => {
      expect(getResponsiveWarning(13)).toBe('Panel count exceeds recommended maximum of 12')
      expect(getResponsiveWarning(20)).toBe('Panel count exceeds recommended maximum of 12')
    })
  })

  describe('getRecommendedDisplayMode', () => {
    it('should recommend normal mode for 1-4 panels', () => {
      expect(getRecommendedDisplayMode(1)).toBe('normal')
      expect(getRecommendedDisplayMode(4)).toBe('normal')
    })

    it('should recommend compact mode for 5-8 panels', () => {
      expect(getRecommendedDisplayMode(5)).toBe('compact')
      expect(getRecommendedDisplayMode(8)).toBe('compact')
    })

    it('should recommend compact mode for 9+ panels', () => {
      expect(getRecommendedDisplayMode(9)).toBe('compact')
      expect(getRecommendedDisplayMode(12)).toBe('compact')
      expect(getRecommendedDisplayMode(15)).toBe('compact')
    })
  })

  describe('getPerformanceWarning', () => {
    it('should return null for 8 or fewer panels', () => {
      expect(getPerformanceWarning(1)).toBeNull()
      expect(getPerformanceWarning(8)).toBeNull()
    })

    it('should return monitoring suggestion for 9-10 panels', () => {
      expect(getPerformanceWarning(9)).toBe('Consider monitoring performance with 9+ panels')
      expect(getPerformanceWarning(10)).toBe('Consider monitoring performance with 9+ panels')
    })

    it('should return performance impact warning for 11+ panels', () => {
      expect(getPerformanceWarning(11)).toBe('High panel count may impact browser performance')
      expect(getPerformanceWarning(15)).toBe('High panel count may impact browser performance')
    })
  })

  describe('getOverflowClasses', () => {
    it('should return empty string for auto height', () => {
      expect(getOverflowClasses('auto', 4)).toBe('')
    })

    it('should return empty string for none height', () => {
      expect(getOverflowClasses('none', 4)).toBe('')
    })

    it('should return overflow-y-auto for fixed height', () => {
      expect(getOverflowClasses('500px', 4)).toBe('overflow-y-auto')
      expect(getOverflowClasses('100vh', 3)).toBe('overflow-y-auto')
    })

    it('should add scrollbar styles for many panels', () => {
      const result = getOverflowClasses('500px', 8)
      expect(result).toContain('overflow-y-auto')
      expect(result).toContain('scrollbar-thin')
      expect(result).toContain('scrollbar-thumb-gray-300')
      expect(result).toContain('scrollbar-track-gray-100')
    })

    it('should not add scrollbar styles for fewer panels', () => {
      const result = getOverflowClasses('500px', 5)
      expect(result).toBe('overflow-y-auto')
      expect(result).not.toContain('scrollbar-thin')
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extreme panel counts gracefully', () => {
      expect(getExtendedGridLayoutClasses(-100, false)).toBe(EXTENDED_GRID_CONFIGS[1])
      expect(getExtendedGridLayoutClasses(1000, false)).toBe(EXTENDED_GRID_CONFIGS[12])
    })

    it('should handle NaN and undefined inputs', () => {
      expect(getExtendedGridLayoutClasses(NaN, false)).toBe(EXTENDED_GRID_CONFIGS[12])
      expect(getExtendedGridLayoutClasses(undefined as any, false)).toBe(EXTENDED_GRID_CONFIGS[12])
    })

    it('should handle string inputs that can be converted to numbers', () => {
      expect(getExtendedGridLayoutClasses('5' as any, false)).toBe(EXTENDED_GRID_CONFIGS[5])
      expect(getExtendedGridLayoutClasses('abc' as any, false)).toBe(EXTENDED_GRID_CONFIGS[12])
    })
  })

  describe('Integration Tests', () => {
    it('should work together for complete validation flow', () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
        { panelId: 'panel-2', agentId: 'agent-2' },
        { panelId: 'panel-3', agentId: 'agent-3' },
      ]

      const validation = validatePanelConfigurations(panels)
      expect(validation.isValid).toBe(true)

      const gridClasses = getExtendedGridLayoutClasses(validation.validatedPanels.length, false)
      expect(gridClasses).toBe(EXTENDED_GRID_CONFIGS[3])

      const responsiveWarning = getResponsiveWarning(validation.validatedPanels.length)
      expect(responsiveWarning).toBeNull()

      const performanceWarning = getPerformanceWarning(validation.validatedPanels.length)
      expect(performanceWarning).toBeNull()
    })

    it('should handle high panel count scenario end-to-end', () => {
      const panels = Array.from({ length: 10 }, (_, i) => ({
        panelId: `panel-${i + 1}`,
        agentId: `agent-${i + 1}`,
      }))

      const validation = validatePanelConfigurations(panels)
      expect(validation.isValid).toBe(true)

      const responsiveWarning = getResponsiveWarning(validation.validatedPanels.length)
      expect(responsiveWarning).toContain('High panel count')

      const performanceWarning = getPerformanceWarning(validation.validatedPanels.length)
      expect(performanceWarning).toContain('monitoring performance')

      const displayMode = getRecommendedDisplayMode(validation.validatedPanels.length)
      expect(displayMode).toBe('compact')
    })
  })
})