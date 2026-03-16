/**
 * Test fixtures for agent integration tests
 * Provides valid and invalid agent definitions for testing CRUD operations
 */

import { AgentDefinition } from '@apexcli/core';

/**
 * Valid agent fixtures for testing successful operations
 */
export const validAgentFixtures = {
  /**
   * Minimal valid agent with only required fields
   */
  minimal: {
    name: 'test-agent',
    description: 'A test agent for integration testing',
    prompt: 'You are a test assistant that helps with basic tasks.'
  } as AgentDefinition,

  /**
   * Fully configured agent with all optional fields
   */
  full: {
    name: 'full-test-agent',
    description: 'A fully configured test agent with all fields',
    prompt: 'You are a comprehensive test assistant that can perform various tasks including reading, writing, and editing files.',
    tools: ['Read', 'Write', 'Edit', 'Bash'] as string[],
    model: 'sonnet' as const,
    skills: ['testing', 'debugging', 'documentation'] as string[]
  } as AgentDefinition,

  /**
   * Agent with special characters in name (valid characters)
   */
  withSpecialChars: {
    name: 'test-agent_v2-0',
    description: 'Agent with special characters in name',
    prompt: 'You are a test agent with special characters in the name.'
  } as AgentDefinition,

  /**
   * Agent with unicode characters in description and prompt
   */
  withUnicode: {
    name: 'unicode-agent',
    description: 'Agente de prueba con caracteres españoles ñ and emojis 🤖',
    prompt: 'You are an agent that handles unicode: エージェント, français, español.'
  } as AgentDefinition,

  /**
   * Agent with long description and prompt (within limits)
   */
  withLongText: {
    name: 'long-text-agent',
    description: 'A' + 'n agent with a very long description that tests the limits of the description field. '.repeat(10),
    prompt: 'You are an agent with a very long prompt. ' + 'This prompt is designed to test the handling of large text content in the system. '.repeat(50)
  } as AgentDefinition,

  /**
   * Agent with maximum number of tools and skills
   */
  withManyToolsSkills: {
    name: 'many-tools-agent',
    description: 'Agent with many tools and skills',
    prompt: 'You are a versatile agent with access to many tools and skills.',
    tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite', 'Browser'] as string[],
    skills: ['skill1', 'skill2', 'skill3', 'skill4', 'skill5'] as string[]
  } as AgentDefinition,

  /**
   * Agent with empty arrays for optional fields
   */
  withEmptyArrays: {
    name: 'empty-arrays-agent',
    description: 'Agent with empty arrays',
    prompt: 'You are an agent with empty tool and skill arrays.',
    tools: [] as string[],
    skills: [] as string[]
  } as AgentDefinition
};

/**
 * Invalid agent fixtures for testing error conditions
 */
