/**
 * Built-in MCP Server Templates
 *
 * This module provides a comprehensive registry of server templates for common
 * MCP (Model Context Protocol) servers. Each template includes default configuration,
 * environment variable requirements, and capabilities information.
 *
 * @module orchestrator/mcp/templates
 */

import { MCPEnvironmentVar } from '@apexcli/core';
import type { MCPServerTemplate } from './configurator.js';

/**
 * Built-in server templates for common MCP servers
 * These templates provide sensible defaults and comprehensive metadata
 * for popular MCP servers from the official MCP ecosystem.
 */
export const BUILTIN_TEMPLATES: MCPServerTemplate[] = [
  // =========================================================================
  // Filesystem
  // =========================================================================
  {
    id: 'filesystem',
    name: 'Filesystem Server',
    description: 'Read and write files, list directories',
    package: '@modelcontextprotocol/server-filesystem',
    config: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '{{PROJECT_PATH}}'],
      autoStart: true,
      capabilities: ['filesystem'],
    },
    envVars: [],
    capabilities: ['filesystem', 'read', 'write', 'directory'],
    verified: true,
    defaultEnabled: true,
  },

  // =========================================================================
  // Git
  // =========================================================================
  {
    id: 'git',
    name: 'Git Server',
    description: 'Git operations - status, diff, commit, log',
    package: '@modelcontextprotocol/server-git',
    config: {
      name: 'git',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git', '--repository', '{{PROJECT_PATH}}'],
      autoStart: true,
      capabilities: ['git', 'vcs'],
    },
    envVars: [],
    capabilities: ['git', 'vcs', 'version-control'],
    verified: true,
    defaultEnabled: true,
  },

  // =========================================================================
  // GitHub
  // =========================================================================
  {
    id: 'github',
    name: 'GitHub Integration',
    description: 'GitHub API operations - issues, PRs, repos',
    package: '@modelcontextprotocol/server-github',
    config: {
      name: 'github',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      autoStart: false,
      capabilities: ['github', 'api'],
    },
    envVars: [
      {
        name: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        description: 'GitHub Personal Access Token for API access',
        required: true,
        sensitive: true,
        pattern: '^(gh[ps]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$',
      } as MCPEnvironmentVar,
    ],
    capabilities: ['github', 'api', 'issues', 'pull-requests', 'repositories'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // PostgreSQL
  // =========================================================================
  {
    id: 'postgres',
    name: 'PostgreSQL Server',
    description: 'PostgreSQL database operations',
    package: '@modelcontextprotocol/server-postgres',
    config: {
      name: 'postgres',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      autoStart: false,
      capabilities: ['database', 'postgres'],
    },
    envVars: [
      {
        name: 'POSTGRES_CONNECTION_STRING',
        description: 'PostgreSQL connection string (e.g., postgres://user:password@localhost:5432/dbname)',
        required: true,
        sensitive: true,
        pattern: '^postgres(ql)?://.*$',
      } as MCPEnvironmentVar,
    ],
    capabilities: ['database', 'postgres', 'sql'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Slack
  // =========================================================================
  {
    id: 'slack',
    name: 'Slack Integration',
    description: 'Slack messaging and channel operations',
    package: '@modelcontextprotocol/server-slack',
    config: {
      name: 'slack',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      autoStart: false,
      capabilities: ['slack', 'messaging'],
    },
    envVars: [
      {
        name: 'SLACK_BOT_TOKEN',
        description: 'Slack Bot OAuth Token (starts with xoxb-)',
        required: true,
        sensitive: true,
        pattern: '^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$',
      } as MCPEnvironmentVar,
      {
        name: 'SLACK_TEAM_ID',
        description: 'Slack Team/Workspace ID (optional, for multi-workspace bots)',
        required: false,
        sensitive: false,
      } as MCPEnvironmentVar,
    ],
    capabilities: ['slack', 'messaging', 'channels', 'communication'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Puppeteer
  // =========================================================================
  {
    id: 'puppeteer',
    name: 'Puppeteer Browser',
    description: 'Browser automation via Puppeteer',
    package: '@modelcontextprotocol/server-puppeteer',
    config: {
      name: 'puppeteer',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      autoStart: false,
      capabilities: ['browser', 'automation'],
    },
    envVars: [],
    capabilities: ['browser', 'automation', 'web-scraping', 'testing'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Fetch (HTTP)
  // =========================================================================
  {
    id: 'fetch',
    name: 'HTTP Fetch Server',
    description: 'HTTP requests with URL fetching',
    package: '@modelcontextprotocol/server-fetch',
    config: {
      name: 'fetch',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      autoStart: true,
      capabilities: ['http', 'fetch'],
    },
    envVars: [],
    capabilities: ['http', 'fetch', 'web', 'api'],
    verified: true,
    defaultEnabled: true,
  },

  // =========================================================================
  // Memory
  // =========================================================================
  {
    id: 'memory',
    name: 'Memory Server',
    description: 'Key-value storage for conversation context',
    package: '@modelcontextprotocol/server-memory',
    config: {
      name: 'memory',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      autoStart: true,
      capabilities: ['memory', 'storage'],
    },
    envVars: [],
    capabilities: ['memory', 'storage', 'context', 'persistence'],
    verified: true,
    defaultEnabled: true,
  },

  // =========================================================================
  // Sequential Thinking
  // =========================================================================
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Chain-of-thought reasoning support',
    package: '@modelcontextprotocol/server-sequential-thinking',
    config: {
      name: 'sequential-thinking',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      autoStart: false,
      capabilities: ['reasoning', 'thinking'],
    },
    envVars: [],
    capabilities: ['reasoning', 'thinking', 'chain-of-thought', 'analysis'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Brave Search
  // =========================================================================
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search via Brave Search API',
    package: '@modelcontextprotocol/server-brave-search',
    config: {
      name: 'brave-search',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      autoStart: false,
      capabilities: ['search', 'web'],
    },
    envVars: [
      {
        name: 'BRAVE_API_KEY',
        description: 'Brave Search API key for web search functionality',
        required: true,
        sensitive: true,
      } as MCPEnvironmentVar,
    ],
    capabilities: ['search', 'web', 'internet'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Sentry
  // =========================================================================
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error monitoring and issue tracking',
    package: '@modelcontextprotocol/server-sentry',
    config: {
      name: 'sentry',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sentry'],
      autoStart: false,
      capabilities: ['monitoring', 'errors'],
    },
    envVars: [
      {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Sentry authentication token for API access',
        required: true,
        sensitive: true,
      } as MCPEnvironmentVar,
      {
        name: 'SENTRY_ORG',
        description: 'Sentry organization slug (optional)',
        required: false,
        sensitive: false,
      } as MCPEnvironmentVar,
    ],
    capabilities: ['monitoring', 'errors', 'tracking', 'debugging'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // YouTube
  // =========================================================================
  {
    id: 'youtube',
    name: 'YouTube Integration',
    description: 'YouTube API operations - search, videos, channels',
    package: '@modelcontextprotocol/server-youtube',
    config: {
      name: 'youtube',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-youtube'],
      autoStart: false,
      capabilities: ['youtube', 'video'],
    },
    envVars: [
      {
        name: 'YOUTUBE_API_KEY',
        description: 'YouTube Data API v3 key for video and channel access',
        required: true,
        sensitive: true,
      } as MCPEnvironmentVar,
    ],
    capabilities: ['youtube', 'video', 'media', 'search'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Obsidian
  // =========================================================================
  {
    id: 'obsidian',
    name: 'Obsidian Vault',
    description: 'Obsidian vault integration for note management',
    package: '@modelcontextprotocol/server-obsidian',
    config: {
      name: 'obsidian',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-obsidian'],
      autoStart: false,
      capabilities: ['notes', 'knowledge'],
    },
    envVars: [
      {
        name: 'OBSIDIAN_VAULT_PATH',
        description: 'Path to the Obsidian vault directory',
        required: true,
        sensitive: false,
      } as MCPEnvironmentVar,
    ],
    capabilities: ['notes', 'knowledge', 'markdown', 'obsidian'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // SQLite
  // =========================================================================
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'SQLite database operations and queries',
    package: '@modelcontextprotocol/server-sqlite',
    config: {
      name: 'sqlite',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
      autoStart: false,
      capabilities: ['database', 'sqlite'],
    },
    envVars: [
      {
        name: 'SQLITE_DATABASE_PATH',
        description: 'Path to the SQLite database file',
        required: true,
        sensitive: false,
        defaultValue: './data.db',
      } as MCPEnvironmentVar,
    ],
    capabilities: ['database', 'sqlite', 'sql', 'local'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // Docker
  // =========================================================================
  {
    id: 'docker',
    name: 'Docker Integration',
    description: 'Docker container management and operations',
    package: '@modelcontextprotocol/server-docker',
    config: {
      name: 'docker',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-docker'],
      autoStart: false,
      capabilities: ['docker', 'containers'],
    },
    envVars: [
      {
        name: 'DOCKER_HOST',
        description: 'Docker daemon host (optional, defaults to local socket)',
        required: false,
        sensitive: false,
        defaultValue: 'unix:///var/run/docker.sock',
      } as MCPEnvironmentVar,
    ],
    capabilities: ['docker', 'containers', 'devops', 'infrastructure'],
    verified: true,
    defaultEnabled: false,
  },

  // =========================================================================
  // AWS
  // =========================================================================
  {
    id: 'aws',
    name: 'AWS Services',
    description: 'AWS cloud services integration',
    package: '@modelcontextprotocol/server-aws',
    config: {
      name: 'aws',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws'],
      autoStart: false,
      capabilities: ['aws', 'cloud'],
    },
    envVars: [
      {
        name: 'AWS_ACCESS_KEY_ID',
        description: 'AWS access key ID for authentication',
        required: true,
        sensitive: true,
      } as MCPEnvironmentVar,
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        description: 'AWS secret access key for authentication',
        required: true,
        sensitive: true,
      } as MCPEnvironmentVar,
      {
        name: 'AWS_REGION',
        description: 'AWS region for service requests',
        required: false,
        sensitive: false,
        defaultValue: 'us-east-1',
      } as MCPEnvironmentVar,
    ],
    capabilities: ['aws', 'cloud', 'infrastructure', 'storage', 'compute'],
    verified: true,
    defaultEnabled: false,
  },
];

/**
 * Get templates by category
 * @param category - Category to filter by
 * @returns Array of templates in the specified category
 */
export function getTemplatesByCategory(category: string): MCPServerTemplate[] {
  return BUILTIN_TEMPLATES.filter(template =>
    template.capabilities.includes(category.toLowerCase())
  );
}

/**
 * Get all verified templates
 * @returns Array of verified templates
 */
export function getVerifiedTemplates(): MCPServerTemplate[] {
  return BUILTIN_TEMPLATES.filter(template => template.verified);
}

/**
 * Get all templates that are enabled by default
 * @returns Array of default-enabled templates
 */
export function getDefaultEnabledTemplates(): MCPServerTemplate[] {
  return BUILTIN_TEMPLATES.filter(template => template.defaultEnabled);
}

/**
 * Find template by package name
 * @param packageName - NPM package name to search for
 * @returns Template if found, undefined otherwise
 */
export function findTemplateByPackage(packageName: string): MCPServerTemplate | undefined {
  return BUILTIN_TEMPLATES.find(template => template.package === packageName);
}

/**
 * Search templates by capabilities
 * @param capabilities - Array of capabilities to match
 * @param matchAll - Whether to match all capabilities (true) or any (false)
 * @returns Array of matching templates
 */
export function searchTemplatesByCapabilities(
  capabilities: string[],
  matchAll: boolean = false
): MCPServerTemplate[] {
  return BUILTIN_TEMPLATES.filter(template => {
    const templateCaps = template.capabilities.map(cap => cap.toLowerCase());
    const searchCaps = capabilities.map(cap => cap.toLowerCase());

    if (matchAll) {
      return searchCaps.every(cap => templateCaps.includes(cap));
    } else {
      return searchCaps.some(cap => templateCaps.includes(cap));
    }
  });
}