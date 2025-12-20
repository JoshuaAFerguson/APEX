/**
 * Documentation Coverage Tests
 * Tests to verify actual content coverage in cli-guide.md
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('CLI Guide Documentation Coverage Tests', () => {
  let cliGuideContent: string
  let roadmapContent: string

  beforeAll(() => {
    const rootDir = join(__dirname, '../../../../..')

    const cliGuidePath = join(rootDir, 'docs/cli-guide.md')
    const roadmapPath = join(rootDir, 'ROADMAP.md')

    expect(existsSync(cliGuidePath)).toBe(true)
    expect(existsSync(roadmapPath)).toBe(true)

    cliGuideContent = readFileSync(cliGuidePath, 'utf-8')
    roadmapContent = readFileSync(roadmapPath, 'utf-8')
  })

  describe('Document Structure and Metadata', () => {
    it('should have proper document title and structure', () => {
      expect(cliGuideContent).toContain('# APEX CLI Guide')
      expect(cliGuideContent).toContain('## Table of Contents')
      expect(cliGuideContent).toMatch(/\*\*✨ NEW in v0\.3\.0\*\*/gi)
    })

    it('should reference all major sections in table of contents', () => {
      const requiredSections = [
        'Getting Started',
        'Starting APEX',
        'REPL Commands',
        'Session Management',
        'Display Modes',
        'StatusBar Reference',
        'Keyboard Shortcuts',
        'Natural Language Tasks',
        'Server Management',
        'Task Management',
        'Configuration'
      ]

      requiredSections.forEach(section => {
        expect(cliGuideContent).toContain(`- [${section}]`)
      })
    })

    it('should have v0.3.0 feature overview reference', () => {
      expect(cliGuideContent).toContain('Complete v0.3.0 Features Overview')
      expect(cliGuideContent).toContain('features/v030-features.md')
    })
  })

  describe('v0.3.0 Feature Coverage - Rich Terminal UI', () => {
    it('should document Rich Terminal UI as default', () => {
      expect(cliGuideContent).toContain('Rich Terminal UI')
      expect(cliGuideContent).toContain('Modern Ink-based interface')
      expect(cliGuideContent).toContain('real-time updates')
      expect(cliGuideContent).toContain('Classic Mode')
    })

    it('should document UI framework features', () => {
      expect(cliGuideContent).toMatch(/ink.based/i)
      expect(cliGuideContent).toMatch(/streaming.*output/i)
      expect(cliGuideContent).toMatch(/markdown.*render/i)
      expect(cliGuideContent).toMatch(/syntax.highlight/i)
    })

    it('should document responsive design', () => {
      expect(cliGuideContent).toMatch(/responsive/i)
      expect(cliGuideContent).toMatch(/theme/i)
    })
  })

  describe('v0.3.0 Feature Coverage - StatusBar', () => {
    it('should have comprehensive StatusBar Reference section', () => {
      expect(cliGuideContent).toContain('## StatusBar Reference')
      expect(cliGuideContent).toContain('StatusBar')
      expect(cliGuideContent).toMatch(/21\s*elements/i)
    })

    it('should document core status elements', () => {
      const statusElements = [
        'token',
        'cost',
        'model',
        'session',
        'timer',
        'branch',
        'agent',
        'workflow',
        'progress'
      ]

      statusElements.forEach(element => {
        expect(cliGuideContent).toMatch(new RegExp(element, 'i'))
      })
    })

    it('should document priority system', () => {
      expect(cliGuideContent).toMatch(/priority/i)
      expect(cliGuideContent).toMatch(/critical|high|medium|low/i)
    })

    it('should document responsive behavior', () => {
      expect(cliGuideContent).toMatch(/responsive.*behavior/i)
    })
  })

  describe('v0.3.0 Feature Coverage - Session Management', () => {
    it('should have comprehensive Session Management section', () => {
      expect(cliGuideContent).toContain('## Session Management')
      expect(cliGuideContent).toMatch(/7\s*features/i)
    })

    it('should document session persistence', () => {
      expect(cliGuideContent).toMatch(/session.*persistence/i)
      expect(cliGuideContent).toMatch(/auto.save/i)
    })

    it('should document session export formats', () => {
      expect(cliGuideContent).toMatch(/session.*export/i)
      expect(cliGuideContent).toMatch(/export.*format/i)
    })

    it('should document session branching', () => {
      expect(cliGuideContent).toMatch(/session.*branch/i)
      expect(cliGuideContent).toMatch(/branch.*session/i)
    })

    it('should document named sessions', () => {
      expect(cliGuideContent).toMatch(/named.*session/i)
      expect(cliGuideContent).toMatch(/session.*name/i)
    })

    it('should document session search', () => {
      expect(cliGuideContent).toMatch(/session.*search/i)
      expect(cliGuideContent).toMatch(/search.*session/i)
    })

    it('should document session commands', () => {
      expect(cliGuideContent).toContain('/session')
      expect(cliGuideContent).toContain('/save')
      expect(cliGuideContent).toContain('/load')
    })
  })

  describe('v0.3.0 Feature Coverage - Keyboard Shortcuts', () => {
    it('should have comprehensive Keyboard Shortcuts section', () => {
      expect(cliGuideContent).toContain('## Keyboard Shortcuts')
      expect(cliGuideContent).toMatch(/22\s*shortcuts/i)
    })

    it('should document shortcut categories', () => {
      const categories = [
        'Global',
        'Session Management',
        'Quick Commands',
        'Input & Editing',
        'History Navigation',
        'Processing & Control'
      ]

      categories.forEach(category => {
        expect(cliGuideContent).toContain(category)
      })
    })

    it('should document context-aware shortcuts', () => {
      expect(cliGuideContent).toMatch(/context.aware/i)
      expect(cliGuideContent).toMatch(/ctrl|cmd|shift|alt/i)
    })

    it('should document quick reference', () => {
      expect(cliGuideContent).toMatch(/quick.*reference/i)
      expect(cliGuideContent).toMatch(/reference.*card/i)
    })
  })

  describe('v0.3.0 Feature Coverage - Input Experience', () => {
    it('should document input features', () => {
      expect(cliGuideContent).toMatch(/tab.*completion/i)
      expect(cliGuideContent).toMatch(/history.*navigation/i)
      expect(cliGuideContent).toMatch(/multi.line.*input/i)
      expect(cliGuideContent).toMatch(/input.*preview/i)
    })

    it('should document input preview with intent detection', () => {
      expect(cliGuideContent).toContain('/preview')
      expect(cliGuideContent).toMatch(/intent.*detection/i)
      expect(cliGuideContent).toMatch(/preview.*mode/i)
    })

    it('should document inline editing', () => {
      expect(cliGuideContent).toMatch(/inline.*edit/i)
      expect(cliGuideContent).toMatch(/edit.*input/i)
    })
  })

  describe('v0.3.0 Feature Coverage - Natural Language Interface', () => {
    it('should have Natural Language Tasks section', () => {
      expect(cliGuideContent).toContain('## Natural Language Tasks')
      expect(cliGuideContent).toContain('Natural Language')
    })

    it('should document natural language processing', () => {
      expect(cliGuideContent).toMatch(/natural.*language/i)
      expect(cliGuideContent).toMatch(/intent.*detection/i)
      expect(cliGuideContent).toMatch(/conversational/i)
    })

    it('should document task refinement', () => {
      expect(cliGuideContent).toMatch(/task.*refinement/i)
      expect(cliGuideContent).toMatch(/suggested.*actions/i)
    })
  })

  describe('v0.3.0 Feature Coverage - Output & Feedback', () => {
    it('should document display modes', () => {
      expect(cliGuideContent).toContain('## Display Modes')
      expect(cliGuideContent).toMatch(/compact.*normal.*verbose/i)
    })

    it('should document streaming output', () => {
      expect(cliGuideContent).toMatch(/streaming.*output/i)
      expect(cliGuideContent).toMatch(/real.time/i)
    })

    it('should document progress indicators', () => {
      expect(cliGuideContent).toMatch(/progress.*indicator/i)
      expect(cliGuideContent).toMatch(/progress.*display/i)
    })

    it('should document activity logging', () => {
      expect(cliGuideContent).toMatch(/activity.*log/i)
      expect(cliGuideContent).toMatch(/log.*activity/i)
    })
  })

  describe('v0.3.0 Feature Coverage - Multi-Agent Visualization', () => {
    it('should document agent visualization features', () => {
      expect(cliGuideContent).toMatch(/agent.*panel/i)
      expect(cliGuideContent).toMatch(/agent.*indicator/i)
      expect(cliGuideContent).toMatch(/workflow.*stage/i)
    })

    it('should document subtask visualization', () => {
      expect(cliGuideContent).toMatch(/subtask.*tree/i)
      expect(cliGuideContent).toMatch(/subtask.*progress/i)
    })

    it('should document agent handoff', () => {
      expect(cliGuideContent).toMatch(/handoff/i)
      expect(cliGuideContent).toMatch(/parallel.*execution/i)
    })

    it('should document agent thoughts', () => {
      expect(cliGuideContent).toContain('/thoughts')
      expect(cliGuideContent).toMatch(/agent.*thought/i)
    })
  })

  describe('Documentation Quality and Examples', () => {
    it('should include visual examples and ASCII art', () => {
      expect(cliGuideContent).toMatch(/```[\s\S]*?```/)
      expect(cliGuideContent.match(/```/g)?.length).toBeGreaterThan(20)
    })

    it('should include usage examples for commands', () => {
      expect(cliGuideContent).toMatch(/# Example:/i)
      expect(cliGuideContent).toMatch(/Usage:/i)
      expect(cliGuideContent).toContain('apex ')
    })

    it('should include troubleshooting guidance', () => {
      expect(cliGuideContent).toMatch(/troubleshoot/i)
      expect(cliGuideContent).toMatch(/problem/i)
      expect(cliGuideContent).toMatch(/issue/i)
    })

    it('should include cross-references to detailed guides', () => {
      expect(cliGuideContent).toContain('user-guide/display-modes.md')
      expect(cliGuideContent).toContain('user-guide/input-preview.md')
      expect(cliGuideContent).toContain('features/v030-features.md')
    })
  })

  describe('REPL Commands Coverage', () => {
    it('should document core REPL commands', () => {
      const coreCommands = [
        '/help',
        '/init',
        '/status',
        '/session',
        '/save',
        '/load',
        '/thoughts',
        '/preview',
        '/mode',
        '/exit'
      ]

      coreCommands.forEach(command => {
        expect(cliGuideContent).toContain(command)
      })
    })

    it('should document command aliases', () => {
      expect(cliGuideContent).toMatch(/alias/i)
      expect(cliGuideContent).toMatch(/shortcut/i)
    })

    it('should document command options and parameters', () => {
      expect(cliGuideContent).toMatch(/option/i)
      expect(cliGuideContent).toMatch(/parameter/i)
      expect(cliGuideContent).toMatch(/argument/i)
    })
  })

  describe('Server Management Documentation', () => {
    it('should have Server Management section', () => {
      expect(cliGuideContent).toContain('## Server Management')
    })

    it('should document API and Web UI servers', () => {
      expect(cliGuideContent).toMatch(/api.*server/i)
      expect(cliGuideContent).toMatch(/web.*ui/i)
      expect(cliGuideContent).toMatch(/port.*config/i)
    })

    it('should document auto-start configuration', () => {
      expect(cliGuideContent).toMatch(/auto.start/i)
      expect(cliGuideContent).toMatch(/start.*config/i)
    })
  })

  describe('Configuration Documentation', () => {
    it('should have Configuration section', () => {
      expect(cliGuideContent).toContain('## Configuration')
    })

    it('should document configuration file structure', () => {
      expect(cliGuideContent).toMatch(/config.*file/i)
      expect(cliGuideContent).toMatch(/config.*structure/i)
      expect(cliGuideContent).toMatch(/\.apex/i)
    })

    it('should document autonomy and limits', () => {
      expect(cliGuideContent).toMatch(/autonomy/i)
      expect(cliGuideContent).toMatch(/limits/i)
    })
  })

  describe('Task Management Documentation', () => {
    it('should have Task Management section', () => {
      expect(cliGuideContent).toContain('## Task Management')
    })

    it('should document task lifecycle', () => {
      expect(cliGuideContent).toMatch(/task.*lifecycle/i)
      expect(cliGuideContent).toMatch(/task.*state/i)
    })

    it('should document branch management', () => {
      expect(cliGuideContent).toMatch(/branch.*management/i)
      expect(cliGuideContent).toMatch(/git.*branch/i)
    })

    it('should document cost and token tracking', () => {
      expect(cliGuideContent).toMatch(/cost.*track/i)
      expect(cliGuideContent).toMatch(/token.*track/i)
      expect(cliGuideContent).toMatch(/usage.*track/i)
    })
  })

  describe('File Size and Content Metrics', () => {
    it('should be approximately 2765 lines as stated in verification', () => {
      const lineCount = cliGuideContent.split('\n').length
      expect(lineCount).toBeGreaterThan(2500)
      expect(lineCount).toBeLessThan(3000)
    })

    it('should have substantial content (comprehensive documentation)', () => {
      expect(cliGuideContent.length).toBeGreaterThan(100000) // At least 100KB of content
    })

    it('should have proper markdown formatting', () => {
      // Check for proper heading structure
      expect(cliGuideContent).toMatch(/^# /m) // H1 heading
      expect(cliGuideContent).toMatch(/^## /m) // H2 headings
      expect(cliGuideContent).toMatch(/^### /m) // H3 headings

      // Check for links
      expect(cliGuideContent).toMatch(/\[.*?\]\(.*?\)/g) // Markdown links

      // Check for code blocks
      expect(cliGuideContent).toMatch(/```[\s\S]*?```/g) // Code blocks
    })
  })
})