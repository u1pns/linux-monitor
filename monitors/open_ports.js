/**
 * Monitor: Open Ports
 *
 * This monitor checks for TCP/UDP ports currently in the LISTEN state.
 * It alerts if NEW ports appear that were not open during the previous run.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'open_ports.status');

try {
    // ss -tuln: TCP/UDP, Listening, Numeric (no DNS resolution for speed)
    // We parse the output to get "Address:Port"
    const command = `ss -tuln | awk 'NR>1 {print $5}' | sort -u`;
    
    const stdout = execSync(command, { encoding: 'utf8' });
    const currentPorts = stdout.trim().split('\n').filter(line => line);

    let alertCount = 0;

    if (fs.existsSync(stateFile)) {
        const lastPorts = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
        
        // Check for NEW ports only
        const newPorts = currentPorts.filter(p => !lastPorts.includes(p));

        if (newPorts.length > 0) {
            const list = newPorts.map(p => '- `' + p + '`').join('\n');
            const alertMessage = '## Network Alert: New Open Ports Detected\n\n' +
                               'The following network ports have started listening since the last check:\n' +
                               list + '\n\n' +
                               'Check running processes immediately.\n\n';
            
            fs.appendFileSync(alertsFile, alertMessage);
            alertCount = 1;
        }
    } else {
        // First run initialization
    }

    // Update state
    fs.writeFileSync(stateFile, currentPorts.join('\n'));
    console.log(alertCount);

} catch (error) {
    const errorMessage = '## Monitor Error: open_ports.js\n\n```\n' + error.message + '\n```\n';
    fs.appendFileSync(alertsFile, errorMessage);
    console.log(1);
}