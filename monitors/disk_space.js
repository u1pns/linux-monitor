/**
 * Monitor: Disk Space
 *
 * This monitor checks the disk space usage of the root filesystem.
 *
 * Strategy:
 * It uses the `df` command to get the available disk space in GB.
 * An alert is triggered if the available space drops below a predefined threshold (e.g., 2GB).
 *
 * State Management:
 * The script saves the last alert message to the `laststatus/disk_space.status` file.
 * An alert is sent only when the alert message changes. If the disk usage returns to normal,
 * the state file is updated with an empty string, and no new alert is sent until the
 * threshold is exceeded again. This prevents repeated notifications for the same event.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'disk_space.status');
const minAvailableGB = 3; // Alert if available space drops below this amount in GB (2GB on a 19GB disk warned too late)

// df -B 1G / outputs sizes in 1GB blocks. 
// Example output:
// Filesystem     1G-blocks  Used Available Use% Mounted on
// /dev/sda1            19G   11G        7G  61% /
const command = "df -B 1G --output=avail / | tail -n 1 | tr -d 'G '";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        const errorMessage = `Disk Space Check Error: Failed to get disk usage. ${error ? error.message : stderr}\n`;
        // We don't want to spam this error, but we should report it once.
        if (!fs.existsSync(stateFile) || fs.readFileSync(stateFile, 'utf8') !== errorMessage) {
            fs.appendFileSync(alertsFile, "## Disk Space Monitor Error\n" + errorMessage);
            fs.writeFileSync(stateFile, errorMessage);
            console.log(1);
        } else {
            console.log(0);
        }
        return;
    }

    const availableGB = parseInt(stdout.trim(), 10);
    let currentAlert = "";

    if (!isNaN(availableGB) && availableGB < minAvailableGB) {
        currentAlert = `CRITICAL: Disk space is running low. Only ${availableGB}GB available on the root partition (threshold is ${minAvailableGB}GB).\n`;
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
