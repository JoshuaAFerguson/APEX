# Display Modes User Guide

APEX provides three display modes to customize how information is shown in the CLI interface: **Normal**, **Compact**, and **Verbose**. These modes help you balance between information density and screen real estate based on your preferences and workflow needs.

## Overview

| Mode | Description | Use Case |
|------|-------------|----------|
| **Normal** | Balanced information display | Default mode for most workflows |
| **Compact** | Minimal information, maximum space | Focus mode, small terminals, experienced users |
| **Verbose** | Maximum information display | Debugging, analysis, detailed monitoring |

## Switching Between Modes

Use the `/compact` and `/verbose` commands to toggle between display modes:

```bash
/compact     # Toggle compact mode on/off
/verbose     # Toggle verbose mode on/off
```

### Command Examples

```bash
# Enable compact mode
/compact

# Return to normal mode (run compact again)
/compact

# Enable verbose mode
/verbose

# Return to normal mode (run verbose again)
/verbose
```

**Note:** Modes are mutually exclusive. Enabling one mode automatically disables the other and returns you to normal when toggled off.

## Normal Mode

The default balanced display mode showing essential information without overwhelming detail.

### What's Shown:
- **StatusBar**: Connection status, git branch, agent, workflow stage, tokens, cost, model, session timer
- **AgentPanel**: Agent names with status icons and elapsed times
- **TaskProgress**: Multi-line task details with progress indicators
- **Messages**: Full message content with proper formatting
- **ActivityLog**: Standard system and tool messages

### Example StatusBar:
```
● feature/my-branch | ⚡developer | ▶implementation | tokens: 1.2k | cost: $0.0234 | model: claude-3-sonnet | 05:23
```

## Compact Mode

Minimalist display focusing only on essential information to maximize screen space.

### What's Shown:
- **StatusBar**: Connection status (●), git branch, cost only
- **AgentPanel**: Single-line agent list with pipe separators
- **TaskProgress**: Single-line task status
- **Messages**: Truncated to 80 characters, single line
- **ActivityLog**: Hidden entirely

### What's Hidden:
- Agent names and workflow stages in StatusBar
- Session timer in StatusBar
- Multi-line message formatting
- System and tool messages
- Detailed progress indicators

### Example StatusBar:
```
● feature/my-branch | $0.0234
```

### When to Use Compact Mode:
- Working on small terminal windows
- Focused coding sessions where you want minimal distractions
- When you're experienced with APEX and don't need detailed status info
- Pair programming or screen sharing scenarios

## Verbose Mode

Maximum information display for debugging, monitoring, and detailed analysis.

### What's Shown (Additional to Normal):
- **StatusBar**: Token breakdown (input→output), session cost, detailed timing info
- **ActivityLog**: Debug-level messages automatically enabled
- **AgentPanel**: Detailed agent debug information
- **Verbose Indicators**: Special "🔍 VERBOSE" indicator in StatusBar

### Enhanced StatusBar Information:
- **Token Breakdown**: Shows `1.5k→800` format instead of total
- **Timing Details**: Active time, idle time, stage elapsed time
- **Session Cost**: Separate from current task cost when different
- **All Segments**: Overrides terminal width constraints

### Example StatusBar:
```
● feature/my-branch | ⚡developer | ▶implementation | tokens: 1.5k→800 | total: 2.3k | cost: $0.0234 | session: $1.2500 | model: claude-3-sonnet | active: 3m42s | idle: 1m18s | stage: 45s | 🔍 VERBOSE | 08:15
```

### When to Use Verbose Mode:
- Debugging issues with task execution
- Monitoring resource usage (tokens, costs, timing)
- Understanding agent behavior and workflow stages
- Performance analysis and optimization
- Learning how APEX works under the hood

## Display Mode Persistence

Your selected display mode persists throughout your APEX session:
- Mode stays active across command executions
- Survives task runs and agent interactions
- Resets to normal when you start a new session

## Component Behavior by Mode

### StatusBar

