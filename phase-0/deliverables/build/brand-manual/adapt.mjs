import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const source=JSON.parse(await fs.readFile(path.join(root,'brand/brand-book-content.json'),'utf8'));
const inventory=JSON.parse(await fs.readFile(path.join(root,'brand/component-inventory.json'),'utf8'));
const titles=['Wringy\n品牌与设计系统','年轻的表达，清楚的合作','品牌方向与验证边界','品牌与创作者的共同约定','定位提案','合作原则','品牌个性','中英马三语表达','具体而尊重的文案','标志概念 v1','标志的比例与识别','主色与阅读底色','次级强调与状态色','浅色与深色主题','字体与信息层级','响应式版式','创作情境与影像','动作与反馈节奏','31 类组件家族','可理解的反馈','品牌桌面：活动简报','品牌手机：活动摘要','创作者桌面：报酬详情','创作者手机：审核回执','未来支付流程的金额表达','审核、报酬与提现状态','图表的信息规则','可访问与隐私','品牌资产的共同源头','日常品牌使用原则'];
const bodies={
1:['品牌手册 v1','马来西亚品牌与创作者合作平台'],
2:['作品可以大胆，合作要求需要清楚。','信任来自能理解的条款、具体的审核意见和可追踪的记录。'],
5:['面向马来西亚品牌与创作者，把活动要求、作品提交、审核与报酬状态放进一段清楚的合作过程。','品牌承诺：把要求、下一步和报酬条件写清楚。'],
6:['创作有空间：必须遵守的要求与自由发挥分开写。','合作有依据：每条修改意见对应具体要求。','报酬有来由：批准、可提现和到账分别表达。'],
7:['邀请时开放，作品展示可以大胆。','审核意见具体，钱款信息保持克制。'],
10:['双段 W 接点与定制字标。','概念图；尚非矢量生产母版。'],
17:['表现拍摄、讨论简报和制作作品的过程。','采用自然光与真实材质，呈现多元创作者。','示例影像由 AI 生成，人物与场景均为虚构。'],
21:['活动预算与单条报酬分别展示。','简报要求、创作空间与付款约定清楚分组。'],
22:['先看待审核作品，再处理单份提交。','固定报酬与品牌直接付款说明持续可见。'],
23:['审核依据与报酬状态并列。','已批准，仍等待品牌付款。'],
24:['审核已批准，报酬 MYR 150.00。','品牌直接付款，到账状态单独确认。','回执与付款约定持续可查。'],
25:[],
28:['键盘能完成任务，焦点始终可见。','文字放大后，金额与条件仍完整可读。','敏感号码默认遮盖。权限与申诉入口明确。'],
30:['保持字形与比例，给标志足够留白。','用主色强调重点，让正文保持高对比。','让反馈说明当前状态，并给出下一步。','把概念、示例与真实证据明确区分。']};
const notes={
1:'Wringy 品牌与设计系统 v1。身份与定位为提案，面向马来西亚品牌与创作者合作场景。',
3:'品牌名称、首发市场和创意可信的方向来自创始人输入。客户需求、付费意愿和政策仍属待验证假设。设计提案不能作为客户验证或产品上线证据。',
10:'原始 logo 概念由内置 imagegen 生成，1254×1254 PNG。保持完整比例。透明衍生版本仅供审阅，未用于本页。此处不作矢量、生产母版或商标核验声明。',
14:'对比要求来自 tokens.json 与设计规格。文字目标 4.5:1，关键非文字元素目标 3:1。色值组合的计算不能替代真实界面与辅助技术检查。',
15:'Manrope 与 Noto Sans SC 使用 SIL OFL 1.1 许可。中文、英文与马来文保留各自自然语序。幻灯片尺寸按演示用途调整，界面字级遵循 tokens.json。',
19:'完整 31 类家族的变体、状态、键盘行为、响应式和内容规则在 component-inventory.json。这里展示家族目录。静态设计样本与文档不代表已实现可运行的生产组件。',
21:'活动与数值均为设计示例，不代表真实客户或已上线功能。活动简报应说明作品要求、使用权、期限和审核条件。',
22:'活动与预算均为虚构设计示例。预算总额与单件作品报酬需要区别表达。',
23:'未来报酬界面的设计示例，不代表 首版钱包或已实现的支付产品。已批准与已到账是不同状态。',
24:'未来报酬界面的设计示例，不代表 首版钱包。审核回执与资金状态分开。未知条件不能用虚构日期补齐。',
25:'独立的未来支付界面说明，非 首版钱包，也不是前页报酬已经释放的延续。假设扣减 MYR 150.00，示例费用 MYR 2.00，预计到账 MYR 148.00。150.00−2.00=148.00。数字不是实际费率，不表示平台已具备支付功能。',
26:'未来支付状态设计原则。提交审核、报酬释放、提现处理属于不同对象。未知结果先核对，避免重复发起。实际转换规则以设计规格和后续账本事实为准。',
27:'本页给出图表的表达规范，不展示虚构经营趋势。缺数据应显示暂无数据，不应写零。无归因证据时不把播放量标为销售额。',
29:'视觉值在 brand/tokens.json 维护。组件、演示和品牌手册引用同一源头。品牌方向由 brand-strategy.md 定义，组件规则由 component-inventory.json 与设计规格定义。',
30:'使用品牌时先判断读者需要理解的内容。保持标志完整与文字可读，状态文案说明下一步。AI 概念图标注来源，真实客户证据需要授权和可追溯依据。'};
const names={'brand-strategy.md':'品牌策略','design-system-spec.md':'设计规范','tokens.json':'视觉参数','component-inventory.json':'组件目录'};
const slides=source.slides.map((s,i)=>({id:s.id,section:i<9?'品牌':i<18?'视觉语言':'设计系统',title:titles[i],layout:i===0?'cover':i===29?'closing':'statement',body:bodies[i+1]??s.body,visual_brief:s.visual_brief,speaker_notes_zh:notes[i+1]??s.speaker_notes.replace(/调用 UI-[A-Z-]+。/g,''),sources:s.sources.map(v=>({title:names[v]??(v.includes('WCAG')?'WCAG 2.2':v.includes('ARIA')?'ARIA 指南':v.includes('manrope')?'Manrope 许可':v.includes('notosans')?'中文字体许可':'品牌来源'),url:v.startsWith('http')?v:path.resolve(root,'brand',v)})),feature_ids:[],asset_slot:s.asset_slot}));
slides[20].title='品牌桌面：活动与简报';
slides[21].title='品牌手机：待审核作品';
slides[22].title='创作者桌面：报酬与付款记录';
slides[23].title='创作者手机：审核与付款回执';
slides[22].speaker_notes_zh='本地设计示例。页面展示审核已批准、等待品牌付款及尚未确认到账日期。品牌直接付款，审核批准不能代表银行已到账。';
slides[23].speaker_notes_zh='本地设计示例，首版采用品牌直接付款。本页的 MYR 150.00 是审核批准报酬，不代表银行已到账。付款记录与审核结果分别显示。不把未来支付流程与本页首版付款约定混淆。';
slides[18].sources.push({title:'本地组件参考',url:path.resolve(root,'brand/showcase/index.html')});
for(const n of [3,4,8,9,11,25]){const s=slides[n-1],t=source.slides[n-1].table;s.layout='table';s.body=[];s.table={headers:t.columns,rows:t.rows,columnWidths:n===8?[210,926]:n===25?[650,486]:[568,568]};}
slides[2].table.rows=[['品牌方向','马来西亚，品牌与创作者，年轻而可信'],['客户需求','首批用户与付费意愿仍待验证'],['功能范围','设计提案，不能视为生产功能承诺'],['品牌与政策','名称权属、商标及支付政策需另行核验']];
slides[24].takeaway='独立的未来界面示例，非首版钱包或实际费率';
slides[10].takeaway='建议保护区为 W 高度的一半，字标至少 96px，符号至少 24px';
slides[2].sources=[{title:'创始人输入',url:path.resolve(root,'../founder-inputs.md')},{title:'品牌策略',url:path.resolve(root,'brand/brand-strategy.md')}];
slides[19].layout='table';slides[19].body=[];slides[19].table={headers:['情境','用户看到的信息'],rows:[['没有作品','暂无作品，可以查看活动要求'],['上传中','说明进度，允许取消或重试'],['提交失败','保留已填内容，解释原因与下一步'],['账户受限','说明限制范围，提供申诉入口']],columnWidths:[280,856]};
slides[26].layout='table';slides[26].body=[];slides[26].table={headers:['图表要素','表达规则'],rows:[['金额与时间','写明币种、统计范围和时区'],['数据来源','标明来源与计算口径'],['缺失值','显示暂无数据，和 0 区分'],['编码与基线','颜色配合标签，柱图从零开始']],columnWidths:[280,856]};
slides[7].speaker_notes_zh+=' 三语文案均为提案，金额是示例。';
slides[29].visual_brief='四条可执行品牌使用原则，保留充足留白。';
const out={title:'Wringy品牌与设计系统',language:'zh-CN',explicitTotalSlideCount:30,component_families:inventory.components.map(c=>({id:c.id,name_zh:c.name_zh})),slides};
await fs.writeFile(path.join(root,'content/brand-manual.json'),JSON.stringify(out,null,2));
