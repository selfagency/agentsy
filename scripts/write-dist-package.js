import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const rootPkgPath = resolve(__dirname, '..', 'package.json');
  const outDir = resolve(__dirname, '..', 'dist');
  const raw = await readFile(rootPkgPath, 'utf8');
  const { name, version, description, keywords, homepage, bugs, issues, repository, license, author, mcpName } =
    JSON.parse(raw);

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
    main: './index.cjs',
    module: './index.js',
    types: './index.d.ts',
    files: ['./index.cjs', './index.js', './index.d.ts'],
    bin: {
      'beans-mcp': './beans-mcp-server.cjs',
    },
    exports: {
      '.': {
        import: './index.js',
        require: './index.cjs',
      },
    },
    mcpName,
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
