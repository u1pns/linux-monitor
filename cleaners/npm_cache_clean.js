/**
 * Cleaner: NPM Cache Clean
 *
 * This script cleans the npm cache and the .npm/_logs directory to free up space.
 * It uses `npm cache clean --force` and removes common large cache directories.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting NPM and General Cache cleaning...');

// npm lives next to the node binary (nvm layout); bare 'npm' is not on cron's PATH.
const npmCandidate = path.join(path.dirname(process.execPath), 'npm');
const npmBin = fs.existsSync(npmCandidate) ? npmCandidate : 'npm';

try {
    // 1. NPM Cache Clean
    console.log(`Executing: ${npmBin} cache clean --force`);
    execSync(`"${npmBin}" cache clean --force`, { stdio: 'inherit' });

    // 2. Clear common large cache directories
    const cachesToClean = [
        '/root/.npm/_logs'
    ];

    cachesToClean.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`Cleaning directory: ${dir}`);
            // We use rm -rf with caution, only on specific subdirectories
            execSync(`rm -rf ${dir}/*`, { stdio: 'inherit' });
        }
    });

    console.log('Cache cleaning finished.');
} catch (error) {
    console.error(`Error during cache cleaning: ${error.message}`);
}
