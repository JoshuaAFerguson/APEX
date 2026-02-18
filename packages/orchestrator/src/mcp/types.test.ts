/**
 * Tests for MCP types and utility functions
 *
 * @module orchestrator/mcp/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type JSONRPCSuccessResponse,
  type JSONRPCErrorResponse,
  MCPTransportError,
  JSONRPCErrorCodes,
  isJSONRPCRequest,
  isJSONRPCResponse,
  isJSONRPCNotification,
  isJSONRPCErrorResponse,
  isJSONRPCSuccessResponse,
  createJSONRPCRequest,
  createJSONRPCNotification,
  createJSONRPCSuccessResponse,
  createJSONRPCErrorResponse,
} from './types.js';

describe('MCPTransportError', () => {
  it('should create error with message and code', () => {
    const error = new MCPTransportError('Test error', 'CONNECTION_FAILED');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('CONNECTION_FAILED');
    expect(error.name).toBe('MCPTransportError');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with underlying cause', () => {
    const cause = new Error('Underlying error');
    const error = new MCPTransportError('Test error', 'SEND_FAILED', cause);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('SEND_FAILED');
    expect(error.cause).toBe(cause);
  });

  it('should be instance of Error', () => {
    const error = new MCPTransportError('Test', 'TIMEOUT');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof MCPTransportError).toBe(true);
  });
});

describe('JSON-RPC error codes', () => {
  it('should have standard JSON-RPC error codes', () => {
    expect(JSONRPCErrorCodes.PARSE_ERROR).toBe(-32700);
    expect(JSONRPCErrorCodes.INVALID_REQUEST).toBe(-32600);
    expect(JSONRPCErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSONRPCErrorCodes.INVALID_PARAMS).toBe(-32602);
    expect(JSONRPCErrorCodes.INTERNAL_ERROR).toBe(-32603);
    expect(JSONRPCErrorCodes.SERVER_ERROR_START).toBe(-32099);
    expect(JSONRPCErrorCodes.SERVER_ERROR_END).toBe(-32000);
  });
});

describe('Type guards', () => {
  const request: JSONRPCRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'test',
    params: { foo: 'bar' },
  };

  const successResponse: JSONRPCSuccessResponse = {
    jsonrpc: '2.0',
    id: 1,
    result: { success: true },
  };

  const errorResponse: JSONRPCErrorResponse = {
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32600, message: 'Invalid request' },
  };

  const notification: JSONRPCNotification = {
    jsonrpc: '2.0',
    method: 'notify',
    params: { event: 'test' },
  };

  describe('isJSONRPCRequest', () => {
    it('should identify requests correctly', () => {
      expect(isJSONRPCRequest(request)).toBe(true);
      expect(isJSONRPCRequest(successResponse)).toBe(false);
      expect(isJSONRPCRequest(errorResponse)).toBe(false);
      expect(isJSONRPCRequest(notification)).toBe(false);
    });
  });

  describe('isJSONRPCResponse', () => {
    it('should identify responses correctly', () => {
      expect(isJSONRPCResponse(request)).toBe(false);
      expect(isJSONRPCResponse(successResponse)).toBe(true);
      expect(isJSONRPCResponse(errorResponse)).toBe(true);
      expect(isJSONRPCResponse(notification)).toBe(false);
    });
  });

  describe('isJSONRPCNotification', () => {
    it('should identify notifications correctly', () => {
      expect(isJSONRPCNotification(request)).toBe(false);
      expect(isJSONRPCNotification(successResponse)).toBe(false);
      expect(isJSONRPCNotification(errorResponse)).toBe(false);
      expect(isJSONRPCNotification(notification)).toBe(true);
    });
  });

  describe('isJSONRPCErrorResponse', () => {
    it('should identify error responses correctly', () => {
      expect(isJSONRPCErrorResponse(successResponse)).toBe(false);
      expect(isJSONRPCErrorResponse(errorResponse)).toBe(true);
    });
  });

  describe('isJSONRPCSuccessResponse', () => {
    it('should identify success responses correctly', () => {
      expect(isJSONRPCSuccessResponse(successResponse)).toBe(true);
      expect(isJSONRPCSuccessResponse(errorResponse)).toBe(false);
    });
  });
});

describe('Message creation utilities', () => {
  describe('createJSONRPCRequest', () => {
    it('should create request without params', () => {
      const request = createJSONRPCRequest(1, 'test/method');

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      });
    });

    it('should create request with params', () => {
      const params = { foo: 'bar', num: 42 };
      const request = createJSONRPCRequest('req-123', 'test/method', params);

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 'req-123',
        method: 'test/method',
        params,
      });
    });

    it('should not include params property when undefined', () => {
      const request = createJSONRPCRequest(1, 'test', undefined);
      expect(request).not.toHaveProperty('params');
    });
  });

  describe('createJSONRPCNotification', () => {
    it('should create notification without params', () => {
      const notification = createJSONRPCNotification('notify/event');

      expect(notification).toEqual({
        jsonrpc: '2.0',
        method: 'notify/event',
      });
    });

    it('should create notification with params', () => {
      const params = { event: 'test', data: { x: 1 } };
      const notification = createJSONRPCNotification('notify/event', params);

      expect(notification).toEqual({
        jsonrpc: '2.0',
        method: 'notify/event',
        params,
      });
    });

    it('should not include params property when undefined', () => {
      const notification = createJSONRPCNotification('test', undefined);
      expect(notification).not.toHaveProperty('params');
    });
  });

  describe('createJSONRPCSuccessResponse', () => {
    it('should create success response', () => {
      const result = { data: 'test', count: 5 };
      const response = createJSONRPCSuccessResponse(1, result);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result,
      });
    });

    it('should handle null id', () => {
      const response = createJSONRPCSuccessResponse(null, { ok: true });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: null,
        result: { ok: true },
      });
    });
  });

  describe('createJSONRPCErrorResponse', () => {
    it('should create error response without data', () => {
      const response = createJSONRPCErrorResponse(
        1,
        JSONRPCErrorCodes.INVALID_PARAMS,
        'Invalid parameters'
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: JSONRPCErrorCodes.INVALID_PARAMS,
          message: 'Invalid parameters',
        },
      });
    });

    it('should create error response with data', () => {
      const errorData = { field: 'username', constraint: 'required' };
      const response = createJSONRPCErrorResponse(
        'req-456',
        JSONRPCErrorCodes.INVALID_PARAMS,
        'Validation failed',
        errorData
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'req-456',
        error: {
          code: JSONRPCErrorCodes.INVALID_PARAMS,
          message: 'Validation failed',
          data: errorData,
        },
      });
    });

    it('should not include data property when undefined', () => {
      const response = createJSONRPCErrorResponse(1, -32000, 'Server error', undefined);
      expect(response.error).not.toHaveProperty('data');
    });
  });
});

describe('Edge cases and type validation', () => {
  it('should handle string and number IDs consistently', () => {
    const numRequest = createJSONRPCRequest(123, 'test');
    const strRequest = createJSONRPCRequest('abc', 'test');

    expect(typeof numRequest.id).toBe('number');
    expect(typeof strRequest.id).toBe('string');
    expect(isJSONRPCRequest(numRequest)).toBe(true);
    expect(isJSONRPCRequest(strRequest)).toBe(true);
  });

  it('should handle complex nested params', () => {
    const complexParams = {
      nested: {
        array: [1, 2, { deep: true }],
        nullValue: null,
        undefinedValue: undefined,
      },
      functions: {
        // Note: functions would be lost in JSON serialization
        callback: 'string representation',
      },
    };

    const request = createJSONRPCRequest(1, 'complex', complexParams);
    expect(request.params).toEqual(complexParams);
  });

  it('should properly type guard messages with missing fields', () => {
    // Messages with missing required fields
    const incompleteRequest = { jsonrpc: '2.0', method: 'test' }; // Missing id
    const incompleteResponse = { jsonrpc: '2.0', id: 1 }; // Missing result/error

    expect(isJSONRPCRequest(incompleteRequest as any)).toBe(false);
    expect(isJSONRPCResponse(incompleteResponse as any)).toBe(false);
    expect(isJSONRPCNotification(incompleteRequest as any)).toBe(true); // This is actually a valid notification
  });

  it('should handle zero and empty string IDs', () => {
    const zeroIdRequest = createJSONRPCRequest(0, 'test');
    const emptyIdRequest = createJSONRPCRequest('', 'test');

    expect(zeroIdRequest.id).toBe(0);
    expect(emptyIdRequest.id).toBe('');
    expect(isJSONRPCRequest(zeroIdRequest)).toBe(true);
    expect(isJSONRPCRequest(emptyIdRequest)).toBe(true);
  });
});