/**
 * Changelog Types Tests
 *
 * Unit tests for changelog type definitions and utility functions,
 * including transformations and data validation.
 */

import {
  taskToChangelogEntry,
  determineChangeType,
  countAdditions,
  countDeletions,
  truncateText,
} from '../changelog'
import type { ChangelogEntry, ChangelogFileChange } from '../changelog'

// Mock Task type - simplified for testing
interface MockTask {
  id: string
  description: string
  workflow: string
  status: 'completed' | 'failed' | 'cancelled'
  completedAt?: Date
  updatedAt: Date
  branchName?: string
  prUrl?: string
  artifacts: Array<{
    type: string
    name: string
    path?: string
    content?: string
  }>
}

describe('Changelog Types and Utilities', () => {
  describe('taskToChangelogEntry', () => {
    const mockTask: MockTask = {
      id: 'task-123',
      description: 'Add user authentication system with JWT tokens',
      workflow: 'feature-development',
      status: 'completed',
      completedAt: new Date('2024-03-20T10:00:00Z'),
      updatedAt: new Date('2024-03-20T10:00:00Z'),
      branchName: 'feature/auth-system',
      prUrl: 'https://github.com/example/repo/pull/123',
      artifacts: [
        {
          type: 'file',
          name: 'AuthProvider.tsx',
          path: 'src/auth/AuthProvider.tsx',
          content: `@@ -0,0 +1,50 @@
+import React from 'react'
+
+export const AuthProvider = () => {
+  return <div>Auth</div>
+}`
        },
        {
          type: 'diff',
          name: 'api-client.ts',
          path: 'src/api/client.ts',
          content: `@@ -10,5 +10,15 @@ class ApiClient {

   async login(credentials) {
+    if (!credentials) {
+      throw new Error('Credentials required')
+    }
+
     return this.post('/auth/login', credentials)
   }`
        }
      ]
    }

    it('converts task to changelog entry with all properties', () => {
      const entry = taskToChangelogEntry(mockTask as any)

      expect(entry).toMatchObject({
        id: 'task-123',
        title: expect.stringContaining('Add user authentication'),
        description: mockTask.description,
        timestamp: mockTask.completedAt,
        workflow: 'feature-development',
        status: 'completed',
        taskId: 'task-123',
      })

      expect(entry.git).toEqual({
        branchName: 'feature/auth-system',
        prUrl: 'https://github.com/example/repo/pull/123',
      })
    })

    it('generates file changes from task artifacts', () => {
      const entry = taskToChangelogEntry(mockTask as any)

      expect(entry.changes).toHaveLength(2)
      expect(entry.changes[0]).toMatchObject({
        path: 'src/auth/AuthProvider.tsx',
        type: expect.any(String),
        diff: expect.stringContaining('@@ -0,0 +1,50 @@'),
      })
    })

    it('calculates correct statistics', () => {
      const entry = taskToChangelogEntry(mockTask as any)

      expect(entry.stats).toMatchObject({
        filesModified: 2,
        linesAdded: expect.any(Number),
        linesRemoved: expect.any(Number),
      })

      expect(entry.stats.linesAdded).toBeGreaterThan(0)
      expect(entry.stats.filesModified).toBe(2)
    })

    it('truncates long titles correctly', () => {
      const longTask = {
        ...mockTask,
        description: 'This is a very long task description that should be truncated because it exceeds the maximum length limit for changelog entry titles and we want to keep them concise'
      }

      const entry = taskToChangelogEntry(longTask as any)

      expect(entry.title).toMatch(/\.\.\.$/) // Should end with ellipsis
      expect(entry.title.length).toBeLessThanOrEqual(80)
      expect(entry.description).toBe(longTask.description) // Full description preserved
    })

    it('handles task without git information', () => {
      const taskWithoutGit = {
        ...mockTask,
        branchName: undefined,
        prUrl: undefined,
      }

      const entry = taskToChangelogEntry(taskWithoutGit as any)

      expect(entry.git).toEqual({
        branchName: undefined,
        prUrl: undefined,
      })
    })

    it('uses updatedAt when completedAt is not available', () => {
      const taskWithoutCompletedAt = {
        ...mockTask,
        completedAt: undefined,
      }

      const entry = taskToChangelogEntry(taskWithoutCompletedAt as any)

      expect(entry.timestamp).toEqual(mockTask.updatedAt)
    })

    it('handles empty artifacts array', () => {
      const taskWithoutArtifacts = {
        ...mockTask,
        artifacts: [],
      }

      const entry = taskToChangelogEntry(taskWithoutArtifacts as any)

      expect(entry.changes).toEqual([])
      expect(entry.stats).toEqual({
        filesModified: 0,
        linesAdded: 0,
        linesRemoved: 0,
      })
    })

    it('filters non-file artifacts', () => {
      const taskWithMixedArtifacts = {
        ...mockTask,
        artifacts: [
          { type: 'file', name: 'test.ts', path: 'test.ts', content: '+content' },
          { type: 'log', name: 'build.log', content: 'build output' },
          { type: 'diff', name: 'change.diff', path: 'src/file.ts', content: '+change' },
          { type: 'config', name: 'settings', content: '{}' },
        ],
      }

      const entry = taskToChangelogEntry(taskWithMixedArtifacts as any)

      expect(entry.changes).toHaveLength(2) // Only file and diff artifacts
    })
  })

  describe('determineChangeType', () => {
    it('detects added files', () => {
      const artifact = {
        type: 'file',
        name: 'new.ts',
        content: 'new file mode 100644\n+content',
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('added')
    })

    it('detects deleted files', () => {
      const artifact = {
        type: 'file',
        name: 'old.ts',
        content: 'deleted file mode 100644\n-content',
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('deleted')
    })

    it('detects renamed files', () => {
      const artifact = {
        type: 'file',
        name: 'renamed.ts',
        content: 'rename from old.ts\nrename to new.ts\n+content',
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('renamed')
    })

    it('defaults to modified for other changes', () => {
      const artifact = {
        type: 'file',
        name: 'existing.ts',
        content: '@@-1,5 +1,8@@\n modified content',
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('modified')
    })

    it('handles artifacts without content', () => {
      const artifact = {
        type: 'file',
        name: 'file.ts',
        content: undefined,
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('modified')
    })

    it('is case insensitive', () => {
      const artifact = {
        type: 'file',
        name: 'file.ts',
        content: 'NEW FILE MODE 100644\n+content',
      }

      const changeType = determineChangeType(artifact)
      expect(changeType).toBe('added')
    })
  })

  describe('countAdditions', () => {
    it('counts addition lines correctly', () => {
      const diff = `@@ -0,0 +1,5 @@
+line 1
+line 2
+line 3
 unchanged line
+line 4`

      const additions = countAdditions(diff)
      expect(additions).toBe(4)
    })

    it('ignores diff headers', () => {
      const diff = `@@ -1,3 +1,5 @@
+++ file.ts
+line 1
+line 2`

      const additions = countAdditions(diff)
      expect(additions).toBe(2) // Should not count +++ header
    })

    it('handles empty diff', () => {
      const additions = (countAdditions as any)('')
      expect(additions).toBe(0)
    })

    it('handles null/undefined diff', () => {
      expect(countAdditions(null)).toBe(0)
      expect(countAdditions(undefined)).toBe(0)
    })

    it('handles diff with no additions', () => {
      const diff = `@@ -1,3 +1,1 @@
-removed line 1
-removed line 2
 unchanged line`

      const additions = countAdditions(diff)
      expect(additions).toBe(0)
    })
  })

  describe('countDeletions', () => {
    it('counts deletion lines correctly', () => {
      const diff = `@@ -1,5 +1,2 @@
-deleted line 1
-deleted line 2
 unchanged line
-deleted line 3
 another unchanged line`

      const deletions = countDeletions(diff)
      expect(deletions).toBe(3)
    })

    it('ignores diff headers', () => {
      const diff = `@@ -1,3 +1,1 @@
--- file.ts
-deleted line 1
-deleted line 2`

      const deletions = countDeletions(diff)
      expect(deletions).toBe(2) // Should not count --- header
    })

    it('handles empty diff', () => {
      const deletions = (countDeletions as any)('')
      expect(deletions).toBe(0)
    })

    it('handles null/undefined diff', () => {
      expect(countDeletions(null)).toBe(0)
      expect(countDeletions(undefined)).toBe(0)
    })

    it('handles diff with no deletions', () => {
      const diff = `@@ -0,0 +1,3 @@
+added line 1
+added line 2
+added line 3`

      const deletions = countDeletions(diff)
      expect(deletions).toBe(0)
    })
  })

  describe('truncateText', () => {
    it('returns original text when under limit', () => {
      const text = 'Short text'
      const result = truncateText(text, 20)

      expect(result).toBe(text)
    })

    it('truncates text when over limit', () => {
      const text = 'This is a very long text that exceeds the limit'
      const result = truncateText(text, 20)

      expect(result).toHaveLength(20)
      expect(result).toMatch(/\.\.\.$/)
      expect(result).toBe('This is a very lo...')
    })

    it('handles text exactly at limit', () => {
      const text = '12345678901234567890' // exactly 20 characters
      const result = truncateText(text, 20)

      expect(result).toBe(text)
      expect(result).not.toMatch(/\.\.\.$/)
    })

    it('handles empty text', () => {
      const result = truncateText('', 10)
      expect(result).toBe('')
    })

    it('handles very short limits', () => {
      const text = 'Hello'
      const result = truncateText(text, 3)

      expect(result).toBe('')  // 3 chars - 3 for ellipsis = 0
    })

    it('handles limit of 3 (minimum for ellipsis)', () => {
      const text = 'Hello'
      const result = truncateText(text, 4)

      expect(result).toBe('H...')
    })
  })

  describe('Type Validation', () => {
    it('validates ChangelogEntry interface', () => {
      const validEntry: ChangelogEntry = {
        id: 'test-1',
        title: 'Test entry',
        description: 'Test description',
        timestamp: new Date(),
        workflow: 'test',
        status: 'completed',
        changes: [],
        stats: {
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
        },
        taskId: 'test-1',
      }

      // Should compile without errors
      expect(validEntry.id).toBe('test-1')
      expect(validEntry.status).toBe('completed')
    })

    it('validates ChangelogFileChange interface', () => {
      const validChange: ChangelogFileChange = {
        path: 'src/test.ts',
        type: 'modified',
        diff: '+content',
        stats: {
          additions: 1,
          deletions: 0,
        },
      }

      // Should compile without errors
      expect(validChange.type).toBe('modified')
      expect(validChange.stats.additions).toBe(1)
    })

    it('handles optional properties correctly', () => {
      const minimalEntry: ChangelogEntry = {
        id: 'minimal',
        title: 'Minimal entry',
        timestamp: new Date(),
        workflow: 'test',
        status: 'completed',
        changes: [],
        stats: {
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
        },
        taskId: 'minimal',
      }

      // Optional properties should be undefined
      expect(minimalEntry.description).toBeUndefined()
      expect(minimalEntry.git).toBeUndefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles malformed diff content', () => {
      const malformedDiff = 'not a valid diff format'

      expect((countAdditions as any)(malformedDiff)).toBe(0)
      expect((countDeletions as any)(malformedDiff)).toBe(0)
    })

    it('handles diff with mixed line endings', () => {
      const mixedDiff = '+line1\r\n+line2\n+line3\r+line4'

      const additions = (countAdditions as any)(mixedDiff)
      expect(additions).toBe(4)
    })

    it('handles very large diff files', () => {
      const largeDiff = Array(10000).fill('+large line').join('\n')

      const additions = (countAdditions as any)(largeDiff)
      expect(additions).toBe(10000)
    })

    it('handles unicode characters in diffs', () => {
      const unicodeDiff = '+line with émojis 🚀 and ñon-ASCII chars'

      const additions = (countAdditions as any)(unicodeDiff)
      expect(additions).toBe(1)
    })

    it('handles artifacts with invalid types', () => {
      const invalidTask = {
        id: 'test',
        description: 'Test',
        workflow: 'test',
        status: 'completed',
        updatedAt: new Date(),
        artifacts: [
          { type: null, name: 'invalid' },
          { type: '', name: 'empty' },
          { type: 'unknown', name: 'unknown' },
        ],
      }

      const entry = taskToChangelogEntry(invalidTask as any)

      // Should handle gracefully
      expect(entry.changes).toEqual([])
    })
  })
})