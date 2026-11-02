# Server Fix Instructions - DO NOT DISRUPT LIVE APP

## Context
- Live app runs via cPanel Phusion Passenger on port 3000
- App root: /home/toairjsv/sellup/Sellup/ (where server.js lives)
- PassengerAppRoot is configured as /home/toairjsv/sellup
- Health check: http://127.0.0.1:3000/api/health returns 200 ✅
- No .env file exists in active app directories
- Paystack keys are missing → plan upgrades show "Online payments not configured"

## Step 1: Create .env file (safe - dotenv won't overwrite existing cPanel env vars)

Create /home/toairjsv/sellup/Sellup/.env with this content:

```
# ============================================================
# Sell Up Environment Variables - Production
# ============================================================

# --- Application ---
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://sellup.ng
API_URL=https://sellup.ng
NEXT_PUBLIC_BASE_DOMAIN=sellup.ng

# --- Supabase (PostgreSQL + Auth + Storage) ---
NEXT_PUBLIC_SUPABASE_URL=https://fnpvsgtfjdwlypblzxcu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHZzZ3RmamR3bHlwYmx6eGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNzc3ODksImV4cCI6MjEwMTg1Mzc4OX0.Et0gO1zXbOP7StFzytG4K3HpJrhFwbKWMosIUTyeDS4
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHZzZ3RmamR3bHlwYmx6eGN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjI3Nzc4OSwiZXhwIjoyMTAxODUzNzg5fQ.ptK8TBMsj65BcPpDctWECx4p5GklMK6KAJydpP6kt4o

# --- JWT ---
JWT_SECRET=
JWT_REFRESH_SECRET=

# --- Database ---
DATABASE_URL=postgresql://postgres.fnpvsgtfjdwlypblzxcu:AmazingVendor4590!!@aws-1-eu-west-3.pooler.supabase.com:5432/postgres

# --- Payments (Paystack + Flutterwave) ---
PAYSTACK_SECRET_KEY=sk_live_c8e5353bac9f000bf19818360f357846149c9393
PAYSTACK_PUBLIC_KEY=pk_live_70f139864cfe992e6a4f202c7d6c671aeb983122
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=

# --- Storage (cPanel filesystem for image uploads) ---
CPANEL_UPLOAD_DIRECTORY=/home/toairjsv/public_html/uploads
CPANEL_BASE_URL=https://sellup.ng/uploads
MEDIA_BASE_URL=https://sellup.ng/uploads
MAX_IMAGE_BYTES=8388608
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp,image/gif

# --- Email ---
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@sellup.ng
SENDGRID_FROM_NAME=Sell Up

# --- SMS ---
TERMII_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# --- WhatsApp ---
WHATSAPP_CONFIG=

# --- Platform Admin ---
PLATFORM_ADMIN_EMAIL=
PLATFORM_ADMIN_PASSWORD=
```

## Step 2: Create uploads directory
```
mkdir -p /home/toairjsv/public_html/uploads
```

## Step 3: Restart Passenger app to pick up new env vars
```
# Option A: Touch restart.txt (Passenger standard)
touch /home/toairjsv/sellup/Sellup/tmp/restart.txt

# Option B: If tmp dir doesn't exist, create it first
mkdir -p /home/toairjsv/sellup/Sellup/tmp
touch /home/toairjsv/sellup/Sellup/tmp/restart.txt
```

## Step 4: Verify
```
curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/health
# Expect: 200

# Verify Paystack keys are loaded
grep PAYSTACK /home/toairjsv/sellup/Sellup/.env
```

## Step 5: Fix Product Image Uploads
The dashboard product page uploads to Supabase Storage directly. Verify in Supabase Dashboard:
- Storage → Buckets → `store-images` bucket exists
- RLS policies allow authenticated uploads

OR if you want cPanel filesystem storage instead, the /api/upload route is already configured - just ensure the env vars above are set and the uploads directory exists.

## What NOT to touch
- /home/toairjsv/pgdata/ (PostgreSQL data)
- /home/toairjsv/app.sellup.ng/ (cPanel app config)
- /home/toairjsv/public_html/ (web root)
- /home/toairjsv/ssl/ (SSL certs)
- Any running Passenger processes
