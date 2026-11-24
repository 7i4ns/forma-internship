import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: resolve('apps/api/.env'), quiet: true });
const { Pool } = require('pg');
const { JwtService } = require('@nestjs/jwt');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3001';
const email = `test-${randomUUID()}@example.com`;
const raceEmail = `test-${randomUUID()}@example.com`;
const password = 'Test-pass123!';
let assertions = 0;
async function request(path, { method = 'POST', body, cookie, origin } = {}) {
  const res = await fetch(`${base}/auth/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie'), cache: res.headers.get('cache-control') };
}
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions++; console.log(`PASS ${label}`); }
try {
  equal((await request('me', { method: 'GET' })).status, 401, 'anonymous profile blocked');
  for (const [body, field] of [[{}, 'email'], [{ email: 'bad', password }, 'email'], [{ email, password: '' }, 'password'], [{ email, password: 'abcdefgh' }, 'password'], [{ email, password: 'abc12345 ' }, 'password'], [{ email, password: 12345678 }, 'password'], [{ email, password: 'a'.repeat(129)+'1' }, 'password']]) {
    const result = await request('signup', { body });
    equal(result.status, 400, `invalid ${field} rejected`);
    assert.ok(result.data.errors[field]);
  }
  equal((await request('signup', { body: { email, password, role: 'admin' } })).status, 400, 'unexpected fields rejected');
  equal((await request('signup', { body: { email, password }, origin: 'https://untrusted.example' })).status, 403, 'untrusted origin blocked');
  const signup = await request('signup', { body: { email: `  ${email.toUpperCase()}  `, password } });
  equal(signup.status, 201, 'signup succeeds');
  equal(signup.data.user.email, email, 'email normalized');
  equal(Object.keys(signup.data.user).sort(), ['created_at', 'email', 'id', 'name', 'role', 'status'], 'password omitted from response');
  equal((await request('signup', { body: { email, password } })).status, 409, 'duplicate signup rejected');
  const races = await Promise.all([1, 2].map(() => request('signup', { body: { email: raceEmail, password } })));
  equal(races.map(result => result.status).sort(), [201, 409], 'concurrent duplicate protected by database');
  equal((await request('login', { body: { email: `missing-${randomUUID()}@example.com`, password } })).data.code, 'EMAIL_NOT_FOUND', 'unknown account reported');
  equal((await request('login', { body: { email, password: 'Wrong-pass123!' } })).data.code, 'WRONG_PASSWORD', 'wrong password reported');
  const login = await request('login', { body: { email, password } });
  equal(login.status, 200, 'login succeeds');
  assert.match(login.cookie, /HttpOnly/); assert.match(login.cookie, /SameSite=Lax/); assert.match(login.cookie, /Max-Age=3600/);
  equal(login.cache, 'no-store', 'auth responses not cached');
  const cookie = login.cookie.split(';')[0];
  equal((await request('me', { method: 'GET', cookie })).data.user.email, email, 'session restores profile');
  equal((await request('me', { method: 'GET', cookie: 'internship_session=invalid' })).status, 401, 'tampered session rejected');
  const expired = new JwtService().sign({ sub: signup.data.user.id }, { secret: process.env.JWT_SECRET, expiresIn: -1, issuer: 'internship-api', audience: 'internship-web' });
  equal((await request('me', { method: 'GET', cookie: `internship_session=${expired}` })).status, 401, 'expired session rejected');
  const logout = await request('logout', { cookie });
  equal(logout.status, 200, 'logout succeeds'); assert.match(logout.cookie, /Max-Age=0/);
  equal((await request('me', { method: 'GET' })).status, 401, 'cleared cookie cannot access profile');
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email=$1', [email]);
  assert.match(rows[0].password_hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/); assert.ok(!rows[0].password_hash.includes(password));
  console.log('PASS salted password hash stored in PostgreSQL');
  console.log(`Auth integration checks completed (${assertions} assertions + cookie/hash checks).`);
} finally {
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [[email, raceEmail]]);
  await pool.end();
}
