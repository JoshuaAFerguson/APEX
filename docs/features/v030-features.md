# APEX v0.3.0 Features Overview

This document provides a comprehensive overview of the features introduced in APEX v0.3.0, with detailed streaming output examples and visual demonstrations.

## Overview

APEX v0.3.0 transforms the CLI experience into a "Claude Code-like Interactive Experience" with Rich Terminal UI components, real-time streaming output, and sophisticated visual feedback. This release focuses on making APEX feel as polished and intuitive as modern AI coding assistants while maintaining our unique multi-agent orchestration capabilities for multi-agent orchestration workflows.

## Core Features

### 1. Rich Terminal UI Framework

APEX v0.3.0 introduces a complete Ink-based React framework for CLI applications, providing:

- **Component-based architecture** for complex UI layouts
- **Real-time updates** with React state management
- **Responsive design** with 4-tier breakpoint system (narrow/compact/normal/wide)
- **Theme support** with dark/light modes
- **Typography system** with consistent visual hierarchy

### 2. Streaming Response Rendering

#### StreamingText Component

The `StreamingText` component provides typewriter-style character-by-character output that creates an engaging user experience.

**Basic Usage:**

```typescript
import { StreamingText } from '@apexcli/cli/ui/components';

<StreamingText
  text="Implementing your feature..."
  speed={50}
  showCursor={true}
  onComplete={() => console.log('Done!')}
/>
```

**Visual Output Example:**

```
┌─────────────────────────────────────────────┐
│ 🤖 Developer Agent                          │
├─────────────────────────────────────────────┤
│ Analyzing your codebase...▊                 │
│                                             │
│ I can see you're working on a React app    │
│ with TypeScript. Let me implement the      │
│ user authentication feature you requested▊ │
│                                             │
│ ✓ Complete                                  │
└─────────────────────────────────────────────┘
```

#### StreamingResponse Component

The `StreamingResponse` component combines agent identification with streaming text output:

```typescript
<StreamingResponse
  agent="architect"
  content={responseText}
  isStreaming={true}
  isComplete={false}
  onComplete={handleComplete}
/>
```

**Visual Output Example:**

```
┌─────────────────────────────────────────────┐
│ 🏗️  architect ● streaming...                │
├─────────────────────────────────────────────┤
│ I'll design the authentication system      │
│ using JWT tokens with the following        │
│ components:                                 │
│                                             │
│ 1. Login/Register forms                     │
│ 2. JWT token management                     │
│ 3. Protected route wrapper                  │
│ 4. User context provider▊                  │
│                                             │
│ ✓ Complete                                  │
└─────────────────────────────────────────────┘
```

#### TypewriterText Component

For headers, titles, and emphasis:

```typescript
<TypewriterText
  text="🎉 Task Completed Successfully!"
  speed={100}
  delay={500}
  color="green"
  bold={true}
  onComplete={() => showCelebration()}
/>
```

**Visual Output:**

```
🎉 Task Completed Successfully!
```

### 3. Advanced Display Modes

#### Responsive Width System

All streaming components automatically adapt to terminal width:

```typescript
// Narrow terminal (< 60 columns)
┌─────────────────────────────────┐
│ 🤖 dev ● streaming...           │
├─────────────────────────────────┤
│ Creating auth component...      │
│ - Login form                    │
│ - Validation                    │
│ - JWT handling▊                 │
└─────────────────────────────────┘

// Wide terminal (>= 120 columns)
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 Developer Agent ● streaming...                                                                                        │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ I'm creating the authentication component with the following features:                                                  │
│ • Login form with email/password validation                                                                             │
│ • JWT token storage and management                                                                                      │
│ • Protected route wrapper component                                                                                     │
│ • User context provider with authentication state▊                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Responsive Width Demonstrations:**
- Narrow terminal (< 60 columns)
- Compact terminal (60-79 columns)
- Normal terminal (80-119 columns)
- Wide terminal (>= 120 columns)

#### Breakpoint-Aware Layout

```typescript
// useStdoutDimensions hook provides responsive behavior
const { width, height, breakpoint } = useStdoutDimensions();

// Breakpoint values: 'narrow' | 'compact' | 'normal' | 'wide'
// narrow: width < 60, compact: 60-79, normal: 80-119, wide: 120+
```

### 4. Agent Panel Visualization

The Agent Panel system provides comprehensive visualization of multi-agent orchestration, including real-time status tracking, animated handoffs between agents, parallel execution monitoring, and hierarchical task breakdowns.

**Agent Panel with Handoff Animations** highlights:
- Visual handoff arrows for agent transitions
- parallel execution lanes with live status
- subtask tree view with expand/collapse controls
- interactive controls for filtering and focus

#### AgentPanel Component Overview

The `AgentPanel` component is the primary interface for visualizing agent activity. It supports three display modes that automatically adapt to terminal width and user preferences.

##### Display Modes

| Mode | Description | Terminal Width | Use Case |
|------|-------------|----------------|----------|
| **Full** | Detailed view with borders, progress bars, and stage info | 80+ columns | Standard desktop terminals |
| **Compact** | Inline display with abbreviated names and minimal chrome | < 80 columns | Narrow terminals, status bars |
| **Verbose** | Extended debug info including tokens, tool calls, and thoughts | Any | Debugging, development |

##### Full Mode (Normal/Wide Terminals)

Full mode provides maximum detail with bordered sections, progress bars, and comprehensive status information:

```
┌─ Agent Activity ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ Active Agents                                                                │
│                                                                              │
│ ⚡ Handoff [0.8s]: 📋 planner →→→ 🏗️ architect                               │
│ ████████████████████████████████████████ 100%                               │
│                                                                              │
│ ⚡ planner                                                                    │
│   (planning) [2.3s]                                                          │
│   ████████████████████████████████░░░░ 85%                                  │
│                                                                              │
│ ⚡ architect                                                                  │
│   (designing) [0:45 elapsed]                                                │
│   █████████████████░░░░░░░░░░░░░░░░░░░ 45%                                  │
│                                                                              │
│ ○ developer                                                                  │
│   (waiting)                                                                  │
│                                                                              │
│ ⟂ Parallel Execution                                                         │
│ ⟂ tester (testing) [0:12 elapsed]                                           │
│   █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15%                                  │
│ ⟂ reviewer (reviewing) [0:08 elapsed]                                       │
│   ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 10%                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Compact Mode (Narrow Terminals)

Compact mode provides an inline, space-efficient display ideal for status bars and narrow terminals:

```
⚡plan[85%][2.3s] | ⚡arch[45%][0:45] | ○dev | ⟂test,rev+1
```

**Compact Mode Features:**
- Abbreviated agent names (planner → plan, architect → arch, developer → dev)
- Inline percentage progress instead of progress bars
- Parallel agents shown with comma-separated list
- Overflow indicator (+N) for many parallel agents

##### Verbose Mode (Debug Display)

Verbose mode extends full mode with additional debugging information:

```
┌─ Agent Activity (Verbose) ────────────────────────────────────────────────────┐
│                                                                               │
│ ⚡ architect                                                                   │
│   Stage: designing | Elapsed: 0:45                                            │
│   Tokens: 1,234↑ 2,567↓ | Turns: 5 | Errors: 0                               │
│   Last Tool: read_file (src/auth/AuthContext.tsx)                            │
│   ████████████████████████░░░░░░░░░░░░░░░░ 60%                               │
│                                                                               │
│   💭 Thinking:                                                                │
│   "I need to analyze the existing authentication patterns                     │
│    in the codebase before designing the new JWT system..."                   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

##### AgentPanel Component API

```typescript
import { AgentPanel } from '@apexcli/cli/ui/components';

// Basic usage with automatic mode selection
<AgentPanel
  agents={agentStates}
  currentAgent="architect"
/>

// Explicit compact mode
<AgentPanel
  agents={agentStates}
  currentAgent="developer"
  compact={true}
/>

// Full mode with parallel agents
<AgentPanel
  agents={agentStates}
  currentAgent="architect"
  showParallel={true}
  parallelAgents={parallelAgentStates}
  useDetailedParallelView={true}
/>

// Verbose mode with thought display
<AgentPanel
  agents={agentStates}
  currentAgent="developer"
  displayMode="verbose"
  showThoughts={true}
/>
```

**Component Properties:**

```typescript
interface AgentPanelProps {
  agents: AgentInfo[];              // Array of agent state objects
  currentAgent?: string;            // Name of the currently active agent
  compact?: boolean;                // Force compact mode (default: auto)
  showParallel?: boolean;           // Show parallel execution section
  parallelAgents?: AgentInfo[];     // Agents running in parallel
  useDetailedParallelView?: boolean; // Use ParallelExecutionView component
  displayMode?: 'normal' | 'compact' | 'verbose';  // Display mode override
  showThoughts?: boolean;           // Show agent thinking/reasoning
  width?: number;                   // Explicit width override for testing
}

interface AgentInfo {
  name: string;                     // Agent identifier
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;                   // Current workflow stage
  progress?: number;                // Progress percentage (0-100)
  startedAt?: Date;                 // When the agent started working
  debugInfo?: {                     // Verbose mode information
    tokensUsed?: { input: number; output: number };
    stageStartedAt?: Date;
    lastToolCall?: string;
    turnCount?: number;
    errorCount?: number;
    thinking?: string;
  };
}
```

##### Responsive Breakpoint System

AgentPanel automatically adapts to terminal width using a 4-tier breakpoint system:

| Breakpoint | Width | Layout | Features |
|------------|-------|--------|----------|
| **Narrow** | < 60 cols | Compact | No borders, abbreviated names, inline progress |
| **Compact** | 60-79 cols | Compact | No borders, full names, inline progress |
| **Normal** | 80-119 cols | Full | Borders, progress bars (30 chars), stage info |
| **Wide** | 120+ cols | Full | Borders, wide progress bars (40 chars), full details |

```typescript
// Responsive configuration per breakpoint
const RESPONSIVE_CONFIGS = {
  narrow: {
    useCompactLayout: true,
    showBorder: false,
    showTitle: false,
    agentNameMaxLength: 6,
    abbreviateNames: true,
    showProgressBars: false,
    showProgressInline: true,
    maxParallelAgentsVisible: 2,
  },
  compact: {
    useCompactLayout: true,
    showBorder: false,
    agentNameMaxLength: 10,
    showProgressBars: false,
    maxParallelAgentsVisible: 3,
  },
  normal: {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 16,
    showProgressBars: true,
    progressBarWidth: 30,
    maxParallelAgentsVisible: 5,
  },
  wide: {
    useCompactLayout: false,
    showBorder: true,
    agentNameMaxLength: 24,
    progressBarWidth: 40,
    maxParallelAgentsVisible: 10,
    showThoughtsPreview: true,
  },
};
```

#### Handoff Animations

The `HandoffIndicator` component provides animated transitions when work passes from one agent to another. It supports multiple animation styles and automatically adapts to terminal capabilities.

##### Animation Styles

**Basic Style** (ASCII-compatible):
```
planner → architect
planner →→ architect
planner →→→ architect
```

**Enhanced Style** (Default):
```
📋 planner ·→ 🏗️ architect
📋 planner →· 🏗️ architect
📋 planner →→ 🏗️ architect
📋 planner →→· 🏗️ architect
📋 planner →→→ 🏗️ architect
📋 planner →→→· 🏗️ architect
📋 planner ⟶→→ 🏗️ architect
📋 planner ⟹ 🏗️ architect
```

**Sparkle Style** (High-visibility):
```
📋 planner ✦→ 🏗️ architect
📋 planner →✦ 🏗️ architect
📋 planner →→✦ 🏗️ architect
📋 planner ✦→→→ 🏗️ architect
📋 planner →→→✦ 🏗️ architect
📋 planner ✦⟶→→ 🏗️ architect
📋 planner →⟶✦ 🏗️ architect
📋 planner ⟹✦ 🏗️ architect
```

##### Full Mode Handoff Display

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Handoff [1.2s]: 📋 planner →→→ 🏗️ architect                                │
│ ████████████████████████████████████████░░░░░░░░ 80%                          │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Handoff Visual Features:**
- Progress bar showing transition progress (0-100%)
- Elapsed time display
- Color transitions from source agent color → target agent color
- Agent icons with pulsing animation effect
- Border color transitions during handoff

##### Compact Mode Handoff Display

```
| 📋 planner →→→ 🏗️ architect [1.2s]
```

##### Color Transition Phases

The handoff animation includes smooth color transitions:

| Progress | Source Agent | Arrow | Target Agent | Border |
|----------|--------------|-------|--------------|--------|
| 0-30% | Bright | Dim | Faded | Gray |
| 30-50% | Normal | Normal | Dim | White |
| 50-70% | Dim | Normal | Normal | Target color |
| 70-100% | Faded | Bright | Bright | Fading |

##### HandoffIndicator Component API

```typescript
import { HandoffIndicator } from '@apexcli/cli/ui/components/agents';

// Basic handoff display
<HandoffIndicator
  animationState={handoffState}
  agentColors={agentColorMap}
/>

// Compact inline mode
<HandoffIndicator
  animationState={handoffState}
  agentColors={agentColorMap}
  compact={true}
/>

// Full customization
<HandoffIndicator
  animationState={handoffState}
  agentColors={agentColorMap}
  showElapsedTime={true}
  showProgressBar={true}
  showAgentIcons={true}
  arrowStyle="sparkle"
  enableColorTransition={true}
  forceAsciiIcons={false}
