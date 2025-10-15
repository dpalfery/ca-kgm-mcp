# Infrastructure Layer Deployment and Operations Rules

## Metadata
- **Layer**: 5-Infrastructure
- **AuthoritativeFor**: [deployment, monitoring, security, scalability, reliability]
- **Topics**: [Docker, Kubernetes, CI/CD, logging, metrics, alerts, backup, disaster-recovery]

## When to Apply
- Setting up deployment pipelines and infrastructure
- Implementing monitoring and observability
- Configuring security and access controls
- Managing scalability and performance
- Planning disaster recovery and backup strategies

## Directives

### Containerization and Deployment

**MUST** Use multi-stage Docker builds to minimize image size and attack surface.

**Rationale**: Multi-stage builds reduce final image size, exclude development dependencies from production, and improve security by minimizing the attack surface.

**Example**:
```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy only production files
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Security: Run as non-root user
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

**MUST** Implement proper health checks for all services.

**Rationale**: Health checks enable orchestrators to detect and replace unhealthy instances, improving system reliability and availability.

**Example**:
```typescript
// Health check endpoint implementation
export class HealthCheckController {
  constructor(
    private database: Database,
    private redis: Redis,
    private externalServices: ExternalServiceChecker
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
      this.checkDiskSpace(),
      this.checkMemoryUsage()
    ]);

    const results = checks.map((check, index) => ({
      name: ['database', 'redis', 'external-services', 'disk-space', 'memory'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: check.status === 'fulfilled' ? check.value : check.reason?.message
    }));

    const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || 'unknown'
    };
  }

  private async checkDatabase(): Promise<string> {
    try {
      await this.database.query('SELECT 1');
      return 'Database connection successful';
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
  }

  private async checkRedis(): Promise<string> {
    try {
      await this.redis.ping();
      return 'Redis connection successful';
    } catch (error) {
      throw new Error(`Redis check failed: ${error.message}`);
    }
  }
}

// Kubernetes health check configuration
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: my-app
  ports:
  - port: 3000
    targetPort: 3000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: my-app:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```### 
Monitoring and Observability

**MUST** Implement structured logging with correlation IDs for request tracing.

**Rationale**: Structured logging enables efficient log analysis and correlation IDs allow tracing requests across distributed services for debugging and monitoring.

**Example**:
```typescript
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Structured logger configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'unknown',
    version: process.env.APP_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Correlation ID middleware
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  
  // Add correlation ID to all logs in this request context
  req.logger = logger.child({ correlationId, requestId: uuidv4() });
  
  next();
}

// Usage in controllers
export class UserController {
  async createUser(req: Request, res: Response) {
    const { logger } = req;
    
    logger.info('Creating new user', {
      operation: 'createUser',
      userEmail: req.body.email,
      userAgent: req.headers['user-agent']
    });

    try {
      const user = await this.userService.createUser(req.body);
      
      logger.info('User created successfully', {
        operation: 'createUser',
        userId: user.id,
        userEmail: user.email,
        duration: Date.now() - req.startTime
      });

      res.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to create user', {
        operation: 'createUser',
        error: error.message,
        stack: error.stack,
        userEmail: req.body.email,
        duration: Date.now() - req.startTime
      });

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

**MUST** Implement application metrics and alerts for critical business operations.

**Rationale**: Metrics provide visibility into system performance and business operations, while alerts enable proactive response to issues.

**Example**:
```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
export const metrics = {
  httpRequestsTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),

  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  }),

  activeConnections: new Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
  }),

  businessMetrics: {
    usersCreated: new Counter({
      name: 'users_created_total',
      help: 'Total number of users created'
    }),

    ordersProcessed: new Counter({
      name: 'orders_processed_total',
      help: 'Total number of orders processed',
      labelNames: ['status']
    }),

    paymentAmount: new Histogram({
      name: 'payment_amount_dollars',
      help: 'Payment amounts in dollars',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
    })
  }
};

// Metrics middleware
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  metrics.activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    metrics.httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .inc();
    
    metrics.httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
    
    metrics.activeConnections.dec();
  });

  next();
}

// Business metrics in services
export class OrderService {
  async processOrder(order: Order): Promise<void> {
    try {
      await this.validateOrder(order);
      await this.processPayment(order);
      await this.fulfillOrder(order);

      // Record successful order
      metrics.businessMetrics.ordersProcessed
        .labels('success')
        .inc();

      metrics.businessMetrics.paymentAmount
        .observe(order.total.amount);

    } catch (error) {
      // Record failed order
      metrics.businessMetrics.ordersProcessed
        .labels('failed')
        .inc();
      
      throw error;
    }
  }
}

// Prometheus endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### Security and Access Control

**MUST** Implement proper secrets management and never store secrets in code or environment variables.

**Rationale**: Proper secrets management prevents credential exposure and enables secure rotation of sensitive information.

**Example**:
```typescript
// Using AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class SecretsManager {
  private client: SecretsManagerClient;
  private cache = new Map<string, { value: any; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async getSecret(secretName: string): Promise<any> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);
      
      const secret = JSON.parse(response.SecretString || '{}');
      
      // Cache the secret
      this.cache.set(secretName, {
        value: secret,
        expiry: Date.now() + this.CACHE_TTL
      });

      return secret;
    } catch (error) {
      throw new Error(`Failed to retrieve secret ${secretName}: ${error.message}`);
    }
  }

  async getDatabaseCredentials(): Promise<DatabaseConfig> {
    const secrets = await this.getSecret('prod/database/credentials');
    return {
      host: secrets.host,
      port: secrets.port,
      database: secrets.database,
      username: secrets.username,
      password: secrets.password
    };
  }

  async getApiKeys(): Promise<ApiKeys> {
    const secrets = await this.getSecret('prod/api/keys');
    return {
      openaiApiKey: secrets.openai_api_key,
      stripeApiKey: secrets.stripe_api_key,
      jwtSecret: secrets.jwt_secret
    };
  }
}

