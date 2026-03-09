
/**
 * Represents a user account in the system
 * @example
 * const user = new UserAccount('john@example.com', 'John Doe');
 * await user.save();
 */
export class UserAccount {
  private _email: string;
  private _name: string;
  private _id?: string;

  /**
   * Creates a new user account
   * @param {string} email - The user's email address
   * @param {string} name - The user's display name
   */
  constructor(email: string, name: string) {
    this._email = email;
    this._name = name;
  }

  /**
   * Gets the user's email address
   * @returns {string} The email address
   */
  get email(): string {
    return this._email;
  }

  /**
   * Gets the user's display name
   * @returns {string} The display name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the user's unique identifier
   * @returns {string | undefined} The user ID if set
   */
  get id(): string | undefined {
    return this._id;
  }

  /**
   * Saves the user account to the database
   * @returns {Promise<void>} Resolves when save is complete
   * @throws {Error} When save operation fails
   */
  async save(): Promise<void> {
    // Simulated save operation
    if (!this._email.includes('@')) {
      throw new Error('Invalid email format');
    }
    this._id = Math.random().toString(36).substr(2, 9);
  }

  /**
   * Updates the user's display name
   * @param {string} newName - The new display name
   * @returns {void}
   */
  updateName(newName: string): void {
    if (newName.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    this._name = newName.trim();
  }
}
