// Removes the test visitors created by simulate-uploads.js, together with their photos.
// Run from the backend folder while the backend is running:
//   node scripts/cleanup-test-data.js
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:5000';
// Only these test names are removed. Real visitors are never touched.
const TEST_NAME = /^(Simulated Visitor [A-Z]|Check Visitor)$/;

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in backend/.env');
  }

  const login = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) {
    throw new Error(`Admin login failed (HTTP ${login.status}). Check backend/.env and restart the backend.`);
  }
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

  const listRes = await fetch(`${BASE}/api/admin/visitors`, { headers: { Cookie: cookie } });
  const { visitors } = await listRes.json();
  const targets = visitors.filter((v) => TEST_NAME.test(v.fullName));

  if (targets.length === 0) {
    console.log('No test visitors found. Nothing to remove.');
  }

  let removedVisitors = 0;
  let removedPhotos = 0;
  for (const visitor of targets) {
    const res = await fetch(`${BASE}/api/admin/visitors/${visitor.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    if (res.ok) {
      removedVisitors += 1;
      removedPhotos += visitor.photoCount;
    } else {
      console.log(`Could not delete "${visitor.fullName}" (HTTP ${res.status})`);
    }
  }

  await fetch(`${BASE}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie } });

  console.log(`Removed ${removedVisitors} test visitor(s) and ${removedPhotos} photo(s).`);
  console.log(`${visitors.length - removedVisitors} real visitor(s) were left untouched.`);
}

try {
  await main();
} catch (err) {
  console.error(`Could not finish: ${err.message}`);
  console.error('Is the backend running? Start it with "npm run dev" in the project root.');
  process.exit(1);
}