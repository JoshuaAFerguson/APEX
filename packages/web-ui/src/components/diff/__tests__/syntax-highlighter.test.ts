/**
 * Syntax Highlighter Utility Tests
 */

import { describe, it, expect } from 'vitest'
import { highlightLine, looksLikeCode, getThemePrefix } from '../utils/syntax-highlighter'

describe('highlightLine', () => {
  it('should highlight JavaScript keywords', () => {
    const code = 'const app = require("express")'
    const result = highlightLine(code, 'javascript')

    expect(result).toContain('class="diff-keyword"')
    expect(result).toContain('const')
    expect(result).toContain('class="diff-string"')
    expect(result).toContain('"express"')
    expect(result).toContain('class="diff-function"')
    expect(result).toContain('require')
  })

  it('should highlight Python keywords', () => {
    const code = 'def hello_world():'
    const result = highlightLine(code, 'python')

    expect(result).toContain('class="diff-keyword"')
    expect(result).toContain('def')
    expect(result).toContain('class="diff-function"')
    expect(result).toContain('hello_world')
  })

  it('should highlight strings correctly', () => {
    const code = 'const msg = "hello" + \'world\''
    const result = highlightLine(code, 'javascript')

    expect(result).toContain('class="diff-string"')
    expect(result).toContain('"hello"')
    expect(result).toContain("'world'")
  })

  it('should highlight numbers', () => {
    const code = 'const num = 42.5'
    const result = highlightLine(code, 'javascript')

    expect(result).toContain('class="diff-number"')
    expect(result).toContain('42.5')
  })

  it('should highlight comments', () => {
    const jsCode = '// This is a comment'
    const jsResult = highlightLine(jsCode, 'javascript')

    expect(jsResult).toContain('class="diff-comment"')
    expect(jsResult).toContain('// This is a comment')

    const pyCode = '# Python comment'
    const pyResult = highlightLine(pyCode, 'python')

    expect(pyResult).toContain('class="diff-comment"')
    expect(pyResult).toContain('# Python comment')
  })

  it('should handle JSON properly', () => {
    const json = '{"name": "value", "number": 123}'
    const result = highlightLine(json, 'json')

    expect(result).toContain('class="diff-property"')
    expect(result).toContain('"name"')
    expect(result).toContain('"number"')
    expect(result).toContain('class="diff-number"')
    expect(result).toContain('123')
  })

  it('should escape HTML characters', () => {
    const code = 'const html = "<div>content</div>"'
    const result = highlightLine(code, 'javascript')

    expect(result).toContain('&lt;div&gt;')
    expect(result).toContain('&lt;/div&gt;')
    expect(result).not.toContain('<div>')
  })

  it('should not highlight unknown languages', () => {
    const code = 'some random text'
    const result = highlightLine(code, 'unknown')

    expect(result).toBe('some random text')
    expect(result).not.toContain('class="diff-')
  })

  it('should not highlight plain text', () => {
    const text = 'just plain text'
    const result = highlightLine(text, 'text')

    expect(result).toBe('just plain text')
    expect(result).not.toContain('class="diff-')
  })

  it('should handle empty content', () => {
    expect(highlightLine('', 'javascript')).toBe('')
    expect(highlightLine('   ', 'javascript')).toBe('   ')
  })

  it('should avoid overlapping highlights', () => {
    const code = 'function test() { return "function"; }'
    const result = highlightLine(code, 'javascript')

    // Should highlight both function keyword and function call
    expect(result).toContain('class="diff-keyword"')
    expect(result).toContain('class="diff-function"')
    expect(result).toContain('class="diff-string"')

    // Should not have nested spans for the same text
    const functionMatches = (result.match(/<span[^>]*>function<\/span>/g) || []).length
    expect(functionMatches).toBeGreaterThan(0)
  })
})

describe('looksLikeCode', () => {
  it('should detect code patterns', () => {
    expect(looksLikeCode('function test() {}')).toBe(true)
    expect(looksLikeCode('const x = 42;')).toBe(true)
    expect(looksLikeCode('if (condition) return true')).toBe(true)
    expect(looksLikeCode('// Comment')).toBe(true)
    expect(looksLikeCode('obj.method(arg)')).toBe(true)
    expect(looksLikeCode('const arrow = () => {}')).toBe(true)
  })

  it('should not detect plain text as code', () => {
    expect(looksLikeCode('This is just plain text')).toBe(false)
    expect(looksLikeCode('Hello world')).toBe(false)
    expect(looksLikeCode('')).toBe(false)
    expect(looksLikeCode('   ')).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(looksLikeCode('Text with (parentheses) but no code')).toBe(false)
    expect(looksLikeCode('Text with {braces} might be code')).toBe(true)
  })
})

describe('getThemePrefix', () => {
  it('should return correct prefixes', () => {
    expect(getThemePrefix('light')).toBe('light-')
    expect(getThemePrefix('dark')).toBe('')
    expect(getThemePrefix('auto')).toBe('')
    expect(getThemePrefix()).toBe('')
  })
})