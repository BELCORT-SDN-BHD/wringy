import {finalize} from './finalize.mjs';
import {BUILD,ROOT,path} from './runtime.mjs';
await finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/final-review.pptx'),{count:18,charts:[5,12],tables:[6,9,17]});
