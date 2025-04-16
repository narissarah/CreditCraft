import dotenv from 'dotenv';

dotenv.config();

export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS_ENABLED === 'true',
  maxMemory: process.env.REDIS_MAX_MEMORY || '100mb',
  evictionPolicy: process.env.REDIS_EVICTION_POLICY || 'volatile-lru',
  
  // Connection options
  connectionTimeout: 5000, // 5 seconds
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  
  // Security options
  allowBlockingCommands: false, // Prevent blocking commands like BLPOP
  enableOfflineQueue: true,
  
  // Bull queue default settings
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1 second initial delay
    },
    removeOnComplete: 100, // Keep the latest 100 completed jobs
    removeOnFail: 200, // Keep the latest 200 failed jobs
  },
  
  // Monitoring settings
  monitorInterval: 60000, // Check every minute
  alertThresholds: {
    memoryUsage: 80, // Alert when memory usage exceeds 80%
    queueSize: 1000, // Alert when queue size exceeds 1000 jobs
    processingTime: 30000, // Alert when processing time exceeds 30 seconds
  }
};

export default redisConfig; 