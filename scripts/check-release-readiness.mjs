import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'README.md',
  'ATTRIBUTIONS.md',
  '.env.example',
  'docs/RELEASE_CHECKLIST.md',
  'docs/ROLLBACK_PLAN.md',
  '.github/workflows/ci.yml',
];

const requiredEnvKeys = [
  'VITE_API_URL',
  'VITE_APP_VERSION',
  'VITE_RELEASE_CHANNEL',
  'VITE_FEATURE_AUDIO_UPLOAD',
  'VITE_FEATURE_PRACTICE_RECORDING',
  'VITE_FEATURE_CLOUD_SYNC',
  'VITE_FEATURE_LEARNING_CENTER',
  'VITE_FEATURE_CHROMATIC_CHARTS',
  'VITE_FEATURE_LOCAL_MONITORING',
  'VITE_FEATURE_OPERATIONS_PANEL',
  'JWT_SECRET',
  'DATABASE_PATH',
  'APP_ORIGIN',
  'PORT',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_FROM',
];

const errors = [];

async function assertFile(path) {
  try {
    await access(join(root, path));
  } catch {
    errors.push(`Missing required file: ${path}`);
  }
}

for (const file of requiredFiles) {
  await assertFile(file);
}

try {
  const envExample = await readFile(join(root, '.env.example'), 'utf8');
  for (const key of requiredEnvKeys) {
    if (!envExample.includes(`${key}=`)) errors.push(`.env.example is missing ${key}`);
  }
} catch {
  errors.push('Unable to read .env.example');
}

try {
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  for (const phrase of ['npm run quality', 'npm run check:budget', '性能与异常恢复原则', '发布']) {
    if (!readme.includes(phrase)) errors.push(`README.md is missing release phrase: ${phrase}`);
  }
} catch {
  errors.push('Unable to read README.md');
}

try {
  const distStat = await stat(join(root, 'dist', 'index.html'));
  if (!distStat.isFile()) errors.push('dist/index.html is not a file');
} catch {
  errors.push('dist/index.html is missing; run npm run build first');
}

if (errors.length > 0) {
  console.error(`Release readiness failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Release readiness passed: required docs, environment template, CI workflow and build output are present.');
