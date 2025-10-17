# GitFlow CI/CD Pipeline - Complete Setup

## 📋 Summary

Your `context-iso` npm package now has a complete, production-ready GitFlow CI/CD pipeline that:

✅ Validates PRs with linting, tests, and builds
✅ Builds and tests release candidates  
✅ Automatically publishes to npm registry
✅ Creates GitHub releases with changelogs
✅ Performs security audits and vulnerability checks
✅ Manages versioning and release branches
✅ Provides notifications (Slack, GitHub, Email)

## 🏗️ What Was Created

### Workflow Files (`.github/workflows/`)

1. **pr-validation.yml**
   - Triggers on PR to develop/feature/hotfix
   - Runs linting, tests, builds on Node 18 & 20
   - Checks bundle size
   - Generates coverage reports
   - Duration: 3-5 minutes

2. **build-release.yml**
   - Triggers on PR to main
   - Full build and validation
   - Generates SBOM
   - Creates release artifacts
   - Duration: 4-6 minutes

3. **publish-release.yml**
   - Triggers on merge to main
   - Publishes to npm
   - Creates GitHub releases
   - Sends notifications
   - Duration: 3-4 minutes

4. **security-audit.yml**
   - Daily scheduled runs
   - npm audit checks
   - Snyk scanning
   - Dependency updates check

5. **version-bump.yml**
   - Manual trigger
   - Bumps version (patch/minor/major)
   - Creates release PR
   - Updates changelog

### Configuration Files

- `.npmrc` - npm configuration
- `.releaserc.json` - Semantic release config
- `setup-local.sh` - Unix setup script
- `setup-local.bat` - Windows setup script

### Documentation

- `.github/SETUP.md` - Step-by-step GitHub setup
- `.github/GITFLOW-CICD.md` - Complete pipeline documentation
- `.github/CI-CD-QUICK-REFERENCE.md` - Quick reference guide
- `.github/pull_request_template.md` - PR template
- `.github/ISSUE_TEMPLATE/bug_report.md` - Bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` - Feature request template

## 🚀 Getting Started

### Step 1: Add NPM Token to GitHub

1. Generate token at https://www.npmjs.com/settings/~/tokens
   - Type: Automation
   - Scopes: Read and Publish

2. Add to GitHub:
   - Repository Settings → Secrets and variables → Actions
   - New secret: `NPM_TOKEN` = your token
   - Click "Add secret"

### Step 2: Protect Branches

1. Settings → Branches
2. Add rule for `main`:
   - ✓ Require PR before merging
   - ✓ Require 1 approval
   - ✓ Require status checks (build-and-test, validate-release)
   - ✓ Require branches up to date

3. Add rule for `develop`:
   - ✓ Require PR before merging
   - ✓ Require 1 approval
   - ✓ Require status checks (validate)
   - ✓ Require branches up to date

### Step 3: Enable Workflow Permissions

1. Settings → Actions → General
2. Workflow permissions: "Read and write permissions"
3. ✓ Allow GitHub Actions to create and approve PRs
4. Click "Save"

### Step 4: Test Setup

1. Run setup script (Windows):
   ```powershell
   .\setup-local.bat
   ```

2. Create a test branch:
   ```bash
   git checkout -b test/ci-setup
   git push origin test/ci-setup
   ```

3. Create PR to `develop` and verify validation passes

See [SETUP.md](./.github/SETUP.md) for detailed instructions.

## 📦 Publishing Your Package

### Method 1: Automated (Recommended)

1. Go to **Actions** tab
2. Click **"Version Bump & Release Branch"**
3. Click **"Run workflow"**
4. Select version type:
   - `patch` - bug fixes (1.2.3 → 1.2.4)
   - `minor` - new features (1.2.3 → 1.3.0)
   - `major` - breaking changes (1.2.3 → 2.0.0)
5. Click **"Run workflow"**
6. Wait for release PR to be created
7. Review the PR
8. Merge to main
9. Build & release validation runs
10. Merge to main
11. Publish workflow triggers automatically
12. Check https://www.npmjs.com/package/context-iso

### Method 2: Manual

1. Update `package.json` version
2. Update `CHANGELOG.md`
3. Commit changes
4. Create PR to `main`
5. Merge PR
6. Publishing happens automatically

## 🔄 Development Workflow

### Create Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/short-description

# Make changes...
git add .
git commit -m "feat: description of feature"
git push origin feature/short-description

# Create PR in GitHub: develop <- feature/short-description
```

### Create Hotfix Branch

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# Fix the issue...
git add .
git commit -m "fix: critical issue"
git push origin hotfix/critical-fix

