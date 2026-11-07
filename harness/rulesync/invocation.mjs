// Promote invocation intent after native import; Rulesync emits target controls.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(process.argv[2] + '/package.json');
const YAML = require('js-yaml');
const [, , , sourceRoot, canonicalRoot] = process.argv;
const catalog = [];
function parse(path) {
  const text = readFileSync(path, 'utf8');
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!header) throw new Error('Missing frontmatter: ' + path);
  return { text, header, metadata: YAML.load(header[1]) };
}
if (existsSync(sourceRoot)) for (const directory of readdirSync(sourceRoot)) {
  const source = join(sourceRoot, directory, 'SKILL.md');
  const output = join(canonicalRoot, directory, 'SKILL.md');
  if (!existsSync(source) || !existsSync(output)) continue;
  const native = parse(source).metadata;
  const { text, header, metadata } = parse(output);
  if (typeof native['disable-model-invocation'] === 'boolean')
    metadata['disable-model-invocation'] = native['disable-model-invocation'];
  metadata['user-invocable'] = false;
  // Imported target overrides take precedence over the shared field.
  for (const field of ['claudecode', 'claudecode-plugin'])
    if (metadata[field]) metadata[field]['user-invocable'] = false;
  const sidecar = join(sourceRoot, directory, 'agents/openai.yaml');
  if (existsSync(sidecar)) {
    const existing = YAML.load(readFileSync(sidecar, 'utf8'));
    metadata.codexcli = { ...metadata.codexcli, ...existing };
  }
  writeFileSync(output, '---\n' + YAML.dump(metadata) + '---\n' + text.slice(header[0].length));
  catalog.push({ directory, name: native.name, description: native.description,
    automatic: native['disable-model-invocation'] !== true });
}
process.stdout.write(JSON.stringify(catalog));
