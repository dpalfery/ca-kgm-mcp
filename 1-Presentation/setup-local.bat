@echo off
REM GitFlow CI/CD Pipeline - Local Setup Script for Windows
REM This script helps set up local development environment for GitFlow

setlocal enabledelayedexpansion

echo.
echo 🚀 ContextISO GitFlow CI/CD - Local Setup ^(Windows^)
echo ==========================================
echo.

REM Check prerequisites
echo 📋 Checking prerequisites...

where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo    Install from: https://nodejs.org/
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js !NODE_VERSION!

where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ npm is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm !NPM_VERSION!

where git >nul 2>nul
if errorlevel 1 (
    echo ❌ git is not installed
    exit /b 1
)
echo ✅ git installed

echo.
echo 📦 Installing dependencies...
call npm ci

echo.
echo 🔧 Setting up local git configuration...

REM Configure git for this repository
git config core.autocrlf true
git config core.safecrlf true

echo ✅ Git configuration updated

echo.
echo ✅ Local setup complete!
echo.
echo 📝 Next steps:
echo    1. Read .github\SETUP.md for GitHub configuration
echo    2. Set NPM_TOKEN secret in GitHub repository
echo    3. Create a feature branch: git checkout -b feature/my-feature
echo    4. Make changes and commit: git commit -m "feat: description"
echo    5. Push and create PR: git push origin feature/my-feature
echo.
echo 🔗 Useful links:
echo    - CI/CD Guide: .github\GITFLOW-CICD.md
echo    - Quick Reference: .github\CI-CD-QUICK-REFERENCE.md
echo    - Setup Instructions: .github\SETUP.md
echo.

endlocal
