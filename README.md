# HyperTube

## Docker Watch Development

This project is configured with Docker watch for efficient development. Docker watch automatically syncs file changes and rebuilds containers when necessary.

### Quick Start with Docker Watch

```bash
# Start all services with watch mode
make watch

# Alternative: use docker compose directly
docker compose watch
```

### Development Commands

```bash
# Start with watch mode (recommended for development)
make watch

# Traditional startup
make up

# Stop all services
make down

# View logs
make logs

# Fresh rebuild (when dependencies change)
make fresh-rebuild
```

### 🔧 Handling New Dependencies

When you install new dependencies, Docker's `node_modules` volumes can prevent them from syncing properly. Use this workflow:

#### For New Dependencies:

1. **Install locally:**

   ```bash
   cd backend  # or frontend/worker
   npm install <package-name>
   ```

2. **Fresh rebuild (required for dependencies):**

   ```bash
   make fresh-rebuild
   ```

3. **Resume development:**
   ```bash
   make watch
   ```

#### Quick Service Rebuilds (for code changes only):

```bash
make rebuild-api     # Rebuild backend only
make rebuild-web     # Rebuild frontend only
make rebuild-worker  # Rebuild worker only
```

### How Docker Watch Works

- **Sync**: Changes to source files (`src/` directories) are immediately synced to containers
- **Rebuild**: Changes to `package.json` files trigger container rebuilds
- **Hot Reload**: Frontend (Vite) and backend (NestJS) automatically reload on file changes

### Watch Configuration

Each service has specific watch rules:

- **Backend (NestJS)**: Syncs `src/` changes, rebuilds on package.json changes
- **Frontend (React)**: Syncs `src/` and `index.html` changes, rebuilds on package.json changes
- **Worker**: Syncs `src/` changes, rebuilds on package.json changes

### Troubleshooting

- **Dependencies not updating?** Use `make fresh-rebuild`
- **Service not starting?** Check logs with `make logs`
- **Port conflicts?** Stop services with `make down` first
