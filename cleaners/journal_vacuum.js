/**
 * Cleaner: Journal Vacuum
 *
 * This script executes the `journalctl --vacuum-size=500M` command to reduce
 * the total size of the systemd journal files on disk to 500MB.
 */
const { exec } = require('child_process');

const command = 'journalctl --vacuum-size=500M';

console.log(`Executing: ${command}`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error executing journalctl vacuum: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`stderr from journalctl vacuum: ${stderr}`);
        return;
    }
    console.log(stdout.trim());
});
