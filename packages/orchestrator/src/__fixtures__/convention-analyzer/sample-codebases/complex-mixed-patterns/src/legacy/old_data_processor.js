// Legacy JavaScript file with old conventions
const fs = require('fs');
const path = require('path');

// Old snake_case constants
const MAX_BUFFER_SIZE = 1024;
const default_timeout = 30000;
const ERROR_CODES = {
  FILE_NOT_FOUND: 1001,
  PERMISSION_DENIED: 1002,
  INVALID_DATA: 1003
};

// Mixed naming in legacy code
function process_raw_data(input_data, config_options) {
  let processed_items = [];
  const start_time = Date.now();

  // Legacy comment style
  for(let i = 0; i < input_data.length; i++) {
    const current_item = input_data[i];

    // Inconsistent indentation (tabs mixed with spaces)
		if (validate_item_format(current_item)) {
    	const transformed_item = transform_data_item(current_item, config_options);
      processed_items.push(transformed_item);
		}
  }

  const end_time = Date.now();
  console.log(`Processing took ${end_time - start_time}ms`);

  return processed_items;
}

// Old function naming
function validate_item_format(item) {
  return item && typeof item === 'object' && item.hasOwnProperty('id');
}

function transform_data_item(item, options) {
  return {
    id: item.id,
    data: item.data,
    timestamp: new Date(),
    options: options || {}
  };
}

// Legacy error handler
function handle_processing_error(error, context) {
  console.error('Error in processing:', error.message);
  if (context && context.debug) {
    console.error('Stack trace:', error.stack);
  }
}

// Old module.exports pattern
module.exports = {
  process_raw_data,
  validate_item_format,
  transform_data_item,
  handle_processing_error,
  ERROR_CODES
};