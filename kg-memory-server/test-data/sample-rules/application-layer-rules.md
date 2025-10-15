# Application Layer Business Logic and API Rules

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [business-logic, API-design, validation, error-handling, authentication]
- **Topics**: [REST, GraphQL, services, controllers, middleware, validation, rate-limiting, caching]

## When to Apply
- Implementing business logic and use cases
- Creating API endpoints and controllers
- Building service layer components
- Handling authentication and authorization
- Implementing data validation and transformation

## Directives

### API Design and Security

**MUST** Implement proper input validation for all API endpoints.

**Rationale**: Input validation prevents injection attacks, data corruption, and ensures business rule compliance at the application boundary.

**Example**:
```typescript
// Using Zod for schema validation
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: z.string().min(1).max(100).trim(),
  age: z.number().int().min(13).max(120).optional()
});

export async function createUser(req: Request, res: Response) {
  try {
    // Validate input
    const validatedData = CreateUserSchema.parse(req.body);
    
    // Business logic
    const user = await userService.createUser(validatedData);
    
    res.status(201).json({ 
      id: user.id, 
      email: user.email, 
      name: user.name 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    throw error;
  }
}
```

**Anti-pattern**:
```typescript
// NEVER do this - no validation
export async function createUser(req: Request, res: Response) {
  const user = await userService.createUser(req.body); // Dangerous!
  res.json(user);
}
```

**MUST** Implement rate limiting for all public API endpoints.

**Rationale**: Prevents abuse, DoS attacks, and ensures fair resource usage among clients.

**Example**:
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

// Apply to routes
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

**MUST** Use proper HTTP status codes and consistent error response format.

**Rationale**: Enables proper client-side error handling and follows REST conventions for better API usability.

**Example**:
```typescript
interface ApiError {
  error: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
}

class ApiErrorHandler {
  static handle(error: Error, req: Request, res: Response) {
    const timestamp = new Date().toISOString();
    const path = req.path;

    if (error instanceof ValidationError) {
      const apiError: ApiError = {
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.details,
        timestamp,
        path
      };
      return res.status(400).json(apiError);
    }

    if (error instanceof NotFoundError) {
      const apiError: ApiError = {
        error: 'NOT_FOUND',
        message: error.message,
        timestamp,
        path
      };
      return res.status(404).json(apiError);
    }

    if (error instanceof UnauthorizedError) {
      const apiError: ApiError = {
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp,
        path
      };
      return res.status(401).json(apiError);
    }

    // Internal server error
    console.error('Unhandled error:', error);
    const apiError: ApiError = {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp,
      path
    };
    res.status(500).json(apiError);
  }
}
```

### Business Logic Implementation

**MUST** Implement business logic in service classes, not in controllers.

**Rationale**: Separates concerns, makes business logic testable and reusable across different interfaces (REST, GraphQL, CLI, etc.).

**Example**:
```typescript
// Service layer - contains business logic
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private auditLogger: AuditLogger
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    // Business rule: Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new BusinessRuleError('User with this email already exists');
    }

    // Business rule: Validate age for certain features
    if (userData.age && userData.age < 18) {
      userData.requiresParentalConsent = true;
    }

    // Create user
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = await this.userRepository.create({
      ...userData,
      password: hashedPassword,
      createdAt: new Date(),
      status: 'PENDING_VERIFICATION'
    });

    // Business process: Send verification email
    await this.emailService.sendVerificationEmail(user.email, user.verificationToken);

    // Audit logging
    await this.auditLogger.log('USER_CREATED', { userId: user.id });

    return user;
  }
}

// Controller - thin layer that delegates to service
export class UserController {
  constructor(private userService: UserService) {}

  async createUser(req: Request, res: Response) {
    const validatedData = CreateUserSchema.parse(req.body);
    const user = await this.userService.createUser(validatedData);
    
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status
    });
  }
}
```

**SHOULD** Use dependency injection for service dependencies.

**Rationale**: Improves testability, maintainability, and follows SOLID principles.

