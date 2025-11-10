const { execSync } = require('child_process');
const path = require('path');

/**
 * A simple utility to run a script synchronously and log its execution.
 * @param {string} scriptName - The name of the script to run (e.g., 'alerts.js').
 */
function runScript(scriptName) {
    try {
        console.log(`--- Running ${scriptName} ---`);
        const scriptPath = path.join(__dirname, scriptName);
        // Use 'inherit' to show the output of the child script in real-time.
        execSync(`node ${scriptPath}`, { stdio: 'inherit' });
        console.log(`--- Finished ${scriptName} ---`);
    } catch (error) {
        // The error from the child process will be printed because of 'inherit'.
        console.error(`!!! Critical error running ${scriptName}. Aborting. !!!`);
        // Exit with an error code to signal failure to cron.
        process.exit(1);
    }
}

console.log(`Daily orchestrator started at: ${new Date().toISOString()}`);

// 1. Always run the alerts script.
runScript('alerts.js');

// 2. Check if today is Sunday (getDay() returns 0 for Sunday).
const today = new Date();
if (today.getDay() === 0) {
    console.log('Today is Sunday. Proceeding with cleaner scripts...');
    runScript('cleaners.js');
} else {
    console.log('Today is not Sunday. Skipping cleaner scripts.');
}

console.log(`All tasks completed successfully at: ${new Date().toISOString()}`);
