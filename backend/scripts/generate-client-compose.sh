#!/bin/bash

# Alternative script that runs everything within Docker compose network
set -e

echo "🚀 Generating OpenAPI client using Docker Compose..."

# Check if backend container is running
if ! docker compose ps api | grep -q "Up"; then
    echo "❌ Backend container is not running"
    echo "Please start the backend first: docker compose up -d api"
    exit 1
fi

# Wait a moment for the backend to be fully ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Create output directories on host
mkdir -p ../frontend/src/api/generated
mkdir -p ../frontend/src/api/types

echo "📥 Fetching OpenAPI spec from backend container..."

# Fetch OpenAPI spec directly from the backend container
docker compose exec -T api curl -s http://localhost:3000/api-json > ../frontend/src/api/openapi.json

echo "🔧 Generating TypeScript client using Docker..."

# Create a temporary directory for generation
TEMP_DIR=$(mktemp -d)
cp ../frontend/src/api/openapi.json "$TEMP_DIR/"

# Generate TypeScript client using openapi-generator
docker run --rm \
  -v "$TEMP_DIR:/workspace" \
  openapitools/openapi-generator-cli generate \
  -i /workspace/openapi.json \
  -g typescript-axios \
  -o /workspace/generated \
  --additional-properties=withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,supportsES6=true

echo "📝 Generating TypeScript types..."

# Generate TypeScript types using openapi-typescript
docker run --rm \
  -v "$TEMP_DIR:/workspace" \
  -w /workspace \
  node:18-alpine \
  sh -c "npm install -g openapi-typescript && openapi-typescript openapi.json -o types/api.ts"

# Copy generated files to the frontend directory
echo "📋 Copying generated files..."
cp -r "$TEMP_DIR/generated" ../frontend/src/api/
mkdir -p ../frontend/src/api/types
cp "$TEMP_DIR/types/api.ts" ../frontend/src/api/types/

# Clean up temporary directory
rm -rf "$TEMP_DIR"

# Update service.ts with generated APIs
echo "🔄 Updating service.ts..."
./scripts/update-service.sh

echo "✅ OpenAPI client generated successfully!"
echo "📁 Files generated:"
echo "   - frontend/src/api/generated/ (Axios client)"
echo "   - frontend/src/api/types/api.ts (TypeScript types)"
echo "   - frontend/src/api/openapi.json (OpenAPI spec)"
echo "   - frontend/src/api/service.ts (Auto-updated service)"
