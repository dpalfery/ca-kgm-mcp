import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

async function runDiagnostics() {
    console.log('🔧 Running Comprehensive Diagnostics\n');
    
    // 1. Check environment variables
    console.log('1️⃣ Environment Variables:');
    console.log(`   NEO4J_URI: ${process.env.NEO4J_URI ? '✅ Set' : '❌ Missing'}`);
    console.log(`   NEO4J_USERNAME: ${process.env.NEO4J_USERNAME ? '✅ Set' : '❌ Missing'}`);
    console.log(`   NEO4J_PASSWORD: ${process.env.NEO4J_PASSWORD ? '✅ Set' : '❌ Missing'}`);
    console.log(`   LLM_ENDPOINT: ${process.env.LLM_ENDPOINT ? '✅ Set' : '❌ Missing'}`);
    console.log(`   LLM_MODEL: ${process.env.LLM_MODEL ? '✅ Set' : '❌ Missing'}`);
    
    // 2. Check file existence
    console.log('\n2️⃣ Critical Files:');
    const criticalFiles = [
        'src/index.ts',
        'src/rules/rule-manager.ts',
        'src/storage/neo4j-connection.ts',
        '.kilocode/mcp.json'
    ];
    
    for (const file of criticalFiles) {
        console.log(`   ${file}: ${existsSync(file) ? '✅ Exists' : '❌ Missing'}`);
    }
    
    // 3. Check MCP configuration
    console.log('\n3️⃣ MCP Configuration:');
    try {
        const mcpConfig = JSON.parse(await readFile('.kilocode/mcp.json', 'utf-8'));
        const contextIsoConfig = mcpConfig.mcpServers['context-iso'];
        
        console.log(`   context-iso server configured: ${contextIsoConfig ? '✅ Yes' : '❌ No'}`);
        if (contextIsoConfig) {
            console.log(`   Command: ${contextIsoConfig.command}`);
            console.log(`   Args: ${contextIsoConfig.args?.join(' ')}`);
            console.log(`   Disabled: ${contextIsoConfig.disabled ? '❌ Yes' : '✅ No'}`);
            console.log(`   Environment variables: ${Object.keys(contextIsoConfig.env || {}).length} configured`);
        }
    } catch (error) {
        console.log(`   ❌ Error reading MCP config: ${error.message}`);
    }
    
    // 4. Test basic context detection
    console.log('\n4️⃣ Context Detection Test:');
    try {
        const { detectTaskContext } = await import('./kgm-query-tool/task-context-detector.js');
        const testTask = "I need to create a new API endpoint for user authentication in ASP.NET Core";
        const context = detectTaskContext(testTask);
        
        console.log(`   ✅ Context detection working`);
        console.log(`   Layer: ${context.layer}`);
        console.log(`   Topics: ${context.topics.join(', ')}`);
        console.log(`   Confidence: ${(context.confidence * 100).toFixed(1)}%`);
    } catch (error) {
        console.log(`   ❌ Context detection failed: ${error.message}`);
    }
    
    // 5. Test Neo4j connection (simplified)
    console.log('\n5️⃣ Neo4j Connection Test:');
    try {
        // Set environment variables if they're missing
        if (!process.env.NEO4J_URI) {
            process.env.NEO4J_URI = 'bolt://localhost:7687';
            process.env.NEO4J_USERNAME = 'neo4j';
            process.env.NEO4J_PASSWORD = 'password';
            console.log('   ⚠️  Using default Neo4j credentials');
        }
        
        const { Neo4jConnection } = await import('./src/storage/neo4j-connection.js');
        const neo4j = new Neo4jConnection();
        await neo4j.connect();
        
        // Simple query
        const result = await neo4j.executeQuery('MATCH (n) RETURN count(n) as total LIMIT 1');
        const total = result.records[0]?.get('total')?.toNumber() || 0;
        
        console.log(`   ✅ Neo4j connection successful`);
        console.log(`   Total nodes in database: ${total}`);
        
        await neo4j.close();
    } catch (error) {
        console.log(`   ❌ Neo4j connection failed: ${error.message}`);
    }
    
    // 6. Check if AI-enhanced crawler results exist
    console.log('\n6️⃣ AI-Enhanced Crawler Results:');
    try {
        const { Neo4jConnection } = await import('./src/storage/neo4j-connection.js');
        const neo4j = new Neo4jConnection();
        await neo4j.connect();
        
        const directiveQuery = 'MATCH (d:Directive) RETURN count(d) as total';
        const result = await neo4j.executeQuery(directiveQuery);
        const totalDirectives = result.records[0]?.get('total')?.toNumber() || 0;
        
        console.log(`   Total directives: ${totalDirectives}`);
        
        if (totalDirectives > 0) {
            // Check for AI-generated vs pattern-matched
            const sourceQuery = 'MATCH (d:Directive) RETURN d.source as source, count(d) as count';
            const sourceResult = await neo4j.executeQuery(sourceQuery);
            
            sourceResult.records.forEach(record => {
                const source = record.get('source') || 'Unknown';
                const count = record.get('count').toNumber();
                console.log(`   ${source}: ${count} directives`);
            });
        }
        
        await neo4j.close();
    } catch (error) {
        console.log(`   ❌ Could not check crawler results: ${error.message}`);
    }
    
    console.log('\n🎯 Diagnostic Summary:');
    console.log('Based on the results above, the main issues appear to be:');
    console.log('• MCP server connection to VS Code extension');
    console.log('• Possible environment variable configuration');
    console.log('• Process communication between MCP server and client');
    
    console.log('\n💡 Recommendations:');
    console.log('1. Restart VS Code to refresh MCP server connections');
    console.log('2. Verify environment variables are properly loaded');
    console.log('3. Check if Neo4j database is running and accessible');
    console.log('4. Test MCP server functionality independently');
}

runDiagnostics().catch(console.error);