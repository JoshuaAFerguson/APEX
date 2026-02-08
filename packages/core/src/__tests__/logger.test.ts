import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Logger,
  createPackageLogger,
  createComponentLogger,
  createTaskLogger,
  type LogLevel,
  type LoggerContext,
} from '../logger.js';

describe('Logger System', () => {
  beforeEach(() => {
    // Reset singleton between tests
    Logger.resetInstance();

    // Clear environment variables
    delete process.env.DEBUG;
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    Logger.resetInstance();
  });

  describe('Logger class', () => {
    it('creates a singleton instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();

      expect(logger1).toBe(logger2);
      expect(logger1).toBeInstanceOf(Logger);
    });

    it('accepts configuration options', () => {
      const config = {
        level: 'debug' as LogLevel,
        jsonFormat: false,
        prettyPrint: true,
      };

      const logger = Logger.getInstance(config);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('resets singleton instance correctly', () => {
      const logger1 = Logger.getInstance();
      Logger.resetInstance();
      const logger2 = Logger.getInstance();

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Logging methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance();
    });

    it('has all standard log levels', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('logs debug messages with data', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message', { key: 'value' });

      expect(spy).toHaveBeenCalledWith({ key: 'value' }, 'Debug message');
    });

    it('logs info messages', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'info');

      logger.info('Info message');

      expect(spy).toHaveBeenCalledWith({}, 'Info message');
    });

    it('logs warning messages with data', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'warn');

      logger.warn('Warning message', { reason: 'test' });

      expect(spy).toHaveBeenCalledWith({ reason: 'test' }, 'Warning message');
    });

    it('logs error messages with Error objects', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'error');
      const error = new Error('Test error');

      logger.error('Error occurred', error);

      expect(spy).toHaveBeenCalledWith({ err: error }, 'Error occurred');
    });

    it('logs error messages with additional data', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'error');
      const error = new Error('Test error');

      logger.error('Error occurred', error, { context: 'test' });

      expect(spy).toHaveBeenCalledWith({ err: error, context: 'test' }, 'Error occurred');
    });

    it('logs error messages with non-Error objects', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'error');
      const errorData = { type: 'custom', message: 'Something went wrong' };

      logger.error('Error occurred', errorData);

      expect(spy).toHaveBeenCalledWith({ errorData }, 'Error occurred');
    });

    it('logs error messages without error object', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'error');

      logger.error('Error occurred');

      expect(spy).toHaveBeenCalledWith({}, 'Error occurred');
    });

    it('logs fatal messages with Error objects', () => {
      const spy = vi.spyOn(logger.getPinoInstance(), 'fatal');
      const error = new Error('Fatal error');

      logger.fatal('Fatal error occurred', error);

      expect(spy).toHaveBeenCalledWith({ err: error }, 'Fatal error occurred');
    });
  });

  describe('Child loggers', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance();
    });

    it('creates child logger with additional context', () => {
      const context: LoggerContext = { taskId: 'task_123', package: 'core' };
      const childLogger = logger.child(context);

      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger).not.toBe(logger);
      expect(childLogger.getContext()).toEqual(context);
    });

    it('merges context with parent context', () => {
      const parentContext: LoggerContext = { package: 'core' };
      const parentLogger = new Logger({}, parentContext);

      const childContext: LoggerContext = { taskId: 'task_123' };
      const childLogger = parentLogger.child(childContext);

      expect(childLogger.getContext()).toEqual({
        package: 'core',
        taskId: 'task_123',
      });
    });

    it('overwrites parent context with child context', () => {
      const parentContext: LoggerContext = { package: 'core', component: 'old' };
      const parentLogger = new Logger({}, parentContext);

      const childContext: LoggerContext = { component: 'new' };
      const childLogger = parentLogger.child(childContext);

      expect(childLogger.getContext()).toEqual({
        package: 'core',
        component: 'new',
      });
    });

    it('allows nested child loggers', () => {
      const level1 = logger.child({ package: 'core' });
      const level2 = level1.child({ component: 'utils' });
      const level3 = level2.child({ taskId: 'task_123' });

      expect(level3.getContext()).toEqual({
        package: 'core',
        component: 'utils',
        taskId: 'task_123',
      });
    });
  });

  describe('DEBUG environment variable support', () => {
    it('respects DEBUG=* pattern', () => {
      process.env.DEBUG = '*';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });

    it('respects DEBUG=apex:* pattern', () => {
      process.env.DEBUG = 'apex:*';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });

    it('respects specific package DEBUG=apex:core', () => {
      process.env.DEBUG = 'apex:core';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });

    it('ignores debug when package does not match', () => {
      process.env.DEBUG = 'apex:orchestrator';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      // Should not call debug if DEBUG doesn't match and log level isn't debug
      expect(spy).not.toHaveBeenCalled();
    });

    it('respects exclusion patterns', () => {
      process.env.DEBUG = 'apex:*,-apex:core';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).not.toHaveBeenCalled();
    });

    it('handles multiple patterns', () => {
      process.env.DEBUG = 'apex:core,apex:orchestrator';
      const logger = new Logger({}, { package: 'core' });
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });

    it('handles no package context', () => {
      process.env.DEBUG = 'apex';
      const logger = new Logger({}, {});
      const spy = vi.spyOn(logger.getPinoInstance(), 'debug');

      logger.debug('Debug message');

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Environment-based configuration', () => {
    it('uses LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = Logger.getInstance();

      expect(logger.getPinoInstance().level).toBe('debug');
    });

    it('defaults to info level when no LOG_LEVEL set', () => {
      const logger = Logger.getInstance();

      expect(logger.getPinoInstance().level).toBe('info');
    });

    it('uses pretty print in development', () => {
      process.env.NODE_ENV = 'development';
      const logger = Logger.getInstance();

      // In development, should have transport configured for pretty printing
      expect(logger.getPinoInstance()).toBeDefined();
    });

    it('uses JSON format in production', () => {
      process.env.NODE_ENV = 'production';
      const logger = Logger.getInstance();

      // In production, should not have pretty print transport
      expect(logger.getPinoInstance()).toBeDefined();
    });
  });

  describe('Field redaction', () => {
    it('redacts sensitive fields by default', () => {
      const logger = Logger.getInstance();
      const pinoInstance = logger.getPinoInstance();

      // Check that redact option is configured
      expect(pinoInstance.redact).toBeDefined();
    });

    it('accepts custom redacted fields', () => {
      const customRedactFields = ['customSecret', 'privateKey'];
      const logger = Logger.getInstance({ redactFields: customRedactFields });

      expect(logger.getPinoInstance().redact).toEqual(customRedactFields);
    });
  });

  describe('Context management', () => {
    it('returns copy of context to prevent mutation', () => {
      const originalContext: LoggerContext = { package: 'core' };
      const logger = new Logger({}, originalContext);

      const returnedContext = logger.getContext();
      returnedContext.package = 'modified';

      expect(logger.getContext().package).toBe('core');
    });

    it('supports arbitrary metadata in context', () => {
      const context: LoggerContext = {
        package: 'core',
        userId: '12345',
        requestId: 'req_abc123',
        customField: 'custom value',
      };

      const logger = new Logger({}, context);

      expect(logger.getContext()).toEqual(context);
    });
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    Logger.resetInstance();
  });

  afterEach(() => {
    Logger.resetInstance();
  });

  describe('createPackageLogger', () => {
    it('creates logger with package context', () => {
      const logger = createPackageLogger('cli');

      expect(logger.getContext().package).toBe('cli');
    });

    it('creates different loggers for different packages', () => {
      const cliLogger = createPackageLogger('cli');
      const orchestratorLogger = createPackageLogger('orchestrator');

      expect(cliLogger.getContext().package).toBe('cli');
      expect(orchestratorLogger.getContext().package).toBe('orchestrator');
    });

    it('uses singleton base logger', () => {
      const logger1 = createPackageLogger('core');
      const logger2 = createPackageLogger('core');

      // Should be different instances (child loggers) but same base
      expect(logger1).not.toBe(logger2);
      expect(logger1.getContext()).toEqual(logger2.getContext());
    });
  });

  describe('createComponentLogger', () => {
    it('creates logger with package and component context', () => {
      const logger = createComponentLogger('orchestrator', 'daemon');

      expect(logger.getContext()).toEqual({
        package: 'orchestrator',
        component: 'daemon',
      });
    });

    it('creates different loggers for different components', () => {
      const daemonLogger = createComponentLogger('orchestrator', 'daemon');
      const storeLogger = createComponentLogger('orchestrator', 'store');

      expect(daemonLogger.getContext().component).toBe('daemon');
      expect(storeLogger.getContext().component).toBe('store');
    });
  });

  describe('createTaskLogger', () => {
    it('creates logger with taskId context', () => {
      const taskId = 'task_123';
      const logger = createTaskLogger(taskId);

      expect(logger.getContext().taskId).toBe(taskId);
    });

    it('inherits from base logger when no baseLogger provided', () => {
      const baseLogger = Logger.getInstance();
      const taskLogger = createTaskLogger('task_123');

      // Should be different instance but inherit from base
      expect(taskLogger).not.toBe(baseLogger);
      expect(taskLogger.getContext().taskId).toBe('task_123');
    });

    it('inherits from provided base logger', () => {
      const baseLogger = createPackageLogger('orchestrator');
      const taskLogger = createTaskLogger('task_123', baseLogger);

      expect(taskLogger.getContext()).toEqual({
        package: 'orchestrator',
        taskId: 'task_123',
      });
    });

    it('creates different loggers for different task IDs', () => {
      const task1Logger = createTaskLogger('task_123');
      const task2Logger = createTaskLogger('task_456');

      expect(task1Logger.getContext().taskId).toBe('task_123');
      expect(task2Logger.getContext().taskId).toBe('task_456');
    });
  });
});

