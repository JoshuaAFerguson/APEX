# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with APEX.

## Quick Diagnostics

Run these commands to check your setup:

```bash
# Check APEX version
apex --version

# Verify configuration
apex config

# List agents
apex agents

# List workflows
apex workflows

# Check recent tasks
apex status
```

## Common Issues

### "APEX not initialized"

**Error:**
```
APEX not initialized. Run "apex init" first.
```

**Cause:** Running APEX commands in a directory without `.apex/` folder.

**Solution:**
```bash
# Initialize APEX in your project
apex init

# Or navigate to an initialized project
cd /path/to/your/project
```

---

### "ANTHROPIC_API_KEY not set"

**Error:**
```
Error: ANTHROPIC_API_KEY environment variable is not set
```

**Cause:** API key not configured.

**Solution:**

**Unix/Linux/macOS:**
```bash
# Set temporarily
export ANTHROPIC_API_KEY=your_key_here

# Set permanently (add to shell profile)
echo 'export ANTHROPIC_API_KEY=your_key_here' >> ~/.bashrc
source ~/.bashrc
```

**Windows Command Prompt:**
```cmd
# Set temporarily
set ANTHROPIC_API_KEY=your_key_here

# Set permanently using setx
setx ANTHROPIC_API_KEY "your_key_here"
# Restart your terminal after this command
```

**Windows PowerShell:**
```powershell
# Set temporarily
$env:ANTHROPIC_API_KEY="your_key_here"

# Set permanently
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your_key_here", "User")
# Restart your terminal after this command
```

---

### Task Exceeds Budget

**Error:**
```
Task exceeded maximum cost limit of $10.00
```

**Cause:** Task used more tokens than the configured limit.

**Solutions:**

1. **Increase the limit:**
```yaml
# .apex/config.yaml
limits:
  maxCostPerTask: 20.00
```

2. **Break down the task:**
```bash
# Instead of one large task
apex run "Build entire authentication system"

# Use multiple smaller tasks
apex run "Add login endpoint"
apex run "Add registration endpoint"
apex run "Add password reset"
```

3. **Use a cheaper model:**
```yaml
# .apex/agents/developer.md
model: sonnet  # Instead of opus
```

---

### Task Times Out

**Error:**
```
Task exceeded maximum turns (50)
```

**Cause:** Task took too many turns without completing.

**Solutions:**

1. **Increase turn limit:**
```yaml
# .apex/config.yaml
limits:
  maxTurns: 100
```

2. **Simplify the task:**
```bash
# More specific = fewer turns needed
apex run "Add validateEmail function to src/utils/validation.ts"
```

3. **Check for loops:** Review logs for repetitive actions.

---

### Agent Makes Wrong Changes

**Symptoms:**
- Changes unrelated files
- Implements wrong solution
- Breaks existing functionality

**Solutions:**

1. **Add more context:**
```bash
apex run "Add feature X. Only modify files in src/features/. Do not change existing tests."
```

2. **Use acceptance criteria:**
```bash
apex run "Add feature" --criteria "Must not break existing tests. Must follow patterns in src/features/auth"
```

3. **Lower autonomy:**
```bash
apex run "Add feature" --autonomy manual
```

4. **Customize agent prompts:** Add project-specific guidance to agent definitions.

---

### Git Conflicts

**Error:**
```
error: Your local changes would be overwritten by merge
```

**Cause:** Uncommitted changes in the working directory.

**Solutions:**

1. **Commit or stash changes:**
```bash
git stash
apex run "task"
git stash pop
```

2. **Use a clean branch:**
```bash
git checkout -b apex-workspace
apex run "task"
```

---

### "Command blocked"

**Error:**
```
Blocked: Command matches dangerous pattern "rm -rf /"
```

**Cause:** APEX blocked a potentially dangerous command.

**Solution:** This is a safety feature. Review why the command was attempted:

```bash
# Check logs
apex logs <task-id> --level warn
```

If the command is necessary and safe, modify your task to be more specific about what should be deleted.

---

### WebSocket Connection Failed

**Error:**
```
WebSocket connection to 'ws://localhost:3000/stream/task_...' failed
```

**Cause:** API server not running or wrong port.

