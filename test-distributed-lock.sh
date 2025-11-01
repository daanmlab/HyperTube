#!/bin/bash

# Script to test distributed transcoding locks
# This will show which movies have active transcoding locks and which worker owns them

echo "🔒 Distributed Transcoding Lock Status"
echo "======================================="
echo ""

REDIS_CONTAINER=$(docker ps -qf name=redis)

if [ -z "$REDIS_CONTAINER" ]; then
    echo "❌ Redis container not found"
    exit 1
fi

echo "📋 Active Transcoding Locks:"
echo ""

LOCKS=$(docker exec $REDIS_CONTAINER redis-cli KEYS "transcoding_lock:*" 2>/dev/null)

if [ -z "$LOCKS" ]; then
    echo "  ✅ No active transcoding locks (no movies being transcoded)"
else
    for LOCK in $LOCKS; do
        IMDB_ID=$(echo $LOCK | sed 's/transcoding_lock://')
        WORKER=$(docker exec $REDIS_CONTAINER redis-cli GET "$LOCK" 2>/dev/null)
        TTL=$(docker exec $REDIS_CONTAINER redis-cli TTL "$LOCK" 2>/dev/null)
        
        # Convert TTL to hours and minutes
        HOURS=$((TTL / 3600))
        MINUTES=$(((TTL % 3600) / 60))
        
        echo "  🎬 Movie: $IMDB_ID"
        echo "     Worker: $WORKER"
        echo "     Time remaining: ${HOURS}h ${MINUTES}m"
        echo ""
    done
fi

echo "📊 Worker Instances:"
docker-compose ps worker --format "table {{.Name}}\t{{.Status}}" | grep worker

echo ""
echo "💡 Commands:"
echo "  Clear all locks:  docker exec $REDIS_CONTAINER redis-cli DEL \$(docker exec $REDIS_CONTAINER redis-cli KEYS 'transcoding_lock:*')"
echo "  Clear one lock:   docker exec $REDIS_CONTAINER redis-cli DEL transcoding_lock:tt1234567"
echo "  View lock owner:  docker exec $REDIS_CONTAINER redis-cli GET transcoding_lock:tt1234567"
