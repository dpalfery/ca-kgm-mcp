# Persistence Layer Data Access and Storage Rules

## Metadata
- **Layer**: 4-Persistence
- **AuthoritativeFor**: [database-design, data-access, transactions, performance, security]
- **Topics**: [SQL, NoSQL, repositories, migrations, indexing, transactions, connection-pooling, ORM]

## When to Apply
- Implementing data access layers and repositories
- Designing database schemas and migrations
- Optimizing database queries and performance
- Managing database connections and transactions
- Implementing data security and access controls

## Directives

### Repository Pattern and Data Access

**MUST** Implement repository pattern to abstract database access from domain logic.

**Rationale**: Repository pattern provides a clean separation between domain logic and data access, making the code more testable and allowing for easier database technology changes.

**Example**:
```typescript
// Domain repository interface (in domain layer)
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  findActiveUsers(limit: number, offset: number): Promise<User[]>;
}

// Implementation (in persistence layer)
export class SqlUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async findById(id: UserId): Promise<User | null> {
    const query = `
      SELECT id, email, name, created_at, updated_at, status
      FROM users 
      WHERE id = ? AND deleted_at IS NULL
    `;
    
    const row = await this.db.get(query, [id.value]);
    return row ? this.mapRowToUser(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const query = `
      SELECT id, email, name, created_at, updated_at, status
      FROM users 
      WHERE email = ? AND deleted_at IS NULL
    `;
    
    const row = await this.db.get(query, [email.value]);
    return row ? this.mapRowToUser(row) : null;
  }

  async save(user: User): Promise<void> {
    const existingUser = await this.findById(user.id);
    
    if (existingUser) {
      await this.update(user);
    } else {
      await this.insert(user);
    }
  }

  private async insert(user: User): Promise<void> {
    const query = `
      INSERT INTO users (id, email, name, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      user.id.value,
      user.email.value,
      user.name,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString(),
      user.status
    ]);
  }

  private async update(user: User): Promise<void> {
    const query = `
      UPDATE users 
      SET email = ?, name = ?, updated_at = ?, status = ?
      WHERE id = ? AND deleted_at IS NULL
    `;
    
    await this.db.run(query, [
      user.email.value,
      user.name,
      user.updatedAt.toISOString(),
      user.status,
      user.id.value
    ]);
  }

  async delete(id: UserId): Promise<void> {
    // Soft delete
    const query = `
      UPDATE users 
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `;
    
    const now = new Date().toISOString();
    await this.db.run(query, [now, now, id.value]);
  }

  private mapRowToUser(row: any): User {
    return User.reconstitute(
      new UserId(row.id),
      new Email(row.email),
      row.name,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.status
    );
  }
}
```

**Anti-pattern**:
```typescript
// NEVER do this - domain logic mixed with data access
export class UserService {
  constructor(private db: Database) {}

  async createUser(userData: any) {
    // Business logic mixed with SQL
    if (!userData.email.includes('@')) {
      throw new Error('Invalid email');
    }

    const query = `INSERT INTO users (email, name) VALUES (?, ?)`;
    await this.db.run(query, [userData.email, userData.name]);
  }
}
```

**MUST** Use parameterized queries to prevent SQL injection attacks.

**Rationale**: SQL injection is one of the most common and dangerous security vulnerabilities. Parameterized queries ensure user input cannot be interpreted as SQL code.

**Example**:
```typescript
export class SecureUserRepository {
  constructor(private db: Database) {}

  // Correct: Using parameterized queries
  async findUsersByRole(role: string, limit: number): Promise<User[]> {
    const query = `
      SELECT u.id, u.email, u.name, u.created_at
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = ? AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT ?
    `;
    
    const rows = await this.db.all(query, [role, limit]);
    return rows.map(row => this.mapRowToUser(row));
  }

