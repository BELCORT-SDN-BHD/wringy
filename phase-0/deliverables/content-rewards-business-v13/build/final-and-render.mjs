import {fs,path,ROOT,BUILD,PresentationFile,FileBlob} from './runtime.mjs';
import {finalize} from './finalize.mjs';
await finalize(path.join(BUILD,'candidate.pptx'),path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'),{count:15,charts:[7,8,10,13]});
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx')));
await fs.mkdir(path.join(BUILD,'renders'),{recursive:true});
const s=p.slides.items[12];
await fs.writeFile(path.join(BUILD,'renders/slide-13.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));
await fs.writeFile(path.join(BUILD,'renders/slide-13.layout.json'),await(await s.export({format:'layout'})).text());
console.log('Finalized and rendered funding slide');
