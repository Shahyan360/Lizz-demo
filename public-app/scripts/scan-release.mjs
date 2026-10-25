import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const issues = [];
let checked = 0;
const excluded = new Set([
  'node_modules',
  '.next',
  '.git',
  '.vercel',
  'test-results',
  'playwright-report',
]);
const secretPatterns = [
  /AIza[0-9A-Za-z_-]{30,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{25,}/g,
  /vercel_blob_rw_[A-Za-z0-9_]+/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      excluded.has(item.name) ||
      (item.name.startsWith('.env') && item.name !== '.env.example') ||
      item.name.endsWith('.tsbuildinfo')
    )
      continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(file);
      continue;
    }
    if (
      !/\.(tsx?|m?js|json|md|ya?ml|example|css|svg)$/.test(item.name) ||
      item.name === 'package-lock.json'
    )
      continue;
    const source = fs.readFileSync(file, 'utf8');
    checked++;
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source))
        issues.push({ file: path.relative(root, file), category: 'credential pattern' });
    }
    if (file.includes(`${path.sep}src${path.sep}`)) {
      for (const match of source.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi)) {
        if (!/(^|\.)example\.(com|org|net)$/i.test(match[1]))
          issues.push({ file: path.relative(root, file), category: 'nonfictional email domain' });
      }
      for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        const spec = match[1];
        if (
          spec.startsWith('.') &&
          !path.resolve(path.dirname(file), spec).startsWith(root + path.sep)
        )
          issues.push({
            file: path.relative(root, file),
            category: 'import outside public runtime',
          });
      }
      if (
        /ZOHO_REFRESH_TOKEN|DATABASE_URL|SMTP_PASSWORD|GMAIL_CLIENT_SECRET|NEXT_PUBLIC_.*(?:KEY|SECRET|TOKEN)/.test(
          source,
        )
      )
        issues.push({
          file: path.relative(root, file),
          category: 'forbidden legacy credential dependency',
        });
    }
  }
}
walk(root);
console.log(JSON.stringify({ checked, issues }, null, 2));
if (issues.length) process.exitCode = 1;
