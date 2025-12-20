# Input Preview User Guide

Input Preview is a powerful feature in APEX that lets you see exactly what will be sent to Claude and how it will be interpreted before executing your commands. This helps you verify your intent, catch potential issues, and understand how APEX processes your input.

## Overview

When Preview Mode is enabled, APEX shows you a detailed preview of your input before execution, including:
- **Raw Input**: Exactly what you typed
- **Detected Intent**: How APEX interprets your command
- **Confidence Level**: How certain APEX is about the interpretation
- **Action Buttons**: Options to proceed, cancel, or edit

## Enabling Preview Mode

Use the `/preview` command with various options:

```bash
/preview on      # Enable preview mode
/preview off     # Disable preview mode
/preview toggle  # Toggle current state
/preview status  # Check current status
```

### Quick Commands
```bash
/preview         # Same as /preview toggle
```

## How Preview Works

### 1. Enable Preview Mode
```bash
/preview on
```
You'll see a "📋 PREVIEW" indicator in the StatusBar.

### 2. Type Your Command
When you type a command or task, instead of executing immediately, APEX shows the Preview Panel:

```
┌─ Input Preview ─────────────────────────────────────────────────┐
│ Input: "implement user authentication with JWT tokens"          │
│                                                                 │
│ Intent: task_execution (85% confidence)                        │
│ This will be sent to the developer agent for implementation    │
│                                                                 │
│ [Enter] Execute  [Escape] Cancel  [E] Edit                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Choose Your Action
- **Enter**: Execute the command as shown
- **Escape**: Cancel and return to input
- **E**: Edit the input before executing

## Preview Panel Information

### Input Display
Shows exactly what you typed, preserving formatting and special characters:
```
Input: "/run tests --coverage --watch"
```

### Intent Detection
APEX analyzes your input and shows:
- **Intent Type**: What kind of command it detected
- **Confidence Percentage**: How sure APEX is (0-100%)
- **Description**: Human-readable explanation of what will happen

### Common Intent Types

| Intent | Description | Example Input |
|--------|-------------|---------------|
| `task_execution` | Running a development task | "implement user login" |
| `command_execution` | APEX command | "/status", "/help" |
| `question` | Information request | "what files handle routing?" |
| `agent_mention` | Specific agent interaction | "@reviewer check this code" |
| `workflow_execution` | Multi-step workflow | "--workflow feature-complete" |
| `session_management` | Session operations | "save session as login-work" |

### Confidence Levels

| Range | Meaning | Action |
|-------|---------|---------|
| 90-100% | Very confident | Safe to proceed |
| 70-89% | Confident | Usually safe, review intent |
| 50-69% | Uncertain | Check intent carefully |
| Below 50% | Low confidence | Consider rephrasing |

## Interactive Controls

### Navigation
- **Tab/Shift+Tab**: Move between buttons
- **Arrow Keys**: Navigate preview content (if scrollable)
- **Home/End**: Jump to start/end of content

### Actions

#### Execute (Enter)
Proceeds with the command as interpreted by APEX.

**Example:**
```
Input: "add error handling to the api endpoints"
Intent: task_execution (78% confidence)
→ [Enter] → Sends to developer agent for implementation
```

#### Cancel (Escape)
Dismisses the preview and returns to the input field. Your typed input remains in the field for editing.

**Example:**
```
Input: "fix the bug in login"
Intent: task_execution (45% confidence)
→ [Escape] → Back to input field, can retype or clarify
```

#### Edit (E)
Returns to the input field with your text selected, ready for editing.

**Example:**
```
Input: "optimize performance"
Intent: task_execution (60% confidence)
→ [E] → Input field shows "optimize performance" selected for editing
```

## Working with Different Input Types

### Simple Commands
```bash
Input: "/status"
Intent: command_execution (98% confidence)
This will show the current system status
```

### Task Descriptions
```bash
Input: "create a REST API for user management"
Intent: task_execution (85% confidence)
This will be sent to the developer agent for implementation
```

### Questions
```bash
Input: "what's the current test coverage?"
Intent: question (75% confidence)
This will analyze the project and provide coverage information
```

### Agent Mentions
```bash
Input: "@tester run the integration tests"
Intent: agent_mention (92% confidence)
This will be directed to the tester agent specifically
```

### Workflow Commands
```bash
Input: "--workflow code-review src/api/"
Intent: workflow_execution (88% confidence)
This will start the code-review workflow on src/api/
```

## Best Practices

### When to Use Preview Mode

**Always Use Preview For:**
- Complex or ambiguous commands
- High-stakes operations (deployments, deletions)
- When learning APEX command patterns
- Experimenting with new workflows

**Consider Using Preview For:**
- Multi-step tasks with dependencies
- Commands you haven't used recently
- When working with new team members
- Debugging command interpretation issues

**Optional for Preview:**
- Simple, familiar commands (`/help`, `/status`)
- Well-established workflow patterns
- Commands you use frequently

### Improving Intent Detection

#### Be Specific
```bash
# Vague (low confidence)
Input: "fix stuff"
Intent: task_execution (35% confidence)

