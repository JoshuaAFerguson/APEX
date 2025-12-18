/**
 * Type validation test to ensure the responsive AgentPanel implementation
 * compiles correctly and exports the expected types
 */

import { AgentPanel, AgentInfo, AgentPanelProps } from '../AgentPanel';

// Test that types are properly exported and accessible
describe('AgentPanel Types', () => {
  it('exports AgentInfo interface correctly', () => {
    const agentInfo: AgentInfo = {
      name: 'developer',
      status: 'active',
      stage: 'implementation',
      progress: 75,
      startedAt: new Date(),
      debugInfo: {
        tokensUsed: { input: 1000, output: 500 },
        turnCount: 3,
        thinking: 'Working on responsive layout...'
      }
    };

    expect(agentInfo.name).toBe('developer');
    expect(agentInfo.status).toBe('active');
  });

  it('exports AgentPanelProps interface correctly', () => {
    const props: AgentPanelProps = {
      agents: [{
        name: 'tester',
        status: 'waiting'
      }],
      currentAgent: 'developer',
      compact: false,
      showParallel: true,
      parallelAgents: [],
      useDetailedParallelView: false,
      displayMode: 'normal',
      showThoughts: true,
      width: 120  // New responsive width prop
    };

    expect(props.width).toBe(120);
    expect(props.agents).toHaveLength(1);
  });

  it('AgentPanel component can be imported', () => {
    expect(typeof AgentPanel).toBe('function');
  });

  it('AgentInfo status accepts all expected values', () => {
    const statuses: AgentInfo['status'][] = ['active', 'waiting', 'completed', 'idle', 'parallel'];

    statuses.forEach(status => {
      const agent: AgentInfo = {
        name: 'test',
        status
      };
      expect(agent.status).toBe(status);
    });
  });

  it('width prop is optional in AgentPanelProps', () => {
    const propsWithoutWidth: AgentPanelProps = {
      agents: []
    };

    const propsWithWidth: AgentPanelProps = {
      agents: [],
      width: 80
    };

    expect(propsWithoutWidth.width).toBeUndefined();
    expect(propsWithWidth.width).toBe(80);
  });
});