#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const packagesDir = 'packages';
const files = fs.readdirSync(packagesDir);

files.forEach(file => {
  const filePath = path.join(packagesDir, file, 'CHANGELOG.md');
  if (fs.existsSync(filePath) && !file.startsWith('.')) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Add angle brackets around GitHub URLs in commit references
    content = content.replace(
      /by @selfagency in (https:\/\/github\.com\/selfagency\/agentsy\/pull\/\d+)/g,
      'by @selfagency in <$1>',
    );
    fs.writeFileSync(filePath, content);
  }
});
