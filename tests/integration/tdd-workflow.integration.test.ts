/**
 * TDD Workflow Integration Tests
 * Tests to verify TDD workflow configuration and functionality integration
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse as loadYaml } from 'yaml'

describe('TDD Workflow Integration Tests', () => {
  const rootDir = join(__dirname, '../..')
  let tddDocsContent: string

  beforeAll(() => {
    const tddDocsPath = join(rootDir, 'docs/tdd-workflows.md')
    expect(existsSync(tddDocsPath)).toBe(true)
    tddDocsContent = readFileSync(tddDocsPath, 'utf-8')
  })

  describe('TDD Configuration Validation', () => {
    it('should contain valid YAML configuration examples', () => {
      // Extract YAML code blocks from documentation
      const yamlBlocks = tddDocsContent.match(/```yaml\n([\s\S]*?)\n```/g)
      expect(yamlBlocks).toBeTruthy()
      expect(yamlBlocks!.length).toBeGreaterThan(5)

      // Test each YAML block for validity
      yamlBlocks!.forEach((block, index) => {
        const yamlContent = block.replace(/```yaml\n/, '').replace(/\n```$/, '')
        expect(() => loadYaml(yamlContent)).not.toThrow(`YAML block ${index + 1} should be valid`)
      })
    })

    it('should define proper TDD workflow structure', () => {
      // Extract TDD workflow YAML from docs
      const tddWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd[\s\S]*?)\n```/)
      expect(tddWorkflowMatch).toBeTruthy()

      const tddWorkflowYaml = tddWorkflowMatch![1]
      const workflow = loadYaml(tddWorkflowYaml) as any

      // Validate workflow structure
      expect(workflow.name).toBe('tdd')
      expect(workflow.description).toContain('Test-driven development workflow')
      expect(workflow.stages).toBeDefined()
      expect(Array.isArray(workflow.stages)).toBe(true)
      expect(workflow.stages.length).toBe(3)

      // Validate stages
      const stageNames = workflow.stages.map((stage: any) => stage.name)
      expect(stageNames).toContain('red_phase')
      expect(stageNames).toContain('green_phase')
      expect(stageNames).toContain('refactor_phase')
    })

    it('should define proper TDD feature workflow structure', () => {
      // Extract TDD feature workflow YAML from docs
      const tddFeatureWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd-feature[\s\S]*?)\n```/)
      expect(tddFeatureWorkflowMatch).toBeTruthy()

      const tddFeatureWorkflowYaml = tddFeatureWorkflowMatch![1]
      const workflow = loadYaml(tddFeatureWorkflowYaml) as any

      // Validate workflow structure
      expect(workflow.name).toBe('tdd-feature')
      expect(workflow.description).toContain('Full feature development using TDD principles')
      expect(workflow.stages).toBeDefined()
      expect(Array.isArray(workflow.stages)).toBe(true)
      expect(workflow.stages.length).toBeGreaterThan(4)

      // Validate key stages exist
      const stageNames = workflow.stages.map((stage: any) => stage.name)
      expect(stageNames).toContain('planning')
      expect(stageNames).toContain('test_planning')
      expect(stageNames).toContain('red_phase')
      expect(stageNames).toContain('green_phase')
      expect(stageNames).toContain('refactor_phase')
      expect(stageNames).toContain('review')
    })

    it('should define proper TDD configuration options', () => {
      // Extract main TDD config YAML from docs
      const configMatch = tddDocsContent.match(/```yaml\n([\s\S]*?codeQuality:[\s\S]*?)\n```/)
      expect(configMatch).toBeTruthy()

      const configYaml = configMatch![1]
      const config = loadYaml(configYaml) as any

      // Validate TDD configuration
      expect(config.codeQuality).toBeDefined()
      expect(config.codeQuality.enabled).toBe(true)
      expect(config.codeQuality.tddMode).toBe(true)
      expect(config.codeQuality.regressionGuard).toBe(true)

      // Validate testing configuration
      expect(config.codeQuality.testing).toBeDefined()
      expect(config.codeQuality.testing.runner).toBeDefined()
      expect(config.codeQuality.testing.watchMode).toBe(true)
      expect(config.codeQuality.testing.coverage).toBe(true)
      expect(typeof config.codeQuality.testing.minCoverage).toBe('number')

      // Validate workflows configuration
      expect(config.workflows).toBeDefined()
      expect(config.workflows.tdd).toBeDefined()
      expect(config.workflows.tdd.enabled).toBe(true)
      expect(config.workflows.tdd.testFirst).toBe(true)
      expect(config.workflows.tdd.requirePassingTests).toBe(true)
    })

    it('should define proper TDD-specific settings', () => {
      // Extract TDD-specific config YAML from docs
      const tddConfigMatch = tddDocsContent.match(/```yaml\n([\s\S]*?tdd:[\s\S]*?)\n```/)
      expect(tddConfigMatch).toBeTruthy()

      const tddConfigYaml = tddConfigMatch![1]
      const config = loadYaml(tddConfigYaml) as any

      // Validate TDD-specific settings
      expect(config.tdd).toBeDefined()
      expect(config.tdd.enforceRedPhase).toBe(true)
      expect(config.tdd.autoRunTests).toBe(true)
      expect(config.tdd.stopOnFailure).toBe(true)
      expect(typeof config.tdd.coverageThreshold).toBe('number')
      expect(config.tdd.testPatterns).toBeDefined()
      expect(Array.isArray(config.tdd.testPatterns)).toBe(true)
      expect(config.tdd.testPatterns.length).toBeGreaterThan(0)
    })
  })

  describe('Workflow Stage Validation', () => {
    it('should define proper stage dependencies', () => {
      const tddWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd[\s\S]*?)\n```/)
      const workflow = loadYaml(tddWorkflowMatch![1]) as any

      const greenPhase = workflow.stages.find((stage: any) => stage.name === 'green_phase')
      const refactorPhase = workflow.stages.find((stage: any) => stage.name === 'refactor_phase')

      expect(greenPhase.dependsOn).toContain('red_phase')
      expect(refactorPhase.dependsOn).toContain('green_phase')
    })

    it('should define proper stage outputs', () => {
      const tddWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd[\s\S]*?)\n```/)
      const workflow = loadYaml(tddWorkflowMatch![1]) as any

      const redPhase = workflow.stages.find((stage: any) => stage.name === 'red_phase')
      const greenPhase = workflow.stages.find((stage: any) => stage.name === 'green_phase')
      const refactorPhase = workflow.stages.find((stage: any) => stage.name === 'refactor_phase')

      expect(redPhase.outputs).toContain('test_files')
      expect(redPhase.outputs).toContain('test_requirements')

      expect(greenPhase.outputs).toContain('implementation')
      expect(greenPhase.outputs).toContain('passing_tests')

      expect(refactorPhase.outputs).toContain('refactored_code')
      expect(refactorPhase.outputs).toContain('maintained_coverage')
    })

    it('should define proper stage validation rules', () => {
      const tddWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd[\s\S]*?)\n```/)
      const workflow = loadYaml(tddWorkflowMatch![1]) as any

      const redPhase = workflow.stages.find((stage: any) => stage.name === 'red_phase')
      const greenPhase = workflow.stages.find((stage: any) => stage.name === 'green_phase')
      const refactorPhase = workflow.stages.find((stage: any) => stage.name === 'refactor_phase')

      expect(redPhase.validation).toBeDefined()
      expect(redPhase.validation.tests_fail).toBe(true)

      expect(greenPhase.validation).toBeDefined()
      expect(greenPhase.validation.tests_pass).toBe(true)

      expect(refactorPhase.validation).toBeDefined()
      expect(refactorPhase.validation.tests_pass).toBe(true)
      expect(refactorPhase.validation.coverage_maintained).toBe(true)
    })

    it('should assign correct agents to stages', () => {
      const tddWorkflowMatch = tddDocsContent.match(/```yaml\n([\s\S]*?name: tdd[\s\S]*?)\n```/)
      const workflow = loadYaml(tddWorkflowMatch![1]) as any

      const redPhase = workflow.stages.find((stage: any) => stage.name === 'red_phase')
      const greenPhase = workflow.stages.find((stage: any) => stage.name === 'green_phase')
      const refactorPhase = workflow.stages.find((stage: any) => stage.name === 'refactor_phase')

      expect(redPhase.agent).toBe('tester')
      expect(greenPhase.agent).toBe('developer')
      expect(refactorPhase.agent).toBe('developer')
    })
  })

  describe('Command Examples Validation', () => {
    it('should provide valid apex command examples', () => {
      const bashBlocks = tddDocsContent.match(/```bash\n([\s\S]*?)\n```/g)
      expect(bashBlocks).toBeTruthy()

      // Extract all apex commands from bash blocks
      const apexCommands: string[] = []
      bashBlocks!.forEach(block => {
        const lines = block.split('\n')
        lines.forEach(line => {
          if (line.trim().startsWith('apex ')) {
            apexCommands.push(line.trim())
          }
        })
      })

      expect(apexCommands.length).toBeGreaterThan(10)

      // Validate specific command patterns
      expect(apexCommands.some(cmd => cmd.includes('apex run') && cmd.includes('--workflow tdd-feature'))).toBe(true)
      expect(apexCommands.some(cmd => cmd.includes('apex run') && cmd.includes('--workflow tdd'))).toBe(true)
      expect(apexCommands.some(cmd => cmd.includes('apex run') && cmd.includes('--tdd'))).toBe(true)
      expect(apexCommands.some(cmd => cmd.includes('apex config set codeQuality.tddMode true'))).toBe(true)
      expect(apexCommands.some(cmd => cmd.includes('apex test --coverage'))).toBe(true)
      expect(apexCommands.some(cmd => cmd.includes('apex validate --tdd'))).toBe(true)
    })

    it('should provide meaningful example tasks', () => {
      // Check for realistic development tasks in examples
      expect(tddDocsContent).toContain('Add user authentication')
      expect(tddDocsContent).toContain('Fix validation issue')
      expect(tddDocsContent).toContain('Refactor user service')
      expect(tddDocsContent).toContain('Add payment processing')
      expect(tddDocsContent).toContain('Add shopping cart functionality')
    })
  })

  describe('Metrics Configuration Validation', () => {
    it('should define valid TDD metrics structure', () => {
      const metricsMatch = tddDocsContent.match(/```yaml\n([\s\S]*?metrics:[\s\S]*?)\n```/)
      expect(metricsMatch).toBeTruthy()

      const metricsYaml = metricsMatch![1]
      const config = loadYaml(metricsYaml) as any

      expect(config.metrics).toBeDefined()
      expect(config.metrics.tdd).toBeDefined()
      expect(Array.isArray(config.metrics.tdd)).toBe(true)

      // Validate metric definitions
      const metrics = config.metrics.tdd
      expect(metrics.some((metric: any) => 'cycle_time' in metric)).toBe(true)
      expect(metrics.some((metric: any) => 'test_first_percentage' in metric)).toBe(true)
      expect(metrics.some((metric: any) => 'bug_density' in metric)).toBe(true)
      expect(metrics.some((metric: any) => 'coverage_improvement' in metric)).toBe(true)
    })
  })

  describe('Code Quality Integration Validation', () => {
    it('should define valid combined TDD and quality configuration', () => {
      // Find the combined config block
      const combinedConfigMatch = tddDocsContent.match(/```yaml\n([\s\S]*?# Combined TDD and quality configuration[\s\S]*?)\n```/)
      expect(combinedConfigMatch).toBeTruthy()

      const combinedConfigYaml = combinedConfigMatch![1].split('\n').filter(line => !line.startsWith('#')).join('\n')
      const config = loadYaml(combinedConfigYaml) as any

      expect(config.codeQuality).toBeDefined()
      expect(config.codeQuality.enabled).toBe(true)
      expect(config.codeQuality.tddMode).toBe(true)
      expect(config.codeQuality.lintAfterEdit).toBe(true)
      expect(config.codeQuality.autoFix).toBe(true)

      expect(config.codeQuality.validation).toBeDefined()
      expect(config.codeQuality.validation.preCommit).toBeDefined()
      expect(Array.isArray(config.codeQuality.validation.preCommit)).toBe(true)
      expect(config.codeQuality.validation.preCommit).toContain('lint_check')
      expect(config.codeQuality.validation.preCommit).toContain('test_run')
      expect(config.codeQuality.validation.preCommit).toContain('coverage_check')
    })
  })

  describe('Custom TDD Configuration Validation', () => {
    it('should define valid custom TDD workflow configuration', () => {
      const customConfigMatch = tddDocsContent.match(/```yaml\n([\s\S]*?# \.apex\/config\.yaml - Custom TDD setup[\s\S]*?)\n```/)
      expect(customConfigMatch).toBeTruthy()

      const customConfigYaml = customConfigMatch![1].split('\n').filter(line => !line.startsWith('#')).join('\n')
      const config = loadYaml(customConfigYaml) as any

      expect(config.workflows).toBeDefined()
      expect(config.workflows['custom-tdd']).toBeDefined()
      expect(config.workflows['custom-tdd'].stages).toBeDefined()
      expect(Array.isArray(config.workflows['custom-tdd'].stages)).toBe(true)

      const stageNames = config.workflows['custom-tdd'].stages.map((stage: any) => stage.name)
      expect(stageNames).toContain('acceptance_test')
      expect(stageNames).toContain('unit_test')
      expect(stageNames).toContain('implementation')
      expect(stageNames).toContain('refactor')

      expect(config.tdd).toBeDefined()
      expect(config.tdd.enforceRedPhase).toBe(true)
      expect(typeof config.tdd.minCoverage).toBe('number')
      expect(typeof config.tdd.testTimeout).toBe('number')
      expect(config.tdd.watchMode).toBe(true)
    })
  })

  describe('Documentation Cross-Reference Validation', () => {
    it('should reference valid related documentation files', () => {
      const crossReferences = [
        'code-quality.md',
        'workflows.md',
        'agents.md',
        'best-practices.md'
      ]

      crossReferences.forEach(file => {
        expect(tddDocsContent).toContain(`(${file})`)
      })
    })

    it('should provide clear navigation structure', () => {
      expect(tddDocsContent).toContain('## Next Steps')
      expect(tddDocsContent).toContain('Code Quality Integration')
      expect(tddDocsContent).toContain('Workflow Authoring')
      expect(tddDocsContent).toContain('Agent Configuration')
      expect(tddDocsContent).toContain('Best Practices')
    })
  })
})