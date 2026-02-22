#!/usr/bin/env python3
"""
Sample Python file for testing the PythonExtractor extractFromFile method.

This module demonstrates various Python language constructs for comprehensive testing.
"""

import os
import sys
from typing import List, Dict, Optional, Union, Any
from dataclasses import dataclass, field
from abc import ABC, abstractmethod

# Module-level constants
VERSION = "1.0.0"
DEBUG_MODE = True
MAX_ITEMS = 100

# Type aliases
StringList = List[str]
ConfigDict = Dict[str, Any]

@dataclass
class User:
    """A user data class with various field types."""

    id: int
    name: str
    email: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True

    def __post_init__(self):
        """Validate user data after initialization."""
        if not self.email:
            raise ValueError("Email is required")

    @property
    def display_name(self) -> str:
        """Get the display name."""
        return f"{self.name} <{self.email}>"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        """Create User from dictionary."""
        return cls(
            id=data['id'],
            name=data['name'],
            email=data['email'],
            tags=data.get('tags', []),
            metadata=data.get('metadata', {}),
            is_active=data.get('is_active', True)
        )

class Repository(ABC):
    """Abstract repository base class."""

    @abstractmethod
    async def save(self, item: Any) -> None:
        """Save an item to the repository."""
        pass

    @abstractmethod
    async def find_by_id(self, item_id: int) -> Optional[Any]:
        """Find an item by ID."""
        pass

class UserRepository(Repository):
    """Concrete user repository implementation."""

    def __init__(self):
        """Initialize the user repository."""
        self._users: Dict[int, User] = {}
        self._next_id = 1

    async def save(self, user: User) -> None:
        """Save a user to the repository."""
        if user.id == 0:
            user.id = self._next_id
            self._next_id += 1
        self._users[user.id] = user

    async def find_by_id(self, user_id: int) -> Optional[User]:
        """Find a user by ID."""
        return self._users.get(user_id)

    async def find_all_active(self) -> List[User]:
        """Find all active users."""
        return [user for user in self._users.values() if user.is_active]

# Utility functions
def validate_email(email: str) -> bool:
    """Validate email format (simple version)."""
    return "@" in email and "." in email.split("@")[-1]

async def process_users(users: List[User], repository: UserRepository) -> int:
    """Process a list of users."""
    processed = 0
    for user in users:
        if validate_email(user.email):
            await repository.save(user)
            processed += 1
    return processed

def create_sample_users() -> List[User]:
    """Create sample users for testing."""
    return [
        User(id=1, name="John Doe", email="john@example.com"),
        User(id=2, name="Jane Smith", email="jane@example.com"),
        User(id=3, name="Bob Johnson", email="bob@example.com", is_active=False),
    ]

# Lambda functions and complex expressions
filter_active = lambda users: [u for u in users if u.is_active]
sort_by_name = lambda users: sorted(users, key=lambda u: u.name)

def main() -> None:
    """Main function."""
    print(f"User Management System v{VERSION}")

    if DEBUG_MODE:
        print("Debug mode enabled")

    # Create repository and sample data
    repo = UserRepository()
    users = create_sample_users()

    # Filter and sort
    active_users = filter_active(users)
    sorted_users = sort_by_name(active_users)

    print(f"Found {len(sorted_users)} active users")

if __name__ == "__main__":
    main()