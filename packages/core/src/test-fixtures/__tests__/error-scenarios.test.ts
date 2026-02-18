/**
 * @fileoverview Comprehensive tests for error scenarios and presets
 *
 * Tests all error types, categories, and simulation scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MCPProtocolErrors, MCPErrorPresets, createMCPError } from '../errors/mcp-errors.js';
import { ClaudeAgentErrors, ApexErrors } from '../errors/agent-errors.js';
import { ValidationErrorScenarios } from '../errors/validation-errors.js';
import { FileSystemErrors, NetworkErrors } from '../errors/system-errors.js';
import type { ErrorSimulationOptions } from '../types.js';

describe('Error Scenarios and Presets', () => {
  describe('MCP Protocol Errors', () => {
    it('should have properly structured JSON-RPC errors', () => {
      expect(MCPProtocolErrors.protocolMismatch.code).toBeDefined();
      expect(MCPProtocolErrors.protocolMismatch.message).toBeDefined();
      expect(typeof MCPProtocolErrors.protocolMismatch.code).toBe('number');
      expect(typeof MCPProtocolErrors.protocolMismatch.message).toBe('string');
    });

    it('should include relevant error data', () => {
      const protocolError = MCPProtocolErrors.protocolMismatch;
      expect(protocolError.data).toBeDefined();
      expect(protocolError.data.supportedVersions).toBeDefined();
      expect(protocolError.data.requestedVersion).toBeDefined();
      expect(protocolError.data.serverInfo).toBeDefined();

      const timeoutError = MCPProtocolErrors.timeout;
      expect(timeoutError.data).toBeDefined();
      expect(timeoutError.data.timeout).toBeDefined();
      expect(timeoutError.data.operation).toBeDefined();
    });

    it('should have consistent error code values', () => {
      // Check that error codes follow JSON-RPC spec
      expect(MCPProtocolErrors.invalidRequest.code).toBe(-32600);
      expect(MCPProtocolErrors.methodNotFound.code).toBe(-32601);
      expect(MCPProtocolErrors.invalidParams.code).toBe(-32602);
      expect(MCPProtocolErrors.internalError.code).toBe(-32603);
    });

    it('should support error categorization', () => {
      const categories = Object.keys(MCPErrorPresets);
      expect(categories).toContain('protocol');
      expect(categories).toContain('transport');
      expect(categories).toContain('runtime');
      expect(categories).toContain('policy');

      // Test protocol category
      expect(MCPErrorPresets.protocol.mismatch).toBeDefined();
      expect(MCPErrorPresets.protocol.invalidRequest).toBeDefined();
      expect(MCPErrorPresets.protocol.capabilityMismatch).toBeDefined();

      // Test transport category
      expect(MCPErrorPresets.transport.connectionLost).toBeDefined();
      expect(MCPErrorPresets.transport.timeout).toBeDefined();
    });

    it('should support error customization', () => {
      const baseError = MCPProtocolErrors.timeout;
      const customOptions: ErrorSimulationOptions = {
        category: 'timeout',
        severity: 'high',
        retryable: false,
        data: { customField: 'test-value' }
      };

      const customError = createMCPError(baseError, customOptions);

      expect(customError.code).toBe(baseError.code);
      expect(customError.message).toBe(baseError.message);
      expect(customError.data.category).toBe('timeout');
      expect(customError.data.severity).toBe('high');
      expect(customError.data.retryable).toBe(false);
      expect(customError.data.customField).toBe('test-value');
      expect(customError.data.timestamp).toBeDefined();
    });
  });

  describe('Claude Agent SDK Errors', () => {
    it('should have context window exceeded error', () => {
      expect(ClaudeAgentErrors.contextWindowExceeded).toBeDefined();
      expect(ClaudeAgentErrors.contextWindowExceeded.name).toContain('Context');
      expect(ClaudeAgentErrors.contextWindowExceeded.message).toBeDefined();
    });

    it('should have budget related errors', () => {
      expect(ClaudeAgentErrors.budgetExceeded).toBeDefined();
      expect(ClaudeAgentErrors.budgetExceeded.message).toContain('budget');
    });

    it('should have model availability errors', () => {
      expect(ClaudeAgentErrors.modelUnavailable).toBeDefined();
      expect(ClaudeAgentErrors.modelUnavailable.message).toContain('model');
    });

    it('should have tool execution errors', () => {
      expect(ClaudeAgentErrors.toolExecutionFailed).toBeDefined();
      expect(ClaudeAgentErrors.toolExecutionFailed.message).toContain('tool');
    });

    it('should have rate limiting errors', () => {
      expect(ClaudeAgentErrors.rateLimitExceeded).toBeDefined();
      expect(ClaudeAgentErrors.rateLimitExceeded.message).toContain('rate');
    });

    it('should have network timeout errors', () => {
      expect(ClaudeAgentErrors.networkTimeout).toBeDefined();
      expect(ClaudeAgentErrors.networkTimeout.message).toContain('timeout');
    });
  });

  describe('APEX System Errors', () => {
    it('should have configuration errors', () => {
      expect(ApexErrors.configNotFound).toBeDefined();
      expect(ApexErrors.configNotFound.message).toContain('config');

      expect(ApexErrors.projectNotInitialized).toBeDefined();
      expect(ApexErrors.projectNotInitialized.message).toContain('initialized');
    });

    it('should have workflow errors', () => {
      expect(ApexErrors.workflowNotFound).toBeDefined();
      expect(ApexErrors.workflowNotFound.message).toContain('workflow');

      expect(ApexErrors.taskExecutionFailed).toBeDefined();
      expect(ApexErrors.taskExecutionFailed.message).toContain('task');
    });

    it('should have permission errors', () => {
      expect(ApexErrors.permissionDenied).toBeDefined();
      expect(ApexErrors.permissionDenied.message).toContain('permission');
    });

    it('should be instances of Error', () => {
      expect(ApexErrors.configNotFound).toBeInstanceOf(Error);
      expect(ApexErrors.projectNotInitialized).toBeInstanceOf(Error);
      expect(ApexErrors.workflowNotFound).toBeInstanceOf(Error);
      expect(ApexErrors.taskExecutionFailed).toBeInstanceOf(Error);
      expect(ApexErrors.permissionDenied).toBeInstanceOf(Error);
    });
  });

  describe('Validation Errors', () => {
    it('should have task validation scenarios', () => {
      expect(ValidationErrorScenarios.requiredField).toBeDefined();
      expect(ValidationErrorScenarios.requiredField.field).toBe('description');
      expect(ValidationErrorScenarios.requiredField.error).toContain('required');

      expect(ValidationErrorScenarios.invalidType).toBeDefined();
      expect(ValidationErrorScenarios.invalidType.field).toBe('status');
      expect(ValidationErrorScenarios.invalidType.error).toContain('enum');
    });

    it('should support different validation scenarios', () => {
      const scenarios = Object.keys(ValidationErrorScenarios);
      expect(scenarios.length).toBeGreaterThan(1);

      for (const scenario of scenarios) {
        const errorScenario = ValidationErrorScenarios[scenario as keyof typeof ValidationErrorScenarios];
        expect(errorScenario.field).toBeDefined();
        expect(errorScenario.error).toBeDefined();
        expect(errorScenario.input).toBeDefined();
      }
    });
  });

  describe('System Errors', () => {
    it('should have file system errors', () => {
      expect(FileSystemErrors.fileNotFound).toBeDefined();
      expect(FileSystemErrors.fileNotFound.message).toContain('not found');

      expect(FileSystemErrors.permissionDenied).toBeDefined();
      expect(FileSystemErrors.permissionDenied.message).toContain('permission');

      expect(FileSystemErrors.noSpace).toBeDefined();
      expect(FileSystemErrors.noSpace.message).toContain('space');
    });

    it('should have network errors', () => {
      expect(NetworkErrors.connectionTimeout).toBeDefined();
      expect(NetworkErrors.connectionTimeout.message).toContain('timeout');

      expect(NetworkErrors.connectionRefused).toBeDefined();
      expect(NetworkErrors.connectionRefused.message).toContain('refused');

      expect(NetworkErrors.dnsResolutionFailed).toBeDefined();
      expect(NetworkErrors.dnsResolutionFailed.message).toContain('DNS');
    });

    it('should be properly typed Error instances', () => {
      expect(FileSystemErrors.fileNotFound).toBeInstanceOf(Error);
      expect(FileSystemErrors.permissionDenied).toBeInstanceOf(Error);
      expect(NetworkErrors.connectionTimeout).toBeInstanceOf(Error);
      expect(NetworkErrors.connectionRefused).toBeInstanceOf(Error);
    });

    it('should have appropriate error codes', () => {
      expect(FileSystemErrors.fileNotFound.name).toBe('FileNotFoundError');
      expect(FileSystemErrors.permissionDenied.name).toBe('PermissionDeniedError');
      expect(NetworkErrors.connectionTimeout.name).toBe('NetworkTimeoutError');
      expect(NetworkErrors.connectionRefused.name).toBe('ConnectionRefusedError');
    });
  });

  describe('Error Simulation Options', () => {
    it('should support different error categories', () => {
      const options: ErrorSimulationOptions = {
        category: 'protocol'
      };
      expect(options.category).toBe('protocol');

      const networkOptions: ErrorSimulationOptions = {
        category: 'network',
        severity: 'high',
        retryable: false
      };
      expect(networkOptions.category).toBe('network');
      expect(networkOptions.severity).toBe('high');
      expect(networkOptions.retryable).toBe(false);
    });

    it('should support custom error data', () => {
      const options: ErrorSimulationOptions = {
        category: 'validation',
        data: {
          field: 'test-field',
          value: 'invalid-value',
          expectedType: 'string'
        }
      };

      expect(options.data).toBeDefined();
      expect(options.data.field).toBe('test-field');
      expect(options.data.value).toBe('invalid-value');
      expect(options.data.expectedType).toBe('string');
    });
  });

  describe('Error Factory Functions', () => {
    it('should create consistent error structures', () => {
      const baseError = MCPProtocolErrors.invalidRequest;
      const options: ErrorSimulationOptions = {
        category: 'validation',
        severity: 'medium',
        retryable: true
      };

      const customError = createMCPError(baseError, options);

      expect(customError.code).toBe(baseError.code);
      expect(customError.message).toBe(baseError.message);
      expect(customError.data.category).toBe('validation');
      expect(customError.data.severity).toBe('medium');
      expect(customError.data.retryable).toBe(true);
      expect(customError.data.timestamp).toBeDefined();
    });

    it('should merge error data correctly', () => {
      const baseError = MCPProtocolErrors.timeout;
      const options: ErrorSimulationOptions = {
        data: {
          requestId: 'test-123',
          clientInfo: { name: 'test-client' }
        }
      };

      const mergedError = createMCPError(baseError, options);

      // Should preserve original data
      expect(mergedError.data.timeout).toBe(baseError.data.timeout);
      expect(mergedError.data.operation).toBe(baseError.data.operation);

      // Should add new data
      expect(mergedError.data.requestId).toBe('test-123');
      expect(mergedError.data.clientInfo).toEqual({ name: 'test-client' });
    });
  });
});