import {finalize} from './finalize.mjs';
import {BUILD,ROOT,path} from './runtime.mjs';
await finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/review-3.pptx'),{count:18,charts:[4,5,6,12],tables:[17]});