**Solutions:**

1. **Start the server:**
```bash
apex serve --port 3000
```

2. **Check the port:**
```bash
# See what's running on port 3000
lsof -i :3000
```

3. **Use correct URL:**
```javascript
// Match the server port
const ws = new WebSocket('ws://localhost:3000/stream/' + taskId);
```

---

### Task Stuck in "pending"

**Symptoms:** Task stays in pending state, doesn't progress.

**Causes:**
- Server not running
- Task queue issue
- Initialization error

**Solutions:**

1. **Check task details:**
```bash
apex status <task-id>
apex logs <task-id>
```

2. **Retry the task:**
```bash
apex retry <task-id>
```

3. **Cancel and recreate:**
```bash
apex cancel <task-id>
apex run "same task description"
```

---

### "Agent not found"

**Error:**
```
Agent 'custom-agent' not found
```

**Cause:** Workflow references an agent that doesn't exist.

**Solution:**

1. **Check agent exists:**
```bash
apex agents
ls .apex/agents/
```

2. **Create the agent:**
```bash
# Create .apex/agents/custom-agent.md
```

3. **Fix the workflow:**
```yaml
# Check .apex/workflows/feature.yaml
stages:
  - name: custom-stage
    agent: custom-agent  # Must match agent file name
```

---

### "Workflow not found"

**Error:**
```
Workflow 'custom' not found
```

**Cause:** Specified workflow doesn't exist.

**Solution:**

1. **List available workflows:**
```bash
apex workflows
```

2. **Use correct name:**
```bash
apex run "task" --workflow feature  # Use existing workflow
```

3. **Create the workflow:**
```bash
# Create .apex/workflows/custom.yaml
```

---

### TypeScript/Build Errors

**Symptoms:** APEX creates code that doesn't compile.

**Solutions:**

1. **Add language to config:**
```yaml
# .apex/config.yaml
project:
  language: typescript
```

2. **Include build info in task:**
```bash
apex run "Add feature. Project uses TypeScript strict mode. Run 'npm run build' to verify."
```

3. **Add testing stage:**
```yaml
# Workflow should include test stage
stages:
  - name: implementation
    agent: developer
  - name: testing
    agent: tester
    description: Verify build and tests pass
```

---

### Tests Fail After Changes

**Symptoms:** Existing tests break after APEX changes.

**Solutions:**

1. **Include test verification:**
```bash
apex run "Add feature. Ensure all existing tests pass."
```

2. **Add test stage to workflow:**
```yaml
stages:
  - name: implementation
    agent: developer
  - name: testing
    agent: tester
    description: Run existing tests, add new tests
```

3. **Use manual autonomy:**
```bash
apex run "Add feature" --autonomy manual
```

---

## Debugging

### Enable Verbose Output

```bash
apex run "task" --verbose
```

### Check Logs

```bash
# All logs
apex logs <task-id>

# Filter by level
apex logs <task-id> --level error
apex logs <task-id> --level warn
apex logs <task-id> --level debug
```

### Dry Run Mode

Test without executing:

```bash
apex run "task" --dry-run
```

### Step Through Manually

Use manual autonomy to review each step:

```bash
apex run "task" --autonomy manual
```

---

## Configuration Issues

### Validate Config

```bash
# Show current config
apex config

# Output as JSON for validation
apex config --json
```

### Reset to Defaults

```bash
# Backup current config
cp .apex/config.yaml .apex/config.yaml.backup

# Reinitialize
rm -rf .apex
apex init
```

### Check Agent Syntax

Agent files must have valid YAML frontmatter:

```markdown
---
name: agent-name          # Required
description: Description  # Required
tools: Read, Write       # Optional
model: sonnet            # Optional
---

Prompt content here...
```

### Check Workflow Syntax

Workflow files must be valid YAML:

```yaml
name: workflow-name       # Required
description: Description  # Required
stages:                   # Required
  - name: stage-name      # Required
    agent: agent-name     # Required
    description: Desc     # Required
```

---

## Performance Issues

### Slow Task Execution

**Causes:**
- Large codebase
- Complex prompts
- Heavy model (opus)

**Solutions:**

1. **Use faster models:**
```yaml
# Use haiku for simple tasks
model: haiku
```

