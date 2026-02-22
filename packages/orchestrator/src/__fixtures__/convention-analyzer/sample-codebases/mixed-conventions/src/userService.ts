/**
 * Mixed conventions - camelCase file name
 */
class UserService {
  private user_database: Map<string, User> = new Map();

  getUserById(user_id: string): User | null {
    return this.user_database.get(user_id) || null;
  }

  CreateNewUser(userData: CreateUserRequest): User {
    const userId = this.generate_id();
    const newUser = {
      id: userId,
      name: userData.name,
      email: userData.email,
      createdAt: new Date()
    };

    this.user_database.set(userId, newUser);
    return newUser;
  }

  private generate_id(): string {
		return `user-${Date.now()}`;
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