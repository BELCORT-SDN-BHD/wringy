import {fs,path,PresentationFile,FileBlob,BUILD} from './runtime.mjs';
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(BUILD,'candidate-polished.pptx')));
for(const n of [6,7,9,10]){const png=await p.export({slide:p.slides.items[n-1],format:'png',scale:1});await fs.writeFile(path.join(BUILD,`check-${n}.png`),new Uint8Array(await png.arrayBuffer()));}
