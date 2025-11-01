const neo4j = require('neo4j-driver');

async function getActualStats() {
    const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password'));
    const session = driver.session();
    
    try {
        console.log('🔍 Querying Neo4j for ACTUAL database statistics...\n');
        
        // Get total node count
        const nodeResult = await session.run('MATCH (n) RETURN count(n) as totalNodes');
        const totalNodes = nodeResult.records[0].get('totalNodes').toNumber();
        
        // Get total relationship count  
        const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as totalRelationships');
        const totalRelationships = relResult.records[0].get('totalRelationships').toNumber();
        
        console.log('📊 ACTUAL Database Statistics:');
        console.log(`   Total Nodes: ${totalNodes}`);
        console.log(`   Total Relationships: ${totalRelationships}`);
        
        // Get node labels breakdown
        const labelsResult = await session.run('MATCH (n) RETURN labels(n) as labels, count(n) as count ORDER BY count DESC');
        console.log('\n🏷️  Node Labels:');
        labelsResult.records.forEach(record => {
            const labels = record.get('labels');
            const count = record.get('count').toNumber();
            console.log(`   ${labels.join(', ')}: ${count} nodes`);
        });
        
        // Get entity types for Entity nodes
        const entityTypesResult = await session.run('MATCH (e:Entity) RETURN e.entityType as entityType, count(e) as count ORDER BY count DESC');
        console.log('\n🤖 Entity Types (within Entity nodes):');
        entityTypesResult.records.forEach(record => {
            const entityType = record.get('entityType') || 'Unknown';
            const count = record.get('count').toNumber();
            console.log(`   ${entityType}: ${count} entities`);
        });
        
        // Get relationship types
        const relTypesResult = await session.run('MATCH ()-[r]->() RETURN type(r) as relType, count(r) as count ORDER BY count DESC');
        console.log('\n🔗 Relationship Types:');
        relTypesResult.records.forEach(record => {
            const relType = record.get('relType');
            const count = record.get('count').toNumber();
            console.log(`   ${relType}: ${count} relationships`);
        });
        
    } catch (error) {
        console.error('❌ Error querying database:', error.message);
    } finally {
        await session.close();
        await driver.close();
        console.log('\n✅ Database query complete');
    }
}

getActualStats().catch(console.error);