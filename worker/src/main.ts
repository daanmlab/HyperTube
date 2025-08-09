import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
});

setInterval(async () => {
  const job = await redis.lpop('jobs');
  if (job) {
    console.log('Processing job', job);
  }
}, 1000);
