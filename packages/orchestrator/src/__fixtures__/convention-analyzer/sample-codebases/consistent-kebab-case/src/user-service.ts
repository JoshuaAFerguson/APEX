/**
 * User service with consistent kebab-case naming conventions
 */
import { stringHelpers } from './utils/string-helpers.js';

class UserService {
  private userDatabase: Map<string, User> = new Map();

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | null {
    const normalizedId = stringHelpers.normalizeId(userId);
    return this.userDatabase.get(normalizedId) || null;
  }

  /**
   * Create new user
   */
  createNewUser(userData: CreateUserRequest): User {
    const userId = stringHelpers.generateId();
    const newUser = {
      id: userId,
      name: userData.name,
      email: userData.email,
      createdAt: new Date()
    };

    this.userDatabase.set(userId, newUser);
    return newUser;
  }

  /**
   * Update existing user
   */
  updateUserProfile(userId: string, updateData: Partial<User>): User | null {
    const existingUser = this.getUserById(userId);
    if (!existingUser) {
      return null;
    }

    const updatedUser = { ...existingUser, ...updateData };
    this.userDatabase.set(userId, updatedUser);
    return updatedUser;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

export { UserService };