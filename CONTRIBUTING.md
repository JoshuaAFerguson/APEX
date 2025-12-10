# Contributing to APEX

Thank you for your interest in contributing to APEX! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/JoshuaAFerguson/apex/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs or screenshots

### Suggesting Features

1. Check existing [Discussions](https://github.com/JoshuaAFerguson/apex/discussions) for similar ideas
2. Create a new discussion with:
   - Clear description of the feature
   - Use case and motivation
   - Proposed implementation (if any)

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Write/update tests
5. Ensure all tests pass: `npm test`
6. Commit with conventional commits: `git commit -m "feat: add new feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/apex.git
cd apex

# Install dependencies
npm install

# Build all packages
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## Project Structure

```
apex/
├── packages/
│   ├── core/           # Shared types, config, utilities
│   ├── orchestrator/   # Claude Agent SDK integration
│   ├── cli/            # Command-line interface
│   ├── api/            # REST + WebSocket server
│   ├── web-ui/         # Dashboard (React)
│   └── vscode/         # VS Code extension
├── templates/          # Default templates
├── docs/               # Documentation
└── examples/           # Example projects
```

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

### Pull Requests

- Keep PRs focused on a single change
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes

## Testing

```bash
# Run all tests
npm test

# Run tests for a specific package
npm test --workspace=@apex/core

# Run tests with coverage
npm test -- --coverage
```

## Documentation

- Update docs when changing user-facing features
- Use clear, concise language
- Include code examples where appropriate
- Keep README and docs in sync

## Release Process

1. Update version in `package.json` files
2. Update CHANGELOG.md
3. Create a release PR
4. After merge, tag the release: `git tag v0.1.0`
5. Push tags: `git push --tags`
6. GitHub Actions will publish to npm

## Getting Help

- [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions) - Ask questions
- [Discord](#) - Real-time chat (coming soon)

## Recognition

Contributors are recognized in:
- CONTRIBUTORS.md
- Release notes
- README acknowledgments

Thank you for contributing to APEX! 🚀
