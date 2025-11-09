# HyperTube

A Netflix-like streaming platform with torrent-based content delivery.

## 📚 Documentation

- **[STREAMING_FLOW.md](./STREAMING_FLOW.md)** - Complete streaming architecture and flowchart
- **[TODO.md](./TODO.md)** - Detailed implementation tasks with time estimates
- **[IMPLEMENTATION_GAP.md](./IMPLEMENTATION_GAP.md)** - Gap analysis between current state and target architecture

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

## ⚡️ Concurrent Video Transcoding

HyperTube supports running multiple worker instances for parallel video transcoding, allowing you to process multiple videos simultaneously.

### Worker Scaling

**Default Configuration**: 3 worker instances (configured in `docker-compose.yml`)

Each worker instance can process one transcoding job at a time, so with 3 workers you can transcode 3 videos simultaneously.

### Scaling Workers

#### Option 1: Modify docker-compose.yml (permanent)

Edit the worker service in `docker-compose.yml`:

```yaml
worker:
  deploy:
    replicas: 5  # Change to desired number of workers
```

Then restart:
```bash
docker-compose up -d
```

#### Option 2: Scale on-the-fly (temporary)

Use the provided script:

```bash
# Scale to 5 workers
./scale-workers.sh 5

# Scale to 2 workers
./scale-workers.sh 2

# Check current status
./scale-workers.sh
```

Or use docker-compose directly:

```bash
docker-compose up -d --scale worker=5
```

### Resource Allocation

Each worker is configured to use:
- **CPU**: Up to 2.5 cores per worker (1.5 cores reserved)
- **Memory**: Up to 1.5GB per worker (768MB reserved)

**Example with 3 workers:**
- Total CPU usage: Up to 7.5 cores
- Total memory: Up to 4.5GB

Adjust based on your system resources:
- **8-core CPU**: 3-4 workers recommended
- **16-core CPU**: 6-8 workers recommended
- **16GB RAM**: 3-4 workers recommended
- **32GB RAM**: 6-8 workers recommended

### Monitoring Workers

```bash
# View all worker instances
docker-compose ps worker

# Monitor worker logs
docker-compose logs -f worker

# Check Redis job queue length
docker exec -it $(docker ps -qf name=redis) redis-cli LLEN jobs

# Monitor system resources
docker stats
```

### How It Works

1. All workers share the same Redis job queue (`jobs`)
2. Workers use `BLPOP` to atomically fetch jobs from the queue
3. Each worker processes one job at a time
4. Multiple workers = multiple jobs processed in parallel
5. If one worker crashes, others continue processing

### Performance Tips

- **Start small**: Begin with 2-3 workers and monitor CPU/memory usage
- **Watch temperature**: High CPU usage can increase system temperature
- **Balance quality vs speed**: Use `ultrafast` preset in transcoding jobs for faster processing
- **Monitor disk I/O**: Multiple concurrent transcodings can bottleneck on slow disks

````
