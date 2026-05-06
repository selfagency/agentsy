import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // If a package path is provided as an argument, use it; otherwise use root
  const packagePath = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..');
  const rootPkgPath = resolve(packagePath, 'package.json');
  const outDir = resolve(packagePath, 'dist');
  const raw = await readFile(rootPkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  const {
    name,
    version,
    description,
    keywords,
    homepage,
    bugs,
    repository,
    license,
    author,
    private: isPrivate,
    publishConfig,
  } = pkg;

  // Strip the leading './dist' prefix from all export paths so they are relative to the dist/ folder.
  /** @type {Record<string, Record<string, string>>} */
  const rootExports = pkg.exports;
  /** @type {Record<string, Record<string, string>>} */
  const distExports = {};
  for (const [key, value] of Object.entries(rootExports)) {
    distExports[key] = {};
    if (value.types) distExports[key].types = value.types.replace('./dist/', './');
    if (value.import) distExports[key].import = value.import.replace('./dist/', './');
    if (value.require) distExports[key].require = value.require.replace('./dist/', './');
  }

  const distPkg = {
    name,
    version,
    private: isPrivate,
    publishConfig,
    description,
    keywords,
    homepage,
    bugs,
    repository,
    license,
    author,
    type: 'module',
    main: './index.cjs',
    module: './index.js',
    types: './index.d.ts',
    exports: distExports,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`, 'utf8');
  console.log('Wrote', resolve(outDir, 'package.json'));

  const pkgReadme = resolve(packagePath, 'README.md');
  const rootReadme = resolve(__dirname, '..', 'README.md');
  const readmeSrc = await access(pkgReadme)
    .then(() => pkgReadme)
    .catch(() => rootReadme);
  const readmeDest = resolve(outDir, 'README.md');
  await copyFile(readmeSrc, readmeDest);
  console.log('Copied', readmeSrc, 'to', readmeDest);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