export const invalidAgentFixtures = {
  /**
   * Missing name field
   */
  missingName: {
    description: 'Agent without name',
    prompt: 'Test prompt'
  } as any,

  /**
   * Missing description field
   */
  missingDescription: {
    name: 'test-agent',
    prompt: 'Test prompt'
  } as any,

  /**
   * Missing prompt field
   */
  missingPrompt: {
    name: 'test-agent',
    description: 'Test description'
  } as any,

  /**
   * Empty name field
   */
  emptyName: {
    name: '',
    description: 'Agent with empty name',
    prompt: 'Test prompt'
  } as any,

  /**
   * Empty description field
   */
  emptyDescription: {
    name: 'test-agent',
    description: '',
    prompt: 'Test prompt'
  } as any,

  /**
   * Empty prompt field
   */
  emptyPrompt: {
    name: 'test-agent',
    description: 'Test description',
    prompt: ''
  } as any,

  /**
   * Invalid model value
   */
  invalidModel: {
    name: 'test-agent',
    description: 'Agent with invalid model',
    prompt: 'Test prompt',
    model: 'invalid-model'
  } as any,

  /**
   * Invalid tool value
   */
  invalidTool: {
    name: 'test-agent',
    description: 'Agent with invalid tool',
    prompt: 'Test prompt',
    tools: ['InvalidTool']
  } as any,

  /**
   * Invalid name with spaces
   */
  nameWithSpaces: {
    name: 'test agent',
    description: 'Agent with spaces in name',
    prompt: 'Test prompt'
  } as any,

  /**
   * Invalid name with uppercase
   */
  nameWithUppercase: {
    name: 'TestAgent',
    description: 'Agent with uppercase in name',
    prompt: 'Test prompt'
  } as any,

  /**
   * Path traversal attempt in name
   */
  pathTraversalName: {
    name: '../malicious-agent',
    description: 'Malicious agent with path traversal',
    prompt: 'Test prompt'
  } as any,

  /**
   * URL encoded path traversal attempt
   */
  urlEncodedPathTraversal: {
    name: '..%2F..%2Fmalicious',
    description: 'Malicious agent with URL encoded path traversal',
    prompt: 'Test prompt'
  } as any,

  /**
   * Very long name (exceeding limits)
   */
  veryLongName: {
    name: 'a'.repeat(150), // Exceeds 100 character limit
    description: 'Agent with very long name',
    prompt: 'Test prompt'
  } as any,

  /**
   * Very long description (exceeding limits)
   */
  veryLongDescription: {
    name: 'test-agent',
    description: 'A'.repeat(600), // Exceeds 500 character limit
    prompt: 'Test prompt'
  } as any,

  /**
   * Very long prompt (exceeding limits)
   */
  veryLongPrompt: {
    name: 'test-agent',
    description: 'Agent with very long prompt',
    prompt: 'P'.repeat(51000) // Exceeds 50000 character limit
  } as any
};

/**
 * Update fixtures for testing agent updates
 */
export const updateFixtures = {
  /**
   * Valid partial update for description only
   */
  descriptionOnly: {
    description: 'Updated description via integration test'
  },

  /**
   * Valid partial update for prompt only
   */
  promptOnly: {
    prompt: 'Updated prompt: You are an updated test assistant.'
  },

  /**
   * Valid partial update adding tools
   */
  addTools: {
    tools: ['Read', 'Write', 'Bash']
  },

  /**
   * Valid partial update adding skills
   */
  addSkills: {
    skills: ['testing', 'validation', 'integration']
  },

  /**
   * Valid partial update changing model
   */
  changeModel: {
    model: 'haiku' as const
  },

  /**
   * Valid complete update (all fields except name)
   */
  complete: {
    description: 'Completely updated agent description',
    prompt: 'Updated prompt: You are a completely updated test assistant with new capabilities.',
    tools: ['Read', 'Edit', 'Grep'] as string[],
    model: 'opus' as const,
    skills: ['updated-skill1', 'updated-skill2'] as string[]
  },

  /**
   * Invalid update attempting to change name (should be ignored/prevented)
   */
  attemptNameChange: {
    name: 'new-name', // This should be ignored by updateAgent method
    description: 'Attempt to change name'
  },

  /**
   * Invalid update with empty description
   */
  emptyDescription: {
    description: ''
  },

  /**
   * Invalid update with invalid model
   */
  invalidModel: {
    model: 'invalid-model'
  }
};

/**
 * Utility functions for test fixtures
 */
export const fixtureUtils = {
  /**
   * Create a unique agent name for tests to avoid conflicts
   */
  createUniqueName: (prefix = 'test-agent') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  },

  /**
   * Create a copy of a fixture with a unique name
   */
  withUniqueName: (fixture: Partial<AgentDefinition>, prefix = 'test-agent') => {
    return {
      ...fixture,
      name: fixtureUtils.createUniqueName(prefix)
    };
  },

  /**
   * Get all valid agent names from fixtures (for cleanup)
   */
  getValidAgentNames: () => {
    return Object.values(validAgentFixtures).map(agent => agent.name);
  },

  /**
   * Create a fixture with custom fields
   */
  createCustom: (overrides: Partial<AgentDefinition> = {}) => {
    return {
      ...validAgentFixtures.minimal,
      ...overrides,
      name: fixtureUtils.createUniqueName()
    };
  }
};