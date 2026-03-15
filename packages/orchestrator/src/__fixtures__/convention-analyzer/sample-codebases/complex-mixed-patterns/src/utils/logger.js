// Mixed JavaScript/TypeScript patterns in same codebase
const util = require('util');
const { EventEmitter } = require('events');

// Constants with mixed naming
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const default_config = {
  level: LOG_LEVELS.INFO,
  timestamps: true,
  colors: true
};

/**
 * Logger utility with mixed conventions for testing
 * This file deliberately mixes different styles
 */
class Logger extends EventEmitter {
  constructor(name, user_config = {}) {
    super();
    this.name = name;
    this.config = { ...default_config, ...user_config };
    this._logCount = 0;
  }

  // Mixed method naming conventions
  log_message(level, message, ...args) {
    if (level < this.config.level) return;

    this._logCount++;
    const timestamp = this.config.timestamps ? new Date().toISOString() : null;

    const logEntry = {
      timestamp,
      level: this.getLevelName(level),
      name: this.name,
      message: util.format(message, ...args)
    };

    this.emit('log', logEntry);
    this.outputToConsole(logEntry);
  }

  debug(message, ...args) {
    this.log_message(LOG_LEVELS.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this.log_message(LOG_LEVELS.INFO, message, ...args);
  }

  warn(message, ...args) {
    this.log_message(LOG_LEVELS.WARN, message, ...args);
  }

  error(message, ...args) {
    this.log_message(LOG_LEVELS.ERROR, message, ...args);
  }

  // Snake case method
  get_log_count() {
    return this._logCount;
  }

  // camelCase method
  getLevelName(level) {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levelNames[level] || 'UNKNOWN';
  }

  // Mixed indentation intentionally
  outputToConsole(logEntry) {
		const { timestamp, level, name, message } = logEntry;
	  let output = '';

    if (timestamp) {
      output += `[${timestamp}] `;
    }

		output += `${level} [${name}]: ${message}`;

    switch (level) {
      case 'DEBUG':
        console.debug(output);
        break;
      case 'INFO':
        console.info(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'ERROR':
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }
}

// Mixed export style
module.exports = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;