// Kubernetes secrets configuration
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  database-password: <base64-encoded-password>
  jwt-secret: <base64-encoded-secret>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  template:
    spec:
      containers:
      - name: app
        image: my-app:latest
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
```

**SHOULD** Implement network security policies and service mesh for microservices.

**Rationale**: Network policies provide defense in depth by controlling traffic flow between services, reducing the blast radius of security breaches.

**Example**:
```yaml
# Kubernetes Network Policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  # Allow DNS resolution
  - to: []
    ports:
    - protocol: UDP
      port: 53

---
# Istio Service Mesh Security Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-authz
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-server
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/production/sa/frontend"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
  - when:
    - key: request.headers[authorization]
      values: ["Bearer *"]
```

### Backup and Disaster Recovery

**MUST** Implement automated backups with tested restore procedures.

**Rationale**: Regular backups protect against data loss, and tested restore procedures ensure backups are actually usable in disaster scenarios.

**Example**:
```typescript
// Automated backup service
export class BackupService {
  constructor(
    private database: Database,
    private s3Client: S3Client,
    private logger: Logger
  ) {}

  async performDatabaseBackup(): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.info('Starting database backup', { backupId });

      // Create database dump
      const dumpCommand = `pg_dump ${process.env.DATABASE_URL} --format=custom --compress=9`;
      const dumpFile = `/tmp/${backupId}.dump`;
      
      await this.executeCommand(`${dumpCommand} > ${dumpFile}`);

      // Upload to S3
      const s3Key = `backups/database/${timestamp}/${backupId}.dump`;
      await this.uploadToS3(dumpFile, s3Key);

      // Verify backup integrity
      await this.verifyBackup(s3Key);

      // Clean up local file
      await this.executeCommand(`rm ${dumpFile}`);

      const result: BackupResult = {
        backupId,
        timestamp,
        s3Key,
        status: 'success',
        size: await this.getS3ObjectSize(s3Key)
      };

      this.logger.info('Database backup completed successfully', result);
      return result;

    } catch (error) {
      this.logger.error('Database backup failed', {
        backupId,
        error: error.message
      });
      throw error;
    }
  }

  async restoreFromBackup(backupId: string): Promise<void> {
    this.logger.info('Starting database restore', { backupId });

    try {
      // Download backup from S3
      const s3Key = await this.findBackupS3Key(backupId);
      const localFile = `/tmp/restore-${backupId}.dump`;
      
      await this.downloadFromS3(s3Key, localFile);

      // Verify backup before restore
      await this.verifyLocalBackup(localFile);

      // Create restore point
      await this.performDatabaseBackup(); // Backup current state

      // Restore database
      const restoreCommand = `pg_restore --clean --if-exists --no-owner --no-privileges --dbname=${process.env.DATABASE_URL} ${localFile}`;
      await this.executeCommand(restoreCommand);

      // Verify restore
      await this.verifyDatabaseIntegrity();

      this.logger.info('Database restore completed successfully', { backupId });

    } catch (error) {
      this.logger.error('Database restore failed', {
        backupId,
        error: error.message
      });
      throw error;
    }
  }

  // Scheduled backup job
  @Cron('0 2 * * *') // Daily at 2 AM
  async scheduledBackup(): Promise<void> {
    try {
      await this.performDatabaseBackup();
      await this.cleanupOldBackups();
    } catch (error) {
      // Send alert to operations team
      await this.sendBackupFailureAlert(error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // List and delete old backups from S3
    const oldBackups = await this.listBackupsOlderThan(cutoffDate);
    
    for (const backup of oldBackups) {
      await this.s3Client.deleteObject({
        Bucket: process.env.BACKUP_BUCKET,
        Key: backup.key
      });
      
      this.logger.info('Deleted old backup', { key: backup.key });
    }
  }
}

// Disaster recovery runbook automation
export class DisasterRecoveryService {
  async executeRecoveryPlan(scenario: 'database-failure' | 'complete-outage'): Promise<void> {
    switch (scenario) {
      case 'database-failure':
        await this.recoverFromDatabaseFailure();
        break;
      case 'complete-outage':
        await this.recoverFromCompleteOutage();
        break;
    }
  }

  private async recoverFromDatabaseFailure(): Promise<void> {
    // 1. Switch to read-only mode
    await this.enableMaintenanceMode();
    
    // 2. Restore from latest backup
    const latestBackup = await this.getLatestBackup();
    await this.backupService.restoreFromBackup(latestBackup.id);
    
    // 3. Verify data integrity
    await this.verifyDataIntegrity();
    
    // 4. Resume normal operations
    await this.disableMaintenanceMode();
    
    // 5. Send recovery notification
    await this.notifyRecoveryComplete('database-failure');
  }
}
```

**MAY** Implement blue-green deployments for zero-downtime updates.

**Rationale**: Blue-green deployments enable zero-downtime deployments and provide quick rollback capabilities if issues are detected.

**Example**:
```yaml
# Blue-Green Deployment with Kubernetes
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: app-rollout
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: app-active
      previewService: app-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: app-preview
      postPromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: app-active
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: my-app:latest
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
# Analysis Template for automated promotion
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
  - name: service-name
  metrics:
  - name: success-rate
    interval: 60s
    count: 5
    successCondition: result[0] >= 0.95
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{service="{{args.service-name}}",status!~"5.."}[5m])) /
          sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```