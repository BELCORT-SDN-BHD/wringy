import {fs,path,ROOT,BUILD,finalize,renderFinal,PY} from './runtime.mjs';
import {execFileSync} from 'node:child_process';
const candidate=process.argv[2];
if(!candidate||!path.isAbsolute(candidate))throw Error('Pass absolute candidate path after main visual authorization.');
const final=path.join(ROOT,'output/Wringy-Investor-v4.pptx');
await fs.mkdir(path.dirname(final),{recursive:true});
await finalize(candidate,final);await renderFinal(final);
execFileSync(PY,[path.join(BUILD,'preview.py')],{stdio:'inherit'});
