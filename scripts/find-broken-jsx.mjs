import fs from 'fs';
const ls = fs.readFileSync('client/src/pages/home.tsx','utf8').split('\n');
for (let i=0;i<ls.length;i++) {
  const l = ls[i];
  if (/<\s+[A-Za-z]/.test(l) || /\w\s=\s\{/.test(l) || /=\s"/.test(l)) {
    console.log((i+1)+': '+l.slice(0,140));
  }
}
