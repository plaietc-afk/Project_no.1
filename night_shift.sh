#!/bin/bash

LOGFILE="/root/.openclaw/workspace/Project_no.1/night_shift.log"
echo "Starting night shift at $(date)" > $LOGFILE

# 1. Backend - Basic proxy route
echo "Dispatching backend task 1..." >> $LOGFILE
openclaw agent --agent dev-backend --message "Open /root/.openclaw/workspace/Project_no.1/backend/src/index.ts. Add basic intercept logic for OpenAI requests inside the createProxyMiddleware config to just console.log the request body size. Commit and push to origin main." >> $LOGFILE 2>&1
echo "Finished Backend step 1 at $(date)" >> $LOGFILE

sleep 2400 # 40 mins

# 2. Frontend - Basic Dashboard Layout
echo "Dispatching frontend task 1..." >> $LOGFILE
openclaw agent --agent dev-frontend --message "Open /root/.openclaw/workspace/Project_no.1/frontend/src/app/page.tsx. Replace it with a minimal Tailwind Sidebar Layout. The title should be SOMA TOKEN MONITORING SYSTEM. Add a placeholder card for 'Total Tokens Used'. Commit and push to origin main." >> $LOGFILE 2>&1
echo "Finished Frontend step 1 at $(date)" >> $LOGFILE

sleep 2400 # 40 mins

# 3. Backend - Database Setup
echo "Dispatching backend task 2..." >> $LOGFILE
openclaw agent --agent dev-backend --message "In /root/.openclaw/workspace/Project_no.1/backend/src, create db.ts using better-sqlite3 to create a table 'token_logs' (id, model, prompt_tokens, completion_tokens, created_at). Import it in index.ts. Commit and push to origin main." >> $LOGFILE 2>&1
echo "Finished Backend step 2 at $(date)" >> $LOGFILE

sleep 2400 # 40 mins

# 4. QA - Code Review
echo "Dispatching qa task 1..." >> $LOGFILE
openclaw agent --agent qa-tester --message "Review the code in backend/src/index.ts and frontend/src/app/page.tsx. Create a QA_REPORT.md in the root directory with 2-3 suggestions for improvement. Commit and push to origin main." >> $LOGFILE 2>&1
echo "Finished QA step 1 at $(date)" >> $LOGFILE

sleep 1800 # 30 mins

# 5. PM - Update Plan
echo "Dispatching pm task 1..." >> $LOGFILE
openclaw agent --agent pm --message "Review the commits from tonight. Check off completed items in PROJECT_PLAN.md. Commit and push to origin main." >> $LOGFILE 2>&1
echo "Night shift completed at $(date)" >> $LOGFILE
