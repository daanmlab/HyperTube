FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "start:dev"]
