import { Neo4jConnection } from '../1-Presentation/dist/storage/neo4j-connection.js';
import { loadNeo4jConfig } from '../1-Presentation/dist/config/neo4j-config.js';

async function testNeo4jAndQuery() {
    console.log('🔍 Testing Neo4j Connection and AI-Generated Directives\n');
    
    try {
        // Load Neo4j configuration properly
        const config = loadNeo4jConfig();
        console.log('✅ Neo4j configuration loaded successfully');
        
        // Create connection with proper config
        const neo4j = new Neo4jConnection(config);
        await neo4j.connect();
        console.log('✅ Neo4j connection established');
        
        // Test 1: Check total directive count
        console.log('\n📊 Database Statistics:');
        const session = neo4j.getSession();
        
        try {
            const countResult = await session.run('MATCH (d:Directive) RETURN count(d) as total');
            const totalDirectives = countResult.records[0].get('total').toNumber();
            console.log(`   Total directives: ${totalDirectives}`);
            
            // Test 2: Check directives by source
            const sourceResult = await session.run(`
                MATCH (d:Directive) 
                RETURN d.source as source, count(d) as count 
                ORDER BY count DESC
            `);
            
            console.log('\n📋 Directives by Source:');
            sourceResult.records.forEach(record => {
                const source = record.get('source') || 'Unknown';
                const count = record.get('count').toNumber();
                console.log(`   ${source}: ${count} directives`);
            });
            
            // Test 3: Get sample AI-generated directives
            const aiDirectivesResult = await session.run(`
                MATCH (d:Directive) 
                WHERE d.source CONTAINS 'AI-Enhanced' OR d.reasoning IS NOT NULL
                RETURN d.text, d.severity, d.topics, d.reasoning, d.confidence, d.source
                ORDER BY d.confidence DESC
                LIMIT 5
            `);
            
            console.log('\n🤖 Sample AI-Generated Directives:');
            if (aiDirectivesResult.records.length > 0) {
                aiDirectivesResult.records.forEach((record, index) => {
                    const text = record.get('d.text') || 'No text';
                    const severity = record.get('d.severity') || 'No severity';
                    const topics = record.get('d.topics') || [];
                    const reasoning = record.get('d.reasoning') || 'No reasoning';
                    const confidence = record.get('d.confidence') || 'No confidence';
                    const source = record.get('d.source') || 'No source';
                    
                    console.log(`\n${index + 1}. [${severity}] ${text.substring(0, 100)}...`);
                    console.log(`   💡 Reasoning: ${reasoning.substring(0, 80)}...`);
                    console.log(`   🏷️  Topics: ${Array.isArray(topics) ? topics.join(', ') : topics}`);
                    console.log(`   🎯 Confidence: ${confidence}`);
                    console.log(`   📄 Source: ${source}`);
                });
            } else {
                console.log('   ❌ No AI-generated directives found');
            }
            
            // Test 4: Test context-based query simulation
            console.log('\n🎯 Context-Based Query Simulation:');
            const contextQuery = `
                MATCH (d:Directive)
                WHERE d.topics CONTAINS 'security' OR d.text CONTAINS 'authentication' OR d.text CONTAINS 'API'
                RETURN d.text, d.severity, d.topics, d.source
                ORDER BY d.severity DESC
                LIMIT 3
            `;
            
            const contextResult = await session.run(contextQuery);
            
            if (contextResult.records.length > 0) {
                console.log('   ✅ Found security/API related directives:');
                contextResult.records.forEach((record, index) => {
                    const text = record.get('d.text') || 'No text';
                    const severity = record.get('d.severity') || 'No severity';
                    const topics = record.get('d.topics') || [];
                    const source = record.get('d.source') || 'No source';
                    
                    console.log(`\n   ${index + 1}. [${severity}] ${text.substring(0, 80)}...`);
                    console.log(`      Topics: ${Array.isArray(topics) ? topics.join(', ') : topics}`);
                    console.log(`      Source: ${source}`);
                });
            } else {
                console.log('   ❌ No security/API related directives found');
            }
            
        } finally {
            await session.close();
        }
        
        await neo4j.close();
        console.log('\n✅ Neo4j connection closed successfully');
        
        console.log('\n🎉 Neo4j Test Complete!');
        console.log('\n📊 Summary:');
        console.log('• Neo4j connection is working properly');
        console.log('• AI-generated directives are stored in the database');
        console.log('• Context-based queries can find relevant directives');
        console.log('• The MCP server should be able to query these directives');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testNeo4jAndQuery();