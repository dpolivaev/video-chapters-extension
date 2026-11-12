const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { inflateRawSync } = require('node:zlib');
const { copySync } = require('fs-extra');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(projectRoot, 'node_modules/.cache/build-tools');
const projectVersion = require('../package.json').version;

function readZip(filePath) {
  const buffer = fs.readFileSync(filePath);
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(endOffset).toBeGreaterThanOrEqual(0);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index++) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const contentOffset = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const compressed = buffer.subarray(contentOffset, contentOffset + compressedSize);
    expect([0, 8]).toContain(method);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function runScript(script, args, cwd) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 5 * 1024 * 1024
  });
}

function prepareIconGeneration(fixture) {
  for (const name of ['scripts/generate-icons.js', 'resources/icon_highres.png']) {
    const output = path.join(fixture, name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, name), output);
  }
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  return path.join(fixture, 'scripts/generate-icons.js');
}

describe('Build tooling', () => {
  let fixture;

  beforeEach(() => {
    fs.mkdirSync(fixtureRoot, { recursive: true });
    fixture = fs.mkdtempSync(path.join(fixtureRoot, 'build-tools-'));
  });

  afterEach(() => {
    fs.rmSync(fixture, { recursive: true, force: true });
  });

  test('builds browser extensions with the configured version', async () => {
    for (const name of ['src', 'vendor', 'LICENSE', 'README.md', 'NOTICE', 'package.json', 'manifest.chrome.json', 'manifest.firefox.json']) {
      copySync(path.join(projectRoot, name), path.join(fixture, name));
    }
    const script = prepareIconGeneration(fixture);
    runScript(script, [], fixture);
    const builds = [
      { browser: 'chrome', args: ['--dev'] },
      { browser: 'firefox', args: ['--firefox', '--dev'], firefoxId: '{b6e7e2e2-7e2a-4b7e-8e2e-2e2e2e2e2e3e}' },
      { browser: 'chrome', args: ['--production'] },
      { browser: 'firefox-store', args: ['--firefox-store', '--production'], firefoxId: '{b6e7e2e2-7e2a-4b7e-8e2e-2e2e2e2e2e3e}' },
      { browser: 'firefox-dev', args: ['--firefox-dev', '--production'], firefoxId: '{b6e7e2e2-7e2a-4b7e-8e2e-2e2e2e2e2e2e}' }
    ];

    for (const { browser, args, firefoxId } of builds) {
      const manifestFile = firefoxId ? 'manifest.firefox.json' : 'manifest.chrome.json';
      const expectedManifest = JSON.parse(fs.readFileSync(path.join(fixture, manifestFile), 'utf8'));
      expectedManifest.version = projectVersion;
      if (firefoxId) {
        expectedManifest.browser_specific_settings.gecko.id = firefoxId;
      }

      runScript(path.join(projectRoot, 'scripts/build.js'), args, fixture);

      const output = path.join(fixture, 'dist', browser);
      const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
      expect(manifest).toEqual(expectedManifest);
      for (const name of ['popup/popup.html', 'popup/popup.js', 'background/background.js', 'content/content.js', 'icons/icon16.png', '_locales/en/messages.json']) {
        expect(fs.statSync(path.join(output, name)).isFile()).toBe(true);
      }
      expect(fs.existsSync(path.join(output, 'popup/PopupView.test.js'))).toBe(false);
      for (const size of [16, 48, 128]) {
        const metadata = await sharp(path.join(output, 'icons', `icon${size}.png`)).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(size);
        expect(metadata.height).toBe(size);
      }
    }
  }, 30000);

  test('reports missing build inputs', () => {
    const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts/build.js'), '--dev', '--verbose'], {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 30000
    });

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('Missing:');
    expect(result.stdout + result.stderr).toContain('src/');
  });

  test('creates browser ZIP packages', () => {
    for (const browser of ['chrome', 'firefox']) {
      const source = path.join(fixture, 'dist', browser);
      const files = {
        'manifest.json': JSON.stringify({ version: projectVersion }),
        'background/background.js': 'console.log(1);',
        'content/content.js': 'console.log(2);',
        'popup/popup.html': '<html></html>',
        'icons/icon16.png': 'icon content',
        'nested/previous.zip': 'exclude this archive'
      };
      for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(source, name)), { recursive: true });
        fs.writeFileSync(path.join(source, name), content);
      }

      runScript(path.join(projectRoot, 'scripts/package.js'), ['--output', 'dist/' + browser], fixture);

      const entries = readZip(path.join(fixture, 'dist/packages', `video-chapters-extension-${browser}-v${projectVersion}.zip`));
      expect(JSON.parse(entries.get('manifest.json').toString()).version).toBe(projectVersion);
      expect(entries.get('background/background.js').toString()).toBe(files['background/background.js']);
      expect(entries.get('popup/popup.html').toString()).toBe(files['popup/popup.html']);
      expect(entries.has('nested/previous.zip')).toBe(false);
    }
  });

  test('creates a source ZIP with tracked project files', () => {
    runScript(path.join(projectRoot, 'scripts/package.js'), ['--source'], projectRoot);

    const entries = readZip(path.join(projectRoot, 'dist/packages', `video-chapters-extension-source-v${projectVersion}.zip`));
    expect(JSON.parse(entries.get('package.json').toString()).version).toBe(projectVersion);
    expect(entries.get('src/popup/popup.html').toString()).toBe(fs.readFileSync(path.join(projectRoot, 'src/popup/popup.html'), 'utf8'));
    expect([...entries.keys()].some(name => name.startsWith('web-store-submissions/'))).toBe(false);
    expect([...entries.keys()].some(name => name.startsWith('node_modules/'))).toBe(false);
  });

  test('generates PNG icons at the required sizes', async () => {
    const script = prepareIconGeneration(fixture);

    runScript(script, [], fixture);

    for (const size of [16, 48, 128]) {
      const metadata = await sharp(path.join(fixture, 'icons', `icon${size}.png`)).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
  });

  test('reports undefined variables and preserves ignored paths', () => {
    const eslintScript = path.join(projectRoot, 'node_modules/eslint/bin/eslint.js');
    const options = {
      cwd: projectRoot,
      input: 'missingBuildVariable();\n',
      encoding: 'utf8',
      timeout: 30000
    };

    const result = spawnSync(process.execPath, [eslintScript, '--stdin', '--stdin-filename', 'src/popup/popup.js', '--format', 'json'], options);

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-undef', severity: 2 })
    ]));
    const declaration = spawnSync(process.execPath, [eslintScript, '--stdin', '--stdin-filename', 'src/domain/entities/ChapterGeneration.js', '--format', 'json'], {
      ...options,
      input: 'class ChapterGeneration {}\nmodule.exports = { ChapterGeneration, VideoTranscript };\nbrowser.runtime.getManifest();\n'
    });
    expect(declaration.status).toBe(0);
    expect(JSON.parse(declaration.stdout)[0].messages).toEqual([]);
    for (const name of ['node_modules/example.js', 'dist/example.js', 'build/example.js', 'example.min.js', 'coverage/example.js', '.nyc_output/example.js', 'vendor/example.js', 'scripts/build.js', '.tmp/example.js']) {
      const ignored = spawnSync(process.execPath, [eslintScript, '--stdin', '--stdin-filename', name, '--format', 'json'], options);

      expect(ignored.status).toBe(0);
      expect(JSON.parse(ignored.stdout)[0].messages).toEqual([
        expect.objectContaining({ severity: 1, message: expect.stringContaining('ignored') })
      ]);
    }
  }, 30000);
});
