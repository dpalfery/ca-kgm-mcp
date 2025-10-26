# GitHub Repository Setup for GitFlow CI/CD

This guide walks you through setting up your GitHub repository to use the GitFlow CI/CD pipeline.

## Prerequisites

- Repository owner access
- npm account (https://www.npmjs.com)
- (Optional) Slack workspace admin for notifications
- (Optional) Snyk account for advanced security scanning

## Step-by-Step Setup

### 1. Configure GitHub Secrets

#### Required: NPM Token

1. **Generate npm token**:
   - Go to https://www.npmjs.com/settings/~/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the token

2. **Add to GitHub**:
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

#### Optional: Slack Webhook

1. **Create Slack app**:
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - App name: "GitHub CI/CD"
   - Select your workspace
   - Navigate to "Incoming Webhooks"
   - Enable Incoming Webhooks
   - Click "Add New Webhook to Workspace"
   - Select channel for notifications
   - Copy the Webhook URL

2. **Add to GitHub**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SLACK_WEBHOOK_URL`
   - Value: Paste your webhook URL
   - Click "Add secret"

#### Optional: Snyk Token

1. **Get Snyk token**:
   - Go to https://app.snyk.io/account/settings/api
   - Copy your API token

2. **Add to GitHub**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SNYK_TOKEN`
   - Value: Paste your Snyk token
   - Click "Add secret"

### 2. Configure Branch Protection Rules

#### Protect main branch

1. Go to Settings → Branches
2. Click "Add rule"
3. Branch name pattern: `main`
4. Enable:
   - ✓ Require a pull request before merging
   - ✓ Require approvals (minimum 1)
   - ✓ Require status checks to pass
     - Select: "build-and-test", "validate-release"
   - ✓ Require branches to be up to date
   - ✓ Include administrators
5. Click "Create"

#### Protect develop branch

1. Go to Settings → Branches
2. Click "Add rule"
3. Branch name pattern: `develop`
4. Enable:
   - ✓ Require a pull request before merging
   - ✓ Require approvals (minimum 1)
   - ✓ Require status checks to pass
     - Select: "validate"
   - ✓ Require branches to be up to date
5. Click "Create"

### 3. Configure CODEOWNERS (Optional)

Create `.github/CODEOWNERS` file:

```
# Repository owners for all changes
*                    @your-github-username

# Specific owners for certain paths
src/                 @your-github-username
.github/workflows/   @your-github-username
package.json         @your-github-username
```

### 4. Configure Workflow Permissions

1. Go to Settings → Actions → General
2. Workflow permissions:
   - Select "Read and write permissions"
   - ✓ Allow GitHub Actions to create and approve pull requests
3. Click "Save"

### 5. Verify Workflow Files

Ensure all workflow files are present in `.github/workflows/`:

- `pr-validation.yml` - Feature branch validation
- `build-release.yml` - Release build and test
- `publish-release.yml` - Publishing to npm
- `security-audit.yml` - Security scanning
- `version-bump.yml` - Version management

Check workflow status: Go to Actions tab → See all workflows

### 6. Test the Setup

#### Test PR Validation

1. Create a test branch:
   ```bash
   git checkout -b test/ci-setup
   git push origin test/ci-setup
   ```

2. Create a PR to `develop`

3. Watch the "PR Validation" workflow run

4. Verify it completes successfully

#### Test Build Release

1. Create a test PR to `main`

2. Watch the "Build & Release" workflow run

3. Verify it produces artifacts

### 7. Configure Repository Settings (Optional)

Go to Settings → General:

- ✓ Enable "Discussions" for announcements
- ✓ Enable "Projects" for planning
- ✓ Set "Default branch" to `develop`

Go to Settings → Code security and analysis:

- ✓ Enable "Dependabot alerts"
- ✓ Enable "Dependabot security updates"
- ✓ Enable "Dependency graph"

### 8. First Release

1. Ensure your `package.json` has a version (e.g., `1.0.0`)

2. Go to Actions tab

3. Select "Version Bump & Release Branch"

4. Click "Run workflow"

5. Select version type: `patch`

6. Click "Run workflow"

7. Wait for the release branch PR to be created

8. Review and merge the PR

9. Build & release validation runs automatically

10. Merge to `main`

11. Publish workflow triggers and publishes to npm

12. Watch for notifications (Slack, GitHub, etc.)

## Workflow Usage

### For Feature Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# Make your changes
git add .
git commit -m "feat: describe your feature"
git push origin feature/my-feature

# Create PR: develop <- feature/my-feature
# Wait for PR validation
# Get approval and merge
```

### For Release

#### Option 1: Automatic (GitHub Actions)
1. Go to Actions → "Version Bump & Release Branch"
2. Run workflow with version type
3. Follow PR through to main
4. Merge to main - publish happens automatically

#### Option 2: Manual
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create PR to `main`
4. Merge and publishing triggers

## Monitoring

### GitHub Actions Dashboard
- Go to Actions tab to see all workflow runs
- Click on a workflow to see detailed logs
- Artifacts are available after each run

### Releases
- Go to Releases page to see published versions
- View release notes and assets
- Download specific versions

### Notifications
- GitHub: Watch the repository for notifications
- Slack: Check your configured channel
- Email: Configure in GitHub notification settings

## Troubleshooting

### Workflow Won't Run
- Verify `.github/workflows/` has YAML files
- Check that files are properly formatted
- Go to Actions → select workflow → "Enable workflow"

### npm Publish Fails
- Verify `NPM_TOKEN` secret is set correctly
- Check token hasn't expired at npm.com
- Verify package name isn't already taken
- Review publish logs in Actions

### Tests Fail
- Run tests locally: `npm run test:all`
- Check Node.js version compatibility
- Review test logs in Actions
- Check for missing dependencies

### Security Audit Fails
- Review vulnerabilities: `npm audit`
- Update vulnerable packages
- Or create issue to track and fix later

## Support and Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Documentation](https://docs.npmjs.com/)
- [GitFlow Workflow Guide](./.github/GITFLOW-CICD.md)
- Repository specific docs in `6-Docs/` folder

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Run test workflows
3. ✅ Create first release
4. ✅ Monitor and iterate
5. ✅ Invite team members
