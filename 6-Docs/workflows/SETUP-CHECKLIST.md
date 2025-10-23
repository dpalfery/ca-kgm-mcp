# GitFlow CI/CD Setup Checklist

Use this checklist to complete your pipeline setup.

## 🔧 Phase 1: Local Setup

- [ ] Run local setup script:
  - **Windows**: `.\setup-local.bat`
  - **Unix/Mac**: `bash setup-local.sh`
- [ ] Verify dependencies installed:
  - [ ] Node.js 18+ installed
  - [ ] npm installed
  - [ ] git installed
- [ ] All tests pass locally: `npm test`
- [ ] Build successful locally: `npm run build`

## 🔑 Phase 2: GitHub Secrets

- [ ] Generate npm token at https://www.npmjs.com/settings/~/tokens
  - [ ] Token type: "Automation"
  - [ ] Token copied to clipboard
- [ ] Add NPM_TOKEN to GitHub:
  - [ ] Go to repository Settings
  - [ ] Navigate to Secrets and variables → Actions
  - [ ] Create new secret: `NPM_TOKEN`
  - [ ] Paste npm token value
  - [ ] Click "Add secret"
- [ ] (Optional) Add SLACK_WEBHOOK_URL for notifications
  - [ ] Create Slack webhook at https://api.slack.com/apps
  - [ ] Copy webhook URL
  - [ ] Add secret to GitHub: `SLACK_WEBHOOK_URL`
- [ ] (Optional) Add SNYK_TOKEN for security scanning
  - [ ] Get token from https://app.snyk.io/account/settings/api
  - [ ] Add secret to GitHub: `SNYK_TOKEN`

## 🛡️ Phase 3: Branch Protection

### Protect main branch

- [ ] Go to Settings → Branches
- [ ] Click "Add rule"
- [ ] Branch name pattern: `main`
- [ ] Enable:
  - [ ] Require a pull request before merging
  - [ ] Require approvals (minimum: 1)
  - [ ] Require status checks to pass
    - [ ] Select: "build-and-test"
    - [ ] Select: "validate-release"
  - [ ] Require branches to be up to date
  - [ ] Include administrators
- [ ] Click "Create"

### Protect develop branch

- [ ] Go to Settings → Branches
- [ ] Click "Add rule"
- [ ] Branch name pattern: `develop`
- [ ] Enable:
  - [ ] Require a pull request before merging
  - [ ] Require approvals (minimum: 1)
  - [ ] Require status checks to pass
    - [ ] Select: "validate"
  - [ ] Require branches to be up to date
- [ ] Click "Create"

## ⚙️ Phase 4: GitHub Configuration

### Workflow Permissions

- [ ] Go to Settings → Actions → General
- [ ] Under "Workflow permissions":
  - [ ] Select "Read and write permissions"
  - [ ] ✓ "Allow GitHub Actions to create and approve pull requests"
- [ ] Click "Save"

### (Optional) CODEOWNERS

- [ ] Create `.github/CODEOWNERS` file
- [ ] Add repository maintainers
- [ ] Commit and push

### (Optional) Branch Naming

- [ ] Go to Settings → Repository rules (Beta)
- [ ] Set up branch naming rules:
  - [ ] `feature/*` for features
  - [ ] `bugfix/*` for bug fixes
  - [ ] `hotfix/*` for hotfixes

## ✅ Phase 5: Verify Workflows

### Check Files Exist

- [ ] `.github/workflows/pr-validation.yml` exists
- [ ] `.github/workflows/build-release.yml` exists
- [ ] `.github/workflows/publish-release.yml` exists
- [ ] `.github/workflows/security-audit.yml` exists
- [ ] `.github/workflows/version-bump.yml` exists

### Enable Workflows

- [ ] Go to repository → Actions tab
- [ ] See all 5 workflows listed
- [ ] Click on each workflow
- [ ] If disabled, click "Enable workflow"

### Test PR Validation

- [ ] Create test branch: `git checkout -b test/ci-setup`
- [ ] Push to GitHub: `git push origin test/ci-setup`
- [ ] Create PR to `develop`
- [ ] Wait for "PR Validation" workflow to run
- [ ] Verify it passes with green checkmarks
- [ ] Close the test PR

## 📦 Phase 6: First Release

### Prepare Release