# Create PR in GitHub: main <- hotfix/critical-fix
```

### Create Bugfix Branch

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/issue-description

# Fix the bug...
git add .
git commit -m "fix: issue description"
git push origin bugfix/issue-description

# Create PR in GitHub: develop <- bugfix/issue-description
```

## 📊 Monitoring

### GitHub Actions Dashboard
- Visit: Repository → Actions tab
- See all workflow runs with status
- Click on run for detailed logs

### Releases Page
- Visit: Repository → Releases
- See all published versions
- Download specific versions

### npm Package Page
- Visit: https://www.npmjs.com/package/context-iso
- See download stats
- View version history

## 🔍 What Happens in Each Workflow

### PR Validation (feature → develop)
```
1. Lint code: npm run lint
2. Run unit tests on Node 18, 20
3. Build TypeScript: npm run build
4. Check bundle size (max 5MB)
5. Generate coverage report
6. Comment on PR with results
```

### Build Release (release PR → main)
```
1. Install dependencies
2. Lint code
3. Run all tests
4. Build distribution
5. Verify TypeScript declarations
6. Security audit
7. Generate SBOM
8. Upload artifacts
9. Comment on PR with readiness
```

### Publish Release (main push)
```
1. Run final tests
2. Build distribution
3. Generate changelog
4. Publish to npm
5. Create GitHub release
6. Update release documentation
7. Upload artifacts
8. Send notifications
```

## 🔐 Security

### Built-in Security

- **npm audit**: Checks for known vulnerabilities
- **Snyk**: Advanced security scanning (optional)
- **Bundle size check**: Prevents large deployments
- **Dependency tracking**: SBOM generated

### Secrets Management

- NPM_TOKEN is kept secret (never logged)
- Tokens expire and can be rotated
- No sensitive data in logs or artifacts

## 📈 Best Practices

### Commits
- Use conventional commits (feat:, fix:, docs:, etc.)
- Keep commits atomic and meaningful
- Write clear commit messages

### Versioning
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- MAJOR: breaking changes
- MINOR: new features (backward compatible)
- PATCH: bug fixes

### Branching
- Feature branches: `feature/feature-name`
- Bug fixes: `bugfix/bug-description`
- Hotfixes: `hotfix/critical-fix`
- Release branches: `release/v1.2.3`

### Testing
- All tests must pass before merge
- Target 80%+ code coverage
- Test both happy paths and errors

### Documentation
- Update README with changes
- Document new features
- Update CHANGELOG for releases

## 📝 File Structure

```
.github/
├── workflows/
│   ├── pr-validation.yml       # Feature branch validation
│   ├── build-release.yml       # Release preparation
│   ├── publish-release.yml     # Publishing to npm
│   ├── security-audit.yml      # Security scanning
│   └── version-bump.yml        # Version management
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
├── pull_request_template.md
├── SETUP.md                    # GitHub setup guide
├── GITFLOW-CICD.md            # Complete documentation
└── CI-CD-QUICK-REFERENCE.md   # Quick reference
.npmrc                          # npm configuration
.releaserc.json                 # Release configuration
setup-local.sh                  # Unix setup script
setup-local.bat                 # Windows setup script
```

## 🆘 Troubleshooting

### Workflow Won't Start
- Check `.github/workflows/` files exist
- Verify YAML syntax is correct
- Go to Actions → enable workflow if disabled

### Tests Fail
```bash
# Run locally
npm run lint
npm run test:all
npm run build
```

### npm Publish Fails
- Verify NPM_TOKEN is set
- Check package.json version is valid
- Ensure package name isn't taken
- Review publish logs

### PR Validation Fails
- Run tests locally: `npm run test:unit`
- Run linting: `npm run lint`
- Build locally: `npm run build`

## 🔗 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitFlow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)

## ✨ Next Steps

1. ✅ Run `setup-local.bat` or `setup-local.sh`
2. ✅ Complete [SETUP.md](./.github/SETUP.md)
3. ✅ Add NPM_TOKEN secret to GitHub
4. ✅ Protect main and develop branches
5. ✅ Test with a feature branch
6. ✅ Create first release
7. ✅ Publish to npm
8. ✅ Share with team

## 📞 Support

For questions or issues:
1. Check [GITFLOW-CICD.md](./.github/GITFLOW-CICD.md)
2. Review workflow logs in Actions tab
3. Check GitHub Actions troubleshooting
4. Create issue on repository

---

**Pipeline Created**: October 17, 2025  
**Package**: context-iso  
**Registry**: https://www.npmjs.com/package/context-iso
