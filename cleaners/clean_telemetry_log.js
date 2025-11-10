/**
 * DISCLAIMER: This cleaner script is an example tailored to a specific environment.
 * It may not be applicable to your installation. If you don't use PM2 telemetry logs,
 * you can safely delete this file or add `return;` at the beginning of the script.
 *
 * Cleaner: Telemetry Log
 *
 * This script checks the size of the PM2 telemetry log file. If the file exceeds
 * 100MB, it truncates it, keeping only the most recent 100MB of data.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = '/root/.pm2/logs/telemetry-out.log';
const maxSizeMB = 100;
const maxSizeBytes = maxSizeMB * 1024 * 1024;

console.log(`Checking size of ${logFile}...`);

try {
    if (!fs.existsSync(logFile)) {
        console.log('Log file does not exist. Nothing to do.');
        return;
    }

    const stats = fs.statSync(logFile);
    const currentSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    if (stats.size > maxSizeBytes) {
        console.log(`File size (${currentSizeMB}MB) exceeds ${maxSizeMB}MB. Truncating...`);
        const tempFile = logFile + '.tmp';
        // This command saves the last 100MB to a temp file, then replaces the original.
        const command = `tail -c ${maxSizeBytes} "${logFile}" > "${tempFile}" && mv "${tempFile}" "${logFile}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error truncating file: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr during truncation: ${stderr}`);
                return;
            }
            console.log(`Successfully truncated ${logFile} to approximately ${maxSizeMB}MB.`);
        });
    } else {
        console.log(`File size (${currentSizeMB}MB) is within the ${maxSizeMB}MB limit. No action needed.`);
    }
} catch (error) {
    console.error(`Failed to process file ${logFile}: ${error.message}`);
}
