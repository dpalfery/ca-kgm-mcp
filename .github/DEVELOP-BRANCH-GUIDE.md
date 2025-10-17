# Develop Branch & Pre-Release Testing Flow

## 🌳 Updated Branch Strategy

Your pipeline now includes a **develop branch** for pre-release testing before publishing to production:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UPDATED GITFLOW BRANCHES                     │
└─────────────────────────────────────────────────────────────────┘

    main (Production - Stable Releases)
    │   Tags: v1.2.3, v1.3.0, etc.
    │   Status: 🟢 Live releases only
    │   Publishing: npm (latest tag)
    │
    └─◄─ release/v*.*.* ◄─ Release PRs
        │   Temporary branches
        │   PR → main triggers "Build & Prepare Release"
        │   Gated by build + test + security checks
        │
        ▼
    
    develop (Staging - Pre-release Testing)
    │   Status: 🟡 Pre-release versions
    │   Publishing: npm (beta/alpha/rc tags)
    │   Triggers: Automatic on push
    │
    └─◄─ feature/* ◄─ Feature development
    │   └─◄─ bugfix/* ◄─ Bug fixes
    │   └─◄─ hotfix/* ◄─ Critical fixes (also PR to main)
    │
    │   PR → develop triggers "PR Validation"
    │   Tests on Node 18 & 20
    │
    ▼

    Feature Development Branches (deleted after merge)
    
    feature/feature-name       → PR to develop
    bugfix/bug-name           → PR to develop
    hotfix/critical-issue     → PR to main (then merge back to develop)
```

## 🔄 Complete Development Workflow

### Phase 1: Feature Development
```
1. Create branch from develop
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature

2. Make changes and commit
   git commit -m "feat: add new feature"

3. Push and create PR
   git push origin feature/my-feature
   # Create PR: develop ← feature/my-feature

4. PR Validation runs (Node 18 & 20)
   ✓ Linting
   ✓ Unit tests
   ✓ Build
   ✓ Coverage report

5. Get review and approval

6. Merge to develop
```

### Phase 2: Pre-Release Testing (NEW)
```
When develop branch receives commits:

1. Pre-Release Workflow triggers automatically
   ├─ Runs full test suite
   ├─ Builds package
   ├─ Security audit
   ├─ Generates SBOM
   └─ Publishes to npm with tag (beta, alpha, or rc)

2. Users can test pre-release
   npm install context-iso@beta
   # Test new features
   npm install context-iso@alpha
   npm install context-iso@rc

3. Report issues or verify features

4. Fix issues → merge to develop → new pre-release
```

### Phase 3: Release to Production
```
When ready to release:

1. Create release PR to main
   git checkout main
   git pull origin main
   git checkout -b release/v1.2.3
   # Update version in package.json
   # Update CHANGELOG.md
   git push origin release/v1.2.3
   # Create PR: main ← release/v1.2.3

2. Build & Prepare Release runs
   ✓ Full test suite
   ✓ TypeScript check
   ✓ Security audit
   ✓ SBOM generation
   ✓ Type definitions

3. Get approval and merge to main

4. Publish Release workflow triggers
   ✓ npm publish to latest tag
   ✓ GitHub release created
   ✓ Notifications sent
```

## 📦 New Workflow: Pre-Release (`prerelease.yml`)

**Triggers**: 
- Automatically on every `develop` push
- Manual trigger with tag selection (alpha/beta/rc)

**What it does**:
1. Runs full test suite
2. Builds distribution
3. Security audit & SBOM generation
4. Publishes to npm with pre-release tag
5. Reverts version changes (keeps development version)
6. Sends notifications (Slack)

**Duration**: 3-4 minutes

**Example**: 
```bash
# Feature merged to develop
→ Pre-release automatically published as v1.2.0-beta.1234567890

# Users can test:
npm install context-iso@beta  # Latest pre-release
npm install context-iso@rc    # Release candidate
npm install context-iso@alpha # Alpha version
```

## 🎯 Key Differences

### Before (No Develop Branch)
```
feature → develop ✓ → main → npm (production)
```

### After (With Develop Branch)
```
feature → develop → npm (pre-release: beta)
                ↓
            Testing & Feedback
                ↓
            release → main → npm (production: latest)
```

## 📊 Workflow Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPLETE WORKFLOW MAP                       │
└─────────────────────────────────────────────────────────────────┘

PR to develop/feature/bugfix/hotfix
    ↓
    ├─► PR VALIDATION (pr-validation.yml)
    │   ├─ Node 18.x tests
    │   ├─ Node 20.x tests
    │   ├─ Linting
    │   ├─ Build
    │   └─ Coverage
    │   Duration: 3-5 min
    │
    ├─► Get review & approval
    │
    └─► Merge to develop
         ↓
         ├─► PRE-RELEASE (prerelease.yml) ⭐ NEW
         │   ├─ Full test suite
         │   ├─ Security audit
         │   ├─ SBOM generation
         │   ├─ npm publish (beta/alpha/rc tag)
         │   ├─ Update artifacts
         │   └─ Slack notification
         │   Duration: 3-4 min
         │
         ├─► Users test pre-release
         │   npm install context-iso@beta
         │
         ├─► Report feedback
         │
         └─► Create release PR to main (when ready)
              ↓
              ├─► BUILD & RELEASE (build-release.yml)
              │   ├─ Full tests
              │   ├─ TypeScript check
              │   ├─ Security audit
              │   ├─ SBOM generation
              │   └─ Artifact upload
              │   Duration: 4-6 min
              │
              ├─► Get approval
              │
              └─► Merge to main
                   ↓
                   └─► PUBLISH RELEASE (publish-release.yml)
                       ├─ Tests
                       ├─ npm publish (latest tag)
                       ├─ GitHub release
                       ├─ Changelog
                       └─ Notifications
                       Duration: 3-4 min
```

## 🚀 Usage Examples

### Example 1: Test New Feature
```bash
# Developer
git checkout develop
git checkout -b feature/awesome-feature
# Make changes
git commit -m "feat: add awesome feature"
git push origin feature/awesome-feature
# Create PR to develop

# CI automatically:
# - Validates PR
# - Gets approved
# - Merges to develop
# - Publishes beta pre-release

# QA/Users can now test
npm install context-iso@beta
npm test
# Report feedback

# When approved, create release PR
git checkout main
git checkout -b release/v1.2.3
npm version minor --no-git-tag-version
git commit -am "chore: release v1.2.3"
git push origin release/v1.2.3
# Create PR to main

# After approval and merge:
# Package automatically published as latest
npm install context-iso
```

### Example 2: Critical Hotfix
```bash
# Hotfix for production bug
git checkout main
git checkout -b hotfix/critical-bug
# Fix the issue
git commit -m "fix: critical bug"
git push origin hotfix/critical-bug
# Create PR to main

# After merge to main:
# Automatically published to production
# Also merge back to develop to keep in sync
git checkout develop
git pull origin hotfix/critical-bug
git commit -m "merge: hotfix back to develop"
git push origin develop
```

## ✅ Branch Protection Rules

### develop Branch
- ✓ Require pull request before merging
- ✓ Require 1 approval
- ✓ Require status checks (PR Validation)
- ✓ Require branches up to date

### main Branch
- ✓ Require pull request before merging
- ✓ Require 1 approval
- ✓ Require status checks (Build & Release)
- ✓ Require branches up to date
- ✓ Include administrators

## 📋 Pre-Release Tags

Your pipeline now supports three pre-release tags:

| Tag | Use Case | Example |
|-----|----------|---------|
| `alpha` | Early development preview | `npm install context-iso@alpha` |
| `beta` | Feature complete, testing | `npm install context-iso@beta` |
| `rc` | Release candidate, production ready | `npm install context-iso@rc` |
| `latest` | Stable production release | `npm install context-iso` |

**Automatic**: Pre-releases from develop use `beta` tag by default
**Manual**: Use `prerelease.yml` workflow dispatch to choose tag

## 🔄 Merging Hotfixes

Hotfixes from `main` should be merged back to `develop`:

```bash
# After hotfix PR is merged to main
git checkout develop
git pull origin develop
git merge main  # or: git pull origin main
git push origin develop
```

This keeps `develop` synchronized with production fixes.

## 📈 Version Numbering

- **Development**: 1.2.0-beta.1234567890 (timestamp-based)
- **Pre-release**: 1.2.0-beta.1, 1.2.0-rc.1 (manual)
- **Production**: 1.2.0 (semantic versioning)

## 🎯 Benefits

✅ **Test before release** - Pre-release versions let users test new features
✅ **Early feedback** - Catch issues before production
✅ **Staging environment** - Develop branch serves as staging
✅ **Smooth releases** - Production releases are well-tested
✅ **Parallel workflows** - Development continues while testing pre-release
✅ **Easy rollback** - Can release hotfixes immediately from main

## 📝 Daily Workflow Checklist

**Developer**:
- [ ] Create branch from develop
- [ ] Make changes on feature branch
- [ ] Push and create PR to develop
- [ ] Wait for validation
- [ ] Get approved
- [ ] Merge to develop
- [ ] Automatic pre-release published ✅

**QA/Tester**:
- [ ] Install pre-release: `npm install context-iso@beta`
- [ ] Test new features
- [ ] Report issues or approve
- [ ] Feedback to developers

**Release Manager**:
- [ ] Create release PR to main
- [ ] Wait for build validation
- [ ] Get approval
- [ ] Merge to main
- [ ] Automatic production release ✅
- [ ] Merge main back to develop (if hotfix)

## 🔗 Related Documentation

- `.github/SETUP.md` - GitHub configuration
- `.github/CI-CD-QUICK-REFERENCE.md` - Daily reference
- `.github/GITFLOW-CICD.md` - Complete guide
- `PIPELINE-VISUAL-GUIDE.md` - Visual diagrams
