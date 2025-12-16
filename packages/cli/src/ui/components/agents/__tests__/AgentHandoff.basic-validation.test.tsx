/**
 * Basic validation test to ensure all agent handoff components work together
 * Validates the complete integration without complex scenarios
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('Agent Handoff Basic Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const basicAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation' },
    { name: 'tester', status: 'waiting' },
  ];

  it('renders AgentPanel without errors', () => {
    const { container } = render(
      <AgentPanel agents={basicAgents} currentAgent="developer" />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it('displays all agent names', () => {
    render(<AgentPanel agents={basicAgents} currentAgent="developer" />);

    expect(screen.getByText('planner')).toBeInTheDocument();
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  it('shows handoff animation when agent changes', async () => {
    const { rerender } = render(
      <AgentPanel agents={basicAgents} currentAgent="developer" />
    );

    // Change agent
    act(() => {
      rerender(<AgentPanel agents={basicAgents} currentAgent="tester" />);
    });

    // Should show transition indicator
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  it('completes animation after timeout', async () => {
    const { rerender } = render(
      <AgentPanel agents={basicAgents} currentAgent="developer" />
    );

    // Trigger animation
    act(() => {
      rerender(<AgentPanel agents={basicAgents} currentAgent="tester" />);
    });

    // Complete animation
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Animation should be gone
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  it('works in compact mode', () => {
    const { rerender } = render(
      <AgentPanel agents={basicAgents} currentAgent="developer" compact={true} />
    );

    // Should not show Active Agents header in compact mode
    expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

    // Change agent
    act(() => {
      rerender(<AgentPanel agents={basicAgents} currentAgent="tester" compact={true} />);
    });

    // Should show animation
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('handles empty agents list', () => {
    render(<AgentPanel agents={[]} currentAgent="nonexistent" />);

    expect(screen.getByText('Active Agents')).toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });
});