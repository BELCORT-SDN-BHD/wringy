import {path,ROOT,BUILD,finalize,renderFinal} from './runtime.mjs';
const final=path.join(ROOT,'output/Wringy-Investor-v3.pptx');
await finalize(path.join(BUILD,'candidate-polished.pptx'),final);
await renderFinal(final);
