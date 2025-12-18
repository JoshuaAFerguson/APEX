# APEX v0.3.0 Features Overview

This document provides a comprehensive overview of the features introduced in APEX v0.3.0, with detailed streaming output examples and visual demonstrations.

## Overview

APEX v0.3.0 transforms the CLI experience into a "Claude Code-like Interactive Experience" with rich terminal UI components, real-time streaming output, and sophisticated visual feedback. This release focuses on making APEX feel as polished and intuitive as modern AI coding assistants while maintaining our unique multi-agent orchestration capabilities.

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
import { StreamingText } from '@apex/cli/ui/components';

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

#### Breakpoint-Aware Layout

```typescript
// useStdoutDimensions hook provides responsive behavior
const { width, height, breakpoint } = useStdoutDimensions();

// Breakpoint values: 'narrow' | 'compact' | 'normal' | 'wide'
// narrow: width < 60, compact: 60-79, normal: 80-119, wide: 120+
```

### 4. Multi-Agent Visualization

#### Agent Panel with Handoff Animations

The `AgentPanel` component provides real-time visualization of agent activity:

```
┌─ Agent Activity ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ 📋 planner    → → →  🏗️  architect  → → →  🤖 developer    ⟂  🧪 tester      │
│   completed          in progress             waiting           parallel      │
│   (2.3s)            (0:45 elapsed)           queue: 1           (running)    │
│                                                                              │
│ ├─ 📋 Plan implementation strategy                              ✓ (2.3s)     │
│ ├─ 🏗️ Design authentication system                            ● (in progress) │
│ │  ├─ Define JWT token structure                               ✓ (0.2s)     │
│ │  ├─ Design login/register flow                               ✓ (0.8s)     │
│ │  └─ Plan component hierarchy                                 ● (current)   │
│ ├─ 🤖 Implement authentication components                       ⏸ (waiting)   │
│ └─ 🧪 Write tests for auth system                              ⟂ (parallel)  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Visual Elements:**
- `→ → →` Animated handoff arrows between agents
- `⟂` Parallel execution indicator with cyan styling
- `●` Active/in-progress indicator with pulse effect
- `✓` Completed tasks with elapsed time
- `⏸` Waiting/queued tasks
- Hierarchical subtask tree with expand/collapse

#### Parallel Execution View

```
┌─ Parallel Agent Execution ───────────────────────────────────────────────────┐
│                                                                              │
│ 🤖 developer                           ⟂  🧪 tester                          │
│ ● Implementing login form                ● Running unit tests                │
│   (1:23 elapsed)                          (0:47 elapsed)                     │
│                                                                              │
│ 🔧 devops                              ⟂  📝 reviewer                        │
│ ● Setting up CI pipeline                 ● Code review in progress           │
│   (0:34 elapsed)                          (0:12 elapsed)                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Subtask Tree with Interactive Controls

```
┌─ Task Breakdown ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ ▼ 🏗️ Design authentication system                              ● (current)   │
│   ├─ ✓ Define JWT token structure                               (0.2s)       │
│   ├─ ✓ Design login/register flow                               (0.8s)       │
│   ├─ ● Plan component hierarchy                                 (current)     │
│   │   ├─ ✓ LoginForm component                                  (0.1s)       │
│   │   ├─ ● AuthContext provider                                 (current)     │
│   │   └─ ⏸ ProtectedRoute wrapper                              (pending)     │
│   └─ ⏸ Create API integration plan                             (pending)     │
│                                                                              │
│ ▶ 🤖 Implement authentication components                        (collapsed)   │
│ ▶ 🧪 Write tests for auth system                               (collapsed)   │
│                                                                              │
│ Keyboard: ↑↓ Navigate, ←→ Collapse/Expand, Space Toggle        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5. Status Bar and Information Display

#### Persistent Status Bar

The status bar remains visible at the bottom of the terminal with real-time information:

```
────────────────────────────────────────────────────────────────────────────────
⚡ APEX v0.3.0  │  🏗️ architect  │  📋 implementation  │  ⏱️ 00:04:23  │  🪙 1.2K↑ 3.4K↓  │  💰 $0.12  │  🌿 main
```

**Status Elements:**
- **Version indicator** - Current APEX version
- **Active agent** - Which agent is currently working
- **Workflow stage** - Current stage in multi-stage workflows
- **Session timer** - Elapsed time in current session
- **Token counters** - Input (↑) and output (↓) token counts
- **Cost tracker** - Running cost for current session
- **Git branch** - Current branch name

#### Responsive Status Bar

The status bar adapts to terminal width:

```
# Wide terminal (120+ columns)
⚡ APEX v0.3.0  │  🏗️ architect  │  📋 implementation  │  ⏱️ 00:04:23  │  🪙 1.2K↑ 3.4K↓  │  💰 $0.12  │  🌿 main

