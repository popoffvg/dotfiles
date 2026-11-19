import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


INSTALLER = Path(__file__).resolve().parents[2] / 'claude/scripts/install-opencode-extensions.sh'


class OpenCodeInstallTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name) / 'checkout with spaces'
        self.bin = Path(self.scratch.name) / 'bin'
        self.bin.mkdir()
        config = self.root / 'harness/opencode/opencode.json'
        config.parent.mkdir(parents=True)
        config.write_text(json.dumps({'plugin': ['{{ROOT}}/extensions/pins']}))
        self.log = Path(self.scratch.name) / 'commands'
        self.env = {
            **os.environ,
            'PATH': f'{self.bin}:{os.environ["PATH"]}',
            'INSTALL_LOG': str(self.log),
        }
        self.write_command('mise', '''#!/bin/bash
printf '%s\\n' "$*" >> "$INSTALL_LOG"
[[ "$*" != "${FAIL_TASK:-}" ]]
''')
        self.write_command('opencode', '''#!/bin/bash
printf '%s\\n' "$*" >> "$INSTALL_LOG"
if [[ "$*" == *"/api/plugin"* ]]; then
  printf '%s\\n' "$PLUGIN_RESPONSE"
fi
''')
        for name in ('npm', 'bun'):
            self.write_command(name, '#!/bin/bash\nexit 0\n')
        self.set_plugin('active')

    def write_command(self, name, content):
        command = self.bin / name
        command.write_text(content)
        command.chmod(0o755)

    def set_plugin(self, status):
        self.env['PLUGIN_RESPONSE'] = json.dumps({'data': [{
            'source': {'type': 'local', 'path': str(self.root / 'extensions/pins')},
            'state': {'status': status},
        }]})

    def run_installer(self):
        return subprocess.run(
            ['bash', str(INSTALLER), str(self.root)],
            env=self.env, capture_output=True, text=True,
        )

    def test_install_order_and_repeat(self):
        for _ in range(2):
            result = self.run_installer()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('OpenCode extension is active:', result.stdout)
        commands = self.log.read_text().splitlines()
        self.assertEqual(commands[:5], [
            'run harness:opencode:deps', 'run harness:opencode:check',
            'run harness:opencode:test', 'run harness:sync', 'run harness:check',
        ])
        self.assertEqual(commands[5], 'api post /api/location/reload')
        self.assertEqual(commands[:7], commands[7:])

    def test_dependency_failure_stops_deployment(self):
        self.env['FAIL_TASK'] = 'run harness:opencode:deps'
        self.assertNotEqual(self.run_installer().returncode, 0)
        self.assertEqual(self.log.read_text(), 'run harness:opencode:deps\n')

    def test_failed_plugin_rejects_install(self):
        self.set_plugin('failed')
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('OpenCode extension is not active:', result.stderr)

    def test_missing_plugin_rejects_install(self):
        self.env['PLUGIN_RESPONSE'] = '{"data":[]}'
        self.assertNotEqual(self.run_installer().returncode, 0)


if __name__ == '__main__':
    unittest.main()
