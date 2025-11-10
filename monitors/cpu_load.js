/**
 * Monitor: CPU Load
 *
 * This monitor checks the system's CPU load.
 *
 * Strategy:
 * It uses the `vmstat` command to get the CPU idle percentage.
 * An alert is triggered if the idle percentage drops below a predefined threshold (20%),
 * which means the CPU usage is above 80%.
 *
 * State Management:
 * The script maintains its state in the `laststatus/cpu_load.status` file.
 * It writes "high_cpu" or "ok" to the file based on the current load.
 * An alert is sent only when the state changes from "ok" to "high_cpu" to avoid repeated notifications.
 */
/**
 * Monitors the average CPU load. If the load exceeds 50%, it generates an alert
 * including the top 3 processes consuming the most CPU.
 * It is stateful and will only report on changes.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'cpu_load.status');
const idleThreshold = 50; // Alert if CPU idle percentage is BELOW this value (i.e., usage > 50%).

const command = "vmstat 1 2 | tail -1 | awk '{print $15}'";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        console.log(0);
        return;
    }

    const idlePercentage = parseInt(stdout.trim(), 10);
    let currentState = "ok";
    let usagePercentage = 0;

    if (!isNaN(idlePercentage) && idlePercentage < idleThreshold) {
        currentState = "high_cpu";
        usagePercentage = 100 - idlePercentage;
    }

    let lastState = "ok";
    if (fs.existsSync(stateFile)) {
        lastState = fs.readFileSync(stateFile, 'utf8');
    }

    fs.writeFileSync(stateFile, currentState);

    if (currentState === "high_cpu" && lastState === "ok") {
        const topProcessesCommand = "ps -eo pcpu,pmem,comm --sort=-pcpu | head -n 4";
        exec(topProcessesCommand, (procError, procStdout, procStderr) => {
            let topProcessesDetails = "Could not retrieve top processes.";
            if (!procError && !procStderr && procStdout.trim()) {
                const lines = procStdout.trim().split('\n');
                lines.shift(); // Remove header
                topProcessesDetails = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    const cpu = parts[0];
                    const mem = parts[1];
                    const command = parts.slice(2).join(' ');
                    return `- **${command}**: CPU ${cpu}%, RAM ${mem}%`;
                }).join('\n');
            }

            const alertMessage = `## Performance Alert: High CPU Load\n\n` +
                               `CPU usage has crossed the 50% threshold and is currently at **${usagePercentage}%**.\n\n` +
                               `**Top 3 processes by CPU usage:**\n` +
                               `${topProcessesDetails}\n`;
            
            fs.appendFileSync(alertsFile, alertMessage);
            console.log(1); // Alert generated
        });
    } else {
        console.log(0); // No alert generated
    }
});