2. **Add file patterns to prompts:**
```bash
apex run "Add feature. Focus on src/features/ directory."
```

3. **Simplify tasks:**
```bash
# Break into smaller tasks
apex run "Step 1"
apex run "Step 2"
```

---

## Windows-Specific Issues

### "Module not found" or "Command not found" on Windows

**Symptoms:**
- `apex` command not recognized
- Global npm packages not found

**Cause:** npm global installation path not in PATH environment variable.

**Solutions:**

1. **Find npm global installation path:**
```powershell
npm config get prefix
# Usually C:\Users\<username>\AppData\Roaming\npm
```

2. **Add to PATH environment variable:**
   - Press `Win + R`, type `sysdm.cpl`, press Enter
   - Click "Environment Variables"
   - Under "User variables", find and edit "Path"
   - Add the npm global path (e.g., `C:\Users\<username>\AppData\Roaming\npm`)
   - Click OK and restart your terminal

3. **Or set npm prefix to a PATH-accessible location:**
```powershell
npm config set prefix "%APPDATA%\npm"
```

### PowerShell Execution Policy Restrictions

**Error:**
```
execution of scripts is disabled on this system
```

**Cause:** PowerShell execution policy prevents script execution.

**Solution:**
```powershell
# Check current policy
Get-ExecutionPolicy

# Set to allow local scripts (recommended)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or allow all scripts (less secure)
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
```

### Windows Path Separator Issues

**Symptoms:**
- File path errors in logs
- "Cannot find file" errors with forward slashes

**Cause:** Windows uses backslashes (`\`) while Unix uses forward slashes (`/`).

**Solution:** APEX handles this automatically, but if you see issues:

1. Use `path.join()` or `path.resolve()` in custom scripts
2. Check `.apex/config.yaml` for correct path separators
3. Report path-related issues as they should be automatically handled

### Service Management Not Available

**Error:**
```
Service management not supported on Windows
```

**Cause:** Windows service management is not yet implemented.

**Workaround:**
1. **Run APEX manually in a persistent terminal session**
2. **Use Windows Task Scheduler to start APEX on boot:**
   - Open Task Scheduler (`taskschd.msc`)
   - Create Basic Task
   - Trigger: "When the computer starts"
   - Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c "cd /d C:\path\to\your\project && apex serve"`

3. **Use Windows Services Wrapper (NSSM):**
```powershell
# Install NSSM
winget install NSSM.NSSM

# Install APEX as Windows service
nssm install apex-service
# Set Application path to: node.exe
# Set Arguments to: C:\Users\<username>\AppData\Roaming\npm\node_modules\@apexcli\cli\dist\index.js serve
# Set Startup directory to your project directory
```

### Git Bash Compatibility Issues

**Symptoms:**
- Color/formatting issues in Git Bash
- Unicode characters not displaying

**Solutions:**
1. **Use Windows Terminal with Git Bash:** Provides better color and Unicode support
2. **Enable Unicode in Git Bash:**
```bash
# Add to ~/.bashrc
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

3. **Use PowerShell or Command Prompt instead** for the best APEX experience

### Permission Issues During Development

**Symptoms:**
- Cannot create files in project directory
- "Access denied" errors during npm operations

**Solutions:**
1. **Run terminal as Administrator** (not recommended for regular use)
2. **Change project location** to a user-writable directory like `C:\Users\<username>\Projects\`
3. **Check Windows Defender** isn't blocking Node.js operations
4. **Use Developer Mode** in Windows 10/11 Settings → Update & Security → For developers

---

## Getting Help

### Check Documentation

- [Getting Started](getting-started.md)
- [Windows Installation Guide](windows-installation.md)
- [Service Management Guide](service-management.md)
- [Agent Authoring Guide](agents.md)
- [Workflow Authoring Guide](workflows.md)
- [Best Practices](best-practices.md)
- [API Reference](api-reference.md)

### Report Issues

1. Gather information:
```bash
apex --version
apex config --json
apex logs <task-id>
```

2. Open an issue on GitHub with:
   - APEX version
   - Task description
   - Error message
   - Relevant logs

[GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues)

### Community Support

- [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions)
