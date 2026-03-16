/**
 * Diff Copy Button Component
 *
 * Provides copy functionality for diff content with visual feedback.
 */

'use client'

import React, { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COPY_FEEDBACK_DURATION } from './constants'
import type { DiffCopyButtonProps } from './types'

export function DiffCopyButton({
  content,
  onCopy,
  className,
  variant = 'icon',
}: DiffCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      onCopy?.(content)

      // Reset feedback after duration
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Fallback for older browsers or when clipboard API is not available
      try {
        const textArea = document.createElement('textarea')
        textArea.value = content
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
        setCopied(true)
        onCopy?.(content)
        setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION)
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr)
      }
    }
  }, [content, onCopy])

  const isDisabled = !content || content.trim().length === 0

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm',
        'text-muted-foreground hover:text-foreground',
        'hover:bg-muted transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        copied && 'text-green-600',
        className
      )}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      title={copied ? 'Copied to clipboard!' : 'Copy to clipboard'}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          {(variant === 'text' || variant === 'icon-text') && (
            <span className="text-sm">Copied!</span>
          )}
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          {(variant === 'text' || variant === 'icon-text') && (
            <span className="text-sm">Copy</span>
          )}
        </>
      )}
    </button>
  )
}