**Example**:
```typescript
// Using a simple DI container
class Container {
  private services = new Map();

  register<T>(token: string, factory: () => T): void {
    this.services.set(token, factory);
  }

  resolve<T>(token: string): T {
    const factory = this.services.get(token);
    if (!factory) {
      throw new Error(`Service ${token} not registered`);
    }
    return factory();
  }
}

// Register services
const container = new Container();

container.register('UserRepository', () => new UserRepository(database));
container.register('EmailService', () => new EmailService(emailConfig));
container.register('AuditLogger', () => new AuditLogger(loggerConfig));

container.register('UserService', () => new UserService(
  container.resolve('UserRepository'),
  container.resolve('EmailService'),
  container.resolve('AuditLogger')
));

// Use in controllers
export function createUserController() {
  const userService = container.resolve<UserService>('UserService');
  return new UserController(userService);
}
```

### Authentication and Authorization

**MUST** Implement proper JWT token validation and refresh mechanisms.

**Rationale**: Ensures secure authentication while providing good user experience through token refresh.

**Example**:
```typescript
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

export class AuthService {
  private readonly accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
  private readonly refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  generateTokens(user: User): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });

    const refreshToken = jwt.sign(
      { userId: user.id }, 
      this.refreshTokenSecret, 
      { expiresIn: this.refreshTokenExpiry }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token expired');
      }
      throw new UnauthorizedError('Invalid access token');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const payload = jwt.verify(refreshToken, this.refreshTokenSecret) as { userId: string };
      
      // Verify refresh token is still valid in database
      const storedToken = await this.tokenRepository.findRefreshToken(refreshToken);
      if (!storedToken || storedToken.revoked) {
        throw new UnauthorizedError('Refresh token revoked');
      }

      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const { accessToken } = this.generateTokens(user);
      return accessToken;
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }
}

// Middleware for protecting routes
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
```

**SHOULD** Implement role-based access control (RBAC) for authorization.

**Rationale**: Provides fine-grained access control and follows the principle of least privilege.

**Example**:
```typescript
interface Permission {
  resource: string;
  action: string;
}

interface Role {
  name: string;
  permissions: Permission[];
}

export class AuthorizationService {
  private rolePermissions = new Map<string, Permission[]>();

  constructor() {
    // Define role permissions
    this.rolePermissions.set('admin', [
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'update' },
      { resource: 'users', action: 'delete' },
      { resource: 'reports', action: 'read' }
    ]);

    this.rolePermissions.set('user', [
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'update' } // own profile only
    ]);
  }

  hasPermission(userRoles: string[], resource: string, action: string): boolean {
    return userRoles.some(role => {
      const permissions = this.rolePermissions.get(role) || [];
      return permissions.some(p => p.resource === resource && p.action === action);
    });
  }

  canAccessResource(user: JwtPayload, resource: string, resourceId?: string): boolean {
    // Check if user can access their own resources
    if (resource === 'users' && resourceId === user.userId) {
      return true;
    }

    // Check role-based permissions
    return this.hasPermission(user.roles, resource, 'read');
  }
}

// Authorization middleware
export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload;
    
    if (!authorizationService.hasPermission(user.roles, resource, action)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: { resource, action }
      });
    }

    next();
  };
}

// Usage
app.get('/api/users', 
  requireAuth, 
  requirePermission('users', 'read'), 
  userController.getUsers
);
```

### Caching and Performance

**SHOULD** Implement caching for frequently accessed data.

**Rationale**: Reduces database load and improves response times for read-heavy operations.

**Example**:
```typescript
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Service with caching
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private cacheService: CacheService
  ) {}

  async getUserById(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    
    // Try cache first
    let user = await this.cacheService.get<User>(cacheKey);
    if (user) {
      return user;
    }

    // Fetch from database
    user = await this.userRepository.findById(id);
    if (user) {
      // Cache for 1 hour
      await this.cacheService.set(cacheKey, user, 3600);
    }

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = await this.userRepository.update(id, updates);
    
    // Invalidate cache
    await this.cacheService.del(`user:${id}`);
    
    return user;
  }
}
```

**MAY** Implement request/response compression for large payloads.

**Rationale**: Reduces bandwidth usage and improves performance, especially for mobile clients.

**Example**:
```typescript
import compression from 'compression';

// Enable compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6 // Compression level (1-9, 6 is good balance)
}));

// Custom compression for specific endpoints
export function compressLargeResponses(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    const jsonString = JSON.stringify(data);
    
    // Compress large responses
    if (jsonString.length > 10000) { // 10KB threshold
      res.setHeader('Content-Encoding', 'gzip');
      return originalJson.call(this, data);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}
```