  // Correct: Using named parameters
  async searchUsers(criteria: UserSearchCriteria): Promise<User[]> {
    let query = `
      SELECT id, email, name, created_at, status
      FROM users
      WHERE deleted_at IS NULL
    `;
    
    const params: any = {};
    const conditions: string[] = [];

    if (criteria.email) {
      conditions.push('email LIKE :email');
      params.email = `%${criteria.email}%`;
    }

    if (criteria.name) {
      conditions.push('name LIKE :name');
      params.name = `%${criteria.name}%`;
    }

    if (criteria.status) {
      conditions.push('status = :status');
      params.status = criteria.status;
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';
    params.limit = criteria.limit || 50;
    params.offset = criteria.offset || 0;

    const rows = await this.db.all(query, params);
    return rows.map(row => this.mapRowToUser(row));
  }
}
```

**Anti-pattern**:
```typescript
// NEVER do this - vulnerable to SQL injection
async findUserByEmail(email: string): Promise<User | null> {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  const row = await this.db.get(query); // Dangerous!
  return row ? this.mapRowToUser(row) : null;
}
```

### Transaction Management

**MUST** Use database transactions for operations that modify multiple related entities.

**Rationale**: Transactions ensure data consistency by making multiple operations atomic - either all succeed or all fail, preventing partial updates that could leave data in an inconsistent state.

**Example**:
```typescript
export class OrderRepository {
  constructor(private db: Database) {}

  async createOrderWithItems(order: Order): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Insert order
      await tx.run(`
        INSERT INTO orders (id, customer_id, status, total_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        order.id.value,
        order.customerId.value,
        order.status,
        order.total.amount,
        order.createdAt.toISOString()
      ]);

      // Insert order items
      for (const item of order.items) {
        await tx.run(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price)
          VALUES (?, ?, ?, ?)
        `, [
          order.id.value,
          item.productId.value,
          item.quantity,
          item.unitPrice.amount
        ]);

        // Update product inventory
        await tx.run(`
          UPDATE products 
          SET stock_quantity = stock_quantity - ?
          WHERE id = ? AND stock_quantity >= ?
        `, [item.quantity, item.productId.value, item.quantity]);

        // Verify inventory was updated (optimistic locking)
        const result = await tx.get(`
          SELECT stock_quantity FROM products WHERE id = ?
        `, [item.productId.value]);

        if (!result) {
          throw new Error(`Product ${item.productId.value} not found`);
        }
      }
    });
  }

  async transferFunds(fromAccountId: string, toAccountId: string, amount: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Lock accounts for update to prevent race conditions
      const fromAccount = await tx.get(`
        SELECT id, balance FROM accounts 
        WHERE id = ? FOR UPDATE
      `, [fromAccountId]);

      const toAccount = await tx.get(`
        SELECT id, balance FROM accounts 
        WHERE id = ? FOR UPDATE
      `, [toAccountId]);

      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient funds');
      }

      // Update balances
      await tx.run(`
        UPDATE accounts SET balance = balance - ? WHERE id = ?
      `, [amount, fromAccountId]);

      await tx.run(`
        UPDATE accounts SET balance = balance + ? WHERE id = ?
      `, [amount, toAccountId]);

      // Record transaction history
      await tx.run(`
        INSERT INTO transactions (id, from_account_id, to_account_id, amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [crypto.randomUUID(), fromAccountId, toAccountId, amount, new Date().toISOString()]);
    });
  }
}
```

**SHOULD** Implement proper connection pooling for database connections.

**Rationale**: Connection pooling improves performance by reusing database connections and prevents resource exhaustion under high load.

**Example**:
```typescript
import { Pool } from 'pg';

export class DatabaseConnectionManager {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      
      // Connection pool settings
      min: 2,                    // Minimum connections
      max: 20,                   // Maximum connections
      idleTimeoutMillis: 30000,  // Close idle connections after 30s
      connectionTimeoutMillis: 2000, // Timeout when getting connection
      
      // Health check
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Handle pool events
    this.pool.on('connect', (client) => {
      console.log('New database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release(); // Return connection to pool
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rows.length === 1;
    } catch (error) {
      return false;
    }
  }
}
```

### Database Schema and Migrations

**MUST** Use database migrations for all schema changes.

**Rationale**: Migrations provide version control for database schema, enable reproducible deployments, and allow rollback of problematic changes.

**Example**:
```typescript
// Migration: 001_create_users_table.ts
export class CreateUsersTable {
  async up(db: Database): Promise<void> {
    await db.exec(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE NULL,
        
        CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
        CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
      );
    `);

    await db.exec(`
      CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
    `);

    await db.exec(`
      CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
    `);

    await db.exec(`
      CREATE INDEX idx_users_created_at ON users(created_at);
    `);
  }

  async down(db: Database): Promise<void> {
    await db.exec('DROP TABLE IF EXISTS users CASCADE;');
  }
}

