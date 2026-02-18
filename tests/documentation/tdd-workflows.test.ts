/**
 * TDD Workflow Documentation Tests
 * Tests to verify TDD workflow documentation coverage and quality
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('TDD Workflow Documentation Tests', () => {
  let tddDocsContent: string
  let readmeContent: string

  beforeAll(() => {
    const rootDir = join(__dirname, '../..')

    const tddDocsPath = join(rootDir, 'docs/tdd-workflows.md')
    const readmePath = join(rootDir, 'README.md')

    expect(existsSync(tddDocsPath)).toBe(true)
    expect(existsSync(readmePath)).toBe(true)

    tddDocsContent = readFileSync(tddDocsPath, 'utf-8')
    readmeContent = readFileSync(readmePath, 'utf-8')
  })

  describe('Document Structure and Accessibility', () => {
    it('should have proper document title and structure', () => {
      expect(tddDocsContent).toContain('# Test-Driven Development (TDD) Workflows')
      expect(tddDocsContent).toContain('## Overview')
      expect(tddDocsContent).toContain('## What is TDD?')
    })

    it('should be linked from the main README', () => {
      expect(readmeContent).toContain('[TDD Workflows](docs/tdd-workflows.md)')
      expect(readmeContent).toContain('Test-Driven Development with AI assistance')
    })

    it('should have comprehensive sections', () => {
      const requiredSections = [
        'Overview',
        'What is TDD?',
        'TDD Mode Configuration',
        'TDD Workflows',
        'Using TDD Workflows',
        'TDD Best Practices',
        'TDD Metrics and Reporting',
        'Troubleshooting TDD Workflows',
        'Integration with Code Quality',
        'Example Usage',
        'Benefits of TDD with APEX'
      ]

      requiredSections.forEach(section => {
        expect(tddDocsContent).toContain(`## ${section}`)
      })
    })

    it('should include cross-references to related documentation', () => {
      expect(tddDocsContent).toContain('[Code Quality Integration](code-quality.md)')
      expect(tddDocsContent).toContain('[Workflow Authoring](workflows.md)')
      expect(tddDocsContent).toContain('[Agent Configuration](agents.md)')
      expect(tddDocsContent).toContain('[Best Practices](best-practices.md)')
    })
  })

  describe('TDD Concept Coverage', () => {
    it('should explain TDD fundamentals', () => {
      expect(tddDocsContent).toContain('Red-Green-Refactor cycle')
      expect(tddDocsContent).toContain('Write a failing test first')
      expect(tddDocsContent).toContain('Write minimal code to make the test pass')
      expect(tddDocsContent).toContain('Improve code quality while keeping tests passing')
    })

    it('should explain TDD benefits', () => {
      expect(tddDocsContent).toContain('thoroughly tested')
      expect(tddDocsContent).toContain('well-designed')
      expect(tddDocsContent).toContain('meets requirements')
    })

    it('should describe the three phases clearly', () => {
      expect(tddDocsContent).toMatch(/1\.\s*\*\*Red\*\*/i)
      expect(tddDocsContent).toMatch(/2\.\s*\*\*Green\*\*/i)
      expect(tddDocsContent).toMatch(/3\.\s*\*\*Refactor\*\*/i)
    })
  })

  describe('Configuration Documentation', () => {
    it('should document TDD mode configuration', () => {
      expect(tddDocsContent).toContain('## TDD Mode Configuration')
      expect(tddDocsContent).toContain('### Enable TDD Mode')
      expect(tddDocsContent).toContain('### TDD-Specific Settings')
    })

    it('should show proper YAML configuration examples', () => {
      expect(tddDocsContent).toContain('```yaml')
      expect(tddDocsContent).toContain('codeQuality:')
      expect(tddDocsContent).toContain('tddMode: true')
      expect(tddDocsContent).toContain('regressionGuard: true')
    })

    it('should document testing configuration options', () => {
      expect(tddDocsContent).toContain('testing:')
      expect(tddDocsContent).toContain('runner: jest')
      expect(tddDocsContent).toContain('watchMode: true')
      expect(tddDocsContent).toContain('coverage: true')
      expect(tddDocsContent).toContain('minCoverage: 80')
    })

    it('should document TDD-specific settings', () => {
      expect(tddDocsContent).toContain('enforceRedPhase: true')
      expect(tddDocsContent).toContain('autoRunTests: true')
      expect(tddDocsContent).toContain('stopOnFailure: true')
      expect(tddDocsContent).toContain('coverageThreshold: 80')
      expect(tddDocsContent).toContain('testPatterns:')
    })
  })

  describe('Workflow Documentation', () => {
    it('should document built-in TDD workflow', () => {
      expect(tddDocsContent).toContain('### Built-in TDD Workflow')
      expect(tddDocsContent).toContain('.apex/workflows/tdd.yaml')
    })

    it('should show complete workflow YAML structure', () => {
      expect(tddDocsContent).toContain('name: tdd')
      expect(tddDocsContent).toContain('description: Test-driven development workflow with Red-Green-Refactor cycle')
      expect(tddDocsContent).toContain('stages:')
    })

    it('should document workflow stages', () => {
      const requiredStages = [
        'red_phase',
        'green_phase',
        'refactor_phase'
      ]

      requiredStages.forEach(stage => {
        expect(tddDocsContent).toContain(`name: ${stage}`)
      })
    })

    it('should document stage agents and dependencies', () => {
      expect(tddDocsContent).toContain('agent: tester')
      expect(tddDocsContent).toContain('agent: developer')
      expect(tddDocsContent).toContain('dependsOn: [red_phase]')
      expect(tddDocsContent).toContain('dependsOn: [green_phase]')
    })

    it('should document stage validation', () => {
      expect(tddDocsContent).toContain('validation:')
      expect(tddDocsContent).toContain('tests_fail: true')
      expect(tddDocsContent).toContain('tests_pass: true')
      expect(tddDocsContent).toContain('coverage_maintained: true')
    })

    it('should document TDD feature development workflow', () => {
      expect(tddDocsContent).toContain('### TDD Feature Development')
      expect(tddDocsContent).toContain('name: tdd-feature')
      expect(tddDocsContent).toContain('Full feature development using TDD principles')
    })
  })

  describe('Usage Examples and Commands', () => {
    it('should provide clear usage examples', () => {
      expect(tddDocsContent).toContain('## Using TDD Workflows')
      expect(tddDocsContent).toContain('### Start TDD Development')
    })

    it('should document command examples', () => {
      expect(tddDocsContent).toContain('apex run "Add user authentication" --workflow tdd-feature')
      expect(tddDocsContent).toContain('apex run "Fix validation issue" --workflow tdd-bugfix')
      expect(tddDocsContent).toContain('apex run "Refactor user service" --workflow tdd')
    })

    it('should document TDD mode commands', () => {
      expect(tddDocsContent).toContain('### TDD Mode Commands')
      expect(tddDocsContent).toContain('apex config set codeQuality.tddMode true')
      expect(tddDocsContent).toContain('apex run "Add payment processing" --tdd')
      expect(tddDocsContent).toContain('apex validate --tdd')
      expect(tddDocsContent).toContain('apex test --coverage')
    })

    it('should include practical bash examples', () => {
      const bashBlocks = tddDocsContent.match(/```bash[\s\S]*?```/g)
      expect(bashBlocks).toBeTruthy()
      expect(bashBlocks!.length).toBeGreaterThan(5)
    })
  })

  describe('Best Practices Documentation', () => {
    it('should document TDD best practices', () => {
      expect(tddDocsContent).toContain('## TDD Best Practices')
    })

    it('should cover essential TDD practices', () => {
      const practices = [
        'Start with Acceptance Tests',
        'Write Minimal Implementation',
        'Refactor with Confidence',
        'Maintain High Coverage',
        'Test Edge Cases'
      ]

      practices.forEach(practice => {
        expect(tddDocsContent).toContain(`### ${practice.split(' ')[0]}`)
      })
    })

    it('should provide detailed explanations for each practice', () => {
      expect(tddDocsContent).toContain('Define behavior before implementation')
      expect(tddDocsContent).toContain('Make tests pass with the simplest possible code')
      expect(tddDocsContent).toContain('safety net to ensure functionality')
      expect(tddDocsContent).toContain('TDD naturally achieves high test coverage')
      expect(tddDocsContent).toContain('boundary conditions and error cases')
    })
  })

  describe('Metrics and Reporting', () => {
    it('should document metrics and reporting features', () => {
      expect(tddDocsContent).toContain('## TDD Metrics and Reporting')
      expect(tddDocsContent).toContain('### Test Coverage Reports')
      expect(tddDocsContent).toContain('### TDD Cycle Metrics')
    })

    it('should document coverage commands', () => {
      expect(tddDocsContent).toContain('apex test --coverage --report')
      expect(tddDocsContent).toContain('apex report --workflow tdd-feature --coverage')
      expect(tddDocsContent).toContain('apex metrics --coverage --trend')
    })

    it('should document TDD metrics', () => {
      expect(tddDocsContent).toContain('cycle_time:')
      expect(tddDocsContent).toContain('test_first_percentage:')
      expect(tddDocsContent).toContain('bug_density:')
      expect(tddDocsContent).toContain('coverage_improvement:')
    })
  })

  describe('Troubleshooting Documentation', () => {
    it('should include troubleshooting section', () => {
      expect(tddDocsContent).toContain('## Troubleshooting TDD Workflows')
      expect(tddDocsContent).toContain('### Common Issues')
      expect(tddDocsContent).toContain('### Debug Commands')
    })

    it('should document common TDD issues', () => {
      expect(tddDocsContent).toContain('Tests Don\'t Fail Initially')
      expect(tddDocsContent).toContain('Coverage Not Improving')
      expect(tddDocsContent).toContain('Long TDD Cycles')
    })

    it('should provide debug commands', () => {
      expect(tddDocsContent).toContain('apex debug TASK_ID --tdd')
      expect(tddDocsContent).toContain('apex timeline TASK_ID --tests')
      expect(tddDocsContent).toContain('apex diff --coverage before after')
    })
  })

  describe('Code Quality Integration', () => {
    it('should document integration with code quality features', () => {
      expect(tddDocsContent).toContain('## Integration with Code Quality')
      expect(tddDocsContent).toContain('TDD works seamlessly with APEX\'s code quality features')
    })

    it('should show combined configuration', () => {
      expect(tddDocsContent).toContain('lintAfterEdit: true')
      expect(tddDocsContent).toContain('autoFix: true')
      expect(tddDocsContent).toContain('preCommit:')
      expect(tddDocsContent).toContain('lint_check')
      expect(tddDocsContent).toContain('test_run')
      expect(tddDocsContent).toContain('coverage_check')
    })
  })

  describe('Complete Example Usage', () => {
    it('should provide complete usage examples', () => {
      expect(tddDocsContent).toContain('## Example Usage')
      expect(tddDocsContent).toContain('### Complete TDD Session')
      expect(tddDocsContent).toContain('### Custom TDD Configuration')
    })

    it('should show step-by-step workflow', () => {
      expect(tddDocsContent).toContain('# 1. Start TDD feature development')
      expect(tddDocsContent).toContain('# 2. Monitor progress')
      expect(tddDocsContent).toContain('# 3. Review test coverage')
      expect(tddDocsContent).toContain('# 4. Complete the workflow')
    })

    it('should demonstrate custom TDD configuration', () => {
      expect(tddDocsContent).toContain('custom-tdd:')
      expect(tddDocsContent).toContain('acceptance_test')
      expect(tddDocsContent).toContain('unit_test')
      expect(tddDocsContent).toContain('implementation')
      expect(tddDocsContent).toContain('refactor')
    })
  })

  describe('Benefits and AI Integration', () => {
    it('should highlight APEX-specific TDD benefits', () => {
      expect(tddDocsContent).toContain('## Benefits of TDD with APEX')
    })

    it('should document AI-assisted features', () => {
      expect(tddDocsContent).toContain('AI-Assisted Test Writing')
      expect(tddDocsContent).toContain('Automatic Red-Green-Refactor')
      expect(tddDocsContent).toContain('Quality Assurance')
      expect(tddDocsContent).toContain('Documentation')
      expect(tddDocsContent).toContain('Regression Prevention')
    })

    it('should explain how agents help with TDD', () => {
      expect(tddDocsContent).toContain('Agents help create comprehensive test suites')
      expect(tddDocsContent).toContain('Workflow enforces TDD discipline')
      expect(tddDocsContent).toContain('Built-in coverage and quality checks')
    })
  })

  describe('Documentation Quality', () => {
    it('should be comprehensive (sufficient length)', () => {
      const lineCount = tddDocsContent.split('\n').length
      expect(lineCount).toBeGreaterThan(300) // Comprehensive documentation
    })

    it('should include multiple code examples', () => {
      const codeBlocks = tddDocsContent.match(/```/g)
      expect(codeBlocks).toBeTruthy()
      expect(codeBlocks!.length).toBeGreaterThan(20) // Many examples
    })

    it('should have proper markdown formatting', () => {
      // Check for proper heading structure
      expect(tddDocsContent).toMatch(/^# /m) // H1 heading
      expect(tddDocsContent).toMatch(/^## /m) // H2 headings
      expect(tddDocsContent).toMatch(/^### /m) // H3 headings

      // Check for code blocks
      expect(tddDocsContent).toMatch(/```yaml[\s\S]*?```/g)
      expect(tddDocsContent).toMatch(/```bash[\s\S]*?```/g)
    })

    it('should include practical examples throughout', () => {
      expect(tddDocsContent).toContain('Add user authentication')
      expect(tddDocsContent).toContain('Fix validation issue')
      expect(tddDocsContent).toContain('Add shopping cart functionality')
      expect(tddDocsContent).toContain('Add payment processing')
    })

    it('should end with motivational summary', () => {
      expect(tddDocsContent).toContain('TDD with APEX combines the rigor of test-first development')
      expect(tddDocsContent).toContain('power of AI assistance')
      expect(tddDocsContent).toContain('high-quality code with comprehensive test coverage')
      expect(tddDocsContent).toContain('maintaining development velocity')
    })
  })

  describe('Acceptance Criteria Verification', () => {
    it('should meet all specified acceptance criteria', () => {
      // Brief documentation explains TDD workflow purpose
      expect(tddDocsContent).toContain('APEX supports Test-Driven Development (TDD) workflows')
      expect(tddDocsContent).toContain('Red-Green-Refactor cycle with AI assistance')

      // Explains stages
      expect(tddDocsContent).toContain('Red')
      expect(tddDocsContent).toContain('Green')
      expect(tddDocsContent).toContain('Refactor')

      // Explains usage
      expect(tddDocsContent).toContain('## Using TDD Workflows')
      expect(tddDocsContent).toContain('apex run')
      expect(tddDocsContent).toContain('--workflow tdd')

      // Documentation is accessible (linked in README)
      expect(readmeContent).toContain('[TDD Workflows](docs/tdd-workflows.md)')

      // Includes example usage
      expect(tddDocsContent).toContain('## Example Usage')
      expect(tddDocsContent).toContain('### Complete TDD Session')
    })
  })
})