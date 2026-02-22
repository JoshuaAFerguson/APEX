// Test file with mixed conventions
const { DataProcessor } = require('../src/modern/dataProcessor');
const Logger = require('../src/utils/logger');

// Old-style test setup
function setup_test_data() {
  return [
    { id: '1', data: { name: 'Test Item 1' } },
    { id: '2', data: { name: 'Test Item 2' } },
    { id: '3', data: { name: 'Test Item 3' } }
  ];
}

// Mixed test naming conventions
describe('DataProcessor', () => {
  let processor;
  let test_config;

  beforeEach(() => {
    test_config = {
      maxItems: 100,
      timeout: 5000,
      debug: true
    };
    processor = new DataProcessor(test_config);
  });

  // camelCase test
  it('should process data successfully', async () => {
    const inputData = setup_test_data();
    const result = await processor.processData(inputData);

    expect(result.totalProcessed).toBe(3);
    expect(result.processedItems).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  // snake_case test
  it('should_handle_invalid_items', async () => {
    const invalid_data = [
      { id: '1', data: { name: 'Valid' } },
      { invalid: 'item' }, // Missing id and data
      { id: '3', data: { name: 'Valid' } }
    ];

    const result = await processor.processData(invalid_data);

    expect(result.totalProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].itemId).toBe(undefined);
  });

  // PascalCase test
  it('ShouldHandleMaxItemsLimit', async () => {
    const limitedProcessor = new DataProcessor({
      maxItems: 2,
      timeout: 5000
    });

    const inputData = setup_test_data(); // 3 items
    const result = await limitedProcessor.processData(inputData);

    expect(result.totalProcessed).toBe(2); // Limited to 2 items
  });

  describe('Logger Integration', () => {
    let logger;

    beforeEach(() => {
      logger = new Logger('TestLogger');
    });

    // Mixed comment styles
    it('should log processing events', () => {
      // Setup test
      const logMessages = [];
      logger.on('log', (entry) => {
        logMessages.push(entry);
      });

      /* Test various log levels */
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(logger.get_log_count()).toBe(4);
      expect(logMessages).toHaveLength(4);
    });
  });
});