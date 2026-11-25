// Phase 5 test helper. Run it from the backend folder while the backend is running:
//   node scripts/simulate-uploads.js uploads 5     (several visitors upload at the same moment)
//   node scripts/simulate-uploads.js checks        (the server refuses bad uploads)
import sharp from 'sharp';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

let failures = 0;
function check(label, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`);
  if (!passed) failures += 1;
}

// Registers a visitor and returns the cookie the server gave us (like a browser would keep it)
async function register(name) {
  const res = await fetch(`${BASE}/api/visitors/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: name }),
  });
  if (!res.ok) throw new Error(`Registering "${name}" failed with status ${res.status}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!cookie) throw new Error('The server did not send a visitor cookie');
  return cookie;
}

// A small real PNG. Different numbers give different colours.
function makeImage(n) {
  return sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: (n * 47) % 256, g: (n * 91) % 256, b: (n * 133) % 256 },
    },
  })
    .png()
    .toBuffer();
}

async function upload(cookie, files, consent = 'true') {
  const form = new FormData();
  if (consent !== null) form.append('consent', consent);
  for (const file of files) {
    form.append('photos', new Blob([file.buffer], { type: file.type }), file.filename);
  }

  try {
    const res = await fetch(`${BASE}/api/photos`, {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : {},
      body: form,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      // not JSON
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
}

async function getJson(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, data: await res.json() };
}

// ---------- Test 10: many visitors upload at the same moment ----------
async function simulateUploads(count) {
  const n = Math.min(Math.max(count, 2), 20);
  console.log(`Registering ${n} visitors, then uploading one photo each, all at once...\n`);

  const visitors = await Promise.all(
    Array.from({ length: n }, async (_, i) => ({
      i,
      cookie: await register(`Simulated Visitor ${String.fromCharCode(65 + i)}`),
    }))
  );

  const results = await Promise.all(
    visitors.map(async (v) =>
      upload(v.cookie, [
        { buffer: await makeImage(v.i + 1), filename: `sim-${v.i + 1}.png`, type: 'image/png' },
      ])
    )
  );

  const photos = results.map((r) => r.data?.results?.[0]?.photo).filter(Boolean);
  const ids = photos.map((p) => p.id);
  const urls = photos.map((p) => p.url);
  const succeeded = results.filter((r) => r.status === 201).length;
  const slideshow = await getJson('/api/slideshow');
  const onSlideshow = ids.filter((id) => slideshow.data.photos.some((p) => p.id === id)).length;

  check('Every upload succeeded (HTTP 201)', succeeded === n, `${succeeded} of ${n}`);
  check('Every photo got a unique ID', new Set(ids).size === n, `${new Set(ids).size} unique IDs`);
  check('Every photo was saved as its own file', new Set(urls).size === n, `${new Set(urls).size} files`);
  check('All photos appear in the slideshow list', onSlideshow === n, `${onSlideshow} of ${n}`);

  console.log('\nThese photos are now on your real slideshow. To remove them, delete the');
  console.log('"Simulated Visitor" entries on the admin Visitors page (their photos go too).');
}

// ---------- Tests 5, 6, 7: the SERVER refuses bad uploads ----------
async function runChecks() {
  const cookie = await register('Check Visitor');
  const good = { buffer: await makeImage(1), filename: 'good.png', type: 'image/png' };
  console.log('Sending good and bad uploads straight to the server (no browser checks)...\n');

  const noCookie = await upload(null, [good]);
  check('Upload without registering is refused', noCookie.status === 401, `HTTP ${noCookie.status}`);

  const noConsent = await upload(cookie, [good], null);
  check(
    'Upload without the consent value is refused',
    noConsent.status === 400 && /consent/i.test(noConsent.data?.error || ''),
    `HTTP ${noConsent.status}`
  );

  const consentFalse = await upload(cookie, [good], 'false');
  check('Upload with consent set to "false" is refused', consentFalse.status === 400, `HTTP ${consentFalse.status}`);

  const textFile = await upload(cookie, [
    { buffer: Buffer.from('just some text'), filename: 'notes.txt', type: 'text/plain' },
  ]);
  check(
    'A .txt file is rejected as the wrong format',
    textFile.status === 400 && textFile.data?.results?.[0]?.status === 'rejected',
    `HTTP ${textFile.status}`
  );

  const fake = await upload(cookie, [
    { buffer: Buffer.from('I am not really a picture'), filename: 'fake.jpg', type: 'image/jpeg' },
  ]);
  check(
    'A text file renamed to .jpg is rejected (not a real image)',
    fake.status === 400 && /not a valid image/i.test(fake.data?.results?.[0]?.reason || ''),
    `HTTP ${fake.status}`
  );

  const big = await upload(cookie, [
    { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), filename: 'big.png', type: 'image/png' },
  ]);
  check('A file over 5 MB is refused', big.status === 413, big.status === 0 ? `connection closed: ${big.error}` : `HTTP ${big.status}`);

  const first = await upload(cookie, [good]);
  check('A valid photo with consent is saved', first.status === 201 && first.data?.savedCount === 1, `HTTP ${first.status}`);

  const again = await upload(cookie, [good]);
  check(
    'The same photo again is refused as a duplicate',
    again.status === 400 && again.data?.results?.[0]?.status === 'duplicate',
    `HTTP ${again.status}`
  );

  const mine = await getJson('/api/photos/mine', cookie);
  check('Refused uploads saved nothing (only 1 photo exists)', mine.data.photos?.length === 1, `${mine.data.photos?.length} photo(s)`);

  const photoId = first.data?.results?.[0]?.photo?.id;
  const remove = await fetch(`${BASE}/api/photos/${photoId}`, { method: 'DELETE', headers: { Cookie: cookie } });
  check('The visitor can delete their own photo', remove.status === 200, `HTTP ${remove.status}`);

  const after = await getJson('/api/photos/mine', cookie);
  check('After deleting, no photos remain', after.data.photos?.length === 0, `${after.data.photos?.length} photo(s)`);

  console.log('\nA visitor called "Check Visitor" was created. You can delete it on the admin Visitors page.');
}

const [command = 'help', argument] = process.argv.slice(2);

try {
  if (command === 'uploads') {
    await simulateUploads(Number(argument) || 5);
  } else if (command === 'checks') {
    await runChecks();
  } else {
    console.log('Usage:');
    console.log('  node scripts/simulate-uploads.js uploads 5');
    console.log('  node scripts/simulate-uploads.js checks');
  }
} catch (err) {
  console.error(`Could not finish: ${err.message}`);
  console.error('Is the backend running? Start it with "npm run dev" in the project root.');
  process.exit(1);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures > 0 ? 1 : 0);
