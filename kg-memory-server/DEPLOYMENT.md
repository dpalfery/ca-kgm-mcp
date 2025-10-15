# KG Memory Server Deployment Guide

This guide covers deployment options for the Knowledge Graph Memory Server, including Docker, Kubernetes, and local development setups.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Configuration](#configuration)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **CPU**: 2+ cores recommended
- **Memory**: 4GB+ RAM recommended
- **Storage**: 10GB+ available space
- **Network**: Internet access for model providers (optional)

### Software Dependencies

- **Node.js**: 18+ (for local development)
- **Docker**: 20+ (for containerized deployment)
- **Kubernetes**: 1.24+ (for Kubernetes deployment)
- **kubectl**: Latest version (for Kubernetes management)

## Quick Start

### Local Development

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd kg-memory-server
   npm install
   ```

2. **Build and Run**
   ```bash
   npm run build
   npm start
   ```

3. **Test the Installation**
   ```bash
   npm test
   ```

### Docker Quick Start

1. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Verify Deployment**
   ```bash
   docker-compose ps
   docker-compose logs kg-memory-server
   ```

## Docker Deployment

### Building the Image

```bash
# Build production image
docker build -f Dockerfile.production -t kg-memory-server:1.0.0 .

# Or use the deployment script
./scripts/deploy.sh build
```

### Running with Docker Compose

1. **Configure Environment**
   ```bash
   # Copy and edit configuration
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

3. **View Logs**
   ```bash
   docker-compose logs -f kg-memory-server
   ```

### Docker Compose Configuration

The `docker-compose.yml` includes:

- **kg-memory-server**: Main application container
- **redis**: Optional caching layer
- **Persistent volumes**: For data storage
- **Health checks**: For monitoring
- **Resource limits**: For production stability

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_PATH` | SQLite database path | `/app/data/kg-memory.db` |
| `LOG_LEVEL` | Logging level | `info` |
| `MODEL_PROVIDER` | Default model provider | `rule-based` |
| `OPENAI_API_KEY` | OpenAI API key (optional) | - |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional) | - |

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Storage class available
- Optional: Helm 3+ for package management

### Deployment Steps

1. **Prepare Configuration**
   ```bash
   # Create namespace
   kubectl apply -f kubernetes/namespace.yaml
   
   # Configure secrets (edit with your values)
   kubectl apply -f kubernetes/secret.yaml
   ```

2. **Deploy Application**
   ```bash
   # Apply all manifests
   kubectl apply -f kubernetes/
   
   # Or use the deployment script
   ./scripts/deploy.sh deploy
   ```

3. **Verify Deployment**
   ```bash
   kubectl get pods -n kg-memory-system
   kubectl logs -f deployment/kg-memory-server -n kg-memory-system
   ```

### Kubernetes Components

The Kubernetes deployment includes:

- **Namespace**: `kg-memory-system`
- **Deployment**: 3 replicas with rolling updates
- **Service**: ClusterIP and optional LoadBalancer
- **ConfigMap**: Application configuration
- **Secret**: Sensitive configuration
- **PVC**: Persistent storage for database
- **HPA**: Horizontal Pod Autoscaler
- **RBAC**: Service account and permissions

### Scaling

```bash
# Manual scaling
kubectl scale deployment kg-memory-server --replicas=5 -n kg-memory-system

# Auto-scaling is configured via HPA:
# - CPU: 70% threshold
# - Memory: 80% threshold
# - Min replicas: 3
# - Max replicas: 10
```

### Storage Configuration

```yaml
# Adjust storage class and size in kubernetes/pvc.yaml
spec:
  storageClassName: fast-ssd  # Change to your storage class
  resources:
    requests:
      storage: 10Gi  # Adjust size as needed
```

## Configuration

### Application Configuration

Configuration is managed through:

1. **Environment Variables**: Runtime configuration
2. **ConfigMaps**: Kubernetes configuration
3. **Config Files**: Advanced settings

### Model Provider Configuration

#### Rule-Based Provider (Default)
```yaml
MODEL_PROVIDER: "rule-based"
# No additional configuration required
```

#### OpenAI Provider
```yaml
MODEL_PROVIDER: "openai"
OPENAI_API_KEY: "sk-..."
OPENAI_MODEL: "gpt-3.5-turbo"
```

#### Anthropic Provider
```yaml
MODEL_PROVIDER: "anthropic"
ANTHROPIC_API_KEY: "sk-ant-..."
ANTHROPIC_MODEL: "claude-3-sonnet-20240229"
```

#### Local Provider (Ollama)
```yaml
MODEL_PROVIDER: "ollama"
OLLAMA_BASE_URL: "http://ollama:11434"
OLLAMA_MODEL: "llama2:7b"
```

### Performance Tuning

```yaml
# In ConfigMap or environment
MAX_QUERY_RESULTS: "50"
CACHE_TTL: "3600"
QUERY_TIMEOUT: "5000"
ENABLE_CACHING: "true"
```

## Monitoring and Maintenance

### Health Checks

The application provides several health check endpoints:

- `/health`: Basic health check
- `/ready`: Readiness check
- `/metrics`: Prometheus metrics

### Monitoring Setup

1. **Prometheus Metrics**
   ```bash
   # Metrics are exposed on /metrics endpoint
   curl http://localhost:3000/metrics
   ```

2. **Kubernetes Monitoring**
   ```bash
   # Check pod status
   kubectl get pods -n kg-memory-system
   
   # View logs
   kubectl logs -f deployment/kg-memory-server -n kg-memory-system
   
   # Check HPA status
   kubectl get hpa -n kg-memory-system
   ```

### Backup and Recovery

1. **Database Backup**
   ```bash
   # For Docker deployment
   docker-compose exec kg-memory-server sqlite3 /app/data/kg-memory.db ".backup /app/data/backup.db"
   
   # For Kubernetes deployment
   kubectl exec -it deployment/kg-memory-server -n kg-memory-system -- sqlite3 /app/data/kg-memory.db ".backup /app/data/backup.db"
   ```

2. **Persistent Volume Backup**
   ```bash
   # Create volume snapshot (cloud provider specific)
   kubectl create volumesnapshot kg-memory-backup --source-pvc=kg-memory-data-pvc -n kg-memory-system
   ```

### Updates and Rollbacks

1. **Rolling Update**
   ```bash
   # Update image
   kubectl set image deployment/kg-memory-server kg-memory-server=kg-memory-server:1.1.0 -n kg-memory-system
   
   # Monitor rollout
   kubectl rollout status deployment/kg-memory-server -n kg-memory-system
   ```

2. **Rollback**
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/kg-memory-server -n kg-memory-system
   ```

## Troubleshooting

### Common Issues

#### 1. Pod Startup Issues

```bash
# Check pod events
kubectl describe pod <pod-name> -n kg-memory-system

# Check logs
kubectl logs <pod-name> -n kg-memory-system

# Common causes:
# - Missing secrets or config
# - Insufficient resources
# - Storage issues
```

#### 2. Database Connection Issues

```bash
# Check database file permissions
kubectl exec -it <pod-name> -n kg-memory-system -- ls -la /app/data/

# Check storage mount
kubectl describe pvc kg-memory-data-pvc -n kg-memory-system
```

#### 3. Performance Issues

```bash
# Check resource usage
kubectl top pods -n kg-memory-system

# Check HPA status
kubectl get hpa -n kg-memory-system

# Review metrics
curl http://<service-ip>:3000/metrics
```

#### 4. Network Connectivity

```bash
# Test service connectivity
kubectl exec -it <pod-name> -n kg-memory-system -- curl http://kg-memory-server:3000/health

# Check service endpoints
kubectl get endpoints -n kg-memory-system
```

### Debug Mode

Enable debug logging:

```yaml
# In ConfigMap or environment
LOG_LEVEL: "debug"
NODE_ENV: "development"
```

### Performance Profiling

```bash
# Enable profiling (development only)
NODE_OPTIONS: "--inspect=0.0.0.0:9229"

# Connect with Chrome DevTools or Node.js profiler
```

## Security Considerations

### Container Security

- Runs as non-root user (UID 1001)
- Read-only root filesystem
- Minimal base image (Alpine Linux)
- No privileged capabilities

### Network Security

- Internal service communication only
- Optional TLS termination at ingress
- Network policies for traffic control

### Secrets Management

- Kubernetes secrets for sensitive data
- No secrets in container images
- Optional integration with external secret managers

### RBAC

- Minimal required permissions
- Service account with limited scope
- Role-based access control

## Production Checklist

Before deploying to production:

- [ ] Configure resource limits and requests
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Test disaster recovery procedures
- [ ] Review security settings
- [ ] Configure log aggregation
- [ ] Set up health checks
- [ ] Test auto-scaling behavior
- [ ] Validate performance under load
- [ ] Document operational procedures

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs
3. Check system resources and health
4. Consult the project documentation
5. Open an issue in the project repository

## Additional Resources

- [Configuration Reference](CONFIG.md)
- [API Documentation](API.md)
- [Development Guide](DEVELOPMENT.md)
- [Performance Tuning](PERFORMANCE.md)