
/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum
 */
export function addNumbers(a: number, b: number): number {
  return a + b;
}

/**
 * User profile information
 */
export interface UserProfile {
  /** User's unique identifier */
  id: number;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
}