/>
```

**Component Properties:**

```typescript
interface HandoffIndicatorProps {
  animationState: HandoffAnimationState;  // From useAgentHandoff hook
  agentColors: Record<string, string>;    // Color mapping for agents
  compact?: boolean;                      // Inline display mode
  showElapsedTime?: boolean;              // Show handoff duration
  showProgressBar?: boolean;              // Show progress bar (full mode)
  showAgentIcons?: boolean;               // Show emoji icons
  agentIcons?: Record<string, string>;    // Custom icon mapping
  arrowStyle?: 'basic' | 'enhanced' | 'sparkle';  // Animation style
  enableColorTransition?: boolean;        // Smooth color transitions
  forceAsciiIcons?: boolean;              // Force ASCII-only icons
}
```

#### Parallel Execution View

The `ParallelExecutionView` component displays multiple agents running concurrently, with responsive column layouts that adapt to terminal width.

##### Grid Layout Examples

**Wide Terminal (4 columns):**
```
┌─ Parallel Execution (4 agents) ──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                      │
│ ╭──────────────────────╮  ╭──────────────────────╮  ╭──────────────────────╮  ╭──────────────────────╮              │
│ │     ⟂ developer      │  │      ⟂ tester        │  │      ⟂ devops        │  │     ⟂ reviewer       │              │
│ │                      │  │                      │  │                      │  │                      │              │
│ │   Stage: coding      │  │   Stage: testing     │  │   Stage: deploying   │  │   Stage: reviewing   │              │
│ │                      │  │                      │  │                      │  │                      │              │
│ │   Runtime: [1:23]    │  │   Runtime: [0:47]    │  │   Runtime: [0:34]    │  │   Runtime: [0:12]    │              │
│ │                      │  │                      │  │                      │  │                      │              │
│ │   ████████░░░░ 65%   │  │   █████░░░░░░ 40%    │  │   ██████░░░░░ 50%    │  │   ███░░░░░░░ 25%     │              │
│ │                      │  │                      │  │                      │  │                      │              │
│ │  Running in Parallel │  │  Running in Parallel │  │  Running in Parallel │  │  Running in Parallel │              │
│ ╰──────────────────────╯  ╰──────────────────────╯  ╰──────────────────────╯  ╰──────────────────────╯              │
│                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Normal Terminal (2 columns):**
```
┌─ Parallel Execution (4 agents) ──────────────────────────────────────────────┐
│                                                                              │
│ ╭────────────────────────╮  ╭────────────────────────╮                      │
│ │      ⟂ developer       │  │       ⟂ tester         │                      │
│ │    Stage: coding       │  │    Stage: testing      │                      │
│ │    Runtime: [1:23]     │  │    Runtime: [0:47]     │                      │
│ │    ████████░░░░ 65%    │  │    █████░░░░░░ 40%     │                      │
│ │   Running in Parallel  │  │   Running in Parallel  │                      │
│ ╰────────────────────────╯  ╰────────────────────────╯                      │
│                                                                              │
│ ╭────────────────────────╮  ╭────────────────────────╮                      │
│ │       ⟂ devops         │  │      ⟂ reviewer        │                      │
│ │    Stage: deploying    │  │    Stage: reviewing    │                      │
│ │    Runtime: [0:34]     │  │    Runtime: [0:12]     │                      │
│ │    ██████░░░░░ 50%     │  │    ███░░░░░░░ 25%      │                      │
│ │   Running in Parallel  │  │   Running in Parallel  │                      │
│ ╰────────────────────────╯  ╰────────────────────────╯                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Narrow Terminal (1 column):**
```
⟂ Parallel Execution (4 agents)

╭──────────────────╮
│   ⟂ developer    │
│      coding      │
│     [1:23]       │
│       65%        │
╰──────────────────╯

╭──────────────────╮
│    ⟂ tester      │
│     testing      │
│     [0:47]       │
│       40%        │
╰──────────────────╯

╭──────────────────╮
│    ⟂ devops      │
│    deploying     │
│     [0:34]       │
│       50%        │
╰──────────────────╯

╭──────────────────╮
│   ⟂ reviewer     │
│    reviewing     │
│     [0:12]       │
│       25%        │
╰──────────────────╯
```

##### ParallelExecutionView Component API

```typescript
import { ParallelExecutionView } from '@apexcli/cli/ui/components/agents';

// Basic parallel view with automatic column calculation
<ParallelExecutionView
  agents={parallelAgents}
/>

// Explicit column control
<ParallelExecutionView
  agents={parallelAgents}
  maxColumns={3}
/>

// Compact card display
<ParallelExecutionView
  agents={parallelAgents}
  compact={true}
/>
```

**Component Properties:**

```typescript
interface ParallelExecutionViewProps {
  agents: ParallelAgent[];     // Array of parallel agent states
  maxColumns?: number;         // Override auto column calculation
  compact?: boolean;           // Use compact card display
}

interface ParallelAgent {
  name: string;
  status: 'parallel' | 'active' | 'completed' | 'waiting' | 'idle';
  stage?: string;
  progress?: number;           // 0-100
  startedAt?: Date;
}
```

##### Responsive Column Calculation

Columns automatically adapt based on terminal width:

| Terminal | Card Width | Columns |
|----------|------------|---------|
| Narrow (< 60) | N/A | 1 (stacked) |
| Compact (60-79) | ~20 chars | 2-3 |
| Normal (80-119) | ~28 chars | 2-4 |
| Wide (120+) | ~28 chars | 4-6 |

#### SubtaskTree Visualization

The `SubtaskTree` component provides an interactive, hierarchical view of task breakdowns with keyboard navigation and collapse/expand functionality.

##### Visual Layout

```
┌─ Task Breakdown ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ ▼ 🏗️ Design authentication system                              ● 0:45       │
│   ├─ ✓ Define JWT token structure                               0.2s        │
│   ├─ ✓ Design login/register flow                               0.8s        │
│   ├─ ● Plan component hierarchy                                 0:12        │
│   │   ├─ ✓ LoginForm component                                  0.1s        │
│   │   ├─ ● AuthContext provider                               ← current     │
│   │   └─ ○ ProtectedRoute wrapper                               pending     │
│   └─ ○ Create API integration plan                              pending     │
│                                                                              │
│ ▶ 🤖 Implement authentication components                        collapsed    │
│ ▶ 🧪 Write tests for auth system                               collapsed    │
│                                                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│ Keyboard: ↑↓ Navigate │ ←→ Collapse/Expand │ Space Toggle │ Enter Details   │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Status Icons and Colors

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| **Pending** | `○` | Gray | Task not yet started |
| **In Progress** | `●` | Blue | Task currently executing |
| **Completed** | `✓` | Green | Task finished successfully |
| **Failed** | `✗` | Red | Task encountered an error |

##### Tree Navigation Icons

| State | Icon | Description |
|-------|------|-------------|
| **Expanded** | `▼` | Node children are visible |
| **Collapsed** | `▶` | Node children are hidden |
| **Leaf** | `├─` / `└─` | Branch connectors |

##### Interactive Features

**Keyboard Navigation:**
- `↑` / `↓` - Move focus between visible nodes
- `←` - Collapse current node (or move to parent)
- `→` - Expand current node (or move to first child)
- `Space` - Toggle collapse/expand state
- `Enter` - Show detailed node information

**Progress Tracking:**
- Real-time elapsed time for in-progress tasks
- Completion time display for finished tasks
- Progress percentage for tasks with known progress

##### SubtaskTree Component API

```typescript
import { SubtaskTree } from '@apexcli/cli/ui/components/agents';

// Basic tree display
<SubtaskTree
  task={rootTask}
/>

// Controlled collapse state
<SubtaskTree
  task={rootTask}
  defaultCollapsed={true}
  initialCollapsedIds={new Set(['node-1', 'node-2'])}
  onToggleCollapse={(nodeId, collapsed) => {
    console.log(`Node ${nodeId} is now ${collapsed ? 'collapsed' : 'expanded'}`);
  }}
/>

// Non-interactive display (read-only)
<SubtaskTree
  task={rootTask}
  interactive={false}
  showProgress={true}
  showElapsedTime={true}
/>

// External focus control
<SubtaskTree
  task={rootTask}
  focusedNodeId={currentFocusId}
  onFocusChange={(nodeId) => setCurrentFocusId(nodeId)}
/>
```

**Component Properties:**

```typescript
interface SubtaskTreeProps {
  task: SubtaskNode;                        // Root task node
  maxDepth?: number;                        // Maximum nesting depth (default: 3)
  defaultCollapsed?: boolean;               // Initial collapsed state
  initialCollapsedIds?: Set<string>;        // Specific nodes to collapse
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;
  showProgress?: boolean;                   // Show progress indicators
  showElapsedTime?: boolean;                // Show elapsed time
  interactive?: boolean;                    // Enable keyboard navigation
  focusedNodeId?: string;                   // External focus control
  onFocusChange?: (nodeId: string | null) => void;
}

interface SubtaskNode {
  id: string;                               // Unique node identifier
  description: string;                      // Task description
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];                 // Nested subtasks
  progress?: number;                        // 0-100 percentage
  startedAt?: Date;                         // For elapsed time calculation
  estimatedDuration?: number;               // Estimated duration in ms
}
```

##### Example Task Structure

```typescript
const taskTree: SubtaskNode = {
  id: 'auth-system',
  description: 'Design authentication system',
  status: 'in-progress',
  startedAt: new Date(),
  progress: 45,
  children: [
    {
      id: 'jwt-structure',
      description: 'Define JWT token structure',
      status: 'completed',
    },
    {
      id: 'login-flow',
      description: 'Design login/register flow',
      status: 'completed',
    },
    {
      id: 'component-hierarchy',
      description: 'Plan component hierarchy',
      status: 'in-progress',
      progress: 60,
      children: [
        { id: 'login-form', description: 'LoginForm component', status: 'completed' },
        { id: 'auth-context', description: 'AuthContext provider', status: 'in-progress' },
        { id: 'protected-route', description: 'ProtectedRoute wrapper', status: 'pending' },
      ],
    },
    {
      id: 'api-integration',
      description: 'Create API integration plan',
      status: 'pending',
    },
  ],
};
```

#### Configuration via .apex/config.yaml

```yaml
# Agent panel visualization configuration
ui:
  agentPanel:
    defaultMode: auto                 # auto, compact, normal, verbose
    showProgressBars: true
    showElapsedTime: true
    showAgentIcons: true

    # Handoff animation settings
    handoff:
      arrowStyle: enhanced            # basic, enhanced, sparkle
      showProgressBar: true
      enableColorTransition: true
      animationDuration: 2000         # ms

    # Parallel execution settings
    parallel:
      maxColumnsOverride: null        # null for auto, or explicit number
      compactCards: false
      showStageInfo: true

    # Subtask tree settings
    subtaskTree:
      maxDepth: 3
      defaultCollapsed: false
      showProgress: true
      showElapsedTime: true
      interactive: true

    # Responsive breakpoints override
    breakpoints:
      narrow: 60
      compact: 80
      normal: 120
```

#### Integration with Orchestrator Events

The AgentPanel system integrates with the APEX orchestrator through event subscriptions:

```typescript
import { useOrchestratorEvents } from '@apexcli/cli/ui/hooks';

function AgentActivityDisplay() {
  const {
    agents,
    currentAgent,
    parallelAgents,
    handoffState,
    subtaskTree,
  } = useOrchestratorEvents(orchestrator);

  return (
    <AgentPanel
      agents={agents}
      currentAgent={currentAgent}
      showParallel={parallelAgents.length > 0}
      parallelAgents={parallelAgents}
      displayMode="normal"
    />
  );
}
```

**Supported Orchestrator Events:**
- `agent:start` - Agent begins execution
- `agent:progress` - Agent progress update
- `agent:complete` - Agent finishes execution
- `agent:handoff` - Control passes between agents
- `parallel:start` - Parallel execution begins
- `parallel:update` - Parallel agent progress
- `parallel:complete` - Parallel execution ends
- `subtask:create` - New subtask created
- `subtask:update` - Subtask status change
- `subtask:complete` - Subtask finished

#### Multi-Agent Visualization Overview

The Multi-Agent Visualization system combines all visualization components to provide a comprehensive view of complex agent orchestration. This holistic approach allows users to understand the complete lifecycle of multi-agent workflows, from initial planning through parallel execution and final completion.

##### Integrated Visualization Components

The system seamlessly integrates multiple visualization elements:

**Agent Panels**: Individual agent status displays with real-time progress tracking
**Handoff Animations**: Smooth transitions showing work passing between agents
**Parallel Execution Views**: Concurrent agent monitoring with resource allocation
**Subtask Trees**: Hierarchical breakdown of complex tasks with dependency tracking

##### Complete Multi-Agent Workflow Example

Here's how all components work together during a typical feature implementation workflow:

```
┌─ APEX Multi-Agent Workflow ──────────────────────────────────────────────────────┐
│                                                                                   │
│ 📋 planner [completed] → 🏗️ architect [completed] → 👨‍💻 developer [active]          │
│ ████████████████████████████████████████████████████████████████████████ 100%    │
│                                                                                   │
│ Current Stage: implementation                                                     │
│ Active Agents: 1 primary + 2 parallel                                           │
│ Total Progress: 67% (4/6 stages complete)                                        │
│                                                                                   │
│ ⚡ Primary Agent: developer                                                       │
│   Stage: implementation [0:15:23 elapsed]                                        │
│   Progress: ███████████████████████████████████████░░░░░░░░░░ 78%                │
│   Subtasks: 3/4 complete                                                         │
│                                                                                   │
│ ⟂ Parallel Execution                                                             │
│ ⟂ tester        [active]    ████████████████████░░░░░░░░░░░░░░░░░░░░ 60%         │
│   Running integration tests on completed modules                                 │
│ ⟂ reviewer      [active]    ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35%         │
│   Code review of authentication implementation                                   │
│                                                                                   │
│ 📊 Subtask Breakdown                                                             │
│ ├─ ✅ Core authentication logic implementation                                    │
│ ├─ ✅ Database schema updates                                                     │
│ ├─ ✅ API endpoint creation                                                       │
│ └─ 🔄 Frontend integration (in progress)                                         │
│     ├─ ✅ Login component updates                                                │
│     ├─ 🔄 Session management integration                                         │
│     └─ ⏳ Error handling implementation                                          │
│                                                                                   │
│ 💡 Use '/thoughts developer' to see current reasoning                            │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

##### Multi-Agent Coordination Patterns

**Sequential Handoffs**: Traditional workflow progression with clear stage boundaries
```
📋 planner ⟹ 🏗️ architect ⟹ 👨‍💻 developer ⟹ 🧪 tester ⟹ 👥 reviewer
```

**Parallel + Sequential**: Mixed execution where some agents work concurrently
```
📋 planner ⟹ 🏗️ architect ⟹ ┌─ 👨‍💻 developer
                              └─ 🧪 tester (parallel) ⟹ 👥 reviewer
```

**Branch & Merge**: Complex workflows with conditional paths
```
📋 planner ⟹ 🏗️ architect ┬─ 👨‍💻 developer (feature)    ┐
                          └─ 🚀 devops (infrastructure) ┴─ 👥 reviewer
```

**Hierarchical Decomposition**: Large tasks broken into parallel sub-workflows
```
📋 planner ⟹ 🏗️ architect ┬─ 👨‍💻 developer-frontend ⟹ 🧪 tester-ui
                          ├─ 👨‍💻 developer-backend  ⟹ 🧪 tester-api
                          └─ 🚀 devops-deploy       ⟹ 👥 reviewer-ops
