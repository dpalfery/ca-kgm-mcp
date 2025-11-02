#!/usr/bin/env pwsh

<#
.SYNOPSIS
Neo4j Integration Test Quick Start Script

.DESCRIPTION
Guides you through Neo4j Aura setup and runs integration tests

.EXAMPLE
.\neo4j-integration-test.ps1
#>

param(
    [switch]$SkipConfig = $false,
    [switch]$RunTests = $true,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Neo4j Integration Test Setup" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".\.env")) {
    if (-not $SkipConfig) {
        Write-Host "📝 Setting up Neo4j Aura credentials..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To proceed, you'll need credentials from your Neo4j Aura instance:`n" -ForegroundColor Gray
        Write-Host "1. Go to: https://console.neo4j.io/" -ForegroundColor Gray
        Write-Host "2. Click your instance and copy the Connection Details:" -ForegroundColor Gray
        Write-Host "   - Connection URI (neo4j+s://xxxxx.databases.neo4j.io)" -ForegroundColor Gray
        Write-Host "   - Username (usually 'neo4j')" -ForegroundColor Gray
        Write-Host "   - Password (shown at instance creation)" -ForegroundColor Gray
        Write-Host ""

        $uri = Read-Host "Enter your Neo4j URI"
        $username = Read-Host "Enter username (default: neo4j)" 
        if ([string]::IsNullOrWhiteSpace($username)) { $username = "neo4j" }
        $password = Read-Host "Enter password (hidden)" -AsSecureString

        # Convert secure string to plain text
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemPtr($password)
        $passwordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

        # Create .env file
        @"
# Neo4j Aura Configuration
# Auto-generated at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

NEO4J_URI=$uri
NEO4J_USERNAME=$username
NEO4J_PASSWORD=$passwordPlain
NEO4J_DATABASE=neo4j
"@ | Out-File -FilePath ".\.env" -Encoding UTF8

        Write-Host "`n✅ .env file created successfully" -ForegroundColor Green
        Write-Host "   Location: .\.env`n" -ForegroundColor Gray
    }
} else {
    Write-Host "✅ .env file already exists`n" -ForegroundColor Green
    
    # Verify credentials are set
    $envContent = Get-Content ".\.env" -Raw
    if ($envContent -match "neo4j\+s:\/\/your-instance" -or $envContent -match "NEO4J_PASSWORD=$") {
        Write-Host "⚠️  Warning: .env appears to have placeholder values" -ForegroundColor Yellow
        Write-Host "   Please update .env with your actual Neo4j Aura credentials`n" -ForegroundColor Gray
    }
}

if ($RunTests) {
    Write-Host "🧪 Running Integration Tests..." -ForegroundColor Cyan
    Write-Host "================================`n" -ForegroundColor Cyan

    # Load environment
    Get-Content ".\.env" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }

    # Show connection info (masked password)
    $uri = $env:NEO4J_URI
    $user = $env:NEO4J_USERNAME
    $pass = $env:NEO4J_PASSWORD
    $masked = if ($pass) { "*" * [math]::Min($pass.Length, 6) } else { "(not set)" }

    Write-Host "Connection Details:" -ForegroundColor Gray
    Write-Host "  URI:      $uri" -ForegroundColor Gray
    Write-Host "  Username: $user" -ForegroundColor Gray
    Write-Host "  Password: $masked..." -ForegroundColor Gray
    Write-Host ""

    # Run tests
    if ($Verbose) {
        npm run test:integration -- --reporter=verbose
    } else {
        npm run test:integration
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ All integration tests passed!" -ForegroundColor Green
        Write-Host "`n📊 Test Summary:" -ForegroundColor Cyan
        Write-Host "   ✓ Connectivity and Schema" -ForegroundColor Green
        Write-Host "   ✓ Entity Management" -ForegroundColor Green
        Write-Host "   ✓ Relationship Management" -ForegroundColor Green
        Write-Host "   ✓ Search Functionality" -ForegroundColor Green
        Write-Host "   ✓ Graph Analytics" -ForegroundColor Green
        Write-Host "   ✓ Error Handling" -ForegroundColor Green
        Write-Host "   ✓ Performance" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Tests failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Check .env credentials and Neo4j Aura instance status" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n📚 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Review integration test results above" -ForegroundColor Gray
Write-Host "   2. Check 6-Docs/integration-testing-setup.md for detailed docs" -ForegroundColor Gray
Write-Host "   3. Implement Phase 6: Rule Management" -ForegroundColor Gray
Write-Host "   4. Implement Phase 7: Vector Search" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Neo4j integration setup complete!" -ForegroundColor Green
