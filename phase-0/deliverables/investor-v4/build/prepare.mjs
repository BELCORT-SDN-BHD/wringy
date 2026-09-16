import {fs,path,ROOT,BUILD,sha} from './runtime.mjs';
import {BUDGET,BUDGET_TOTAL,MARKET} from './evidence.mjs';
const story=await fs.readFile(path.join(ROOT,'story.md'),'utf8');
const slides=[...story.matchAll(/^## (\d\d)｜([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(m=>({
 number:Number(m[1]),topic:m[2],copy:m[3].split('### 上屏文案\n')[1]?.split('### 视觉计划')[0].trim(),
 visual:m[3].split('### 视觉计划，不上屏\n')[1]?.split('### 备注与来源')[0].trim()
}));
if(slides.length!==10||slides.some(s=>!s.copy||!s.visual))throw Error('Story structure invalid');
await fs.writeFile(path.join(BUILD,'story-extract.json'),JSON.stringify({storySha256:sha(story),slides},null,2));
await fs.writeFile(path.join(BUILD,'prep-check.json'),JSON.stringify({status:'waiting-for-main-canonical-visual-handoff',artifactToolESM:true,slides:10,nativeChartSlides:[7,10],budget:BUDGET,budgetTotal:BUDGET_TOTAL,market:MARKET,noPaletteFrozen:true,noDeckExported:true},null,2));
console.log('Prepared ten story sections, canonical financial data and chart modules. Waiting for explicit visual handoff.');