# Normal terminal (80-119 columns)
⚡ APEX  │  🏗️ architect  │  📋 impl  │  ⏱️ 04:23  │  🪙 1.2K↑ 3.4K↓  │  💰 $0.12

# Compact terminal (60-79 columns)
⚡ v0.3.0  │  🏗️ arch  │  ⏱️ 04:23  │  💰 $0.12

# Narrow terminal (< 60 columns)
⚡ 🏗️ ⏱️ 04:23  💰 $0.12
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

### 7. Enhanced Input Experience

#### Advanced Input with Preview

```
┌─ Input ──────────────────────────────────────────────────────────────────────┐
│ apex> Add a shopping cart feature with the following requirements:          │
│       - Add/remove items                                                    │
│       - Quantity management                                                 │
│       - Price calculations                                                  │
│       - Persistent storage█                                                 │
│                                                                              │
│ 💡 Preview: This will be interpreted as a natural language task             │
│             Press Enter to execute, Ctrl+C to cancel                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Tab Completion with Fuzzy Search

```
apex> /st[TAB]
┌─ Suggestions ────────────────────────────────────────────────────────────────┐
│ /status        Show task status                                              │
│ /start         Start a new workflow                                          │
│ /stop          Stop current task                                             │
└──────────────────────────────────────────────────────────────────────────────┘

apex> create react comp[TAB]
┌─ Suggestions ────────────────────────────────────────────────────────────────┐
│ create react component    Create a new React component                       │
│ create react context      Create a React context provider                    │
│ create react hook         Create a custom React hook                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### History Search

```
# Press Ctrl+R to search history
(reverse-i-search)`auth`: Add user authentication to my React app

# Navigate with up/down arrows
apex> ↑ Add user authentication to my React app
apex> ↑ Create a login form component
apex> ↑ /status
```

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

#### Code Blocks with Highlighting

```typescript
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

#### Diff Views

```diff
┌─ Changes: AuthContext.tsx ───────────────────────────────────────────────────┐
│                                                                              │
│ @@ -1,8 +1,15 @@                                                             │
│  import React, { createContext, useContext } from 'react';                  │
│                                                                              │
│ +interface User {                                                            │
│ +  id: string;                                                               │
│ +  email: string;                                                            │
│ +  name: string;                                                             │
│ +}                                                                           │
│ +                                                                            │
│  interface AuthContextType {                                                 │
│ -  user: any;                                                                │
│ -  isAuthenticated: boolean;                                                 │
│ +  user: User | null;                                                        │
│ +  isAuthenticated: boolean;                                                 │
│ +  login: (email: string, password: string) => Promise<void>;               │
│ +  logout: () => void;                                                       │
│  }                                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

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
import { MarkdownRenderer } from '@apex/cli/ui/components';

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

## Technical Specifications

### Dependencies

- **ink**: React renderer for CLI applications
- **ink-syntax-highlight**: Syntax highlighting for code blocks
- **marked**: CommonMark markdown parsing
- **shiki**: Advanced syntax highlighting engine
- **fuse.js**: Fuzzy search for completions

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