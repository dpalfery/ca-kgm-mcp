import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock neo4j-driver
vi.mock('neo4j-driver', () => {
  class FakeRecord {
    constructor(private values: Record<string, any> = {}) {}
    get(key: string) {
      const val = this.values[key];
      // Support toNumber() method for neo4j-driver compatibility
      if (typeof val === 'number') {
        return { toNumber: () => val };
      }
      return val;
    }
  }

  class FakeResult {
    constructor(private data: FakeRecord[] = []) {}
    get records() {
      return this.data;
    }
  }

  class FakeSession {
    async run(query: string, params?: any): Promise<FakeResult> {
      // Mock implementation - return appropriate fake results
      if (query.includes('UNWIND $entities')) {
        // Entity creation - return records with names
        const entities = params?.entities || [];
        return new FakeResult(
          entities.map((e: any) => new FakeRecord({ name: e.name, createdAt: new Date(), updatedAt: new Date() }))
        );
      }
      if (query.includes('UNWIND $relations')) {
        // Relations - return count
        return new FakeResult([new FakeRecord({ created: 1 })]);
      }
      // Default empty result
      return new FakeResult([]);
    }
    async close(): Promise<void> {}
  }

  class FakeDriver {
    async verifyConnectivity(): Promise<void> {}
    session(): FakeSession {
      return new FakeSession();
    }
    async close(): Promise<void> {}
  }

  return {
    default: {
      driver: () => new FakeDriver(),
      auth: {
        basic: () => ({})
      }
    }
  };
});

import { MemoryManager } from './memory-manager';
import { Neo4jConfig } from '../config/neo4j-types';

describe('MemoryManager (Neo4j - Mocked)', () => {
  let mm: MemoryManager;
  let testConfig: Neo4jConfig;

  beforeEach(() => {
    testConfig = {
      uri: 'neo4j://localhost:7687',
      username: 'neo4j',
      password: 'testpassword',
      database: 'test',
      encrypted: false,
      maxConnectionPoolSize: 10,
      connectionTimeout: 5000
    };
    
    mm = new MemoryManager(testConfig);
  });

  afterEach(async () => {
    await mm.close();
  });

  it('initializes without throwing', async () => {
    await expect(mm.initialize()).resolves.not.toThrow();
  });

  it('can create entities and returns structure', async () => {
    await mm.initialize();
    
    const result = await mm.handleTool('memory.create_entities', {
      entities: [
        { name: 'Alice', entityType: 'person', observations: ['obs1'] },
        { name: 'Bob', entityType: 'person' }
      ]
    });

    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('entities');
    expect(Array.isArray(result.entities)).toBe(true);
  });

  it('can create relations and returns counts', async () => {
    await mm.initialize();
    
    const result = await mm.handleTool('memory.create_relations', {
      relations: [
        { from: 'Alice', to: 'Bob', relationType: 'knows' }
      ]
    });

    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('total');
  });

  it('search returns nodes array', async () => {
    await mm.initialize();
    
    const result = await mm.handleTool('memory.search_nodes', { 
      query: 'Alice', 
      limit: 5 
    });
    
    expect(result).toHaveProperty('nodes');
    expect(Array.isArray(result.nodes)).toBe(true);
  });

  it('read graph returns entities and relations', async () => {
    await mm.initialize();
    
    const result = await mm.handleTool('memory.read_graph', {});
    
    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('relations');
    expect(Array.isArray(result.entities)).toBe(true);
    expect(Array.isArray(result.relations)).toBe(true);
  });
});

