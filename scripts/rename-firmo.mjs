import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dirsToScan = ['src', 'docs', 'tests', 'openspec'];
const rootFiles = ['package.json', 'README.md', 'AGENTS.md', 'ROADMAP_CONSOLIDADO_2026.md', 'PROJECTO-COMPLETADO.md', 'PRD.md'];
const extensions = ['.ts', '.tsx', '.md', '.json', '.js', '.mjs', '.html'];

const replacements = [
  { from: /PARK POS/g, to: 'FIRMO POS' },
  { from: /ParkLogo/g, to: 'FirmoLogo' },
  { from: /parkpos\.pe/g, to: 'firmopos.pe' },
  { from: /module:\s*'park'/g, to: "module: 'firmo'" },
  { from: /"name":\s*"park"/g, to: '"name": "firmo"' },
  { from: /park-pos/g, to: 'firmo-pos' }
];

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (!extensions.includes(ext) && !rootFiles.includes(path.basename(filePath))) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;

  for (const rep of replacements) {
    newContent = newContent.replace(rep.from, rep.to);
  }

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated: ${filePath.replace(rootDir, '')}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

console.log('Starting rename process...');
for (const dir of dirsToScan) {
  walkDir(path.join(rootDir, dir));
}
for (const file of rootFiles) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  }
}

// Rename ParkLogo.tsx to FirmoLogo.tsx
const oldLogoPath = path.join(rootDir, 'src/components/icons/ParkLogo.tsx');
const newLogoPath = path.join(rootDir, 'src/components/icons/FirmoLogo.tsx');
if (fs.existsSync(oldLogoPath)) {
  fs.renameSync(oldLogoPath, newLogoPath);
  console.log(`Renamed: src/components/icons/ParkLogo.tsx -> src/components/icons/FirmoLogo.tsx`);
}

console.log('Done.');
