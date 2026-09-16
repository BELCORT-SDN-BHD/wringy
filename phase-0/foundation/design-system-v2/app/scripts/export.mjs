import fs from 'node:fs';
fs.mkdirSync('../output',{recursive:true});
fs.copyFileSync('dist/index.html','../output/Wringy-Design-System.html');
console.log('Exported ../output/Wringy-Design-System.html');
