/**
 * Rate Limiting Test Script
 * 
 * This script demonstrates the rate limiting functionality in CreditCraft
 * by simulating various request patterns against different endpoint tiers.
 */

import axios from 'axios';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'demo-api-key';

// Utility to format rate limit information
const formatRateLimit = (headers: any) => {
  if (!headers) return 'No rate limit headers';
  
  return `${headers['ratelimit-remaining'] || '?'}/${headers['ratelimit-limit'] || '?'} - Reset: ${
    headers['ratelimit-reset'] 
      ? new Date(parseInt(headers['ratelimit-reset']) * 1000).toLocaleTimeString() 
      : '?'
  }`;
};

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate a sequence of API requests
async function makeRequests(
  endpoint: string, 
  count: number, 
  delayMs: number = 100, 
  options: any = {}
) {
  console.log(chalk.blue(`\n🔄 Making ${count} requests to ${endpoint} with ${delayMs}ms delay...\n`));
  
  const results = {
    success: 0,
    rateLimited: 0,
    otherErrors: 0,
    firstRateLimitAt: 0,
  };

  const startTime = performance.now();
  
  for (let i = 0; i < count; i++) {
    try {
      const response = await axios({
        method: options.method || 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Authorization': options.auth ? `Bearer ${API_KEY}` : '',
          'X-Shop-ID': options.shopId || '',
          ...options.headers
        },
        data: options.data || undefined
      });
      
      results.success++;
      
      // Display rate limit information
      console.log(
        chalk.green(`✅ Request ${i + 1}/${count}: Success`),
        chalk.yellow(`Rate limits: ${formatRateLimit(response.headers)}`)
      );
      
    } catch (error: any) {
      if (error.response?.status === 429) {
        if (results.rateLimited === 0) {
          results.firstRateLimitAt = i + 1;
        }
        results.rateLimited++;
        
        console.log(
          chalk.red(`❌ Request ${i + 1}/${count}: Rate limited`),
          chalk.yellow(`Retry after: ${error.response.headers['retry-after'] || 'unknown'} seconds`)
        );
      } else {
        results.otherErrors++;
        console.log(
          chalk.red(`⚠️ Request ${i + 1}/${count}: Error ${error.response?.status || 'unknown'}`),
          error.response?.data?.message || error.message
        );
      }
    }
    
    if (i < count - 1) {
      await sleep(delayMs);
    }
  }
  
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  
  console.log(chalk.blue(`\n📊 Results for ${endpoint}:`));
  console.log(`Duration: ${duration}s`);
  console.log(`Success: ${results.success}/${count}`);
  console.log(`Rate limited: ${results.rateLimited}/${count}`);
  console.log(`Other errors: ${results.otherErrors}/${count}`);
  
  if (results.firstRateLimitAt > 0) {
    console.log(`First rate limit hit at request #${results.firstRateLimitAt}`);
  }
  
  return results;
}

// Sample tests for different rate limit tiers
async function runTests() {
  console.log(chalk.bgBlue.white('\n=== CREDITCRAFT RATE LIMIT TEST ===\n'));
  
  try {
    // Test 1: Standard endpoints
    await makeRequests('/api/credits', 30, 100);
    
    // Give time for rate limits to refresh
    console.log(chalk.yellow('\nWaiting 3 seconds for rate limits to normalize...\n'));
    await sleep(3000);
    
    // Test 2: Authentication endpoints (stricter limits)
    await makeRequests('/api/auth/login', 10, 200, {
      method: 'POST',
      data: { email: 'test@example.com', password: 'password' }
    });
    
    // Give time for rate limits to refresh
    console.log(chalk.yellow('\nWaiting 3 seconds for rate limits to normalize...\n'));
    await sleep(3000);
    
    // Test 3: POS endpoints with shop-specific limits
    await makeRequests('/api/pos/transactions', 25, 100, {
      shopId: 'shop_123',
      auth: true
    });
    
    // Give time for rate limits to refresh
    console.log(chalk.yellow('\nWaiting 3 seconds for rate limits to normalize...\n'));
    await sleep(3000);
    
    // Test 4: Admin endpoints
    await makeRequests('/api/admin/users', 50, 50, {
      auth: true,
      headers: { 'X-Admin-API-Key': 'admin-secret-key' }
    });
    
    // Test 5: Burst requests (to trigger immediate rate limiting)
    console.log(chalk.bgRed.white('\n=== BURST TEST (NO DELAY) ===\n'));
    await makeRequests('/api/credits', 20, 0);
    
  } catch (error: any) {
    console.error(chalk.bgRed.white('\nTest execution failed:'), error.message);
  }
  
  console.log(chalk.bgBlue.white('\n=== TEST COMPLETE ===\n'));
}

// Run the tests
runTests().catch(console.error);

/**
 * Usage:
 * 
 * Basic usage:
 * npx tsx examples/rate-limit-test.ts
 * 
 * With custom API URL:
 * API_URL=https://api.example.com npx tsx examples/rate-limit-test.ts
 * 
 * With custom API key:
 * API_KEY=your-key npx tsx examples/rate-limit-test.ts
 */ 