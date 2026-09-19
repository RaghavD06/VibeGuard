import { execFileSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated PostgreSQL test database before running API tests.');
}

const url = new URL(baseUrl);
if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
  throw new Error('TEST_DATABASE_URL must point to PostgreSQL.');
}

// A random schema per run prevents writes to the development schema.
url.searchParams.set('schema', `vibeguard_test_${crypto.randomBytes(8).toString('hex')}`);
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'pipe'
});
