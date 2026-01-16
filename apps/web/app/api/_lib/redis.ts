import {Redis} from '@upstash/redis'

/**
 * Server-side Upstash Redis client (HTTP/REST).
 *
 * Required env vars:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */
export const redis = Redis.fromEnv()
