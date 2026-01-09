# Publishing

This package uses **semantic-release** for fully automated versioning and publishing. Releases are triggered automatically when commits are pushed to `main`.

## How It Works

```
Push to main → CI runs tests → semantic-release analyzes commits →
  → Determines version bump (patch/minor/major)
  → Updates CHANGELOG.md
  → Publishes to npm
  → Publishes to GitHub Packages
  → Creates GitHub Release
```

## Commit Convention

Releases are determined by commit messages using [Conventional Commits](https://www.conventionalcommits.org/):

| Commit Type | Description | Version Bump |
|-------------|-------------|--------------|
| `feat:` | New feature | Minor (0.x.0) |
| `fix:` | Bug fix | Patch (0.0.x) |
| `perf:` | Performance improvement | Patch |
| `docs:` | Documentation (README only) | Patch |
| `feat!:` or `BREAKING CHANGE:` | Breaking change | Major (x.0.0) |
| `chore:`, `ci:`, `style:`, `refactor:`, `test:` | Maintenance | No release |

### Examples

```bash
# Triggers patch release (0.0.x)
git commit -m "fix: handle null affiliate codes correctly"

# Triggers minor release (0.x.0)
git commit -m "feat: add webhook retry logic"

# Triggers major release (x.0.0)
git commit -m "feat!: change API response format"
# or
git commit -m "feat: redesign API

BREAKING CHANGE: response format changed from array to object"

# No release triggered
git commit -m "chore: update dependencies"
git commit -m "test: add unit tests for referral tracking"
```

## Setup Requirements

### GitHub Secrets

The release workflow requires the following secret:

- **`NPM_TOKEN`** - npm automation token with publish permissions
  - Generate at: https://www.npmjs.com/settings/tokens
  - Select "Automation" type for CI usage

### Package Registries

The package is published to:
1. **npm** (primary): https://www.npmjs.com/package/chief_emerie
2. **GitHub Packages**: https://github.com/chiemerieokorie/affiliates/packages

## Workflow Files

- `.github/workflows/release.yml` - Runs on push to main, handles releases
- `.github/workflows/test.yml` - Runs on pull requests, validates changes

## Manual Release (Emergency Only)

If you need to manually publish (not recommended):

```bash
npm login
npm run build:clean
npm test
npm publish --access public
```

## Rollback

If a bad version is published:

1. **Within 72 hours**: `npm unpublish chief_emerie@<bad-version>`
2. Fix the issue
3. Push a `fix:` commit to trigger a patch release

## Building a Local Package

For testing locally before merge:

```bash
npm run build:clean
npm pack
# Creates chief_emerie-x.x.x.tgz
# Install in another project: npm install ./path/to/chief_emerie-x.x.x.tgz
```
