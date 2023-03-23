// src/queues/jobQueue.js
const Queue = require('bull');
const redisConfig = {
    redis: process.env.REDIS_URL || {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || '127.0.0.1',
    },
  };
  

const jobQueue = new Queue('jobQueue', redisConfig);

module.exports = jobQueue;
