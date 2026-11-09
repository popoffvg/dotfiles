// Adapt implicit Claude names to the explicit metadata Rulesync imports.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
const require = createRequire(process.argv[2] + '/package.json');
const YAML = require('js-yaml');
const root = process.argv[3];
for (const dir of ['skills', 'agents']) {
  let names;
  try { names = readdirSync(join(root, dir)); } catch { continue; }
  for (const name of names) {
    const file = join(root, dir, dir === 'skills' ? name + '/SKILL.md' : name);
    if (dir === 'agents' && !name.endsWith('.md')) continue;
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    if (!text.trim() && dir === 'agents') {
      unlinkSync(file); // An empty legacy agent has no behavior to install.
      continue;
    }
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error('Missing frontmatter: ' + file);
    const fm = YAML.load(match[1]);
    if (!fm.name) {
      fm.name = dir === 'skills' ? name : basename(name, '.md');
      writeFileSync(file, '---\n' + YAML.dump(fm) + '---\n' + text.slice(match[0].length));
    }
  }
}
