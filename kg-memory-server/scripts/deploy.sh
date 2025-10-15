#!/bin/bash

# KG Memory Server Deployment Script
# This script handles building, packaging, and deploying the KG Memory Server

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="kg-memory-server"
IMAGE_TAG="${IMAGE_TAG:-1.0.0}"
REGISTRY="${REGISTRY:-}"
NAMESPACE="${NAMESPACE:-kg-memory-system}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-kubernetes}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
KG Memory Server Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    build       Build the Docker image
    push        Push the Docker image to registry
    deploy      Deploy to Kubernetes
    undeploy    Remove from Kubernetes
    docker      Deploy using Docker Compose
    test        Run deployment tests
    all         Build, push, and deploy

Options:
    -h, --help          Show this help message
    -t, --tag TAG       Docker image tag (default: 1.0.0)
    -r, --registry REG  Docker registry URL
    -n, --namespace NS  Kubernetes namespace (default: kg-memory-system)
    -d, --deployment    Deployment type: kubernetes|docker (default: kubernetes)
    --dry-run          Show what would be done without executing
    --skip-tests       Skip running tests before deployment

Environment Variables:
    IMAGE_TAG           Docker image tag
    REGISTRY           Docker registry URL
    NAMESPACE          Kubernetes namespace
    DEPLOYMENT_TYPE    Deployment type (kubernetes|docker)
    KUBECONFIG         Kubernetes config file path

Examples:
    $0 build
    $0 -t v1.2.0 -r myregistry.com deploy
    $0 --dry-run all
    $0 docker
EOF
}

# Parse command line arguments
DRY_RUN=false
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--deployment)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        build|push|deploy|undeploy|docker|test|all)
            COMMAND="$1"
            shift
            break
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate command
if [[ -z "${COMMAND:-}" ]]; then
    log_error "No command specified"
    show_help
    exit 1
fi

# Set full image name
if [[ -n "$REGISTRY" ]]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
else
    FULL_IMAGE_NAME="$IMAGE_NAME:$IMAGE_TAG"
fi

# Utility functions
check_dependencies() {
    local deps=("docker" "kubectl")
    
    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        deps+=("docker-compose")
    fi
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is required but not installed"
            exit 1
        fi
    done
}

run_command() {
    local cmd="$1"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would execute: $cmd"
    else
        log_info "Executing: $cmd"
        eval "$cmd"
    fi
}

# Build Docker image
build_image() {
    log_info "Building Docker image: $FULL_IMAGE_NAME"
    
    cd "$PROJECT_ROOT"
    
    # Run tests first (unless skipped)
    if [[ "$SKIP_TESTS" != "true" ]]; then
        log_info "Running tests before build..."
        run_command "npm test"
    fi
    
    # Build the image
    run_command "docker build -f Dockerfile.production -t $FULL_IMAGE_NAME ."
    
    log_success "Docker image built successfully"
}

# Push Docker image
push_image() {
    if [[ -z "$REGISTRY" ]]; then
        log_warning "No registry specified, skipping push"
        return 0
    fi
    
    log_info "Pushing Docker image: $FULL_IMAGE_NAME"
    
    run_command "docker push $FULL_IMAGE_NAME"
    
    log_success "Docker image pushed successfully"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes namespace: $NAMESPACE"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    # Create namespace if it doesn't exist
    run_command "kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"
    
    # Apply Kubernetes manifests
    local manifests=(
        "kubernetes/configmap.yaml"
        "kubernetes/secret.yaml"
        "kubernetes/rbac.yaml"
        "kubernetes/pvc.yaml"
        "kubernetes/deployment.yaml"
        "kubernetes/service.yaml"
        "kubernetes/hpa.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [[ -f "$PROJECT_ROOT/$manifest" ]]; then
            log_info "Applying $manifest"
            run_command "kubectl apply -f $PROJECT_ROOT/$manifest -n $NAMESPACE"
        else
            log_warning "Manifest not found: $manifest"
        fi
    done
    
    # Update deployment image
    run_command "kubectl set image deployment/kg-memory-server kg-memory-server=$FULL_IMAGE_NAME -n $NAMESPACE"
    
    # Wait for rollout
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Waiting for deployment rollout..."
        kubectl rollout status deployment/kg-memory-server -n "$NAMESPACE" --timeout=300s
    fi
    
    log_success "Kubernetes deployment completed"
}

# Undeploy from Kubernetes
undeploy_kubernetes() {
    log_info "Removing deployment from Kubernetes namespace: $NAMESPACE"
    
    local manifests=(
        "kubernetes/hpa.yaml"
        "kubernetes/service.yaml"
        "kubernetes/deployment.yaml"
        "kubernetes/pvc.yaml"
        "kubernetes/rbac.yaml"
        "kubernetes/secret.yaml"
        "kubernetes/configmap.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [[ -f "$PROJECT_ROOT/$manifest" ]]; then
            log_info "Removing $manifest"
            run_command "kubectl delete -f $PROJECT_ROOT/$manifest -n $NAMESPACE --ignore-not-found=true"
        fi
    done
    
    # Optionally remove namespace
    read -p "Remove namespace $NAMESPACE? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_command "kubectl delete namespace $NAMESPACE --ignore-not-found=true"
    fi
    
    log_success "Kubernetes undeployment completed"
}

# Deploy using Docker Compose
deploy_docker() {
    log_info "Deploying using Docker Compose"
    
    cd "$PROJECT_ROOT"
    
    # Create necessary directories
    run_command "mkdir -p config rules data"
    
    # Start services
    run_command "docker-compose up -d"
    
    # Wait for services to be ready
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Waiting for services to be ready..."
        sleep 10
        
        # Check if service is responding
        if docker-compose ps | grep -q "Up"; then
            log_success "Docker Compose deployment completed"
        else
            log_error "Some services failed to start"
            docker-compose logs
            exit 1
        fi
    fi
}

# Run deployment tests
run_tests() {
    log_info "Running deployment tests"
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    run_command "npm test"
    
    # Run integration tests if available
    if [[ -f "test-data/integration-tests/system-validation-runner.ts" ]]; then
        log_info "Running integration tests"
        run_command "npm run test:integration"
    fi
    
    log_success "All tests passed"
}

# Main execution
main() {
    log_info "KG Memory Server Deployment Script"
    log_info "Command: $COMMAND"
    log_info "Image: $FULL_IMAGE_NAME"
    log_info "Namespace: $NAMESPACE"
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    
    check_dependencies
    
    case "$COMMAND" in
        build)
            build_image
            ;;
        push)
            push_image
            ;;
        deploy)
            if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
                deploy_kubernetes
            else
                deploy_docker
            fi
            ;;
        undeploy)
            if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
                undeploy_kubernetes
            else
                log_info "Stopping Docker Compose services"
                run_command "docker-compose down"
            fi
            ;;
        docker)
            DEPLOYMENT_TYPE="docker"
            deploy_docker
            ;;
        test)
            run_tests
            ;;
        all)
            build_image
            push_image
            if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
                deploy_kubernetes
            else
                deploy_docker
            fi
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            exit 1
            ;;
    esac
    
    log_success "Deployment script completed successfully"
}

# Execute main function
main "$@"