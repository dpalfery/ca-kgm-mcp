# GitFlow CI/CD Pipeline Documentation

## Overview

This repository implements a comprehensive GitFlow CI/CD pipeline that automates testing, building, versioning, and publishing of the npm package `context-iso`.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Feature Development                         │
├─────────────────────────────────────────────────────────────────┤
│  Create feature/hotfix branch → PR to develop/main             │
│           ↓                                                      │
│  PR Validation (pr-validation.yml)                             │
│  - Lint code                                                    │
│  - Run unit tests (Node 18, 20)                               │
│  - Build TypeScript                                            │
│  - Check bundle size                                           │
│  - Generate coverage reports                                   │
└──────────────┬──────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Release Preparation (main)                      │
├─────────────────────────────────────────────────────────────────┤
│  Merge to main or create Release PR (build-release.yml)        │
│           ↓                                                      │
│  Build & Test                                                   │
│  - Install dependencies                                         │
│  - Lint all code                                                │
│  - Run integration & unit tests                                │
│  - Build and verify declarations                               │
│  - Security audit                                               │
│  - Generate SBOM                                                │
└──────────────┬──────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────────┐
│                Publishing (publish-release.yml)                │
├─────────────────────────────────────────────────────────────────┤
│  Merge main → Publish to npm                                   │
│           ↓                                                      │
│  - Run final tests                                              │
│  - Build distribution                                           │
│  - Generate changelog                                           │
│  - Publish to npm registry                                      │
│  - Create GitHub release                                        │
│  - Notify team (Slack, Email)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. **PR Validation** (`pr-validation.yml`)

**Triggers**: Pull requests to `develop`, `feature/**`, `hotfix/**` branches

**Purpose**: Validate code quality and functionality before merge

**Jobs**:
- Runs on Node.js 18.x and 20.x
- Linting: `npm run lint`
- Unit tests: `npm run test:unit`
- Build: `npm run build`
- Bundle size check (max 5MB)
- Coverage reporting (Codecov)
- PR comments with results

**Duration**: ~3-5 minutes

### 2. **Build & Release** (`build-release.yml`)

**Triggers**: Pull requests to `main`, manual trigger

**Purpose**: Prepare release artifacts and validate readiness

**Jobs**:
1. **build-and-test**:
   - Install dependencies
   - Lint code
   - Run all tests
   - Build package
   - Verify TypeScript declarations
   - Check for vulnerabilities
   - Generate SBOM (Software Bill of Materials)
   - Upload artifacts

2. **validate-release**:
   - Validate package.json structure
   - Verify all required files exist
   - Generate release notes
   - Comment on PR with readiness status

**Duration**: ~4-6 minutes

### 3. **Publish Release** (`publish-release.yml`)

**Triggers**: Push to `main`, tags matching `v*`, manual trigger

**Purpose**: Publish package to npm registry and create GitHub release

**Jobs**:
1. **publish**:
   - Run final tests
   - Build distribution
   - Generate changelog from git log
   - Determine version bump
   - Publish to npm with `--access public`
   - Create GitHub release
   - Update release documentation
   - Upload artifacts

2. **post-publish**:
   - Send Slack notification (if configured)
   - Send email notification (if configured)

**Duration**: ~3-4 minutes

### 4. **Security Audit** (`security-audit.yml`)

**Triggers**: 
- Push to `main`/`develop`
- Pull requests
- Daily at 2 AM UTC

**Purpose**: Monitor security vulnerabilities

**Jobs**:
- npm audit
- Snyk scanning (requires token)
- Dependency outdated check

**Duration**: ~2-3 minutes

### 5. **Version Bump** (`version-bump.yml`)

**Triggers**: Manual workflow dispatch

**Purpose**: Create release branch with version bump

**Inputs**:
- `version-type`: patch | minor | major

**Jobs**:
- Bumps version in package.json
- Updates CHANGELOG.md
- Creates release branch
- Creates PR to main
- Notifies team

**Duration**: ~2 minutes

## GitHub Secrets Configuration

To enable full functionality, configure these secrets in your GitHub repository settings:

### Required
- `NPM_TOKEN`: npm authentication token
  - Generate at https://www.npmjs.com/settings/~/tokens
  - Scope: Read and Publish

### Optional
- `SNYK_TOKEN`: Snyk security scanning
- `SLACK_WEBHOOK_URL`: Slack notifications
- `NOTIFICATION_EMAIL`: Email notifications

### How to Add Secrets
1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add secret name and value

## GitFlow Branching Model

