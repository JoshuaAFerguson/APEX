import { vi } from 'vitest';
import React from 'react';

// Mock @dnd-kit/core completely
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) =>
    React.createElement('div', {
      'data-testid': 'dnd-context',
      onDrop: (e: any) => onDragEnd?.({ active: null, over: null, activatorEvent: e })
    }, children),
  DragOverlay: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'drag-overlay' }, children),
  useDraggable: () => ({
    attributes: { 'data-testid': 'draggable-item' },
    listeners: {
      onMouseDown: vi.fn(),
      onTouchStart: vi.fn(),
    },
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useDndMonitor: vi.fn(),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => 'translate(0px, 0px)'),
    },
  },
}));

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((array, oldIndex, newIndex) => {
    const result = [...array];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
}));

// Mock react-flow-renderer
vi.mock('react-flow-renderer', () => ({
  default: ({ children, onNodesChange, onEdgesChange, onConnect, nodes, edges }: any) =>
    React.createElement('div', {
      'data-testid': 'react-flow',
      'data-nodes-count': nodes?.length || 0,
      'data-edges-count': edges?.length || 0,
      onClick: () => {
        onNodesChange?.([]);
        onEdgesChange?.([]);
        onConnect?.({ source: 'test', target: 'test2' });
      }
    }, [
      children,
      ...(nodes?.map((node: any) =>
        React.createElement('div', {
          key: node.id,
          'data-testid': `flow-node-${node.id}`
        }, node.data?.label || node.id)
      ) || []),
      ...(edges?.map((edge: any) =>
        React.createElement('div', {
          key: edge.id,
          'data-testid': `flow-edge-${edge.id}`
        }, `${edge.source} → ${edge.target}`)
      ) || [])
    ]),
  MiniMap: () => React.createElement('div', { 'data-testid': 'minimap' }),
  Controls: () => React.createElement('div', { 'data-testid': 'controls' }),
  Background: () => React.createElement('div', { 'data-testid': 'background' }),
  Handle: () => React.createElement('div', { 'data-testid': 'handle' }),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  useReactFlow: () => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    deleteElements: vi.fn(),
    fitView: vi.fn(),
    zoomToFit: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setViewport: vi.fn(),
  }),
}));

// Mock ResizeObserver for React Flow
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.URL for file operations
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock document.createElement for downloads
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tag: string) => {
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    } as any;
  }
  return originalCreateElement.call(document, tag);
});

// Mock FileReader
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: string | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.result = file.type.includes('yaml') || file.name.includes('yaml') ?
        'name: Test Workflow\ndescription: A test workflow\nstages: []\ngates: []' :
        file.name;
      this.onload?.({ target: this });
    }, 0);
  }
}

Object.defineProperty(window, 'FileReader', {
  value: MockFileReader,
});