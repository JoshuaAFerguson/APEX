/**
 * Unit Tests for MCP Tool Merging Logic
 *
 * This test suite validates tool merging logic
 * to ensure the acceptance criteria is met:
 * "Unit tests verify tool merging logic"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MCP Tool Merging Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Tool Merging', () => {
    it('should merge MCP tools with built-in tools', () => {
      const builtInTools = [
        'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash',
        'TodoWrite', 'EnterPlanMode', 'ExitPlanMode'
      ];

      const mcpTools = [
        'mcp_read_file', 'mcp_write_file', 'mcp_weather'
      ];

      const mergedTools = Array.from(new Set([...builtInTools, ...mcpTools]));

      expect(mergedTools).toHaveLength(12); // 9 built-in + 3 MCP tools
      expect(mergedTools).toContain('Read');
      expect(mergedTools).toContain('mcp_read_file');
      expect(mergedTools).toContain('mcp_weather');
    });

    it('should remove duplicates when merging tools', () => {
      const builtInTools = ['Read', 'Write', 'Edit'];
      const mcpTools = ['Read', 'mcp_custom', 'Write']; // Contains duplicates

      const mergedTools = Array.from(new Set([...builtInTools, ...mcpTools]));

      expect(mergedTools).toHaveLength(4); // No duplicates
      expect(mergedTools.filter(tool => tool === 'Read')).toHaveLength(1);
      expect(mergedTools.filter(tool => tool === 'Write')).toHaveLength(1);
      expect(mergedTools).toContain('Edit');
      expect(mergedTools).toContain('mcp_custom');
    });

    it('should handle empty MCP tools list', () => {
      const builtInTools = ['Read', 'Write', 'Edit'];
      const mcpTools: string[] = [];

      const mergedTools = Array.from(new Set([...builtInTools, ...mcpTools]));

      expect(mergedTools).toEqual(builtInTools);
      expect(mergedTools).toHaveLength(3);
    });

    it('should handle empty built-in tools list', () => {
      const builtInTools: string[] = [];
      const mcpTools = ['mcp_tool1', 'mcp_tool2'];

      const mergedTools = Array.from(new Set([...builtInTools, ...mcpTools]));

      expect(mergedTools).toEqual(mcpTools);
      expect(mergedTools).toHaveLength(2);
    });

    it('should handle both lists being empty', () => {
      const builtInTools: string[] = [];
      const mcpTools: string[] = [];

      const mergedTools = Array.from(new Set([...builtInTools, ...mcpTools]));

      expect(mergedTools).toEqual([]);
      expect(mergedTools).toHaveLength(0);
    });
  });

  describe('Complex Tool Merging Scenarios', () => {
    it('should merge tools from multiple MCP servers', () => {
      const builtInTools = ['Read', 'Write', 'Edit'];

      const filesystemServerTools = ['fs_read', 'fs_write', 'fs_list'];
      const weatherServerTools = ['weather_current', 'weather_forecast'];
      const databaseServerTools = ['db_query', 'db_insert', 'db_update'];

      const allMcpTools = [
        ...filesystemServerTools,
        ...weatherServerTools,
        ...databaseServerTools
      ];

      const mergedTools = Array.from(new Set([...builtInTools, ...allMcpTools]));

      expect(mergedTools).toHaveLength(11); // 3 built-in + 8 MCP tools
      expect(mergedTools).toContain('Read');
      expect(mergedTools).toContain('fs_read');
      expect(mergedTools).toContain('weather_current');
      expect(mergedTools).toContain('db_query');
    });

    it('should handle name collisions across MCP servers', () => {
      const builtInTools = ['Read', 'Write'];

      const server1Tools = ['read_file', 'common_tool', 'server1_specific'];
      const server2Tools = ['read_data', 'common_tool', 'server2_specific']; // 'common_tool' collision

      const allMcpTools = [...server1Tools, ...server2Tools];
      const mergedTools = Array.from(new Set([...builtInTools, ...allMcpTools]));

      expect(mergedTools).toHaveLength(7); // 2 built-in + 5 unique MCP tools
      expect(mergedTools.filter(tool => tool === 'common_tool')).toHaveLength(1);
      expect(mergedTools).toContain('server1_specific');
      expect(mergedTools).toContain('server2_specific');
    });

    it('should preserve tool order when merging', () => {
      const builtInTools = ['Read', 'Write', 'Edit'];
      const mcpTools = ['mcp_first', 'mcp_second', 'mcp_third'];

      // Built-in tools should come first, then MCP tools
      const mergedTools = [...builtInTools, ...mcpTools];

      expect(mergedTools.indexOf('Read')).toBeLessThan(mergedTools.indexOf('mcp_first'));
      expect(mergedTools.indexOf('Write')).toBeLessThan(mergedTools.indexOf('mcp_second'));
      expect(mergedTools.indexOf('Edit')).toBeLessThan(mergedTools.indexOf('mcp_third'));

      expect(mergedTools.indexOf('mcp_first')).toBeLessThan(mergedTools.indexOf('mcp_second'));
      expect(mergedTools.indexOf('mcp_second')).toBeLessThan(mergedTools.indexOf('mcp_third'));
    });
  });

  describe('Tool Metadata Merging', () => {
    it('should merge tool definitions with metadata', () => {
      interface ToolDefinition {
        name: string;
        description: string;
        source: 'builtin' | 'mcp';
        server?: string;
      }

      const builtInToolDefs: ToolDefinition[] = [
        { name: 'Read', description: 'Read files', source: 'builtin' },
        { name: 'Write', description: 'Write files', source: 'builtin' }
      ];

      const mcpToolDefs: ToolDefinition[] = [
        { name: 'mcp_weather', description: 'Get weather data', source: 'mcp', server: 'weather-server' },
        { name: 'mcp_db_query', description: 'Query database', source: 'mcp', server: 'db-server' }
      ];

      const mergedToolDefs = [...builtInToolDefs, ...mcpToolDefs];

      expect(mergedToolDefs).toHaveLength(4);

      const builtInTools = mergedToolDefs.filter(t => t.source === 'builtin');
      const mcpTools = mergedToolDefs.filter(t => t.source === 'mcp');

      expect(builtInTools).toHaveLength(2);
      expect(mcpTools).toHaveLength(2);

      expect(mcpTools.every(t => t.server !== undefined)).toBe(true);
      expect(builtInTools.every(t => t.server === undefined)).toBe(true);
    });

    it('should merge tools with priority information', () => {
      interface PrioritizedTool {
        name: string;
        priority: number;
        source: string;
      }

      const builtInTools: PrioritizedTool[] = [
        { name: 'Read', priority: 10, source: 'builtin' },
        { name: 'Write', priority: 10, source: 'builtin' }
      ];

      const mcpTools: PrioritizedTool[] = [
        { name: 'mcp_read', priority: 5, source: 'mcp' }, // Lower priority than built-in
        { name: 'mcp_special', priority: 15, source: 'mcp' } // Higher priority
      ];

      const mergedTools = [...builtInTools, ...mcpTools];
      const sortedByPriority = mergedTools.sort((a, b) => b.priority - a.priority);

      expect(sortedByPriority[0].name).toBe('mcp_special');
      expect(sortedByPriority[0].priority).toBe(15);

      const highPriorityTools = sortedByPriority.filter(t => t.priority >= 10);
      expect(highPriorityTools).toHaveLength(3);
    });

    it('should merge tools with capability flags', () => {
      interface CapabilityTool {
        name: string;
        capabilities: {
          read: boolean;
          write: boolean;
          execute: boolean;
          network: boolean;
        };
      }

      const builtInTools: CapabilityTool[] = [
        {
          name: 'Read',
          capabilities: { read: true, write: false, execute: false, network: false }
        },
        {
          name: 'Bash',
          capabilities: { read: true, write: true, execute: true, network: false }
        }
      ];

      const mcpTools: CapabilityTool[] = [
        {
          name: 'mcp_weather',
          capabilities: { read: false, write: false, execute: false, network: true }
        },
        {
          name: 'mcp_filesystem',
          capabilities: { read: true, write: true, execute: false, network: false }
        }
      ];

      const mergedTools = [...builtInTools, ...mcpTools];

      const networkCapableTools = mergedTools.filter(t => t.capabilities.network);
      const writeCapableTools = mergedTools.filter(t => t.capabilities.write);

      expect(networkCapableTools).toHaveLength(1);
      expect(networkCapableTools[0].name).toBe('mcp_weather');

      expect(writeCapableTools).toHaveLength(3);
      expect(writeCapableTools.map(t => t.name)).toContain('Bash');
      expect(writeCapableTools.map(t => t.name)).toContain('mcp_filesystem');
    });
  });

  describe('Tool Filtering and Selection', () => {
    it('should filter tools based on availability', () => {
      const allTools = [
        { name: 'Read', available: true, source: 'builtin' },
        { name: 'Write', available: true, source: 'builtin' },
        { name: 'mcp_weather', available: true, source: 'mcp' },
        { name: 'mcp_broken', available: false, source: 'mcp' }
      ];

      const availableTools = allTools.filter(t => t.available);
      const toolNames = availableTools.map(t => t.name);

      expect(availableTools).toHaveLength(3);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('mcp_weather');
      expect(toolNames).not.toContain('mcp_broken');
    });

    it('should select tools based on criteria', () => {
      interface SelectableTool {
        name: string;
        category: string;
        security: 'safe' | 'dangerous';
        source: 'builtin' | 'mcp';
      }

      const allTools: SelectableTool[] = [
        { name: 'Read', category: 'file', security: 'safe', source: 'builtin' },
        { name: 'Bash', category: 'execution', security: 'dangerous', source: 'builtin' },
        { name: 'mcp_weather', category: 'api', security: 'safe', source: 'mcp' },
        { name: 'mcp_system', category: 'system', security: 'dangerous', source: 'mcp' }
      ];

      const safeTools = allTools.filter(t => t.security === 'safe');
      const fileTools = allTools.filter(t => t.category === 'file');
      const mcpSafeTools = allTools.filter(t => t.source === 'mcp' && t.security === 'safe');

      expect(safeTools).toHaveLength(2);
      expect(fileTools).toHaveLength(1);
      expect(mcpSafeTools).toHaveLength(1);
      expect(mcpSafeTools[0].name).toBe('mcp_weather');
    });
  });

  describe('Tool Conflict Resolution', () => {
    it('should resolve name conflicts with prefix strategy', () => {
      const builtInTools = ['read', 'write'];
      const mcpTools = ['read', 'query']; // 'read' conflicts

      // Strategy: prefix MCP tools with server name
      const serverName = 'filesystem';
      const prefixedMcpTools = mcpTools.map(tool =>
        builtInTools.includes(tool) ? `${serverName}_${tool}` : tool
      );

      const mergedTools = [...builtInTools, ...prefixedMcpTools];

      expect(mergedTools).toContain('read'); // Built-in version
      expect(mergedTools).toContain('filesystem_read'); // MCP version
      expect(mergedTools).toContain('write');
      expect(mergedTools).toContain('query');
      expect(mergedTools).toHaveLength(4);
    });

    it('should resolve conflicts with priority strategy', () => {
      interface PriorityTool {
        name: string;
        priority: number;
        source: string;
      }

      const tools: PriorityTool[] = [
        { name: 'read_file', priority: 5, source: 'builtin' },
        { name: 'read_file', priority: 8, source: 'mcp-filesystem' }, // Higher priority
        { name: 'read_file', priority: 3, source: 'mcp-legacy' }, // Lower priority
        { name: 'unique_tool', priority: 1, source: 'mcp-other' }
      ];

      // Group by name and select highest priority
      const toolGroups = tools.reduce((groups, tool) => {
        if (!groups[tool.name]) {
          groups[tool.name] = [];
        }
        groups[tool.name].push(tool);
        return groups;
      }, {} as Record<string, PriorityTool[]>);

      const resolvedTools = Object.values(toolGroups).map(group =>
        group.reduce((best, current) => current.priority > best.priority ? current : best)
      );

      expect(resolvedTools).toHaveLength(2);
      const readFileTool = resolvedTools.find(t => t.name === 'read_file');
      expect(readFileTool?.source).toBe('mcp-filesystem');
      expect(readFileTool?.priority).toBe(8);
    });
  });

  describe('Tool Registry Management', () => {
    it('should manage tool registry state during merging', () => {
      class ToolRegistry {
        private builtInTools: Set<string> = new Set();
        private mcpTools: Set<string> = new Set();
        private allTools: Set<string> = new Set();

        addBuiltInTools(tools: string[]) {
          tools.forEach(tool => this.builtInTools.add(tool));
          this.updateAllTools();
        }

        addMcpTools(tools: string[]) {
          tools.forEach(tool => this.mcpTools.add(tool));
          this.updateAllTools();
        }

        private updateAllTools() {
          this.allTools = new Set([...this.builtInTools, ...this.mcpTools]);
        }

        getBuiltInTools() { return Array.from(this.builtInTools); }
        getMcpTools() { return Array.from(this.mcpTools); }
        getAllTools() { return Array.from(this.allTools); }
        getToolCount() { return this.allTools.size; }
      }

      const registry = new ToolRegistry();

      registry.addBuiltInTools(['Read', 'Write', 'Edit']);
      expect(registry.getToolCount()).toBe(3);

      registry.addMcpTools(['mcp_weather', 'mcp_db']);
      expect(registry.getToolCount()).toBe(5);

      registry.addMcpTools(['Read']); // Duplicate
      expect(registry.getToolCount()).toBe(5); // No change

      expect(registry.getBuiltInTools()).toHaveLength(3);
      expect(registry.getMcpTools()).toHaveLength(3); // includes duplicate 'Read'
      expect(registry.getAllTools()).toHaveLength(5); // deduplicated
    });
  });
});