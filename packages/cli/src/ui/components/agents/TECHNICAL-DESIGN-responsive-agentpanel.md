# Technical Design: Responsive AgentPanel Implementation

## Overview

This document provides detailed implementation specifications for adding responsive layout capabilities to the AgentPanel component using the `useStdoutDimensions` hook.

## Key Interfaces

### ResponsiveAgentConfig

```typescript
interface ResponsiveAgentConfig {
  // Layout control
  useCompactLayout: boolean;
  showBorder: boolean;
  showTitle: boolean;

  // Agent display
  agentNameMaxLength: number;
  showStage: boolean;
  showElapsedTime: boolean;
  abbreviateNames: boolean;

  // Progress display
  showProgressBars: boolean;
  progressBarWidth: number;
  showProgressInline: boolean;

  // Parallel execution
  showParallelSection: boolean;
  showParallelDetails: boolean;
  maxParallelAgentsVisible: number;

  // Thoughts/Debug display
  showThoughtsPreview: boolean;
  thoughtsMaxLength: number;
}
```

### Breakpoint Configurations

```typescript
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsiveAgentConfig> = {
  narrow: {
    useCompactLayout: true,
    showBorder: false,
    showTitle: false,
    agentNameMaxLength: 6,
    showStage: false,
    showElapsedTime: true,
    abbreviateNames: true,
    showProgressBars: false,
    progressBarWidth: 0,
    showProgressInline: true,  // Show as "65%" inline
    showParallelSection: false,
    showParallelDetails: false,
    maxParallelAgentsVisible: 2,
    showThoughtsPreview: false,
    thoughtsMaxLength: 0,
  },

  compact: {
    useCompactLayout: true,
    showBorder: false,
    showTitle: false,
    agentNameMaxLength: 10,
    showStage: false,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: false,
    progressBarWidth: 0,
    showProgressInline: true,
    showParallelSection: true,
    showParallelDetails: false,
    maxParallelAgentsVisible: 3,
    showThoughtsPreview: false,
    thoughtsMaxLength: 0,
  },

  normal: {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 16,
    showStage: true,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: true,
    progressBarWidth: 30,
    showProgressInline: false,
    showParallelSection: true,
    showParallelDetails: true,
    maxParallelAgentsVisible: 5,
    showThoughtsPreview: true,
    thoughtsMaxLength: 80,
  },

  wide: {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 24,
    showStage: true,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: true,
    progressBarWidth: 40,
    showProgressInline: false,
    showParallelSection: true,
    showParallelDetails: true,
    maxParallelAgentsVisible: 10,
    showThoughtsPreview: true,
    thoughtsMaxLength: 150,
  },
};
```

## Implementation Details

### 1. Updated AgentPanel Component

```typescript
// packages/cli/src/ui/components/agents/AgentPanel.tsx

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';
import { useStdoutDimensions, type Breakpoint } from '../../hooks/index.js';
import { useAgentHandoff } from '../../hooks/useAgentHandoff.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { HandoffIndicator } from './HandoffIndicator.js';
import { ProgressBar } from '../ProgressIndicators.js';
import { ParallelExecutionView } from './ParallelExecutionView.js';
import { VerboseAgentRow } from './VerboseAgentRow.js';
import { AgentThoughts } from '../AgentThoughts.js';

// ... interface definitions ...

// Agent name abbreviation mapping
const AGENT_ABBREVIATIONS: Record<string, string> = {
  planner: 'plan',
  architect: 'arch',
  developer: 'dev',
  reviewer: 'rev',
  tester: 'test',
  devops: 'ops',
};

/**
 * Get responsive configuration based on terminal breakpoint
 */
function getResponsiveConfig(
  breakpoint: Breakpoint,
  agentCount: number,
  width: number
): ResponsiveAgentConfig {
  const base = RESPONSIVE_CONFIGS[breakpoint];

  // Dynamic adjustments based on agent count
  if (agentCount > 5 && breakpoint === 'normal') {
    // Force compact layout for many agents in normal terminal
    return { ...base, useCompactLayout: true };
  }

  // Adjust agent name length based on available width and agent count
  if (base.useCompactLayout) {
    const availablePerAgent = Math.floor(width / agentCount) - 8; // icon + elapsed + separator
    const adjustedNameLength = Math.max(4, Math.min(base.agentNameMaxLength, availablePerAgent));
    return { ...base, agentNameMaxLength: adjustedNameLength };
  }

  return base;
}

/**
 * Truncate or abbreviate agent name based on config
 */
function formatAgentName(
  name: string,
  config: ResponsiveAgentConfig
): string {
  if (config.abbreviateNames && AGENT_ABBREVIATIONS[name]) {
    return AGENT_ABBREVIATIONS[name];
  }

  if (name.length > config.agentNameMaxLength) {
    return name.slice(0, config.agentNameMaxLength - 2) + '..';
  }

  return name;
}

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
  showParallel = false,
  parallelAgents = [],
  useDetailedParallelView = false,
  displayMode = 'normal',
  showThoughts = false,
  width: explicitWidth,
}: AgentPanelProps): React.ReactElement {
  // Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Get responsive configuration
  const config = useMemo(
    () => getResponsiveConfig(breakpoint, agents.length, width),
    [breakpoint, agents.length, width]
  );

  // Use handoff animation hook
  const handoffState = useAgentHandoff(currentAgent);

  // Determine effective display mode
  const effectiveDisplayMode = useMemo(() => {
    // Verbose mode always respected
    if (displayMode === 'verbose') return 'verbose';

    // Explicit compact prop or displayMode
    if (compact || displayMode === 'compact') return 'compact';

    // Auto-compact based on responsive config
    if (config.useCompactLayout) return 'compact';

    return 'normal';
  }, [displayMode, compact, config.useCompactLayout]);

  // Render compact layout
  if (effectiveDisplayMode === 'compact') {
    return (
      <CompactAgentPanel
        agents={agents}
        currentAgent={currentAgent}
        config={config}
        handoffState={handoffState}
        showParallel={showParallel}
        parallelAgents={parallelAgents}
      />
    );
  }

  // Render detailed layout (normal/verbose)
  return (
    <DetailedAgentPanel
      agents={agents}
      currentAgent={currentAgent}
      config={config}
      handoffState={handoffState}
      showParallel={showParallel}
      parallelAgents={parallelAgents}
      useDetailedParallelView={useDetailedParallelView}
      displayMode={effectiveDisplayMode}
      showThoughts={showThoughts}
    />
  );
}
```