```

##### Real-Time Status Integration

The multi-agent visualization provides comprehensive real-time updates:

- **Progress Aggregation**: Combined progress from all active agents
- **Resource Monitoring**: Token usage, memory consumption, execution time
- **Dependency Tracking**: Task prerequisites and blocking relationships
- **Error Propagation**: Issues bubble up through the agent hierarchy
- **Performance Metrics**: Throughput, success rates, average completion times

##### Responsive Multi-Agent Layouts

The visualization adapts to different terminal sizes while maintaining information hierarchy:

**Wide Terminals (120+ columns)**:
- Full agent panels with detailed progress bars
- Complete subtask tree visualization
- Inline parallel execution monitoring
- Comprehensive status information

**Normal Terminals (80-119 columns)**:
- Condensed agent panels with abbreviated details
- Collapsed subtask tree (expandable on demand)
- Summary parallel execution view
- Key metrics only

**Narrow Terminals (< 80 columns)**:
- Compact single-line agent status
- Hidden subtask details (accessible via commands)
- Minimal parallel execution indicators
- Essential status only

#### /thoughts Command

The `/thoughts` command provides deep insight into agent reasoning and decision-making processes. This powerful debugging and transparency feature allows users to understand exactly how agents are approaching problems and making decisions.

##### Basic Usage

```bash
# View current thoughts of the active agent
/thoughts

# View thoughts of a specific agent
/thoughts developer

# View thoughts with extended context
/thoughts architect --verbose

# View historical thoughts from a completed stage
/thoughts planner --stage planning --timestamp "5 minutes ago"
```

##### Thought Display Formats

**Standard Format**:
```
💭 developer thoughts [0:15:23 elapsed]:

"I need to implement the authentication middleware before moving on to the
frontend components. The current session management approach won't scale
with the new JWT requirements. Let me first analyze the existing auth flow
to understand the integration points..."

Current focus: session-management-integration
Next planned action: analyze AuthContext.tsx dependencies
```

**Verbose Format**:
```
💭 developer thoughts [detailed] [0:15:23 elapsed]:

🎯 Current Objective:
Implement JWT-based authentication system to replace session cookies

🧠 Analysis:
"The existing authentication uses express-session with memory store. This
won't work for JWT tokens which need to be stateless. I need to:
1. Update the middleware to validate JWTs instead of sessions
2. Modify the frontend to store tokens in localStorage/httpOnly cookies
3. Ensure the refresh token mechanism works with the new flow"

🛠️ Working On:
- File: src/middleware/auth.ts
- Action: Replacing session validation with JWT verification
- Progress: Analyzing token structure and validation logic

⏭️ Next Steps:
1. Update AuthContext.tsx to handle token storage
2. Implement token refresh mechanism
3. Update login/logout API endpoints
4. Test integration with existing components

📊 Context:
- Total files analyzed: 8
- Dependencies identified: 12
- Potential breaking changes: 3
- Estimated remaining time: 8 minutes
```

**Historical Format**:
```
💭 architect thoughts [completed stage] [15 minutes ago]:

"Based on the requirements analysis, I'm designing a hybrid authentication
approach. The system needs to support both session-based auth for legacy
components and JWT for the new API endpoints. This requires careful
consideration of the migration path..."

Stage: architecture → Status: completed → Duration: 12m 34s
Led to: 4 implementation tasks, 2 integration points identified
```

##### Integration with Agent Panels

Thoughts can be displayed inline with agent status for real-time insight:

```
┌─ Agent Activity (with Thoughts) ──────────────────────────────────────────────────┐
│                                                                                    │
│ ⚡ developer                                                                        │
│   Stage: implementation [0:15:23 elapsed]                                         │
│   Progress: ███████████████████████████████████████░░░░░░░░░░ 78%                 │
│                                                                                    │
│   💭 Current Thinking:                                                            │
│   "Analyzing the AuthContext dependencies before implementing JWT                  │
│    validation. The existing useAuth hook needs to support both token              │
│    and session states during the migration period..."                             │
│                                                                                    │
│   Focus: auth-migration-compatibility                                             │
│   Next: Update useAuth hook interface                                             │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

##### Thought Categories and Tagging

The system automatically categorizes thoughts to help with navigation and filtering:

**Analysis**: Understanding existing code and requirements
```
💭 [analysis] "The current authentication system uses three different patterns..."
```

**Planning**: Deciding on implementation approach
```
💭 [planning] "I'll implement this in three phases to minimize breaking changes..."
```

**Implementation**: Active coding and problem-solving
```
💭 [implementation] "The JWT middleware needs to handle both Bearer tokens and cookies..."
```

**Problem-Solving**: Debugging and issue resolution
```
💭 [debugging] "The token validation is failing because the secret key format changed..."
```

**Integration**: Considering how changes affect other components
```
💭 [integration] "This change will require updates to the API client and error handling..."
```

##### Advanced Thought Queries

**Filter by Category**:
```bash
/thoughts --category analysis              # Only analytical thoughts
/thoughts --category planning,implementation # Multiple categories
```

**Time-based Filtering**:
```bash
/thoughts --since "10 minutes ago"         # Recent thoughts only
/thoughts --between "1pm" "2pm"            # Specific time range
```

**Search Thought Content**:
```bash
/thoughts --search "authentication"        # Thoughts containing specific terms
/thoughts --search "JWT.*middleware" --regex # Regex pattern matching
```

**Export and Analysis**:
```bash
/thoughts --export thoughts.json           # Export for analysis
/thoughts --summary                        # AI-generated summary of thought patterns
```

##### Thought Privacy and Filtering

Some thoughts may contain sensitive information or internal reasoning that should be filtered:

**Sensitive Information Filtering**:
- API keys, passwords, and secrets are automatically redacted
- Personal information is masked with placeholders
- Business-sensitive logic can be marked as internal-only

**Verbosity Controls**:
```bash
/thoughts --level basic                    # High-level thoughts only
/thoughts --level detailed                 # Include implementation details
/thoughts --level debug                    # Full internal reasoning
```

##### Real-Time Thought Streaming

For active agents, thoughts can be streamed in real-time:

```bash
/thoughts developer --stream               # Live thought updates
/thoughts --all --stream --compact         # All agents, compact format
```

This provides unprecedented transparency into the AI decision-making process and helps users understand how complex tasks are being approached and solved.

### 5. Status Bar and Information Display

#### StatusBar Component

The StatusBar component provides persistent, real-time information at the bottom of the terminal interface. It features intelligent responsive design with priority-based element visibility that adapts to terminal width and display modes.

> **📋 Complete Documentation**: See the comprehensive [StatusBar Reference](../cli-guide.md#statusbar-reference) for detailed information about all 21 display elements, visual examples, responsive behavior, and mode variations.

**Visual Example (Normal Mode, Wide Terminal):**

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]                                                tokens: 45.2k | cost: $0.1523 | model: sonnet | 05:23 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Persistent Status Bar (Compact Example):**

```
⚡ APEX v0.3.0 | 🌿 main | 🪙 1.2K↑ 3.4K↓ | 💰 $0.12 | ⏱️ 00:04:23
```

**Key Features:**
- **21 Possible Elements** - Connection status, git branch, agent, workflow stage, progress, tokens, costs, timing, and mode indicators
- **Priority System** - CRITICAL (always shown) → HIGH → MEDIUM → LOW priority elements
- **Responsive Design** - Automatically adapts to terminal width (narrow/normal/wide breakpoints)
- **Display Mode Support** - Different element sets for compact, normal, and verbose modes
- **Real-time Updates** - Live session timer, cost tracking, and progress indicators

#### Core Elements

**Left Side:**
- **Connection Status (●/○)** - Live connection indicator (green=connected, red=disconnected)
- **Git Branch (⎇)** - Current branch name with git symbol
- **Agent Indicator (⚡)** - Active AI agent (planner, architect, developer, tester, reviewer)
- **Workflow Stage (▶)** - Current workflow stage (planning, implementation, etc.)
- **Subtask Progress (📋)** - Completion status within current stage [X/Y]

**Right Side:**
- **Session Timer** - Elapsed time in MM:SS format
- **Model Indicator** - Active AI model (opus, sonnet, haiku)
- **Cost Display** - Current task cost with 4-decimal precision
- **Token Count** - Total tokens with smart formatting (1.2k, 1.5M)

**Verbose Mode Additions:**
- **Detailed Timing** - Active, idle, and stage-specific time tracking
- **Token Breakdown** - Input→output token breakdown plus total
- **Session Costs** - Cumulative session cost tracking
- **Server URLs** - API and Web UI port information
- **Mode Indicators** - Visual indicators for preview, thoughts, and verbose modes

#### Responsive Adaptation

The StatusBar uses a sophisticated 3-tier responsive system:

| Terminal Width | Display Tier | Elements Shown | Behavior |
|----------------|--------------|----------------|----------|
| < 60 columns | Narrow | CRITICAL + HIGH priority | Abbreviated labels, compressed values |
| 60-160 columns | Normal | CRITICAL + HIGH + MEDIUM | Full labels, standard formatting |
| > 160 columns | Wide | All priority levels | Extended details, verbose elements |

**Smart Abbreviations:**
- Labels automatically shorten in narrow terminals
- `tokens:` becomes `tk:` in narrow terminals
- `model:` becomes `mod:` when space is limited
- Branch names truncated with `...` when too long
- Labels hidden entirely when space is critical (cost shows just `$0.1523`)

#### Display Mode Behavior

**Compact Mode** - Essential information only:
```
● main | $0.1523
```

**Normal Mode** - Balanced information display:
```
● ⎇ main | ⚡developer | tokens: 1.2k | cost: $0.1523 | model: sonnet | 05:23
```

**Verbose Mode** - Maximum information:
```
● main | ⚡dev | ▶impl | 📋 [2/5] | 💾 session | api:3000 | web:3001    tokens: 12.5k→8.2k | total: 20.7k | cost: $0.15 | session: $1.25 | model: sonnet | active: 3m42s | idle: 1m18s | stage: 45s | 🔍 VERBOSE
```

### 6. Natural Language Interface

#### Smart Intent Detection

APEX automatically detects whether user input is a command or natural language task:

```
apex> /help
┌─ Available Commands ─────────────────────────────────────────────────────────┐
│ /help (h, ?)            Show available commands                              │
│ /status (s)             Show task status                                     │
│ /agents (a)             List available agents                                │
│ ...                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘

apex> Add user authentication to my React app
🤖 I'll help you add user authentication to your React app. Let me start by analyzing your codebase...

┌─ Task Analysis ──────────────────────────────────────────────────────────────┐
│ 📋 planner ● analyzing...                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ I can see you have a React application with TypeScript.                     │
│ I'll implement JWT-based authentication with:                               │
│                                                                              │
│ • Login and registration forms                                               │
│ • JWT token management                                                       │
│ • Protected route wrapper                                                    │
│ • User context provider                                                      │
│                                                                              │
│ This will involve creating several components and                            │
│ setting up authentication state management▊                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Conversational Context

APEX maintains context across interactions:

```
apex> Add user authentication

🤖 I'll implement user authentication for you.

apex> Make sure it uses JWT tokens

🤖 Absolutely! I'll use JWT tokens for the authentication system. This provides stateless authentication that's perfect for React applications.

apex> Can you also add password reset functionality?

🤖 Great idea! I'll include password reset functionality along with the JWT authentication. This will require:
- Reset password request flow
- Email token verification
- New password setup form
- Integration with your existing auth system
```

#### Intent Detection Examples

APEX uses sophisticated natural language processing to distinguish between three primary input types:

##### Commands vs Tasks vs Questions

**Commands** are recognized by explicit prefixes and trigger system functions:

```
apex> /help                    # System command - shows help menu
apex> /status                  # System command - displays current task status
apex> /agents                  # System command - lists available agents

🔍 Intent: command
📊 Confidence: 100%
⚡ Action: Execute system function immediately
```

**Tasks** are natural language requests that require agent execution:

```
apex> Add user authentication to my React app

🔍 Intent: task
📊 Confidence: 95%
🤖 Agent Assignment: architect → planner → developer
⚡ Action: Create task execution workflow

apex> Refactor this component to use hooks

🔍 Intent: task
📊 Confidence: 88%
🤖 Agent Assignment: developer
⚡ Action: Code refactoring workflow

apex> Create unit tests for the login functionality

🔍 Intent: task
📊 Confidence: 92%
🤖 Agent Assignment: tester → developer
⚡ Action: Test generation workflow
```

**Questions** seek information without requiring code changes:

```
apex> What does this function do?

🔍 Intent: question
📊 Confidence: 91%
🤖 Agent Assignment: None (direct analysis)
⚡ Action: Code explanation response

apex> How do I configure JWT tokens?

🔍 Intent: question
📊 Confidence: 89%
🤖 Agent Assignment: None (guidance response)
⚡ Action: Documentation/guidance response

apex> What's the difference between useState and useReducer?

🔍 Intent: question
📊 Confidence: 94%
🤖 Agent Assignment: None (educational response)
⚡ Action: Conceptual explanation
```

##### Ambiguous Input Handling

When intent is unclear, APEX engages in clarification flows:

```
apex> Fix the bug

🔍 Intent: task (uncertain)
📊 Confidence: 45%
⚠️ Clarification needed

🤖 I need more details to help you effectively:

┌─ Clarification Required ─────────────────────────────────────────────────┐
│                                                                           │
│ 🔍 What bug would you like me to fix?                                    │
│                                                                           │
│ To provide the best assistance, could you specify:                       │
│ • Which component or file has the issue?                                 │
│ • What behavior are you seeing vs what you expected?                     │
│ • Any error messages or console logs?                                    │
│                                                                           │
│ Examples:                                                                 │
│ • "Fix the login form validation error"                                  │
│ • "The shopping cart isn't updating quantities correctly"                │
│ • "Handle the 404 error in the user profile page"                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

apex> Fix the login form validation error

🔍 Intent: task (clarified)
📊 Confidence: 94%
🤖 Agent Assignment: developer
⚡ Action: Bug fix workflow initiated
```

##### Contextual Suggestions

APEX provides intelligent suggestions based on project context:

```
apex> add auth

🔍 Analyzing project context...
📁 Detected: React + TypeScript project
🔧 Dependencies: @auth0/auth0-react found

💡 Contextual Suggestions:

┌─ Intent Suggestions ─────────────────────────────────────────────────────┐
│                                                                           │
│ Based on your project, you might want to:                               │
│                                                                           │
│ 🔐 Authentication Features:                                              │
│   → "Add Auth0 login integration"                                        │
│   → "Create protected routes with authentication"                        │
│   → "Add logout functionality to the navigation"                         │
│                                                                           │
│ 🛡️ Authorization Features:                                               │
│   → "Add role-based access control"                                     │
│   → "Create admin dashboard with auth guards"                           │
│                                                                           │
│ 🔧 Configuration:                                                        │
│   → "Configure Auth0 environment variables"                             │
│   → "Set up Auth0 callback URLs"                                        │
│                                                                           │
│ Type your selection or provide more specific details...                  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

#### Advanced Intent Recognition

##### Multi-step Task Detection

APEX recognizes complex, multi-step requests:

