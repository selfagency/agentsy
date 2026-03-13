import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const rootPkgPath = resolve(__dirname, '..', 'package.json');
  const outDir = resolve(__dirname, '..', 'dist');
  const raw = await readFile(rootPkgPath, 'utf8');
  const { name, version, description, keywords, homepage, bugs, issues, repository, license, author } =
    JSON.parse(raw);

  const subpaths = [
    'thinking', 'xml-filter', 'tool-calls', 'context', 'structured',
    'formatting', 'processor', 'markdown', 'adapters', 'normalizers', 'recovery',
  ];

  /** @type {Record<string, { types: string; import: string; require: string }>} */
  const exports = {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      require: './index.cjs',
    },
    './adapters/generic': {
      types: './adapters/generic.d.ts',
      import: './adapters/generic.js',
      require: './adapters/generic.cjs',
    },
    './adapters/vscode': {
      types: './adapters/vscode.d.ts',
      import: './adapters/vscode.js',
      require: './adapters/vscode.cjs',
    },
  };

  for (const sub of subpaths) {
    exports[`./${sub}`] = {
      types: `./${sub}/index.d.ts`,
      import: `./${sub}/index.js`,
      require: `./${sub}/index.cjs`,
    };
  }

  const distPkg = {
    name,
    version,
    description,
    keywords,
    homepage,
    bugs,
    issues,
    repository,
    license,
    author,
    type: 'module',
    main: './index.cjs',
    module: './index.js',
    types: './index.d.ts',
    exports,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'utf8');
  console.log('Wrote', resolve(outDir, 'package.json'));

  const readmeSrc = resolve(__dirname, '..', 'README.md');
  const readmeDest = resolve(outDir, 'README.md');
  await copyFile(readmeSrc, readmeDest);
  console.log('Copied', readmeSrc, 'to', readmeDest);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