### 2. CompactAgentPanel Sub-component

```typescript
interface CompactAgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  config: ResponsiveAgentConfig;
  handoffState: HandoffAnimationState;
  showParallel: boolean;
  parallelAgents: AgentInfo[];
}

function CompactAgentPanel({
  agents,
  currentAgent,
  config,
  handoffState,
  showParallel,
  parallelAgents,
}: CompactAgentPanelProps): React.ReactElement {
  return (
    <Box>
      {agents.map((agent, index) => {
        const shouldShowElapsed = config.showElapsedTime &&
          agent.status === 'active' && agent.startedAt;
        const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

        const displayName = formatAgentName(agent.name, config);
        const color = agent.name === currentAgent
          ? (agent.status === 'parallel' ? 'cyan' : agentColors[agent.name])
          : 'gray';

        return (
          <React.Fragment key={agent.name}>
            <Text color={color}>
              {statusIcons[agent.status]}
              {displayName}
              {config.showProgressInline && agent.progress !== undefined &&
                agent.progress > 0 && agent.progress < 100 &&
                ` ${agent.progress}%`}
              {shouldShowElapsed && `[${elapsedTime}]`}
            </Text>
            {index < agents.length - 1 && <Text color="gray"> | </Text>}
          </React.Fragment>
        );
      })}

      {/* Compact parallel agents display */}
      {showParallel && config.showParallelSection && parallelAgents.length > 1 && (
        <>
          <Text color="gray"> | </Text>
          <Text color="cyan">⟂</Text>
          {parallelAgents.slice(0, config.maxParallelAgentsVisible).map((agent, index) => (
            <React.Fragment key={agent.name}>
              <Text color="cyan">
                {formatAgentName(agent.name, config)}
              </Text>
              {index < Math.min(parallelAgents.length, config.maxParallelAgentsVisible) - 1 &&
                <Text color="cyan">,</Text>}
            </React.Fragment>
          ))}
          {parallelAgents.length > config.maxParallelAgentsVisible && (
            <Text color="cyan">+{parallelAgents.length - config.maxParallelAgentsVisible}</Text>
          )}
        </>
      )}

      {/* Handoff animation */}
      <HandoffIndicator
        animationState={handoffState}
        agentColors={agentColors}
        compact={true}
      />
    </Box>
  );
}
```

### 3. DetailedAgentPanel Sub-component

