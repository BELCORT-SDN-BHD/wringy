const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const out = path.resolve(__dirname, '../../output');
const checks = [], errors = [];
const { createHash } = require('node:crypto');
const ts = require('typescript');
const catalogModule = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/product-copy.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(catalogModule.exports);
const catalog = catalogModule.exports.productCopy;
const locales = [
 { id: 'en-MY', name: 'English', payment: 'This does not mean payment was made.', unknown: 'Unknown does not mean zero.', image: 'en' },
 { id: 'ms-MY', name: 'Bahasa Melayu', payment: 'Ini tidak bermakna bayaran telah dibuat.', unknown: 'Data yang belum diketahui bukan bermaksud sifar.', image: 'ms' },
 { id: 'zh-Hans-MY', name: '简体中文', payment: '这不代表款项已支付。', unknown: '未知不等于零。', image: 'zh' },
];
const assert = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
 const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_BROWSER === 'chromium' ? {} : { channel: 'chrome' }), headless: true });
 try {
 const keys = obj => Object.keys(obj).sort().join(',');
 assert(keys(catalog)===locales.map(l=>l.id).sort().join(','),'Exactly three locale catalogs expected');
 for(const {id} of locales) {
  assert(keys(catalog[id])===keys(catalog['en-MY']),'Catalog key parity: '+id);
  assert(catalog[id].rows.length===6,'Six rows required: '+id);
  catalog[id].rows.forEach((row,i)=>assert(keys(row)===keys(catalog['en-MY'].rows[i])&&Object.values(row).every(v=>typeof v==='string'&&v.length>0),'Row key/content parity: '+id));
 }
 checks.push({name:'Three catalogs: exact key parity and six non-empty matching rows',passed:true});
 const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
 page.on('pageerror', e => errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8878');
 await page.getByRole('tab', { name: '源码与配色', exact: true }).click();
 await page.locator('#color-allocation').waitFor();
 const result = await page.evaluate(() => {
  const rgb = s => s.match(/[\d.]+/g).map(Number);
  const lum = a => a.slice(0,3).map(v => {v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const contrast = (a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  function bg(el) { for(let p=el;p;p=p.parentElement){const c=rgb(getComputedStyle(p).backgroundColor);if(c.length===3||c[3]===1)return c;}return [255,255,255]; }
  return [...document.querySelectorAll('#color-allocation [data-color-role], #color-allocation [data-color-icon]')].map(el => {
   const color=rgb(getComputedStyle(el).color), background=bg(el), icon=el.querySelector('svg');
   const description=el.querySelector('[data-slot="alert-description"]');
   return {role:el.dataset.colorRole||el.dataset.colorIcon,element:el.dataset.slot,color,background,textContrast:contrast(color,background),iconContrast:icon?contrast(rgb(getComputedStyle(icon).color),background):null,descriptionContrast:description?contrast(rgb(getComputedStyle(description).color),background):null};
  });
 });
 assert(result.length===14,'14 role elements expected');
 assert(result.every(r=>r.textContrast>=4.5&&r.iconContrast>=3&&(r.descriptionContrast===null||r.descriptionContrast>=4.5)),'Actual role contrast failed');
 checks.push({name:'Actual semantic text >=4.5 and icons >=3 on rendered backgrounds',passed:true,evidence:result});
 const labels = await page.locator('#color-allocation').innerText();
 assert(labels.includes('This does not mean payment was made.')&&labels.includes('Unknown does not mean zero.')&&labels.includes('No action is needed.'),'Business boundaries missing');
 assert(await page.locator('#color-allocation [data-color-role="attention"]').count()===2,'Attention leaked into background pending');
 assert(await page.locator('#color-allocation [data-color-role="brand"]').count()===1,'Brand role allocation');
 checks.push({name:'Explicit demo labels; action attention distinct from pending, approval and unknown',passed:true});
 const palette = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../provenance/palette.json'))).colors;
 const computed = await page.evaluate(colors=>{
  const probe=document.createElement('span');document.body.append(probe);
  const entries=Object.entries(colors).map(([key,expected])=>{
   probe.style.color=`var(--${key})`;const actual=getComputedStyle(probe).color;
   probe.style.color=expected;return [key,{actual,expected:getComputedStyle(probe).color}];
  });probe.remove();return Object.fromEntries(entries);
 },palette);
 assert(Object.keys(computed).length===43&&Object.values(computed).every(({actual,expected})=>actual===expected),'43 computed colors do not match mirror');
 const active = page.locator('[data-component="button"]');
 await active.hover();
 await page.waitForTimeout(250);
 const activeBg=await active.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert(activeBg==='rgb(233, 234, 236)','Sidebar hover/selection not neutral: '+activeBg);
 checks.push({name:'43 computed variables equal palette; sidebar hover/selection neutral',passed:true,evidence:{activeBg}});
 await page.mouse.move(1000,0);
 await page.screenshot({path:path.join(out,'localized-source-desktop.png')});
 await page.setViewportSize({width:320,height:844});
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert(dims.scroll<=dims.viewport,'Source tab page overflows at 320px: '+JSON.stringify(dims));
 await page.screenshot({path:path.join(out,'localized-source-320-en.png'),fullPage:true});
 checks.push({name:'Source tab at 320px, no page overflow; tables/code scroll internally',passed:true,evidence:dims});
 const roleColors=()=>page.locator('#color-allocation [data-color-role]').evaluateAll(nodes=>nodes.map(el=>({role:el.dataset.colorRole,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor})));
 const englishRoles=await roleColors();
 for(const locale of locales) {
  await page.locator('#product-language').click();
  assert(await page.getByRole('option').count()===3,'Exactly three named choices');
  await page.getByRole('option',{name:locale.name,exact:true}).click();
  await page.getByText(catalog[locale.id].alertTitle,{exact:true}).waitFor();
  const text=await page.locator('#color-allocation').innerText();
  assert(text.includes(locale.payment)&&text.includes(locale.unknown),'Business boundaries: '+locale.id);
  assert(JSON.stringify(await roleColors())===JSON.stringify(englishRoles),'Roles changed: '+locale.id);
  for(const selector of ['[data-slot="alert"]','[data-slot="item-group"]','[data-slot="table"]']) assert(await page.locator('#color-allocation '+selector).getAttribute('lang')===locale.id,'Localized lang: '+locale.id);
  assert(await page.locator('#color-allocation').getAttribute('lang')===null,'Chinese instructions incorrectly relabelled');
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert(dims.scroll<=320,'Source page overflow: '+locale.id);
  await page.screenshot({path:path.join(out,`localized-source-320-${locale.image}.png`),fullPage:true});
  if(locale.image==='zh') await page.locator('#color-allocation').screenshot({path:path.join(out,'localized-chinese-sample.png')});
  checks.push({name:locale.id+': business boundaries, scoped lang, unchanged colors, 320px no overflow',passed:true,evidence:dims});
 }
 await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(out,'Wringy-Design-System.html')).href);
 await page.getByRole('tab',{name:'源码与配色',exact:true}).click();
 assert(await page.locator('#color-allocation').isVisible(),'Export missing color sample');
 assert(await page.locator('#color-allocation [data-color-role="brand"]').count()===1,'Offline brand sample missing');
 for(const locale of locales) {
  await page.locator('#product-language').click();
  await page.getByRole('option',{name:locale.name,exact:true}).click();
  await page.getByText(catalog[locale.id].alertTitle,{exact:true}).waitFor();
  const text=await page.locator('#color-allocation').innerText();
  assert(text.includes(locale.payment)&&text.includes(locale.unknown),'Offline boundaries: '+locale.id);
  assert(JSON.stringify(await roleColors())===JSON.stringify(englishRoles),'Offline colors: '+locale.id);
 }
 assert(!errors.length,errors.join('\n'));
 checks.push({name:'Standalone source tab and allocation work offline without uncaught errors',passed:true});
 } catch(e) { checks.push({name:'Color allocation verification',passed:false,error:e.message}); }
 finally { await browser.close(); }
 const html=fs.readFileSync(path.join(out,'Wringy-Design-System.html'));
 const report={artifact:{file:'Wringy-Design-System.html',bytes:html.length,sha256:createHash('sha256').update(html).digest('hex'),equalsBuiltHtml:html.equals(fs.readFileSync(path.resolve(__dirname,'../dist/index.html')))},priorFullSuite:{report:'browser-verification.json',summary:'finalverification.json',status:'Prior 22/22 report preserved; not rerun for this locale-only extension'},checkedAt:new Date().toISOString(),result:checks.every(c=>c.passed)?'passed':'failed',checks,uncaughtErrors:errors,limitations:['Chrome only; no full props, screen-reader or dark-theme certification','Contrast checks cover the displayed semantic roles; untouched upstream low-opacity destructive focus styling is not certified']};
 fs.writeFileSync(path.join(out,'localized-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));process.exitCode=report.result==='passed'?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
