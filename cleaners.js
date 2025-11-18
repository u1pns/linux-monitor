const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cleanersDir = path.join(__dirname, 'cleaners');
const logFile = path.join(__dirname, 'cleaners.log');

function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

try {
  log('Starting cleaners script...');

  const files = fs.readdirSync(cleanersDir);
  const cleanerFiles = files.filter(file => file.endsWith('.js'));

  if (cleanerFiles.length === 0) {
    log('No cleaners found to execute.');
  } else {
    cleanerFiles.forEach(file => {
      log(`Executing cleaner: ${file}`);
      const filePath = path.join(cleanersDir, file);
      try {
        const output = execSync(`node ${filePath}`, { encoding: 'utf8' });
        if (output.trim()) {
          log(`Output from ${file}: ${output.trim()}`);
        }
        log(`Cleaner ${file} finished.`);
      } catch (error) {
        log(`Error executing ${file}: ${error.message}`);
        if (error.stderr) {
          log(`Error output from ${file}: ${error.stderr.trim()}`);
        }
      }
    });
  }
} catch (error) {
  log(`Unhandled error in cleaners.js: ${error.message}`);
}