```typescript
interface DetailedAgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  config: ResponsiveAgentConfig;
  handoffState: HandoffAnimationState;
  showParallel: boolean;
  parallelAgents: AgentInfo[];
  useDetailedParallelView: boolean;
  displayMode: DisplayMode;
  showThoughts: boolean;
}

function DetailedAgentPanel({
  agents,
  currentAgent,
  config,
  handoffState,
  showParallel,
  parallelAgents,
  useDetailedParallelView,
  displayMode,
  showThoughts,
}: DetailedAgentPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {config.showTitle && (
        <Text color="cyan" bold>
          Active Agents
        </Text>
      )}

      {/* Handoff animation */}
      <HandoffIndicator
        animationState={handoffState}
        agentColors={agentColors}
        compact={false}
      />

      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          <React.Fragment key={agent.name}>
            {displayMode === 'verbose' ? (
              <VerboseAgentRow
                agent={agent}
                isActive={agent.name === currentAgent}
                color={agentColors[agent.name] || 'white'}
              />
            ) : (
              <ResponsiveAgentRow
                agent={agent}
                isActive={agent.name === currentAgent}
                config={config}
              />
            )}

            {/* Thoughts preview */}
            {showThoughts && config.showThoughtsPreview &&
              agent.debugInfo?.thinking && (
                <Box marginTop={1}>
                  <AgentThoughts
                    thinking={agent.debugInfo.thinking.slice(0, config.thoughtsMaxLength)}
                    agent={agent.name}
                    displayMode={displayMode}
                  />
                </Box>
              )}
          </React.Fragment>
        ))}
      </Box>

      {/* Parallel execution section */}
      {showParallel && config.showParallelSection && parallelAgents.length > 1 && (
        config.showParallelDetails && useDetailedParallelView ? (
          <ParallelExecutionView
            agents={parallelAgents.slice(0, config.maxParallelAgentsVisible).map(agent => ({
              name: agent.name,
              status: agent.status,
              stage: agent.stage,
              progress: agent.progress,
              startedAt: agent.startedAt,
            }))}
            compact={false}
          />
        ) : (
          <ResponsiveParallelSection
            agents={parallelAgents}
            config={config}
            showThoughts={showThoughts}
            displayMode={displayMode}
          />
        )
      )}
    </Box>
  );
}
```

### 4. ResponsiveAgentRow Sub-component

```typescript
interface ResponsiveAgentRowProps {
  agent: AgentInfo;
  isActive: boolean;
  config: ResponsiveAgentConfig;
}

function ResponsiveAgentRow({
  agent,
  isActive,
  config,
}: ResponsiveAgentRowProps): React.ReactElement {
  const color = agentColors[agent.name] || 'white';
  const finalColor = agent.status === 'parallel' ? 'cyan' : color;

  const shouldShowElapsed = config.showElapsedTime &&
    agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  const shouldShowProgressBar = config.showProgressBars &&
    (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  const displayName = formatAgentName(agent.name, config);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? finalColor : 'gray'}>
          {statusIcons[agent.status]}{' '}
        </Text>
        <Text color={isActive ? finalColor : 'gray'} bold={isActive}>
          {displayName}
        </Text>
        {config.showStage && agent.stage && (
          <Text color="gray" dimColor>
            {' '}({agent.stage})
          </Text>
        )}
        {shouldShowElapsed && (
          <Text color="gray" dimColor>
            {' '}[{elapsedTime}]
          </Text>
        )}
        {/* Inline progress for non-progress-bar modes */}
        {config.showProgressInline && !shouldShowProgressBar &&
          agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
            <Text color="gray" dimColor>
              {' '}{agent.progress}%
            </Text>
          )}
      </Box>
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={config.progressBarWidth}
            showPercentage={true}
            color={finalColor}
            animated={false}
          />
        </Box>
      )}
    </Box>
  );
}
```

## Visual Examples by Breakpoint

### Narrow (< 60 cols) - 50 column terminal

```
⚡dev[12s]|○test|○rev|○arch
```

### Compact (60-100 cols) - 80 column terminal

```
⚡developer[42s] | ○tester | ○reviewer | ⟂arch,dev
```

### Normal (100-160 cols) - 120 column terminal

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Active Agents                                                                                                    │
│                                                                                                                  │
│ ⚡ developer (implementation) [42s]                                                                              │
│   ████████████████████░░░░░░░░░░ 65%                                                                             │
│                                                                                                                  │
│ ○ tester                                                                                                         │
│ ○ reviewer                                                                                                       │
│                                                                                                                  │
│ ⟂ Parallel Execution                                                                                             │
│   ⟂ architect (design) [12s]                                                                                     │
│   ⟂ devops (setup) [8s]                                                                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Wide (>= 160 cols) - 180 column terminal

Same as normal but with wider progress bars (40 chars) and more generous spacing.

## Test File Structure