```
apex> Create a blog system with posts, comments, and user profiles

🔍 Intent: complex_task
📊 Confidence: 89%
🏗️ Multi-step workflow detected

┌─ Task Breakdown ─────────────────────────────────────────────────────────┐
│                                                                           │
│ 📋 Detected Components:                                                  │
│                                                                           │
│ 1️⃣ Blog Posts System                                                     │
│    • Post creation/editing interface                                     │
│    • Post listing and pagination                                         │
│    • Rich text editor integration                                        │
│                                                                           │
│ 2️⃣ Comments System                                                       │
│    • Comment threads and replies                                         │
│    • Comment moderation features                                         │
│    • Real-time comment updates                                           │
│                                                                           │
│ 3️⃣ User Profiles                                                         │
│    • User profile pages                                                  │
│    • Profile editing capabilities                                        │
│    • User avatar management                                              │
│                                                                           │
│ 🤖 Suggested Execution Order:                                            │
│    architect → planner → developer → tester → reviewer                  │
│                                                                           │
│ ⏱️ Estimated Duration: 2-3 hours                                         │
│                                                                           │
│ Proceed with this breakdown? (y/n)                                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

##### Context-Aware Modifications

APEX understands references to previous work:

```
apex> Make the authentication more secure

🔍 Intent: task (context-dependent)
📊 Confidence: 82%
🧠 Context Analysis: Previous authentication task found

┌─ Context-Aware Enhancement ─────────────────────────────────────────────┐
│                                                                           │
│ 🔍 Found previous work: JWT Authentication System                        │
│ 📅 Implemented: 2 hours ago                                             │
│                                                                           │
│ 🛡️ Security Enhancement Options:                                         │
│                                                                           │
│ • Add refresh token rotation                                             │
│ • Implement rate limiting on auth endpoints                              │
│ • Add two-factor authentication (2FA)                                    │
│ • Enhance password strength requirements                                 │
│ • Add session timeout management                                         │
│ • Implement suspicious login detection                                   │
│                                                                           │
│ Would you like me to implement all security enhancements                │
│ or focus on specific areas?                                              │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

#### Natural Language Command Patterns

##### Imperative Commands

```
apex> Create a new component called UserProfile
apex> Delete the old authentication code
apex> Refactor the shopping cart logic
apex> Test the login functionality
apex> Deploy the application to production
```

##### Descriptive Requests

```
apex> I need a way for users to reset their passwords
apex> The search functionality should be faster
apex> Users want to be able to save their favorite items
apex> The mobile layout needs improvement
```

##### Problem-Oriented Input

```
apex> The app crashes when users try to checkout
apex> Load times are too slow on the product page
apex> Users can't find the logout button
apex> The form validation isn't working correctly
```

##### Exploratory Questions

```
apex> How can I improve the performance of this component?
apex> What's the best way to handle user authentication?
apex> Should I use Redux or Context for state management?
apex> How do I deploy this React app to AWS?
```

#### Confidence-Based Execution Flow

APEX adjusts its behavior based on intent detection confidence:

```
High Confidence (90-100%):
┌─ Auto-Execute ───────────────────────────────────────────────────────────┐
│ ⚡ Executing immediately...                                               │
│ 🤖 Task: Add user authentication                                         │
│ 📊 Confidence: 95%                                                       │
└───────────────────────────────────────────────────────────────────────────┘

Medium Confidence (70-89%):
┌─ Confirmation Requested ─────────────────────────────────────────────────┐
│ 🤖 I'll help you add user authentication.                               │
│ 📊 Confidence: 82%                                                       │
│                                                                           │
│ Proceed with JWT-based authentication? (y/n)                            │
│ Or provide more specific requirements...                                 │
└───────────────────────────────────────────────────────────────────────────┘

Low Confidence (0-69%):
┌─ Clarification Required ─────────────────────────────────────────────────┐
│ 🤔 I'm not sure what you'd like me to do.                               │
│ 📊 Confidence: 45%                                                       │
│                                                                           │
│ Could you provide more details or try one of these formats:             │
│ • "Create a [specific component] for [purpose]"                         │
│ • "Fix [specific issue] in [file/component]"                           │
│ • "Add [feature] to [existing component]"                               │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7. Enhanced Input Experience

APEX provides a sophisticated input system that enhances developer productivity through intelligent completion, command history, multi-line support, and advanced editing capabilities. All features work seamlessly together to create a powerful command-line experience.

#### Advanced Input with Preview

Advanced Input with Preview brings together intent detection, inline suggestions, and preview cards as documented in the Input Preview Guide, and is described above in the natural language interface section.

#### 7.1 Tab Completion with Fuzzy Search

**How to Use**: Press `Tab` to trigger intelligent completion. Continue typing to refine matches.

The completion engine provides context-aware suggestions for commands, file paths, agent names, and workflow names using fuzzy search algorithms.

```
apex> /st[TAB]
┌─ Suggestions ────────────────────────────────────────────────────────────────┐
│ ● /status        Show task status                                            │
│   /start         Start a new workflow                                        │
│   /stop          Stop current task                                           │
└── Tab: Accept • ↑↓: Navigate • Escape: Dismiss ─────────────────────────────────┘

apex> create react comp[TAB]
┌─ Natural Language Completions ──────────────────────────────────────────────┐
│ ● create react component     Create a new React component                    │
│   create react context       Create a React context provider                 │
│   create react hook          Create a custom React hook                      │
│   create react app          Initialize a new React application               │
└── Tab: Accept • ↑↓: Navigate • Escape: Dismiss ─────────────────────────────────┘

apex> src/components/User[TAB]
┌─ File Path Completions ─────────────────────────────────────────────────────┐
│ ● src/components/UserProfile.tsx                                            │
│   src/components/UserSettings.tsx                                           │
│   src/components/UserList.tsx                                               │
└── Tab: Accept • ↑↓: Navigate • Escape: Dismiss ─────────────────────────────────┘
```

**Features:**
• **Command completion** - All CLI commands (`/status`, `/help`, `/run`, etc.)
• **File path completion** - Intelligent file system navigation with glob pattern support
• **Agent name completion** - Available agents from your `.apex/agents/` directory
• **Workflow name completion** - Available workflows from `.apex/workflows/`
• **Natural language completion** - Common development phrases and patterns
• **Fuzzy matching** - Find matches even with typos or partial input
• **Real-time filtering** - Results update as you type

#### 7.2 History Navigation

**How to Use**: Press `↑`/`↓` arrows or `Ctrl+P`/`Ctrl+N` to navigate command history.

Navigate through your command history with arrow keys. History persists across APEX sessions and is stored in your project's `.apex/` directory.

```
# Start with empty prompt
apex> █

# Press ↑ to navigate back through history
apex> Add user authentication to my React app█

# Press ↑ again for earlier commands
apex> Create a login form component█

# Press ↓ to move forward in history
apex> Add user authentication to my React app█

# Press ↓ again to return to empty prompt
apex> █
```

**Features:**
• **Persistent history** - Commands saved across sessions in `.apex/history.log`
• **Bidirectional navigation** - Move forward and backward through history
• **Alternative shortcuts** - `Ctrl+P` (previous) and `Ctrl+N` (next) work like arrow keys
• **History filtering** - Only successful commands are saved to history
• **Session-aware** - History includes context from the current project

**Tips:**
• History is stored per project in the `.apex/` directory
• Use `Ctrl+R` for searching large command histories
• Clear history by deleting `.apex/history.log`

#### 7.3 History Search (Ctrl+R)

**How to Use**: Press `Ctrl+R` to enter reverse incremental search mode.

Search through command history using fuzzy matching. Especially useful for finding commands in large history files.

```
# Press Ctrl+R to start history search
┌─ History Search Mode ────────────────────────────────────────────────────────┐
│ (reverse-i-search)`█`: _                                                    │
│                                                                              │
│ Type to search command history...                                            │
│ ↑↓: Navigate matches • Enter: Accept • Escape: Cancel • Continue typing     │
└──────────────────────────────────────────────────────────────────────────────┘

# Type "auth" to search for authentication-related commands
┌─ History Search Mode ────────────────────────────────────────────────────────┐
│ (reverse-i-search)`auth`: Add user authentication to my React app           │
│                                                                              │
│ Matches: 5 commands containing "auth"                                        │
│ ↑↓: Navigate matches • Enter: Accept • Escape: Cancel • Continue typing     │
└──────────────────────────────────────────────────────────────────────────────┘

# Use ↑↓ to cycle through matches
┌─ History Search Mode ────────────────────────────────────────────────────────┐
│ (reverse-i-search)`auth`: Create OAuth integration with Google              │
│                                                                              │
│ Matches: 5 commands containing "auth" • Match 2 of 5                        │
│ ↑↓: Navigate matches • Enter: Accept • Escape: Cancel • Continue typing     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
• **Incremental search** - Results update as you type each character
• **Fuzzy matching** - Find commands even with partial or approximate input
• **Match highlighting** - Search term highlighted in results
• **Multiple matches** - Navigate through all matching commands with `↑`/`↓`
• **Match counter** - Shows current match position (e.g., "Match 2 of 5")
• **Cancel anytime** - Press `Escape` to exit without selecting

**Advanced Usage:**
• Continue typing to refine search further
• Use `Backspace` to modify search term
• Press `Enter` to accept current match and return to normal input mode

#### 7.4 Multi-line Input (Shift+Enter)

**How to Use**: Press `Shift+Enter` to add a new line instead of submitting.

Create multi-line commands for complex natural language requests, code snippets, or detailed specifications.

```
# Single-line input (normal mode)
apex> Create a user authentication system█

# Press Shift+Enter to enter multi-line mode
┌─ Multi-line Input ───────────────────────────────────────────────────────────┐
│ 📝 Line 1 of 3 • Shift+Enter: New line • Enter: Submit                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Create a user authentication system                                          │
│ with the following requirements:                                             │
│ █                                                                            │
│                                                                              │
└─ Enter to submit all lines • Ctrl+C to cancel ─────────────────────────────────┘

# Continue adding lines with Shift+Enter
┌─ Multi-line Input ───────────────────────────────────────────────────────────┐
│ 📝 Line 3 of 5 • Shift+Enter: New line • Enter: Submit                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Create a user authentication system                                          │
│ with the following requirements:                                             │
│ - JWT-based authentication                                                   │
│ - Login/logout functionality                                                 │
│ - Password reset capability█                                                 │
└─ Enter to submit all lines • Ctrl+C to cancel ─────────────────────────────────┘
```

**Features:**
• **Line indicator** - Shows current line number and total lines
• **Visual mode indicator** - Clear UI showing multi-line mode is active
• **Flexible entry/exit** - Enter multi-line mode anytime during typing
• **Normal editing** - All cursor movement and editing shortcuts work within lines
• **Complete submission** - Press `Enter` to submit entire multi-line content as one command

**Best Practices:**
• Use for complex feature requests that need detailed specifications
• Perfect for providing multiple requirements or constraints
• Ideal for pasting code snippets or configuration examples
• Great for step-by-step instructions or detailed user stories

#### 7.5 Inline Editing

**How to Use**: Use arrow keys and editing shortcuts for precise text manipulation.

Full cursor-based editing with word-level operations and line navigation shortcuts commonly found in terminal applications.

```
# Initial input with cursor
apex> Create user authentication system█

# Use ← to move cursor for editing
apex> Create user █authentication system

# Use Ctrl+W to delete the previous word
apex> Create user █system

# Use Ctrl+A to jump to beginning of line
apex> █Create user system

# Use Ctrl+E to jump to end of line
apex> Create user system█

# Use Backspace for character-by-character deletion
apex> Create user syste█
```

**Cursor Movement:**
• `←`/`→` - Move cursor one character left/right
• `Ctrl+A` - Jump to beginning of line
• `Ctrl+E` - Jump to end of line

**Text Deletion:**
• `Backspace` - Delete character before cursor
• `Delete` - Delete character at cursor position
• `Ctrl+U` - Clear entire line (keep cursor position)
• `Ctrl+W` - Delete previous word
• `Ctrl+L` - Clear screen but preserve current input

**Text Input:**
• **Insert mode** - Characters inserted at cursor position (default)
• **Character replacement** - Existing text shifts right as you type
• **Undo support** - Use standard terminal undo where available

```
# Example: Editing a command in the middle
┌─ Before Editing ─────────────────────────────────────────────────────────────┐
│ apex> Create user authentication system for my React app█                   │
└──────────────────────────────────────────────────────────────────────────────┘

# Move cursor and edit (press ← to position cursor)
┌─ During Editing ─────────────────────────────────────────────────────────────┐
│ apex> Create user authentication █system for my React app                   │
└──────────────────────────────────────────────────────────────────────────────┘

# Type "and authorization "
┌─ After Editing ──────────────────────────────────────────────────────────────┐
│ apex> Create user authentication and authorization system for my React app█ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 7.6 Input Preview

**How to Use**: Input preview is automatically enabled for natural language commands.

APEX automatically analyzes your input and provides preview information about how the command will be interpreted. For detailed preview capabilities, see the comprehensive [Input Preview Guide](../user-guide/input-preview.md).

```
┌─ Input Preview ──────────────────────────────────────────────────────────────┐
│ apex> Add a shopping cart feature with checkout functionality█              │
│                                                                              │
│ 💡 Preview: Natural language task • Confidence: 92%                         │
│ 📋 Will create: E-commerce component with cart and payment processing       │
│ ⚡ Estimated: 15-20 minutes • 5-8 files                                     │
│                                                                              │
│ Press Enter to execute • Ctrl+C to cancel                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
• **Automatic detection** - No setup required, works for natural language
• **Confidence scoring** - Shows how well APEX understands your request
• **Scope preview** - Estimates files affected and time required
• **Task categorization** - Identifies request type (feature, bug fix, refactor, etc.)

#### Input Keyboard Shortcuts Summary

Complete reference for all input-related keyboard shortcuts:

| Category | Shortcut | Action | Description |
|----------|----------|--------|-------------|
| **Navigation** | | | |
| | `↑` or `Ctrl+P` | Previous history | Navigate to previous command in history |
| | `↓` or `Ctrl+N` | Next history | Navigate to next command in history |
| | `Ctrl+R` | Search history | Enter reverse incremental search mode |
| | `←` | Move cursor left | Move cursor one character left |
| | `→` | Move cursor right | Move cursor one character right |
| | `Ctrl+A` | Beginning of line | Jump cursor to start of current line |
| | `Ctrl+E` | End of line | Jump cursor to end of current line |
| **Editing** | | | |
| | `Backspace` | Delete previous | Delete character before cursor |
| | `Delete` | Delete current | Delete character at cursor position |
| | `Ctrl+U` | Clear line | Clear entire input line |
| | `Ctrl+W` | Delete word | Delete previous word |
| | `Ctrl+L` | Clear screen | Clear terminal screen, preserve input |
| **Completion** | | | |
| | `Tab` | Complete/cycle | Accept suggestion or cycle through options |
| | `Escape` | Dismiss suggestions | Close completion popup |
| **Multi-line** | | | |
| | `Shift+Enter` | New line | Insert line break (enter multi-line mode) |
| | `Enter` | Submit | Submit single-line or complete multi-line input |
| **Control** | | | |
| | `Ctrl+C` | Cancel operation | Cancel current command or exit mode |
| | `Ctrl+D` | Exit APEX | Exit the APEX application |

