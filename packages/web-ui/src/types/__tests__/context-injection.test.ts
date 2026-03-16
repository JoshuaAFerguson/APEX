/**
 * Comprehensive tests for Context Injection types and utility functions
 * Tests type safety, default values, validation functions, and edge cases
 */

import { describe, it, expect } from 'vitest'
import type {
  ContextSourceType,
  ContextTargetType,
  ContextInjectionPriority,
  ContextInjectionStatus,
  ContextInjectionMode,
  ContextSource,
  ContextTarget,
  ContextInjectionConfig,
  ContextInjection,
  ContextInjectionProps,
  ContextInjectionSummary,
  ContextInjectionResult,
  ContextInjectionBatch,
} from '../context-injection'
import {
  DEFAULT_CONTEXT_INJECTION_CONFIG,
  DEFAULT_CONTEXT_INJECTION_PROPS,
  EMPTY_CONTEXT_INJECTION_SUMMARY,
  CONTEXT_INJECTION_STATUS_LABELS,
  CONTEXT_INJECTION_PRIORITY_LABELS,
  CONTEXT_SOURCE_TYPE_LABELS,
  CONTEXT_TARGET_TYPE_LABELS,
  CONTEXT_INJECTION_STATUS_STYLES,
  CONTEXT_INJECTION_PRIORITY_STYLES,
  calculateInjectionSummary,
  validateContextSource,
  validateContextTarget,
  checkContentSize,
  truncateContent,
} from '../context-injection'

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockContextSource = (overrides: Partial<ContextSource> = {}): ContextSource => ({
  id: 'source-1',
  type: 'file',
  name: 'Test Source',
  uri: '/path/to/source',
  ...overrides,
})

const createMockContextTarget = (overrides: Partial<ContextTarget> = {}): ContextTarget => ({
  id: 'target-1',
  type: 'task',
  name: 'Test Target',
  uri: 'task-123',
  ...overrides,
})

const createMockContextInjectionConfig = (
  overrides: Partial<ContextInjectionConfig> = {}
): ContextInjectionConfig => ({
  ...DEFAULT_CONTEXT_INJECTION_CONFIG,
  ...overrides,
})