```
main (production) ← releases, hotfixes
  ↑
  └─ release/v*.*.* ← version bumps, changelog
       ↑
       └─ develop (staging) ← feature, bugfix branches
            ↑
            ├─ feature/FEATURE-NAME ← new features
            ├─ bugfix/BUG-NAME ← bug fixes
            └─ hotfix/HOTFIX-NAME ← critical fixes
```

### Branch Strategy

1. **main**: Production-ready code
   - Only updated via release PRs
   - Protected branch (requires PR review)
   - Tags: `v*.*.*`

2. **develop**: Integration branch
   - Receives feature/bugfix/hotfix PRs
   - Protected branch (requires PR review)
   - Pre-release versions

3. **feature/\***: Feature development
   - Branch from: `develop`
   - PR to: `develop`
   - Naming: `feature/ISSUE-NAME` or `feature/short-description`

4. **bugfix/\***: Bug fixes
   - Branch from: `develop`
   - PR to: `develop`
   - Naming: `bugfix/ISSUE-NAME`

5. **hotfix/\***: Critical production fixes
   - Branch from: `main`
   - PR to: both `main` and `develop`
   - Naming: `hotfix/CRITICAL-FIX`

6. **release/v\*.\*.\***: Release preparation
   - Branch from: `develop`
   - PR to: `main`
   - Naming: `release/v1.2.3`

## Publishing Flow

### Standard Release (Automatic)
1. Create feature branch
2. Make changes and commit
3. Create PR to `develop`
4. PR validation runs automatically
5. Review and merge to `develop`
6. Create version bump request (manual or automated)
7. Bump version and create release PR to `main`
8. Build & release validation runs
9. Merge to `main`
10. Publish workflow triggers automatically
11. Package published to npm

### Workflow Dispatch (Manual)
1. Go to Actions tab
2. Select "Version Bump & Release Branch"
3. Select version type (patch/minor/major)
4. Click "Run workflow"
5. Follow PR merge flow from step 7 above

## Version Management

### Semantic Versioning
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Version Bump Types
- `patch`: 1.2.3 → 1.2.4 (bug fixes)
- `minor`: 1.2.3 → 1.3.0 (new features)
- `major`: 1.2.3 → 2.0.0 (breaking changes)

### Pre-release Versions
- Format: `v1.2.3-alpha.1`, `v1.2.3-beta.1`, `v1.2.3-rc.1`
- Used for testing before release

## NPM Publishing

### Package Configuration
- **Name**: context-iso
- **Access**: public
- **Registry**: https://registry.npmjs.org
- **Bin**: `context-iso` → `./dist/index.js`

### Published Artifacts
- `dist/index.js`: Compiled JavaScript
- `dist/index.d.ts`: TypeScript declarations
- `dist/index.js.map`: Source maps
- `package.json`: Package metadata
- README and documentation

## Monitoring and Notifications

### Build Status
- PR comments with validation results
- GitHub Actions workflow status
- Artifact uploads for manual inspection

### Notifications
- **Slack**: Published releases (if webhook configured)
- **Email**: Manual setup required
- **GitHub**: Release notifications via watch

### Monitoring
- Security audits: npm audit, Snyk
- Test coverage: Codecov
- Bundle size: Checked against 5MB limit
- Dependency health: npm outdated reports

## Common Tasks

### Creating a Feature
```bash
# Create and switch to feature branch
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature

# Create PR in GitHub (develop ← feature/my-feature)
```

### Creating a Hotfix
```bash
# Create and switch to hotfix branch
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Make changes and commit
git add .
git commit -m "fix: critical bug"
git push origin hotfix/critical-bug

# Create PR in GitHub (main ← hotfix/critical-bug)
```

### Publishing a Release
1. Ensure develop is up to date
2. Go to Actions → "Version Bump & Release Branch"
3. Select version type and run
4. Review and merge the PR created
5. Build & release validation runs
6. Merge to main
7. Publish workflow triggers automatically

### Troubleshooting

**Build Failed**
- Check PR validation comments
- Review GitHub Actions logs
- Run tests locally: `npm test`

**Publish Failed**
- Verify NPM_TOKEN is set and valid
- Check package.json is valid
- Review publish logs in Actions

**Security Audit Failed**
- Review npm audit results
- Update vulnerable dependencies
- Ignore if approved by security team

## Best Practices

1. **Commits**: Write clear, descriptive messages following Conventional Commits
2. **Tests**: Ensure all tests pass before requesting review
3. **Documentation**: Update README and docs with new features
4. **Linting**: Fix all linting issues before merge
5. **Security**: Address security vulnerabilities promptly
6. **Versioning**: Follow semantic versioning strictly
7. **Reviews**: Always have at least one approval before merge

## Additional Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitFlow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
