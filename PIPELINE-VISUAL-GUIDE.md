# GitFlow CI/CD Pipeline - Visual Guide

## Complete Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GITFLOW CI/CD PIPELINE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────────────────┘

                              DEVELOPMENT PHASE
                              
                    ┌─────────────────────────────────┐
                    │   Create Feature Branch         │
                    │   git checkout -b feature/...   │
                    └──────────────┬──────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────┐
                    │   Make Changes & Commit         │
                    │   git commit -m "feat: ..."     │
                    └──────────────┬──────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────┐
                    │   Push & Create PR to develop   │
                    │   github.com/...                │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │  PR VALIDATION        │      │  SECURITY AUDIT       │
        │  ✅ Run (Auto)        │      │  ✅ Run (Daily)       │
        │  ⏱️  3-5 min          │      │  ⏱️  2-3 min          │
        │                       │      │                       │
        │ • Lint (ESLint)       │      │ • npm audit           │
        │ • Test (Node 18, 20)  │      │ • Snyk scan           │
        │ • Build (TypeScript)  │      │ • Dependency check    │
        │ • Coverage (Codecov)  │      │                       │
        │ • Bundle size check   │      │ 🔒 Security checks    │
        │                       │      │                       │
        │ ✅ = Success          │      │ ✅ = No vulnerabilities
        │ ❌ = Fail → Fix code  │      │ ⚠️  = Review required
        └───────────┬───────────┘      └───────────────────────┘
                    │
        ┌───────────┴────────────────────────┐
        │   Get Review & Approval            │
        │   (Team/Maintainer review)         │
        └───────────┬────────────────────────┘
                    │
        ┌───────────▼────────────────────────┐
        │   Merge PR to develop              │
        │   ✅ All checks passed             │
        │   ✅ Approved by reviewer          │
        └───────────┬────────────────────────┘
                    │
                    │   [Development continues...]
                    │
                    │   [Ready for release?]
                    │
                    ▼
                    
                           RELEASE PHASE
                           
            ┌─────────────────────────────────────┐
            │  Version Bump Request               │
            │  Actions → "Version Bump & Release" │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │  Select Version Type:               │
            │  ○ patch (1.2.3 → 1.2.4)           │
            │  ○ minor (1.2.3 → 1.3.0)           │
            │  ○ major (1.2.3 → 2.0.0)           │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │  Release Branch Created             │
            │  • Version bumped                   │
            │  • CHANGELOG updated                │
            │  • Release PR created to main       │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │  BUILD & RELEASE VALIDATION         │
            │  ✅ Run (Auto on PR)                │
            │  ⏱️  4-6 min                        │
            │                                     │
            │  • Full test suite                  │
            │  • TypeScript compilation           │
            │  • Type declarations check          │
            │  • Security audit                   │
            │  • SBOM generation                  │
            │  • Artifacts upload                 │
            │                                     │
            │  ✅ = Ready to merge                │
            │  ❌ = Fix issues                    │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │  Review & Merge to main             │
            │  ✅ All checks passed               │
            │  ✅ Approved by maintainer          │
            └──────────────┬──────────────────────┘
                           │
                           
                         PUBLISH PHASE
                         
            ┌──────────────▼──────────────────────┐
            │  PUBLISH RELEASE WORKFLOW           │
            │  ✅ Triggers on main push           │
            │  ⏱️  3-4 min                        │
            │                                     │
            │  • Final validation                 │
            │  • Build distribution               │
            │  • Generate changelog               │
            │  • Publish to npm registry          │
            │  • Create GitHub release            │
            │  • Send notifications               │
            │  • Upload artifacts                 │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │  Package Published! ✅              │
            │  • https://npm.js.com/package/...   │
            │  • GitHub Release created           │
            │  • Notifications sent               │
            │  • Version available                │
            │                                     │
            │  npm install context-iso@X.Y.Z     │
            └─────────────────────────────────────┘
