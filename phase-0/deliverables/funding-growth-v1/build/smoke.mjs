import {fs,path,PresentationFile,BUILD,C} from './runtime.mjs';
import {createDeck,page,tx,steps} from './template.mjs';
import {render} from './render.mjs';
const p=createDeck();
let s=page(p,{title:'',notes:'模板排版测试。采用本次委派中已明确的产品范围。',sources:['当前任务委派，2026-09-12']});
tx(s,'Wringy',56,76,1000,124,90,true,C.primary);tx(s,'融资与增长计划',58,259,1140,107,62,true);tx(s,'马来西亚首发',61,423,1100,59,34);tx(s,'Creator Rewards 先行',61,505,1100,53,28,false,C['muted-foreground']);
s=page(p,{title:'产品推进顺序',footnote:'战略方向。东南亚为长期范围。',notes:'排版测试，仅使用任务明确提供的方向，没有新增量化目标。',sources:['当前任务委派，2026-09-12']});
steps(s,[{title:'马来西亚',body:'首发市场'},{title:'Creator Rewards',body:'先行产品'},{title:'东南亚',body:'长期方向'}]);
const candidate=path.join(BUILD,'template-smoke.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);await render(candidate,path.join(BUILD,'template-renders'));
