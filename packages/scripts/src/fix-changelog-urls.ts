#!/usr/bin/env node
// fallow-ignore-file unused-file
import fs from 'node:fs';
import path from 'node:path';

const packagesDir = 'packages';
const files = fs.readdirSync(packagesDir);

files.forEach(file => {
  const filePath = path.join(packagesDir, file, 'CHANGELOG.md');
  if (fs.existsSync(filePath) && !file.startsWith('.')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Add angle brackets around GitHub URLs in commit references
    content = content.replaceAll(
      /by @selfagency in (https:\/\/github\.com\/selfagency\/agentsy\/pull\/\d+)/gu,
      'by @selfagency in <$1>'
    );
    fs.writeFileSync(filePath, content);
  }
});
