import {fs,path,PresentationFile,BUILD} from './runtime.mjs';
import {createDeck,page} from './template.mjs';
import {sourceLink} from './links.mjs';
import {render} from './render.mjs';
const p=createDeck(),links=[];const s=page(p,{title:'来源链接测试',notes:'Private layout smoke check, not final investor content.'});
sourceLink(s,{key:'dosm',label:'DOSM 官方统计页面\ndosm.gov.my',url:'https://www.dosm.gov.my/portal-main/release-content/malaysia-digital-economy-2024',slideNumber:1,x:58,y:230,w:1100,h:96},links);
await fs.writeFile(path.join(BUILD,'link-smoke.json'),JSON.stringify(links,null,2));await(await PresentationFile.exportPptx(p)).save(path.join(BUILD,'link-smoke.pptx'));await render(path.join(BUILD,'link-smoke.pptx'),path.join(BUILD,'link-smoke-renders'),1);
