/**
 * Monitor: Disk Space
 *
 * This monitor checks the disk space usage of the root filesystem.
 *
 * Strategy:
 * It uses the `df` command to get the percentage of disk space used.
 * An alert is triggered if the usage exceeds a predefined threshold (85%).
 *
 * State Management:
 * The script saves the last alert message to the `laststatus/disk_space.status` file.
 * An alert is sent only when the alert message changes. If the disk usage returns to normal,
 * the state file is updated with an empty string, and no new alert is sent until the
 * threshold is exceeded again. This prevents repeated notifications for the same event.
 */
/**
 * Monitors disk space usage for the root partition (/). Generates an alert if
 * the usage exceeds 90%.
 * It is stateful and will only report on changes.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'disk_space.status');
const usageThreshold = 85; // Alert if usage is over 85%

const command = "df --output=pcent / | tail -n 1 | tr -d ' %'";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        const errorMessage = `Disk Space Check Error: Failed to get disk usage. ${error ? error.message : stderr}\n`;
        // We don't want to spam this error, but we should report it once.
        if (!fs.existsSync(stateFile) || fs.readFileSync(stateFile, 'utf8') !== errorMessage) {
            fs.appendFileSync(alertsFile, "## Disk Space Monitor Error\n" + errorMessage);
            fs.writeFileSync(stateFile, errorMessage);
        }
        return;
    }

    const usage = parseInt(stdout.trim(), 10);
    let currentAlert = "";

    if (!isNaN(usage) && usage > usageThreshold) {
        currentAlert = `CRITICAL: Disk space usage is at ${usage}%, exceeding the threshold of ${usageThreshold}%.
`;
    }

    let lastAlert = "";
    if (fs.existsSync(stateFile)) {
        lastAlert = fs.readFileSync(stateFile, 'utf8');
    }

    if (currentAlert !== lastAlert) {
        fs.writeFileSync(stateFile, currentAlert);
        if (currentAlert) {
            const markdownAlert = `## Disk Space Alert\n${currentAlert}\n`;
            fs.appendFileSync(alertsFile, markdownAlert);
            console.log(1); // Alert generated
        } else {
            console.log(0); // Condition cleared, no alert
        }
    } else {
        console.log(0); // State unchanged, no alert
    }
});