**Context Notes:**
• Most shortcuts work in `input` context when typing commands
• `Ctrl+L` and `Ctrl+D` work globally across the application
• `Escape` works in `suggestions` context when completion popup is visible
• Multi-line shortcuts only apply when multi-line mode is enabled

### 8. Progress Indicators and Feedback

#### Animated Progress Indicators

```
┌─ Task Progress ──────────────────────────────────────────────────────────────┐
│                                                                              │
│ 🔄 Analyzing codebase...                                                     │
│ ████████████████████▌                     │ 82% │ 2.4s elapsed              │
│                                                                              │
│ Current: Scanning component files...                                         │
│ Found: 23 components, 12 hooks, 8 contexts                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ File Operations ────────────────────────────────────────────────────────────┐
│                                                                              │
│ 📝 Creating authentication components...                                     │
│                                                                              │
│ ✓ src/components/LoginForm.tsx                                               │
│ ✓ src/components/RegisterForm.tsx                                            │
│ ✓ src/contexts/AuthContext.tsx                                              │
│ 🔄 src/components/ProtectedRoute.tsx                                         │
│ ⏸ src/hooks/useAuth.ts                                                       │
│ ⏸ src/utils/auth.ts                                                          │
│                                                                              │
│ Progress: ████████████████▌          │ 67% │ 4/6 files                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Success Celebration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        🎉✨ SUCCESS! ✨🎉                                      │
│                                                                              │
│              Authentication System Implemented!                              │
│                                                                              │
│                    ⚡ 6 files created                                        │
│                    🧪 12 tests written                                       │
│                    📝 Documentation updated                                  │
│                    ⏱️  Completed in 4m 23s                                   │
│                                                                              │
│    🌟 Your React app now has secure JWT authentication! 🌟                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Error Display with Context

```
┌─ Error ──────────────────────────────────────────────────────────────────────┐
│ ❌ Authentication Implementation Failed                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Issue: Missing dependency 'jsonwebtoken'                                     │
│                                                                              │
│ Context:                                                                     │
│ • Trying to create JWT utilities                                             │
│ • Package not found in node_modules                                          │
│ • Required for token generation/verification                                 │
│                                                                              │
│ Suggested Actions:                                                           │
│ 1. Run: npm install jsonwebtoken @types/jsonwebtoken                        │
│ 2. Or: yarn add jsonwebtoken @types/jsonwebtoken                            │
│ 3. Then retry the authentication setup                                       │
│                                                                              │
│ Would you like me to install these dependencies? (y/N)                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9. Session Management

#### Session Persistence and Navigation

```
apex> /sessions
┌─ Session History ────────────────────────────────────────────────────────────┐
│                                                                              │
│ 📍 Current Session                                                           │
│    └─ auth-implementation-2024-12-17                                         │
│       • Started: 2024-12-17 14:23:15                                        │
│       • Duration: 23m 45s                                                    │
│       • Tasks: 3 completed, 1 in progress                                   │
│       • Cost: $1.47                                                          │
│                                                                              │
│ 📚 Recent Sessions                                                           │
│ 1. shopping-cart-feature-2024-12-16      │ 45m 12s │ $2.34 │ ✓ Complete     │
│ 2. navbar-redesign-2024-12-15            │ 12m 08s │ $0.89 │ ✓ Complete     │
│ 3. database-optimization-2024-12-14      │ 67m 33s │ $3.21 │ ✓ Complete     │
│                                                                              │
│ Commands: /load <name> | /export <name> | /branch <name>                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Session Export

```
apex> /export auth-session-summary
┌─ Session Export ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ 📄 Exporting session to formats...                                          │
│                                                                              │
│ ✓ auth-session-summary.md           │ Markdown with full conversation        │
│ ✓ auth-session-summary.json         │ Structured data with metadata         │
│ ✓ auth-session-summary.html         │ Rich HTML with syntax highlighting    │
│                                                                              │
│ 💾 Files saved to: ./apex-exports/2024-12-17/                               │
│                                                                              │
│ Contents include:                                                            │
│ • Full conversation history                                                  │
│ • All code changes with diffs                                               │
│ • Agent reasoning and decisions                                              │
│ • Cost and token usage metrics                                              │
│ • Timeline and duration data                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10. Keyboard Shortcuts

#### Full Shortcut System

```
┌─ Keyboard Shortcuts ─────────────────────────────────────────────────────────┐
│                                                                              │
│ Navigation & Control                                                         │
│ • Ctrl+C         Cancel current operation                                    │
│ • Ctrl+D         Exit APEX                                                   │
│ • Ctrl+L         Clear screen                                                │
│ • Ctrl+R         Search command history                                      │
│ • ↑/↓            Navigate command history                                    │
│                                                                              │
│ Input & Editing                                                              │
│ • Tab            Complete suggestion                                         │
│ • Shift+Enter    Multi-line input                                            │
│ • Ctrl+U         Clear current line                                          │
│ • Ctrl+W         Delete previous word                                        │
│ • Ctrl+A/E       Beginning/end of line                                       │
│                                                                              │
│ Agent Panel                                                                  │
│ • Space          Expand/collapse subtasks                                    │
│ • ←/→            Navigate agent handoffs                                     │
│ • Enter          Show agent details                                          │
│                                                                              │
│ Session Management                                                           │
│ • Ctrl+S         Save current session                                        │
│ • Ctrl+O         Open session browser                                        │
│ • Ctrl+B         Branch current session                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11. Syntax Highlighting and Code Display

APEX v0.3.0 provides comprehensive syntax highlighting support for code blocks displayed in the terminal. The syntax highlighting engine automatically detects languages and applies appropriate coloring to enhance code readability.

#### Supported Languages

APEX supports syntax highlighting for a wide variety of programming languages and configuration formats:

| Category | Languages |
|----------|-----------|
| **Web Development** | TypeScript, JavaScript, JSX, TSX, HTML, CSS, SCSS |
| **Backend** | Python, Go, Rust, Java, C, C++, C# |
| **Configuration** | JSON, YAML, TOML, INI, ENV |
| **Shell & Scripting** | Bash, Shell, PowerShell, Zsh |
| **Data & Markup** | Markdown, XML, SQL, GraphQL |
| **Other** | Dockerfile, Makefile, Diff, Regex |

#### Language-Specific Examples

##### TypeScript / JavaScript

```
┌─ Generated Code: AuthService.ts ─────────────────────────────────────────────┐
│                                                                              │
│ import { sign, verify } from 'jsonwebtoken';                                │
│                                                                              │
│ interface TokenPayload {                                                     │
│   userId: string;                                                            │
│   email: string;                                                             │
│   role: 'admin' | 'user';                                                   │
│ }                                                                            │
│                                                                              │
│ export class AuthService {                                                   │
│   private readonly secret: string;                                          │
│                                                                              │
│   constructor(secret: string) {                                             │
│     this.secret = secret;                                                   │
│   }                                                                          │
│                                                                              │
│   generateToken(payload: TokenPayload): string {                            │
│     return sign(payload, this.secret, { expiresIn: '24h' });               │
│   }                                                                          │
│                                                                              │
│   verifyToken(token: string): TokenPayload | null {                         │
│     try {                                                                    │
│       return verify(token, this.secret) as TokenPayload;                    │
│     } catch {                                                                │
│       return null;                                                           │
│     }                                                                        │
│   }                                                                          │
│ }                                                                            │
│                                                                              │
│ [TypeScript • Keywords: blue, Types: cyan, Strings: green, Comments: gray]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Python

```
┌─ Generated Code: data_processor.py ──────────────────────────────────────────┐
│                                                                              │
│ from typing import List, Dict, Optional                                      │
│ from dataclasses import dataclass                                            │
│ import asyncio                                                               │
│                                                                              │
│ @dataclass                                                                   │
│ class ProcessingResult:                                                      │
│     """Result of data processing operation."""                               │
│     success: bool                                                            │
│     data: Optional[Dict] = None                                              │
│     error: Optional[str] = None                                              │
│                                                                              │
│ async def process_batch(items: List[str]) -> List[ProcessingResult]:        │
│     """Process a batch of items asynchronously."""                           │
│     tasks = [process_item(item) for item in items]                          │
│     results = await asyncio.gather(*tasks, return_exceptions=True)          │
│                                                                              │
│     return [                                                                 │
│         ProcessingResult(success=True, data=r) if not isinstance(r, Exception) │
│         else ProcessingResult(success=False, error=str(r))                  │
│         for r in results                                                     │
│     ]                                                                        │
│                                                                              │
│ [Python • Keywords: magenta, Decorators: yellow, Docstrings: green]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### JSON

```
┌─ Configuration: package.json ────────────────────────────────────────────────┐
│                                                                              │
│ {                                                                            │
│   "name": "@apexcli/cli",                                                       │
│   "version": "0.3.0",                                                        │
│   "description": "APEX Command Line Interface",                              │
│   "main": "dist/index.js",                                                   │
│   "scripts": {                                                               │
│     "build": "tsc",                                                          │
│     "dev": "tsc --watch",                                                    │
│     "test": "vitest run",                                                    │
│     "lint": "eslint src/"                                                    │
│   },                                                                         │
│   "dependencies": {                                                          │
│     "ink": "^4.4.1",                                                         │
│     "react": "^18.2.0",                                                      │
│     "chalk": "^5.3.0"                                                        │
│   },                                                                         │
│   "devDependencies": {                                                       │
│     "typescript": "^5.3.0",                                                  │
│     "@types/node": "^20.10.0"                                               │
│   }                                                                          │
│ }                                                                            │
│                                                                              │
│ [JSON • Keys: cyan, Strings: green, Numbers: yellow, Braces: white]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### YAML

```
┌─ Configuration: .apex/config.yaml ───────────────────────────────────────────┐
│                                                                              │
│ # APEX Project Configuration                                                 │
│ project:                                                                     │
│   name: my-application                                                       │
│   version: 1.0.0                                                             │
│                                                                              │
│ agents:                                                                      │
│   planner:                                                                   │
│     enabled: true                                                            │
│     model: claude-sonnet-4-20250514                                                 │
│     maxTokens: 4096                                                          │
│                                                                              │
│   developer:                                                                 │
│     enabled: true                                                            │
│     model: claude-sonnet-4-20250514                                                 │
│     tools:                                                                   │
│       - read_file                                                            │
│       - write_file                                                           │
│       - execute_command                                                      │
│                                                                              │
│ limits:                                                                      │
│   maxConcurrentTasks: 5                                                      │
│   costLimit: 10.00  # USD per session                                       │
│   tokenLimit: 100000                                                         │
│                                                                              │
│ [YAML • Keys: cyan, Values: white, Comments: gray, Booleans: yellow]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Bash / Shell

```
┌─ Script: deploy.sh ──────────────────────────────────────────────────────────┐
│                                                                              │
│ #!/bin/bash                                                                  │
│ set -euo pipefail                                                            │
│                                                                              │
│ # Configuration                                                              │
│ DEPLOY_ENV="${1:-production}"                                               │
│ BUILD_DIR="./dist"                                                           │
│ REMOTE_HOST="deploy@example.com"                                            │
│                                                                              │
│ echo "🚀 Deploying to ${DEPLOY_ENV}..."                                     │
│                                                                              │
│ # Build the project                                                          │
│ npm run build                                                                │
│                                                                              │
│ # Run tests before deployment                                                │
│ if [[ "$DEPLOY_ENV" == "production" ]]; then                                │
│     npm run test:e2e                                                         │
│ fi                                                                           │
│                                                                              │
│ # Deploy to remote server                                                    │
│ rsync -avz --delete "$BUILD_DIR/" "$REMOTE_HOST:/var/www/app/"              │
│                                                                              │
│ echo "✅ Deployment complete!"                                               │
│                                                                              │
│ [Bash • Commands: green, Variables: cyan, Strings: yellow, Comments: gray]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### SQL

```
┌─ Query: get_user_analytics.sql ──────────────────────────────────────────────┐
│                                                                              │
│ -- Get user activity analytics for the past 30 days                         │
│ SELECT                                                                       │
│     u.id,                                                                    │
│     u.email,                                                                 │
│     COUNT(DISTINCT s.id) AS session_count,                                  │
│     SUM(s.duration_seconds) / 3600.0 AS total_hours,                        │
│     AVG(s.actions_count) AS avg_actions_per_session                         │
│ FROM users u                                                                 │
│ LEFT JOIN sessions s ON s.user_id = u.id                                    │
│     AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'                   │
│ WHERE u.is_active = TRUE                                                     │
│ GROUP BY u.id, u.email                                                       │
│ HAVING COUNT(DISTINCT s.id) > 0                                             │
│ ORDER BY total_hours DESC                                                    │
│ LIMIT 100;                                                                   │
│                                                                              │
│ [SQL • Keywords: blue, Functions: magenta, Strings: green, Numbers: yellow] │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Dockerfile

```
┌─ Configuration: Dockerfile ──────────────────────────────────────────────────┐
│                                                                              │
│ # Build stage                                                                │
│ FROM node:20-alpine AS builder                                               │
│ WORKDIR /app                                                                 │
│                                                                              │
│ COPY package*.json ./                                                        │
│ RUN npm ci --only=production                                                │
│                                                                              │
│ COPY . .                                                                     │
│ RUN npm run build                                                            │
│                                                                              │
│ # Production stage                                                           │
│ FROM node:20-alpine                                                          │
│ WORKDIR /app                                                                 │
│                                                                              │
│ ENV NODE_ENV=production                                                      │
│ EXPOSE 3000                                                                  │
│                                                                              │
│ COPY --from=builder /app/dist ./dist                                        │
│ COPY --from=builder /app/node_modules ./node_modules                        │
│                                                                              │
│ CMD ["node", "dist/index.js"]                                               │
│                                                                              │
│ [Dockerfile • Instructions: blue, Arguments: white, Comments: gray]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Go

