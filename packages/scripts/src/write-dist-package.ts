// fallow-ignore-file unused-file
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

async function main() {
  // If a package path is provided as an argument, use it; otherwise use root
  const packagePath = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..');
  const rootPkgPath = resolve(packagePath, 'package.json');
  const outDir = resolve(packagePath, 'dist');
  const raw = await readFile(rootPkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    homepage: string;
    bugs?: {
      url?: string;
    };
    repository?: {
      url?: string;
    };
    license: string;
    author?:
      | string
      | {
          name?: string;
          email?: string;
          url?: string;
        };
    private?: boolean;
    publishConfig?: Record<string, unknown>;
  };
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
    publishConfig
  } = pkg;

  // Strip the leading './dist' prefix from all export paths so they are relative to the dist/ folder.
  const rootExports = pkg.exports as Record<string, unknown>;
  const distExports: Record<string, { types?: string; import?: string; require?: string }> = {};
  for (const [key, value] of Object.entries(rootExports)) {
    distExports[key] = {};
    if (typeof value === 'object' && value !== null && 'types' in value) {
      const typesValue = (value as Record<string, unknown>).types as string | undefined;
      if (typesValue !== undefined) {
        distExports[key].types = typesValue.replace('./dist/', './');
      }
    }
    if (typeof value === 'object' && value !== null && 'import' in value) {
      const importValue = (value as Record<string, unknown>).import as string | undefined;
      if (importValue !== undefined) {
        distExports[key].import = importValue.replace('./dist/', './');
      }
    }
    if (typeof value === 'object' && value !== null && 'require' in value) {
      const requireValue = (value as Record<string, unknown>).require as string | undefined;
      if (requireValue !== undefined) {
        distExports[key].require = requireValue.replace('./dist/', './');
      }
    }
  }

  const distPkg = {
    author,
    bugs,
    description,
    exports: distExports,
    homepage,
    keywords,
    license,
    main: './index.cjs',
    module: './index.js',
    name,
    private: isPrivate,
    publishConfig,
    repository,
    type: 'module',
    types: './index.d.ts',
    version
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`, 'utf-8');
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
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
