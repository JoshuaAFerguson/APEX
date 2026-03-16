/**
 * Language Detector Utility Tests
 */

import { describe, it, expect } from 'vitest'
import { detectLanguage, isHighlightingSupported, getLanguageDisplayName } from '../utils/language-detector'

describe('detectLanguage', () => {
  it('should detect JavaScript files', () => {
    expect(detectLanguage('app.js')).toBe('javascript')
    expect(detectLanguage('index.mjs')).toBe('javascript')
    expect(detectLanguage('config.cjs')).toBe('javascript')
  })

  it('should detect TypeScript files', () => {
    expect(detectLanguage('app.ts')).toBe('typescript')
    expect(detectLanguage('types.d.ts')).toBe('typescript')
    expect(detectLanguage('module.mts')).toBe('typescript')
  })

  it('should detect React files', () => {
    expect(detectLanguage('Component.jsx')).toBe('jsx')
    expect(detectLanguage('Component.tsx')).toBe('tsx')
  })

  it('should detect Python files', () => {
    expect(detectLanguage('script.py')).toBe('python')
    expect(detectLanguage('app.pyw')).toBe('python')
    expect(detectLanguage('types.pyi')).toBe('python')
  })

  it('should detect other languages', () => {
    expect(detectLanguage('main.go')).toBe('go')
    expect(detectLanguage('lib.rs')).toBe('rust')
    expect(detectLanguage('App.java')).toBe('java')
    expect(detectLanguage('data.json')).toBe('json')
    expect(detectLanguage('config.yaml')).toBe('yaml')
    expect(detectLanguage('README.md')).toBe('markdown')
    expect(detectLanguage('script.sh')).toBe('shell')
    expect(detectLanguage('styles.css')).toBe('css')
    expect(detectLanguage('index.html')).toBe('html')
    expect(detectLanguage('queries.sql')).toBe('sql')
    expect(detectLanguage('data.txt')).toBe('text')
  })

  it('should return unknown for files without extensions', () => {
    expect(detectLanguage('Makefile')).toBe('unknown')
    expect(detectLanguage('LICENSE')).toBe('unknown')
    expect(detectLanguage('')).toBe('unknown')
  })

  it('should return unknown for undefined input', () => {
    expect(detectLanguage(undefined)).toBe('unknown')
  })

  it('should handle file paths', () => {
    expect(detectLanguage('/path/to/file.js')).toBe('javascript')
    expect(detectLanguage('./src/components/App.tsx')).toBe('tsx')
    expect(detectLanguage('../utils/helper.py')).toBe('python')
  })

  it('should be case insensitive', () => {
    expect(detectLanguage('FILE.JS')).toBe('javascript')
    expect(detectLanguage('Script.PY')).toBe('python')
  })
})

describe('isHighlightingSupported', () => {
  it('should return true for supported languages', () => {
    expect(isHighlightingSupported('javascript')).toBe(true)
    expect(isHighlightingSupported('typescript')).toBe(true)
    expect(isHighlightingSupported('python')).toBe(true)
    expect(isHighlightingSupported('go')).toBe(true)
  })

  it('should return false for unsupported languages', () => {
    expect(isHighlightingSupported('text')).toBe(false)
    expect(isHighlightingSupported('unknown')).toBe(false)
  })
})

describe('getLanguageDisplayName', () => {
  it('should return proper display names', () => {
    expect(getLanguageDisplayName('javascript')).toBe('JavaScript')
    expect(getLanguageDisplayName('typescript')).toBe('TypeScript')
    expect(getLanguageDisplayName('jsx')).toBe('React JSX')
    expect(getLanguageDisplayName('tsx')).toBe('React TSX')
    expect(getLanguageDisplayName('python')).toBe('Python')
    expect(getLanguageDisplayName('go')).toBe('Go')
    expect(getLanguageDisplayName('rust')).toBe('Rust')
    expect(getLanguageDisplayName('unknown')).toBe('Unknown')
  })
})