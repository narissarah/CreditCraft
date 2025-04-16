import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Sets up a cron job for automated database backups
 * Note: This script is intended to run on Linux/macOS systems
 * For Windows, you would use Windows Task Scheduler instead
 */
function setupCronJob() {
  const projectRoot = process.cwd();
  const backupScript = path.join(projectRoot, 'scripts', 'db-backup.ts');
  const logFile = path.join(projectRoot, 'logs', 'backup.log');
  
  // Ensure logs directory exists
  if (!fs.existsSync(path.join(projectRoot, 'logs'))) {
    fs.mkdirSync(path.join(projectRoot, 'logs'), { recursive: true });
  }
  
  // Create cron job command - runs daily at 2:00 AM
  const cronCommand = `0 2 * * * cd ${projectRoot} && npx tsx ${backupScript} >> ${logFile} 2>&1`;
  
  console.log('Setting up automated backup cron job...');
  console.log(`Cron command: ${cronCommand}`);
  
  try {
    // Check if crontab is available
    execSync('which crontab', { stdio: 'ignore' });
    
    // Create temporary file with current crontab content
    const tempFile = path.join(projectRoot, 'temp-crontab');
    execSync(`crontab -l > ${tempFile} 2>/dev/null || true`);
    
    // Check if the job already exists
    const currentCrontab = fs.readFileSync(tempFile, 'utf-8');
    if (currentCrontab.includes(backupScript)) {
      console.log('Backup cron job already exists. Skipping setup.');
      fs.unlinkSync(tempFile);
      return;
    }
    
    // Append new cron job
    fs.appendFileSync(tempFile, `${cronCommand}\n`);
    
    // Install new crontab
    execSync(`crontab ${tempFile}`);
    
    // Clean up
    fs.unlinkSync(tempFile);
    
    console.log('Backup cron job set up successfully!');
    console.log('Backups will run daily at 2:00 AM and log to:', logFile);
  } catch (error) {
    console.error('Failed to set up cron job:', error);
    console.log('\nManual setup instructions:');
    console.log('Run "crontab -e" and add the following line:');
    console.log(cronCommand);
  }
}

// Only run on Linux/macOS
if (process.platform === 'win32') {
  console.log('Automatic cron setup is not supported on Windows.');
  console.log('Please use Windows Task Scheduler to set up automated backups:');
  console.log('1. Open Task Scheduler');
  console.log('2. Create a Basic Task');
  console.log('3. Set it to run daily at 2:00 AM');
  console.log('4. Action: Start a program');
  console.log('5. Program/script: npx');
  console.log('6. Arguments: tsx scripts/db-backup.ts');
  console.log('7. Start in: ' + process.cwd());
} else {
  setupCronJob();
} 