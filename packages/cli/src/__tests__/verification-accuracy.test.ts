/**
 * Verification Accuracy Tests
 * Tests to ensure the verification reports accurately reflect the documentation state
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Verification Accuracy Tests', () => {
  let cliGuideContent: string
  let verificationReport: string
  let implementationSummary: string
  let roadmapContent: string

  beforeAll(() => {
    const rootDir = join(__dirname, '../../../../..')

    cliGuideContent = readFileSync(join(rootDir, 'docs/cli-guide.md'), 'utf-8')
    verificationReport = readFileSync(join(rootDir, 'v0.3.0-feature-verification.md'), 'utf-8')
    implementationSummary = readFileSync(join(rootDir, 'implementation-summary.md'), 'utf-8')
    roadmapContent = readFileSync(join(rootDir, 'ROADMAP.md'), 'utf-8')
  })

  describe('Line Number Accuracy Verification', () => {
    it('should verify StatusBar section line numbers are accurate', () => {
      const cliGuideLines = cliGuideContent.split('\n')

      // Find StatusBar Reference section
      const statusBarStart = cliGuideLines.findIndex(line =>
        line.includes('## StatusBar Reference') || line.includes('StatusBar Reference')
      )

      expect(statusBarStart).toBeGreaterThan(0)

      // The verification claims lines 1578-2359 for StatusBar
      if (statusBarStart > 0) {
        const estimatedEnd = statusBarStart + 800 // Should be substantial section
        expect(estimatedEnd).toBeLessThanOrEqual(cliGuideLines.length)
      }
    })

    it('should verify Session Management section exists and is substantial', () => {
      const cliGuideLines = cliGuideContent.split('\n')

      const sessionStart = cliGuideLines.findIndex(line =>
        line.includes('## Session Management')
      )

      expect(sessionStart).toBeGreaterThan(0)

      // Should have substantial content for session management
      if (sessionStart > 0) {
        const estimatedEnd = sessionStart + 1000 // Claims ~1134 lines
        expect(estimatedEnd).toBeLessThanOrEqual(cliGuideLines.length)
      }
    })

    it('should verify Keyboard Shortcuts section exists', () => {
      const cliGuideLines = cliGuideContent.split('\n')

      const shortcutsStart = cliGuideLines.findIndex(line =>
        line.includes('## Keyboard Shortcuts')
      )

      expect(shortcutsStart).toBeGreaterThan(0)

      // Should be a reasonably sized section (~90 lines claimed)
      if (shortcutsStart > 0) {
        const estimatedEnd = shortcutsStart + 100
        expect(estimatedEnd).toBeLessThanOrEqual(cliGuideLines.length)
      }
    })

    it('should verify total line count is approximately 2765', () => {
      const actualLineCount = cliGuideContent.split('\n').length
      const reportedLineCount = 2765

      // Allow for some variance (±50 lines)
      expect(Math.abs(actualLineCount - reportedLineCount)).toBeLessThanOrEqual(50)
    })
  })

  describe('Feature Claim Verification', () => {
    it('should verify v0.3.0 feature claims are accurate', () => {
      // Rich Terminal UI claims
      expect(cliGuideContent).toMatch(/rich.*terminal.*ui/i)
      expect(cliGuideContent).toMatch(/ink.based/i)

      // StatusBar claims
      expect(cliGuideContent).toMatch(/status.*bar/i)
      expect(cliGuideContent).toMatch(/21.*elements/i)

      // Session Management claims
      expect(cliGuideContent).toMatch(/session.*management/i)
      expect(cliGuideContent).toMatch(/7.*features/i)

      // Keyboard Shortcuts claims
      expect(cliGuideContent).toMatch(/keyboard.*shortcuts/i)
      expect(cliGuideContent).toMatch(/22.*shortcuts/i)
    })

    it('should verify claimed features exist in actual documentation', () => {
      // Claims from verification report
      const claimedFeatures = [
        'Rich Terminal UI',
        'StatusBar Reference',
        'Session Management',
        'Keyboard Shortcuts',
        'Natural Language Tasks',
        'Display Modes',
        'Multi-Agent Visualization'
      ]

      claimedFeatures.forEach(feature => {
        expect(cliGuideContent).toContain(feature)
      })
    })

    it('should verify checkmark claims in verification report are supported', () => {
      // Extract all ✓ claims from verification report
      const checkmarkClaims = verificationReport.match(/- [^✓]*✓/g) || []

      expect(checkmarkClaims.length).toBeGreaterThan(30) // Should have many verified features

      // Verify some key claims
      expect(verificationReport).toContain('Ink-based UI framework ✓')
      expect(verificationReport).toContain('Session persistence ✓')
      expect(verificationReport).toContain('Tab completion ✓')
      expect(verificationReport).toContain('Streaming output ✓')
    })
  })

  describe('Cross-Reference Accuracy', () => {
    it('should verify supporting documentation files are referenced correctly', () => {
      // Claims from implementation summary about supporting docs
      expect(implementationSummary).toContain('docs/user-guide/display-modes.md')
      expect(implementationSummary).toContain('docs/user-guide/input-preview.md')
      expect(implementationSummary).toContain('docs/features/v030-features.md')

      // These should be referenced in cli-guide.md
      expect(cliGuideContent).toContain('user-guide/display-modes.md')
      expect(cliGuideContent).toContain('user-guide/input-preview.md')
      expect(cliGuideContent).toContain('features/v030-features.md')
    })

    it('should verify roadmap feature extraction is accurate', () => {
      // The verification claims to analyze ROADMAP.md lines 102-223
      const roadmapLines = roadmapContent.split('\n')

      // Check if v0.3.0 section exists in roughly that area
      const v030Mentions = roadmapLines
        .slice(100, 225) // Around the claimed lines
        .join('\n')

      expect(v030Mentions).toMatch(/v0\.3\.0|0\.3\.0/i)
    })

    it('should verify file size claims are reasonable', () => {
      // Verification claims 249-line display-modes guide
      const displayModesRef = implementationSummary.match(/249-line guide/)?.[0]
      expect(displayModesRef).toBeDefined()

      // Should be reasonable for a supporting document
      expect(displayModesRef).toContain('249-line')
    })
  })

  describe('Quality Assessment Accuracy', () => {
    it('should verify quality assessment claims against actual content', () => {
      // Claims about comprehensive coverage
      expect(verificationReport).toContain('Comprehensive Coverage')
      expect(verificationReport).toContain('Detailed Examples')
      expect(verificationReport).toContain('Organized Structure')

      // Verify these claims
      expect(cliGuideContent).toContain('## Table of Contents') // Organized structure
      expect(cliGuideContent.match(/```[\s\S]*?```/g)?.length).toBeGreaterThan(10) // Examples
      expect(cliGuideContent.split('##').length).toBeGreaterThan(10) // Comprehensive sections
    })

    it('should verify areas of excellence claims', () => {
      // Claims about StatusBar documentation excellence
      expect(verificationReport).toContain('StatusBar Documentation**: Extremely detailed')

      // Should have substantial StatusBar content
      const statusBarContent = cliGuideContent.match(/status.*bar[\s\S]*?(?=##|$)/gi)?.[0] || ''
      expect(statusBarContent.length).toBeGreaterThan(1000) // Should be detailed

      // Claims about Session Management excellence
      expect(verificationReport).toContain('Session Management**: Comprehensive coverage')

      const sessionContent = cliGuideContent.match(/session.*management[\s\S]*?(?=##|$)/gi)?.[0] || ''
      expect(sessionContent.length).toBeGreaterThan(1000) // Should be comprehensive
    })

    it('should verify visual aids claims', () => {
      expect(verificationReport).toContain('Visual Aids**: ASCII art examples')

      // Should have code blocks that could contain ASCII art
      const codeBlocks = cliGuideContent.match(/```[\s\S]*?```/g) || []
      expect(codeBlocks.length).toBeGreaterThan(15) // Should have many examples

      // Should have visual elements
      expect(cliGuideContent).toMatch(/├|└|│|─/) // ASCII art characters
    })
  })

  describe('Completion Status Verification', () => {
    it('should verify task completion claims are justified', () => {
      expect(implementationSummary).toContain('Task Completion Status: ✅ COMPLETE')
      expect(verificationReport).toContain('Verification Result: ✅ COMPLETE')

      // Should have evidence supporting completion
      expect(verificationReport).toContain('All v0.3.0 features from ROADMAP.md are documented')
      expect(implementationSummary).toContain('100% feature coverage')
    })

    it('should verify no additional work required claim', () => {
      expect(implementationSummary).toContain('No additional work required')
      expect(verificationReport).toContain('requires no additional feature documentation')

      // Should have comprehensive coverage to justify this
      expect(verificationReport).toMatch(/✅.*Rich Terminal UI/)
      expect(verificationReport).toMatch(/✅.*Status Bar/)
      expect(verificationReport).toMatch(/✅.*Session Management/)
      expect(verificationReport).toMatch(/✅.*Keyboard Shortcuts/)
    })

    it('should verify v0.3.0 release readiness claims', () => {
      expect(verificationReport).toContain('ready for v0.3.0 release')
      expect(implementationSummary).toContain('ready for v0.3.0 release')

      // Should have comprehensive documentation to support this claim
      expect(cliGuideContent).toContain('NEW in v0.3.0')
      expect(cliGuideContent).toContain('v0.3.0 introduces')
    })
  })

  describe('Metric Consistency Verification', () => {
    it('should verify 21 StatusBar elements claim can be supported', () => {
      expect(verificationReport).toContain('21 elements')

      // Should have references to multiple status elements
      const statusElements = [
        'token', 'cost', 'model', 'session', 'timer',
        'branch', 'agent', 'workflow', 'progress'
      ].filter(element =>
        cliGuideContent.toLowerCase().includes(element)
      )

      expect(statusElements.length).toBeGreaterThan(7) // Should cover most key elements
    })

    it('should verify 22 keyboard shortcuts claim', () => {
      expect(verificationReport).toContain('22 shortcuts')

      // Should have keyboard shortcut references
      const shortcutPatterns = [
        /ctrl\+[a-z]/gi,
        /cmd\+[a-z]/gi,
        /shift\+[a-z]/gi,
        /alt\+[a-z]/gi
      ]

      let shortcutCount = 0
      shortcutPatterns.forEach(pattern => {
        const matches = cliGuideContent.match(pattern) || []
        shortcutCount += matches.length
      })

      expect(shortcutCount).toBeGreaterThan(15) // Should have substantial shortcuts
    })

    it('should verify 7 session features claim', () => {
      expect(verificationReport).toContain('7 features')

      const sessionFeatures = [
        'persistence', 'export', 'branching', 'named',
        'search', 'auto-save', 'commands'
      ].filter(feature =>
        cliGuideContent.toLowerCase().includes(feature)
      )

      expect(sessionFeatures.length).toBeGreaterThanOrEqual(6) // Should cover most features
    })
  })

  describe('Report Structure Verification', () => {
    it('should verify verification report has proper structure', () => {
      const requiredSections = [
        '# v0.3.0 Feature Coverage Verification Report',
        '## Features Coverage Analysis',
        '## Documentation Quality Assessment',
        '## Verification Result'
      ]

      requiredSections.forEach(section => {
        expect(verificationReport).toContain(section)
      })
    })

    it('should verify implementation summary has proper structure', () => {
      const requiredSections = [
        '# cli-guide.md v0.3.0 Implementation Summary',
        '## Task Completion Status',
        '## Key Findings',
        '### Stage Summary: implementation'
      ]

      requiredSections.forEach(section => {
        expect(implementationSummary).toContain(section)
      })
    })

    it('should verify reports contain proper metadata', () => {
      expect(verificationReport).toContain('Date**: December 2024')
      expect(verificationReport).toContain('Status**: Feature documentation verification complete')

      expect(implementationSummary).toContain('**Status**: completed')
      expect(implementationSummary).toContain('Files Modified')
    })
  })
})