# Specific (high confidence)
Input: "fix the memory leak in the user service"
Intent: task_execution (89% confidence)
```

#### Use Context
```bash
# Better
Input: "add input validation to the login form using Yup schema"
Intent: task_execution (91% confidence)

# Good but less clear
Input: "add validation"
Intent: task_execution (67% confidence)
```

#### Mention Specific Components
```bash
# Clear intent
Input: "@reviewer check the error handling in src/auth/login.ts"
Intent: agent_mention (95% confidence)

# Less clear
Input: "check error handling"
Intent: task_execution (58% confidence)
```

### Working with Low Confidence

When confidence is below 70%, consider:

1. **Add More Context**:
   ```bash
   # Instead of: "improve this"
   # Try: "improve the performance of the database queries in user service"
   ```

2. **Use Specific Keywords**:
   ```bash
   # Instead of: "make it better"
   # Try: "refactor the authentication middleware for better error handling"
   ```

3. **Reference Specific Files or Components**:
   ```bash
   # Instead of: "fix the bug"
   # Try: "fix the race condition bug in src/utils/cache.ts"
   ```

## Preview Mode Persistence

### Session-Based
Preview mode persists throughout your APEX session:
- Stays enabled across command executions
- Survives agent switches and workflow changes
- Resets to off when you start a new session

### Status Checking
```bash
/preview status
# Output: "Preview mode: ON" or "Preview mode: OFF"
```

## Combining with Other Features

### With Display Modes
Preview works with all display modes:
- **Normal**: Full preview panel
- **Compact**: Condensed preview (still functional)
- **Verbose**: Enhanced preview with additional debug info

### With Sessions
```bash
Input: "save current session as api-implementation-work"
Intent: session_management (94% confidence)
This will save your current session with the specified name
```

### With Workflows
```bash
Input: "--workflow feature-complete --stage testing"
Intent: workflow_execution (91% confidence)
This will start the feature-complete workflow at the testing stage
```

## Troubleshooting

### Preview Not Showing
If preview mode is enabled but previews don't appear:

1. **Check Status**: Run `/preview status`
2. **Re-enable**: Try `/preview off` then `/preview on`
3. **Simple Commands**: Some basic commands bypass preview (like `/help`)
4. **Input Length**: Very short inputs may not trigger preview

### Low Confidence Issues
If you consistently get low confidence scores:

1. **Be More Specific**: Add details about what you want
2. **Use Standard Patterns**: Follow common command structures
3. **Reference Documentation**: Check examples in guides
4. **Ask for Help**: Use `/help` to see available commands

### Preview Panel Not Responding
If keyboard controls don't work:

1. **Check Focus**: Make sure the terminal has focus
2. **Try Mouse**: Click on buttons if keyboard fails
3. **Restart**: Exit and restart APEX if controls are stuck
4. **Terminal Issues**: Some terminals have input handling quirks

## Advanced Usage

### Batch Operations
Preview can help with complex batch operations:
```bash
Input: "run tests for all components in src/ui/ and generate coverage report"
Intent: task_execution (82% confidence)
This will execute tests across multiple components with reporting
```

### Multi-Agent Coordination
```bash
Input: "@architect design the database schema, then @developer implement it"
Intent: agent_mention (87% confidence)
This will coordinate between architect and developer agents
```

### Conditional Logic
```bash
Input: "if tests pass, deploy to staging; otherwise run diagnostics"
Intent: task_execution (76% confidence)
This will execute conditional deployment logic
```

## Keyboard Shortcuts Summary

| Key | Action | Description |
|-----|--------|-------------|
| **Enter** | Execute | Run the command as shown |
| **Escape** | Cancel | Dismiss preview, keep input |
| **E** | Edit | Return to input field for editing |
| **Tab** | Navigate | Move between buttons |
| **Shift+Tab** | Navigate Back | Move to previous button |
| **Arrow Keys** | Scroll | Navigate preview content |

## Tips for Teams

### Code Reviews
Use preview to verify commands before sharing:
```bash
Input: "@reviewer please check the security implementation in auth/"
Preview: Shows exactly what will be sent to reviewer
```

### Documentation
Preview helps create better documentation by showing how commands are interpreted.

### Training
New team members can use preview mode to understand APEX command patterns and build confidence.

### Debugging
When commands don't work as expected, enable preview to see how APEX interprets them.

## Related Features

- **[Display Modes](display-modes.md)**: Customize how preview panels are shown
- **[Session Management](../sessions.md)**: Preview works with session commands
- **[Agent Workflows](../agents.md)**: Preview agent-specific commands
- **[Command Reference](../commands.md)**: Complete list of available commands