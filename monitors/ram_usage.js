/**
 * Monitor: RAM Usage
 *
 * This monitor checks the system's available RAM.
 *
 * Strategy:
 * It uses the `free -m` command to get the total and available memory in megabytes.
 * An alert is triggered if the available RAM percentage drops below a predefined threshold (15%).
 *
 * State Management:
 * The script maintains its state in the `laststatus/ram_usage.status` file.
 * It writes "low_ram" or "ok" to the file based on the current available memory.
 * An alert is sent only when the state changes from "ok" to "low_ram" to avoid repeated notifications.
 */
/**
 * Monitors the system's available RAM. If the available memory drops below 15%,
 * it generates an alert.
 * It is stateful and will only report when the state changes to "low_ram".
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'ram_usage.status');
const availableThreshold = 15; // Alert if available RAM is BELOW this percentage.

const command = "free -m | grep Mem:";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        console.log(0);
        return;
    }

    const parts = stdout.trim().split(/\s+/);
    const totalMemory = parseInt(parts[1], 10);
    const availableMemory = parseInt(parts[6], 10);

    if (!isNaN(totalMemory) && !isNaN(availableMemory)) {
        const availablePercentage = Math.round((availableMemory / totalMemory) * 100);
        let currentState = "ok";

        if (availablePercentage < availableThreshold) {
            currentState = "low_ram";
        }

        let lastState = "ok";
        if (fs.existsSync(stateFile)) {
            lastState = fs.readFileSync(stateFile, 'utf8');
        }

        // Alert only when the state *changes* from ok to low_ram.
        if (currentState === "low_ram" && lastState === "ok") {
            const alertMessage = `## Performance Alert: Low Memory\n\nAvailable RAM has dropped below the ${availableThreshold}% threshold and is currently at **${availablePercentage}%**.`;
            fs.appendFileSync(alertsFile, alertMessage);
            console.log(1);
        } else {
            console.log(0);
        }
        
        // Always save the current state for the next comparison.
        fs.writeFileSync(stateFile, currentState);
    } else {
        console.log(0);
    }
});