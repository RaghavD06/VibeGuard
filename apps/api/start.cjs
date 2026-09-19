const { spawnSync } = require('node:child_process');

if (!process.env.DATABASE_URL) {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) {
    console.error(`Database configuration is incomplete: ${missing.join(', ')}`);
    process.exit(1);
  }
  const user = encodeURIComponent(process.env.DB_USER);
  const password = encodeURIComponent(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const database = encodeURIComponent(process.env.DB_NAME);
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

const migrate = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit',
});
if (migrate.error) console.error(`Could not start database migrations: ${migrate.error.message}`);
if (migrate.status !== 0) process.exit(migrate.status || 1);
require('./dist/index.js');
