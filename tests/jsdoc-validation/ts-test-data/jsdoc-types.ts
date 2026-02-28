
/**
 * @typedef {Object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} Rectangle
 * @property {Point} topLeft - Top left corner
 * @property {Point} bottomRight - Bottom right corner
 */

/**
 * Calculates the distance between two points
 * @param {Point} point1 - First point
 * @param {Point} point2 - Second point
 * @returns {number} Distance between points
 */
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the area of a rectangle
 * @param {Rectangle} rect - The rectangle
 * @returns {number} The area
 */
export function calculateRectangleArea(rect: {
  topLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}): number {
  const width = rect.bottomRight.x - rect.topLeft.x;
  const height = rect.bottomRight.y - rect.topLeft.y;
  return Math.abs(width * height);
}

/**
 * Array of numbers
 * @type {number[]}
 */
export const numbers: number[] = [1, 2, 3, 4, 5];

/**
 * Configuration object
 * @type {{ apiUrl: string, timeout: number, retries: number }}
 */
export const config: { apiUrl: string; timeout: number; retries: number } = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
