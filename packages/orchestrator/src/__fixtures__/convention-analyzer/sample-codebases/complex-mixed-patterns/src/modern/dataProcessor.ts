// @ts-nocheck
/**
 * Modern data processor with TypeScript and current conventions
 * @since 2.0.0
 * @author Development Team
 */
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';

/**
 * Configuration interface for data processing
 * @public
 */
export interface ProcessingConfig {
  readonly maxItems: number;
  readonly timeout: number;
  readonly debug?: boolean;
  readonly retryAttempts?: number;
}

/**
 * Data item interface with strict typing
 */
export interface DataItem {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly metadata?: Record<string, string>;
}

/**
 * Processing result with comprehensive information
 */
export interface ProcessingResult {
  readonly processedItems: ProcessedItem[];
  readonly totalProcessed: number;
  readonly processingTime: number;
  readonly errors: ProcessingError[];
}

export interface ProcessedItem extends DataItem {
  readonly processedAt: Date;
  readonly version: string;
}

export interface ProcessingError {
  readonly itemId: string;
  readonly error: string;
  readonly timestamp: Date;
}

/**
 * Modern data processor with event-driven architecture
 *
 * @example
 * ```typescript
 * const processor = new DataProcessor({
 *   maxItems: 1000,
 *   timeout: 5000,
 *   debug: true
 * });
 *
 * const result = await processor.processData(items);
 * console.log(`Processed ${result.totalProcessed} items`);
 * ```
 *
 * @public
 */
export class DataProcessor extends EventEmitter {
  private readonly config: ProcessingConfig;
  private readonly logger: Logger;
  private readonly CURRENT_VERSION = '2.0.0';

  /**
   * Creates new data processor instance
   * @param config - Processing configuration
   * @throws {Error} When configuration is invalid
   */
  constructor(config: ProcessingConfig) {
    super();

    this.validateConfig(config);
    this.config = { ...config };
    this.logger = new Logger('DataProcessor');

    this.logger.info('DataProcessor initialized with config:', config);
  }

  /**
   * Process array of data items with comprehensive error handling
   * @param inputData - Array of items to process
   * @returns Promise resolving to processing result
   * @throws {Error} When input validation fails
   *
   * @example
   * ```typescript
   * const items = [
   *   { id: '1', data: { name: 'Item 1' } },
   *   { id: '2', data: { name: 'Item 2' } }
   * ];
   * const result = await processor.processData(items);
   * ```
   */
  async processData(inputData: DataItem[]): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processedItems: ProcessedItem[] = [];
    const errors: ProcessingError[] = [];

    this.emit('processingStarted', { itemCount: inputData.length });

    try {
      for (const [index, item] of inputData.entries()) {
        try {
          if (index >= this.config.maxItems) {
            this.logger.warn(`Reached max items limit: ${this.config.maxItems}`);
            break;
          }

          const validatedItem = await this.validateItem(item);
          const processedItem = await this.transformItem(validatedItem);

          processedItems.push(processedItem);
          this.emit('itemProcessed', { item: processedItem, index });

        } catch (error) {
          const processingError: ProcessingError = {
            itemId: item.id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          };

          errors.push(processingError);
          this.emit('itemError', processingError);

          if (this.config.debug) {
            this.logger.error(`Error processing item ${item.id}:`, error);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      const result: ProcessingResult = {
        processedItems,
        totalProcessed: processedItems.length,
        processingTime,
        errors
      };

      this.emit('processingCompleted', result);
      this.logger.info(`Processing completed: ${result.totalProcessed} items in ${processingTime}ms`);

      return result;

    } catch (error) {
      this.emit('processingFailed', { error });
      throw new Error(`Data processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate individual data item
   * @private
   */
  private async validateItem(item: DataItem): Promise<DataItem> {
    if (!item || typeof item !== 'object') {
      throw new Error('Item must be an object');
    }

    if (!item.id || typeof item.id !== 'string') {
      throw new Error('Item must have string ID');
    }

    if (!item.data || typeof item.data !== 'object') {
      throw new Error('Item must have data object');
    }

    return item;
  }

  /**
   * Transform validated item to processed format
   * @private
   */
  private async transformItem(item: DataItem): Promise<ProcessedItem> {
    return {
      ...item,
      processedAt: new Date(),
      version: this.CURRENT_VERSION
    };
  }

  /**
   * Validate processor configuration
   * @private
   */
  private validateConfig(config: ProcessingConfig): void {
    if (!config) {
      throw new Error('Configuration is required');
    }

    if (config.maxItems <= 0) {
      throw new Error('maxItems must be positive');
    }

    if (config.timeout <= 0) {
      throw new Error('timeout must be positive');
    }
  }

  /**
   * Get current processing statistics
   * @returns Current processor statistics
   */
  getStatistics(): Record<string, unknown> {
    return {
      version: this.CURRENT_VERSION,
      config: this.config,
      eventsCount: this.listenerCount('processingCompleted')
    };
  }
}