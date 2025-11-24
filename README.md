# HyperTube

A Netflix-like streaming platform with torrent-based content delivery.

## Tech Stack

- **Backend**: NestJS, TypeORM, PostgreSQL
- **Frontend**: React, Vite, TypeScript
- **Infrastructure**: Docker, Nginx
- **Authentication**: JWT, OAuth (42, Google)

## Quick Start

```bash
# Start all services
make up

# Stop all services
make down

# View logs
make logs
```

## Development

```bash
# Start with watch mode (auto-reload on file changes)
make watch

# Fresh rebuild (when dependencies change)
make fresh-rebuild
```
