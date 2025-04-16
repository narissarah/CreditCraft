import dotenv from 'dotenv';
import { 
  initializeErrorTracking, 
  trackMessage, 
  trackException,
  startTransaction,
  finishTransaction,
  logger
} from '../src/config/monitoring';
import axios from 'axios';

// Load environment variables
dotenv.config();

/**
 * Script to test and verify monitoring and error tracking setup
 * This is useful during deployment to ensure monitoring is working correctly
 */
async function checkMonitoring() {
  console.log('Checking monitoring and error tracking setup...');
  
  try {
    // Initialize error tracking
    initializeErrorTracking();
    
    // Test logging
    logger.info('Monitoring check script started');
    logger.warn('This is a test warning message');
    
    // Test Sentry
    if (process.env.SENTRY_DSN) {
      // Test message tracking
      trackMessage('Test monitoring message from deployment script', 'info', {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
      
      // Test transaction tracking
      const transaction = startTransaction('monitoring-check', 'test');
      
      // Wait a bit to simulate some work
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test exception tracking with a controlled exception
      try {
        const testObject = null;
        // @ts-ignore - Intentional error for testing
        testObject.nonExistentMethod();
      } catch (error) {
        trackException(error as Error, {
          context: 'monitoring-check.ts',
          intentional: true
        });
      }
      
      // Finish the transaction
      finishTransaction(transaction);
      
      console.log('Sentry checks completed');
    } else {
      console.warn('Sentry DSN not configured, skipping Sentry checks');
    }
    
    // Check health endpoint if it exists
    await checkHealthEndpoint();
    
    // Check UptimeRobot if configured
    await checkUptimeRobot();
    
    logger.info('Monitoring check completed successfully');
    console.log('✅ Monitoring checks completed successfully');
  } catch (error) {
    console.error('❌ Monitoring check failed:', error);
    process.exit(1);
  }
}

/**
 * Check the application health endpoint
 */
async function checkHealthEndpoint() {
  if (process.env.SHOPIFY_APP_URL) {
    try {
      console.log(`Checking health endpoint at ${process.env.SHOPIFY_APP_URL}/api/health...`);
      const response = await axios.get(`${process.env.SHOPIFY_APP_URL}/api/health`, {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data.status === 'ok') {
        console.log('✅ Health endpoint is responding correctly');
      } else {
        console.warn('⚠️ Health endpoint response is unexpected:', response.data);
      }
    } catch (error) {
      console.warn('⚠️ Failed to check health endpoint:', error);
    }
  } else {
    console.log('SHOPIFY_APP_URL not configured, skipping health endpoint check');
  }
}

/**
 * Check UptimeRobot status if configured
 */
async function checkUptimeRobot() {
  if (process.env.UPTIME_ROBOT_API_KEY) {
    try {
      console.log('Checking UptimeRobot monitors...');
      const response = await axios.post('https://api.uptimerobot.com/v2/getMonitors', {
        api_key: process.env.UPTIME_ROBOT_API_KEY,
        format: 'json',
        logs: 0
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 5000
      });
      
      if (response.data.stat === 'ok') {
        console.log(`✅ UptimeRobot monitors: ${response.data.pagination.total} configured`);
        
        // Log status of each monitor
        response.data.monitors.forEach((monitor: any) => {
          const status = monitor.status === 2 ? '✅ Up' : '❌ Down';
          console.log(`- ${monitor.friendly_name}: ${status}`);
        });
      } else {
        console.warn('⚠️ UptimeRobot API response is unexpected:', response.data);
      }
    } catch (error) {
      console.warn('⚠️ Failed to check UptimeRobot:', error);
    }
  } else {
    console.log('UPTIME_ROBOT_API_KEY not configured, skipping UptimeRobot check');
  }
}

// Run the checks
checkMonitoring(); 