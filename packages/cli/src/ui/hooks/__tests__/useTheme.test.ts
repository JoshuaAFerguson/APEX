/**
 * Tests for useTheme hook utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useThemeHelpers } from '../useTheme.js';

// Mock the theme context
const mockTheme = {
  colors: {
    primary: '#007acc',
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    muted: '#6c757d',
    text: '#212529',
    agents: {
      planner: '#ff6b35',
      architect: '#004e9a',
      developer: '#2d5a27',
      tester: '#8e44ad',
      reviewer: '#d35400',
      devops: '#34495e',
    },
  },
};

const mockUseTheme = vi.fn(() => ({
  theme: mockTheme,
  themeName: 'dark',
  setTheme: vi.fn(),
}));

const mockUseThemeColors = vi.fn(() => mockTheme.colors);

// Mock the theme context module
vi.mock('../context/ThemeContext.js', () => ({
  useTheme: mockUseTheme,
  useThemeColors: mockUseThemeColors,
}));

describe('useThemeHelpers', () => {
  let mockSetTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      theme: mockTheme,
      themeName: 'dark',
      setTheme: mockSetTheme,
    });
    mockUseThemeColors.mockReturnValue(mockTheme.colors);
    vi.clearAllMocks();
  });

  it('should return theme utilities', () => {
    const { result } = renderHook(() => useThemeHelpers());

    expect(result.current.theme).toEqual(mockTheme);
    expect(result.current.themeName).toBe('dark');
    expect(result.current.colors).toEqual(mockTheme.colors);
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.getAgentColor).toBe('function');
    expect(typeof result.current.getStatusColor).toBe('function');
    expect(typeof result.current.toggleTheme).toBe('function');
    expect(result.current.isDark).toBe(true);
  });

  describe('getAgentColor', () => {
    it('should return correct color for known agents', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getAgentColor('planner')).toBe('#ff6b35');
      expect(result.current.getAgentColor('architect')).toBe('#004e9a');
      expect(result.current.getAgentColor('developer')).toBe('#2d5a27');
      expect(result.current.getAgentColor('tester')).toBe('#8e44ad');
      expect(result.current.getAgentColor('reviewer')).toBe('#d35400');
      expect(result.current.getAgentColor('devops')).toBe('#34495e');
    });

    it('should handle case insensitive agent names', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getAgentColor('PLANNER')).toBe('#ff6b35');
      expect(result.current.getAgentColor('Architect')).toBe('#004e9a');
      expect(result.current.getAgentColor('DEVELOPER')).toBe('#2d5a27');
    });

    it('should return primary color for unknown agents', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getAgentColor('unknown')).toBe('#007acc');
      expect(result.current.getAgentColor('custom-agent')).toBe('#007acc');
      expect(result.current.getAgentColor('')).toBe('#007acc');
    });
  });

  describe('getStatusColor', () => {
    it('should return success color for positive statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('completed')).toBe('#28a745');
      expect(result.current.getStatusColor('success')).toBe('#28a745');
      expect(result.current.getStatusColor('passed')).toBe('#28a745');
    });

    it('should return error color for failure statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('failed')).toBe('#dc3545');
      expect(result.current.getStatusColor('error')).toBe('#dc3545');
    });

    it('should return warning color for warning/pending statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('warning')).toBe('#ffc107');
      expect(result.current.getStatusColor('pending')).toBe('#ffc107');
    });

    it('should return info color for active statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('in-progress')).toBe('#17a2b8');
      expect(result.current.getStatusColor('running')).toBe('#17a2b8');
    });

    it('should return muted color for inactive statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('cancelled')).toBe('#6c757d');
      expect(result.current.getStatusColor('skipped')).toBe('#6c757d');
    });

    it('should handle case insensitive status names', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('COMPLETED')).toBe('#28a745');
      expect(result.current.getStatusColor('Failed')).toBe('#dc3545');
      expect(result.current.getStatusColor('RUNNING')).toBe('#17a2b8');
    });

    it('should return text color for unknown statuses', () => {
      const { result } = renderHook(() => useThemeHelpers());

      expect(result.current.getStatusColor('unknown')).toBe('#212529');
      expect(result.current.getStatusColor('custom')).toBe('#212529');
      expect(result.current.getStatusColor('')).toBe('#212529');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'dark',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      result.current.toggleTheme();

      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should toggle from light to dark', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'light',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      result.current.toggleTheme();

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should handle other theme names by defaulting to dark', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'custom',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      result.current.toggleTheme();

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('isDark', () => {
    it('should return true for dark theme', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'dark',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      expect(result.current.isDark).toBe(true);
    });

    it('should return false for light theme', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'light',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      expect(result.current.isDark).toBe(false);
    });

    it('should return false for other themes', () => {
      mockUseTheme.mockReturnValue({
        theme: mockTheme,
        themeName: 'custom',
        setTheme: mockSetTheme,
      });

      const { result } = renderHook(() => useThemeHelpers());
      expect(result.current.isDark).toBe(false);
    });
  });

  describe('re-exports', () => {
    it('should make useTheme available', async () => {
      const { useTheme } = await import('../useTheme.js');
      expect(useTheme).toBe(mockUseTheme);
    });

    it('should make useThemeColors available', async () => {
      const { useThemeColors } = await import('../useTheme.js');
      expect(useThemeColors).toBe(mockUseThemeColors);
    });
  });
});