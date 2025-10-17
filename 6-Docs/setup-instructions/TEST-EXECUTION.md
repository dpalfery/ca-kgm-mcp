# Running Integration Tests - Quick Reference

## 🚀 Quick Start (Recommended)

Run the automated setup script:

```powershell
.\neo4j-integration-test.ps1
```

This will:
- ✅ Prompt you for Neo4j Aura credentials (if not already configured)
- ✅ Create/update `.env` file
- ✅ Run complete integration test suite (22 tests)
- ✅ Display results summary

## 📋 Manual Test Execution

### Step 1: Verify Configuration

Check that `.env` contains your Neo4j Aura credentials:

```bash
cat .env
```

Should show:
```
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

### Step 2: Run Tests

#### Run Integration Tests Only
```bash
npm run test:integration
```

#### Run Unit Tests Only (Mocked)
```bash
npm run test:unit
```

#### Run All Tests
```bash
npm run test:all
```

#### Run with Watch Mode
```bash
npm run test:watch
```

## 📊 Test Suites

### Connectivity & Schema (3 tests)
```bash
npm run test:integration -- --reporter=verbose 2>&1 | grep -A 1 "Connectivity"
```
Tests:
- ✓ Database connection establishment
- ✓ Schema constraints creation
- ✓ Full-text search indexes

### Entity Management (5 tests)
- ✓ Bulk entity creation
- ✓ Entity retrieval and validation
- ✓ Entity updates
- ✓ Entity deletion
- ✓ Structure validation

### Relationship Management (3 tests)
- ✓ Relationship creation
- ✓ Graph traversal
- ✓ Multi-hop path finding

### Search Functionality (3 tests)
- ✓ Entity name search
- ✓ Entity type filtering
- ✓ Full-text search queries

### Graph Analytics (3 tests)
- ✓ Entity statistics
- ✓ Relationship statistics
- ✓ Most connected entities

### Error Handling (3 tests)
- ✓ Duplicate entity creation
- ✓ Missing relationship endpoints
- ✓ Empty search results

### Performance (2 tests)
- ✓ Bulk create (50 entities)
- ✓ Search across large dataset

## 🔧 Troubleshooting

### Issue: "Cannot find .env file"
```powershell
# Create template
Copy-Item .env.example .env

# Edit with your credentials
notepad .env
```

### Issue: "Failed to connect to Neo4j"
```powershell
# Verify credentials
$env:NEO4J_URI
$env:NEO4J_USERNAME
$env:NEO4J_PASSWORD

# Check instance status in https://console.neo4j.io/
```

### Issue: Tests timeout or hang
```bash
# Increase timeout
npm run test:integration -- --reporter=verbose

# Or use longer timeout
npm run test:integration -- --testTimeout=60000
```

### Issue: "CONSTRAINT already exists" warning
This is normal and expected - Neo4j prevents duplicates.
Tests handle this automatically with `IF NOT EXISTS`.

## 📈 Expected Output

```
🚀 Starting Neo4j Integration Tests
📍 Connecting to: neo4j+s://xxxx...

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
     ✓ validates entity structure
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

🧹 Cleaned up test data after integration tests
✅ Disconnected from Neo4j
✅ Integration tests completed
```

## 🎯 Success Criteria

All tests pass when:
- ✅ Database connection successful
- ✅ Schema created (constraints & indexes)
- ✅ 50 entities created in < 2 seconds
- ✅ All CRUD operations complete successfully
- ✅ Search queries return correct results
- ✅ Graph traversal finds relationships
- ✅ Test data cleaned up automatically

## 📝 Debugging Tips

### View Neo4j Query Execution
```bash
# Enable verbose logging
$env:DEBUG='neo4j:*'
npm run test:integration
```

### Check Aura Instance Status
1. Go to https://console.neo4j.io/
2. Look for your instance (should be "Running" with green indicator)
3. If paused, click "Resume"

### Manually Query Your Data
Use Neo4j Browser: http://console.neo4j.io/ → Instance → Open Browser

```cypher
# Count entities
MATCH (e:Entity) RETURN count(e) AS total

# List all entity types
MATCH (e:Entity) RETURN DISTINCT e.entityType

# Show relationships
MATCH ()-[r:RELATES_TO]->() RETURN count(r) AS relationships
```

### Monitor Performance
Add this to your test:
```typescript
const start = Date.now();
// ... test code ...
const duration = Date.now() - start;
console.log(`⏱️  Duration: ${duration}ms`);
```

## 🚀 Next Steps After Successful Tests

Once all tests pass:

1. **Phase 6: Rule Management**
   - Implement `queryDirectives()` with actual Cypher
   - Build context detection engine
   - Add markdown parsing

2. **Phase 7: Vector Search**
   - Integrate embedding model (e.g., OpenAI, Ollama)
   - Implement semantic search
   - Optimize vector indexes

3. **Deployment**
   - Build Docker image
   - Deploy to production
   - Monitor performance

## 📞 Support

For issues:
- Check `.env` configuration
- Verify Neo4j Aura instance is running
- Review test output for specific error messages
- Consult `6-Docs/integration-testing-setup.md` for detailed troubleshooting

Good luck! 🎉