```
┌─ Generated Code: server.go ──────────────────────────────────────────────────┐
│                                                                              │
│ package main                                                                 │
│                                                                              │
│ import (                                                                     │
│     "fmt"                                                                    │
│     "log"                                                                    │
│     "net/http"                                                               │
│     "time"                                                                   │
│ )                                                                            │
│                                                                              │
│ type Server struct {                                                         │
│     Port    string                                                           │
│     Timeout time.Duration                                                    │
│ }                                                                            │
│                                                                              │
│ func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {     │
│     w.Header().Set("Content-Type", "application/json")                      │
│     fmt.Fprintf(w, `{"status": "healthy", "timestamp": "%s"}`,             │
│         time.Now().Format(time.RFC3339))                                    │
│ }                                                                            │
│                                                                              │
│ func (s *Server) Start() error {                                            │
│     mux := http.NewServeMux()                                               │
│     mux.HandleFunc("/health", s.handleHealth)                               │
│                                                                              │
│     server := &http.Server{                                                 │
│         Addr:         ":" + s.Port,                                         │
│         Handler:      mux,                                                   │
│         ReadTimeout:  s.Timeout,                                            │
│         WriteTimeout: s.Timeout,                                            │
│     }                                                                        │
│                                                                              │
│     log.Printf("Server starting on port %s", s.Port)                       │
│     return server.ListenAndServe()                                          │
│ }                                                                            │
│                                                                              │
│ func main() {                                                               │
│     server := &Server{                                                      │
│         Port:    "8080",                                                     │
│         Timeout: 30 * time.Second,                                          │
│     }                                                                        │
│                                                                              │
│     if err := server.Start(); err != nil {                                  │
│         log.Fatal("Server failed:", err)                                     │
│     }                                                                        │
│ }                                                                            │
│                                                                              │
│ [Go • Keywords: magenta, Types: cyan, Functions: yellow, Strings: green]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Rust

```
┌─ Generated Code: auth.rs ────────────────────────────────────────────────────┐
│                                                                              │
│ use serde::{Deserialize, Serialize};                                         │
│ use std::collections::HashMap;                                               │
│ use thiserror::Error;                                                        │
│                                                                              │
│ #[derive(Debug, Error)]                                                      │
│ pub enum AuthError {                                                         │
│     #[error("Invalid credentials")]                                          │
│     InvalidCredentials,                                                      │
│     #[error("Token expired")]                                                │
│     TokenExpired,                                                            │
│     #[error("Database error: {0}")]                                          │
│     DatabaseError(String),                                                   │
│ }                                                                            │
│                                                                              │
│ #[derive(Debug, Serialize, Deserialize)]                                    │
│ pub struct User {                                                            │
│     pub id: u64,                                                             │
│     pub email: String,                                                       │
│     pub name: String,                                                        │
│     pub roles: Vec<String>,                                                  │
│ }                                                                            │
│                                                                              │
│ pub struct AuthService {                                                     │
│     users: HashMap<String, User>,                                            │
│     secret_key: String,                                                      │
│ }                                                                            │
│                                                                              │
│ impl AuthService {                                                           │
│     pub fn new(secret_key: String) -> Self {                                │
│         Self {                                                               │
│             users: HashMap::new(),                                           │
│             secret_key,                                                      │
│         }                                                                    │
│     }                                                                        │
│                                                                              │
│     pub async fn authenticate(                                               │
│         &self,                                                               │
│         email: &str,                                                         │
│         password: &str,                                                      │
│     ) -> Result<String, AuthError> {                                        │
│         // Authentication logic here                                         │
│         todo!("Implement authentication")                                    │
│     }                                                                        │
│ }                                                                            │
│                                                                              │
│ [Rust • Keywords: blue, Attributes: yellow, Types: cyan, Macros: magenta]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

##### Markdown

```
┌─ Documentation: README.md ───────────────────────────────────────────────────┐
│                                                                              │
│ # APEX Authentication Module                                                 │
│                                                                              │
│ A secure, JWT-based authentication system for modern web applications.      │
│                                                                              │
│ ## Features                                                                  │
│                                                                              │
│ - **Secure JWT tokens** with configurable expiration                        │
│ - **Role-based access control** with flexible permissions                   │
│ - **Password hashing** using bcrypt with salt rounds                        │
│ - **Rate limiting** to prevent brute force attacks                          │
│ - **Session management** with automatic cleanup                              │
│                                                                              │
│ ## Quick Start                                                               │
│                                                                              │
│ ```typescript                                                                │
│ import { AuthService } from '@apexcli/auth';                                   │
│                                                                              │
│ const auth = new AuthService({                                               │
│   jwtSecret: process.env.JWT_SECRET,                                         │
│   tokenExpiry: '24h'                                                         │
│ });                                                                          │
│                                                                              │
│ // Authenticate user                                                         │
│ const token = await auth.login(email, password);                            │
│ ```                                                                          │
│                                                                              │
│ ## Configuration                                                             │
│                                                                              │
│ | Option | Type | Default | Description |                                   │
│ |--------|------|---------|-------------|                                   │
│ | `jwtSecret` | string | - | Secret key for JWT signing |                  │
│ | `tokenExpiry` | string | '1h' | Token expiration time |                   │
│ | `hashRounds` | number | 12 | bcrypt salt rounds |                          │
│                                                                              │
│ > **Security Note**: Always use environment variables for sensitive         │
│ > configuration like JWT secrets in production environments.                │
│                                                                              │
│ [Markdown • Headers: cyan, Code: gray bg, Tables: formatted, Links: blue]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Configuration Options

##### SyntaxHighlighter Component API

```typescript
import { SyntaxHighlighter, CodeBlock } from '@apexcli/cli/ui/components';

// Basic usage with SyntaxHighlighter
<SyntaxHighlighter
  code={sourceCode}
  language="typescript"
/>

// CodeBlock component for file display
<CodeBlock
  code={sourceCode}
  language="typescript"
  filename="AuthService.ts"
  showLineNumbers={true}
/>

// Full SyntaxHighlighter configuration
<SyntaxHighlighter
  code={sourceCode}
  language="python"
  showLineNumbers={true}
  width={80}
  maxLines={20}
  responsive={true}
  wrapLines={true}
/>

// Responsive configuration
<SyntaxHighlighter
  code={sourceCode}
  language="javascript"
  responsive={true} // Adapts to terminal width automatically
  wrapLines={true}  // Intelligently wraps long lines
/>
```

##### Component Properties

```typescript
// SyntaxHighlighter component interface
interface SyntaxHighlighterProps {
  code: string;                           // Source code to highlight
  language?: string;                      // Language identifier (default: 'typescript')
  showLineNumbers?: boolean;              // Display line numbers (default: true)
  width?: number;                         // Explicit width override
  maxLines?: number;                      // Maximum lines to display before truncation
  responsive?: boolean;                   // Auto-adapt to terminal width (default: true)
  wrapLines?: boolean;                    // Wrap long lines intelligently
}

// CodeBlock component interface
interface CodeBlockProps {
  code: string;                           // Source code to highlight
  language?: string;                      // Language identifier (default: 'typescript')
  filename?: string;                      // Optional filename to display
  showLineNumbers?: boolean;              // Display line numbers (default: true)
}

// Language mapping for common aliases
const languageMap = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown'
};
```

##### Theme Configuration

```typescript
// Custom theme configuration
const customTheme: ThemeOverrides = {
  keyword: 'blue',
  string: 'green',
  number: 'yellow',
  comment: 'gray',
  function: 'cyan',
  variable: 'white',
  type: 'magenta',
  operator: 'white',
  punctuation: 'gray',
  background: 'bgBlack',
  lineNumber: 'gray',
  highlightLine: 'bgGray'
};

<SyntaxHighlighter
  code={code}
  language="typescript"
  customTheme={customTheme}
/>
```

##### Global Configuration via .apex/config.yaml

```yaml
# Syntax highlighting configuration
ui:
  syntaxHighlighting:
    enabled: true
    theme: dark                    # dark, light, or auto
    defaultShowLineNumbers: false
    defaultWrapLongLines: false
    maxCodeBlockHeight: 30         # Maximum lines before scrolling

    # Language-specific overrides
    languageOverrides:
      python:
        showLineNumbers: true
      yaml:
        wrapLongLines: true

    # Custom color scheme
    colors:
      keyword: blue
      string: green
      number: yellow
      comment: gray
      function: cyan
```

#### Responsive Syntax Highlighting

Syntax highlighting adapts to terminal width for optimal readability:

**Wide Terminal (120+ columns):**
```
┌─ src/components/UserProfile.tsx ─────────────────────────────────────────────────────────────────────────────────────┐
│  1 │ import React, { useState, useEffect } from 'react';                                                              │
│  2 │ import { User, UserService } from '../services/UserService';                                                     │
│  3 │                                                                                                                  │
│  4 │ interface UserProfileProps {                                                                                     │
│  5 │   userId: string;                                                                                                │
│  6 │   onUpdate?: (user: User) => void;                                                                               │
│  7 │ }                                                                                                                │
│  8 │                                                                                                                  │
│  9 │ export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {                               │
│ 10 │   const [user, setUser] = useState<User | null>(null);                                                           │
│ 11 │   const [loading, setLoading] = useState(true);                                                                  │
│                                                                                                                       │
│ [TypeScript] [Lines 1-11 of 45] [Copy]                                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Compact Terminal (60-79 columns):**
```
┌─ UserProfile.tsx ─────────────────────────────────────┐
│  1 │ import React, { useState, useEffect }           │
│    │   from 'react';                                 │
│  2 │ import { User, UserService }                    │
│    │   from '../services/UserService';               │
│  3 │                                                 │
│  4 │ interface UserProfileProps {                    │
│  5 │   userId: string;                               │
│  6 │   onUpdate?: (user: User) => void;              │
│  7 │ }                                               │
│                                                       │
│ [TS] [1-7/45]                                         │
└───────────────────────────────────────────────────────┘
```

#### Line Highlighting

Highlight specific lines to draw attention to important code:

```
┌─ Important Changes ──────────────────────────────────────────────────────────┐
│                                                                              │
│  1 │ export function validateInput(input: string): boolean {                │
│  2 │   // Basic validation                                                  │
│  3 │   if (!input || input.trim().length === 0) {                     ← NEW │
│  4 │     return false;                                                 ← NEW │
│  5 │   }                                                               ← NEW │
│  6 │                                                                        │
│  7 │   // Check for dangerous patterns                                      │
│  8 │   const dangerousPatterns = [                                    ← NEW │
│  9 │     /<script>/i,                                                  ← NEW │
│ 10 │     /javascript:/i,                                               ← NEW │
│ 11 │     /on\w+=/i                                                     ← NEW │
│ 12 │   ];                                                              ← NEW │
│ 13 │                                                                        │
│ 14 │   return !dangerousPatterns.some(p => p.test(input));            ← NEW │
│ 15 │ }                                                                      │
│                                                                              │
│ [Lines 3-5, 8-12, 14 highlighted]                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Code Blocks with Highlighting

```
// TypeScript code with syntax highlighting
┌─ Generated Code: LoginForm.tsx ──────────────────────────────────────────────┐
│                                                                              │
│ import React, { useState } from 'react';                                     │
│ import { useAuth } from '../hooks/useAuth';                                 │
│                                                                              │
│ export const LoginForm: React.FC = () => {                                  │
│   const [email, setEmail] = useState('');                                   │
│   const [password, setPassword] = useState('');                             │
│   const { login, isLoading } = useAuth();                                   │
│                                                                              │
│   const handleSubmit = async (e: React.FormEvent) => {                      │
│     e.preventDefault();                                                      │
│     await login(email, password);                                           │
│   };                                                                         │
│                                                                              │
│   return (                                                                   │
│     <form onSubmit={handleSubmit}>                                          │
│       {/* Form implementation */}                                            │
│     </form>                                                                  │
│   );                                                                         │
│ };                                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 13. Diff Views

APEX v0.3.0 includes a powerful `DiffViewer` component that displays code changes in three distinct viewing modes: unified, split, and inline. The component automatically adapts to terminal width and provides clear visual feedback for additions, removals, and context lines.

#### Overview

The DiffViewer component supports:
- **Three display modes**: Unified, Split, and Inline
- **Auto mode**: Automatically selects the best mode based on terminal width
- **Responsive layout**: Adapts to terminal dimensions
- **Line numbers**: Optional line number display with dynamic sizing
- **Context control**: Configurable context lines around changes
- **Truncation**: Automatic line truncation for long lines

#### Unified Mode

The unified mode displays changes in a traditional git diff format with added lines marked with `+` and removed lines marked with `-`. This is the default mode for narrow terminals and provides a compact view of changes.

**Visual Example:**

```
┌─ Changes: AuthContext.tsx (Unified Mode) ────────────────────────────────────┐
│                                                                              │
│ --- AuthContext.tsx                                                          │
│ +++ AuthContext.tsx                                                          │
│                                                                              │
│ @@ -1,8 +1,15 @@                                                             │
│                                                                              │
│   1   1 │  import React, { createContext, useContext } from 'react';        │
│   2   2 │                                                                    │
│       3 │ +interface User {                                                  │
│       4 │ +  id: string;                                                     │
│       5 │ +  email: string;                                                  │
│       6 │ +  name: string;                                                   │
│       7 │ +}                                                                 │
│       8 │ +                                                                  │
│   3   9 │  interface AuthContextType {                                       │
│   4     │ -  user: any;                                                      │
│   5     │ -  isAuthenticated: boolean;                                       │
│      10 │ +  user: User | null;                                              │
│      11 │ +  isAuthenticated: boolean;                                       │
│      12 │ +  login: (email: string, password: string) => Promise<void>;     │
│      13 │ +  logout: () => void;                                             │
│   6  14 │  }                                                                 │
│                                                                              │
│ [Unified view • Added: green background • Removed: red background]          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Two line number columns (old file line, new file line)
- `+` prefix for added lines with green highlighting
- `-` prefix for removed lines with red highlighting
- Space prefix for context (unchanged) lines
- Hunk headers showing line range information (`@@`)

#### Split Mode

The split mode displays the old and new versions side-by-side, making it easy to compare changes at a glance. This mode requires a wider terminal (120+ columns) and provides the most comprehensive view of modifications.

**Visual Example:**

```
┌─ Changes: AuthContext.tsx (Split Mode) ──────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                      │
│ ┌─── OLD ─────────────────────────────────────┐  ┌─── NEW ─────────────────────────────────────────────────────────┐│
│ │ --- AuthContext.tsx                          │  │ +++ AuthContext.tsx                                            ││
│ └──────────────────────────────────────────────┘  └────────────────────────────────────────────────────────────────┘│
│                                                                                                                      │
│ @@ -1,8 +1,15 @@                                                                                                     │
│                                                                                                                      │
│  1 │ import React, { createContext, useContext }   1 │ import React, { createContext, useContext } from 'react';   │
│  2 │ } from 'react';                               2 │                                                              │
│  3 │                                               3 │ interface User {                                             │
│    │                                               4 │   id: string;                                                │
│    │                                               5 │   email: string;                                             │
│    │                                               6 │   name: string;                                              │
│    │                                               7 │ }                                                            │
│    │                                               8 │                                                              │
│  4 │ interface AuthContextType {                   9 │ interface AuthContextType {                                  │
│  5 │   user: any;                                    │                                                              │
│  6 │   isAuthenticated: boolean;                     │                                                              │
│    │                                              10 │   user: User | null;                                         │
│    │                                              11 │   isAuthenticated: boolean;                                  │
│    │                                              12 │   login: (email: string, password: string) => Promise<void>;│
│    │                                              13 │   logout: () => void;                                        │
│  7 │ }                                            14 │ }                                                            │
│                                                                                                                      │
│ [Split view • Requires 120+ columns • Red: removed • Green: added]                                                  │
│                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Side-by-side comparison of old and new content
- Separate line numbers for each side
- Red highlighting for removed lines (left side)
- Green highlighting for added lines (right side)
- Empty cells where lines don't correspond
- Automatic fallback to unified mode if terminal < 120 columns

