'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, Filter } from 'lucide-react'

export interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  agent?: string
  stage?: string
}

interface LogViewerProps {
  logs: LogEntry[]
  maxHeight?: number
  className?: string
}

const levelColors: Record<LogEntry['level'], string> = {
  debug: 'text-foreground-tertiary',
  info: 'text-foreground',
  warn: 'text-yellow-500',
  error: 'text-red-500',
}

const levelBgColors: Record<LogEntry['level'], string> = {
  debug: 'bg-foreground-tertiary/10',
  info: 'bg-apex-500/10',
  warn: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
}

export function LogViewer({ logs, maxHeight = 400, className }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogEntry['level'] | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Filter logs based on search and level
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = searchQuery === '' ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.agent?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter
      return matchesSearch && matchesLevel
    })
  }, [logs, searchQuery, levelFilter])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  if (logs.length === 0) {
    return (
      <div className={cn('text-center py-8 text-foreground-secondary', className)}>
        <p>No logs yet...</p>
        <p className="text-sm mt-1">Logs will appear here as the task runs.</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background-tertiary rounded-md border border-border focus:border-apex-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-md border border-border hover:bg-background-tertiary transition-colors',
            showFilters && 'bg-background-tertiary'
          )}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-foreground-secondary">Level:</span>
          {(['all', 'debug', 'info', 'warn', 'error'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={cn(
                'px-2 py-1 text-xs rounded-md transition-colors',
                levelFilter === level
                  ? 'bg-apex-600 text-white'
                  : 'bg-background-tertiary hover:bg-background-tertiary/80'
              )}
            >
              {level === 'all' ? 'All' : level.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Log Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ maxHeight }}
        className="overflow-y-auto font-mono text-sm bg-background rounded-md border border-border"
      >
        {filteredLogs.map((log, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-3 px-3 py-1.5 hover:bg-background-tertiary/50 border-b border-border/50 last:border-b-0',
              levelBgColors[log.level]
            )}
          >
            <span className="text-foreground-tertiary shrink-0">
              {formatTime(log.timestamp)}
            </span>
            <span
              className={cn(
                'w-12 shrink-0 uppercase text-xs font-semibold',
                levelColors[log.level]
              )}
            >
              {log.level}
            </span>
            {log.agent && (
              <span className="text-apex-400 shrink-0">
                [{log.agent}]
              </span>
            )}
            <span className={cn('flex-1 break-all', levelColors[log.level])}>
              {log.message}
            </span>
          </div>
        ))}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 text-xs bg-apex-600 text-white rounded-full shadow-lg hover:bg-apex-700 transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
          New logs
        </button>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between mt-2 text-xs text-foreground-tertiary">
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
        {autoScroll && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-scrolling
          </span>
        )}
      </div>
    </div>
  )
}
