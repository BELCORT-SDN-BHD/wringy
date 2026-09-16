import {fs,path,BUILD,finalize} from './runtime.mjs';
await fs.mkdir(path.join(BUILD,'preflight-output'),{recursive:true});
await finalize(path.join(BUILD,'candidate-polished.pptx'),path.join(BUILD,'preflight-output/preflight.pptx'));