#### Inline Mode

The inline mode provides character-level diff highlighting, showing exactly which characters were added or removed within lines. This is ideal for reviewing small, precise changes within text.

**Visual Example:**

```
┌─ Changes: config.yaml (Inline Mode) ─────────────────────────────────────────┐
│                                                                              │
│ config.yaml                                                                  │
│                                                                              │
│ project:                                                                     │
│   name: my-appmy-application                                                 │
│   version: 1.0.01.1.0                                                        │
│   description: A simple appA full-featured application                       │
│                                                                              │
│ settings:                                                                    │
│   debug: truefalse                                                           │
│   logLevel: infowarndebug                                                    │
│   maxConnections: 10100                                                      │
│                                                                              │
│ [Inline view • Character-level highlighting]                                 │
│ [Red background: removed characters • Green background: added characters]    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Character-by-character diff highlighting
- Inline display of both old and new content
- Red background for removed characters
- Green background for added characters
- Ideal for small text changes, config modifications, or typo fixes

#### Auto Mode and Responsive Behavior

The `auto` mode (default) automatically selects the optimal display mode based on terminal width:

```
Terminal Width          Selected Mode       Rationale
──────────────────────────────────────────────────────────────────────
< 120 columns          Unified              Insufficient width for split
≥ 120 columns          Split                Full side-by-side comparison
```

**Responsive Width Adaptation:**

```
┌─ DiffViewer Responsive Behavior ─────────────────────────────────────────────┐
│                                                                              │
│ Terminal Width: 160 columns (wide)                                           │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  Mode: Split (auto-selected)                                              │ │
│ │  Each side: ~78 columns                                                   │ │
│ │  Line numbers: Dynamic (4+ digits for large files)                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Terminal Width: 100 columns (normal)                                         │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │  Mode: Unified (auto-selected, < 120 threshold)                         │   │
│ │  Content width: ~90 columns                                              │   │
│ │  Line numbers: Standard (3 digits)                                       │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ Terminal Width: 60 columns (compact)                                         │
│ ┌─────────────────────────────────────────────────────────┐                  │
│ │  Mode: Unified                                          │                  │
│ │  Content width: ~50 columns                             │                  │
│ │  Line numbers: Compact (2 digits)                       │                  │
│ │  Long lines: Truncated with ...                         │                  │
│ └─────────────────────────────────────────────────────────┘                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Split Mode Fallback:**

When split mode is explicitly requested but the terminal is too narrow, the component gracefully falls back to unified mode with a notification:

```
┌─ DiffViewer: Split Mode Fallback ────────────────────────────────────────────┐
│                                                                              │
│ --- AuthContext.tsx (split view requires 120+ columns)                       │
│ +++ AuthContext.tsx                                                          │
│                                                                              │
│ [Continues with unified view...]                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### DiffViewer Component API

**Basic Usage:**

```typescript
import { DiffViewer } from '@apexcli/cli/ui/components';

// Auto mode (recommended) - automatically selects best mode
<DiffViewer
  oldContent={originalCode}
  newContent={modifiedCode}
  filename="AuthContext.tsx"
/>

// Explicit unified mode
<DiffViewer
  oldContent={originalCode}
  newContent={modifiedCode}
  mode="unified"
/>

// Explicit split mode (requires 120+ columns)
<DiffViewer
  oldContent={originalCode}
  newContent={modifiedCode}
  mode="split"
/>

// Inline mode for character-level diffs
<DiffViewer
  oldContent={originalText}
  newContent={modifiedText}
  mode="inline"
/>
```

**Full Configuration:**

```typescript
<DiffViewer
  oldContent={originalCode}
  newContent={modifiedCode}
  filename="AuthContext.tsx"
  mode="auto"                  // 'unified' | 'split' | 'inline' | 'auto'
  context={3}                  // Number of context lines around changes
  showLineNumbers={true}       // Display line numbers
  width={120}                  // Explicit width (overrides responsive)
  maxLines={50}                // Limit displayed lines
  responsive={true}            // Enable responsive width adaptation
/>
```

**Component Properties:**

```typescript
interface DiffViewerProps {
  oldContent: string;           // Original content to compare
  newContent: string;           // Modified content to compare
  filename?: string;            // Optional filename for header display
  mode?: 'unified' | 'split' | 'inline' | 'auto';  // Display mode (default: 'auto')
  context?: number;             // Context lines around changes (default: 3)
  showLineNumbers?: boolean;    // Show line numbers (default: true)
  width?: number;               // Explicit width override
  maxLines?: number;            // Maximum lines to display
  responsive?: boolean;         // Enable responsive layout (default: true)
}
```

#### Configuration via .apex/config.yaml

```yaml
# Diff viewer configuration
ui:
  diffViewer:
    defaultMode: auto           # auto, unified, split, or inline
    showLineNumbers: true       # Display line numbers by default
    contextLines: 3             # Context lines around changes
    responsive: true            # Enable responsive width adaptation

    # Mode-specific settings
    unifiedMode:
      colorScheme:
        added: green
        removed: red
        context: white
      background:
        added: greenBright
        removed: redBright

    splitMode:
      minimumWidth: 120         # Minimum columns for split mode
      separatorWidth: 2         # Gap between left and right panels

    inlineMode:
      characterLevel: true      # Character-by-character highlighting
```

#### Dynamic Line Number Width

The DiffViewer automatically adjusts line number column width based on file size and terminal width:

```
┌─ Line Number Width Calculation ──────────────────────────────────────────────┐
│                                                                              │
│ File Size              Terminal        Line Number Width                     │
│ ──────────────────────────────────────────────────────────────────────────  │
│ < 100 lines           Narrow           2 digits (compact)                   │
│ < 100 lines           Normal/Wide      2-3 digits                           │
│ 100-999 lines         All              3 digits                             │
│ 1000-9999 lines       All              4 digits                             │
│ 10000+ lines          All              5-6 digits (max 6)                   │
│                                                                              │
│ Example: 1,234-line file in wide terminal                                   │
│ ┌────┬────────────────────────────────────────────────────────────────────┐ │
│ │ 1234 │ export function processData(items: DataItem[]): Result[] {        │ │
│ │ 1235 │   return items.map(item => ({                                     │ │
│ │ 1236 │     id: item.id,                                                  │ │
│ │ 1237 │     processed: true,                                               │ │
│ │ 1238 │     timestamp: Date.now()                                          │ │
│ │ 1239 │   }));                                                            │ │
│ │ 1240 │ }                                                                  │ │
│ └────┴────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Use Case Examples

##### Code Review - Split Mode

```typescript
// Ideal for reviewing substantial code changes
<DiffViewer
  oldContent={pullRequestBase}
  newContent={pullRequestHead}
  filename="src/services/AuthService.ts"
  mode="split"
  context={5}
/>
```

##### Quick Config Check - Inline Mode

```typescript
// Perfect for configuration file changes
<DiffViewer
  oldContent={currentConfig}
  newContent={proposedConfig}
  filename=".env.production"
  mode="inline"
/>
```

##### Git-style Output - Unified Mode

```typescript
// Traditional git diff format
<DiffViewer
  oldContent={commitParent}
  newContent={commitCurrent}
  filename="package.json"
  mode="unified"
  showLineNumbers={true}
  context={3}
/>
```

##### Responsive Demo Application

```typescript
// Let the component choose the best mode
function FileChangesViewer({ changes }: { changes: FileChange[] }) {
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    changes.map((change, index) =>
      React.createElement(
        Box,
        { key: index, marginBottom: 1 },
        React.createElement(DiffViewer, {
          oldContent: change.before,
          newContent: change.after,
          filename: change.path,
          mode: 'auto',       // Adapts to terminal width
          responsive: true,   // Enable width adaptation
          maxLines: 30        // Limit for large files
        })
      )
    )
  );
}
```

#### Color Reference

| Element | Color | Background | Description |
|---------|-------|------------|-------------|
| Added lines | green | greenBright | New content |
| Removed lines | red | redBright | Deleted content |
| Context lines | white | none | Unchanged lines |
| Line numbers | gray (dim) | none | Line number columns |
| Hunk headers | cyan (bold) | none | `@@ -x,y +x,y @@` format |
| File headers | white (bold) | none | `--- a/file` and `+++ b/file` |
| Fallback notice | yellow (dim) | none | Split mode width warning |

## Implementation Architecture

### Component Structure

```
packages/cli/src/ui/components/
├── StreamingText.tsx           # Character-by-character streaming
├── MarkdownRenderer.tsx        # CommonMark with syntax highlighting
├── AgentPanel.tsx             # Multi-agent visualization
├── StatusBar.tsx              # Persistent status display
├── AdvancedInput.tsx          # Enhanced input with completion
├── ProgressIndicators.tsx     # Progress bars and spinners
├── ErrorDisplay.tsx           # Rich error formatting
├── SuccessCelebration.tsx     # Success animations
└── agents/
    ├── HandoffIndicator.tsx   # Agent handoff animations
    ├── SubtaskTree.tsx        # Interactive task hierarchy
    └── AgentThoughts.tsx      # Collapsible thought display
```

### Responsive System

The responsive system uses the `useStdoutDimensions` hook to provide breakpoint-aware layouts:

```typescript
interface StdoutDimensions {
  width: number;                                    // Terminal columns
  height: number;                                   // Terminal rows
  breakpoint: 'narrow' | 'compact' | 'normal' | 'wide';
  isAvailable: boolean;
}

// Breakpoint thresholds
// narrow: < 60 columns
// compact: 60-79 columns
// normal: 80-119 columns
// wide: 120+ columns
```

### Streaming Performance

All streaming components are optimized for performance:

- **Character-based streaming** at configurable speeds (default 50 chars/second)
- **Responsive layout** that adapts to terminal width changes
- **Efficient React updates** with proper useEffect dependencies
- **Memory management** with cleanup in component unmount
- **Cursor animations** with independent timing controls

## Usage Examples

These walkthroughs build on concepts mentioned in the Overview and reinforce the UI behaviors across modes.

### Basic Streaming Text

```typescript
// Simple streaming with default settings
<StreamingText text="Hello, World!" />

// Fast streaming with no cursor
<StreamingText
  text="Quick message"
  speed={100}
  showCursor={false}
/>

// Responsive streaming that adapts to terminal width
<StreamingText
  text="This text will wrap appropriately based on your terminal width and provide a great reading experience regardless of screen size."
  responsive={true}
  maxLines={5}
/>
```

### Agent Response Streaming

```typescript
// Agent response with streaming
<StreamingResponse
  agent="🤖 developer"
  content={longResponse}
  isStreaming={true}
  onComplete={() => setShowNext(true)}
/>

// Multiple agents in sequence
agents.map(agent => (
  <StreamingResponse
    key={agent.id}
    agent={agent.name}
    content={agent.response}
    isComplete={agent.status === 'complete'}
  />
))
```

### Interactive Agent Panel

```typescript
// Full agent visualization
<AgentPanel
  agents={agentStates}
  activeAgent="developer"
  showHandoffs={true}
  showParallel={true}
  allowCollapse={true}
/>

// Compact mode for narrow terminals
<AgentPanel
  agents={agentStates}
  mode="compact"
  showProgress={false}
/>
```

## Best Practices

### Streaming Text Guidelines

1. **Speed Selection**: Use 50 chars/second for normal reading, 100+ for quick updates
2. **Cursor Usage**: Show cursors during active streaming, hide for completed text
3. **Line Length**: Let responsive system handle wrapping rather than manual breaks
4. **Completion Callbacks**: Always provide onComplete handlers for chained operations

### Visual Hierarchy

1. **Agent Identification**: Use consistent emoji and color schemes for agent types
2. **Progress States**: Clear visual distinction between active, complete, waiting, and error states
3. **Interactive Elements**: Provide clear keyboard shortcut hints
4. **Information Density**: Adapt detail level based on terminal size

### Performance Considerations

1. **Component Lifecycle**: Properly cleanup timers and intervals
2. **State Updates**: Batch React updates for smooth animations
3. **Memory Usage**: Limit history length for long-running sessions
4. **Terminal Compatibility**: Test across different terminal emulators

### 12. Markdown Rendering System

#### Comprehensive Markdown Support

The `MarkdownRenderer` component provides full CommonMark support with syntax highlighting, enabling rich text formatting throughout the APEX interface. All agent responses, documentation, and help text support the following markdown elements:

**Supported Elements:**
- Headers (h1, h2, h3)
- Unordered and ordered lists
- Code blocks with syntax highlighting
- Inline code formatting
- Blockquotes
- Bold and italic text emphasis

#### Header Elements

**Raw Markdown:**
```markdown
# Primary Header
## Secondary Header
### Tertiary Header
```

**Rendered Output:**
```
┌─ Markdown Rendering ─────────────────────────────────────────────────────────┐
│                                                                              │
│ ██████ Primary Header                                                        │
│                                                                              │
│ ████ Secondary Header                                                        │
│                                                                              │
│ ██ Tertiary Header                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### List Elements

**Raw Markdown:**
```markdown
### Unordered Lists
- Feature planning
- Code implementation
- Testing and validation
- Documentation updates

### Ordered Lists
1. Initialize project structure
2. Configure development environment
3. Implement core features
4. Write comprehensive tests
```

**Rendered Output:**
```
┌─ List Rendering ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ ██ Unordered Lists                                                           │
│                                                                              │
│ • Feature planning                                                           │
│ • Code implementation                                                        │
│ • Testing and validation                                                     │
│ • Documentation updates                                                      │
│                                                                              │
│ ██ Ordered Lists                                                             │
│                                                                              │
│ 1. Initialize project structure                                              │
│ 2. Configure development environment                                         │
│ 3. Implement core features                                                   │
│ 4. Write comprehensive tests                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Raw Markdown (Ordered Lists Only):**
```markdown
### Ordered Lists
1. Initialize project structure
2. Configure development environment
3. Implement core features
4. Write comprehensive tests
```

#### Code Block Elements

**Raw Markdown:**
````markdown
```typescript
interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: number;
  refreshEnabled: boolean;
}

const config: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: 3600,
  refreshEnabled: true
};
```
````

