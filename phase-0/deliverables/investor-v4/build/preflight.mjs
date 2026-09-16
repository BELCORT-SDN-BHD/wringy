import {fs,finalize,BUILD,ROOT,path} from './runtime.mjs';
const dir=path.join(ROOT,'.preflight-output');await fs.mkdir(dir,{recursive:true});
await finalize(path.join(BUILD,'candidate.pptx'),path.join(dir,'preflight.pptx'),'preflight');
console.log('Finalizer preflight completed');