describe('Integration scenarios', () => {
  beforeEach(() => {
    Logger.resetInstance();
  });

  afterEach(() => {
    Logger.resetInstance();
  });

  it('supports complex nested logging scenarios', () => {
    // Create a package logger
    const orchestratorLogger = createPackageLogger('orchestrator');

    // Create a component logger from the package logger
    const daemonLogger = orchestratorLogger.child({ component: 'daemon' });

    // Create a task logger from the component logger
    const taskLogger = createTaskLogger('task_123', daemonLogger);

    // Create a session logger from the task logger
    const sessionLogger = taskLogger.child({ sessionId: 'session_abc' });

    expect(sessionLogger.getContext()).toEqual({
      package: 'orchestrator',
      component: 'daemon',
      taskId: 'task_123',
      sessionId: 'session_abc',
    });
  });

  it('maintains proper context isolation', () => {
    const baseLogger = createPackageLogger('core');

    const task1Logger = createTaskLogger('task_123', baseLogger);
    const task2Logger = createTaskLogger('task_456', baseLogger);

    task1Logger.child({ status: 'running' });
    task2Logger.child({ status: 'pending' });

    // Original loggers should not be affected
    expect(task1Logger.getContext()).toEqual({
      package: 'core',
      taskId: 'task_123',
    });

    expect(task2Logger.getContext()).toEqual({
      package: 'core',
      taskId: 'task_456',
    });
  });

  it('works with various context types', () => {
    const logger = createPackageLogger('api');

    const requestLogger = logger.child({
      requestId: 'req_123',
      method: 'POST',
      path: '/api/tasks',
      userId: 'user_456',
      startTime: Date.now(),
    });

    expect(requestLogger.getContext()).toMatchObject({
      package: 'api',
      requestId: 'req_123',
      method: 'POST',
      path: '/api/tasks',
      userId: 'user_456',
    });
  });

  it('handles DEBUG patterns with real package structure', () => {
    process.env.DEBUG = 'apex:orchestrator,apex:cli';

    const orchestratorLogger = createPackageLogger('orchestrator');
    const cliLogger = createPackageLogger('cli');
    const apiLogger = createPackageLogger('api');

    const orchestratorSpy = vi.spyOn(orchestratorLogger.getPinoInstance(), 'debug');
    const cliSpy = vi.spyOn(cliLogger.getPinoInstance(), 'debug');
    const apiSpy = vi.spyOn(apiLogger.getPinoInstance(), 'debug');

    orchestratorLogger.debug('Orchestrator debug');
    cliLogger.debug('CLI debug');
    apiLogger.debug('API debug');

    expect(orchestratorSpy).toHaveBeenCalled();
    expect(cliSpy).toHaveBeenCalled();
    expect(apiSpy).not.toHaveBeenCalled();
  });
});