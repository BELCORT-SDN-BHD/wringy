'use strict';
const $ = (s, root=document) => root.querySelector(s);
const DEMO=JSON.parse(document.querySelector('#embedded-demo-data').textContent);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textValue = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(textValue).join(' · ') : value && typeof value === 'object' ? Object.entries(value).map(([k,v])=>`${k}：${textValue(v)}`).join('\n') : String(value ?? '未定义');
const delay = ms => new Promise(r=>setTimeout(r,ms));
window.WRINGY_COVERAGE = {};
document.addEventListener('keydown',()=>document.documentElement.classList.add('keyboard'),true);
document.addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard'),true);
// Navigation stays native links; the compact disclosure traps focus only while open.
const navToggle=$('#nav-toggle');
function closeNav(returnFocus=false){document.body.classList.remove('nav-open');navToggle.setAttribute('aria-expanded','false');if(returnFocus)navToggle.focus();}
navToggle.onclick=()=>{const open=document.body.classList.toggle('nav-open');navToggle.setAttribute('aria-expanded',String(open));if(open)$('#sidebar nav a').focus();};
$$('#sidebar nav a').forEach(a=>a.addEventListener('click',()=>{const wasOpen=document.body.classList.contains('nav-open');closeNav();if(wasOpen){const target=$(a.hash);target.tabIndex=-1;target.focus();}}));
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('nav-open'))return;if(e.key==='Escape'){e.preventDefault();closeNav(true);}if(e.key==='Tab'){const els=[navToggle,...$$('#sidebar nav a')],i=els.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&i===els.length-1){e.preventDefault();navToggle.focus();}}});
let navFrame=0;
function updateActiveNav(){navFrame=0;const sections=$$('main>section'),threshold=innerWidth<=700?120:140;let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=threshold)active=section;else break;}$$('#sidebar nav a').forEach(a=>{const yes=a.hash===`#${active.id}`;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
window.addEventListener('scroll',()=>{if(!navFrame)navFrame=requestAnimationFrame(updateActiveNav);},{passive:true});window.addEventListener('hashchange',()=>requestAnimationFrame(updateActiveNav));updateActiveNav();
// Toast timer accounts for all pause reasons independently.
let toastRemaining=0,toastStarted=0,toastTimer=null;const toastPauses=new Set();
function pauseToast(reason){if(toastTimer){clearTimeout(toastTimer);toastTimer=null;toastRemaining=Math.max(0,toastRemaining-(performance.now()-toastStarted));}toastPauses.add(reason);}
function resumeToast(reason){toastPauses.delete(reason);if(!$('#toast').hidden&&!toastPauses.size&&!toastTimer){toastStarted=performance.now();toastTimer=setTimeout(hideToast,toastRemaining);}}
function hideToast(){clearTimeout(toastTimer);toastTimer=null;$('#toast').hidden=true;}
function showToast(message){clearTimeout(toastTimer);toastTimer=null;toastRemaining=5000;$('#toast-message').textContent=message;$('#toast').hidden=false;if(document.hidden)toastPauses.add('hidden');resumeToast('new');}
$('#toast').addEventListener('mouseenter',()=>pauseToast('hover'));$('#toast').addEventListener('mouseleave',()=>resumeToast('hover'));
$('#toast').addEventListener('focusin',()=>pauseToast('focus'));$('#toast').addEventListener('focusout',e=>{if(!$('#toast').contains(e.relatedTarget))resumeToast('focus');});
document.addEventListener('visibilitychange',()=>document.hidden?pauseToast('hidden'):resumeToast('hidden'));
$('#toast-dismiss').onclick=hideToast;$('#toast-trigger').onclick=()=>showToast('说明已保存到当前页面。刷新后重置。');
document.addEventListener('click',e=>{const b=e.target.closest('[data-toast]');if(b)showToast(b.dataset.toast);});
$('#load-button').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='正在提交…';await delay(900);b.disabled=false;b.removeAttribute('aria-busy');b.textContent='模拟提交';showToast('演示提交完成，未发送任何数据。');};
function updateChoices(){$('#choice-status').textContent=`${$('#view-select').value} · ${$('input[name=density]:checked').value} · 提醒${$('#notify-check').checked?'开启':'关闭'} · 预览${$('#preview-switch').checked?'开启':'关闭'}`;}
$$('#controls input,#controls select').forEach(el=>el.onchange=updateChoices);
// Custom validation retains input, announces errors, and focuses the first invalid field.
let formBusy=false,failedOnce=false;
$('#simulate-fail').onchange=()=>{failedOnce=false;};
$('#sample-form').addEventListener('input',e=>{if(e.target.id!=='simulate-fail')failedOnce=false;});
$('#sample-form').onsubmit=async e=>{e.preventDefault();if(formBusy)return;let first=null;const rules=[['work-title','title-error',v=>v.trim().length>0,'请输入作品标题。'],['work-email','email-error',v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),'请输入完整的邮箱，例如 name@example.com。']];for(const[id,error,valid,message]of rules){const input=$(`#${id}`),ok=valid(input.value);input.setAttribute('aria-invalid',String(!ok));$(`#${error}`).textContent=ok?'':message;if(!ok&&!first)first=input;}if(first){$('#form-result').textContent='请修正标出的字段；已有内容已保留。';first.focus();return;}formBusy=true;const save=$('#save-form');save.setAttribute('aria-disabled','true');save.setAttribute('aria-busy','true');save.textContent='正在保存…';$('#form-result').textContent='正在模拟请求…';await delay(650);formBusy=false;save.removeAttribute('aria-disabled');save.removeAttribute('aria-busy');if($('#simulate-fail').checked&&!failedOnce){failedOnce=true;$('#form-result').className='error';$('#form-result').textContent='保存失败：模拟服务暂时不可用。内容已保留，请重试。';save.textContent='重试保存';}else{$('#form-result').className='positive-text';$('#form-result').textContent='说明已保存到当前页面。未写入服务器。';save.textContent='保存说明';showToast('说明已保存（本地演示）。');}};
let uploadURL=null,uploadVersion=0;
function removeUpload(){uploadVersion++;if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=null;$('#upload').value='';$('#upload-preview').replaceChildren();$('#remove-upload').hidden=true;$('#upload-result').textContent='图片已移除。';}
$('#remove-upload').onclick=removeUpload;
$('#upload').onchange=async()=>{const file=$('#upload').files[0];if(!file)return;const version=++uploadVersion;const result=$('#upload-result');result.className='error';if(!['image/png','image/jpeg','image/webp'].includes(file.type)){result.textContent='文件类型不支持。请选择 PNG、JPEG 或 WebP 图片。';$('#upload').value='';return;}if(file.size>5*1024*1024){result.textContent='图片超过 5 MB。请压缩后重试。';$('#upload').value='';return;}const url=URL.createObjectURL(file),img=new Image();img.alt=`本地预览：${file.name}`;img.src=url;try{await img.decode();if(version!==uploadVersion){URL.revokeObjectURL(url);return;}if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=url;$('#upload-preview').replaceChildren(img);$('#remove-upload').hidden=false;result.className='positive-text';result.textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KB · 仅本地预览`;}catch{URL.revokeObjectURL(url);if(version===uploadVersion)result.textContent='无法读取此图片。文件可能已损坏，请重新选择。';}};
window.addEventListener('pagehide',()=>{if(uploadURL)URL.revokeObjectURL(uploadURL);});
// Roving tabindex and automatic activation follow the horizontal tab pattern.
const tabs=$$('[role=tab]');function activateTab(tab,focus=false){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;$(`#${t.getAttribute('aria-controls')}`).hidden=!active;});if(focus)tab.focus();}
tabs.forEach((tab,i)=>{tab.onclick=()=>activateTab(tab);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(n!==undefined){e.preventDefault();activateTab(tabs[n],true);}};});
let dialogOpener;const dialog=$('#sample-dialog');document.addEventListener('click',e=>{const opener=e.target.closest('[data-open-dialog]');if(opener){dialogOpener=opener;dialog.returnValue='';dialog.showModal();$('#dialog-note').focus();}});dialog.addEventListener('close',()=>{if(dialog.returnValue==='save')showToast('审核说明已保存到当前页面。');dialogOpener?.focus();});
dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const focusable=$$('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',dialog),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
const popover=$('#attribute-popover'),popTrigger=$('#popover-trigger');function positionPopover(){const r=popTrigger.getBoundingClientRect(),w=Math.min(280,innerWidth-32);popover.style.left=`${Math.max(16,Math.min(r.left,innerWidth-w-16))}px`;const below=innerHeight-r.bottom>230;popover.style.top=`${below?r.bottom+8:Math.max(16,r.top-230)}px`;popover.style.transformOrigin=below?'top left':'bottom left';}popover.addEventListener('beforetoggle',e=>{if(e.newState==='open')positionPopover();});popover.addEventListener('toggle',e=>{popTrigger.setAttribute('aria-expanded',String(e.newState==='open'));});window.addEventListener('resize',()=>{if(popover.matches(':popover-open'))positionPopover();});
// Tooltips share warm delay, expose no interactive content, and remain hoverable.
let tooltipWarmUntil=0;
const tooltipGroups=$$('.tooltip-anchor');
function hideAllTooltips(){tooltipGroups.forEach(group=>{clearTimeout(group._timer);$('[role=tooltip]',group).hidden=true;});tooltipWarmUntil=performance.now()+1000;}
tooltipGroups.forEach(group=>{const trigger=$('button',group),tip=$('[role=tooltip]',group);let over=false;
const show=()=>{hideAllTooltips();tip.hidden=false;tooltipWarmUntil=performance.now()+1000;};
const hide=()=>{clearTimeout(group._timer);tip.hidden=true;tooltipWarmUntil=performance.now()+1000;};
group.addEventListener('pointerenter',e=>{if(e.pointerType==='touch'||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;over=true;clearTimeout(group._timer);group._timer=setTimeout(show,performance.now()<tooltipWarmUntil?0:450);});
group.addEventListener('pointerleave',()=>{over=false;if(document.activeElement!==trigger)hide();});
trigger.addEventListener('focus',show);trigger.addEventListener('blur',()=>{if(!over)hide();});trigger.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide();}});
});
// Local table: selection persists across sorting/filtering; select-all affects the current page.
const rows=[{id:1,title:'水瓶日常使用演示',creator:'示例创作者 A',state:'发布前通过'},{id:2,title:'通勤随行使用记录',creator:'示例创作者 B',state:'待审核'},{id:3,title:'桌面补水日常',creator:'示例创作者 C',state:'待审核'},{id:4,title:'周末户外体验',creator:'示例创作者 D',state:'发布前通过'},{id:5,title:'水瓶清洁步骤',creator:'示例创作者 E',state:'待审核'},{id:6,title:'旅行收纳记录',creator:'示例创作者 F',state:'待审核'}];
const selected=new Set();let tablePage=1,sortAscending=true,sortKey='id';const pageSize=3;
function filteredRows(){return rows.filter(r=>(`${r.title}${r.creator}`).toLowerCase().includes($('#table-search').value.trim().toLowerCase())&&($('#table-filter').value==='all'||r.state===$('#table-filter').value)).sort((a,b)=>{const d=sortKey==='id'?a.id-b.id:a[sortKey].localeCompare(b[sortKey],'zh-CN');return sortAscending?d:-d;});}
function renderTable(){const mode=$('#table-mode').value,filtered=filteredRows();tablePage=Math.max(1,Math.min(tablePage,Math.ceil(filtered.length/pageSize)||1));const pageRows=filtered.slice((tablePage-1)*pageSize,tablePage*pageSize);$('#selection-status').textContent=`已选择 ${selected.size} 项 · 全选仅作用于当前页`;$('#prev-page').disabled=tablePage===1||mode!=='normal';$('#next-page').disabled=tablePage*pageSize>=filtered.length||mode!=='normal';$('#page-info').textContent=mode==='normal'?`第 ${tablePage} / ${Math.ceil(filtered.length/pageSize)||1} 页 · ${filtered.length} 个模拟对象`:'演示场景';const area=$('#table-area');area.setAttribute('aria-busy',String(mode==='loading'));if(mode==='loading'){area.innerHTML='<div role="status">正在读取作品…<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';return;}if(mode==='error'){area.innerHTML='<div class="empty"><strong>作品读取失败</strong><p>模拟连接异常，搜索与筛选条件已保留。</p><button id="table-retry">重试读取</button></div>';$('#table-retry').onclick=()=>{$('#table-mode').value='normal';renderTable();};return;}if(mode==='empty'){area.innerHTML='<div class="empty"><strong>还没有作品</strong><p>作品提交后会出现在这里。本地演示可载入示例。</p><button id="seed-table">载入示例作品</button></div>';$('#seed-table').onclick=()=>{$('#table-mode').value='normal';renderTable();};return;}if(!filtered.length){area.innerHTML=`<div class="empty"><strong>没有匹配的作品</strong><p>当前条件：${esc($('#table-search').value||'无搜索词')} · ${esc($('#table-filter').selectedOptions[0].text)}</p><button id="clear-table">清除搜索与筛选</button></div>`;$('#clear-table').onclick=()=>{$('#table-search').value='';$('#table-filter').value='all';renderTable();$('#table-search').focus();};return;}area.innerHTML=`<div class="table-scroll" tabindex="0" role="region" aria-label="作品表格，可横向滚动"><table><caption class="sr-only">模拟作品审核队列</caption><thead><tr><th><label><input type="checkbox" id="select-all" aria-label="选择当前页全部作品"></label></th><th aria-sort="${sortKey==='title'?(sortAscending?'ascending':'descending'):'none'}"><button id="sort-title">作品名称 ${sortKey==='title'?(sortAscending?'↑':'↓'):'↕'}</button></th><th>创作者</th><th>发布前审核</th></tr></thead><tbody>${pageRows.map(r=>`<tr aria-selected="${selected.has(r.id)}"><td><label><input type="checkbox" data-row="${r.id}" aria-label="选择${esc(r.title)}" ${selected.has(r.id)?'checked':''}></label></td><td><strong>${esc(r.title)}</strong><small>作品 ${String(r.id).padStart(3,'0')}</small></td><td>${r.creator}</td><td>${r.state==='待审核'?'○':'✓'} ${r.state}</td></tr>`).join('')}</tbody></table></div>`;const all=$('#select-all'),n=pageRows.filter(r=>selected.has(r.id)).length;all.checked=n===pageRows.length;all.indeterminate=n>0&&n<pageRows.length;all.onchange=()=>{pageRows.forEach(r=>all.checked?selected.add(r.id):selected.delete(r.id));renderTable();$('#select-all').focus();};$$('[data-row]',area).forEach(input=>input.onchange=()=>{const id=Number(input.dataset.row);input.checked?selected.add(id):selected.delete(id);renderTable();$(`[data-row="${id}"]`).focus();});$('#sort-title').onclick=()=>{sortAscending=sortKey==='title'?!sortAscending:true;sortKey='title';renderTable();$('#sort-title').focus();};}
$('#table-search').oninput=()=>{tablePage=1;renderTable();};$('#table-filter').onchange=()=>{tablePage=1;renderTable();};$('#table-mode').onchange=renderTable;$('#prev-page').onclick=()=>{tablePage--;renderTable();};$('#next-page').onclick=()=>{tablePage++;renderTable();};renderTable();
// Five independent domain axes; content and payment retain their separate subfacts.
const axes=[
{id:'content',label:'C · 内容',options:['待审核','最终通过','最终拒绝','需补证','复核中'],initial:'待审核'},
{id:'measurement',label:'M · 计量',options:['待数据','采集中','待核验','已核验','不可取得','需修正'],initial:'待数据'},
{id:'reward',label:'R · 奖励',options:['估算中','资格已确认','累积中','待结算','可提现应付','未结算逆转'],initial:'估算中'},
{id:'payment',label:'P · 付款',options:['未发起','已发起','处理中','结果未知','确定失败','服务商报告已完成','已退回'],initial:'未发起'},
{id:'risk',label:'K · 风险',options:['无开放风险记录','待复核','审核中','需补证','申诉中','已解除','已维持'],initial:'无开放风险记录'}];
const subAxes=[{id:'draft',label:'内容子状态 · 可选预审',options:['不要求预审','草稿待审','预审通过','预审拒绝'],initial:'不要求预审'},{id:'bank',label:'付款子状态 · 银行确认',options:['尚未确认','银行到账已确认','无法独立确认银行到账'],initial:'尚未确认'}];
$('#axis-controls').innerHTML=axes.map(a=>`<label>${a.label}<select id="axis-${a.id}">${a.options.map(o=>`<option ${o===a.initial?'selected':''}>${o}</option>`).join('')}</select></label>`).join('')+'<details><summary>内容与付款的独立子状态</summary>'+subAxes.map(a=>`<label>${a.label}<select id="axis-${a.id}">${a.options.map(o=>`<option ${o===a.initial?'selected':''}>${o}</option>`).join('')}</select></label>`).join('')+'</details>';
function renderAxes(){
$('#reward-facts').innerHTML=axes.map(a=>`<div><span>${a.label}</span><strong data-fact="${a.id}">${esc($(`#axis-${a.id}`).value)}</strong></div>`).join('')+`<p class="hint">可选预审：<span data-fact="draft">${esc($('#axis-draft').value)}</span><br>银行确认：<span data-fact="bank">${esc($('#axis-bank').value)}</span></p>`;
const bank=$('#axis-bank').value,payment=$('#axis-payment').value,risk=$('#axis-risk').value,measurement=$('#axis-measurement').value;
$('#reward-warning').textContent=measurement==='不可取得'?'计量数据不可取得：不能改写为零播放，也不能自动判断作弊。其他四轴保持原值。':risk==='已解除'?'风险已解除只解除该项限制，不自动批准内容、核验计量或释放奖励。':bank==='银行到账已确认'?'“银行到账已确认”仅为视觉组合测试，本页没有真实银行凭证；其余事实保持独立。':payment==='服务商报告已完成'?'服务商报告完成不证明银行到账。银行确认仍为独立子事实；结果未知时应查询原请求。':'内容通过≠计量已核验≠奖励可提现≠银行到账；风险另立案件。所有控制仅测试表达，不执行业务转换。';
}
$$('#axis-controls select').forEach(s=>s.onchange=renderAxes);$('#reset-axes').onclick=()=>{[...axes,...subAxes].forEach(a=>$(`#axis-${a.id}`).value=a.initial);renderAxes();};renderAxes();
// Data is embedded by the build for file://, with live fetch on HTTP for catalog updates.
async function readData(name){if(location.protocol!=='file:'){try{const response=await fetch(name+'.json');if(response.ok)return await response.json();}catch{}}const embedded=$(`#embedded-${name}`);if(embedded)return JSON.parse(embedded.textContent);throw Error(`${name}.json 尚未就绪；请完成生成步骤。`);}
readData('tokens').then(t=>{const names={canvas:'工作面',surface:'次级背景',ink:'主要文字',citron:'品牌行动',forest:'深森林',secondary:'辅助文字'};$('#swatches').innerHTML=Object.entries(names).map(([key,name])=>`<div class="swatch"><div class="swatch-color" style="background:var(--primitive-color-${key})"></div><h4>${name}</h4><code>${t.primitive.color[key]}</code></div>`).join('');$('.spacing').innerHTML=Object.values(t.primitive.space).map(n=>`<i title="${n}px" style="width:${n}px;height:${n}px"></i>`).join('');}).catch(e=>{$('#swatches').textContent=e.message;});
// Each family has its own visual structure. State switches are documentation controls,
// not a claim that every production behavior of the specimen has been implemented.
const COMPONENT_FAMILIES={
  "button": "button",
  "link": "link",
  "icon": "icon",
  "text": "typography",
  "avatar": "avatar",
  "badge": "badge",
  "separator": "separator",
  "surface": "card",
  "shell": "layout",
  "workspace-switcher": "workspace",
  "sidebar": "sidebar",
  "breadcrumb": "breadcrumb",
  "tabs": "tabs",
  "command-menu": "command",
  "stepper": "stepper",
  "pagination": "pagination",
  "search": "search",
  "field": "input",
  "text-input": "input",
  "textarea": "textarea",
  "number-input": "number",
  "money-input": "moneyinput",
  "checkbox": "checkbox",
  "radio": "radio",
  "switch": "switch",
  "select": "select",
  "segmented-control": "segmented",
  "date-time": "date",
  "slider": "slider",
  "file-upload": "upload",
  "rich-editor": "editor",
  "form": "form",
  "filter-builder": "filter",
  "data-table": "table",
  "list-detail": "listdetail",
  "property-list": "description",
  "metric": "metrics",
  "chart": "chart",
  "progress": "progress",
  "skeleton": "skeleton",
  "empty-state": "empty",
  "alert": "alert",
  "toast": "toast",
  "notification-inbox": "notification",
  "error-recovery": "error",
  "tooltip": "tooltip",
  "popover": "popover",
  "menu": "menu",
  "dialog": "dialog",
  "drawer": "drawer",
  "image": "image",
  "media-player": "media",
  "file-preview": "file",
  "annotation": "annotation",
  "asset-library": "assets",
  "campaign-brief": "campaign",
  "rule-editor": "rules",
  "budget": "budget",
  "submission": "submission",
  "review-workbench": "review",
  "measurement": "metrics",
  "reward-breakdown": "reward",
  "creator-progress": "creatorprogress",
  "bounty": "bounty",
  "worklog": "worklog",
  "social-connection": "integration",
  "product-editor": "product",
  "team-access": "permission",
  "checkout": "checkout",
  "price-plan": "pricing",
  "subscription": "pricing",
  "invoice": "invoice",
  "entitlement": "entitlement",
  "course": "course",
  "conversation": "message",
  "schedule": "schedule",
  "fulfillment": "fulfillment",
  "customer-record": "customer",
  "review-rating": "rating",
  "referral": "affiliate",
  "commission": "commission",
  "ad-editor": "ads",
  "audience": "audience",
  "attribution": "attribution",
  "wallet": "wallet",
  "ledger": "ledger",
  "payout": "payout",
  "transfer": "transfer",
  "financial-product": "financial",
  "verification": "verification",
  "risk-case": "risk",
  "appeal": "appeal",
  "reserve": "reserve",
  "tax-document": "tax",
  "app-connection": "integration",
  "credential": "credential",
  "event-log": "events",
  "import-export": "importexport",
  "ai-workbench": "ai",
  "action-preview": "agentaction",
  "site-lifecycle": "site",
  "blueprint": "blueprint",
  "service-application": "application"
};
function familyFor(c){return COMPONENT_FAMILIES[c.id]||"composite";}
const liveIDs=new Set(['button','text-input','textarea','field','form','search','select','radio','checkbox','switch','tabs','dialog','popover','toast','tooltip','data-table','filter-builder','pagination','file-upload','sidebar','shell','review-workbench','measurement','reward-breakdown','payout','risk-case']);
const liveFamilies={button:'#controls',input:'#forms',textarea:'#forms',form:'#forms',search:'#data',select:'#controls',radio:'#controls',checkbox:'#controls',switch:'#controls',tabs:'#overlays',dialog:'#overlays',popover:'#overlays',accordion:'#overlays',toast:'#overlays',tooltip:'#overlays',table:'#data',filter:'#data',pagination:'#data',upload:'#forms',sidebar:'#overview',review:'#rewards',payout:'#rewards',reward:'#rewards'};
const familyKinds={button:'按钮',input:'输入字段',textarea:'多行输入',search:'搜索',switch:'开关',checkbox:'复选项',radio:'单选项',select:'选择器',combobox:'组合选择器',date:'日历',slider:'滑块',upload:'上传区域',form:'表单',tabs:'标签页',pagination:'分页',breadcrumb:'路径',stepper:'步骤',command:'命令面板',sidebar:'导航',dialog:'对话框',drawer:'抽屉',popover:'属性浮层',menu:'菜单',tooltip:'工具提示',accordion:'折叠区',toast:'短暂反馈',alert:'通知条',skeleton:'骨架屏',spinner:'读取反馈',progress:'进度',empty:'空态',error:'错误恢复',table:'数据表',filter:'筛选',badge:'状态标签',avatar:'头像',icon:'图标',typography:'文字层级',separator:'分隔线',card:'信息卡片',chart:'数据图表',timeline:'时间线',description:'属性列表',money:'金额',payout:'出款详情',budget:'预算明细',reward:'奖励明细',metrics:'计量证据',review:'审核工作面',evidence:'证据列表',campaign:'活动要求',media:'媒体预览',product:'商品信息',checkout:'订单摘要',course:'课程目录',community:'成员列表',message:'讨论消息',notification:'通知列表',affiliate:'联盟记录',ads:'广告计划',integration:'连接器',ai:'生成任务',permission:'权限矩阵',auth:'身份验证',pricing:'方案比较',layout:'布局',file:'附件',link:'链接',list:'列表',composite:'组合工作面'};
function specimen(c,state='默认',variant=''){const f=familyFor(c),id=`sample-${c.id}`,label=esc(c.name),st=String(state),disabled=/disabled|restricted|unauthorized|locked|禁用|无权限|permission.denied/i.test(st),error=/error|invalid|fail|错误|失败|拒绝|异常/i.test(st),loading=/loading|busy|pending|saving|submitting|uploading|validating|processing|collecting|generating|streaming|querying|running|加载|读取|处理中/i.test(st),empty=/empty|no.result|无结果|空态|无数据/i.test(st),selectedState=/selected|checked|选中|已选/i.test(st),readonly=/readonly|read.only|只读/i.test(st),focus=/focus|焦点/i.test(st),done=/success|complete|ready|saved|confirmed|verified|成功|完成/i.test(st),open=/open|展开|打开/i.test(st),off=/off|unchecked|关闭|未选/i.test(st),invalid=error?' aria-invalid="true"':'',dis=disabled?' disabled':'',ro=readonly?' readonly':'',checked=!off&&(selectedState||done||st==='on'),busy=loading?' aria-busy="true"':'',value=empty?'':'水瓶使用演示',style=focus?' class="demo-focus"':'',status=error?'需要修正':loading?'正在处理…':disabled?'当前无操作权限':done?'演示已完成':st;
const action=`<button type="button"${dis}${busy} data-toast="仅演示：${esc(status)}">${loading?'处理中…':error?'重试演示':done?'已完成':'查看详情'}</button>`;
const err=error?'<p class="error">无法完成当前操作。内容已保留，请检查后重试。</p>':'';
const srow=(a,b)=>`<div class="mini-row"><span>${a}</span><strong>${b}</strong></div>`;
const dlabel=`${label}视觉示例`;
let html='';switch(f){
case'button':html=`<div class="mini-toolbar"><button type="button" class="${/danger|危险/i.test(variant)?'danger':/secondary|次/i.test(variant)?'':/ghost|文字/i.test(variant)?'ghost':'primary'} ${focus?'demo-focus':''} ${/hover|悬停/i.test(st)?'demo-hover':''} ${/press|按下/i.test(st)?'demo-pressed':''}"${dis}${busy} data-toast="${label}：本地点击反馈">${loading?'正在保存…':error?'重试保存':done?'✓ 已保存':disabled?'暂不可用':'保存更改'}</button>${/icon|图标/i.test(variant)?'<button aria-label="添加示例" data-toast="添加示例">＋</button>':''}</div>${disabled?'<p>权限不足，联系管理员开通后可操作。</p>':''}`;break;
case'input':case'textarea':case'search':case'auth':html=`<label>${f==='auth'?'验证邮箱':label}${f==='textarea'?`<textarea aria-label="${dlabel}"${dis}${ro}${invalid}${style}>${value}</textarea>`:`<input aria-label="${dlabel}" ${f==='search'?'type="search"':f==='auth'?'type="email"':'type="text"'} value="${f==='auth'?'creator@example.com':value}" placeholder="请输入内容"${dis}${ro}${invalid}${style}>`}</label>${error?'<p class="error">请填写有效内容，当前输入已保留。</p>':`<small>${readonly?'可选择、复制；不可修改。':loading?'正在校验内容…':'可见标签与输入始终关联。'}</small>`}`;break;
case'checkbox':case'switch':case'radio':html=`<fieldset><legend>${label}</legend>${(f==='radio'?['全部作品','仅我的作品']:['接收内容更新']).map((v,i)=>`<label class="choice"><input aria-label="${dlabel}${i}" type="${f==='radio'?'radio':'checkbox'}" ${f==='switch'?'role="switch"':''} name="${id}" ${checked||f==='radio'&&i===0&&st!=='unselected'?'checked':''}${dis}>${v}</label>`).join('')}</fieldset>${err}${disabled?'<small>当前账号无权修改此偏好。</small>':''}`;break;
case'select':case'combobox':html=`<label>${label}<select aria-label="${dlabel}"${dis}${invalid}${style}><option>${empty?'暂无选项':loading?'读取选项中…':selectedState?'示例审核员 A':'请选择负责人'}</option>${!empty&&!loading?'<option>示例审核员 A</option><option>示例审核员 B</option>':''}</select></label>${f==='combobox'?'<small>组合框外观参考；搜索、异步选项与虚拟化尚未实现。</small>':''}${err}`;break;
case'date':html=`<div class="mini-card"><strong>2026年9月</strong><div class="mini-grid">${['一','二','三','四','五','六','日',...Array.from({length:30},(_,i)=>i+1)].map(x=>`<span class="${x===11?'today':''}">${x}</span>`).join('')}</div></div><label>选择日期<input aria-label="${dlabel}" type="date" value="2026-09-11"${dis}${invalid}></label>${err}`;break;
case'slider':html=`<label>${label}<input aria-label="${dlabel}" type="range" min="0" max="100" value="${empty?0:selectedState?75:40}"${dis}></label><small>范围 0–100 · 原生方向键可调整</small>${err}`;break;
case'upload':html=`<div class="mini-card" style="border-style:dashed;text-align:center"><strong>${error?'! 文件无法读取':loading?'↑ 正在读取图片…':done?'✓ 图片已就绪':'↑ 拖入或选择图片'}</strong><p>PNG / JPEG / WebP · 最大 5 MB</p>${loading?'<progress aria-label="读取进度"></progress>':done?'<div class="content-placeholder">本地图片预览位置</div>':`<a class="button" href="#forms">体验本地上传</a>`}</div>${err}`;break;
case'form':html=`<div class="mini-card"><label>作品标题<input aria-label="${dlabel}" value="${value}"${dis}${ro}${invalid}></label><label>内容说明<textarea aria-label="${dlabel}说明"${dis}${ro}>完整展示使用过程</textarea></label>${err}${action}</div>`;break;
case'tabs':html=`<div class="mini-toolbar" aria-label="标签页外观"><button type="button"${dis} class="${selectedState?'':'primary'}" data-toast="完整键盘标签页见上方实验室">内容</button><button type="button"${dis} class="${selectedState?'primary':''}" data-toast="完整键盘标签页见上方实验室">审核记录</button></div><div class="mini-card">${empty?'尚无内容':loading?'正在读取…':error?'读取失败，请重试':selectedState?'示例审核记录 · 09:30':'作品内容与要求'}</div>`;break;
case'pagination':html=`<div class="mini-toolbar"><button aria-label="样例上一页" disabled>←</button><button class="primary" aria-current="page" data-toast="第1页样例">1</button><button${dis} data-toast="分页完整交互见数据实验室">2</button><button aria-label="样例下一页"${dis} data-toast="分页完整交互见数据实验室">→</button></div><small>${empty?'共 0 项':loading?'正在读取下一页…':'第 1 / 2 页 · 每页 3 项'}</small>`;break;
case'breadcrumb':html=`<nav aria-label="${dlabel}"><a href="#catalog">工作区</a><span aria-hidden="true"> / </span><a href="#rewards">Creator Rewards</a><span aria-hidden="true"> / </span><strong aria-current="page">${empty?'未选中对象':'作品详情'}</strong></nav>`;break;
case'stepper':html=`<ol class="timeline"><li>✓ 选择活动</li><li><strong>${error?'! 提交需修正':done?'✓ 提交已完成':'② 提交作品'}</strong>${err}</li><li>③ 查看审核结果</li></ol>`;break;
case'command':case'menu':html=`<div class="mini-card">${f==='command'?'<input aria-label="命令搜索外观" placeholder="搜索命令…">':'<strong>作品操作</strong>'}${empty?'<p>没有匹配的操作</p>':loading?'<p>正在读取操作…</p>':`<div class="mini-row">查看作品 <kbd>↵</kbd></div><div class="mini-row">复制链接 <kbd>⌘ C</kbd></div><div class="mini-row error">移除草稿</div>`}</div><small>菜单外观；命令路由与菜单键盘模型待实现。</small>`;break;
case'sidebar':html=`<div class="mini-card"><strong>Wringy 工作区</strong><nav aria-label="${dlabel}"><a href="#rewards" ${selectedState?'aria-current="page"':''}>Creator Rewards</a><a href="#data">作品审核</a><a href="#coverage">设置与权限</a></nav>${disabled?'<p>当前工作区只读</p>':''}</div>`;break;
case'dialog':case'drawer':html=`<div class="mini-overlay ${f==='drawer'?'mini-drawer':''}"><div class="mini-card"><strong>${label}</strong><p>${error?'保存失败，原内容保留。':empty?'尚未选择对象。':'一次只处理一个明确任务。'}</p><label>说明<input aria-label="${dlabel}" value="${value}"${dis}${invalid}></label><div class="mini-toolbar">${action}<button data-open-dialog>体验弹窗</button></div></div></div><small>${f==='drawer'?'抽屉布局样例；抽屉拖动与专属焦点管理未实现。':'完整焦点循环、Escape 与返回焦点见弹窗实验室。'}</small>`;break;
case'popover':html=`<button type="button" disabled>负责人 ▾</button><div class="mini-card"><strong>演示属性</strong><label>负责人<select aria-label="${dlabel}"${dis}><option>${empty?'暂无成员':'示例审核员 A'}</option><option>示例审核员 B</option></select></label>${err}</div><small>锚定布局样例 · 真实开合见反馈实验室</small>`;break;
case'tooltip':html=`<div class="mini-tooltip">${error?'此字段需要修正':'当前内容仅保存于本地'}</div><button type="button" aria-label="帮助视觉样例"${dis}>帮助 ⓘ</button><small>视觉展示；延迟与即时键盘行为见交互实验室。</small>`;break;
case'accordion':html=`<details ${open||error||done?'open':''}><summary>${label} · 提交要求</summary><p>${error?'要求读取失败，请重试。':'作品主体清晰；授权与统计口径以活动规则为准。'}</p></details><details><summary>素材与授权</summary><p>本例未连接实际素材库。</p></details>`;break;
case'toast':case'alert':html=`<div class="mini-card ${error?'negative':done?'positive':disabled?'warning':''}"><strong>${error?'! 保存失败':loading?'◷ 正在保存':done?'✓ 说明已保存':'内容仅保存在当前页面'}</strong><p>${error?'请重试；已有输入不会丢失。':'不会自动提交审核或发起付款。'}</p>${f==='toast'?'<button data-toast="说明已保存（本地演示）">体验提示</button>':action}</div>`;break;
case'skeleton':html=`<div aria-label="骨架屏视觉样例"><div class="skeleton" style="width:40%"></div><div class="skeleton"></div><div class="skeleton" style="width:75%"></div><small>${error?'读取失败后应替换为错误与重试入口':'正在读取作品列表，保留布局空间'}</small>${err}</div>`;break;
case'spinner':case'progress':html=`<label>${error?'读取中断':done?'处理完成':'正在处理示例文件'}<progress aria-label="${dlabel}" ${loading?'':`value="${error?30:done?100:55}" max="100"`}></progress></label><p>${error?'失败于第 3 项，请重试':done?'10 / 10 项完成':loading?'总进度未知':'已处理 5 / 10 项'}</p>${err}`;break;
case'empty':case'error':html=`<div class="empty"><strong>${error||f==='error'?'暂时无法读取':/match|result|匹配|筛选/i.test(st)?'没有匹配的作品':disabled?'你没有查看权限':'还没有作品'}</strong><p>${disabled?'向工作区管理员申请访问。':error||f==='error'?'已有输入保留。请稍后重试。':'调整筛选条件，或返回示例队列。'}</p><a class="button" href="#data">${error?'重试示例':'查看队列'}</a></div>`;break;
case'table':html=loading?'<p>正在读取表格…</p><div class="skeleton"></div><div class="skeleton"></div>':empty?'<div class="empty">没有匹配项<br><a href="#data">清除筛选</a></div>':error?'<div class="empty negative">读取失败<br><a href="#data">重试读取</a></div>':`<table><thead><tr><th>作品</th><th>状态</th></tr></thead><tbody><tr ${selectedState?'aria-selected="true"':''}><td>水瓶使用演示</td><td>待审核</td></tr><tr><td>通勤使用记录</td><td>需修改</td></tr></tbody></table>`;break;
case'filter':html=`<div class="mini-toolbar"><button${dis} data-toast="筛选原型见数据实验室">状态：待审核 ▾</button><button${dis} data-toast="筛选原型见数据实验室">负责人：全部 ▾</button></div><p>${empty?'没有匹配结果 · 筛选条件仍保留':loading?'正在筛选…':'当前 2 个匹配对象'}</p><a href="#data">清除筛选 / 体验完整筛选</a>`;break;
case'badge':html=`<div class="mini-toolbar"><span class="pill ${error?'negative':done?'positive':loading?'warning':''}">${error?'! 审核需修改':done?'✓ 内容通过':loading?'◷ 正在审核':selectedState?'已选择 · 待审核':'○ 待审核'}</span><span class="pill">标签：日常好物</span></div><p>状态必须保留完整文字，标签不代表付款。</p>`;break;
case'avatar':html=`<div class="mini-toolbar"><span class="avatar">${error||empty?'?':'A'}</span><span class="avatar">B</span><div><strong>${empty?'未知用户':'示例创作者 A'}</strong><p>${error?'头像无法读取 · 使用文字回退':'示例身份，非真实客户'}</p></div></div>`;break;
case'icon':html=`<div class="mini-toolbar"><span class="icon-sample" aria-label="搜索">⌕</span><span class="icon-sample" aria-label="完成">✓</span><span class="icon-sample" aria-label="关闭">×</span></div><p>${disabled?'禁用操作需文字解释':'20 / 24px 视觉尺寸 · 图标始终有用途与名称'}</p>`;break;
case'typography':html=`<h3>${empty?'未命名作品':'水瓶使用演示'}</h3><p>主体清晰，使用过程完整。</p><small>辅助说明 · ${error?'内容尚未读取':'更新于 2026-09-11 09:30 MYT'}</small>`;break;
case'separator':html='<strong>内容要求</strong><hr><p>使用过程完整，主体保持清晰。</p>';break;
case'card':html=`<article class="mini-card"><small>日常好物演示</small><h3>${empty?'尚无内容':'水瓶使用演示'}</h3><p>${error?'内容读取失败':loading?'正在读取内容…':'示例创作者 A · 活动详情'}</p>${action}</article>`;break;
case'chart':case'metrics':html=`<div class="mini-card"><small>${f==='metrics'?'合格播放 / 模拟数据':'审核对象数 / 模拟数据'}</small><h3>${empty||error?'— · 尚未确认':f==='metrics'?'50,000':'3 个作品'}</h3>${error?'<p class="error">数据源不可用，不能显示为 0。</p>':loading?'<p>正在读取 · 上次结果保留</p>':`<div class="chart-bar" style="width:80%"></div><span>${f==='metrics'?'50,000 次合格播放':'2 个待审核'}</span><div class="chart-bar" style="width:40%"></div><span>${f==='metrics'?'统计口径尚待批准':'1 个需修改'}</span>`}<p>模拟记录 · 更新于 09:30 MYT</p></div>`;break;
case'timeline':html=`<ol class="timeline"><li><strong>${error?'操作失败':done?'说明已保存':'审核说明已更新'}</strong><p>示例审核员 A · 09:30 MYT</p></li><li>作品已提交<p>示例创作者 A · 09:00 MYT</p></li></ol>`;break;
case'description':html=`${srow('作品','水瓶使用演示')}${srow('负责人',empty?'尚未分配':'示例审核员 A')}${srow('更新',error?'读取失败':'2026-09-11 09:30 MYT')}`;break;
case'money':html=`<div class="money-spec"><small>奖励金额 · 说明算例</small><h3>${empty||error?'— <small>尚未确认</small>':/zero|零/i.test(st)?'MYR 0.00':/negative|refund|负|退款/i.test(st)?'−MYR 250.00':'MYR 250.00'}</h3><p>金额有明确币种；不将未知当作零。</p></div>`;break;
case'payout':html=`<div class="mini-card"><small>出款记录 / 演示</small>${srow('奖励义务',empty?'尚未确认':'MYR 250.00')}${srow('付款处理',error?'处理失败':loading?'处理中':done?'处理完成':'尚未发起')}${srow('银行实际付款','尚未确认')}<p class="warning-text">处理完成不证明银行到账。</p>${action}</div>`;break;
case'budget':html=`<div class="mini-card"><small>活动预算 / 说明算例</small><h3>${empty?'— · 尚未确认':'MYR 10,000.00'}</h3>${srow('预算上限','MYR 10,000.00')}${srow('已确认奖励',empty?'尚未确认':'MYR 250.00')}${srow('可用余额','尚未确认')}<p>${error?'预算信息读取失败。保留上次信息标记。':'预算不等于平台收入。'}</p></div>`;break;
case'reward':html=`<div class="mini-card">${srow('合格播放','50,000')}${srow('说明算例','MYR 5 / 1,000 次')}${srow('奖励示例',empty||error?'尚未确认':'MYR 250.00')}<p>${error?'核验失败，不能产生确定奖励':loading?'核验处理中，不先显示成功':'费率仅来自商业模式说明算例，非批准价格。'}</p></div>`;break;
case'review':case'evidence':html=`<div class="mini-card"><small>提交 001</small><h3>水瓶使用演示</h3>${srow('内容审核',error?'需修改':done?'审核通过':'待审核')}${srow('证据',empty?'尚无证据':'授权说明 · 作品链接')}${srow('计量',loading?'核验中':'尚未确认')}<p>${error?'请补充完整使用过程。已有提交保留。':'内容通过不直接决定奖励或付款。'}</p>${action}</div>`;break;
case'campaign':html=`<div class="mini-card"><small>Creator Rewards · 说明算例</small><h3>日常好物演示</h3><ul><li>作品：主体清晰、使用完整</li><li>授权：按活动约定</li><li>计量：合格播放，口径待确认</li></ul><p>${error?'要求暂时无法读取':empty?'尚无活动要求':done?'活动说明已更新':'预算上限 MYR 10,000 · 非正式活动'}</p>${action}</div>`;break;
case'media':html=`<div class="media-surface"><span>${error?'媒体无法读取':empty?'尚无媒体':'▷'}</span><small>${loading?'正在缓冲…':'媒体播放器布局样例'}</small></div><div class="mini-row"><span>00:00 / —</span><span>字幕 · 音量 · 全屏</span></div><p>无真实媒体播放能力。键盘、字幕与进度控制待实现。</p>`;break;
case'product':html=`<article class="mini-card"><div class="product-surface">商品图位置</div><h3>创作素材包 · 示例</h3><p>${error?'商品信息暂不可用':empty?'暂无商品':'价格尚未确认 · 授权范围待定义'}</p>${action}</article>`;break;
case'checkout':html=`<div class="mini-card"><h3>订单摘要</h3>${srow('创作素材包','× 1')}${srow('商品价格','尚未确认')}${srow('税费','尚未确认')}${srow('总额','— · 尚未确认')}<button disabled>结账未开放</button><p>${error?'无法读取订单，请保留内容后重试。':'仅布局，不收款、不创建订单。'}</p></div>`;break;
case'course':html=`<div class="mini-card"><h3>创作基础 · 课程示例</h3><progress aria-label="课程进度视觉示例" value="${done?3:1}" max="3"></progress>${srow('01 拍摄准备','✓')}${srow('02 内容结构',error?'读取失败':'待学习')}${srow('03 成果复盘',disabled?'无权限':'待学习')}<small>课程播放与学习记录未实现。</small></div>`;break;
case'community':html=`<div class="mini-card"><strong>创作者讨论区</strong><p>${empty?'还没有成员':'示例成员 · 3 人'}</p>${srow('A 示例创作者','成员')}${srow('B 示例管理员','管理员')}<p>${disabled?'你暂无访问此社群的权限':'成员与权限为视觉样例。'}</p></div>`;break;
case'message':html=`<div class="mini-card"><small>示例创作者 A · 09:30</small><p>可以补充一下素材授权范围吗？</p><div class="note">${error?'消息发送失败，草稿已保留。':loading?'消息发送中…':'可以，说明已附在作品要求中。'}</div><label>消息草稿<textarea aria-label="${dlabel}" placeholder="输入消息"${dis}></textarea></label><small>不发送给任何人。</small></div>`;break;
case'notification':html=`<div class="mini-card">${empty?'<p>没有新通知</p>':srow('作品收到新说明','09:30')+srow('数据需要重新核验','昨天')}<p>${error?'读取失败，请稍后重试':'仅模拟站内通知，无消息投递。'}</p></div>`;break;
case'affiliate':html=`<div class="mini-card"><h3>推荐记录</h3>${srow('推荐链接','尚未生成')}${srow('归因结果',loading?'核验中':'尚未确认')}${srow('可获得佣金','尚未确认')}<p>${error?'归因信息读取失败':'联盟归因与佣金规则待定义。'}</p></div>`;break;
case'ads':html=`<div class="mini-card"><h3>创作活动推广</h3>${srow('广告状态',error?'投放异常':loading?'审核中':'草稿')}${srow('预算','尚未确认')}${srow('展示 / 点击','尚未确认')}<div class="content-placeholder">广告素材预览</div><small>无实际投放或计费。</small></div>`;break;
case'integration':html=`<div class="mini-card"><strong>内容数据连接</strong>${srow('连接状态',error?'连接已断开':done?'连接外观样例':'尚未连接')}${srow('上次更新',empty?'未知':'2026-09-11 09:30 MYT')}<button disabled>连接尚未开放</button><p>未接入平台 API；不能证明数据权限。</p></div>`;break;
case'ai':html=`<div class="mini-card"><label>生成提示<textarea aria-label="${dlabel}"${dis}>根据使用过程，整理内容要点。</textarea></label>${loading?'<progress aria-label="生成中"></progress>':`<div class="content-placeholder">${error?'生成失败，提示词已保留':empty?'生成结果将在此显示':'示例结果：准备、使用、清洁三个步骤。'}</div>`}<small>固定视觉样例，没有调用模型。</small></div>`;break;
case'permission':html=`<table><thead><tr><th>角色</th><th>查看</th><th>编辑</th></tr></thead><tbody><tr><td>管理员</td><td>允许</td><td>${disabled?'受限':'允许'}</td></tr><tr><td>成员</td><td>允许</td><td>不允许</td></tr></tbody></table><p>权限外观；客户端展示不代替服务端鉴权。</p>`;break;
case'pricing':html=`<div class="mini-card"><small>方案提案</small><h3>创作者工作区</h3><strong>价格尚未确认</strong><ul><li>查看活动要求</li><li>管理作品与证据</li></ul><button disabled>订阅未开放</button><p>没有批准套餐或收费规则。</p></div>`;break;
case'layout':html=`<div class="layout-spec"><div>导航</div><div><strong>主要工作面</strong><p>${empty?'尚未选择对象':'对象标题与内容'}</p></div><div>属性</div></div><p>窄屏时导航收起，属性移到正文后。</p>`;break;
case'file':html=`<div class="mini-card">${srow('授权说明.pdf',error?'读取失败':loading?'读取中':'文档 · 示例')}${srow('作品截图.png',empty?'未上传':'图片 · 示例')}<a href="#forms">体验本地预览</a></div>`;break;
case'link':html=`<a class="sample-link" href="#foundations">查看品牌与设计变量 ↗</a><p>${disabled?'不可用链接应附原因并移除跳转':'内部锚点链接，支持键盘访问。'}</p>`;break;
case'list':html=`<div class="mini-card">${empty?'<p>暂无对象</p>':srow('水瓶使用演示',selectedState?'✓ 已选择':'待审核')+srow('通勤使用记录','需修改')}${err}</div>`;break;
default:html=`<div class="mini-card"><strong>${label}</strong>${srow('主要对象','水瓶使用演示')}${srow('当前状态',esc(status))}<p>${esc(c.description)}</p><small>组合布局草图；具体布局与交互尚待逐项设计。</small></div>`;
}
html=html.replaceAll('MYR 250.00',DEMO.rewardFormatted).replaceAll('MYR 10,000.00',DEMO.budgetFormatted).replaceAll('MYR 5 / 1,000 次',DEMO.rateFormatted);
const special=window.WRINGY_EXTRA_SPECIMENS?.[c.id]?.(c,st,variant)||domainSpecimen(c,st,variant)||specificSpecimen(c,f,st,variant);if(special)html=special;html=normalizeSpecimen(html,c,st);
const stateNote=stateExplanation(st,c.name);
const tone=error?'negative':disabled?'warning':done?'positive':'';
return `<div class="specimen-state ${focus?'sample-focus':''} ${/hover/.test(st)?'sample-hover':''} ${/pressed|dragging/.test(st)?'sample-pressed':''}" data-family="${f}" data-rendered-state="${esc(st)}" data-rendered-variant="${esc(variant)}">${html}${st!=='default'?`<div class="state-explanation ${tone}"><strong>${esc(stateTitle(st))}</strong><p>${esc(stateNote)}</p></div>`:''}${variant?`<small class="variant-caption">变体契约：${esc(variant)}${f==='button'?'':' · 本样例展示家族基础结构，变体细节见完整契约'}</small>`:''}</div>`;
}
let catalogData=[];
const contractLabels={variants:'变体',states:'适用状态',keyboard:'键盘',accessibility:'无障碍',responsive:'响应布局',motion:'动效',usage:'何时使用',avoid:'避免',modules:'所属板块'};
function choices(value){if(Array.isArray(value))return value.map(v=>typeof v==='string'?v:v.name||v.id||textValue(v));if(value&&typeof value==='object')return Object.keys(value);return value?[String(value)]:[];}
function renderCatalog(){const query=$('#catalog-search').value.trim().toLowerCase(),category=$('#category-filter').value;const visible=catalogData.filter(c=>(category==='all'||c.category===category)&&JSON.stringify(c).toLowerCase().includes(query));$('#catalog-status').textContent=`显示 ${visible.length} / ${catalogData.length} 个组件`;$('#catalog-grid').innerHTML=visible.map(c=>{const family=familyFor(c),states=choices(c.states),variants=choices(c.variants),interactive=liveIDs.has(c.id)&&!window.WRINGY_EXTRA_COVERAGE?.[c.id],coverage=interactive?'interactive':family==='composite'?'specification':'visual';window.WRINGY_COVERAGE[c.id]=componentCoverage(c,family,states,variants);return `<article class="catalog-card" id="component-${esc(c.id)}" data-component-id="${esc(c.id)}"><header><div><h3>${esc(c.name)}</h3><small>${esc(c.id)} · ${esc(c.category)}</small></div><span class="pill ${interactive?'live':''}">${interactive?'部分交互原型':family==='composite'?'组合草图 · 仅规范':'视觉样例'}</span></header><p>${esc(c.description)}</p><div class="sample-controls">${states.length?`<label>状态<select data-spec-state="${esc(c.id)}" aria-label="${esc(c.name)}样例状态">${states.map(s=>`<option value="${esc(s)}">${esc(stateTitle(s,c.id))} · ${esc(s)}</option>`).join('')}</select></label>`:''}${variants.length?`<label>变体<select data-spec-variant="${esc(c.id)}" aria-label="${esc(c.name)}样例变体">${variants.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label>`:''}</div><div class="specimen" id="specimen-${esc(c.id)}">${specimen(c,states[0]||'默认',variants[0]||'')}</div><div class="sample-foot"><small>${esc(familyKinds[family]||c.name)} · 状态切换是视觉演示</small>${interactive?`<a class="sample-link" href="${liveFamilies[family]||(['measurement','risk-case'].includes(c.id)?'#rewards':'#overview')}">体验完整交互面板 ↗</a>`:''}</div><details><summary>查看完整契约 <span>↗</span></summary><dl class="contract">${Object.entries(contractLabels).map(([key,label])=>`<dt>${label}</dt><dd>${esc(textValue(c[key]))}</dd>`).join('')}<dt>成熟度</dt><dd>${esc(c.maturity||'specified')} · 仅定义规范，非生产实现</dd></dl></details></article>`;}).join('')||'<div class="empty"><h3>没有匹配组件</h3><p>保留当前搜索与家族条件。</p><button id="clear-catalog">清除搜索与家族筛选</button></div>';const clear=$('#clear-catalog');if(clear)clear.onclick=()=>{$('#catalog-search').value='';$('#category-filter').value='all';renderCatalog();$('#catalog-search').focus();};$$('[data-spec-state],[data-spec-variant]').forEach(s=>s.onchange=()=>{const id=s.dataset.specState||s.dataset.specVariant,c=catalogData.find(x=>x.id===id),card=s.closest('.catalog-card');$('.specimen',card).innerHTML=specimen(c,$('[data-spec-state]',card)?.value||'默认',$('[data-spec-variant]',card)?.value||'');applyIndeterminate(card);});}
readData('catalog').then(data=>{if(!Array.isArray(data.components))throw Error('目录格式不正确');catalogData=data.components;$('#nav-count').textContent=catalogData.length;$('#catalog-count').textContent=`${catalogData.length} 个组件 · ${new Set(catalogData.map(c=>c.category)).size} 个家族`;$('#category-filter').innerHTML='<option value="all">全部家族</option>'+[...new Set(catalogData.map(c=>c.category))].map(category=>`<option>${esc(category)}</option>`).join('');renderCatalog();applyIndeterminate(document);updateMaturityCounts();window.WRINGY_CATALOG_READY=true;}).catch(e=>{$('#catalog-status').textContent=e.message+' 其他交互实验室可独立使用。';});
$('#catalog-search').oninput=renderCatalog;$('#category-filter').onchange=renderCatalog;
function stateTitle(s,id){if(s==='confirmed'&&id==='payout')return '服务商报告已完成';return ({default:'常态',hover:'悬停',pressed:'按下',focus:'键盘焦点',focused:'键盘焦点',disabled:'不可操作',readonly:'只读',loading:'正在读取',error:'发生错误',empty:'暂无内容',unknown:'尚未确认',stale:'数据已过期',selected:'已选择',unselected:'尚未选择',checked:'已勾选',unchecked:'未勾选',indeterminate:'部分勾选',open:'已展开',closed:'已收起',visible:'已显示',dismissed:'已关闭',paused:'已暂停',queued:'排队中',unavailable:'不可取得',restricted:'访问受限',zero:'已确认为零',ready:'内容就绪','no-results':'没有匹配结果',conflict:'版本冲突',submitting:'正在提交',success:'演示成功',off:'关闭',on:'开启',saving:'正在保存',saved:'已保存',filled:'已有输入',truncated:'内容截断',masked:'敏感值遮蔽',fallback:'替代内容',active:'当前有效',expanded:'已展开',collapsed:'已收起',current:'当前步骤',complete:'已完成',upcoming:'尚未开始',blocked:'存在阻塞',end:'已到末页',typing:'正在输入',results:'已有结果',dragover:'文件悬停',validating:'正在校验',uploading:'正在读取文件',processing:'处理中',canceled:'已取消',pristine:'尚未修改',dirty:'尚未保存',editing:'正在编辑',applied:'条件已应用','partial-selection':'部分选中',insufficient:'样本不足','insufficient-sample':'样本不足',partial:'部分结果',running:'进行中',unread:'未读',read:'已读',offline:'离线',retrying:'正在重试',recovered:'已恢复',unauthorized:'权限不足',unsupported:'格式不支持',expired:'已过期',draft:'草稿',posting:'正在提交',posted:'已记录',resolved:'已解决','expired-rights':'授权已过期',ended:'已结束',published:'已发布',unpublished:'未发布',preview:'预览',invalid:'校验未通过',superseded:'已有新版本',available:'当前可用',low:'剩余额较低',exhausted:'已耗尽',held:'受限制',submitted:'已提交',duplicate:'重复对象',withdrawn:'已撤回',assigned:'已分配',reviewing:'复核中','needs-evidence':'需补证',decided:'已有决定',waiting:'等待中',collecting:'采集中',unverified:'尚未核验',verified:'已核验',correction:'需要修正','window-closed':'窗口已关闭','correction-required':'需要修正','needs-review':'需要复核','confirmed-bank':'银行确认','reported':'仅观察记录',estimating:'估算中',eligible:'资格已确认',accruing:'累积中','pending-settlement':'待结算',payable:'可提现应付','risk-held':'受风险限制',reversed:'已逆转','needs-action':'需要操作',completed:'已完成',scheduled:'已排期',recorded:'已记录',missing:'信息缺失',corrected:'已修正',disconnected:'未连接',connected:'已连接',authorizing:'授权中',revoked:'已撤销',invited:'已邀请','needs-input':'需补信息','quote-expired':'报价已过期','quote-stale':'报价已失效','requires-action':'需进一步操作',failed:'确定失败',confirmed:'已获确认',paid:'记录显示已支付',unpaid:'未支付',granted:'已获权限',locked:'访问锁定',booked:'已预约',full:'已满额',shipped:'已发出',delivered:'已送达',denied:'未批准',approved:'已批准',rejected:'未通过',clear:'无开放风险记录',flagged:'待风险复核',cleared:'限制已解除',maintained:'限制已维持',appealing:'申诉中',revealed:'当前显示',creating:'创建中',streaming:'输出中',generating:'生成中',stopped:'已停止',proposed:'待确认提案',executing:'执行中',live:'已发布',building:'构建中',qualified:'符合资格','not-qualified':'不符合资格'})[s]||extraStateLabels[s]||'待核对状态';}
function stateExplanation(s,name){if(/unknown|unavailable|missing|unverified/.test(s))return `${name}尚未获得可靠结果；保留来源与更新时间，不能改写为零或成功。`;if(/error|fail|invalid|conflict/.test(s))return `${name}未完成。保留已输入内容及原对象，说明原因后提供修正或查询原请求入口。`;if(/readonly/.test(s))return '信息保持可读、可选择和复制，修改入口不可用；不把只读误画成加载。';if(/disabled|restricted|locked|revoked/.test(s))return `${name}当前不可操作；原因持续显示，受限数据在真实实现中须由服务端控制。`;if(/load|saving|submitting|upload|processing|collect|generating|streaming|validating|querying/.test(s))return `${name}正在处理；保留空间和已确认内容，不将请求发出当成功，阻止重复提交。`;if(s==='hover')return '精确指针悬停时出现边界反馈；触屏不依赖悬停获取关键内容。';if(/focus/.test(s))return '清晰外轮廓与原状态共存；键盘立即响应，不安排入场运动。';if(/press|dragging/.test(s))return '按下产生轻微反馈；减少动态效果时不缩放，拖动需有按钮或键盘替代。';if(/empty|no-results/.test(s))return '区分首次无内容与筛选无结果；无结果保留条件，并提供清除入口。';if(/selected|checked/.test(s))return '选中与焦点是独立事实；多选的全选只作用于明确集合。';if(/stale|expired/.test(s))return '显示失效原因与上次确认时间；旧值不能当作当前有效结果继续操作。';if(/closed|collapsed|dismissed/.test(s))return '内容收起，触发入口保留；关闭后焦点回到合理位置。';if(/paused|held|blocked/.test(s))return '已完成部分保留；清楚说明阻塞原因、下一责任人和恢复条件。';return `${name}处于“${stateTitle(s)}”的视觉快照。仅展示此状态的含义，真实转换仍须业务证据与权限确认。`;}
function specificSpecimen(c,f,s,variant){const error=/error|fail|invalid|conflict|rejected|denied/.test(s),empty=/empty|unknown|missing|unavailable/.test(s),busy=/loading|processing|saving|running|validating|generating/.test(s),ro=s==='readonly',restricted=/restricted|revoked|locked/.test(s),dis=restricted?' disabled':'',label=esc(c.name),status=esc(stateTitle(s)),row=(a,b)=>`<div class="mini-row"><span>${a}</span><strong>${b}</strong></div>`,card=body=>`<div class="mini-card">${body}</div>`,note=t=>`<p>${t}</p>`,amount=empty?'— · 尚未确认':'MYR 250.00';
switch(f){

case'number':case'moneyinput':return `<label>${f==='moneyinput'?'金额（MYR）':'数量'}<input type="number" aria-label="${label}视觉示例" value="${empty?'':f==='moneyinput'?250:3}" ${f==='moneyinput'?'step="0.01"':'step="1"'} ${ro?'readonly':''}${s==='disabled'?'disabled':''}${error?'aria-invalid="true"':''}></label>${note(error?'请输入有效数值；保留已有输入。':f==='moneyinput'?'MYR 250 来自商业模式说明算例；不是批准价格。':'数量需整数；边界规则由实际业务定义。')}`;
case'segmented':return `<fieldset><legend>展示范围</legend><div class="segmented"><label class="choice"><input type="radio" name="segment-${c.id}" ${s!=='selected'?'checked':''}${s==='disabled'?'disabled':''}>全部</label><label class="choice"><input type="radio" name="segment-${c.id}" ${s==='selected'?'checked':''}${s==='disabled'?'disabled':''}>我的</label></div></fieldset>`;

case'rules':return card(`<strong>活动规则 v2 · ${status}</strong>${row('原版 v1','主体清晰')}${row('新版 v2','补充完整使用过程')}<label>变更理由<textarea aria-label="规则变更说明"${ro?'readonly':''}>解释本次修改与适用范围。</textarea></label>${note(s==='conflict'?'已有新版本，请比较后重新确认。':'不会自动将新规则用于已接受旧版的提交。')}`);
case'submission':return card(`<strong>公开作品提交</strong><label>作品链接<input aria-label="作品链接视觉示例" type="url" value="${empty?'':'https://example.com/demo-post'}"${error?'aria-invalid="true"':''}></label>${row('提交状态',status)}${row('适用要求','v1 · 接受时记录')}${note(s==='duplicate'?'此对象已有提交记录，请查看原记录。':error?'链接校验未通过，请检查平台与公开权限。':'公开链接、内容预审与终审记录分别保存。')}`);
case'creatorprogress':return card(`<ol class="timeline"><li>✓ 接受活动要求</li><li>${s==='completed'?'✓':'②'} 提交公开作品</li><li>${s==='blocked'?'! 等待补证':'③ 等待内容与计量核验'}</li></ol>${row('下一责任人',s==='needs-action'?'创作者':'待分派：品牌审核队列')}${note('进度不推导付款或风险结果。')}`);




case'risk':return card(`<strong>风险案件 DEMO-001</strong>${row('案件状态',status)}${row('限制范围',s==='clear'||s==='cleared'?'无本案件开放限制':'暂停奖励释放 · 视觉示例')}${row('内容原结论','保持独立')}${row('责任队列','B10 风险复核')}${note(s==='cleared'?'解除此项限制不自动批准内容或发起付款。':'标记不是风险已成立；具体限制需要有权决定。')}`);
case'appeal':return card(`<strong>复议案件 DEMO-001</strong>${row('原决定','保留原审核理由')}${row('复议状态',status)}${row('下一责任人','品牌授权复审队列')}<label>补充说明<textarea aria-label="复议说明样例">说明哪一项要求被误判。</textarea></label>${note('支持负责协调，不代品牌批准；新决定引用旧决定。')}`);



default:return null;
}}
const extraStateLabels={'querying':'搜索中','dragging':'拖动中','cancel-confirmation':'等待取消确认','canceling':'取消处理中','actionable':'可执行下一步','adjusted':'已有调整记录','application-pending':'申请待处理','applying':'正在申请','archived':'已归档','awaiting-details':'等待补充详情','awaiting-owner':'等待责任方','buffering':'缓冲中','cancel-scheduled':'已安排取消','checking':'正在核对','closed-to-new':'停止新参与','configuring':'配置中','confirming':'等待确认','connecting':'正在连接','consent':'待授权确认','delayed':'结果延迟','dismissible':'可以关闭','exception':'履约异常','extended':'已延长','idle':'尚未开始','in-progress':'进行中','in-review':'审核中','incomplete':'信息未完整','incomplete-rules':'规则未完整','initiated':'已发起','invalid-link':'链接无效','needs-correction':'需要修正','needs-info':'需要补件','not-installed':'尚未安装','not-started':'尚未开始','overdue':'已逾期','partial-scope':'部分权限','partially-paid':'部分支付','partially-released':'部分释放','passed':'已通过','past-due':'已逾期','pending':'待处理','pending-sync':'等待同步','playing':'正在播放','preview-ready':'预览已就绪','publishing':'发布中','quoted':'报价已返回','rate-limited':'请求受限','receiving':'正在接收','redeemed':'已兑换','released':'已释放','removed':'已移除','rescheduled':'已改期','reserving':'预留中','retired':'已停用','returned':'已退回','rollback-pending':'等待回退','selecting':'选择中','sending':'发送中','sent':'已发送','under-review':'复核中','underfunded':'预算不足','unavailable-target':'目标不可访问','uncollectible':'无法收取','unmatched':'尚未匹配','validated':'校验完成','visited':'已访问','void':'已作废'};
function normalizeSpecimen(html,c,state){const template=document.createElement('template');template.innerHTML=html;const root=template.content;
if(state==='closed'&&['dialog','drawer','popover','tooltip','menu','command-menu'].includes(c.id)){root.replaceChildren();const b=document.createElement('button');b.type='button';b.textContent='打开'+c.name+'（视觉状态请切换为已展开）';b.dataset.toast='使用状态选择器查看展开外观；完整交互见上方实验室。';root.append(b);}
if(state==='open'&&c.id==='select'){const select=$('select',root);if(select){const list=document.createElement('div');list.className='mini-card';list.innerHTML=[...select.options].map(o=>'<div class="mini-row">'+esc(o.textContent)+'</div>').join('');select.after(list);}}
if(c.id==='link'&&state==='unavailable'){$$('a',root).forEach(el=>{const p=document.createElement('span');p.className='readonly-value';p.textContent='链接不可用 · 目标暂时无法访问';el.replaceWith(p);});}
if(c.id==='text'&&state==='masked')root.textContent='联系信息：••••••（已遮蔽）';
if(c.id==='text'&&state==='truncated'){$$('h3',root).forEach(el=>{el.textContent='水瓶日常使用演示及完整场景内容说明';el.style.whiteSpace='nowrap';el.style.overflow='hidden';el.style.textOverflow='ellipsis';});}

if(c.id==='icon'&&state==='unavailable'){root.replaceChildren();const p=document.createElement('p');p.textContent='图标不可取得 · 保留操作文字';root.append(p);}
if(c.id==='avatar'&&state==='fallback'){$$('.avatar',root).forEach(el=>el.textContent='?');}
if(c.id==='date-time'&&state==='empty'){$$('input',root).forEach(el=>el.value='');}
if(c.id==='metric'&&['zero','unknown','loading','error'].includes(state)){const h=$('h3',root);if(h)h.textContent=state==='zero'?'0 · 已确认':state==='loading'?'正在读取…':'— · 尚未确认';$$('.chart-bar',root).forEach(el=>el.remove());}
if(c.id==='chart'&&['unknown','empty','loading','error'].includes(state)){const h=$('h3',root);if(h)h.textContent=state==='loading'?'正在读取…':'— · 尚未确认';$$('.chart-bar',root).forEach(el=>el.remove());}
if(c.id==='progress'&&state==='unknown'){$$('progress',root).forEach(el=>el.removeAttribute('value'));$$('p',root).forEach(el=>el.textContent='已完成量与总量尚未确认。');}
if(c.id==='pagination'&&state==='end'){$$('button',root).forEach(el=>{el.disabled=el.getAttribute('aria-label')==='样例下一页';});$$('small',root).forEach(el=>el.textContent='第 2 / 2 页 · 已到末页');}
if(c.id==='toast'&&['dismissed','queued'].includes(state)){root.replaceChildren();const p=document.createElement('p');p.textContent=state==='dismissed'?'提示已关闭，页面关键结果仍保留。':'提示等待展示，不抢占焦点。';root.append(p);}
if(c.id==='search'&&['no-results','loading','results'].includes(state)){const p=document.createElement('p');p.textContent=state==='no-results'?'没有匹配的作品，当前条件保留。':state==='loading'?'正在搜索…':'找到 2 个示例作品。';root.append(p);}
if(state==='readonly'){$$('input,textarea',root).forEach(el=>{if(['checkbox','radio','range'].includes(el.type)){const p=document.createElement('span');p.className='readonly-value';p.tabIndex=0;p.textContent=el.type==='range'?el.value:el.checked?'已选择（只读）':'未选择（只读）';el.replaceWith(p);}else el.readOnly=true;});$$('select',root).forEach(el=>{const p=document.createElement('span');p.className='readonly-value';p.tabIndex=0;p.textContent=(el.selectedOptions[0]?.textContent||'尚未选择')+'（只读）';el.replaceWith(p);});$$('button',root).forEach(el=>el.disabled=true);}
if(['disabled','restricted','unavailable'].includes(state)){$$('button,input,select,textarea',root).forEach(el=>el.disabled=true);$$('a',root).forEach(el=>{const span=document.createElement('span');span.textContent=el.textContent+'（不可用）';span.className='readonly-value';el.replaceWith(span);});}
if(state==='indeterminate'){$$('input[type=checkbox]',root).forEach(el=>{el.dataset.indeterminate='true';el.setAttribute('aria-checked','mixed');});}
if(['loading','saving','submitting'].includes(state)){$$('button',root).forEach(el=>{el.disabled=true;el.setAttribute('aria-busy','true');});}
if(state==='focus'||state==='focused'){$('button,input,select,textarea,a',root)?.classList.add('demo-focus');}
return template.innerHTML;}
function domainSpecimen(c,s,variant){const id=c.id,st=stateTitle(s,id),unknown=/unknown|unavailable|waiting/.test(s),row=(a,b)=>`<div class="mini-row"><span>${a}</span><strong>${esc(b)}</strong></div>`,card=body=>`<div class="mini-card">${body}</div>`,note=t=>`<p>${t}</p>`,reward=unknown?'尚未确认':DEMO.rewardFormatted;
if(id==='measurement')return card(`<strong>计量快照 · ${esc(st)}</strong>${row('原始播放',['waiting','collecting','unavailable'].includes(s)?'尚未确认':'50,000 · 模拟观察')}${row('合格播放',s==='verified'?DEMO.formattedViews:'尚未确认')}${row('本次可计入',s==='verified'?DEMO.formattedViews:'尚未确认')}${row('窗口',s==='window-closed'?'已关闭，核验状态独立':'尚未确认')}${row('数据来源','模拟快照 · 无平台 API')}${note(s==='unavailable'?'连接不可用，未知不记零。':s==='correction'?'创建更正版本；原快照保留。':'原始量、合格量与本次增量分别记录。')}`);
if(id==='reward-breakdown')return card(`<strong>奖励义务 · ${esc(st)}</strong>${row('合格播放',unknown?'尚未确认':DEMO.formattedViews)}${row('说明算例',DEMO.rateFormatted)}${row(['estimating','eligible'].includes(s)?'估算金额':'说明金额',reward)}${row('可释放性',s==='risk-held'?'受风险限制；原义务保留':s==='payable'?'演示可提现应付':'尚未确认')}${row('银行到账','尚未确认')}${note(s==='reversed'?'逆转引用原记录，不删除历史。':'资格、义务、可释放性与付款分别成立。费率仅为说明假设。')}`);
if(id==='payout')return card(`<strong>奖励出款 · ${esc(st)}</strong>${row('金额',s==='unknown'?'尚未确认':DEMO.rewardFormatted)}${row('处理结果',s==='confirmed'?'服务商报告已完成':st)}${row('银行到账','尚未确认')}${row('原请求引用',s==='incomplete'?'尚未创建':'DEMO-PAY-001')}${note(s==='unknown'?'结果未知：查询原请求，不再发起新付款。':s==='failed'?'确定失败后按通道结果提供恢复入口，不能仅凭超时判断。':s==='returned'?'保留原付款及新的退回记录。':'受理、服务商完成与银行确认是不同证据等级。')}<a class="sample-link" href="#rewards">查看付款独立状态控制台</a>`);
if(id==='wallet')return card(`<strong>钱包分区 · ${esc(st)}</strong>${row('已确认余额',s==='zero'?'MYR 0.00':unknown||s==='loading'?'尚未确认':DEMO.rewardFormatted)}${row('可用于出款',s==='restricted'?'受限':s==='zero'?'MYR 0.00':'尚未确认')}${row('预留 / 受限资金','尚未确认')}${row('快照时间',s==='stale'?'旧快照，需刷新':'模拟数据')}${note('余额分区不能互相替代；预算与平台收入不同。')}`);
if(id==='budget')return card(`<strong>活动预算 · ${esc(st)}</strong>${row('预算上限',unknown?'尚未确认':DEMO.budgetFormatted)}${row('当前可承诺',s==='exhausted'?'MYR 0.00':s==='held'?'受限制':s==='low'?'余量不足以承诺新任务':'尚未确认')}${row('已确认奖励',unknown?'尚未确认':DEMO.rewardFormatted)}${note('示例预算来自商业模式算例。停止新承诺不取消已有应付义务。')}`);
if(id==='risk-case')return card(`<strong>风险案件 DEMO-001 · ${esc(st)}</strong>${row('案件事实',st)}${row('限制范围',['clear','cleared'].includes(s)?'无本案件开放限制':s==='flagged'?'尚未裁决':'暂停奖励释放 · 视觉样例')}${row('内容结论','原内容决定保持独立')}${row('责任队列','B10 风险复核')}${note(s==='cleared'?'解除限制不能自动批准内容或发起付款。':s==='flagged'?'存在疑点不等于风险已成立，不自动拒稿。':'限制、证据与申诉分别记录。本页不执行真实风险操作。')}`);
if(id==='appeal')return card(`<strong>内容复议 · ${esc(st)}</strong>${row('原决定','保留原要求、理由与版本')}${row('案件进度',st)}${row('下一责任人',s==='needs-evidence'?'创作者补证':s==='awaiting-owner'?'等待品牌授权复审员':'品牌授权复审队列')}<label>补充理由<textarea aria-label="复议理由样例" ${s==='closed'||s==='expired'?'readonly':''}>说明哪项要求被误判，并附新的依据。</textarea></label>${note(s==='decided'?'新决定引用旧决定；不删除原记录。':'支持只协调，不替品牌批准。')}`);
if(id==='campaign-brief')return card(`<strong>日常好物演示 · ${esc(st)}</strong>${row('活动状态',st)}${row('奖励预算上限',DEMO.budgetFormatted)}${row('计酬口径',s==='incomplete-rules'?'缺少有效播放定义':'说明算例，待规则批准')}<ul><li>作品主体清楚、使用过程完整</li><li>授权范围与规则版本必须可查</li><li>可选预审不等于最终审核</li></ul>${note(['paused','ended','restricted','incomplete-rules'].includes(s)?'当前不可新增参与；已有义务仍需独立处理。':'活动布局示例，不开放真实参与或付费承诺。')}`);
if(id==='submission')return card(`<strong>公开作品提交 · ${esc(st)}</strong><label>公开链接<input aria-label="公开作品链接样例" type="url" value="https://example.com/demo-post" ${['invalid-link','error'].includes(s)?'aria-invalid="true"':''} ${['submitted','withdrawn'].includes(s)?'readonly':''}></label>${row('规则版本','v1 · 接受时记录')}${row('提交结果',st)}${note(s==='duplicate'?'同一作品已有提交，查看原记录，不能重复奖励。':s==='invalid-link'?'链接格式或公开权限不符合，请检查后重试。':s==='withdrawn'?'原记录与已有义务保留，不以撤回抹除。':'本地输入不上传、不发送审核请求。')}`);
if(id==='review-workbench')return card(`<strong>内容审核 · ${esc(st)}</strong>${row('公开作品','水瓶使用演示')}${row('预审','不要求预审 · 独立子状态')}${row('终审',s==='decided'?'已有内容决定':st)}${row('计量 / 风险','分别核对')}<label>审核说明<textarea aria-label="审核说明样例" ${s==='readonly'?'readonly':''}>请核对已接受的规则与完整使用过程。</textarea></label>${note(s==='conflict'?'已有更新决定，比较版本后再提交；不可静默覆盖。':'审核员只决定内容；客服不能代品牌批准。')}`);
return null;}
const visualStateOverrides={
button:['default','hover','pressed','focus','disabled','loading'],link:['default','focus','unavailable'],icon:['default','unavailable'],text:['default','truncated','masked'],avatar:['default','fallback'],badge:['default'],separator:['default'],sidebar:['default','focus','active'],breadcrumb:['default','focus','current'],tabs:['default','focus','selected','disabled','loading'], 'command-menu':['closed','open','empty','error'],stepper:['current','complete','upcoming','blocked','error'],pagination:['default','focus','loading','disabled','end','error'],search:['empty','focus','typing','loading','results','no-results','error','disabled'],field:['default','focus','error','disabled','readonly'],'text-input':['default','hover','focus','filled','disabled','readonly','error'],textarea:['empty','focus','filled','readonly','disabled','error'],'number-input':['empty','focus','filled','readonly','disabled','error'],'money-input':['empty','focus','filled','readonly','disabled','error'],checkbox:['unchecked','hover','pressed','focus','checked','indeterminate','disabled','error','readonly'],radio:['unselected','hover','focus','selected','disabled','error','readonly'],switch:['off','on','hover','pressed','focus','disabled','saving','error'],select:['closed','open','focus','selected','loading','empty','error','disabled','readonly'],'segmented-control':['default','hover','focus','selected','disabled'],'date-time':['empty','focus','selected','unavailable','error','readonly','disabled'],slider:['default','focus','disabled','readonly'],'file-upload':['idle','validating','uploading','processing','ready','error','canceled'],form:['pristine','dirty','validating','submitting','success','error','readonly'],'filter-builder':['default','applied','empty','loading','error'],'data-table':['loading','ready','empty','no-results','error','selected'],metric:['loading','ready','zero','unknown','error'],chart:['loading','ready','empty','unknown','error'],progress:['idle','running','complete','error','unknown'],skeleton:['loading'],'empty-state':['empty','no-results','unselected','restricted'],alert:['visible','actionable'],toast:['visible','paused','dismissed'],'notification-inbox':['loading','empty','error'],'error-recovery':['offline','retrying','recovered','unauthorized','unknown'],tooltip:['closed','hover','focus','open'],popover:['closed','open','focus','loading','error'],menu:['closed','open','disabled'],dialog:['closed','open','submitting','error'],drawer:['closed','open','loading','error'],'media-player':['loading','ready','error','restricted'],'file-preview':['loading','ready','error','restricted'], 'social-connection':['disconnected','connected','expired','error','revoked'],'team-access':['active','restricted'],checkout:['loading','ready','unknown','failed'],course:['locked','available','in-progress','failed','completed'], 'app-connection':['not-installed','connected','error'],'ai-workbench':['idle','generating','ready','failed']};
const domainAllStates=new Set(['campaign-brief','rule-editor','budget','submission','review-workbench','measurement','reward-breakdown','creator-progress','wallet','payout','risk-case','appeal']);
function componentCoverage(c,family,states,variants){const extra=window.WRINGY_EXTRA_COVERAGE?.[c.id],visual=extra?.statesVisual|| (domainAllStates.has(c.id)?states:visualStateOverrides[c.id]||['default'].filter(s=>states.includes(s))),contractOnly=extra?.statesContractOnly||states.filter(s=>!visual.includes(s));return {id:c.id,name:c.name,family,level:extra?.level||(liveIDs.has(c.id)?'interactive':'visual'),production:false,maturity:c.maturity||'specified',visualSpecimen:true,interactiveScope:liveIDs.has(c.id)&&!extra?'上方实验室的局部交互；未交付生产组件':'家族视觉样例；无完整组件交互',statesDeclared:states,statesVisual:visual,statesContractOnly:contractOnly,stateCoverage:Object.fromEntries(states.map(s=>[s,visual.includes(s)?'visual':'contract-only'])),variantsDeclared:variants,variantsVisual:c.id==='button'?variants:[],variantsContractOnly:c.id==='button'?[]:variants,notes:extra?.notes||['状态说明不等于行为已实现；视觉覆盖不证明生产转换','真实接口、权限、持久化及业务规则尚未实现']};}
function applyIndeterminate(root){$$('[data-indeterminate]',root).forEach(el=>el.indeterminate=true);}
function updateMaturityCounts(){const counts={interactive:0,visual:0,specification:0,production:0};Object.values(window.WRINGY_COVERAGE).forEach(c=>counts[c.level]++);window.WRINGY_MATURITY=counts;$('#maturity-counts').textContent=`${counts.interactive} 项包含局部交互原型 · ${counts.visual} 项为视觉样例 · ${counts.specification} 项仅规范 · 0 项生产组件。每个状态的覆盖单独记录。`;}
