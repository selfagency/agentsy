import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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
  const { name, version, description, keywords, homepage, bugs, repository, license, author } = JSON.parse(raw);

  // Strip the leading './dist' prefix from all export paths so they are relative to the dist/ folder.
  /** @type {Record<string, { types: string; import: string; require: string }>} */
  const rootExports = JSON.parse(raw).exports;
  /** @type {Record<string, { types: string; import: string; require: string }>} */
  const distExports = {};
  for (const [key, value] of Object.entries(rootExports)) {
    distExports[key] = {
      types: value.types.replace('./dist/', './'),
      import: value.import.replace('./dist/', './'),
      require: value.require.replace('./dist/', './'),
    };
  }

  const distPkg = {
    name,
    version,
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
  await writeFile(resolve(outDir, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'utf8');
  console.log('Wrote', resolve(outDir, 'package.json'));

  const readmeSrc = resolve(__dirname, '..', 'README.md');
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
