#!/bin/bash

# Script to monitor worker instances and transcoding jobs
# Usage: ./monitor-workers.sh

echo "🎬 HyperTube Worker Monitor"
echo "============================"
echo ""

# Show worker instances
echo "📊 Worker Instances:"
docker-compose ps worker | grep worker

echo ""
echo "📋 Redis Job Queue:"
QUEUE_LENGTH=$(docker exec $(docker ps -qf name=redis) redis-cli LLEN jobs 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "  Pending jobs: $QUEUE_LENGTH"
else
    echo "  ⚠️  Could not connect to Redis"
fi

echo ""
echo "💾 System Resources:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "CONTAINER|worker"

echo ""
echo "📝 Recent Worker Activity (last 10 lines per worker):"
docker-compose logs --tail=10 worker 2>/dev/null | grep -E "worker-[0-9]|TRANSCODER|Processing job|Transcoding complete"

echo ""
echo "💡 Useful commands:"
echo "  Full logs:     docker-compose logs -f worker"
echo "  Scale workers: ./scale-workers.sh <number>"
echo "  Queue status:  docker exec -it \$(docker ps -qf name=redis) redis-cli LLEN jobs"