- [ ] Verify `package.json` version is valid (e.g., "1.0.0")
- [ ] Verify `README.md` is up to date
- [ ] Verify `CHANGELOG.md` exists and is updated
- [ ] All tests pass: `npm test`
- [ ] Build successful: `npm run build`

### Create Release Branch

- [ ] Go to Actions tab
- [ ] Click "Version Bump & Release Branch"
- [ ] Click "Run workflow"
- [ ] Select version type: "patch" (for first test)
- [ ] Click "Run workflow"
- [ ] Wait for release PR to be created

### Review Release

- [ ] Go to Pull Requests
- [ ] Find the release PR (e.g., "chore: release v1.0.1")
- [ ] Review changes:
  - [ ] package.json version bumped
  - [ ] CHANGELOG.md updated
- [ ] Get approval if needed
- [ ] Merge PR to main

### Monitor Publishing

- [ ] Go to Actions tab
- [ ] Watch "Publish Release" workflow run
- [ ] Verify it completes successfully
- [ ] Check for green checkmarks

### Verify Published

- [ ] Visit https://www.npmjs.com/package/context-iso
- [ ] Verify new version is published
- [ ] Go to repository Releases page
- [ ] Verify GitHub release was created
- [ ] Verify release notes included

## 📝 Phase 7: Documentation

- [ ] Read `.github/SETUP.md` - GitHub configuration guide
- [ ] Read `.github/GITFLOW-CICD.md` - Complete documentation
- [ ] Read `.github/CI-CD-QUICK-REFERENCE.md` - Quick reference
- [ ] Share setup docs with team members
- [ ] Update team on new publishing process

## 🚀 Phase 8: Team Onboarding

- [ ] Invite team members to repository
- [ ] Share access to GitHub secrets (if needed)
- [ ] Point team to:
  - [ ] `.github/SETUP.md` - Setup instructions
  - [ ] `.github/CI-CD-QUICK-REFERENCE.md` - Quick reference
  - [ ] `.github/GITFLOW-CICD.md` - Full documentation
- [ ] Create team guidelines document
- [ ] Explain branching strategy
- [ ] Demo feature development flow
- [ ] Demo publishing flow

## 🎯 Phase 9: Final Verification

- [ ] Create a feature branch and PR:
  - [ ] `git checkout -b feature/test-feature`
  - [ ] Make a test change
  - [ ] Commit: `git commit -m "feat: test feature"`
  - [ ] Push: `git push origin feature/test-feature`
  - [ ] Create PR to `develop`
  - [ ] Verify validation passes
  - [ ] Merge PR

- [ ] Verify security audit workflow:
  - [ ] Check Actions → "Security Audit"
  - [ ] Verify it runs successfully
  - [ ] Review any vulnerabilities found

- [ ] Test manual workflows:
  - [ ] Try "Version Bump & Release Branch" (with patch bump)
  - [ ] Review created PR
  - [ ] Close PR without merging (to save version)

## 📊 Phase 10: Monitoring Setup

- [ ] Configure GitHub notifications:
  - [ ] Go to Settings → Notifications
  - [ ] Enable workflow notifications
  - [ ] Choose notification method

- [ ] (Optional) Set up Slack notifications:
  - [ ] Verify SLACK_WEBHOOK_URL secret is set
  - [ ] Run a workflow and check for Slack message
  - [ ] Adjust notification settings as needed

- [ ] Configure email notifications:
  - [ ] GitHub settings for email alerts
  - [ ] Test with a workflow run

## ✨ Completion

When all phases are complete:

- [ ] Team is trained on new workflow
- [ ] First package version published to npm
- [ ] All workflows are functioning
- [ ] Secrets are properly configured
- [ ] Branch protection is active
- [ ] Documentation is accessible
- [ ] Monitoring is set up

**Setup Completed**: _______________  
**Completed By**: _______________  
**Date**: _______________  

---

## 📞 Need Help?

- Check [GITFLOW-CICD.md](./.github/GITFLOW-CICD.md)
- Review [SETUP.md](./.github/SETUP.md)
- Check Actions logs for error details
- Create issue on repository

## 🎉 You're Ready!

Your GitFlow CI/CD pipeline is now complete and ready for use.

For daily development, use the [CI-CD-QUICK-REFERENCE.md](./.github/CI-CD-QUICK-REFERENCE.md).
