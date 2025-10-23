#!/bin/bash

# GitFlow CI/CD Pipeline - Local Setup Script
# This script helps set up local development environment for GitFlow

set -e

echo "🚀 ContextISO GitFlow CI/CD - Local Setup"
echo "=========================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm $(npm --version)"

if ! command -v git &> /dev/null; then
    echo "❌ git is not installed"
    exit 1
fi
echo "✅ git $(git --version | awk '{print $3}')"

echo ""
echo "📦 Installing dependencies..."
npm ci

echo ""
echo "🔧 Setting up local git hooks..."

# Create pre-commit hook
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."
npm run lint
npm run test:unit
EOF
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed"

echo ""
echo "🔀 Configuring git branches..."

# Ensure develop branch exists locally
if ! git rev-parse --verify develop &>/dev/null; then
    echo "Creating local develop branch..."
    git fetch origin develop 2>/dev/null || true
    git checkout -b develop origin/develop 2>/dev/null || {
        echo "Note: develop branch not found on origin"
    }
fi

echo ""
echo "✅ Local setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Read .github/SETUP.md for GitHub configuration"
echo "   2. Set NPM_TOKEN secret in GitHub repository"
echo "   3. Create a feature branch: git checkout -b feature/my-feature"
echo "   4. Make changes and commit: git commit -m 'feat: description'"
echo "   5. Push and create PR: git push origin feature/my-feature"
echo ""
echo "🔗 Useful links:"
echo "   - CI/CD Guide: .github/GITFLOW-CICD.md"
echo "   - Quick Reference: .github/CI-CD-QUICK-REFERENCE.md"
echo "   - Setup Instructions: .github/SETUP.md"
echo ""
