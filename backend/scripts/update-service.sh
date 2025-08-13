#!/bin/bash

# Script to automatically update service.ts based on generated APIs
set -e

API_DIR="../frontend/src/api"
GENERATED_API_DIR="$API_DIR/generated/api"
SERVICE_FILE="$API_DIR/service.ts"

echo "🔧 Updating service.ts with generated APIs..."

# Check if generated APIs exist
if [ ! -d "$GENERATED_API_DIR" ]; then
    echo "❌ Generated APIs not found. Please run generate-client first."
    exit 1
fi

# Find all API files
API_FILES=$(find "$GENERATED_API_DIR" -name "*-api.ts" -exec basename {} .ts \;)

if [ -z "$API_FILES" ]; then
    echo "❌ No API files found in $GENERATED_API_DIR"
    exit 1
fi

echo "📁 Found API files: $API_FILES"

# Generate imports
IMPORTS=""
API_INSTANCES=""
SERVICE_METHODS=""
EXPORT_APIS=""

for api_file in $API_FILES; do
    # Convert app-api -> AppApi
    if [ "$api_file" = "app-api" ]; then
        API_CLASS="AppApi"
        INSTANCE_NAME="appApi"
        SERVICE_NAME="app"
    else
        # Generic conversion for other API files
        # Split on dash and capitalize each part
        API_CLASS=$(echo "$api_file" | awk -F- '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1' OFS='')
        INSTANCE_NAME=$(echo "$API_CLASS" | sed 's/^./\L&/')
        SERVICE_NAME=$(echo "$INSTANCE_NAME" | sed 's/Api$//')
    fi
    
    IMPORTS="${IMPORTS}import { ${API_CLASS} } from './generated/api';\n"
    API_INSTANCES="${API_INSTANCES}export const ${INSTANCE_NAME} = new ${API_CLASS}(apiConfig, undefined, apiClient);\n"
    SERVICE_METHODS="${SERVICE_METHODS}  static ${SERVICE_NAME} = ${INSTANCE_NAME};\n"
    EXPORT_APIS="${EXPORT_APIS}  ${SERVICE_NAME}: ${INSTANCE_NAME},\n"
done

# Generate the complete service.ts file
cat > "$SERVICE_FILE" << EOF
// Auto-generated service that uses the OpenAPI generated client
// This file automatically wraps the generated API client with error handling

import { apiClient } from './client';
import { Configuration } from './generated/configuration';
$(echo -e "$IMPORTS")

const apiConfig = new Configuration({
  basePath: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

$(echo -e "$API_INSTANCES")

export class ApiService {
$(echo -e "$SERVICE_METHODS")}

export const api = {
$(echo -e "$EXPORT_APIS")};

export default ApiService;
EOF

echo "✅ service.ts updated successfully!"
echo "📝 Generated service methods:"
echo -e "$SERVICE_METHODS" | sed 's/^/   /'
