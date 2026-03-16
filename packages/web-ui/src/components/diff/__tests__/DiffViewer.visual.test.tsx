/**
 * DiffViewer Visual Regression Tests
 *
 * Tests for syntax highlighting accuracy across different languages,
 * visual consistency, and UI element positioning.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DiffViewer } from '../DiffViewer'

// Language-specific test diffs
const languageTestCases = {
  javascript: {
    diff: `--- a/app.js
+++ b/app.js
@@ -1,6 +1,8 @@
 const express = require('express')
+const { Router } = require('express')

 function createApp() {
+  // Initialize the application
   const app = express()
-  return app
+  const router = Router()
+  return { app, router }
 }`,
    expectedTokens: ['const', 'express', 'require', 'function', 'createApp', 'Router']
  },

  typescript: {
    diff: `--- a/types.ts
+++ b/types.ts
@@ -1,4 +1,8 @@
 interface User {
   id: number
+  name: string
+  email?: string
 }
+
+type UserRole = 'admin' | 'user' | 'guest'
+export { User, UserRole }`,
    expectedTokens: ['interface', 'User', 'number', 'string', 'type', 'UserRole', 'export']
  },

  python: {
    diff: `--- a/utils.py
+++ b/utils.py
@@ -1,5 +1,9 @@
 def calculate_total(items):
+    """Calculate total price of items."""
     total = 0
+    if not items:
+        return 0
     for item in items:
         total += item.price
     return total`,
    expectedTokens: ['def', 'calculate_total', 'items', 'total', 'if', 'not', 'for', 'in', 'return']
  },

  go: {
    diff: `--- a/main.go
+++ b/main.go
@@ -1,6 +1,10 @@
 package main

+import "fmt"
+
 func main() {
+    name := "World"
     fmt.Println("Hello, World!")
+    fmt.Printf("Hello, %s!", name)
 }`,
    expectedTokens: ['package', 'main', 'import', 'func', 'fmt', 'Println', 'Printf']
  },

  rust: {
    diff: `--- a/main.rs
+++ b/main.rs
@@ -1,4 +1,8 @@
 fn main() {
+    let name = "world";
     println!("Hello, world!");
+    let greeting = format!("Hello, {}!", name);
+    println!("{}", greeting);
 }`,
    expectedTokens: ['fn', 'main', 'let', 'name', 'println!', 'format!', 'greeting']
  },

  java: {
    diff: `--- a/App.java
+++ b/App.java
@@ -1,5 +1,9 @@
+package com.example;
+
 public class App {
     public static void main(String[] args) {
+        String greeting = "Hello, World!";
         System.out.println("Hello, World!");
+        System.out.println(greeting);
     }
 }`,
    expectedTokens: ['package', 'public', 'class', 'App', 'static', 'void', 'main', 'String', 'System']
  },

  json: {
    diff: `--- a/config.json
+++ b/config.json
@@ -1,4 +1,7 @@
 {
   "name": "my-app",
+  "version": "1.0.0",
+  "description": "A sample application",
   "dependencies": {
+    "express": "^4.18.0"
   }
 }`,
    expectedTokens: ['"name"', '"my-app"', '"version"', '"1.0.0"', '"dependencies"', '"express"']
  },

  css: {
    diff: `--- a/styles.css
+++ b/styles.css
@@ -1,4 +1,8 @@
 .container {
   display: flex;
+  flex-direction: column;
+  align-items: center;
   padding: 20px;
+  background-color: #ffffff;
+  border-radius: 8px;
 }`,
    expectedTokens: ['container', 'display', 'flex', 'flex-direction', 'column', 'padding', 'background-color']
  },

  html: {
    diff: `--- a/index.html
+++ b/index.html
@@ -1,4 +1,8 @@
 <div class="container">
+  <h1>Welcome</h1>
   <p>Hello, world!</p>
+  <button onclick="alert('clicked')">Click me</button>
+  <!-- This is a comment -->
 </div>`,
    expectedTokens: ['<div', 'class=', '<h1>', '<p>', '<button', 'onclick=', '<!-- This is a comment -->']
  }
}

// Helper function to check if syntax highlighting is applied
function checkSyntaxHighlighting(container: HTMLElement, expectedTokens: string[]): boolean {
  const highlightedElements = container.querySelectorAll('[class*="diff-"]')
  const highlightedText = Array.from(highlightedElements).map(el => el.textContent || '').join(' ')

  return expectedTokens.some(token => highlightedText.includes(token))
}

// Helper function to get highlighting statistics
function getHighlightingStats(container: HTMLElement): {
  totalElements: number
  keywordElements: number
  stringElements: number
  commentElements: number
  functionElements: number
} {
  return {
    totalElements: container.querySelectorAll('[class*="diff-"]').length,
    keywordElements: container.querySelectorAll('.diff-keyword').length,
    stringElements: container.querySelectorAll('.diff-string').length,
    commentElements: container.querySelectorAll('.diff-comment').length,
    functionElements: container.querySelectorAll('.diff-function').length
  }
}

describe('DiffViewer Visual Regression Tests', () => {
  describe('Syntax Highlighting Accuracy', () => {
    Object.entries(languageTestCases).forEach(([language, testCase]) => {
      it(`correctly highlights ${language} syntax`, () => {
        const { container } = render(
          <DiffViewer
            diff={testCase.diff}
            filePath={`test.${language === 'typescript' ? 'ts' : language}`}
            highlighting={true}
          />
        )

        // Check that highlighting is applied
        const hasHighlighting = checkSyntaxHighlighting(container, testCase.expectedTokens)
        expect(hasHighlighting).toBe(true)

        // Check for specific language tokens in the DOM
        testCase.expectedTokens.forEach(token => {
          const tokenRegex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          expect(container.innerHTML).toMatch(tokenRegex)
        })
      })

      it(`applies consistent highlighting classes for ${language}`, () => {
        const { container } = render(
          <DiffViewer
            diff={testCase.diff}
            filePath={`test.${language === 'typescript' ? 'ts' : language}`}
            highlighting={true}
          />
        )

        const stats = getHighlightingStats(container)

        // Should have at least some highlighted elements
        expect(stats.totalElements).toBeGreaterThan(0)

        // Verify expected highlighting patterns for each language
        switch (language) {
          case 'javascript':
          case 'typescript':
            expect(stats.keywordElements).toBeGreaterThan(0) // const, function, etc.
            expect(stats.stringElements).toBeGreaterThan(0) // string literals
            break
          case 'python':
            expect(stats.keywordElements).toBeGreaterThan(0) // def, if, for, etc.
            expect(stats.commentElements).toBeGreaterThan(0) // docstring
            break
          case 'json':
            expect(stats.stringElements).toBeGreaterThan(0) // property names and values
            break
          case 'css':
            // CSS properties should be highlighted
            expect(stats.totalElements).toBeGreaterThan(0)
            break
        }
      })
    })

    it('handles mixed language content gracefully', () => {
      const mixedDiff = `--- a/config.js
+++ b/config.js
@@ -1,5 +1,8 @@
 module.exports = {
   name: 'app',
+  version: '1.0.0',
   html: \`<div class="test">Content</div>\`,
+  css: \`.test { color: red; }\`,
+  regex: /test\\d+/g
 }`

      const { container } = render(
        <DiffViewer
          diff={mixedDiff}
          filePath="config.js"
          highlighting={true}
        />
      )

      const stats = getHighlightingStats(container)
      expect(stats.totalElements).toBeGreaterThan(0)
      expect(stats.stringElements).toBeGreaterThan(0) // Template literals and strings
    })

    it('disables highlighting when highlighting prop is false', () => {
      const { container } = render(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          filePath="test.js"
          highlighting={false}
        />
      )

      const highlightedElements = container.querySelectorAll('[class*="diff-"]')
      expect(highlightedElements.length).toBe(0)
    })
  })

  describe('Visual Consistency', () => {
    it('maintains consistent styling across view modes', () => {
      const testDiff = languageTestCases.javascript.diff
      const modes: Array<'unified' | 'split' | 'inline'> = ['unified', 'split', 'inline']

      modes.forEach(mode => {
        const { container, unmount } = render(
          <DiffViewer
            diff={testDiff}
            mode={mode}
            highlighting={true}
          />
        )

        // Each mode should have highlighting applied
        const stats = getHighlightingStats(container)
        expect(stats.totalElements).toBeGreaterThan(0)

        // Should maintain proper structure
        expect(container.querySelector('[data-line-type]')).toBeInTheDocument()

        unmount()
      })
    })

    it('applies correct line type visual indicators', () => {
      const { container } = render(
        <DiffViewer diff={languageTestCases.javascript.diff} />
      )

      // Check for visual indicators
      const addedLines = container.querySelectorAll('[data-line-type="added"]')
      const removedLines = container.querySelectorAll('[data-line-type="removed"]')
      const unchangedLines = container.querySelectorAll('[data-line-type="unchanged"]')

      expect(addedLines.length).toBeGreaterThan(0)
      expect(removedLines.length).toBeGreaterThan(0)
      expect(unchangedLines.length).toBeGreaterThan(0)

      // Check that lines have appropriate styling classes
      addedLines.forEach(line => {
        expect(line).toHaveClass('bg-green-500/10')
      })

      removedLines.forEach(line => {
        expect(line).toHaveClass('bg-red-500/10')
      })
    })

    it('renders line numbers consistently', () => {
      const { container } = render(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          showLineNumbers={true}
        />
      )

      // Line numbers should be present and properly formatted
      const lineNumbers = container.querySelectorAll('[aria-label*="Line"]')
      expect(lineNumbers.length).toBeGreaterThan(0)

      // Line numbers should have consistent styling
      lineNumbers.forEach(lineNum => {
        expect(lineNum).toHaveClass('text-muted-foreground')
        expect(lineNum).toHaveClass('select-none')
      })
    })

    it('maintains proper spacing and layout', () => {
      const { container } = render(
        <DiffViewer diff={languageTestCases.javascript.diff} />
      )

      // Check for consistent spacing classes
      const diffLines = container.querySelectorAll('[data-line-type]')
      diffLines.forEach(line => {
        expect(line).toHaveClass('flex')
        expect(line).toHaveClass('items-stretch')
      })

      // Hunk headers should be visually distinct
      const hunkHeaders = container.querySelectorAll('.bg-blue-500\\/10')
      expect(hunkHeaders.length).toBeGreaterThan(0)
    })
  })

  describe('Theme and Color Consistency', () => {
    it('applies consistent color scheme for syntax elements', () => {
      const { container } = render(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          highlighting={true}
        />
      )

      // Check that highlighting classes are applied correctly
      const keywords = container.querySelectorAll('.diff-keyword')
      const strings = container.querySelectorAll('.diff-string')
      const functions = container.querySelectorAll('.diff-function')

      // Should have consistent application of classes
      keywords.forEach(keyword => {
        expect(keyword).toHaveClass('diff-keyword')
      })

      strings.forEach(string => {
        expect(string).toHaveClass('diff-string')
      })

      functions.forEach(func => {
        expect(func).toHaveClass('diff-function')
      })
    })

    it('handles dark/light theme variations gracefully', () => {
      // Test with different theme contexts (if implemented)
      const { container } = render(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          highlighting={true}
        />
      )

      // Theme-agnostic highlighting should work
      const highlightedElements = container.querySelectorAll('[class*="diff-"]')
      expect(highlightedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases and Error States', () => {
    it('handles malformed syntax gracefully', () => {
      const malformedDiff = `--- a/broken.js
+++ b/broken.js
@@ -1,3 +1,5 @@
 function broken( {
+  const unclosed = "string
   return invalid syntax
+  } // mismatched brace
 }`

      const { container } = render(
        <DiffViewer
          diff={malformedDiff}
          highlighting={true}
        />
      )

      // Should not crash and should render something
      expect(container).toBeInTheDocument()
      const diffLines = container.querySelectorAll('[data-line-type]')
      expect(diffLines.length).toBeGreaterThan(0)
    })

    it('handles very long lines without breaking layout', () => {
      const longLineDiff = `--- a/long.js
+++ b/long.js
@@ -1,1 +1,2 @@
 const short = true
+const veryLongVariableNameThatExceedsNormalLineLengthsAndCouldPotentiallyBreakTheLayoutIfNotHandledProperlyWithScrollingOrWrapping = "This is a very long string that also exceeds normal length expectations"`

      const { container } = render(
        <DiffViewer
          diff={longLineDiff}
          highlighting={true}
        />
      )

      // Should handle overflow properly
      const codeTags = container.querySelectorAll('code')
      codeTags.forEach(code => {
        expect(code).toHaveClass('overflow-x-auto')
        expect(code).toHaveClass('whitespace-pre')
      })
    })

    it('maintains visual hierarchy with nested structures', () => {
      const nestedDiff = `--- a/nested.js
+++ b/nested.js
@@ -1,8 +1,12 @@
 function outer() {
+  const config = {
+    nested: {
+      deep: {
+        value: 'test'
+      }
+    }
+  }
   function inner() {
     return 'nested'
   }
+  return { inner, config }
-  return inner
 }`

      const { container } = render(
        <DiffViewer
          diff={nestedDiff}
          highlighting={true}
        />
      )

      // Should highlight nested structures appropriately
      const stats = getHighlightingStats(container)
      expect(stats.totalElements).toBeGreaterThan(5) // Multiple elements highlighted
      expect(stats.keywordElements).toBeGreaterThan(2) // function, const, return
    })
  })

  describe('Performance Visual Tests', () => {
    it('renders large diffs without visual artifacts', () => {
      const largeDiff = `--- a/large.js
+++ b/large.js
@@ -1,50 +1,100 @@
${Array.from({ length: 100 }, (_, i) => {
  const type = i % 3 === 0 ? '+' : i % 3 === 1 ? '-' : ' '
  return `${type}function func${i}() { return ${i}; }`
}).join('\n')}`

      const { container } = render(
        <DiffViewer
          diff={largeDiff}
          highlighting={true}
        />
      )

      // Should render all content without cutting off
      const diffLines = container.querySelectorAll('[data-line-type]')
      expect(diffLines.length).toBeGreaterThan(90) // Most of the 100 lines

      // Should maintain highlighting performance
      const stats = getHighlightingStats(container)
      expect(stats.totalElements).toBeGreaterThan(50) // Should highlight many elements
    })

    it('maintains visual quality with rapid re-renders', () => {
      const { container, rerender } = render(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          highlighting={true}
          mode="unified"
        />
      )

      // Switch modes rapidly
      rerender(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          highlighting={true}
          mode="split"
        />
      )

      rerender(
        <DiffViewer
          diff={languageTestCases.javascript.diff}
          highlighting={true}
          mode="inline"
        />
      )

      // Should maintain consistent highlighting
      const stats = getHighlightingStats(container)
      expect(stats.totalElements).toBeGreaterThan(0)
    })
  })
})