**Rendered Output:**
```
┌─ Code Block Rendering ───────────────────────────────────────────────────────┐
│                                                                              │
│ interface AuthConfig {                                                       │
│   jwtSecret: string;                                                         │
│   tokenExpiry: number;                                                       │
│   refreshEnabled: boolean;                                                   │
│ }                                                                            │
│                                                                              │
│ const config: AuthConfig = {                                                 │
│   jwtSecret: process.env.JWT_SECRET,                                         │
│   tokenExpiry: 3600,                                                         │
│   refreshEnabled: true                                                       │
│ };                                                                           │
│                                                                              │
│ [TypeScript syntax highlighting applied]                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Inline Code Elements

**Raw Markdown:**
```markdown
Use the `npm install` command to install dependencies. Configure your environment with `API_KEY=your_key` and run `npm start` to begin development.
```

**Rendered Output:**
```
┌─ Inline Code Rendering ──────────────────────────────────────────────────────┐
│                                                                              │
│ Use the npm install command to install dependencies. Configure your         │
│ environment with API_KEY=your_key and run npm start to begin development.   │
│                                                                              │
│ [Inline code highlighted with distinct background/styling]                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Blockquote Elements

**Raw Markdown:**
```markdown
> **Important**: Always validate user input before processing authentication tokens.
>
> This prevents security vulnerabilities and ensures your application maintains
> proper data integrity throughout the authentication flow.
```

**Rendered Output:**
```
┌─ Blockquote Rendering ───────────────────────────────────────────────────────┐
│                                                                              │
│ │ Important: Always validate user input before processing authentication     │
│ │ tokens.                                                                    │
│ │                                                                            │
│ │ This prevents security vulnerabilities and ensures your application       │
│ │ maintains proper data integrity throughout the authentication flow.        │
│                                                                              │
│ [Left border and distinct styling applied]                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Text Emphasis Elements

**Raw Markdown:**
```markdown
The authentication system supports **strong emphasis** for critical information,
*italic emphasis* for subtle highlights, and ***combined emphasis*** for maximum
impact when documenting important implementation details.
```

**Rendered Output:**
```
┌─ Text Emphasis Rendering ────────────────────────────────────────────────────┐
│                                                                              │
│ The authentication system supports strong emphasis for critical              │
│ information, italic emphasis for subtle highlights, and combined emphasis    │
│ for maximum impact when documenting important implementation details.        │
│                                                                              │
│ [Bold, italic, and combined styling applied appropriately]                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### MarkdownRenderer Component API

**Basic Usage:**
```typescript
import { MarkdownRenderer } from '@apexcli/cli/ui/components';

<MarkdownRenderer
  content={markdownString}
  highlightLanguage="typescript"
  showLineNumbers={true}
  theme="dark"
  maxWidth={80}
/>
```

**Advanced Configuration:**
```typescript
<MarkdownRenderer
  content={agentResponse}
  highlightLanguage="auto"
  showLineNumbers={false}
  theme="auto"
  responsive={true}
  streaming={true}
  onRenderComplete={() => handleComplete()}
  customStyles={{
    header: { color: 'cyan', bold: true },
    code: { backgroundColor: 'gray', color: 'white' },
    emphasis: { color: 'yellow' }
  }}
/>
```

**Component Properties:**
```typescript
interface MarkdownRendererProps {
  content: string;                    // Raw markdown content
  highlightLanguage?: string;         // Syntax highlighting language
  showLineNumbers?: boolean;          // Show line numbers in code blocks
  theme?: 'dark' | 'light' | 'auto';  // Color theme
  maxWidth?: number;                  // Maximum rendering width
  responsive?: boolean;               // Responsive layout adaptation
  streaming?: boolean;                // Character-by-character rendering
  onRenderComplete?: () => void;      // Callback when rendering completes
  customStyles?: StyleOverrides;      // Custom styling overrides
}
```

#### Responsive Markdown Layout

Markdown content automatically adapts to terminal width:

**Wide Terminal (120+ columns):**
```
┌─ Authentication Implementation Guide ────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                          │
│ ██████ JWT Authentication Setup                                                                                          │
│                                                                                                                          │
│ Follow these steps to implement secure authentication in your React application:                                        │
│                                                                                                                          │
│ 1. Install required dependencies: npm install jsonwebtoken bcryptjs express-rate-limit                                 │
│ 2. Configure environment variables for JWT secrets and database connection                                              │
│ 3. Create authentication middleware with proper error handling and token validation                                     │
│ 4. Implement protected route wrapper component with React Router integration                                            │
│                                                                                                                          │
│ > **Security Note**: Always use HTTPS in production and implement proper token rotation strategies                      │
│                                                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Compact Terminal (60-79 columns):**
```
┌─ Auth Implementation ─────────────────────────────────┐
│                                                       │
│ ██████ JWT Authentication                             │
│                                                       │
│ Steps for secure auth implementation:                 │
│                                                       │
│ 1. Install deps: npm install jsonwebtoken bcryptjs   │
│ 2. Configure environment variables                    │
│ 3. Create auth middleware                             │
│ 4. Implement protected routes                         │
│                                                       │
│ > **Security**: Use HTTPS in production               │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### Color Reference for Markdown Elements

**Color Mapping:**
- **Headers**: Cyan bold text with size-based intensity
- **Bold text**: White bold or bright white
- **Italic text**: Yellow or bright yellow
- **Inline code**: Gray background with white text
- **Code blocks**: Syntax-highlighted with language detection
- **Blockquotes**: Left cyan border with dimmed text
- **Lists**: White bullets/numbers with normal text
- **Links**: Blue underlined text (when supported)

**Theme Adaptation:**
```typescript
// Dark theme (default)
const darkTheme = {
  header1: { color: 'cyanBright', bold: true },
  header2: { color: 'cyan', bold: true },
  header3: { color: 'cyanDim', bold: true },
  bold: { color: 'whiteBright', bold: true },
  italic: { color: 'yellow', italic: true },
  code: { backgroundColor: 'bgGray', color: 'white' },
  blockquote: { color: 'gray', borderColor: 'cyan' }
};

// Light theme
const lightTheme = {
  header1: { color: 'blue', bold: true },
  header2: { color: 'blueDim', bold: true },
  header3: { color: 'gray', bold: true },
  bold: { color: 'black', bold: true },
  italic: { color: 'magenta', italic: true },
  code: { backgroundColor: 'bgWhite', color: 'black' },
  blockquote: { color: 'gray', borderColor: 'blue' }
};
```

#### Component Integration Examples

##### Streaming Code Generation

```typescript
// Example: Developer agent generating code with streaming
import { StreamingResponse, SyntaxHighlighter } from '@apexcli/cli/ui/components';

const content = React.createElement(
  'div',
  null,
  React.createElement('p', null, "I'll create the authentication service for you:"),
  React.createElement(SyntaxHighlighter, {
    code: generatedCode,
    language: 'typescript',
    showLineNumbers: true,
    responsive: true
  }),
  React.createElement('p', null, 'This implementation includes JWT token handling and user validation.')
);

<StreamingResponse
  agent="🤖 developer"
  content={content}
  isStreaming={isGenerating}
  onComplete={() => setShowNext(true)}
/>
```

##### File Comparison with Diff

```typescript
// Show before/after code comparison
import { CodeBlock } from '@apexcli/cli/ui/components';

// Original file
<CodeBlock
  code={originalCode}
  language="typescript"
  filename="AuthContext.tsx (before)"
  showLineNumbers={true}
/>

// Modified file
<CodeBlock
  code={modifiedCode}
  language="typescript"
  filename="AuthContext.tsx (after)"
  showLineNumbers={true}
/>
```

##### Multi-Language Documentation

```typescript
// Display implementation in multiple languages
const examples = [
  { lang: 'typescript', code: tsCode, filename: 'auth.ts' },
  { lang: 'python', code: pyCode, filename: 'auth.py' },
  { lang: 'go', code: goCode, filename: 'auth.go' },
];

{examples.map((example, index) => (
  <CodeBlock
    key={index}
    code={example.code}
    language={example.lang}
    filename={example.filename}
    showLineNumbers={true}
  />
))}
```

##### Smart Language Detection

```typescript
// Automatic language detection based on file extension
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'yml': 'yaml',
    'yaml': 'yaml',
    'json': 'json',
    'md': 'markdown',
    'sh': 'bash',
    'sql': 'sql',
  };
  return languageMap[extension || ''] || 'text';
}

// Usage in components
<SyntaxHighlighter
  code={fileContent}
  language={getLanguageFromFilename(filename)}
  responsive={true}
/>
```

#### Integration with Streaming Components

Markdown rendering integrates seamlessly with APEX's streaming system:

```typescript
// Streaming markdown response from agent
<StreamingResponse
  agent="📝 documentation"
  content={markdownResponse}
  renderAsMarkdown={true}
  isStreaming={true}
  onComplete={() => setShowNext(true)}
/>

// Agent response with markdown content
const agentResponse = `
## Implementation Plan

I'll create the authentication system with these components:

1. **LoginForm Component**
   - Email/password validation
   - Submit handling with loading states
   - Error message display

2. **AuthContext Provider**
   - User state management
   - Token storage and validation
   - Login/logout functions

\`\`\`typescript
// Example implementation
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {}
});
\`\`\`

> **Next Steps**: After reviewing this plan, I'll implement each component with full TypeScript support and comprehensive error handling.
`;
```

**Streaming Markdown Output:**
```
┌─ 📝 documentation ● streaming... ────────────────────────────────────────────┐
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ████ Implementation Plan                                                     │
│                                                                              │
│ I'll create the authentication system with these components:                 │
│                                                                              │
│ 1. LoginForm Component                                                       │
│    • Email/password validation                                               │
│    • Submit handling with loading states                                     │
│    • Error message display                                                   │
│                                                                              │
│ 2. AuthContext Provider                                                      │
│    • User state management                                                   │
│    • Token storage and validation                                            │
│    • Login/logout functions                                                  │
│                                                                              │
│ // Example implementation                                                     │
│ const AuthContext = createContext<AuthContextType>({                        │
│   user: null,                                                               │
│   isAuthenticated: false,                                                    │
│   login: async () => {},                                                     │
│   logout: () => {}                                                           │
│ });                                                                          │
│                                                                              │
│ │ Next Steps: After reviewing this plan, I'll implement each component      │
│ │ with full TypeScript support and comprehensive error handling.▊           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Performance Optimization

##### Intelligent Line Wrapping

The SyntaxHighlighter component includes smart line wrapping that preserves code readability:

```typescript
// Automatic wrapping at optimal break points
function wrapCodeLine(line: string, maxWidth: number): string[] {
  const breakChars = [' ', ',', '.', '(', ')', '{', '}', '[', ']', ';', '+', '-', '*', '/', '='];

  // Look for natural break points rather than hard character limits
  for (let i = maxWidth; i > maxWidth - 20 && i > 0; i--) {
    if (breakChars.includes(line[i])) {
      return [
        line.substring(0, i + 1),
        '  ' + line.substring(i + 1) // Indent continuation
      ];
    }
  }
}
```

##### Component Rendering Performance

```typescript
// Performance considerations for large code files
<SyntaxHighlighter
  code={largeFile}
  language="typescript"
  maxLines={50}        // Limit rendering to first 50 lines
  responsive={true}    // Only render visible content
  wrapLines={false}    // Disable wrapping for performance
/>

// Virtual scrolling for very large files
<VirtualizedCodeView
  code={hugeFile}
  language="typescript"
  windowSize={20}      // Only render 20 lines at a time
  showLineNumbers={true}
/>
```

##### Memory Management

```typescript
// Cleanup strategies for long-running sessions
useEffect(() => {
  // Cleanup syntax highlighter resources
  return () => {
    if (syntaxHighlighter.current) {
      syntaxHighlighter.current.dispose();
    }
  };
}, []);

// Lazy loading for syntax highlighting
const LazyCodeBlock = React.lazy(() => import('./CodeBlock'));

const suspenseView = React.createElement(
  Suspense,
  { fallback: React.createElement(Text, null, 'Loading syntax highlighting...') },
  React.createElement(LazyCodeBlock, { code, language })
);
```

#### Configuration File Examples

##### Complete .apex/config.yaml Configuration

```yaml
# Complete syntax highlighting configuration
ui:
  syntaxHighlighting:
    enabled: true
    theme: dark                           # dark, light, auto
    defaultShowLineNumbers: true
    defaultWrapLongLines: true
    maxCodeBlockHeight: 30

    # Performance settings
    lazyLoading: true
    virtualScrolling: true
    maxRenderLines: 100

    # Language-specific settings
    languageOverrides:
      typescript:
        showLineNumbers: true
        wrapLongLines: true
        maxLines: 50
      python:
        showLineNumbers: true
        wrapLongLines: false
      json:
        showLineNumbers: false
        wrapLongLines: true
      markdown:
        showLineNumbers: false
        wrapLongLines: true

    # Custom highlighting colors
    colors:
      keyword: blue
      string: green
      number: yellow
      comment: gray
      function: cyan
      variable: white
      type: magenta
      operator: white
      punctuation: gray
      background: bgBlack
      lineNumber: gray
      highlightLine: bgGray

    # File extension mappings
    extensions:
      '.ts': typescript
      '.tsx': typescript
      '.js': javascript
      '.jsx': javascript
      '.py': python
      '.rs': rust
      '.go': go
      '.sql': sql
      '.sh': bash
      '.yml': yaml
      '.yaml': yaml
      '.json': json
      '.md': markdown
      '.dockerfile': dockerfile
      '.env': bash
```

## Technical Specifications

### Dependencies

- **ink**: React renderer for CLI applications
- **ink-syntax-highlight**: Syntax highlighting for code blocks
- **marked**: CommonMark markdown parsing
- **shiki**: Theme-aware syntax highlighting engine
- **fuse.js**: Fuzzy search for command and input suggestions
- **react**: Component framework for CLI rendering
- **chalk**: Terminal string styling utilities

### Browser/Terminal Compatibility

- **Supported Terminals**: iTerm2, Terminal.app, Windows Terminal, GNOME Terminal
- **Minimum Width**: 40 columns (graceful degradation below)
- **Color Support**: Full 256-color with fallbacks for basic terminals
- **Unicode Support**: Full emoji and special character support

### Performance Metrics

- **Streaming Speed**: 50-100 characters per second (configurable)
- **Response Time**: <50ms for input handling
- **Memory Usage**: <10MB for standard sessions
- **Terminal Refresh**: 60fps for smooth animations

## Migration from v0.2.x

Existing APEX v0.2.x installations will automatically gain the new streaming features:

1. **No configuration changes** required
2. **Backward compatible** command structure
3. **Enhanced output** for all existing workflows
4. **Optional features** can be disabled via configuration

The v0.3.0 upgrade maintains full compatibility while dramatically improving the user experience through rich visual feedback and responsive design.
