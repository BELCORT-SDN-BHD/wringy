import {fs,path,Presentation,PresentationFile,FONT,ROOT,BUILD,SEQUENCE,finalize,renderFinal,applyPresentationChartFont} from './runtime.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const tokenPath=path.resolve(ROOT,'../../foundation/design-v2/tokens.json');
const raw=await fs.readFile(tokenPath);const tokens=JSON.parse(raw);const C=tokens.color;
for(const k of ['canvas','surface','ink','muted','line','accent','composition'])if(!C[k])throw Error('Missing canonical color '+k);
const story=await fs.readFile(path.join(ROOT,'story.md'),'utf8');
const sections=story.split(/^## /m).slice(1);if(sections.length!==10)throw Error('Final story must have ten sections');
const p=Presentation.create({slideSize:{width:1280,height:720}});const records=[];
function text(s,str,x,y,w,h,size=28,bold=false,color=C.ink){const q=s.shapes.add({geometry:'textbox',name:str.slice(0,40),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=str;q.text.style={typeface:FONT,fontSize:size,color,bold,autoFit:'none',verticalAlignment:'top'};return q;}
function page(n,title,foot='',bg=C.surface){title=title.replace(/。$/,'');const s=p.slides.add();s.background.fill=bg;text(s,String(n).padStart(2,'0')+'  '+['公司定位','客户问题','解决方案','为什么是现在','市场空间','竞争与替代方案','商业模式','执行团队','资金规划','长期愿景'][n-1],64,32,1060,35,17,false,C.muted);text(s,title,64,106,1148,134,46,true);if(foot)text(s,foot,64,652,1090,45,17,false,C.muted);if(n!==1&&n!==10)text(s,'Wringy',1110,652,115,36,18,true);const notes=sections[n-1].split('### 备注与来源')[1].trim().replace(/\]\(\.\.\/\.\.\//g,'](phase-0/');s.speakerNotes.textFrame.setText(notes+'\n结构参考：https://sequoiacap.com/article/writing-a-business-plan');records.push({number:n,section:SEQUENCE[n-1],title,notes});return s;}
function table(s,values,x,y,w,h,widths,size=23){const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,columnWidths:widths,values});t.borders.assign({fill:C.line,width:0.5,style:'solid'});t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({fill:C.surface,textStyle:{typeface:FONT,fontSize:size,color:C.ink},margins:{left:15,right:12,top:10,bottom:10}});for(let r=0;r<values.length;r++)t.rows[r].height=h/values.length;for(let c=0;c<values[0].length;c++){t.getCell(0,c).fill=C.composition;t.getCell(0,c).text.style={typeface:FONT,fontSize:size,color:C.ink,bold:true};}if(values.at(-1)[0]==='合计'){for(let c=0;c<values[0].length;c++){t.getCell(values.length-1,c).fill=C.composition;t.getCell(values.length-1,c).text.style={typeface:FONT,fontSize:size,color:C.ink,bold:true};}}return t;}
{
const s=page(1,'Wringy','马来西亚起步 · 方案阶段 · 投资讨论稿 · 2026.09',C.canvas);
text(s,'让创作者把内容，\n做成生意。',64,251,1144,200,72,true);
text(s,'我们希望建立面向东南亚的创作者商业平台，\n连接品牌合作、内容收入与日常经营。',69,515,1110,92,28);
}
{
const s=page(2,'一次内容合作，往往分散在\n多段聊天与表格里。','问题假设');
text(s,'品牌',64,297,480,50,28,true);text(s,'反复沟通要求、追踪作品、\n核对报酬。',64,369,520,104,31);
text(s,'创作者',686,297,490,50,28,true);text(s,'等待修改意见、验收结果\n和付款进度。',686,369,525,104,31);
text(s,'例如：一轮产品演示合作，双方需要从开拍前就知道：\n交什么，怎样合格，何时付款。',64,537,1135,87,27);
}
{
const s=page(3,'把合作要求、作品和报酬，放进同一条流程。','产品概念，全部为示例数据 · 首发候选：邀请制内容合作，按合格帖子支付固定报酬。');
const labels=['约定要求与报酬','原稿预审','创作者发布','最终验收','核对付款'];labels.forEach((v,i)=>text(s,v,64+i*233,202,220,40,23,true));
text(s,'品牌看清每份作品\n的交付进度。\n\n创作者看清下一步\n行动与报酬状态。',64,338,335,250,27);
const screenshot=path.resolve(ROOT,'../../foundation/design-v2/assets/dashboard-desktop.png');
try{const bytes=await fs.readFile(screenshot);s.images.add({blob:new Uint8Array(bytes),contentType:'image/png',alt:'Wringy实际设计概念截图，非上线产品，全部数据为示例',fit:'contain',position:{left:403,top:252,width:813,height:386}});}catch(e){if(process.env.ALLOW_PENDING_IMAGE!=='1')throw Error('Dashboard screenshot not ready');text(s,'产品概念截图待接入',475,413,690,60,30,false,C.muted);}
}
{
const s=page(4,'视频，正在成为电商的交易入口。','来源：Google / Temasek / Bain，2025 年估算；业务判断为假设。',C.canvas);
text(s,'25%',64,269,561,180,136,true);text(s,'东南亚视频电商占 2025 年\n电商交易额的估算比例。',69,492,540,102,29);
text(s,'Wringy 的判断',735,300,475,46,26,true);text(s,'当内容更靠近购买，\n品牌与创作者之间的合作，\n有机会从单次推广\n走向持续采购。',735,386,475,209,29);
}
{
const s=page(5,'从马来西亚品牌的内容采购，\n走向区域创作者商业。','测算口径：品牌数量、采购频次与服务费待调查。');
text(s,'US$200 亿',64,273,583,96,68,true);text(s,'马来西亚 2025 年电商交易额估算，\n同比增长 21%。',68,386,592,87,25);text(s,'电商市场背景，非 Wringy 可获取市场',68,478,601,38,20,false,C.muted);
text(s,'拟议起步市场',736,279,450,39,24,true);text(s,'有持续内容需求的消费品牌\n与当地创作者。',736,325,467,82,25);text(s,'扩展方向',736,423,460,37,24,true);text(s,'更多品类与国家，以及店铺、\n会员和数字产品经营。',736,469,470,82,25);
text(s,'内容合作的年度服务收入空间\n＝目标付费品牌数 × 年采购次数 × 每场服务费',64,547,1110,89,27,true);
}
{
const s=page(6,'市场已有选择，Wringy 从一种\n清楚的合作方式切入。','Wringy 为拟议定位');
table(s,[['选择','主要方式'],['Content Rewards','多种计酬方式的内容奖励活动'],['Partipost Malaysia','本地品牌与创作者营销合作'],['品牌自行协调','通过聊天与表格组织交付'],['Wringy','聚焦固定按帖合作，连接规则、作品与付款进度']],64,260,1152,295,[345,807],24);
text(s,'进入路径：先围绕品牌采购需求招募创作者，\n再通过重复合作积累交付记录与关系。',64,574,1142,72,25);
}
{
const s=page(7,'品牌支付活动服务费，\n创作者获得约定报酬。','拟议模式 · 价格通过采购访谈与试点报价确认',C.canvas);
text(s,'按活动向品牌单独收费，\n创作者不另付平台服务费。',64,286,1120,106,35);
text(s,'创作者报酬不计入 Wringy 收入。',64,391,1120,43,23,false,C.muted);
text(s,'增长来自更多付费品牌、更多重复采购，\n以及后续经营工具带来的新收入机会。',64,452,1120,83,29);
text(s,'每场服务收入 − 审核、支持与支付等直接成本\n＝单场贡献',64,550,1130,86,29,true);
}
{
const s=page(8,'创始人负责商业与产品，\nBelcort 承接开发。','执行安排 · 具体资源与交付协议待落实');
text(s,'Wringy',64,299,520,70,47,true);text(s,'产品方向、品牌招募、\n合作运营与交付验收。',64,400,534,120,31);
text(s,'Belcort',723,299,489,70,47,true);text(s,'技术评估、开发、测试、\n交接及拟约定的维护。',723,400,489,120,31);
text(s,'Belcort 为创始人自有公司。',64,577,1100,52,26);
}
{
const s=page(9,'约 RM580k，覆盖 18 个月的\n建设与经营验证。','按零收入规划，非 Belcort 报价或正式融资请求；交易成本与税费待补。');
const values=[189750,216000,70000,50000,50400];if(values.reduce((a,b)=>a+b,0)!==576150)throw Error('Budget sum');
table(s,[['资金用途','基准情景 MYR'],['首版开发，含开发预备金','189,750'],['商业与运营，18 个月','216,000'],['上线后技术，14 个月','70,000'],['获客试验与启动','50,000'],['非开发支出缓冲','50,400'],['合计','576,150']],64,259,755,338,[536,219],21);
text(s,'零收入规划',887,324,310,44,26,true);text(s,'前 4 个月建设\n后 14 个月运营',887,393,320,100,21);
text(s,'以付费交付、重复采购与履约成本，判断下一阶段投入。',64,608,1105,37,22);
}
{
const s=page(10,'让一次内容合作，\n成为持续经营的起点。','Wringy · wringy.com',C.canvas);
text(s,'我们希望创作者在 Wringy：\n与品牌合作获得收入，经营店铺、会员与数字产品，\n并逐步服务更多东南亚市场。',64,284,1148,149,31);
text(s,'从马来西亚起步，建立连接创作、交易与经营的平台。',64,466,1148,75,29,true);
text(s,'我们期待与投资伙伴讨论，\n如何把第一条可重复的业务，发展为区域平台。',64,554,1148,79,26);
}
await fs.writeFile(path.join(BUILD,'records.json'),JSON.stringify({tokenPath,tokenSha256:createHash('sha256').update(raw).digest('hex'),storySha256:createHash('sha256').update(story).digest('hex'),fontAdaptation:'Noto Sans SC local Chinese font for portable slide rendering; colors read directly from canonical design-v2 tokens',slides:records},null,2));
const candidate=path.join(BUILD,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);console.log('Candidate exported');
if(process.env.DRAFT_ONLY==='1'){for(let i=0;i<10;i++){const png=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(BUILD,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));}process.exit(0);}
execFileSync('${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',[path.join(BUILD,'polish.py')]);
const finalPath=path.join(ROOT,'output/Wringy-Investor-v3.pptx');await finalize(path.join(BUILD,'candidate-polished.pptx'),finalPath);await renderFinal(finalPath);
