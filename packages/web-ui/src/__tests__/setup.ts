import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock lucide-react icons globally
vi.mock('lucide-react', () => ({
  // Navigation icons
  ChevronLeft: () => React.createElement('div', { 'data-testid': 'chevron-left' }, '←'),
  ChevronRight: () => React.createElement('div', { 'data-testid': 'chevron-right' }, '→'),
  ChevronDown: () => React.createElement('div', { 'data-testid': 'chevron-down' }, '↓'),
  ChevronUp: () => React.createElement('div', { 'data-testid': 'chevron-up' }, '↑'),

  // Action icons
  Plus: () => React.createElement('div', { 'data-testid': 'plus-icon' }, '+'),
  Save: () => React.createElement('div', { 'data-testid': 'save-icon' }, '💾'),
  X: () => React.createElement('div', { 'data-testid': 'x-icon' }, '✖'),
  Copy: () => React.createElement('div', { 'data-testid': 'copy-icon' }, '📋'),
  Check: () => React.createElement('div', { 'data-testid': 'check-icon' }, '✓'),
  Download: () => React.createElement('div', { 'data-testid': 'download-icon' }, '⬇'),
  Upload: () => React.createElement('div', { 'data-testid': 'upload-icon' }, '⬆'),
  Send: () => React.createElement('div', { 'data-testid': 'send-icon' }, '📤'),

  // Status icons
  RefreshCw: () => React.createElement('div', { 'data-testid': 'refresh-icon' }, '↻'),
  XCircle: () => React.createElement('div', { 'data-testid': 'x-circle-icon' }, '✖'),
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle-icon' }, '✓'),
  CheckCircle2: () => React.createElement('div', { 'data-testid': 'check-circle-2-icon' }, '✓'),
  RotateCcw: () => React.createElement('div', { 'data-testid': 'rotate-ccw-icon' }, '↺'),
  AlertTriangle: () => React.createElement('div', { 'data-testid': 'alert-triangle-icon' }, '⚠'),
  AlertCircle: () => React.createElement('div', { 'data-testid': 'alert-circle-icon' }, '⚠'),

  // Time and activity icons
  Clock: () => React.createElement('div', { 'data-testid': 'clock-icon' }, '🕐'),
  Play: () => React.createElement('div', { 'data-testid': 'play-icon' }, '▶'),
  History: () => React.createElement('div', { 'data-testid': 'history-icon' }, '🕐'),
  Activity: () => React.createElement('div', { 'data-testid': 'activity-icon' }, '📊'),

  // File and content icons
  FileText: () => React.createElement('div', { 'data-testid': 'file-text-icon' }, '📄'),
  FilePlus: () => React.createElement('div', { 'data-testid': 'file-plus-icon' }, '📄+'),
  FileX: () => React.createElement('div', { 'data-testid': 'file-x-icon' }, '📄✖'),
  FileEdit: () => React.createElement('div', { 'data-testid': 'file-edit-icon' }, '📄✏'),
  FileDiff: () => React.createElement('div', { 'data-testid': 'file-diff-icon' }, '📄±'),

  // Git and version control icons
  GitBranch: () => React.createElement('div', { 'data-testid': 'git-branch-icon' }, '🌿'),

  // UI and layout icons
  Search: () => React.createElement('div', { 'data-testid': 'search-icon' }, '🔍'),
  Filter: () => React.createElement('div', { 'data-testid': 'filter-icon' }, '🔽'),
  MoreHorizontal: () => React.createElement('div', { 'data-testid': 'more-horizontal-icon' }, '⋯'),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }, '⚙'),

  // Organization icons
  Tag: () => React.createElement('div', { 'data-testid': 'tag-icon' }, '🏷'),
  Layers: () => React.createElement('div', { 'data-testid': 'layers-icon' }, '📚'),
  Users: () => React.createElement('div', { 'data-testid': 'users-icon' }, '👥'),
  User: () => React.createElement('div', { 'data-testid': 'user-icon' }, '👤'),

  // Theme icons
  Sun: () => React.createElement('div', { 'data-testid': 'sun-icon' }, '☀'),
  Moon: () => React.createElement('div', { 'data-testid': 'moon-icon' }, '🌙'),
  Monitor: () => React.createElement('div', { 'data-testid': 'monitor-icon' }, '🖥'),

  // Navigation and structure icons
  LayoutDashboard: () => React.createElement('div', { 'data-testid': 'layout-dashboard-icon' }, '📊'),
  ListTodo: () => React.createElement('div', { 'data-testid': 'list-todo-icon' }, '✅'),
  List: () => React.createElement('div', { 'data-testid': 'list-icon' }, '📋'),
  LayoutGrid: () => React.createElement('div', { 'data-testid': 'layout-grid-icon' }, '▦'),
  BarChart3: () => React.createElement('div', { 'data-testid': 'bar-chart-3-icon' }, '📊'),

  // Communication icons
  MessageSquare: () => React.createElement('div', { 'data-testid': 'message-square-icon' }, '💬'),
  MessageSquarePlus: () => React.createElement('div', { 'data-testid': 'message-square-plus-icon' }, '💬+'),

  // Loading and state icons
  Loader2: () => React.createElement('div', { 'data-testid': 'loader-icon', className: 'animate-spin' }, '⟳'),
  Spinner: () => React.createElement('div', { 'data-testid': 'spinner-icon', className: 'animate-spin' }, '⟳'),

  // Security and shield icons
  ShieldCheck: () => React.createElement('div', { 'data-testid': 'shield-check-icon' }, '🛡✓'),
  ShieldX: () => React.createElement('div', { 'data-testid': 'shield-x-icon' }, '🛡✖'),

  // Special functionality icons
  Zap: () => React.createElement('div', { 'data-testid': 'zap-icon' }, '⚡'),
  Info: () => React.createElement('div', { 'data-testid': 'info-icon' }, 'ℹ'),
  Puzzle: () => React.createElement('div', { 'data-testid': 'puzzle-icon' }, '🧩'),
  Trash2: () => React.createElement('div', { 'data-testid': 'trash-icon' }, '🗑'),
  Terminal: () => React.createElement('div', { 'data-testid': 'terminal-icon' }, '💻'),

  // Diff and comparison icons
  AlignLeft: () => React.createElement('div', { 'data-testid': 'align-left-icon' }, '≡'),
  Columns2: () => React.createElement('div', { 'data-testid': 'columns-2-icon' }, '⫸'),
  Rows3: () => React.createElement('div', { 'data-testid': 'rows-3-icon' }, '☰'),

  // Network icons
  Wifi: () => React.createElement('div', { 'data-testid': 'wifi-icon' }, '📶'),
  WifiOff: () => React.createElement('div', { 'data-testid': 'wifi-off-icon' }, '📶✖'),

  // Other icons
  MinusCircle: () => React.createElement('div', { 'data-testid': 'minus-circle-icon' }, '⊖'),
  Edit: () => React.createElement('div', { 'data-testid': 'edit-icon' }, '✏'),
  Eye: () => React.createElement('div', { 'data-testid': 'eye-icon' }, '👁'),
  EyeOff: () => React.createElement('div', { 'data-testid': 'eye-off-icon' }, '👁‍🗨'),
}));

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Add any global setup here
});