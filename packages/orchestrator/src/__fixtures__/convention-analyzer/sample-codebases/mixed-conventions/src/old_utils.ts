// Mixed conventions - snake_case file name
// This file has no JSDoc but some inline comments

function string_helper(input_string: string): string {
    // Using 4 spaces for indentation here
    return input_string.toLowerCase().trim();
}

const FORMAT_DISPLAY = (rawName: string): string => {
	// Using tabs for indentation here
	return rawName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

var generate_random_id = function() {
  // Mix of var, const, and let
  let timestamp = Date.now()
  const random_part = Math.random().toString(36).substring(2, 8)
  return timestamp + random_part
}

// Export using different patterns
module.exports = {
  string_helper,
  FORMAT_DISPLAY,
  generate_random_id
};