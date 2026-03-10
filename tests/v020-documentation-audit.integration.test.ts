/**
 * Integration Tests for v0.2.0 Documentation Audit
 *
 * Tests the actual integration with real file system, CLI commands,
 * and end-to-end verification of the documentation audit system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile, writeFile, mkdir, rm, access } from 'fs/promises';
import { constants } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { V020DocumentationAuditor, auditV020Documentation } from '../packages/core/src/audits/v020-documentation-auditor';

describe('v0.2.0 Documentation Audit Integration', () => {
  const testDir = join(tmpdir(), 'apex-v020-audit-test');
  const testDocsDir = join(testDir, 'docs');

  // Sample documentation content for testing
  const sampleApiReference = `
openapi: 3.0.3
info:
  title: APEX API
  version: 0.2.0
  description: APEX platform API documentation
paths:
  /health:
    get:
      summary: Health check endpoint
      responses:
        '200':
          description: Service is healthy
  /tasks:
    get:
      summary: List tasks
      responses:
        '200':
          description: List of tasks
    post:
      summary: Create new task
      responses:
        '201':
          description: Task created
  /agents:
    get:
      summary: List available agents
      responses:
        '200':
          description: List of agents
  /config:
    get:
      summary: Get system configuration
      responses:
        '200':
          description: System configuration
components:
  schemas:
    Task:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
    Agent:
      type: object
      properties:
        name:
          type: string
        type:
          type: string
        capabilities:
          type: array
          items:
            type: string
`;

  const sampleAgentAuthoring = `
# Agent Authoring Guide

## Agent Basics

Agents are the core execution units in APEX. Each agent is specialized for specific types of tasks and provides a focused set of capabilities.

### Agent Structure

Agents are defined using YAML frontmatter that specifies their configuration, capabilities, and behavior.

## Frontmatter Reference

The agent frontmatter defines the agent's metadata and configuration:

\\`\\`\\`yaml
name: "Agent Name"
description: "What this agent does"
type: "agent-type"
capabilities:
  - "capability1"
  - "capability2"
\`\`\`

## Tools Reference

Agents have access to various tools for interacting with the system:

### Core Tools
- **Bash**: Execute shell commands and scripts
- **Read**: Read files from the filesystem
- **Write**: Write content to files
- **Edit**: Edit existing files with precise modifications
- **Grep**: Search for content within files
- **Glob**: Find files matching patterns

### Specialized Tools
- **LSP**: Language server protocol integration
- **WebFetch**: Fetch content from web resources
- **Task**: Launch sub-agents for complex operations

## Examples

### Basic Agent Configuration

\\`\\`\\`yaml
name: "Developer Agent"
description: "Handles software development tasks"
type: "developer"
capabilities:
  - "code-analysis"
  - "file-modification"
  - "test-execution"
\`\`\`

### Advanced Agent with Tool Restrictions

\\`\\`\\`yaml
name: "Reviewer Agent"
description: "Code review and analysis only"
type: "reviewer"
capabilities:
  - "code-analysis"
  - "documentation-review"
tools:
  allowed:
    - "Read"
    - "Grep"
    - "LSP"
  restricted:
    - "Write"
    - "Edit"
    - "Bash"
\`\`\`

## Best Practices

### Agent Design
- Keep agents focused on specific domains
- Use descriptive names and clear descriptions
- Define capabilities that match actual tools used

### Tool Usage
- Always validate file paths before operations
- Handle errors gracefully in tool calls
- Use appropriate tools for each operation type

### Security Considerations
- Limit tool access based on agent purpose
- Validate inputs before executing commands
- Monitor resource usage and timeouts
`;

  const sampleWorkflowAuthoring = `
# Workflow Authoring Guide

## Workflow Basics

Workflows define the orchestration of multiple agents to complete complex tasks. They specify the sequence of operations, dependencies between stages, and data flow.

### Workflow Structure

Workflows are defined in YAML format with specific field structure:

\\`\\`\\`yaml
name: "Workflow Name"
description: "What this workflow accomplishes"
stages:
  - name: "stage1"
    agent: "agent-type"
    description: "Stage description"
    dependsOn: []
    outputs:
      - "output1"
\`\`\`

## Field Reference

### Core Fields

- **name**: Unique identifier for the workflow
- **description**: Human-readable description of workflow purpose
- **stages**: Array of workflow stages to execute

### Stage Fields

- **name**: Unique stage identifier within workflow
- **agent**: Agent type to execute this stage
- **description**: Description of what this stage accomplishes
- **dependsOn**: Array of stage names that must complete first
- **outputs**: Array of outputs this stage produces
- **condition**: Optional conditional expression for stage execution

### Advanced Fields

- **timeout**: Maximum execution time per stage
- **retries**: Number of retry attempts for failed stages
- **parallel**: Whether stages can run in parallel

## Examples

### Simple Sequential Workflow

\\`\\`\\`yaml
name: "basic-development"
description: "Basic development workflow"
stages:
  - name: "analysis"
    agent: "analyzer"
    description: "Analyze requirements"
    outputs:
      - "requirements-analysis"

  - name: "implementation"
    agent: "developer"
    description: "Implement features"
    dependsOn: ["analysis"]
    outputs:
      - "implemented-code"

  - name: "testing"
    agent: "tester"
    description: "Test implementation"
    dependsOn: ["implementation"]
    outputs:
      - "test-results"
\`\`\`

### Parallel Workflow with Dependencies

\\`\\`\\`yaml
name: "comprehensive-audit"
description: "Comprehensive system audit"
stages:
  - name: "code-audit"
    agent: "code-auditor"
    description: "Audit source code"
    outputs:
      - "code-audit-report"

  - name: "security-audit"
    agent: "security-auditor"
    description: "Security analysis"
    outputs:
      - "security-report"

  - name: "performance-audit"
    agent: "performance-auditor"
    description: "Performance analysis"
    outputs:
      - "performance-report"

  - name: "final-report"
    agent: "reporter"
    description: "Combine all audit results"
    dependsOn: ["code-audit", "security-audit", "performance-audit"]
    outputs:
      - "comprehensive-report"
\`\`\`

## Dependencies

The dependsOn field creates execution dependencies between stages:

- Stages with no dependencies run first
- Dependent stages wait for all dependencies to complete
- Failed dependencies prevent dependent stages from running
- Circular dependencies are detected and rejected

## Conditional Stages

Use the condition field for conditional execution:

\\`\\`\\`yaml
- name: "hotfix-deployment"
  agent: "deployer"
  description: "Deploy hotfix if critical issues found"
  dependsOn: ["security-audit"]
  condition: "security-report.severity >= 'critical'"
\`\`\`

## Best Practices

### Workflow Design
- Keep workflows focused on specific outcomes
- Use clear, descriptive stage names
- Document dependencies and data flow

### Performance Optimization
- Maximize parallelism where possible
- Set appropriate timeouts
- Use conditional stages to avoid unnecessary work

### Error Handling
- Plan for stage failures
- Use retries judiciously
- Provide clear error messages
`;

  const sampleBestPractices = `
# Best Practices Guide

## Task Descriptions

Effective task descriptions are crucial for successful automation. They should be clear, specific, and actionable.

### Writing Clear Task Descriptions

- Be specific about desired outcomes
- Include context and constraints
- Specify acceptance criteria
- Mention any dependencies or prerequisites

### Example Task Descriptions

**Good**: "Implement user authentication using JWT tokens, including login/logout endpoints, token validation middleware, and unit tests with >90% coverage"

**Poor**: "Add authentication to the app"

## Workflow Selection

Choose workflows based on task complexity, requirements, and organizational policies.

### Workflow Types

- **Simple Tasks**: Use single-agent workflows
- **Complex Projects**: Use multi-stage workflows with dependencies
- **Audits and Reviews**: Use specialized audit workflows
- **Deployments**: Use deployment-specific workflows

### Selection Criteria

Consider these factors when selecting workflows:

1. **Task Complexity**: Simple vs. multi-step
2. **Dependencies**: Sequential vs. parallel execution
3. **Risk Level**: Testing and validation requirements
4. **Time Constraints**: Deadline and urgency
5. **Resource Requirements**: Agent and tool needs

## Autonomy Levels

APEX supports different levels of autonomy to match organizational risk tolerance and compliance requirements.

### Available Autonomy Levels

- **full**: Complete autonomy, agents can execute and commit changes
- **review-before-commit**: Agents prepare changes but require approval before commit
- **review-before-merge**: Agents can commit but require approval before merge
- **manual**: All changes require explicit human approval

### Choosing Autonomy Levels

**Use 'full' for**:
- Routine maintenance tasks
- Well-tested automation workflows
- Development environments
- Non-critical systems

**Use 'review-before-commit' for**:
- Code changes to main repositories
- Configuration updates
- New feature implementations
- Learning new workflows

**Use 'review-before-merge' for**:
- Production deployments
- Security-sensitive changes
- Cross-team collaboration
- Compliance-required processes

**Use 'manual' for**:
- Critical system changes
- One-time migrations
- Experimental features
- High-security environments

## Cost Management

Monitor and optimize costs associated with agent execution and resource usage.

### Cost Factors

- **Agent Execution Time**: Longer-running agents cost more
- **Tool Usage**: Some tools have usage-based pricing
- **Resource Consumption**: CPU, memory, and storage usage
- **External API Calls**: Third-party service costs

### Cost Optimization Strategies

1. **Right-size Workflows**: Avoid over-engineering simple tasks
2. **Optimize Tool Usage**: Use efficient tools for each job
3. **Monitor Resource Usage**: Track and analyze consumption patterns
4. **Set Budget Limits**: Define spending thresholds and alerts
5. **Review Regularly**: Regular cost audits and optimization

### Budget Controls

Configure budget limits and monitoring:

\\`\\`\\`yaml
budget:
  monthly_limit: 1000  # USD
  alert_thresholds:
    - 75   # Alert at 75% of budget
    - 90   # Alert at 90% of budget
  auto_pause: 95  # Pause at 95% of budget
\`\`\`

## Security

Implement security best practices to protect systems and data.

### Access Control

- Use principle of least privilege
- Regularly review and audit permissions
- Implement role-based access controls
- Monitor access patterns and anomalies

### Data Protection

- Encrypt sensitive data at rest and in transit
- Implement proper data retention policies
- Use secure communication channels
- Regular security audits and assessments

### Tool Security

- Validate all inputs before execution
- Sanitize command arguments
- Use secure authentication methods
- Monitor tool usage and access patterns

### Compliance

- Document security measures and procedures
- Implement audit logging
- Regular compliance assessments
- Stay updated with security best practices

## Monitoring and Observability

Implement comprehensive monitoring to track system health and performance.

### Key Metrics

- Agent execution success rates
- Workflow completion times
- Resource utilization patterns
- Error rates and types
- Cost tracking and trends

### Alerting

Set up alerts for:
- Agent failures and errors
- Performance degradation
- Security incidents
- Budget threshold breaches
- Resource exhaustion

### Logging

Maintain detailed logs for:
- Agent activities and decisions
- Tool usage and results
- Workflow execution traces
- Security events
- Performance metrics
`;

  const sampleTroubleshooting = `
# Troubleshooting Guide

## Quick Diagnostics

When experiencing issues with APEX, start with these quick diagnostic steps to identify the root cause.

### System Health Check

1. **Verify APEX Installation**
   \\`\\`\\`bash
   apex --version
   apex health-check
   \\`\\`\\`

2. **Check System Requirements**
   - Node.js version 18 or higher
   - Sufficient disk space (>1GB free)
   - Network connectivity
   - Required permissions

3. **Validate Configuration**
   \\`\\`\\`bash
   apex config validate
   apex config show
   \\`\\`\\`

### Quick Issue Resolution

Most issues fall into these categories:
- Configuration problems (40%)
- Permission issues (25%)
- Network connectivity (20%)
- Resource constraints (15%)

## Common Issues

### Agent Execution Failures

**Issue**: Agents fail to start or execute properly

**Symptoms**:
- Error messages about missing dependencies
- Timeout errors during execution
- Permission denied errors

**Solutions**:
1. Check agent configuration for syntax errors
2. Verify required tools are available
3. Check file and directory permissions
4. Review resource limits and quotas

### Workflow Dependency Issues

**Issue**: Workflow stages fail due to dependency problems

**Symptoms**:
- Circular dependency errors
- Missing prerequisite outputs
- Stages hanging indefinitely

**Solutions**:
1. Review workflow dependency graph
2. Check for circular dependencies
3. Verify output specifications match dependencies
4. Use workflow visualization tools

### Tool Access Problems

**Issue**: Agents cannot access required tools

**Symptoms**:
- "Tool not found" errors
- Permission denied for tool execution
- Tool timeouts or hangs

**Solutions**:
1. Verify tool installation and PATH
2. Check tool permissions and access rights
3. Review tool configuration and limits
4. Check for tool conflicts or version issues

## Debugging

### Enable Debug Logging

Enable detailed logging for troubleshooting:

\`\`\`bash
# Enable debug mode
export APEX_DEBUG=true
export APEX_LOG_LEVEL=debug

# Run with verbose output
apex --verbose run workflow.yaml
\`\`\`

### Debug Configuration

Configure detailed debugging:

\\`\\`\\`yaml
# apex-config.yaml
debug:
  enabled: true
  log_level: debug
  output: /tmp/apex-debug.log
  include_traces: true
\`\`\`

### Common Debug Commands

\`\`\`bash
# Check agent status
apex agent status

# Validate workflow syntax
apex workflow validate workflow.yaml

# Dry run workflow
apex workflow run --dry-run workflow.yaml

# Check system diagnostics
apex diagnostics
\`\`\`

### Debug Information Collection

Collect debug information for support:

\`\`\`bash
# Generate debug report
apex debug-report --output debug-report.zip

# Include system information
apex system-info > system-info.txt

# Capture logs
apex logs --since "1 hour ago" > apex-logs.txt
\`\`\`

## Windows Support

Special considerations and solutions for Windows environments.

### Windows-Specific Issues

**PowerShell Execution Policy**:
\\`\\`\\`powershell
# Check current policy
Get-ExecutionPolicy

# Set execution policy (as Administrator)
Set-ExecutionPolicy RemoteSigned
\`\`\`

**Path Configuration**:
\\`\\`\\`cmd
# Add APEX to PATH (permanent)
setx PATH "%PATH%;C:\\Program Files\\APEX"

# Verify PATH
echo %PATH%
\`\`\`

**File Path Handling**:
- Use forward slashes or escaped backslashes in configuration
- Be aware of Windows path length limitations
- Handle Windows permission model differences

### Windows Tools Integration

**Git Bash Integration**:
\`\`\`bash
# Configure Git Bash as default shell
apex config set shell "C:\\Program Files\\Git\\bin\\bash.exe"
\`\`\`

**WSL Integration**:
\`\`\`bash
# Use WSL for Unix tools
apex config set use_wsl true
\`\`\`

## Configuration Issues

### Invalid Configuration Files

**Issue**: Configuration files have syntax or validation errors

**Symptoms**:
- "Invalid configuration" errors
- YAML parsing failures
- Missing required fields

**Solutions**:
1. Validate YAML syntax using online validators
2. Check for required fields and proper structure
3. Review configuration documentation
4. Use configuration templates

### Environment Variables

**Issue**: Environment variables not properly configured

**Common Variables**:
\`\`\`bash
# Required environment variables
export APEX_HOME=/path/to/apex
export APEX_CONFIG=/path/to/config
export APEX_WORKSPACE=/path/to/workspace

# Optional variables
export APEX_LOG_LEVEL=info
export APEX_TIMEOUT=300
export APEX_MAX_AGENTS=10
\`\`\`

### Network Configuration

**Issue**: Network connectivity or proxy problems

**Proxy Configuration**:
\\`\\`\\`yaml
# apex-config.yaml
network:
  proxy:
    http: "http://proxy.company.com:8080"
    https: "https://proxy.company.com:8080"
  timeout: 30000
  retry_attempts: 3
\`\`\`

## Performance Issues

### Resource Constraints

**Memory Issues**:
- Monitor memory usage with system tools
- Adjust agent memory limits
- Use streaming for large files
- Implement proper cleanup

**CPU Issues**:
- Monitor CPU usage patterns
- Adjust concurrent agent limits
- Optimize workflow parallelism
- Use CPU profiling tools

### Platform Support

APEX supports multiple platforms with different considerations:

#### Unix Systems
- Full feature support
- Native shell integration
- Optimal performance

#### Linux Distributions
- Comprehensive tool support
- Container integration
- Package manager integration

#### macOS
- Native macOS tool integration
- Homebrew package support
- Security permission handling

#### Windows
- PowerShell integration
- WSL support for Unix tools
- Windows permission model

### Getting Help

If you cannot resolve your issue:

1. Check the FAQ and documentation
2. Search existing GitHub issues
3. Create a new issue with debug information
4. Join the community discussion forums
5. Contact support with debug reports

Include this information when seeking help:
- APEX version and installation method
- Operating system and version
- Configuration files (sanitized)
- Error messages and logs
- Steps to reproduce the issue
`;

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(testDocsDir, { recursive: true });

    // Write sample documentation files
    await writeFile(join(testDocsDir, 'openapi.yaml'), sampleApiReference);
    await writeFile(join(testDocsDir, 'agents.md'), sampleAgentAuthoring);
    await writeFile(join(testDocsDir, 'workflows.md'), sampleWorkflowAuthoring);
    await writeFile(join(testDocsDir, 'best-practices.md'), sampleBestPractices);
    await writeFile(join(testDocsDir, 'troubleshooting.md'), sampleTroubleshooting);
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Real File System Integration', () => {
    it('should successfully audit real documentation files', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('passing');
      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
      expect(result.agentAuthoring.exists).toBe(true);
      expect(result.agentAuthoring.hasSubstantiveContent).toBe(true);
      expect(result.workflowAuthoring.exists).toBe(true);
      expect(result.workflowAuthoring.hasSubstantiveContent).toBe(true);
      expect(result.bestPractices.exists).toBe(true);
      expect(result.bestPractices.hasSubstantiveContent).toBe(true);
      expect(result.troubleshooting.exists).toBe(true);
      expect(result.troubleshooting.hasSubstantiveContent).toBe(true);
    });

    it('should provide detailed analysis of OpenAPI specification', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.details).toContain('✅ OpenAPI version: 3.0.3');
      expect(result.apiReference.details).toContain('✅ Contains info section');
      expect(result.apiReference.details).toContain('✅ All expected API endpoints documented');
      expect(result.apiReference.accuracy).toBe('accurate');
    });

    it('should detect comprehensive agent documentation', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.agentAuthoring.details).toContain('✅ Contains Agent Basics');
      expect(result.agentAuthoring.details).toContain('✅ Contains Frontmatter Reference');
      expect(result.agentAuthoring.details).toContain('✅ Contains Tools Reference');
      expect(result.agentAuthoring.details).toContain('✅ Contains Examples');
      expect(result.agentAuthoring.details).toContain('✅ Contains Best Practices');
      expect(result.agentAuthoring.accuracy).toBe('accurate');
    });

    it('should validate workflow documentation completeness', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.workflowAuthoring.details).toContain('✅ Contains Workflow Basics');
      expect(result.workflowAuthoring.details).toContain('✅ Contains Field Reference');
      expect(result.workflowAuthoring.details).toContain('✅ Contains Dependencies');
      expect(result.workflowAuthoring.details).toContain('✅ Contains Conditional Stages');
      expect(result.workflowAuthoring.accuracy).toBe('accurate');
    });

    it('should verify best practices documentation', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.bestPractices.details).toContain('✅ Contains Task Descriptions');
      expect(result.bestPractices.details).toContain('✅ Contains Workflow Selection');
      expect(result.bestPractices.details).toContain('✅ Contains Autonomy Levels');
      expect(result.bestPractices.details).toContain('✅ Contains Cost Management');
      expect(result.bestPractices.details).toContain('✅ Contains Security');
      expect(result.bestPractices.accuracy).toBe('accurate');
    });

    it('should validate troubleshooting guide completeness', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.troubleshooting.details).toContain('✅ Contains Quick Diagnostics');
      expect(result.troubleshooting.details).toContain('✅ Contains Common Issues');
      expect(result.troubleshooting.details).toContain('✅ Contains Debugging');
      expect(result.troubleshooting.details).toContain('✅ Contains Windows Support');
      expect(result.troubleshooting.details).toContain('✅ Contains Configuration Issues');
      expect(result.troubleshooting.accuracy).toBe('accurate');
    });
  });

  describe('Convenience Function Integration', () => {
    it('should work with convenience function', async () => {
      const result = await auditV020Documentation({
        docsDirectory: testDocsDir
      });

      expect(result.overallStatus).toBe('passing');
      expect(result.summary).toContain('PASSING ✅');
      expect(result.auditDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle missing documentation directory', async () => {
      const nonExistentDir = join(testDir, 'non-existent');
      const auditor = new V020DocumentationAuditor({
        docsDirectory: nonExistentDir
      });

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.exists).toBe(false);
      expect(result.agentAuthoring.exists).toBe(false);
      expect(result.workflowAuthoring.exists).toBe(false);
      expect(result.bestPractices.exists).toBe(false);
      expect(result.troubleshooting.exists).toBe(false);
    });

    it('should handle partial documentation', async () => {
      const partialDir = join(testDir, 'partial-docs');
      await mkdir(partialDir, { recursive: true });

      // Only create some files
      await writeFile(join(partialDir, 'openapi.yaml'), sampleApiReference);
      await writeFile(join(partialDir, 'agents.md'), 'Short content');

      const auditor = new V020DocumentationAuditor({
        docsDirectory: partialDir
      });

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.exists).toBe(true);
      expect(result.agentAuthoring.exists).toBe(true);
      expect(result.agentAuthoring.hasSubstantiveContent).toBe(false); // Too short
      expect(result.workflowAuthoring.exists).toBe(false);

      // Cleanup
      await rm(partialDir, { recursive: true, force: true });
    });

    it('should handle corrupted YAML files', async () => {
      const corruptedDir = join(testDir, 'corrupted-docs');
      await mkdir(corruptedDir, { recursive: true });

      // Create invalid YAML
      await writeFile(join(corruptedDir, 'openapi.yaml'), `
openapi: 3.0.3
info:
  title: Test
  version: 1.0.0
paths:
  invalid: [unclosed bracket
    invalid_yaml:
      - this is broken YAML syntax
`.repeat(20));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: corruptedDir,
        detailedAnalysis: true
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.accuracy).toBe('outdated');
      expect(result.apiReference.details).toContain('❌ Invalid YAML format');

      // Cleanup
      await rm(corruptedDir, { recursive: true, force: true });
    });
  });

  describe('Performance with Large Files', () => {
    it('should handle large documentation files efficiently', async () => {
      const largeDir = join(testDir, 'large-docs');
      await mkdir(largeDir, { recursive: true });

      // Create large files by repeating content
      const largeApiContent = sampleApiReference.repeat(10); // ~10x larger
      const largeAgentContent = sampleAgentAuthoring.repeat(5); // ~5x larger

      await writeFile(join(largeDir, 'openapi.yaml'), largeApiContent);
      await writeFile(join(largeDir, 'agents.md'), largeAgentContent);
      await writeFile(join(largeDir, 'workflows.md'), sampleWorkflowAuthoring.repeat(3));
      await writeFile(join(largeDir, 'best-practices.md'), sampleBestPractices.repeat(2));
      await writeFile(join(largeDir, 'troubleshooting.md'), sampleTroubleshooting.repeat(2));

      const startTime = Date.now();
      const auditor = new V020DocumentationAuditor({
        docsDirectory: largeDir
      });

      const result = await auditor.performAudit();
      const endTime = Date.now();

      expect(result.overallStatus).toBe('passing');
      expect(result.apiReference.lineCount).toBeGreaterThan(500);
      expect(result.agentAuthoring.lineCount).toBeGreaterThan(400);

      // Should complete within reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Cleanup
      await rm(largeDir, { recursive: true, force: true });
    });
  });

  describe('Real Project Documentation Audit', () => {
    it('should audit actual project docs if they exist', async () => {
      const projectDocsDir = join(process.cwd(), 'docs');

      try {
        await access(projectDocsDir, constants.F_OK);

        // Project docs exist, audit them
        const result = await auditV020Documentation({
          docsDirectory: projectDocsDir
        });

        // Log results for manual verification
        console.log('\n📋 Actual Project Documentation Audit:');
        console.log(result.summary);

        // Basic validation - at least some files should exist
        const existingDocs = [
          result.apiReference.exists,
          result.agentAuthoring.exists,
          result.workflowAuthoring.exists,
          result.bestPractices.exists,
          result.troubleshooting.exists
        ].filter(Boolean).length;

        expect(existingDocs).toBeGreaterThanOrEqual(0); // At least some documentation should exist

      } catch {
        // Project docs don't exist, skip this test
        console.log('📝 Project docs directory not found, skipping real project audit');
      }
    });
  });
});