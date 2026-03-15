import { AiDriver } from './types.js';
import { AnthropicDriver } from './anthropic-driver.js';
import { OpenAiCodexDriver } from './openai-driver.js';
import { GeminiDriver } from './gemini-driver.js';
import { GenericAgnosticDriver } from './agnostic-driver.js';

export * from './types.js';
export * from './anthropic-driver.js';
export * from './openai-driver.js';
export * from './gemini-driver.js';
export * from './agnostic-driver.js';

export class DriverFactory {
  private static drivers: Map<string, AiDriver> = new Map();

  static getDriver(providerId: string): AiDriver {
    if (this.drivers.has(providerId)) {
      return this.drivers.get(providerId)!;
    }

    let driver: AiDriver;
    switch (providerId) {
      case 'anthropic':
        driver = new AnthropicDriver();
        break;
      case 'openai':
      case 'openai-codex':
        driver = new OpenAiCodexDriver();
        break;
      case 'gemini':
        driver = new GeminiDriver();
        break;
      case 'agnostic':
        driver = new GenericAgnosticDriver();
        break;
      default:
        throw new Error(`Unsupported AI provider: ${providerId}`);
    }

    this.drivers.set(providerId, driver);
    return driver;
  }
}
