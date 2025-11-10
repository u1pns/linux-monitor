/**
 * Monitor: PM2 Process Status
 *
 * This monitor checks the status of all applications managed by PM2.
 *
 * Strategy:
 * It uses the `pm2 jlist` command to get a JSON list of all running processes.
 * It then filters this list to find any processes that are not in an "online" state.
 *
 * State Management:
 * The script stores a JSON representation of the offline processes in `laststatus/pm2_status.status`.
 * An alert is sent only if the list of offline application names has changed since the last check.
 * If all processes are online, the state file is updated with an empty array.
 */
/**
 * Checks the status of all applications managed by PM2 and generates an alert
 * if any process is not in an "online" state.
 * It is stateful and will only report on changes in process status.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'pm2_status.status');

// Command to get PM2 process list in JSON format.
const command = "pm2 jlist";

exec(command, (error, stdout, stderr) => {
    if (error) {
        // PM2 might not be running, which is not an error to report.
        return;
    }

    try {
        const processes = JSON.parse(stdout);
        const offlineProcesses = processes.filter(p => p.pm2_env.status !== 'online');

        let lastOffline = [];
        if (fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8')) {
            lastOffline = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        }

        // Create a simple representation of the offline processes for comparison.
        const offlineNames = offlineProcesses.map(p => p.name).sort();
        const lastOfflineNames = lastOffline.map(p => p.name).sort();

        // Compare if the list of offline apps has changed.
        if (JSON.stringify(offlineNames) !== JSON.stringify(lastOfflineNames)) {
            let alertGenerated = false;
            if (offlineNames.length > 0) {
                const details = offlineProcesses.map(p => `- ${p.name} (status: ${p.pm2_env.status})`).join('\n');
                const alertMessage = `## Application Alert: PM2 Process Offline\n\nThe following PM2-managed applications are not online:\n\n	${details}\n\n`;
                fs.appendFileSync(alertsFile, alertMessage);
                alertGenerated = true;
            }
            
            // Update the state with the new list of offline processes.
            fs.writeFileSync(stateFile, JSON.stringify(offlineProcesses));
            console.log(alertGenerated ? 1 : 0);
        } else {
            console.log(0);
        }
    } catch (e) {
        console.log(0); // JSON parsing error, no alert.
    }
});