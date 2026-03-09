import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from './src/ui/__tests__/test-utils';
import { StatusBar } from './src/ui/components/StatusBar';

// Mock useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();

vi.mock('./src/ui/components/hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar Mock Test', () => {
  beforeEach(() => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 180,
      height: 40,
      breakpoint: 'wide' as const,
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: false,
      isWide: true,
    });
  });

  it('should use mocked width', () => {
    render(<StatusBar isConnected={true} sessionName="Test Session" />);

    console.log('Rendered output:', screen.debug());

    // Just check that something renders
    expect(screen.getByText('●')).toBeInTheDocument();
  });
});