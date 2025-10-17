# 🚀 Integration Testing Step-by-Step Guide

## Prerequisites Checklist

Before you begin, verify:

- [ ] Neo4j Aura account created
- [ ] Free tier instance provisioned and running
- [ ] Instance status shows "Running" (green indicator)
- [ ] Node.js 18+ installed
- [ ] npm installed and updated
- [ ] Git configured
- [ ] PowerShell available (Windows)
- [ ] Text editor for `.env` file

## Step-by-Step Instructions

### STEP 1: Get Your Neo4j Aura Credentials

**Time: 2 minutes**

1. Go to **[Neo4j Aura Console](https://console.neo4j.io/)**
2. Sign in with your credentials
3. Click on your instance (should show "Running" with green dot)
4. Click **"Details"** button
5. You'll see three pieces of information:
   ```
   Connection URI:    neo4j+s://xxxxxxxxxxxxx.databases.neo4j.io
   Username:          neo4j
   Password:          [Your temporary password - appears only at creation]
   ```

**If you forgot your password:**
- Go to your instance in Aura Console
- Click **"Actions"** → **"Reset password"**
- New password will be generated

Copy these three values - you'll need them next!

---

### STEP 2: Configure Your Local Environment

**Time: 1 minute**

Navigate to your project directory and open the `.env` file:

```powershell
cd c:\git\ca-kgm-mcp
notepad .env
```

The file should look like this (it's mostly empty):

```
# Neo4j Aura Configuration
# Copy this file from .env.example and fill in your actual credentials

# Get these values from your Neo4j Aura dashboard
# 1. Go to https://console.neo4j.io/
# 2. Click on your instance
# 3. Copy the Connection URI, Username, and Password

# Connection URI from Neo4j Aura dashboard
# Format: neo4j+s://xxxxx.databases.neo4j.io
NEO4J_URI=

# Database username (default is 'neo4j')
NEO4J_USERNAME=neo4j

# Database password (provided by Aura during instance creation)
NEO4J_PASSWORD=

# Database name (default: 'neo4j')
NEO4J_DATABASE=neo4j

# Enable encryption for secure connections (recommended for production)
# NEO4J_ENCRYPTED=true

# Connection pool settings (optional)
# NEO4J_MAX_POOL_SIZE=50
# NEO4J_CONNECTION_TIMEOUT=30000
```

**Fill in the values you copied from Aura:**

```
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here
NEO4J_DATABASE=neo4j
```

**Important Security Notes:**
- ❌ Never share this file
- ❌ Never commit to Git (it's in `.gitignore`)
- ❌ Never send over email or chat
- ✅ Keep it local on your machine only
- ✅ Regenerate password if accidentally shared

Save the file (Ctrl+S in Notepad).

---

### STEP 3: Verify Your Setup

**Time: 1 minute**

Open PowerShell in the project directory:

```powershell
cd c:\git\ca-kgm-mcp

# Verify .env file exists and has content
Get-Content .env

# Should show your credentials (password will be visible)
```

Expected output:
```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

---

### STEP 4: Run Automated Setup (Recommended)

**Time: 5-10 minutes**

PowerShell script handles everything:

```powershell
cd c:\git\ca-kgm-mcp
.\neo4j-integration-test.ps1
```

The script will:
1. ✅ Check if `.env` exists
2. ✅ Load your credentials
3. ✅ Verify Neo4j connection
4. ✅ Run all 22 integration tests
5. ✅ Display results
6. ✅ Clean up test data

---

### STEP 5: Manual Test Execution (Alternative)

**Time: 5-10 minutes**

If you prefer to run tests manually:

```powershell
cd c:\git\ca-kgm-mcp

# Run integration tests
npm run test:integration

# Or with verbose output
npm run test:integration -- --reporter=verbose
```

---

### STEP 6: Interpret the Results

**Expected Success Output:**

```
🚀 Starting Neo4j Integration Tests
📍 Connecting to: neo4j+s://your-instance...

✅ Connected to Neo4j Aura successfully
✅ Schema created successfully
🧹 Cleaned up previous test data

 ✓ src/integration.test.ts (22)
   ✓ Connectivity and Schema (3)
     ✓ connects to Neo4j Aura successfully
     ✓ creates and validates schema constraints
     ✓ creates and validates search indexes
   ✓ Entity Management (5)
     ✓ creates multiple entities via memory manager
     ✓ retrieves entities and validates structure
     ✓ updates existing entities
     ✓ deletes entities by pattern
   ✓ Relationship Management (3)
     ✓ creates relationships between entities
     ✓ reads complete graph with all relationships
     ✓ traverses entity paths
   ✓ Search Functionality (3)
     ✓ searches entities by name
     ✓ searches entities by type
     ✓ uses full-text search for advanced queries
   ✓ Graph Analytics (3)
     ✓ calculates entity statistics
     ✓ calculates relationship statistics
     ✓ finds most connected entities
   ✓ Error Handling and Edge Cases (3)
     ✓ handles duplicate entity creation gracefully
     ✓ handles relationships with missing entities
     ✓ handles empty search gracefully
   ✓ Performance and Scale (2)
     ✓ creates bulk entities efficiently
     ✓ searches efficiently across entities

 Test Files  1 passed (1)
      Tests  22 passed (22)
   Duration  15.2s

⏱️  Bulk create (50 entities): 1234ms
⏱️  Search (20 results): 234ms

🧹 Cleaned up test data after integration tests
✅ Disconnected from Neo4j
✅ Integration tests completed
```

**✅ This means SUCCESS!** All tests passed!

---

### STEP 7: Troubleshooting If Tests Fail

**If you see: "Neo4j Aura credentials not configured"**

```powershell
# Check .env file exists
Test-Path .env

# View contents
Get-Content .env

# Verify no placeholder values remain
# Should NOT contain "your-instance" or empty values
```

Fix: Edit `.env` with real credentials from Aura Console.

---

**If you see: "Failed to connect to Neo4j"**

```powershell
# Check Aura Console
# 1. Go to https://console.neo4j.io/
# 2. Look for your instance
# 3. Should show "Running" (green indicator)
# 4. If "Paused", click "Resume"

# Verify credentials exactly match Aura Console
Get-Content .env
```

Fix: Copy credentials again from Aura Console (exact match required).

---

**If tests timeout (< 60 seconds)**

```powershell
# Run with longer timeout
npm run test:integration -- --testTimeout=120000

# If still slow, check network connection to databases.neo4j.io
```

Fix: Check internet connection and Aura instance status.

---

**If you see constraint warnings**

```
⚠️  Schema creation warning: Constraint already exists
```

**This is NORMAL!** ✓ Tests handle this automatically.

The warning appears if you've run tests before. It's harmless.

---

### STEP 8: Verify Data Cleanup

After successful tests, verify no test data remains:

```powershell
# Option 1: Use Neo4j Browser
# Go to https://console.neo4j.io/ → Your Instance → Open Browser
# Run this Cypher query:

MATCH (n) RETURN count(n) AS total_nodes

# Should return: 0 (test data cleaned up)
```

---

## 📊 What Gets Tested

| Test Category | What's Tested | Expected Result |
|---------------|---------------|-----------------|
| **Connectivity** | Database connection | ✅ Connected |
| **Schema** | Constraints & indexes | ✅ Created |
| **Entities** | CRUD operations | ✅ 50 entities created |
| **Relationships** | Graph connections | ✅ Relationships linked |
| **Search** | Name/type queries | ✅ Results found |
| **Analytics** | Statistics queries | ✅ Metrics calculated |
| **Error Handling** | Edge cases | ✅ Handled gracefully |
| **Performance** | Speed metrics | ✅ < 2 seconds |

---

## 🔐 Security Reminders

✅ **DO:**
- Keep `.env` file local only
- Use strong passwords in Aura
- Regenerate passwords periodically
- Use separate credentials for dev/test/prod

❌ **DON'T:**
- Commit `.env` to Git
- Share credentials via email/chat
- Hardcode credentials in code
- Use default passwords in production

---

## ✅ Success Checklist

After completing these steps:

- [ ] Neo4j Aura instance running (green indicator)
- [ ] `.env` file configured with valid credentials
- [ ] `npm run test:integration` shows 22/22 tests passing
- [ ] Performance metrics under 2 seconds for bulk operations
- [ ] Test data cleaned up (verified 0 nodes remaining)
- [ ] No errors or warnings in output

🎉 **You're done!** Integration testing is complete!

---

## 📚 Next Steps

With integration testing validated, you can now:

1. **Implement Phase 6 (Rule Management)**
   - Add full Cypher implementations
   - Build context detection engine
   - Parse markdown rules

2. **Implement Phase 7 (Vector Search)**
   - Integrate embedding model
   - Add semantic search
   - Optimize vectors

3. **Deploy to Production**
   - Create Docker image
   - Deploy to cloud platform
   - Configure monitoring

---

## 📞 Need Help?

1. **Check documentation:**
   - `TEST-EXECUTION.md` - Quick reference
   - `INTEGRATION-TESTING-SETUP.md` - Detailed guide
   - `ARCHITECTURE-DIAGRAM.md` - Visual reference

2. **Verify configuration:**
   - `.env` file in project root
   - Neo4j Aura instance running
   - Network connectivity

3. **Review error messages:**
   - Copy exact error text
   - Check timestamp
   - Compare with troubleshooting section above

---

🚀 **Ready to test?** Run:

```powershell
.\neo4j-integration-test.ps1
```

Or manually:

```powershell
npm run test:integration
```

Good luck! ✨
