#!/bin/bash

# Script to generate OpenAPI client # Generate TypeScript types using openapi-typescript
docker run --rm \
  -v "$(pwd)/../frontend/src/api:/workspace" \
  -w /workspace \
  node:18-alpine \
  sh -c "npm install -g openapi-typescript && openapi-typescript openapi.json -o types/api.ts"

# Fix file permissions (Docker containers run as root by default)
echo "🔧 Fixing file permissions..."
sudo chown -R $(whoami):$(id -gn) ../frontend/src/api/generated ../frontend/src/api/types 2>/dev/null || true

# Update service.ts with generated APIs
echo "🔄 Updating service.ts..."
./scripts/update-service.sh

echo "✅ OpenAPI client generated successfully!"
echo "📁 Files generated:"
echo "   - frontend/src/api/generated/ (Axios client)"
echo "   - frontend/src/api/types/api.ts (TypeScript types)"
echo "   - frontend/src/api/openapi.json (OpenAPI spec)"
echo "   - frontend/src/api/service.ts (Auto-updated service)"ng Docker
set -e

echo "🚀 Generating OpenAPI client using Docker..."

# Check if backend container is running
BACKEND_CONTAINER="hypertube-api-1"
BACKEND_URL="http://localhost:3000"

# Try to find the correct container name
CONTAINER_NAME=$(docker ps --format "table {{.Names}}" | grep -E "(api|backend)" | head -n1 || echo "")

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Backend container is not running"
    echo "Please start the backend first: docker compose up -d api"
    exit 1
fi

echo "📦 Using container: $CONTAINER_NAME"

# Check if backend is responding
if ! curl -s "${BACKEND_URL}/api-json" > /dev/null; then
    echo "❌ Backend is not responding at ${BACKEND_URL}"
    echo "Please make sure the backend is running and accessible"
    exit 1
fi

# Create output directories
mkdir -p ../frontend/src/api/generated
mkdir -p ../frontend/src/api/types

echo "📥 Fetching OpenAPI spec from ${BACKEND_URL}/api-json..."
curl -s "${BACKEND_URL}/api-json" > ../frontend/src/api/openapi.json

echo "🔧 Generating TypeScript client using Docker..."

# Generate TypeScript client using openapi-generator via Docker
docker run --rm \
  -v "$(pwd)/../frontend/src/api:/workspace" \
  openapitools/openapi-generator-cli generate \
  -i /workspace/openapi.json \
  -g typescript-axios \
  -o /workspace/generated \
  --additional-properties=withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,supportsES6=true

echo "📝 Generating TypeScript types using Docker..."

# Generate TypeScript types using openapi-typescript via Docker
docker run --rm \
  -v "$(pwd)/../frontend/src/api:/workspace" \
  -w /workspace \
  node:18-alpine \
  sh -c "npm install -g openapi-typescript && openapi-typescript openapi.json -o types/api.ts"

# Fix file permissions (Docker containers run as root by default)
echo "🔧 Fixing file permissions..."
sudo chown -R $(whoami):$(id -gn) ../frontend/src/api/generated ../frontend/src/api/types 2>/dev/null || true

echo "✅ OpenAPI client generated successfully!"
echo "📁 Files generated:"
echo "   - frontend/src/api/generated/ (Axios client)"
echo "   - frontend/src/api/types/api.ts (TypeScript types)"
echo "   - frontend/src/api/openapi.json (OpenAPI spec)"