import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.ts') || dirFile.endsWith('.tsx') || dirFile.endsWith('.json')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const files = walkSync(path.join(__dirname, 'src'));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Exact cases
  newContent = newContent.replace(/meseros/g, 'mozos');
  newContent = newContent.replace(/mesero/g, 'mozo');
  
  newContent = newContent.replace(/meseras/g, 'mozas');
  newContent = newContent.replace(/mesera/g, 'moza');

  newContent = newContent.replace(/Meseros/g, 'Mozos');
  newContent = newContent.replace(/Mesero/g, 'Mozo');

  newContent = newContent.replace(/Meseras/g, 'Mozas');
  newContent = newContent.replace(/Mesera/g, 'Moza');

  newContent = newContent.replace(/MESEROS/g, 'MOZOS');
  newContent = newContent.replace(/MESERO/g, 'MOZO');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}

console.log('Replacement complete.');
