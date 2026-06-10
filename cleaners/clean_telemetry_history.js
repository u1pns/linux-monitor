/**
 * Cleaner: Telemetry Old Logs
 *
 * This script removes log files in /root/telemetry/log/ that are older than 30 days
 * to prevent the disk from filling up with historical data.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logDir = '/root/telemetry/log/';
const daysToKeep = 30;

console.log(`Checking for old logs in ${logDir}...`);

try {
    if (!fs.existsSync(logDir)) {
        console.log('Log directory does not exist. Nothing to do.');
        return;
    }

    const now = Date.now();
    const files = fs.readdirSync(logDir);

    files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        // Calculate age in days
        const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageInDays > daysToKeep) {
            console.log(`Deleting old log file: ${file} (Age: ${Math.round(ageInDays)} days)`);
            fs.unlinkSync(filePath);
        }
    });

    console.log('Cleanup of telemetry old logs finished.');
} catch (error) {
    console.error(`Error during telemetry logs cleanup: ${error.message}`);
}
