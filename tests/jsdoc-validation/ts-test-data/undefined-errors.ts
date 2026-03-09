
/**
 * Function that uses undefined variables
 * @returns {string} Should return a string
 */
export function undefinedError(): string {
  // This should cause a compilation error: undefinedVariable is not defined
  return undefinedVariable.toString();
}

/**
 * Function with strict null check violations
 * @param {string | null} input - Potentially null input
 * @returns {string} Returns processed string
 */
export function nullCheckError(input: string | null): string {
  // This should cause an error with strict null checks
  return input.toUpperCase();
}
