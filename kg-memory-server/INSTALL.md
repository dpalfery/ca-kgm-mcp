# KG Memory Server Installation Guide

This guide provides step-by-step instructions for installing and setting up the Knowledge Graph Memory Server in various environments.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Configuration](#configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **Operating System**: Linux, macOS, or Windows
- **Node.js**: Version 18.0 or higher
- **Memory**: 2GB RAM minimum, 4GB recommended
- **Storage**: 5GB available disk space
- **Network**: Internet connection (for model providers)

### Recommended Requirements

- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 20GB+ SSD storage
- **Network**: Stable broadband connection

## Installation Methods

### Method 1: NPM Package (Recommended)

```bash
# Install globally
npm install -g kg-memory-server

# Or install locally in your project
npm install kg-memory-server
```

### Method 2: Docker (Production Ready)

```bash
# Pull the official image
docker pull kg-memory-server:latest

# Or build from source
git clone https://github.com/your-org/kg-memory-server.git
cd kg-memory-server
docker build -f Dockerfile.production -t kg-memory-server:latest .
```

### Method 3: From Source (Development)

```bash
# Clone the repository
git clone https://github.com/your-org/kg-memory-server.git
cd kg-memory-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Method 4: Kubernetes Helm Chart

```bash
# Add the Helm repository
helm repo add kg-memory https://charts.kg-memory-server.com
helm repo update

# Install the chart
helm install kg-memory kg-memory/kg-memory-server
```

## Quick Start

### 1. Basic Installation

```bash
# Install the package
npm install -g kg-memory-server

# Create a working directory
mkdir kg-memory-workspace
cd kg-memory-workspace

# Initialize configuration
kg-memory-server init

# Start the server
kg-memory-server start
```

### 2. Docker Quick Start

```bash
# Create a working directory
mkdir kg-memory-workspace
cd kg-memory-workspace

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/your-org/kg-memory-server/main/docker-compose.yml

# Start the services
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Verify Installation

```bash
# Check if the server is running
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":...}
```

## Development Setup

### Prerequisites

1. **Install Node.js**
   ```bash
   # Using nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   
   # Or download from https://nodejs.org/
   ```

2. **Install Git**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install git
   
   # macOS
   brew install git
   
   # Windows: Download from https://git-scm.com/
   ```

### Setup Steps

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/kg-memory-server.git
   cd kg-memory-server
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy configuration template
   cp .env.example .env
   
   # Edit configuration (optional for development)
   nano .env
   ```

3. **Build and Test**
   ```bash
   # Build the project
   npm run build
   
   # Run tests
   npm test
   
   # Run integration tests
   npm run test:integration
   ```

4. **Start Development Server**
   ```bash
   # Start with hot reload
   npm run dev
   
   # Or start built version
   npm start
   ```

### Development Tools

```bash
# Watch mode for development
npm run watch

# Run tests in watch mode
npm run test:watch

# Run with debug logging
LOG_LEVEL=debug npm run dev

# Run performance tests
npm run test:performance
```

## Production Setup

### Option 1: Docker Deployment

1. **Prepare Environment**
   ```bash
   # Create production directory
   mkdir /opt/kg-memory-server
   cd /opt/kg-memory-server
   
   # Download production files
   curl -O https://raw.githubusercontent.com/your-org/kg-memory-server/main/docker-compose.yml
   curl -O https://raw.githubusercontent.com/your-org/kg-memory-server/main/.env.example
   
   # Configure environment
   cp .env.example .env
   nano .env  # Edit with production settings
   ```

2. **Deploy Services**
   ```bash
   # Start services
   docker-compose up -d
   
   # Check logs
   docker-compose logs -f kg-memory-server
   
   # Verify health
   curl http://localhost:3000/health
   ```

### Option 2: Kubernetes Deployment

1. **Prepare Cluster**
   ```bash
   # Ensure kubectl is configured
   kubectl cluster-info
   
   # Create namespace
   kubectl create namespace kg-memory-system
   ```

2. **Configure Secrets**
   ```bash
   # Create secrets (edit with your values)
   kubectl create secret generic kg-memory-secrets \
     --from-literal=openai-api-key="sk-..." \
     --from-literal=jwt-secret="$(openssl rand -base64 32)" \
     --namespace=kg-memory-system
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/your-org/kg-memory-server.git
   cd kg-memory-server
   
   # Deploy using script
   ./scripts/deploy.sh deploy
   
   # Or deploy manually
   kubectl apply -f kubernetes/ -n kg-memory-system
   ```

### Option 3: Systemd Service (Linux)

1. **Install Application**
   ```bash
   # Install globally
   sudo npm install -g kg-memory-server
   
   # Create service user
   sudo useradd --system --shell /bin/false kg-memory
   
   # Create directories
   sudo mkdir -p /etc/kg-memory-server
   sudo mkdir -p /var/lib/kg-memory-server
   sudo mkdir -p /var/log/kg-memory-server
   
   # Set permissions
   sudo chown kg-memory:kg-memory /var/lib/kg-memory-server
   sudo chown kg-memory:kg-memory /var/log/kg-memory-server
   ```

2. **Configure Service**
   ```bash
   # Create configuration
   sudo tee /etc/kg-memory-server/config.env << EOF
   NODE_ENV=production
   DATABASE_PATH=/var/lib/kg-memory-server/kg-memory.db
   LOG_LEVEL=info
   PORT=3000
   EOF
   
   # Create systemd service
   sudo tee /etc/systemd/system/kg-memory-server.service << EOF
   [Unit]
   Description=KG Memory Server
   After=network.target
   
   [Service]
   Type=simple
   User=kg-memory
   Group=kg-memory
   WorkingDirectory=/var/lib/kg-memory-server
   EnvironmentFile=/etc/kg-memory-server/config.env
   ExecStart=/usr/local/bin/kg-memory-server
   Restart=always
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   EOF
   ```

3. **Start Service**
   ```bash
   # Reload systemd
   sudo systemctl daemon-reload
   
   # Enable and start service
   sudo systemctl enable kg-memory-server
   sudo systemctl start kg-memory-server
   
   # Check status
   sudo systemctl status kg-memory-server
   ```

## Configuration

### Basic Configuration

1. **Copy Configuration Template**
   ```bash
   cp .env.example .env
   ```

2. **Essential Settings**
   ```bash
   # Edit .env file
   NODE_ENV=production
   LOG_LEVEL=info
   DATABASE_PATH=./data/kg-memory.db
   MODEL_PROVIDER=rule-based
   ```

### Model Provider Setup

#### Rule-Based Provider (Default)
```bash
# No additional configuration required
MODEL_PROVIDER=rule-based
```

#### OpenAI Provider
```bash
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-3.5-turbo
```

#### Anthropic Provider
```bash
MODEL_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

#### Local Ollama Provider
```bash
# First install Ollama: https://ollama.ai/
# Then pull a model: ollama pull llama2:7b

MODEL_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2:7b
```

### Performance Tuning

```bash
# Adjust based on your needs
MAX_QUERY_RESULTS=50
QUERY_TIMEOUT=5000
CACHE_TTL=3600
ENABLE_CACHING=true
```

## Verification

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# Metrics (if enabled)
curl http://localhost:3000/metrics
```

### Functional Testing

```bash
# Test context detection
curl -X POST http://localhost:3000/detect-context \
  -H "Content-Type: application/json" \
  -d '{"text": "Create React component with form validation"}'

# Test rule ingestion (if you have rule files)
curl -X POST http://localhost:3000/upsert-markdown \
  -H "Content-Type: application/json" \
  -d '{"documents": [{"path": "sample-rule.md"}]}'
```

### Performance Testing

```bash
# Run built-in performance tests
npm run test:performance

# Run load tests
npm run test:load

# Run accuracy validation
npm run test:accuracy
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process or change port
PORT=3001 npm start
```

#### 2. Permission Denied
```bash
# Fix file permissions
chmod +x node_modules/.bin/*

# Or reinstall with proper permissions
sudo npm install -g kg-memory-server
```

#### 3. Database Issues
```bash
# Check database file permissions
ls -la data/kg-memory.db

# Reset database (WARNING: loses data)
rm data/kg-memory.db
npm start  # Will recreate database
```

#### 4. Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Monitor memory usage
top -p $(pgrep -f kg-memory-server)
```

#### 5. Network Connectivity
```bash
# Test external API connectivity (if using cloud providers)
curl -I https://api.openai.com/v1/models

# Check firewall settings
sudo ufw status
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Enable Node.js debugging
node --inspect dist/index.js

# Enable performance profiling
node --prof dist/index.js
```

### Log Analysis

```bash
# View logs (Docker)
docker-compose logs -f kg-memory-server

# View logs (Kubernetes)
kubectl logs -f deployment/kg-memory-server -n kg-memory-system

# View logs (Systemd)
sudo journalctl -u kg-memory-server -f
```

## Next Steps

After successful installation:

1. **Load Rule Documents**: Import your project-specific rules
2. **Configure Model Providers**: Set up your preferred AI model providers
3. **Set Up Monitoring**: Configure health checks and metrics
4. **Performance Tuning**: Adjust settings based on your workload
5. **Integration**: Connect with your AI coding assistants

## Support

For additional help:

- **Documentation**: [Full Documentation](README.md)
- **Deployment Guide**: [Deployment Guide](DEPLOYMENT.md)
- **Configuration Reference**: [Configuration Guide](CONFIG.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/kg-memory-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/kg-memory-server/discussions)