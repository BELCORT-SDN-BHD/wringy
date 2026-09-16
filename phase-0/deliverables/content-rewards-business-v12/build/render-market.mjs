import {fs,path,PresentationFile,FileBlob,BUILD,ROOT} from './runtime.mjs';
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx')));await fs.mkdir(path.join(BUILD,'renders'),{recursive:true});
for(const i of [8,9]){const s=p.slides.items[i],n=String(i+1).padStart(2,'0');await fs.writeFile(path.join(BUILD,'renders/slide-'+n+'.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));}