> **📖 For Complete Element Documentation**: See the comprehensive [StatusBar Reference](../cli-guide.md#statusbar-reference) for detailed information about all 21 display elements, visual examples, color coding, and responsive behavior.

| Component | Normal | Compact | Verbose |
|-----------|--------|---------|---------|
| **Connection Status** | ● (green/red) | ● | ● |
| **Git Branch** | ⎇ branch-name | ⎇ branch | ⎇ branch |
| **Agent** | ⚡agent-name | ✗ | ⚡agent-name |
| **Workflow Stage** | ▶stage-name | ✗ | ▶stage-name |
| **Subtask Progress** | 📋 [X/Y] | ✗ | 📋 [X/Y] |
| **Tokens** | tokens: X.Xk | ✗ | tokens: X.Xk→Y.Yk + total: Z.Zk |
| **Cost** | cost: $X.XXXX | $X.XXXX | cost: $X.XXXX + session: $Y.YYYY |
| **Model** | model: name | ✗ | model: name |
| **Session Timer** | MM:SS | ✗ | MM:SS |
| **Timing Details** | ✗ | ✗ | active: XmXXs + idle: XmXXs + stage: XmXXs |
| **Session Name** | ✗ | ✗ | 💾 session-name |
| **Server URLs** | ✗ | ✗ | api:XXXX + web:XXXX |
| **Mode Indicators** | ✗ | ✗ | 🔍 VERBOSE + 📋 PREVIEW + 💭 THOUGHTS |

**Element Count by Mode:**
- **Normal Mode**: 9 core elements (responsive: 6-9 based on terminal width)
- **Compact Mode**: 3 essential elements only
- **Verbose Mode**: Up to 21 elements (all available data shown)

### AgentPanel
- **Normal**: Multi-line with status icons and details
- **Compact**: Single line: `⚡developer[42s] │ ○tester │ ○reviewer`
- **Verbose**: Includes debug information and verbose agent rows

### TaskProgress
- **Normal**: Multi-line with progress bars and descriptions
- **Compact**: Single line: `✓ pending abc123 Task description... ⚡agent 1.2ktk $0.05`
- **Verbose**: Same as normal with additional debug context

### Messages
- **Normal**: Full content with proper formatting
- **Compact**: Truncated to 80 chars, single line, newlines replaced with spaces
- **Verbose**: Same as normal with additional metadata

### ActivityLog
- **Normal**: Standard system and tool messages
- **Compact**: Hidden (not shown)
- **Verbose**: Automatically shows debug-level messages

## Tips and Best Practices

### Quick Mode Switching
Create aliases or shortcuts for faster mode switching:
```bash
# In your shell profile
alias apex-compact="echo '/compact'"
alias apex-verbose="echo '/verbose'"
```

### Mode Selection Guidelines

**Start with Normal mode** for general use, then switch as needed:

- Switch to **Compact** when:
  - Working in a small terminal
  - Doing focused coding work
  - Presenting or screen sharing
  - You know APEX well and want minimal UI

- Switch to **Verbose** when:
  - Debugging task failures
  - Monitoring resource usage
  - Learning APEX workflows
  - Analyzing performance issues

### Terminal Width Considerations

Display modes adapt to your terminal width:

- **Narrow terminals** (<80 chars): Even normal mode shows abbreviated labels
- **Wide terminals** (≥120 chars): All modes show more information when space allows
- **Compact mode**: Always minimal regardless of terminal width
- **Verbose mode**: Shows all information regardless of width

## Accessibility Features

All display modes maintain accessibility:
- Connection status indicator (●/○) always visible
- Critical information preserved across all modes
- Color coding consistent between modes
- Keyboard navigation unaffected by display mode

## Troubleshooting

### Mode Not Changing
If display mode commands don't work:
1. Check you're typing the exact command: `/compact` or `/verbose`
2. Ensure you're not in a submenu or dialog
3. Try typing `/help` to verify command recognition

### Information Missing in Compact Mode
This is expected behavior. If you need more information:
- Switch to normal mode with `/compact` (toggles off)
- Use `/verbose` for maximum information
- Check that the missing info isn't in a different component

### Verbose Mode Too Cluttered
If verbose mode shows too much information:
- Switch back to normal mode with `/verbose` (toggles off)
- Consider compact mode for minimal display
- Check your terminal width - wider terminals show more info

## Related Features

- **Input Preview**: Works with all display modes (see [Input Preview Guide](input-preview.md))
- **Themes**: Display modes work with all theme settings
- **Session Management**: Mode preference persists per session
- **Keyboard Shortcuts**: Available regardless of display mode

## Advanced Usage

### Combining with Other Features
Display modes work seamlessly with:
- Preview mode (`/preview on`)
- Session switching
- Agent workflows
- Multi-task operations

### Performance Considerations
- **Compact mode**: Slightly faster rendering due to fewer components
- **Verbose mode**: May impact performance on very slow terminals
- **Normal mode**: Optimal balance of information and performance