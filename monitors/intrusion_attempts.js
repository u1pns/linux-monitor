/**
 * Monitor: Intrusion Attempts
 *
 * This monitor checks for a high number of failed SSH login attempts since the last run.
 *
 * Strategy:
 * It uses `journalctl` to count "Failed password" entries for `ssh.service`.
 * The check is time-based, scanning logs only since the last successful execution.
 * If the count exceeds a threshold (20), it identifies the top 5 offending IP addresses.
 *
 * State Management:
 * - `intrusion_attempts.timestamp`: Stores the Unix timestamp of the last run.
 * - `intrusion_attempts.status`: Stores the log entries from the last alert to prevent duplicates.
 * An alert is sent only if there's a new pattern of failures.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const contentStateFile = path.join(__dirname, 'laststatus', 'intrusion_attempts.status');
const timeStateFile = path.join(__dirname, 'laststatus', 'intrusion_attempts.timestamp');
const failureThreshold = 20;
let alertCount = 0;

try {
    // Determine the time window for the log query
    let sinceTime = '--since "24 hours ago"'; // Default for the first run
    if (fs.existsSync(timeStateFile)) {
        const lastRunTimestamp = fs.readFileSync(timeStateFile, 'utf8').trim();
        // Use '@' to specify a Unix timestamp to journalctl
        sinceTime = `--since @${lastRunTimestamp}`;
    }

    // Command to get all failed password lines since the last run, uniquely sorted
    const command = `journalctl -u ssh.service ${sinceTime} | grep 'Failed password' | sort -u`;
    
    let stdout;
    try {
        stdout = execSync(command, { encoding: 'utf8' });
    } catch (error) {
        // A non-zero exit code from grep (code 1) means no matches were found, which is not an error.
        // Any other error code is a genuine problem.
        if (error.status > 1) {
            throw error;
        }
        // If no matches, stdout will be empty, and we can proceed.
        stdout = '';
    }

    const currentFailures = stdout.trim().split('\n').filter(line => line);

    if (currentFailures.length === 0) {
        if (fs.existsSync(contentStateFile)) {
            fs.unlinkSync(contentStateFile);
        }
    } else {
        let lastFailures = [];
        if (fs.existsSync(contentStateFile)) {
            lastFailures = fs.readFileSync(contentStateFile, 'utf8').trim().split('\n').filter(line => line);
        }

        const newFailures = currentFailures.filter(line => !lastFailures.includes(line));

        if (newFailures.length > failureThreshold) {
            // Extract and count offending IPs using pure JavaScript to avoid shell injection.
            const ipCounts = {};
            newFailures.forEach(line => {
                const match = line.match(/from ([0-9.]+)/);
                if (match) {
                    ipCounts[match[1]] = (ipCounts[match[1]] || 0) + 1;
                }
            });
            const topOffenders = Object.entries(ipCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([ip, count]) => `${count} ${ip}`)
                .join('\n') || 'Could not determine top offending IPs.';

            const alertMessage = `## Security Alert: ${newFailures.length} New Failed Logins\nTop new offending IPs:\n\`\`\`\n${topOffenders}\n\`\`\`\n\n`;
            fs.appendFileSync(alertsFile, alertMessage);
            fs.writeFileSync(contentStateFile, currentFailures.join('\n'));
            alertCount = 1;
        } else if (newFailures.length > 0) {
            // If there are new failures but they are below the threshold, we still update the state to avoid re-alerting for them later.
            fs.writeFileSync(contentStateFile, currentFailures.join('\n'));
        }
    }
} catch (error) {
    const errorMessage = `## Monitor Error: intrusion_attempts.js\n\nAn error occurred:\n\`\`\`\n${error.message}\n\`\`\`\n`;
    fs.appendFileSync(alertsFile, errorMessage);
    alertCount = 1;
} finally {
    // Always record the timestamp of this execution for the next run.
    // Use seconds for the Unix timestamp.
    const newTimestamp = Math.floor(Date.now() / 1000);
    fs.writeFileSync(timeStateFile, newTimestamp.toString());
    console.log(alertCount);
}