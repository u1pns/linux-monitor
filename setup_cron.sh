#!/bin/bash

# This script sets up a cron job to run the main monitoring and cleaning script.
# It is idempotent, meaning it will not create a duplicate job if one already exists.

# Get the absolute path of the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Define the cron job command and schedule
CRON_COMMAND=""${DIR}/run_daily.js""
CRON_SCHEDULE="0 8 * * *"
CRON_JOB="${CRON_SCHEDULE} cd ${DIR} && /usr/bin/node run_daily.js > /dev/null 2>&1"

# Check if the cron job already exists
# Use grep -F for fixed string matching and -q for quiet mode
if crontab -l 2>/dev/null | grep -Fq -- "${CRON_JOB}"; then
    echo "Cron job already exists. No changes made."
else
    # Remove the old run_all.sh or run_daily.js job if it exists, then add the new one
    (crontab -l 2>/dev/null | grep -v "run_all.sh" | grep -v "run_daily.js"; echo "${CRON_JOB}") | crontab -
    echo "Cron job for run_daily.js scheduled to run daily at 8 AM."
fi
