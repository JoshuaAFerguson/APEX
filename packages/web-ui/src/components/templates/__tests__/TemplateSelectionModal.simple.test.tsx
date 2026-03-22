import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the problematic hooks and components first
vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: vi.fn(() => ({
    filteredTemplates: [],
    isLoading: false,
    error: null,
    categoryCounts: { all: 0 },
    setFilters: vi.fn(),
    refresh: vi.fn(),
  }))
}))

// Mock all UI components with simpler implementations
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode, open: boolean }) => {
    return open ? <div data-testid="dialog">{children}</div> : null
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

vi.mock('@/components/templates', () => ({
  TemplateSearchInput: ({ onChange }: { onChange: (value: string) => void }) => (
    <input data-testid="search-input" onChange={(e) => onChange(e.target.value)} />
  ),
  TemplateCard: () => <div data-testid="template-card">Template</div>,
  TemplatePreviewPanel: () => <div data-testid="preview-panel">Preview</div>,
  TemplateCategoryFilter: () => <div data-testid="category-filter">Categories</div>,
}))

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  FileText: () => <span>FileText</span>,
  AlertCircle: () => <span>AlertCircle</span>,
}))

// Now import the component
import { TemplateSelectionModal } from '../TemplateSelectionModal'

describe('TemplateSelectionModal Simple Tests', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onTemplateSelected: vi.fn(),
  }

  it('renders when open', () => {
    render(<TemplateSelectionModal {...defaultProps} />)

    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Select Template')
  })

  it('does not render when closed', () => {
    render(<TemplateSelectionModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('renders all main components', () => {
    render(<TemplateSelectionModal {...defaultProps} />)

    expect(screen.getByTestId('dialog-header')).toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter')).toBeInTheDocument()
    expect(screen.getByTestId('preview-panel')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-footer')).toBeInTheDocument()
  })
})