// Migration: 002_add_user_roles.ts
export class AddUserRoles {
  async up(db: Database): Promise<void> {
    await db.exec(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.exec(`
      CREATE TABLE user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        assigned_by UUID REFERENCES users(id),
        
        PRIMARY KEY (user_id, role_id)
      );
    `);

    // Insert default roles
    await db.exec(`
      INSERT INTO roles (name, description, permissions) VALUES
      ('admin', 'System Administrator', '["users:read", "users:write", "users:delete", "roles:read", "roles:write"]'),
      ('user', 'Regular User', '["profile:read", "profile:write"]'),
      ('moderator', 'Content Moderator', '["content:read", "content:moderate", "users:read"]');
    `);
  }

  async down(db: Database): Promise<void> {
    await db.exec('DROP TABLE IF EXISTS user_roles CASCADE;');
    await db.exec('DROP TABLE IF EXISTS roles CASCADE;');
  }
}

// Migration runner
export class MigrationRunner {
  constructor(private db: Database) {}

  async runMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    const migrations = [
      new CreateUsersTable(),
      new AddUserRoles(),
      // Add more migrations here
    ];

    for (const migration of migrations) {
      const migrationName = migration.constructor.name;
      
      // Check if migration already executed
      const result = await this.db.get(
        'SELECT name FROM migrations WHERE name = ?',
        [migrationName]
      );

      if (!result) {
        console.log(`Running migration: ${migrationName}`);
        
        await this.db.transaction(async (tx) => {
          await migration.up(tx);
          await tx.run(
            'INSERT INTO migrations (name) VALUES (?)',
            [migrationName]
          );
        });
        
        console.log(`Migration completed: ${migrationName}`);
      }
    }
  }
}
```

### Performance Optimization

**MUST** Create appropriate database indexes for frequently queried columns.

**Rationale**: Proper indexing dramatically improves query performance and is essential for application scalability.

**Example**:
```typescript
// Index creation in migrations
export class AddPerformanceIndexes {
  async up(db: Database): Promise<void> {
    // Single column indexes
    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_orders_customer_id 
      ON orders(customer_id) 
      WHERE deleted_at IS NULL;
    `);

    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_orders_status 
      ON orders(status) 
      WHERE deleted_at IS NULL;
    `);

    // Composite indexes for common query patterns
    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_orders_customer_status_created 
      ON orders(customer_id, status, created_at DESC) 
      WHERE deleted_at IS NULL;
    `);

    // Partial indexes for specific conditions
    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_orders_pending 
      ON orders(created_at DESC) 
      WHERE status = 'PENDING' AND deleted_at IS NULL;
    `);

    // Full-text search index
    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_products_search 
      ON products USING gin(to_tsvector('english', name || ' ' || description))
      WHERE deleted_at IS NULL;
    `);

    // JSON field indexes
    await db.exec(`
      CREATE INDEX CONCURRENTLY idx_user_preferences_notifications 
      ON users USING gin((preferences->'notifications'))
      WHERE deleted_at IS NULL;
    `);
  }

  async down(db: Database): Promise<void> {
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_id;');
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_status;');
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_status_created;');
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_pending;');
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_products_search;');
    await db.exec('DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_notifications;');
  }
}

// Repository with optimized queries
export class OptimizedOrderRepository {
  constructor(private db: Database) {}

  // Optimized query using composite index
  async findCustomerOrders(
    customerId: string, 
    status?: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<Order[]> {
    let query = `
      SELECT o.id, o.customer_id, o.status, o.total_amount, o.created_at,
             array_agg(
               json_build_object(
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ? AND o.deleted_at IS NULL
    `;

    const params: any[] = [customerId];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += `
      GROUP BY o.id, o.customer_id, o.status, o.total_amount, o.created_at
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const rows = await this.db.all(query, params);
    return rows.map(row => this.mapRowToOrder(row));
  }

  // Full-text search using GIN index
  async searchProducts(searchTerm: string, limit: number = 20): Promise<Product[]> {
    const query = `
      SELECT id, name, description, price, stock_quantity,
             ts_rank(to_tsvector('english', name || ' ' || description), 
                     plainto_tsquery('english', ?)) as rank
      FROM products
      WHERE to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', ?)
        AND deleted_at IS NULL
        AND stock_quantity > 0
      ORDER BY rank DESC, name
      LIMIT ?
    `;

    const rows = await this.db.all(query, [searchTerm, searchTerm, limit]);
    return rows.map(row => this.mapRowToProduct(row));
  }
}
```

**SHOULD** Implement query result caching for expensive or frequently accessed data.

**Rationale**: Caching reduces database load and improves response times for read-heavy operations.

**Example**:
```typescript
import Redis from 'ioredis';