```

## Branch Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                      GITFLOW BRANCHING MODEL                     │
└──────────────────────────────────────────────────────────────────┘

    main (Production)
    │   Tags: v1.2.3, v1.3.0, etc.
    │   Status: 🟢 Stable releases only
    │
    └─◄─ release/v*.*.* ◄─ PR merges from develop
        │   Temporary release branches
        │   PR → main triggers build-release.yml
        │
        ▼
    
    develop (Staging)
    │   Status: 🟡 Pre-release versions
    │
    └─◄─ feature/* ◄─ Feature development
    │   └─◄─ bugfix/* ◄─ Bug fixes
    │   └─◄─ hotfix/* ◄─ Critical fixes
    │
    │   PR → develop triggers pr-validation.yml
    │   Each branch is short-lived
    │
    ▼

    Feature Development Branches (deleted after merge)
    
    feature/feature-name       → PR to develop
    bugfix/bug-name           → PR to develop
    hotfix/critical-issue     → PR to main (then merge back to develop)
```

## Workflow State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW STATE TRANSITIONS                           │
└─────────────────────────────────────────────────────────────────────────────┘

PR CREATED
    ↓
    ├─► If PR to develop/feature/hotfix:
    │   └─► pr-validation.yml starts
    │       ├─► Linting... [⏱️  30s]
    │       ├─► Testing... [⏱️  2m]
    │       ├─► Building... [⏱️  1m]
    │       └─► Result: ✅ or ❌
    │           ├─► ✅ = Comment added "Checks passed"
    │           │   └─► Ready for review
    │           └─► ❌ = Comment added "Checks failed"
    │               └─► Author must fix
    │
    ├─► If PR to main:
    │   └─► build-release.yml starts
    │       ├─► Full test suite... [⏱️  3m]
    │       ├─► Build artifacts... [⏱️  1.5m]
    │       ├─► Generate SBOM... [⏱️  30s]
    │       └─► Result: ✅ or ❌
    │           ├─► ✅ = Comment "Release ready!"
    │           │   └─► Ready to merge
    │           └─► ❌ = Comment "Release failed"
    │               └─► Must fix issues
    │
    └─► Plus: security-audit.yml (independent, daily)

AFTER PR APPROVED & MERGED TO main
    ↓
    publish-release.yml starts
    ├─► Run tests... [⏱️  2m]
    ├─► Publish to npm... [⏱️  1m]
    ├─► Create GitHub release... [⏱️  30s]
    ├─► Send notifications... [⏱️  30s]
    └─► Result: ✅ or ❌
        ├─► ✅ = Package published
        │   └─► Available on npm
        │   └─► Users can install
        └─► ❌ = Publish failed
            └─► Check logs, retry
```

## Performance Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TYPICAL PIPELINE TIMELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

Feature Development
═══════════════════════════════════════════════════════════════════════════ Day 1-5
    Day 1:  Create branch
    Day 2:  Make changes, commit
    Day 3:  Push & create PR
            ├─ PR validation starts (3-5 min)
            └─ Parallel: security audit starts
    Day 4:  Get review
    Day 5:  Merge to develop

Version Bump & Release Build
═══════════════════════════════════════════════════════════════════════════ Day 6
    Day 6:  Manual trigger: Version Bump
            ├─ Release branch created (~2 min)
            ├─ PR to main created
            └─ Build & release validation starts (4-6 min)

Publishing
═══════════════════════════════════════════════════════════════════════════ Day 6
    Day 6:  Merge release PR to main
            ├─ Publish workflow starts (~3-4 min)
            ├─ Package published to npm
            ├─ GitHub release created
            └─ Notifications sent

Total Time: 5-6 days (mostly development time, CI is fast)
Actual CI Time: ~20 minutes total (3-5 + 4-6 + 3-4 minutes)
```

## Notification Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION CHANNELS                              │
└─────────────────────────────────────────────────────────────────────────────┘

PR VALIDATION COMPLETE
    ├─► GitHub PR Comment
    │   └─► "@author: ✅ Build passed" or "❌ Build failed"
    │
    ├─► GitHub Checks
    │   └─► Green ✓ or Red ✗ status badge
    │
    └─► Optional: GitHub Notifications
        └─► Email if subscribed


BUILD & RELEASE COMPLETE
    ├─► GitHub PR Comment
    │   └─► "@author: 🎉 Release ready!"
    │
    └─► GitHub Checks
        └─► Green ✓ status badge


