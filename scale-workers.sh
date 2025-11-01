#!/bin/bash

# Script to scale the number of worker instances
# Usage: ./scale-workers.sh [number_of_workers]

if [ -z "$1" ]; then
    echo "Usage: $0 <number_of_workers>"
    echo "Example: $0 3  # Run 3 worker instances"
    echo ""
    echo "Current worker status:"
    docker-compose ps worker
    exit 1
fi

NUM_WORKERS=$1

echo "📊 Scaling workers to $NUM_WORKERS instances..."
docker-compose up -d --scale worker=$NUM_WORKERS --no-recreate

echo ""
echo "✅ Worker scaling complete!"
echo ""
echo "📋 Current worker instances:"
docker-compose ps worker

echo ""
echo "💡 Tips:"
echo "  - Each worker can process one transcoding job at a time"
echo "  - With $NUM_WORKERS workers, you can transcode $NUM_WORKERS videos simultaneously"
echo "  - Monitor workers: docker-compose logs -f worker"
echo "  - Check Redis queue: docker exec -it \$(docker ps -qf name=redis) redis-cli LLEN jobs"
