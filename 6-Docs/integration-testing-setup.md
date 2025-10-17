# Integration Testing Setup Guide

## Overview

This guide walks you through setting up and running integration tests against your live Neo4j Aura instance.

## Prerequisites

✅ Neo4j Aura account created  
✅ Free tier instance provisioned  
✅ Connection credentials obtained  

## Step 1: Get Your Neo4j Aura Credentials

1. Go to [Neo4j Aura Console](https://console.neo4j.io/)
2. Click on your instance (should be in "Running" state)
3. Click **"Details"** to view connection information
4. You'll see:
   - **URI**: `neo4j+s://xxxxx.databases.neo4j.io`
   - **Username**: `neo4j` (default)
   - **Password**: Your temporary password (shown only once at creation)

## Step 2: Configure Environment Variables

Edit the `.env` file in the project root:

```bash
# Copy your credentials from Neo4j Aura
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here
NEO4J_DATABASE=neo4j
```

**⚠️ Important Security Notes:**
- Never commit `.env` to version control
- The `.env` file is already in `.gitignore`
- Regenerate passwords periodically through Neo4j Aura console
- Use separate credentials for dev/test/prod environments

## Step 3: Run Tests

### Option A: Run Integration Tests Only

```bash
npm run test:integration
```

This runs the comprehensive test suite against your live Neo4j instance:

- **Connectivity Tests**: Verify database connection
- **Schema Validation**: Check constraints and indexes
- **Entity Management**: Create, read, update, delete operations
- **Relationship Management**: Create and traverse relationships
- **Search Functionality**: Full-text search validation
- **Graph Analytics**: Statistics and pattern analysis
- **Performance Tests**: Bulk operations and response times

### Option B: Run Unit Tests (Mocked)

```bash
npm run test:unit
```

Tests MemoryManager with mocked Neo4j driver (no live connection needed).

### Option C: Run All Tests

```bash
npm run test:all
```

Runs both unit tests and integration tests in sequence.

## Step 4: Interpret Results

Successful integration test output will show:

```
✓ src/integration.test.ts (X)
  ✓ Connectivity and Schema (3)
    ✓ connects to Neo4j Aura successfully
    ✓ creates and validates schema constraints
    ✓ creates and validates search indexes
  ✓ Entity Management (5)
    ✓ creates multiple entities via memory manager
    ✓ retrieves entities and validates structure
    ✓ updates existing entities
    ✓ deletes entities by pattern
    ✓ ...

Test Files  1 passed (1)
     Tests  XX passed (XX)
```

### Common Issues & Troubleshooting

#### ❌ "Neo4j Aura credentials not configured"

**Solution:**
1. Verify `.env` file exists in project root
2. Check all three variables are set (URI, USERNAME, PASSWORD)
3. Ensure no typos in variable names
4. Restart your terminal/VS Code to reload environment

```bash
# Verify environment variables are loaded
npm run test:integration 2>&1 | head -20
```

#### ❌ "Failed to connect to Neo4j"

**Possible Causes:**
- Incorrect URI (copy exactly from Aura console)
- Wrong username or password
- Neo4j instance is paused/stopped (check Aura console)
- Firewall/network blocking connection (unlikely with Aura cloud)

**Solution:**
1. Test credentials manually:
```powershell
$env:NEO4J_URI = "neo4j+s://..."
$env:NEO4J_USERNAME = "neo4j"
$env:NEO4J_PASSWORD = "..."
npm run test:integration
```

2. Check instance status in [Neo4j Aura Console](https://console.neo4j.io/)
   - Should show "Running" with green indicator
   - If paused, click "Resume"

#### ❌ "Authentication failed"

**Solution:**
1. Verify password is exactly as shown in Aura console
2. Copy-paste password instead of typing to avoid typos
3. Check if special characters need escaping
4. Reset password through Aura console if needed

#### ❌ "CONSTRAINT ... already exists"

This is expected if tests ran before. Neo4j prevents duplicate constraints.
Tests automatically handle this with `IF NOT EXISTS` clauses.

## Step 5: Verify Test Data Cleanup

Tests automatically:
1. ✅ Create a clean database at test start
2. ✅ Run all operations
3. ✅ Delete all test data at completion

To verify cleanup completed:

```powershell
# Check node count (should be 0 after tests)
$env:NEO4J_URI = "..."
$env:NEO4J_USERNAME = "neo4j"
$env:NEO4J_PASSWORD = "..."

# Using cypher command (if neo4j-cli installed)
neo4j-cli query "MATCH (n) RETURN count(n) AS nodes"

# Or manually check in Neo4j Browser: http://localhost:7474/
```

## Step 6: Advanced Configuration

### Connection Pool Tuning

For high-throughput scenarios, adjust in `.env`:

```bash
NEO4J_MAX_POOL_SIZE=100
NEO4J_CONNECTION_TIMEOUT=60000
```

### Running Tests in Watch Mode

For development iteration:

```bash
npm run test:watch
```

This reruns tests whenever you modify files.

## Step 7: Next Steps

Once integration tests pass, you can:

1. **Implement Rule Management** (Phase 6)
   - Complete `queryDirectives()` implementation
   - Build context detection engine
   - Add markdown rule parsing

2. **Add Vector Search** (Phase 7)
   - Integrate embedding model
   - Implement semantic search queries
   - Optimize vector indexes

3. **Deploy MCP Server**
   - Build Docker container with Neo4j driver
   - Deploy to cloud platform (Azure Container Apps, AWS Lambda, etc.)
   - Configure authentication for MCP clients

## Test Coverage Summary

| Test Suite | Count | Type | Coverage |
|-----------|-------|------|----------|
| Connectivity | 3 | Integration | Database connection, schema, indexes |
| Entity Management | 5 | Integration | CRUD operations, structure validation |
| Relationships | 3 | Integration | Creation, traversal, graph queries |
| Search | 3 | Integration | Full-text, type-based, keyword search |
| Analytics | 3 | Integration | Statistics, connectivity, patterns |
| Error Handling | 3 | Integration | Edge cases, missing data, duplicates |
| Performance | 2 | Integration | Bulk operations, response times |
| **Total** | **22** | | **100% Happy Path + Error Cases** |

## Performance Benchmarks

Expected performance on Neo4j Aura free tier:

| Operation | Expected Duration |
|-----------|------------------|
| Entity Creation (single) | < 50ms |
| Bulk Entity Creation (50) | < 2000ms |
| Full-Text Search | < 500ms |
| Graph Traversal | < 1000ms |
| Schema Creation | < 5000ms |

*Note: Free tier has rate limiting; premium tiers perform significantly faster*

## Support & Debugging

### Enable Debug Logging

In integration.test.ts or your application:

```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(uri, auth, {
  logging: neo4j.logging.console('DEBUG')
});
```

### Check Neo4j Server Logs

In [Neo4j Aura Console](https://console.neo4j.io/):
1. Click your instance
2. Go to **"Logs"** tab
3. View query logs and performance metrics

### Query Performance

Use Neo4j Browser for detailed query analysis:

```cypher
EXPLAIN MATCH (e:Entity)-[r:RELATES_TO]-(other) 
RETURN e, r, other LIMIT 10
```

## Final Checklist

- [ ] Neo4j Aura instance created and running
- [ ] `.env` file configured with correct credentials
- [ ] `npm install` completed successfully
- [ ] `npm run build` passes without errors
- [ ] `npm run test:integration` passes all 22 tests
- [ ] Test data cleanup verified (no orphaned nodes)
- [ ] Database connection pool validated
- [ ] Performance benchmarks meet expectations

🎉 **Integration testing is complete!** Ready for Phase 6-7 implementation.