PUBLISH COMPLETE
    ├─► GitHub Release Created
    │   └─► Visible on Releases page
    │   └─► Includes changelog and assets
    │
    ├─► Slack Notification (if configured)
    │   └─► "#releases channel"
    │   └─► "context-iso v1.2.3 published!"
    │
    ├─► GitHub Notifications
    │   └─► Email to watchers
    │
    └─► npm Package Page Updated
        └─► Version visible at npm.js.com/package/context-iso


SECURITY AUDIT FINDINGS
    ├─► GitHub PR Comment (if issues found)
    │   └─► "@author: ⚠️ X vulnerabilities found"
    │
    └─► GitHub Issues (for tracking)
        └─► Auto-created if serious issues
```

## File Structure

```
ca-kgm-mcp/
│
├─ .github/
│  ├─ workflows/                    [Automated pipelines]
│  │  ├─ pr-validation.yml          [Feature validation]
│  │  ├─ build-release.yml          [Release build]
│  │  ├─ publish-release.yml        [npm publishing]
│  │  ├─ security-audit.yml         [Security scanning]
│  │  └─ version-bump.yml           [Version management]
│  │
│  ├─ ISSUE_TEMPLATE/               [Issue templates]
│  │  ├─ bug_report.md
│  │  └─ feature_request.md
│  │
│  ├─ pull_request_template.md      [PR template]
│  ├─ SETUP.md                      [🔴 Read this first!]
│  ├─ SETUP-CHECKLIST.md            [Setup tracking]
│  ├─ GITFLOW-CICD.md               [Complete docs]
│  ├─ CI-CD-QUICK-REFERENCE.md      [Quick guide]
│  └─ PIPELINE-SETUP-COMPLETE.md    [Setup summary]
│
├─ .npmrc                           [npm config]
├─ .releaserc.json                  [Release config]
│
├─ setup-local.sh                   [Unix setup script]
├─ setup-local.bat                  [Windows setup script]
│
├─ GITFLOW-PIPELINE-README.md       [Pipeline overview]
├─ PIPELINE-IMPLEMENTATION-SUMMARY.md [Implementation details]
│
└─ [rest of your project files]
```

## Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DEVELOPMENT DECISION TREE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                        Ready to code?
                             │
                    ┌────────┴────────┐
                    │                 │
            New Feature?      Fixing a Bug?
                    │                 │
                    ▼                 ▼
            feature/NAME      bugfix/NAME
                    │                 │
            Create PR to      Create PR to
            develop            develop
                    │                 │
                    └────────┬────────┘
                             │
                    Wait for validation
                    (PR Validation runs)
                             │
                    ┌────────┴────────┐
                    │                 │
                 Pass ✅          Fail ❌
                    │                 │
                 Get Review        Fix Code
                    │                 │
                 Approved?        Re-Push
                    │                 │
                 Yes ✅              │
                    │                 │
                    └────────┬────────┘
                             │
                       Merge to develop
                             │
                    [Development done]
                             │
                    Ready to release?
                             │
                          No ✗
                             │
                          Yes ✓
                             │
                             ▼
                    Actions → Version Bump
                             │
            Select patch/minor/major
                             │
                    Release branch created
                             │
            Wait for release validation
               (Build & Release runs)
                             │
                    ┌────────┴────────┐
                    │                 │
                 Pass ✅          Fail ❌
                    │                 │
                 Approve PR        Fix Issues
                    │                 │
                Merge to main         │
                    │                 │
                    └────────┬────────┘
                             │
            Publish workflow auto-starts
                             │
                       Package published!
                             │
                    Users can install
```

## Status Indicator Legend

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATUS INDICATORS                            │
└─────────────────────────────────────────────────────────────────┘

✅ Success - All checks passed, ready to proceed
❌ Failure - Action required, fix and re-push
⏳ In Progress - Workflow currently running
⏱️  Duration - Estimated time to complete
🟢 Active - Workflow is enabled and running
🟡 Warning - Issue found, review required
🔴 Error - Critical failure, intervention needed
⚠️  Alert - Important information
🎉 Celebration - Release published successfully
🔒 Security - Security-related check
🚀 Deploy - Publishing/deployment action
📦 Package - npm package related
🔄 Workflow - Automation related
```

---

This visual guide complements the complete documentation in `.github/GITFLOW-CICD.md`.
For daily use, reference `.github/CI-CD-QUICK-REFERENCE.md`.