const createMockContextInjection = (
  overrides: Partial<ContextInjection> = {}
): ContextInjection => ({
  id: 'injection-1',
  source: createMockContextSource(),
  target: createMockContextTarget(),
  config: createMockContextInjectionConfig(),
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('ContextSource Interface', () => {
  it('should have all required fields with correct types', () => {
    const source = createMockContextSource()

    expect(typeof source.id).toBe('string')
    expect(typeof source.type).toBe('string')
    expect(typeof source.name).toBe('string')
    expect(typeof source.uri).toBe('string')
  })

  it('should support optional fields', () => {
    const source = createMockContextSource({
      description: 'A test source',
      mimeType: 'text/plain',
      available: true,
      lastModified: new Date(),
      contentSize: 1024,
      metadata: { key: 'value' },
    })

    expect(typeof source.description).toBe('string')
    expect(typeof source.mimeType).toBe('string')
    expect(typeof source.available).toBe('boolean')
    expect(source.lastModified).toBeInstanceOf(Date)
    expect(typeof source.contentSize).toBe('number')
    expect(typeof source.metadata).toBe('object')
  })

  it('should work without optional fields', () => {
    const source = createMockContextSource()

    expect(source.description).toBeUndefined()
    expect(source.mimeType).toBeUndefined()
    expect(source.available).toBeUndefined()
    expect(source.lastModified).toBeUndefined()
    expect(source.contentSize).toBeUndefined()
    expect(source.metadata).toBeUndefined()
  })

  it('should accept all valid source types', () => {
    const sourceTypes: ContextSourceType[] = ['file', 'task', 'agent', 'user', 'system', 'external']

    sourceTypes.forEach((type) => {
      const source = createMockContextSource({ type })
      expect(source.type).toBe(type)
    })
  })
})

describe('ContextTarget Interface', () => {
  it('should have all required fields with correct types', () => {
    const target = createMockContextTarget()

    expect(typeof target.id).toBe('string')
    expect(typeof target.type).toBe('string')
    expect(typeof target.name).toBe('string')
    expect(typeof target.uri).toBe('string')
  })

  it('should support optional fields', () => {
    const target = createMockContextTarget({
      description: 'A test target',
      available: true,
      maxContentSize: 100000,
      acceptedMimeTypes: ['text/plain', 'application/json'],
      metadata: { key: 'value' },
    })

    expect(typeof target.description).toBe('string')
    expect(typeof target.available).toBe('boolean')
    expect(typeof target.maxContentSize).toBe('number')
    expect(Array.isArray(target.acceptedMimeTypes)).toBe(true)
    expect(typeof target.metadata).toBe('object')
  })

  it('should accept all valid target types', () => {
    const targetTypes: ContextTargetType[] = ['task', 'agent', 'prompt', 'panel', 'workflow']

    targetTypes.forEach((type) => {
      const target = createMockContextTarget({ type })
      expect(target.type).toBe(type)
    })
  })
})

describe('ContextInjectionConfig Interface', () => {
  it('should have all required fields with correct types', () => {
    const config = createMockContextInjectionConfig()

    expect(typeof config.enabled).toBe('boolean')
    expect(typeof config.mode).toBe('string')
    expect(typeof config.priority).toBe('string')
    expect(typeof config.maxContentSize).toBe('number')
    expect(typeof config.truncateOnOverflow).toBe('boolean')
    expect(typeof config.cacheEnabled).toBe('boolean')
    expect(typeof config.cacheTtlMs).toBe('number')
    expect(typeof config.validateContent).toBe('boolean')
    expect(typeof config.debugMode).toBe('boolean')
  })

  it('should support optional retry configuration', () => {
    const config = createMockContextInjectionConfig({
      retry: {
        maxAttempts: 3,
        delayMs: 1000,
        exponentialBackoff: true,
      },
    })

    expect(config.retry).toBeDefined()
    expect(config.retry!.maxAttempts).toBe(3)
    expect(config.retry!.delayMs).toBe(1000)
    expect(config.retry!.exponentialBackoff).toBe(true)
  })

  it('should support optional filters', () => {
    const config = createMockContextInjectionConfig({
      filters: ['filter1', 'filter2'],
    })

    expect(Array.isArray(config.filters)).toBe(true)
    expect(config.filters).toHaveLength(2)
  })
})

describe('ContextInjection Interface', () => {
  it('should have all required fields with correct types', () => {
    const injection = createMockContextInjection()

    expect(typeof injection.id).toBe('string')
    expect(typeof injection.source).toBe('object')
    expect(typeof injection.target).toBe('object')
    expect(typeof injection.config).toBe('object')
    expect(typeof injection.status).toBe('string')
    expect(injection.createdAt).toBeInstanceOf(Date)
    expect(injection.updatedAt).toBeInstanceOf(Date)
  })

  it('should support optional fields', () => {
    const injection = createMockContextInjection({
      content: 'Test content',
      error: null,
      executedAt: new Date(),
      durationMs: 100,
      retryCount: 2,
      metadata: { key: 'value' },
    })

    expect(typeof injection.content).toBe('string')
    expect(injection.error).toBeNull()
    expect(injection.executedAt).toBeInstanceOf(Date)
    expect(typeof injection.durationMs).toBe('number')
    expect(typeof injection.retryCount).toBe('number')
    expect(typeof injection.metadata).toBe('object')
  })

  it('should accept all valid status values', () => {
    const statuses: ContextInjectionStatus[] = ['pending', 'active', 'completed', 'failed', 'skipped']

    statuses.forEach((status) => {
      const injection = createMockContextInjection({ status })
      expect(injection.status).toBe(status)
    })
  })
})

describe('ContextInjectionProps Interface', () => {
  it('should accept minimal props with just injections', () => {
    const minimalProps: ContextInjectionProps = {
      injections: [],
    }

    expect(minimalProps.injections).toBeDefined()
    expect(minimalProps.loading).toBeUndefined()
  })

  it('should accept all optional props', () => {
    const fullProps: ContextInjectionProps = {
      injections: [createMockContextInjection()],
      loading: true,
      error: 'Test error',
      onSelect: (injection) => console.log(injection),
      onCreate: (injection) => console.log(injection),
      onUpdate: (id, updates) => console.log(id, updates),
      onDelete: (id) => console.log(id),
      onExecute: (id) => console.log(id),
      onRetry: (id) => console.log(id),
      showStatus: true,
      showDetails: false,
      editable: true,
      className: 'custom-class',
      emptyMessage: 'Custom empty message',
    }

    expect(fullProps.injections).toHaveLength(1)
    expect(fullProps.loading).toBe(true)
    expect(fullProps.error).toBe('Test error')
    expect(typeof fullProps.onSelect).toBe('function')
    expect(typeof fullProps.onCreate).toBe('function')
    expect(typeof fullProps.onUpdate).toBe('function')
    expect(typeof fullProps.onDelete).toBe('function')
    expect(typeof fullProps.onExecute).toBe('function')
    expect(typeof fullProps.onRetry).toBe('function')
    expect(fullProps.showStatus).toBe(true)
    expect(fullProps.showDetails).toBe(false)
    expect(fullProps.editable).toBe(true)
    expect(fullProps.className).toBe('custom-class')
    expect(fullProps.emptyMessage).toBe('Custom empty message')
  })
})

// ============================================================================
// Type Union Tests
// ============================================================================

describe('Type Unions', () => {
  describe('ContextSourceType', () => {
    it('should accept all valid source type values', () => {
      const types: ContextSourceType[] = ['file', 'task', 'agent', 'user', 'system', 'external']
      types.forEach((type) => {
        expect(typeof type).toBe('string')
      })
    })
  })

  describe('ContextTargetType', () => {
    it('should accept all valid target type values', () => {
      const types: ContextTargetType[] = ['task', 'agent', 'prompt', 'panel', 'workflow']
      types.forEach((type) => {
        expect(typeof type).toBe('string')
      })
    })
  })

  describe('ContextInjectionPriority', () => {
    it('should accept all valid priority values', () => {
      const priorities: ContextInjectionPriority[] = ['critical', 'high', 'normal', 'low']
      priorities.forEach((priority) => {
        expect(typeof priority).toBe('string')
      })
    })
  })

  describe('ContextInjectionStatus', () => {
    it('should accept all valid status values', () => {
      const statuses: ContextInjectionStatus[] = ['pending', 'active', 'completed', 'failed', 'skipped']
      statuses.forEach((status) => {
        expect(typeof status).toBe('string')
      })
    })
  })

  describe('ContextInjectionMode', () => {
    it('should accept all valid mode values', () => {
      const modes: ContextInjectionMode[] = ['prepend', 'append', 'replace', 'merge']
      modes.forEach((mode) => {
        expect(typeof mode).toBe('string')
      })
    })
  })
})

// ============================================================================
// Default Values and Constants Tests
// ============================================================================

describe('Default Values and Constants', () => {
  describe('DEFAULT_CONTEXT_INJECTION_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.enabled).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.mode).toBe('append')
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.priority).toBe('normal')
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.maxContentSize).toBe(50000)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.truncateOnOverflow).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.cacheEnabled).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.cacheTtlMs).toBe(300000)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.validateContent).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_CONFIG.debugMode).toBe(false)
    })

    it('should have all required keys', () => {
      const expectedKeys = [
        'enabled',
        'mode',
        'priority',
        'maxContentSize',
        'truncateOnOverflow',
        'cacheEnabled',
        'cacheTtlMs',
        'validateContent',
        'debugMode',
      ]

      expectedKeys.forEach((key) => {
        expect(DEFAULT_CONTEXT_INJECTION_CONFIG).toHaveProperty(key)
      })
    })
  })

  describe('DEFAULT_CONTEXT_INJECTION_PROPS', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_CONTEXT_INJECTION_PROPS.loading).toBe(false)
      expect(DEFAULT_CONTEXT_INJECTION_PROPS.showStatus).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_PROPS.showDetails).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_PROPS.editable).toBe(true)
      expect(DEFAULT_CONTEXT_INJECTION_PROPS.emptyMessage).toBe('No context injections configured')
    })
  })

  describe('EMPTY_CONTEXT_INJECTION_SUMMARY', () => {
    it('should have zero/empty values for all fields', () => {
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.total).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.pending).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.active).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.completed).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.failed).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.skipped).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.avgDurationMs).toBe(0)
      expect(EMPTY_CONTEXT_INJECTION_SUMMARY.successRate).toBe(0)
    })
  })

  describe('CONTEXT_INJECTION_STATUS_LABELS', () => {
    it('should have labels for all status values', () => {
      const statuses: ContextInjectionStatus[] = ['pending', 'active', 'completed', 'failed', 'skipped']

      statuses.forEach((status) => {
        expect(CONTEXT_INJECTION_STATUS_LABELS).toHaveProperty(status)
        expect(typeof CONTEXT_INJECTION_STATUS_LABELS[status]).toBe('string')
        expect(CONTEXT_INJECTION_STATUS_LABELS[status].length).toBeGreaterThan(0)
      })
    })

    it('should have expected label values', () => {
      expect(CONTEXT_INJECTION_STATUS_LABELS.pending).toBe('Pending')
      expect(CONTEXT_INJECTION_STATUS_LABELS.active).toBe('Active')
      expect(CONTEXT_INJECTION_STATUS_LABELS.completed).toBe('Completed')
      expect(CONTEXT_INJECTION_STATUS_LABELS.failed).toBe('Failed')
      expect(CONTEXT_INJECTION_STATUS_LABELS.skipped).toBe('Skipped')
    })
  })

  describe('CONTEXT_INJECTION_PRIORITY_LABELS', () => {
    it('should have labels for all priority values', () => {
      const priorities: ContextInjectionPriority[] = ['critical', 'high', 'normal', 'low']

      priorities.forEach((priority) => {
        expect(CONTEXT_INJECTION_PRIORITY_LABELS).toHaveProperty(priority)
        expect(typeof CONTEXT_INJECTION_PRIORITY_LABELS[priority]).toBe('string')
        expect(CONTEXT_INJECTION_PRIORITY_LABELS[priority].length).toBeGreaterThan(0)
      })
    })
  })

  describe('CONTEXT_SOURCE_TYPE_LABELS', () => {
    it('should have labels for all source types', () => {
      const sourceTypes: ContextSourceType[] = ['file', 'task', 'agent', 'user', 'system', 'external']

      sourceTypes.forEach((type) => {
        expect(CONTEXT_SOURCE_TYPE_LABELS).toHaveProperty(type)
        expect(typeof CONTEXT_SOURCE_TYPE_LABELS[type]).toBe('string')
      })
    })
  })

  describe('CONTEXT_TARGET_TYPE_LABELS', () => {
    it('should have labels for all target types', () => {
      const targetTypes: ContextTargetType[] = ['task', 'agent', 'prompt', 'panel', 'workflow']

      targetTypes.forEach((type) => {
        expect(CONTEXT_TARGET_TYPE_LABELS).toHaveProperty(type)
        expect(typeof CONTEXT_TARGET_TYPE_LABELS[type]).toBe('string')
      })
    })
  })

  describe('CONTEXT_INJECTION_STATUS_STYLES', () => {
    it('should have style configurations for all status values', () => {
      const statuses: ContextInjectionStatus[] = ['pending', 'active', 'completed', 'failed', 'skipped']

      statuses.forEach((status) => {
        expect(CONTEXT_INJECTION_STATUS_STYLES).toHaveProperty(status)

        const styles = CONTEXT_INJECTION_STATUS_STYLES[status]
        expect(styles).toHaveProperty('bg')
        expect(styles).toHaveProperty('text')
        expect(styles).toHaveProperty('border')
        expect(styles).toHaveProperty('icon')
        expect(styles).toHaveProperty('dot')

        Object.values(styles).forEach((styleValue) => {
          expect(typeof styleValue).toBe('string')
          expect(styleValue.length).toBeGreaterThan(0)
        })
      })
    })

    it('should follow consistent naming patterns', () => {
      Object.values(CONTEXT_INJECTION_STATUS_STYLES).forEach((styles) => {
        expect(styles.bg).toMatch(/^bg-/)
        expect(styles.text).toMatch(/^text-/)
        expect(styles.border).toMatch(/^border-/)
        expect(styles.icon).toMatch(/^text-/)
        expect(styles.dot).toMatch(/^bg-/)
      })
    })

    it('should have consistent color schemes for status groups', () => {
      // Completed should use green colors
      expect(CONTEXT_INJECTION_STATUS_STYLES.completed.text).toContain('green')
      expect(CONTEXT_INJECTION_STATUS_STYLES.completed.icon).toContain('green')

      // Failed should use red colors
      expect(CONTEXT_INJECTION_STATUS_STYLES.failed.text).toContain('red')
      expect(CONTEXT_INJECTION_STATUS_STYLES.failed.icon).toContain('red')

      // Active should use apex colors
      expect(CONTEXT_INJECTION_STATUS_STYLES.active.text).toContain('apex')
      expect(CONTEXT_INJECTION_STATUS_STYLES.active.icon).toContain('apex')

      // Skipped should use yellow colors
      expect(CONTEXT_INJECTION_STATUS_STYLES.skipped.text).toContain('yellow')
      expect(CONTEXT_INJECTION_STATUS_STYLES.skipped.icon).toContain('yellow')
    })
  })

  describe('CONTEXT_INJECTION_PRIORITY_STYLES', () => {
    it('should have style configurations for all priority values', () => {
      const priorities: ContextInjectionPriority[] = ['critical', 'high', 'normal', 'low']

      priorities.forEach((priority) => {
        expect(CONTEXT_INJECTION_PRIORITY_STYLES).toHaveProperty(priority)

        const styles = CONTEXT_INJECTION_PRIORITY_STYLES[priority]
        expect(styles).toHaveProperty('bg')
        expect(styles).toHaveProperty('text')
        expect(styles).toHaveProperty('border')
      })
    })
  })
})

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateInjectionSummary', () => {
    it('should return empty summary for empty array', () => {
      const summary = calculateInjectionSummary([])

      expect(summary.total).toBe(0)
      expect(summary.pending).toBe(0)
      expect(summary.active).toBe(0)
      expect(summary.completed).toBe(0)
      expect(summary.failed).toBe(0)
      expect(summary.skipped).toBe(0)
      expect(summary.avgDurationMs).toBe(0)
      expect(summary.successRate).toBe(0)
    })

    it('should correctly count status types', () => {
      const injections: ContextInjection[] = [
        createMockContextInjection({ id: '1', status: 'pending' }),
        createMockContextInjection({ id: '2', status: 'pending' }),
        createMockContextInjection({ id: '3', status: 'active' }),
        createMockContextInjection({ id: '4', status: 'completed' }),
        createMockContextInjection({ id: '5', status: 'completed' }),
        createMockContextInjection({ id: '6', status: 'completed' }),
        createMockContextInjection({ id: '7', status: 'failed' }),
        createMockContextInjection({ id: '8', status: 'skipped' }),
      ]

      const summary = calculateInjectionSummary(injections)

      expect(summary.total).toBe(8)
      expect(summary.pending).toBe(2)
      expect(summary.active).toBe(1)
      expect(summary.completed).toBe(3)
      expect(summary.failed).toBe(1)
      expect(summary.skipped).toBe(1)
    })

    it('should calculate average duration correctly', () => {
      const injections: ContextInjection[] = [
        createMockContextInjection({ id: '1', status: 'completed', durationMs: 100 }),
        createMockContextInjection({ id: '2', status: 'completed', durationMs: 200 }),
        createMockContextInjection({ id: '3', status: 'completed', durationMs: 300 }),
      ]

      const summary = calculateInjectionSummary(injections)

      expect(summary.avgDurationMs).toBe(200)
    })

    it('should handle injections without duration', () => {
      const injections: ContextInjection[] = [
        createMockContextInjection({ id: '1', status: 'pending' }),
        createMockContextInjection({ id: '2', status: 'completed', durationMs: 100 }),
      ]

      const summary = calculateInjectionSummary(injections)

      expect(summary.avgDurationMs).toBe(100)
    })

    it('should calculate success rate correctly', () => {
      const injections: ContextInjection[] = [
        createMockContextInjection({ id: '1', status: 'completed' }),
        createMockContextInjection({ id: '2', status: 'completed' }),
        createMockContextInjection({ id: '3', status: 'failed' }),
        createMockContextInjection({ id: '4', status: 'pending' }),
      ]

      const summary = calculateInjectionSummary(injections)

      expect(summary.successRate).toBe(0.5)
    })
  })

  describe('validateContextSource', () => {
    it('should return no errors for valid source', () => {
      const source = createMockContextSource()
      const errors = validateContextSource(source)

      expect(errors).toHaveLength(0)
    })

    it('should return error for missing id', () => {
      const source = createMockContextSource()
      delete (source as Partial<ContextSource>).id
      const errors = validateContextSource(source)

      expect(errors.some((e) => e.includes('ID'))).toBe(true)
    })

    it('should return error for missing type', () => {
      const source = createMockContextSource()
      delete (source as Partial<ContextSource>).type
      const errors = validateContextSource(source)

      expect(errors.some((e) => e.includes('type'))).toBe(true)
    })

    it('should return error for missing name', () => {
      const source = createMockContextSource()
      delete (source as Partial<ContextSource>).name
      const errors = validateContextSource(source)

      expect(errors.some((e) => e.includes('name'))).toBe(true)
    })

    it('should return error for missing uri', () => {
      const source = createMockContextSource()
      delete (source as Partial<ContextSource>).uri
      const errors = validateContextSource(source)

      expect(errors.some((e) => e.includes('URI'))).toBe(true)
    })

    it('should return multiple errors for multiple missing fields', () => {
      const errors = validateContextSource({})

      expect(errors.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('validateContextTarget', () => {
    it('should return no errors for valid target', () => {
      const target = createMockContextTarget()
      const errors = validateContextTarget(target)

      expect(errors).toHaveLength(0)
    })

    it('should return error for missing id', () => {
      const target = createMockContextTarget()
      delete (target as Partial<ContextTarget>).id
      const errors = validateContextTarget(target)

      expect(errors.some((e) => e.includes('ID'))).toBe(true)
    })

    it('should return error for missing type', () => {
      const target = createMockContextTarget()
      delete (target as Partial<ContextTarget>).type
      const errors = validateContextTarget(target)

      expect(errors.some((e) => e.includes('type'))).toBe(true)
    })

    it('should return error for missing name', () => {
      const target = createMockContextTarget()
      delete (target as Partial<ContextTarget>).name
      const errors = validateContextTarget(target)

      expect(errors.some((e) => e.includes('name'))).toBe(true)
    })

    it('should return error for missing uri', () => {
      const target = createMockContextTarget()
      delete (target as Partial<ContextTarget>).uri
      const errors = validateContextTarget(target)

      expect(errors.some((e) => e.includes('URI'))).toBe(true)
    })
  })

  describe('checkContentSize', () => {
    it('should return valid for content within limits', () => {
      const content = 'Hello, World!'
      const config = createMockContextInjectionConfig({ maxContentSize: 100 })
      const result = checkContentSize(content, config)

      expect(result.valid).toBe(true)
      expect(result.overflow).toBe(0)
    })

    it('should return invalid for content exceeding limits', () => {
      const content = 'a'.repeat(100)
      const config = createMockContextInjectionConfig({ maxContentSize: 50 })
      const result = checkContentSize(content, config)

      expect(result.valid).toBe(false)
      expect(result.overflow).toBe(50)
    })

    it('should return correct size in bytes', () => {
      const content = 'Hello'
      const config = createMockContextInjectionConfig({ maxContentSize: 100 })
      const result = checkContentSize(content, config)

      expect(result.size).toBe(5)
      expect(result.maxSize).toBe(100)
    })

    it('should handle unicode characters correctly', () => {
      const content = '🎉' // 4 bytes in UTF-8
      const config = createMockContextInjectionConfig({ maxContentSize: 10 })
      const result = checkContentSize(content, config)

      expect(result.size).toBe(4)
      expect(result.valid).toBe(true)
    })

    it('should handle empty content', () => {
      const content = ''
      const config = createMockContextInjectionConfig({ maxContentSize: 10 })
      const result = checkContentSize(content, config)

      expect(result.size).toBe(0)
      expect(result.valid).toBe(true)
      expect(result.overflow).toBe(0)
    })

    it('should handle exact limit content', () => {
      const content = 'Hello' // 5 bytes
      const config = createMockContextInjectionConfig({ maxContentSize: 5 })
      const result = checkContentSize(content, config)

      expect(result.valid).toBe(true)
      expect(result.overflow).toBe(0)
    })
  })

  describe('truncateContent', () => {
    it('should not truncate content within limits', () => {
      const content = 'Hello, World!'
      const result = truncateContent(content, 100)

      expect(result).toBe(content)
    })

    it('should truncate content exceeding limits', () => {
      const content = 'a'.repeat(100)
      const result = truncateContent(content, 50)

      expect(result.length).toBeLessThanOrEqual(50)
      expect(result).toContain('...[truncated]')
    })

    it('should use custom suffix', () => {
      const content = 'a'.repeat(100)
      const result = truncateContent(content, 50, '...')

      expect(result).toContain('...')
      expect(result).not.toContain('[truncated]')
    })

    it('should handle empty content', () => {
      const result = truncateContent('', 100)

      expect(result).toBe('')
    })

    it('should handle very small maxSize', () => {
      const content = 'Hello, World!'
      const result = truncateContent(content, 5)

      expect(result.length).toBeLessThanOrEqual(5)
    })

    it('should handle unicode characters correctly', () => {
      const content = '🎉🎊🎈🎁'
      const result = truncateContent(content, 20)

      // Should handle multi-byte characters gracefully
      expect(typeof result).toBe('string')
    })
  })
})

// ============================================================================
// Helper Types Tests
// ============================================================================

describe('Helper Types', () => {
  describe('ContextInjectionSummary', () => {
    it('should have correct structure', () => {
      const summary: ContextInjectionSummary = {
        total: 10,
        pending: 2,
        active: 3,
        completed: 4,
        failed: 1,
        skipped: 0,
        avgDurationMs: 150,
        successRate: 0.8,
      }

      expect(typeof summary.total).toBe('number')
      expect(typeof summary.pending).toBe('number')
      expect(typeof summary.active).toBe('number')
      expect(typeof summary.completed).toBe('number')
      expect(typeof summary.failed).toBe('number')
      expect(typeof summary.skipped).toBe('number')
      expect(typeof summary.avgDurationMs).toBe('number')
      expect(typeof summary.successRate).toBe('number')
    })
  })

  describe('ContextInjectionResult', () => {
    it('should support successful result', () => {
      const result: ContextInjectionResult = {
        injection: createMockContextInjection(),
        success: true,
        content: 'Injected content',
        contentSize: 16,
        durationMs: 100,
      }

      expect(result.success).toBe(true)
      expect(result.content).toBe('Injected content')
      expect(result.error).toBeUndefined()
    })

    it('should support failed result', () => {
      const result: ContextInjectionResult = {
        injection: createMockContextInjection({ status: 'failed' }),
        success: false,
        durationMs: 50,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch content',
          details: { statusCode: 404 },
        },
      }

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.code).toBe('FETCH_ERROR')
    })

    it('should support warnings', () => {
      const result: ContextInjectionResult = {
        injection: createMockContextInjection(),
        success: true,
        durationMs: 100,
        warnings: ['Content was truncated', 'Cache miss'],
      }

      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.warnings).toHaveLength(2)
    })
  })

  describe('ContextInjectionBatch', () => {
    it('should have correct structure', () => {
      const batch: ContextInjectionBatch = {
        id: 'batch-1',
        injections: [createMockContextInjection()],
        parallel: true,
        stopOnError: false,
        status: 'active',
        results: [],
      }

      expect(typeof batch.id).toBe('string')
      expect(Array.isArray(batch.injections)).toBe(true)
      expect(typeof batch.parallel).toBe('boolean')
      expect(typeof batch.stopOnError).toBe('boolean')
      expect(typeof batch.status).toBe('string')
      expect(Array.isArray(batch.results)).toBe(true)
    })

    it('should support timestamps', () => {
      const batch: ContextInjectionBatch = {
        id: 'batch-1',
        injections: [],
        parallel: false,
        stopOnError: true,
        status: 'completed',
        results: [],
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-02'),
      }

      expect(batch.startedAt).toBeInstanceOf(Date)
      expect(batch.completedAt).toBeInstanceOf(Date)
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Boundary Values', () => {
    it('should handle zero maxContentSize', () => {
      const config = createMockContextInjectionConfig({ maxContentSize: 0 })
      const result = checkContentSize('any content', config)

      expect(result.valid).toBe(false)
    })

    it('should handle very large maxContentSize', () => {
      const config = createMockContextInjectionConfig({ maxContentSize: Number.MAX_SAFE_INTEGER })
      const content = 'a'.repeat(10000)
      const result = checkContentSize(content, config)

      expect(result.valid).toBe(true)
    })

    it('should handle zero cacheTtlMs', () => {
      const config = createMockContextInjectionConfig({ cacheTtlMs: 0 })
      expect(config.cacheTtlMs).toBe(0)
    })
  })

  describe('Empty Collections', () => {
    it('should handle empty injections array in props', () => {
      const props: ContextInjectionProps = {
        injections: [],
      }

      expect(props.injections).toHaveLength(0)
    })

    it('should handle empty filters array', () => {
      const config = createMockContextInjectionConfig({ filters: [] })
      expect(config.filters).toHaveLength(0)
    })

    it('should handle empty acceptedMimeTypes array', () => {
      const target = createMockContextTarget({ acceptedMimeTypes: [] })
      expect(target.acceptedMimeTypes).toHaveLength(0)
    })
  })

  describe('String Handling', () => {
    it('should handle empty strings', () => {
      const source = createMockContextSource({
        id: '',
        name: '',
        uri: '',
      })

      const errors = validateContextSource(source)
      expect(errors.length).toBeGreaterThan(0)
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      const source = createMockContextSource({
        name: longString,
        description: longString,
      })

      expect(source.name.length).toBe(10000)
      expect(source.description!.length).toBe(10000)
    })

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~🎉'
      const source = createMockContextSource({
        name: specialChars,
        uri: specialChars,
      })

      expect(source.name).toBe(specialChars)
      expect(source.uri).toBe(specialChars)
    })

    it('should handle unicode content', () => {
      const unicodeContent = '你好世界 🌍 مرحبا بالعالم'
      const result = truncateContent(unicodeContent, 100)

      expect(result).toBe(unicodeContent)
    })
  })

  describe('Date Handling', () => {
    it('should handle various date formats', () => {
      const now = new Date()
      const past = new Date('2020-01-01T00:00:00Z')
      const future = new Date('2030-12-31T23:59:59Z')

      const injection = createMockContextInjection({
        createdAt: past,
        updatedAt: now,
        executedAt: future,
      })

      expect(injection.createdAt).toEqual(past)
      expect(injection.updatedAt).toEqual(now)
      expect(injection.executedAt).toEqual(future)
    })

    it('should handle invalid date scenarios', () => {
      const invalidDate = new Date('invalid')
      const injection = createMockContextInjection({
        createdAt: invalidDate,
      })

      expect(isNaN(injection.createdAt.getTime())).toBe(true)
    })
  })

  describe('Metadata Handling', () => {
    it('should handle nested metadata objects', () => {
      const source = createMockContextSource({
        metadata: {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
          array: [1, 2, 3],
          mixed: { key: [{ nested: true }] },
        },
      })

      expect(source.metadata).toBeDefined()
      expect((source.metadata as Record<string, unknown>).level1).toBeDefined()
    })

    it('should handle null and undefined in metadata', () => {
      const source = createMockContextSource({
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
        },
      })

      expect((source.metadata as Record<string, unknown>).nullValue).toBeNull()
      expect((source.metadata as Record<string, unknown>).undefinedValue).toBeUndefined()
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle large injection collections efficiently', () => {
    const injections: ContextInjection[] = []
    for (let i = 0; i < 1000; i++) {
      injections.push(
        createMockContextInjection({
          id: `injection-${i}`,
          status: i % 5 === 0 ? 'completed' : i % 3 === 0 ? 'failed' : 'pending',
          durationMs: Math.floor(Math.random() * 1000),
        })
      )
    }

    const startTime = performance.now()
    const summary = calculateInjectionSummary(injections)
    const endTime = performance.now()

    expect(summary.total).toBe(1000)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('should validate sources efficiently', () => {
    const sources = Array.from({ length: 100 }, (_, i) =>
      createMockContextSource({ id: `source-${i}` })
    )

    const startTime = performance.now()
    sources.forEach((source) => validateContextSource(source))
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(50)
  })

  it('should truncate large content efficiently', () => {
    const largeContent = 'a'.repeat(100000)

    const startTime = performance.now()
    const result = truncateContent(largeContent, 1000)
    const endTime = performance.now()

    expect(result.length).toBeLessThanOrEqual(1000)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('should check content size efficiently', () => {
    const content = 'a'.repeat(50000)
    const config = createMockContextInjectionConfig()

    const startTime = performance.now()
    for (let i = 0; i < 1000; i++) {
      checkContentSize(content, config)
    }
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(500)
  })

  it('should maintain data consistency with many injections', () => {
    const statuses: ContextInjectionStatus[] = ['pending', 'active', 'completed', 'failed', 'skipped']
    const injections = Array.from({ length: 100 }, (_, i) =>
      createMockContextInjection({
        id: `injection-${i}`,
        status: statuses[i % statuses.length],
        durationMs: (i + 1) * 10,
      })
    )

    const summary = calculateInjectionSummary(injections)

    // Verify counts add up to total
    expect(
      summary.pending + summary.active + summary.completed + summary.failed + summary.skipped
    ).toBe(summary.total)

    // Verify average duration is correct
    const totalDuration = injections.reduce((sum, inj) => sum + (inj.durationMs ?? 0), 0)
    expect(summary.avgDurationMs).toBeCloseTo(totalDuration / injections.length)
  })
})

// ============================================================================
// Immutability Tests
// ============================================================================

describe('Immutability', () => {
  it('should not modify original objects when creating copies', () => {
    const originalInjection = createMockContextInjection()
    const clonedInjection = { ...originalInjection }
    const modifiedInjection = { ...originalInjection, status: 'completed' as const }

    expect(originalInjection.status).toBe('pending')
    expect(clonedInjection.status).toBe('pending')
    expect(modifiedInjection.status).toBe('completed')
  })

  it('should return new object from calculateInjectionSummary', () => {
    const injections = [createMockContextInjection()]
    const summary1 = calculateInjectionSummary(injections)
    const summary2 = calculateInjectionSummary(injections)

    expect(summary1).not.toBe(summary2)
    expect(summary1).toEqual(summary2)
  })

  it('should not modify config when checking content size', () => {
    const config = createMockContextInjectionConfig()
    const originalMaxSize = config.maxContentSize

    checkContentSize('test content', config)

    expect(config.maxContentSize).toBe(originalMaxSize)
  })
})
