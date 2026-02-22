/**
 * String utility functions with camelCase naming
 */

const SPECIAL_CHARACTERS = /[^a-zA-Z0-9]/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Normalize user ID for consistent storage
 */
function normalizeId(inputId: string): string {
  return inputId.toLowerCase().replace(SPECIAL_CHARACTERS, '').trim();
}

/**
 * Generate unique identifier
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomPart}`;
}

/**
 * Format display name from raw input
 */
function formatDisplayName(rawName: string): string {
  return rawName
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
    .split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirstLetter(inputString: string): string {
  if (!inputString) return '';
  return inputString.charAt(0).toUpperCase() + inputString.slice(1).toLowerCase();
}

/**
 * Validate email format
 */
function isValidEmail(emailAddress: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(emailAddress);
}

export const stringHelpers = {
  normalizeId,
  generateId,
  formatDisplayName,
  capitalizeFirstLetter,
  isValidEmail
};