```typescript
// packages/cli/src/ui/components/agents/__tests__/AgentPanel.responsive.test.tsx

import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useStdoutDimensions hook
jest.mock('../../../hooks/index.js', () => ({
  ...jest.requireActual('../../../hooks/index.js'),
  useStdoutDimensions: jest.fn(),
}));

import { useStdoutDimensions } from '../../../hooks/index.js';

const mockUseStdoutDimensions = useStdoutDimensions as jest.Mock;

// Helper to create mock agents
function createMockAgents(count: number): AgentInfo[] {
  const names = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];
  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    name: names[i],
    status: i === 2 ? 'active' : 'idle',
    stage: i === 2 ? 'implementation' : undefined,
    progress: i === 2 ? 65 : undefined,
    startedAt: i === 2 ? new Date() : undefined,
  }));
}

describe('AgentPanel - Responsive Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook integration', () => {
    it('uses useStdoutDimensions hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<AgentPanel agents={createMockAgents(3)} />);
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('respects explicit width prop', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
        breakpoint: 'wide',
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} width={50} />
      );

      // Should use compact mode despite wide terminal because explicit width is narrow
      expect(lastFrame()).not.toContain('Active Agents'); // No title in compact
    });
  });

  describe('Narrow terminals (< 60 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
    });

    it('automatically switches to compact mode', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).not.toContain('Active Agents'); // No title in compact
      expect(lastFrame()).not.toContain('╭'); // No border
    });

    it('abbreviates agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('dev'); // Abbreviated from 'developer'
    });

    it('shows elapsed time inline', () => {
      const agents = createMockAgents(3);
      agents[2].startedAt = new Date();
      const { lastFrame } = render(
        <AgentPanel agents={agents} currentAgent="developer" />
      );
      expect(lastFrame()).toMatch(/\[\d+s\]/); // Elapsed time format
    });

    it('hides progress bars', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).not.toContain('████'); // No progress bar characters
    });

    it('does not overflow terminal width', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      const lines = lastFrame()?.split('\n') || [];
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('Compact terminals (60-100 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });
    });

    it('shows full agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('developer');
    });

    it('uses compact layout', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('|'); // Separator
    });
  });

  describe('Normal terminals (100-160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });
    });

    it('shows bordered panel', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('╭'); // Border character
    });

    it('shows title', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('Active Agents');
    });

    it('shows progress bars', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toMatch(/[█░]/); // Progress bar characters
    });

    it('shows stage information', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('(implementation)');
    });
  });

  describe('Wide terminals (>= 160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });
    });

    it('shows full details', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('Active Agents');
      expect(lastFrame()).toContain('developer');
    });
  });

  describe('Display mode interactions', () => {
    it('compact prop overrides responsive auto-switching', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        breakpoint: 'wide',
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} compact={true} />
      );
      expect(lastFrame()).not.toContain('Active Agents');
    });

    it('verbose mode always shows debug info', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        breakpoint: 'narrow',
      });

      const agents = createMockAgents(3);
      agents[2].debugInfo = {
        tokensUsed: { input: 1000, output: 500 },
        turnCount: 5,
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );
      expect(lastFrame()).toContain('Tokens');
    });
  });

  describe('No overflow at any width', () => {
    it.each([40, 50, 60, 80, 100, 120, 160, 200])(
      'renders without overflow at width %d',
      (width) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
        });

        const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
        const lines = lastFrame()?.split('\n') || [];

        lines.forEach(line => {
          // Allow some margin for ANSI codes
          expect(line.replace(/\x1b\[[0-9;]*m/g, '').length).toBeLessThanOrEqual(width + 5);
        });
      }
    );
  });
});
```

## Implementation Checklist

### Phase 1: Core Hook Integration
- [ ] Import `useStdoutDimensions` hook
- [ ] Add `width` prop to `AgentPanelProps`
- [ ] Implement `getResponsiveConfig()` function
- [ ] Add `RESPONSIVE_CONFIGS` constant
- [ ] Implement `formatAgentName()` helper

### Phase 2: Sub-components
- [ ] Extract `CompactAgentPanel` sub-component
- [ ] Extract `DetailedAgentPanel` sub-component
- [ ] Create `ResponsiveAgentRow` component
- [ ] Create `ResponsiveParallelSection` component

### Phase 3: Responsive Logic
- [ ] Implement auto-compact switching logic
- [ ] Add agent name abbreviation
- [ ] Implement overflow prevention
- [ ] Add progress bar width adaptation

### Phase 4: Testing
- [ ] Create `AgentPanel.responsive.test.tsx`
- [ ] Add tests for all breakpoints
- [ ] Add overflow prevention tests
- [ ] Update existing tests for mock compatibility

### Phase 5: Verification
- [ ] Manual testing in various terminal sizes
- [ ] Verify no visual overflow
- [ ] Ensure backward compatibility
