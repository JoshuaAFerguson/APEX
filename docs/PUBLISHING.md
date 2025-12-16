# Publishing APEX to NPM

This guide explains how to set up and publish APEX packages to npm.

## Prerequisites

### 1. NPM Account & Organization

1. Create an npm account at https://www.npmjs.com/signup
2. The npm organization is `apexcli` (scope: `@apexcli`)
   - Organization URL: https://www.npmjs.com/org/apexcli

### 2. NPM Access Token

1. Log into npm: `npm login`
2. Generate an access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type (for CI/CD)
   - Copy the token (starts with `npm_`)

### 3. GitHub Secrets

Add the npm token to your GitHub repository:

1. Go to your repo: https://github.com/JoshuaAFerguson/apex
2. Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Your npm automation token

## Branch Protection

Configure branch protection for the `main` branch:

1. Go to Settings > Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Recommended settings:
   - [x] Require a pull request before merging
   - [x] Require approvals (1 minimum)
   - [x] Dismiss stale pull request approvals when new commits are pushed
   - [x] Require status checks to pass before merging
     - Add required status: `build (18.x)` and `build (20.x)`
   - [x] Require branches to be up to date before merging
   - [x] Require conversation resolution before merging
   - [ ] Require signed commits (optional, but recommended)
   - [x] Do not allow bypassing the above settings

## Publishing Process

### Automatic Publishing (Recommended)

1. Update version numbers in all package.json files
2. Commit and push to a feature branch
3. Create a PR to main
4. After PR is merged, create a GitHub Release:
   - Go to Releases > "Draft a new release"
   - Create a new tag (e.g., `v0.3.0`)
   - Title: `v0.3.0`
   - Description: Changelog/release notes
   - Click "Publish release"
5. The publish workflow will automatically:
   - Build all packages
   - Run tests
   - Publish to npm in dependency order

### Manual Publishing (Emergency)

If you need to publish manually:

```bash
# Login to npm
npm login

# Build all packages
npm run build

# Publish in order (from repo root)
npm publish --workspace=@apexcli/core --access public
npm publish --workspace=@apexcli/orchestrator --access public
npm publish --workspace=@apexcli/api --access public
npm publish --workspace=@apexcli/cli --access public
```

## Version Management

All packages should use the same version number for simplicity.

To bump versions across all packages:

```bash
# Manual approach - update each package.json
# Or use npm version with workspaces (npm 8+):
npm version patch --workspaces --include-workspace-root
```

## Checking Package Status

After publishing, verify packages are live:

```bash
npm info @apexcli/cli
npm info @apexcli/core
npm info @apexcli/orchestrator
npm info @apexcli/api
```

## Installation

Users will install APEX with:

```bash
# Global installation (recommended)
npm install -g @apexcli/cli

# Or use npx without installing
npx @apexcli/cli init
```

## Troubleshooting

### "Package name already exists"

The `@apex` scope may already be taken on npm. Options:
1. Check availability: `npm info @apexcli/cli`
2. Use alternative scope: `@apex-dev`, `@apex-cli`, etc.
3. Update all package.json files with new scope
4. Update internal dependencies to match

### "Must be logged in to publish"

```bash
npm login
npm whoami  # Verify you're logged in
```

### "Cannot publish over existing version"

You can't republish the same version. Bump the version number:

```bash
npm version patch --workspaces --include-workspace-root
```

### Workspace dependency issues

If npm can't find workspace packages during install:

```bash
# Ensure you're using npm 7+ with workspaces support
npm --version

# Clear and reinstall
npm run clean
npm install
```
