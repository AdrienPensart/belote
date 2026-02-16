#!/usr/bin/env node
// Simple helper to flip a user's admin flag via the existing /admin/users/update endpoint.
// Usage: BASE_URL=https://your-host TOKEN=<base64 auth token> node scripts/update-admin.js --userId 12 --admin true

const args = require('node:util').parseArgs({
  options: {
    userId: { type: 'string' },
    admin: { type: 'string' },
  }
});

const baseUrl = process.env.BASE_URL || 'http://localhost:8787';
const token = process.env.TOKEN;

if (!token) {
  console.error('Missing TOKEN env var (base64 auth token).');
  process.exit(1);
}

if (!args.values.userId || args.values.admin === undefined) {
  console.error('Usage: BASE_URL=... TOKEN=... node scripts/update-admin.js --userId <id> --admin true|false');
  process.exit(1);
}

const adminFlag = args.values.admin.toLowerCase();
if (adminFlag !== 'true' && adminFlag !== 'false') {
  console.error('--admin must be true or false');
  process.exit(1);
}

async function run() {
  const url = `${baseUrl}/admin/users/update?userId=${encodeURIComponent(args.values.userId)}`;
  const body = {
    admin: adminFlag === 'true'
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token.trim()
    },
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error(`Request failed (${resp.status}): ${text}`);
    process.exit(1);
  }
  console.log(`Success (${resp.status}): ${text}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
