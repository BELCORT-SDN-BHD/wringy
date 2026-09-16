import {finalize} from './finalize.mjs';
import {BUILD,ROOT,path} from './runtime.mjs';
await finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/review-final.pptx'),{count:15,charts:[7,9,13],tables:[14]});