export class CachedUserRepository implements UserRepository {
  private cache: Redis;
  private baseRepository: UserRepository;
  private readonly USER_CACHE_TTL = 3600; // 1 hour

  constructor(baseRepository: UserRepository, redisUrl: string) {
    this.baseRepository = baseRepository;
    this.cache = new Redis(redisUrl);
  }

  async findById(id: UserId): Promise<User | null> {
    const cacheKey = `user:${id.value}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return this.deserializeUser(JSON.parse(cached));
    }

    // Fetch from database
    const user = await this.baseRepository.findById(id);
    if (user) {
      // Cache the result
      await this.cache.setex(
        cacheKey, 
        this.USER_CACHE_TTL, 
        JSON.stringify(this.serializeUser(user))
      );
    }

    return user;
  }

  async save(user: User): Promise<void> {
    // Save to database
    await this.baseRepository.save(user);
    
    // Update cache
    const cacheKey = `user:${user.id.value}`;
    await this.cache.setex(
      cacheKey,
      this.USER_CACHE_TTL,
      JSON.stringify(this.serializeUser(user))
    );

    // Invalidate related caches
    await this.invalidateUserCaches(user);
  }

  async delete(id: UserId): Promise<void> {
    // Delete from database
    await this.baseRepository.delete(id);
    
    // Remove from cache
    const cacheKey = `user:${id.value}`;
    await this.cache.del(cacheKey);
  }

  private async invalidateUserCaches(user: User): Promise<void> {
    // Invalidate email-based cache
    await this.cache.del(`user:email:${user.email.value}`);
    
    // Invalidate any list caches that might include this user
    const pattern = 'users:list:*';
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }

  private serializeUser(user: User): any {
    return {
      id: user.id.value,
      email: user.email.value,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private deserializeUser(data: any): User {
    return User.reconstitute(
      new UserId(data.id),
      new Email(data.email),
      data.name,
      new Date(data.createdAt),
      new Date(data.updatedAt),
      data.status
    );
  }
}
```

**MAY** Use read replicas for read-heavy workloads.

**Rationale**: Read replicas can improve performance by distributing read queries across multiple database instances.

**Example**:
```typescript
export class ReadWriteRepository {
  constructor(
    private writeDb: Database,
    private readDb: Database
  ) {}

  // Write operations go to primary database
  async save(entity: any): Promise<void> {
    await this.writeDb.run(/* insert/update query */, []);
  }

  async delete(id: string): Promise<void> {
    await this.writeDb.run(/* delete query */, [id]);
  }

  // Read operations can use read replica
  async findById(id: string): Promise<any> {
    return await this.readDb.get(/* select query */, [id]);
  }

  async findAll(limit: number, offset: number): Promise<any[]> {
    return await this.readDb.all(/* select query */, [limit, offset]);
  }

  // For consistency-critical reads, use primary database
  async findByIdConsistent(id: string): Promise<any> {
    return await this.writeDb.get(/* select query */, [id]);
  }
}
```