# CI/CD Pipeline Quick Reference

## 🚀 Quick Start

### Setup (First Time Only)
1. Add `NPM_TOKEN` secret to GitHub repository
2. Protect `main` and `develop` branches
3. Enable workflow permissions

See [SETUP.md](./.github/SETUP.md) for detailed instructions.

## 📋 Available Workflows

| Workflow | Trigger | Purpose | Duration |
|----------|---------|---------|----------|
| **PR Validation** | PR to develop/feature/bugfix/hotfix | Test & lint | 3-5 min |
| **Build Release** | PR to main/develop | Prepare artifacts | 4-6 min |
| **Pre-Release** | Push to develop | Publish to npm (beta/alpha/rc) | 3-4 min |
| **Publish Release** | Merge to main or tag | Publish to npm (latest) | 3-4 min |
| **Security Audit** | Daily + PR/push | Check vulnerabilities | 2-3 min |
| **Version Bump** | Manual dispatch | Create release branch | 2 min |

## 🔄 Development Workflow

### Create Feature
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# Make changes...
git commit -m "feat: description"
git push origin feature/my-feature
# Create PR: develop <- feature/my-feature
# ✅ PR validation runs automatically
# ✅ After merge: pre-release published to npm (beta tag)
```

### Test Pre-Release
```bash
# After feature is merged to develop
npm install context-iso@beta
# Test the new feature
# Report feedback or approve for release
```

### Create Production Release
```bash
# When ready to release to production
git checkout main
git pull origin main
git checkout -b release/v1.2.3
# Update package.json version
git commit -am "chore: release v1.2.3"
git push origin release/v1.2.3
# Create PR: main <- release/v1.2.3
# ✅ Build & release validation runs
# ✅ After merge: published to npm (latest tag)
```

### Create Fix
```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/my-fix
# Make changes...
git commit -m "fix: description"
git push origin bugfix/my-fix
# Create PR: develop <- bugfix/my-fix
```

### Create Hotfix (Critical)
```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix
# Make changes...
git commit -m "fix: critical issue"
git push origin hotfix/critical-fix
# Create PR: main <- hotfix/critical-fix
# After merge to main: publish immediately
# Then merge back to develop to keep in sync
```

## 📦 Publishing

### Automatic Pre-Release (develop branch)
```
Commits to develop
    ↓
Pre-Release workflow triggers automatically
    ├─ Full test suite runs
    ├─ Security audit
    ├─ npm publish with 'beta' tag
    └─ Users can install: npm install context-iso@beta
```

### Manual Pre-Release with Custom Tag
```bash
# Go to Actions → "Pre-Release to Develop"
# Select pre-release tag: alpha, beta, or rc
# Click "Run workflow"
# Package published with selected tag

npm install context-iso@alpha  # Alpha preview
npm install context-iso@beta   # Beta testing
npm install context-iso@rc     # Release candidate
```

### Automated Production Release
1. Go to **Actions** tab
2. Select **"Version Bump & Release Branch"**
3. Click **"Run workflow"**
4. Select version type: `patch`, `minor`, or `major`
5. Click **"Run workflow"**
6. Review and merge the PR
7. Publishing happens automatically

### Manual Production Release
1. Update `package.json` version
2. Update `CHANGELOG.md`
3. Create PR to `main`
4. Merge PR
5. Publishing happens automatically

## ✅ Checks Required Before Merge

- [ ] PR validation passed (all checks green)
- [ ] Code review approved
- [ ] Tests passing locally
- [ ] No security vulnerabilities
- [ ] Documentation updated

## 🔑 Secrets Configuration

### Required
- `NPM_TOKEN` - Get from https://www.npmjs.com/settings/~/tokens

### Optional
- `SLACK_WEBHOOK_URL` - For Slack notifications
- `SNYK_TOKEN` - For security scanning

See [SETUP.md](./.github/SETUP.md) for how to add secrets.

## 📊 Monitor Workflows

1. **GitHub Actions Dashboard**: Actions tab shows all runs
2. **PR Comments**: Workflows comment with results
3. **Artifacts**: Download test/build artifacts
4. **Release Page**: View published versions

## 🐛 Troubleshooting

### Workflow Won't Start
```bash
# Check if workflow file is valid
git log --oneline .github/workflows/
```

### Tests Fail
```bash
# Run tests locally
npm run test:all
npm run lint
npm run build
```

### npm Publish Fails
- Verify `NPM_TOKEN` is set and valid
- Check package name isn't taken
- Verify version bumped in package.json

### Need Help?
- See [GITFLOW-CICD.md](./.github/GITFLOW-CICD.md) for full documentation
- Review workflow logs in Actions tab
- Check GitHub Actions troubleshooting

## 🎯 Branch Strategy

```
main (production)
  ↑ ← release PRs only
  |
develop (staging)
  ↑ ← feature/bugfix PRs
  |
feature/* branches
```

**Rules**:
- `feature/` → PR to `develop`
- `bugfix/` → PR to `develop`
- `hotfix/` → PR to `main` then merge back to `develop`
- `release/v*` → PR to `main`

## 📝 Commit Messages

Use conventional commits:

```
feat: add new feature
fix: fix bug
docs: update documentation
chore: maintenance
test: add tests
ci: update CI config
```

## 🚨 Status Badges

Add to README:

```markdown
[![Build Status](https://github.com/your-org/your-repo/actions/workflows/build-release.yml/badge.svg)](https://github.com/your-org/your-repo/actions)
[![npm version](https://badge.fury.io/js/context-iso.svg)](https://www.npmjs.com/package/context-iso)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

## 📚 Learn More

- [Full GitFlow Documentation](./.github/GITFLOW-CICD.md)
- [Setup Instructions](./.github/SETUP.md)
- [GitHub Actions](https://docs.github.com/en/actions)
- [npm Publishing](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
