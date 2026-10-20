#!/usr/bin/env node
/**
 * Checks every skills/<name>/SKILL.md against the Agent Skills rules:
 *  - front matter has `name` and `description`
 *  - name: lowercase letters, digits, hyphens, <= 64 chars, equals the folder name,
 *    no reserved words ("anthropic", "claude")
 *  - description: non-empty, <= 1024 chars, no XML tags
 *  - SKILL.md body under 500 lines (move details to references/ instead)
 *  - every skill listed in .claude-plugin/marketplace.json exists, and every skill folder is listed
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(root, 'skills');
const problems = [];
const names = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')));

for (const dir of names) {
  const text = fs.readFileSync(path.join(skillsDir, dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) { problems.push(`${dir}: missing front matter`); continue; }
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  if (!fm.name) problems.push(`${dir}: name missing`);
  else {
    if (!/^[a-z0-9-]{1,64}$/.test(fm.name)) problems.push(`${dir}: bad name "${fm.name}"`);
    if (fm.name !== dir) problems.push(`${dir}: name "${fm.name}" differs from folder`);
    if (/anthropic|claude/.test(fm.name)) problems.push(`${dir}: reserved word in name`);
  }
  if (!fm.description) problems.push(`${dir}: description missing`);
  else {
    if (fm.description.length > 1024) problems.push(`${dir}: description ${fm.description.length} > 1024 chars`);
    if (/<[a-z][^>]*>/i.test(fm.description)) problems.push(`${dir}: XML tag in description`);
  }
  const lines = text.split('\n').length;
  if (lines > 500) problems.push(`${dir}: SKILL.md has ${lines} lines (> 500)`);
}

const market = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
const listed = market.plugins.flatMap((p) => p.skills.map((s) => path.basename(s)));
for (const s of listed) if (!names.includes(s)) problems.push(`marketplace lists missing skill: ${s}`);
for (const n of names) if (!listed.includes(n)) problems.push(`skill not in marketplace.json: ${n}`);

if (problems.length) { console.log(problems.map((p) => 'FAIL ' + p).join('\n')); process.exit(1); }
console.log(`lint ok: ${names.length} skills (${names.join(', ')})`);
