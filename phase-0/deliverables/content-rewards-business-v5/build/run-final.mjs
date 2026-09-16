import {finalize} from './finalize.mjs';
import {BUILD,ROOT,path} from './runtime.mjs';
await finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'),{count:15,charts:[6,7,10,13],tables:[14]});
