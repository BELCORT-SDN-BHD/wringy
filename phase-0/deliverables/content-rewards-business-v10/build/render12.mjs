import {fs,path,PresentationFile,FileBlob,BUILD,ROOT} from './runtime.mjs';
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'))),s=p.slides.items[11];
await fs.writeFile(path.join(BUILD,'renders/slide-12.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));
await fs.writeFile(path.join(BUILD,'renders/slide-12.layout.json'),await(await s.export({format:'layout'})).text());
