/**
 * @jest-environment node
 * @group integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SupportedLanguage } from '../../parsers/types.js';
import { PythonExtractor } from '../python-extractor.js';
import { SymbolKind } from '../types.js';

describe('PythonExtractor Integration Tests', () => {
  let extractor: PythonExtractor;

  beforeEach(() => {
    PythonExtractor.resetInstance();
    extractor = PythonExtractor.getInstance();
  });

  afterEach(() => {
    PythonExtractor.resetInstance();
  });

  describe('complex Python code examples', () => {
    it('should extract from a FastAPI application', async () => {
      const code = `
"""
A sample FastAPI application with various Python constructs.
"""

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import uvicorn


# Constants
API_VERSION = "v1"
DEFAULT_PORT = 8000
DEBUG_MODE = True

app = FastAPI(title="Sample API", version=API_VERSION)


class User(BaseModel):
    """User model with validation."""

    id: int
    name: str
    email: str
    is_active: bool = True

    @property
    def display_name(self) -> str:
        """Get formatted display name."""
        return f"{self.name} ({self.email})"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "User":
        """Create user from dictionary."""
        return cls(**data)

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        return "@" in email and "." in email


class UserService:
    """Service for managing users."""

    def __init__(self):
        self._users: Dict[int, User] = {}
        self._next_id = 1

    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create a new user."""
        user = User.from_dict(user_data)
        user.id = self._next_id
        self._users[user.id] = user
        self._next_id += 1
        return user

    async def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        return self._users.get(user_id)

    async def list_users(self, active_only: bool = True) -> List[User]:
        """List all users."""
        users = list(self._users.values())
        if active_only:
            users = [u for u in users if u.is_active]
        return users


# Dependency injection
def get_user_service() -> UserService:
    """Get user service instance."""
    return UserService()


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Hello World", "version": API_VERSION}


@app.post("/users", response_model=User)
async def create_user(
    user_data: Dict[str, Any],
    service: UserService = Depends(get_user_service)
) -> User:
    """Create a new user."""
    if not User.validate_email(user_data.get("email", "")):
        raise HTTPException(status_code=400, detail="Invalid email")

    return await service.create_user(user_data)


@app.get("/users/{user_id}", response_model=Optional[User])
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service)
) -> Optional[User]:
    """Get user by ID."""
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/users", response_model=List[User])
async def list_users(
    active_only: bool = True,
    service: UserService = Depends(get_user_service)
) -> List[User]:
    """List users."""
    return await service.list_users(active_only)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=DEFAULT_PORT, debug=DEBUG_MODE)
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true,
        includeSignatures: true,
        includeImports: true,
        includeDecorators: true
      });

      // Should extract various symbol types
      expect(result.symbols.length).toBeGreaterThan(10);

      // Check for constants
      const constants = result.symbols.filter(s => s.kind === SymbolKind.Constant);
      expect(constants.length).toBeGreaterThanOrEqual(3); // API_VERSION, DEFAULT_PORT, DEBUG_MODE
      expect(constants.some(c => c.name === 'API_VERSION')).toBe(true);

      // Check for classes
      const classes = result.symbols.filter(s => s.kind === SymbolKind.Class);
      expect(classes.length).toBeGreaterThanOrEqual(2); // User, UserService

      const userClass = classes.find(c => c.name === 'User');
      expect(userClass).toBeDefined();
      expect(userClass!.children).toBeDefined();
      expect(userClass!.children!.length).toBeGreaterThan(3); // Properties and methods

      // Check for methods with decorators
      const userMethods = userClass!.children!.filter(c => c.kind === SymbolKind.Method);
      const propertyMethod = userMethods.find(m => m.modifiers.includes('property'));
      expect(propertyMethod).toBeDefined();

      const classmethodMethod = userMethods.find(m => m.modifiers.includes('classmethod'));
      expect(classmethodMethod).toBeDefined();

      const staticmethodMethod = userMethods.find(m => m.modifiers.includes('staticmethod'));
      expect(staticmethodMethod).toBeDefined();

      // Check for async functions
      const asyncFunctions = result.symbols.filter(s =>
        s.kind === SymbolKind.Function && s.modifiers.includes('async')
      );
      expect(asyncFunctions.length).toBeGreaterThan(0);

      // Check for imports
      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );
      expect(imports.length).toBeGreaterThan(0);

      // Check documentation extraction
      const documentedSymbols = result.symbols.filter(s => s.documentation);
      expect(documentedSymbols.length).toBeGreaterThan(0);
    });

    it('should extract from a data science module', async () => {
      const code = `
"""
Data analysis utilities for machine learning projects.
"""

import numpy as np
import pandas as pd
from typing import Tuple, List, Union, Optional
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt


# Configuration
RANDOM_SEED = 42
DEFAULT_TEST_SIZE = 0.2
PLOT_STYLE = "seaborn"


class DataPreprocessor(BaseEstimator, TransformerMixin):
    """Preprocessing pipeline for ML data."""

    def __init__(self,
                 normalize: bool = True,
                 handle_missing: bool = True,
                 random_state: int = RANDOM_SEED):
        """Initialize preprocessor."""
        self.normalize = normalize
        self.handle_missing = handle_missing
        self.random_state = random_state
        self._scaler: Optional[StandardScaler] = None
        self._fitted = False

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None):
        """Fit the preprocessor to training data."""
        if self.normalize:
            self._scaler = StandardScaler()
            self._scaler.fit(X)

        self._fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform input data."""
        if not self._fitted:
            raise ValueError("Preprocessor must be fitted before transform")

        X_processed = X.copy()

        if self.handle_missing:
            X_processed = self._handle_missing_values(X_processed)

        if self.normalize and self._scaler:
            numeric_cols = X_processed.select_dtypes(include=[np.number]).columns
            X_processed[numeric_cols] = self._scaler.transform(X_processed[numeric_cols])

        return X_processed

    def fit_transform(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> pd.DataFrame:
        """Fit preprocessor and transform data."""
        return self.fit(X, y).transform(X)

    def _handle_missing_values(self, X: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values in the dataset."""
        numeric_cols = X.select_dtypes(include=[np.number]).columns
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns

        # Fill numeric missing values with median
        for col in numeric_cols:
            X[col] = X[col].fillna(X[col].median())

        # Fill categorical missing values with mode
        for col in categorical_cols:
            X[col] = X[col].fillna(X[col].mode().iloc[0] if not X[col].mode().empty else 'Unknown')

        return X

    @property
    def is_fitted(self) -> bool:
        """Check if preprocessor is fitted."""
        return self._fitted

    @staticmethod
    def get_feature_types(X: pd.DataFrame) -> Dict[str, List[str]]:
        """Get feature types from DataFrame."""
        return {
            'numeric': X.select_dtypes(include=[np.number]).columns.tolist(),
            'categorical': X.select_dtypes(include=['object', 'category']).columns.tolist(),
            'datetime': X.select_dtypes(include=['datetime64']).columns.tolist()
        }


def load_and_split_data(
    filepath: str,
    target_column: str,
    test_size: float = DEFAULT_TEST_SIZE,
    random_state: int = RANDOM_SEED
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Load data and split into train/test sets."""

    # Load data
    data = pd.read_csv(filepath)

    # Separate features and target
    X = data.drop(columns=[target_column])
    y = data[target_column]

    # Split data
    from sklearn.model_selection import train_test_split
    return train_test_split(X, y, test_size=test_size, random_state=random_state)


async def analyze_data_quality(df: pd.DataFrame) -> Dict[str, Union[int, float, Dict]]:
    """Analyze data quality metrics."""

    analysis = {
        'shape': df.shape,
        'missing_values': df.isnull().sum().to_dict(),
        'duplicates': df.duplicated().sum(),
        'memory_usage': df.memory_usage(deep=True).sum(),
        'data_types': df.dtypes.to_dict()
    }

    # Numeric column statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        analysis['numeric_stats'] = df[numeric_cols].describe().to_dict()

    return analysis


def plot_feature_distributions(
    X: pd.DataFrame,
    features: Optional[List[str]] = None,
    figsize: Tuple[int, int] = (15, 10)
) -> None:
    """Plot feature distributions."""

    plt.style.use(PLOT_STYLE)

    if features is None:
        features = X.select_dtypes(include=[np.number]).columns.tolist()[:9]  # Max 9 plots

    n_features = len(features)
    n_cols = 3
    n_rows = (n_features + n_cols - 1) // n_cols

    fig, axes = plt.subplots(n_rows, n_cols, figsize=figsize)
    axes = axes.flatten() if n_features > 1 else [axes]

    for i, feature in enumerate(features):
        if i < len(axes):
            X[feature].hist(ax=axes[i], bins=30, alpha=0.7)
            axes[i].set_title(f'Distribution of {feature}')
            axes[i].set_xlabel(feature)
            axes[i].set_ylabel('Frequency')

    # Hide unused subplots
    for i in range(n_features, len(axes)):
        axes[i].set_visible(False)

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    # Example usage
    data_path = "sample_data.csv"
    target = "target"

    # Load and split data
    X_train, X_test, y_train, y_test = load_and_split_data(data_path, target)

    # Preprocess data
    preprocessor = DataPreprocessor(normalize=True, handle_missing=True)
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)

    # Analyze data quality
    import asyncio
    quality_report = asyncio.run(analyze_data_quality(X_train))
    print("Data Quality Report:", quality_report)

    # Plot distributions
    plot_feature_distributions(X_train_processed)
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true,
        includeSignatures: true,
        includeImports: true,
        includeDecorators: true
      });

      // Verify comprehensive extraction
      expect(result.symbols.length).toBeGreaterThan(8);

      // Check for imports
      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );
      expect(imports.length).toBeGreaterThan(0);

      // Check for constants
      const constants = result.symbols.filter(s => s.kind === SymbolKind.Constant);
      expect(constants.length).toBeGreaterThanOrEqual(3);

      // Check for the DataPreprocessor class
      const classes = result.symbols.filter(s => s.kind === SymbolKind.Class);
      const dataPreprocessorClass = classes.find(c => c.name === 'DataPreprocessor');
      expect(dataPreprocessorClass).toBeDefined();
      expect(dataPreprocessorClass!.children).toBeDefined();
      expect(dataPreprocessorClass!.children!.length).toBeGreaterThan(5);

      // Check for async function
      const asyncFunctions = result.symbols.filter(s =>
        s.kind === SymbolKind.Function && s.modifiers.includes('async')
      );
      expect(asyncFunctions.length).toBeGreaterThanOrEqual(1);

      // Check for functions with complex signatures
      const functions = result.symbols.filter(s => s.kind === SymbolKind.Function);
      const complexFunction = functions.find(f => f.signature && f.signature.includes('Tuple'));
      expect(complexFunction).toBeDefined();

      // Verify documentation extraction
      const documentedSymbols = result.symbols.filter(s => s.documentation);
      expect(documentedSymbols.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested structures', async () => {
      const code = `
class Level1:
    """Level 1 class"""

    class Level2:
        """Level 2 class"""

        def method_l2(self):
            """Level 2 method"""
            pass

        class Level3:
            """Level 3 class"""

            def method_l3(self):
                """Level 3 method"""
                pass

            class Level4:
                """Level 4 class"""

                def method_l4(self):
                    """Level 4 method"""
                    pass

    def method_l1(self):
        """Level 1 method"""
        pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true,
        maxDepth: 3
      });

      expect(result.symbols).toHaveLength(1);
      const level1 = result.symbols[0];
      expect(level1.name).toBe('Level1');
      expect(level1.children).toBeDefined();
      expect(level1.children!.length).toBeGreaterThan(0);

      // Should respect max depth
      const level2 = level1.children!.find(c => c.name === 'Level2');
      expect(level2).toBeDefined();
    });
  });

  describe('error recovery', () => {
    it('should extract valid symbols from partially invalid code', async () => {
      const code = `
def valid_function():
    """This function is valid."""
    return True

# This has a syntax error
def invalid_function(
    missing_paren
    pass

class ValidClass:
    """This class is valid."""

    def valid_method(self):
        return "valid"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      // Should still extract valid symbols
      const validSymbols = result.symbols.filter(s =>
        s.name === 'valid_function' || s.name === 'ValidClass'
      );
      expect(validSymbols.length).toBeGreaterThan(0);

      // Should report errors
      expect(result.hasErrors).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle large files efficiently', async () => {
      // Generate a large Python file
      const functions = Array.from({ length: 100 }, (_, i) => `
def function_${i}(param1: str, param2: int = ${i}) -> str:
    """Function number ${i}."""
    return f"Function {param1} with {param2}"
`).join('\n');

      const classes = Array.from({ length: 50 }, (_, i) => `
class Class${i}:
    """Class number ${i}."""

    def __init__(self, value: int = ${i}):
        self.value = value

    def method_${i}(self) -> int:
        """Method ${i}."""
        return self.value * ${i}
`).join('\n');

      const code = functions + '\n' + classes;

      const startTime = performance.now();
      const result = await extractor.extract(code, SupportedLanguage.Python);
      const endTime = performance.now();

      // Should extract all symbols
      expect(result.symbols.length).toBeGreaterThan(100); // 100 functions + 50 classes

      // Should complete reasonably quickly (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should report extraction time
      expect(result.extractionTimeMs).toBeGreaterThan(0);
    });
  });
});