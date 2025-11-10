/**
 * Monitor: IP Blocks (with Summary)
 *
 * This monitor checks for new IP address bans recorded by Fail2Ban and sends a summary alert if the number of new bans is high.
 *
 * Strategy:
 * 1. It reads the Fail2Ban log file (`/var/log/fail2ban.log`) to get a complete, unique list of all "Ban" log lines.
 * 2. It compares this list with the one from the last run (stored in the state file) to find only the new ban entries.
 * 3. If the number of new bans meets or exceeds the `MIN_BANS_FOR_SUMMARY_ALERT` threshold, it generates a summary.
 * 4. The summary parses the service name (e.g., "sshd") from each new ban line and counts the number of bans per service to prepare a single, consolidated alert.
 *
 * State Management:
 * An alert is sent ONLY if the number of new bans is above the defined threshold.
 * If there are any new bans (even if below the threshold), the state file (`laststatus/ip_blocks.status`) is updated
 * with the full, current list of bans. This prevents old, unreported bans from being included in a future summary.
 */
/**
 * Checks for new IP address bans recorded by Fail2Ban. If the number of new
 * bans exceeds a threshold (20), it generates a summary alert grouped by service.
 * It is stateful and will only report on new ban summaries.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// If the number of new bans is below this threshold, no alert will be sent.
// If it's equal or higher, a summary alert will be generated.
// Set to 1 for testing, can be raised to a high number (e.g., 100) in production to reduce noise.
const MIN_BANS_FOR_SUMMARY_ALERT = 20;

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'ip_blocks.status');
const fail2banLog = '/var/log/fail2ban.log';

const command = `grep 'Ban' ${fail2banLog} | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort -u`;

exec(command, (error, stdout, stderr) => {
    if (error) { // This can happen if grep finds no matching lines.
        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
        }
        return;
    }

    const currentLogLines = stdout.trim().split('\n').filter(line => line);

    let lastLogLines = [];
    if (fs.existsSync(stateFile)) {
        lastLogLines = fs.readFileSync(stateFile, 'utf8').trim().split('\n').filter(line => line);
    }

    const newBanLines = currentLogLines.filter(line => !lastLogLines.includes(line));

    let alertGenerated = false;
    if (newBanLines.length > 0) {
        // If new bans are found, check if they meet the threshold for alerting.
        if (newBanLines.length >= MIN_BANS_FOR_SUMMARY_ALERT) {
            const serviceCounts = {};
            // This regex is designed to capture the service name (e.g., "sshd") from a Fail2Ban log line.
            // It specifically looks for the content in the second pair of brackets, which follows "NOTICE  ".
            const serviceRegex = /NOTICE\s+\[(.*?)\]/;

            newBanLines.forEach(line => {
                const match = line.match(serviceRegex);
                // The service name is in the first capture group (index 1).
                const service = match && match[1] ? match[1] : 'unknown';
                serviceCounts[service] = (serviceCounts[service] || 0) + 1;
            });

            const summaryDetails = Object.entries(serviceCounts)
                .map(([service, count]) => `- ${service}: ${count} ban(s)`)
                .join('\n');

            const alertMessage = `## Security Alert: ${newBanLines.length} New IP Ban(s) Detected\n\n` +
                               `A high volume of new IP bans was detected. Summary by service:\n` +
                               `${summaryDetails}\n\n`;
            
            fs.appendFileSync(alertsFile, alertMessage);
            alertGenerated = true;
        }

        // ALWAYS update the state file with the new complete list if any new lines were found.
        // This prevents re-alerting for bans that were below the threshold.
        fs.writeFileSync(stateFile, currentLogLines.join('\n'));
    }

    console.log(alertGenerated ? 1 : 0);
});