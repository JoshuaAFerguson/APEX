import * as fs from 'fs/promises';
import * as path from 'path';
import { getHomeDir } from '@apexcli/core';

export interface CompletionProvider {
  type: 'command' | 'path' | 'agent' | 'workflow' | 'task';
  trigger: RegExp;
  priority: number;
  getSuggestions: (
    input: string,
    cursorPos: number,
    context: CompletionContext
  ) => Promise<CompletionSuggestion[]>;
}

export interface CompletionSuggestion {
  value: string;
  displayValue?: string;
  description?: string;
  type: string;
  score: number;
  icon?: string;
}

export interface CompletionContext {
  projectPath: string;
  agents: string[];
  workflows: string[];
  recentTasks: Array<{ id: string; description: string }>;
  inputHistory: string[];
}

export interface CompletionEngineConfig {
  commands?: Array<{ name: string; description: string }>;
  history?: string[];
}

export class CompletionEngine {
  private providers: CompletionProvider[] = [];
  private config: CompletionEngineConfig = {};

  constructor(config: CompletionEngineConfig = {}) {
    this.config = config;
    this.registerDefaultProviders();
  }

  registerProvider(provider: CompletionProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  async getCompletions(
    input: string,
    cursorPos: number,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    const results: CompletionSuggestion[] = [];
    const inputBeforeCursor = input.slice(0, cursorPos);

    for (const provider of this.providers) {
      if (provider.trigger.test(inputBeforeCursor)) {
        try {
          const suggestions = await provider.getSuggestions(
            inputBeforeCursor,
            cursorPos,
            context
          );
          results.push(...suggestions);
        } catch (error) {
          console.error(`Completion provider ${provider.type} failed:`, error);
        }
      }
    }

    // Deduplicate and sort by score
    const seen = new Set<string>();
    return results
      .filter(s => {
        if (seen.has(s.value)) return false;
        seen.add(s.value);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  private registerDefaultProviders(): void {
    // Command completion
    this.registerProvider({
      type: 'command',
      trigger: /^\//,
      priority: 100,
      getSuggestions: async (input) => {
        const defaultCommands = [
          { name: '/help', desc: 'Show help', icon: '?' },
          { name: '/status', desc: 'Task status', icon: '📊' },
          { name: '/agents', desc: 'List agents', icon: '🤖' },
          { name: '/workflows', desc: 'List workflows', icon: '⚙️' },
          { name: '/config', desc: 'Configuration', icon: '🔧' },
          { name: '/session', desc: 'Session management', icon: '💾' },
          { name: '/logs', desc: 'Task logs', icon: '📝' },
          { name: '/cancel', desc: 'Cancel task', icon: '❌' },
          { name: '/retry', desc: 'Retry task', icon: '🔄' },
          { name: '/serve', desc: 'Start API', icon: '🌐' },
          { name: '/web', desc: 'Start Web UI', icon: '🖥️' },
          { name: '/clear', desc: 'Clear screen', icon: '🧹' },
          { name: '/exit', desc: 'Exit APEX', icon: '👋' },
          { name: '/theme', desc: 'Change theme', icon: '🎨' },
          { name: '/compact', desc: 'Toggle compact mode', icon: '📦' },
          { name: '/verbose', desc: 'Toggle verbose mode', icon: '📢' },
          { name: '/thoughts', desc: 'Toggle thought visibility', icon: '💭' },
        ];

        const configuredCommands = this.config.commands?.map(cmd => ({
          name: cmd.name,
          desc: cmd.description,
          icon: '⚙️'
        })) || [];

        const commands = [...defaultCommands, ...configuredCommands];

        const query = input.toLowerCase();
        return commands
          .filter(c => c.name.toLowerCase().startsWith(query))
          .map(c => ({
            value: c.name,
            displayValue: c.name,
            description: c.desc,
            type: 'command',
            score: c.name === input ? 100 : 80,
            icon: c.icon,
          }));
      },
    });

    // Session subcommands completion
    this.registerProvider({
      type: 'command',
      trigger: /^\/session\s+\w*/,
      priority: 95,
      async getSuggestions(input) {
        const match = input.match(/^\/session\s+(\w*)$/);
        if (!match) return [];

        const subcommands = [
          { name: 'list', desc: 'List sessions', icon: '📋' },
          { name: 'load', desc: 'Load session', icon: '📂' },
          { name: 'save', desc: 'Save session', icon: '💾' },
          { name: 'branch', desc: 'Branch session', icon: '🌿' },
          { name: 'export', desc: 'Export session', icon: '📤' },
          { name: 'delete', desc: 'Delete session', icon: '🗑️' },
          { name: 'info', desc: 'Session info', icon: 'ℹ️' },
        ];

        const prefix = match[1].toLowerCase();
        return subcommands
          .filter(c => c.name.toLowerCase().startsWith(prefix))
          .map(c => ({
            value: `/session ${c.name}`,
            displayValue: c.name,
            description: c.desc,
            type: 'subcommand',
            score: c.name === prefix ? 100 : 80,
            icon: c.icon,
          }));
      },
    });

    // File path completion
    this.registerProvider({
      type: 'path',
      trigger: /(\s|^)(\.\/|\/|~\/|\.\.\/|\w+\/)/,
      priority: 80,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/([\w.\/~-]+)$/);
        if (!match) return [];

        const prefix = match[1];
        let dir = path.dirname(prefix);
        const base = path.basename(prefix);

        // Resolve path
        if (dir.startsWith('~')) {
          dir = dir.replace('~', getHomeDir());
        } else if (!path.isAbsolute(dir)) {
          dir = path.resolve(context.projectPath, dir);
        }

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          return entries
            .filter(e => e.name.startsWith(base) && !e.name.startsWith('.'))
            .map(e => {
              const isDir = e.isDirectory();
              const fullPath = path.join(
                prefix.startsWith('~') ? '~' : prefix.startsWith('/') ? '/' : '',
                path.dirname(prefix.replace(/^[~\/]/, '')),
                e.name
              );

              return {
                value: fullPath + (isDir ? '/' : ''),
                displayValue: e.name + (isDir ? '/' : ''),
                description: isDir ? 'Directory' : 'File',
                type: isDir ? 'directory' : 'file',
                score: e.name === base ? 100 : 70,
                icon: isDir ? '📁' : '📄',
              };
            })
            .slice(0, 20);
        } catch {
          return [];
        }
      },
    });

    // Agent completion (@agent)
    this.registerProvider({
      type: 'agent',
      trigger: /@\w*/,
      priority: 90,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/@(\w*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();
        const agentInfo: Record<string, string> = {
          planner: 'Creates implementation plans',
          architect: 'Designs system architecture',
          developer: 'Writes production code',
          reviewer: 'Reviews code quality',
          tester: 'Creates and runs tests',
          devops: 'Handles infrastructure',
        };

        return context.agents
          .filter(a => a.toLowerCase().startsWith(prefix))
          .map(a => ({
            value: `@${a}`,
            displayValue: `@${a}`,
            description: agentInfo[a] || `Agent: ${a}`,
            type: 'agent',
            score: a.toLowerCase() === prefix ? 100 : 85,
            icon: '🤖',
          }));
      },
    });

    // Workflow completion (--workflow)
    this.registerProvider({
      type: 'workflow',
      trigger: /--workflow\s+\w*/,
      priority: 85,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/--workflow\s+(\w*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();
        const workflowInfo: Record<string, string> = {
          feature: 'Full feature implementation',
          bugfix: 'Bug investigation and fix',
          refactor: 'Code refactoring',
        };

        return context.workflows
          .filter(w => w.toLowerCase().startsWith(prefix))
          .map(w => ({
            value: w,
            displayValue: w,
            description: workflowInfo[w] || `Workflow: ${w}`,
            type: 'workflow',
            score: w.toLowerCase() === prefix ? 100 : 85,
            icon: '⚙️',
          }));
      },
    });

    // Task ID completion
    this.registerProvider({
      type: 'task',
      trigger: /task_\w*/,
      priority: 75,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/(task_[\w]*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();

        return context.recentTasks
          .filter(t => t.id.toLowerCase().startsWith(prefix))
          .map(t => ({
            value: t.id,
            displayValue: t.id.slice(0, 16),
            description: t.description.slice(0, 50),
            type: 'task',
            score: 75,
            icon: '📋',
          }))
          .slice(0, 10);
      },
    });

    // History completion
    this.registerProvider({
      type: 'task',
      trigger: /^\w/,
      priority: 60,
      getSuggestions: async (input, cursorPos, context) => {
        if (input.length < 2) return [];

        const prefix = input.toLowerCase();
        const contextHistory = context.inputHistory.slice(-50); // Last 50 commands
        const configuredHistory = this.config.history || [];

        // Combine configured history and context history, with configured taking precedence
        const allHistory = [...configuredHistory, ...contextHistory];
        const uniqueHistory = Array.from(new Set(allHistory));

        return uniqueHistory
          .filter(h => h.toLowerCase().startsWith(prefix) && h.toLowerCase() !== prefix)
          .slice(0, 5) // Limit to 5 suggestions
          .map((h, index) => ({
            value: h,
            displayValue: h.length > 60 ? h.slice(0, 57) + '...' : h,
            description: 'From history',
            type: 'history',
            score: 50 - index, // More recent = higher score
            icon: '📝',
          }));
      },
    });

    // Common task patterns
    this.registerProvider({
      type: 'task',
      trigger: /^(fix|add|update|implement|create|remove|delete|refactor|test|document)/i,
      priority: 65,
      async getSuggestions(input) {
        const templates = [
          'fix the bug in',
          'add a new feature for',
          'update the documentation for',
          'implement the logic for',
          'create a new component for',
          'remove deprecated code from',
          'refactor the code in',
          'test the functionality of',
          'document the API for',
          'optimize performance of',
        ];

        const inputLower = input.toLowerCase();
        return templates
          .filter(t => t.startsWith(inputLower))
          .map(t => ({
            value: t,
            displayValue: t,
            description: 'Common task pattern',
            type: 'template',
            score: 55,
            icon: '✨',
          }));
      },
    });
  }
}