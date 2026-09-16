import fs from 'node:fs/promises';
import path from 'node:path';
export function cover(ctx){const {page,bytes,box,tx,C}=ctx;
 const s=page('商业定位概念样稿。画面不是客户记录，也不是上线界面。');
 if(bytes)s.images.add({blob:bytes,contentType:'image/png',alt:'Wringy 创作者概念场景，非真实客户',position:box(500,67,780,586),fit:'contain'});
 tx(s,'Wringy',48,100,464,142,105,true);
 tx(s,'品牌发起活动',52,307,460,70,43,true);
 tx(s,'创作者按合格效果\n获得奖励',52,381,464,124,37,true);
 tx(s,'wringy.com',54,631,310,40,22,false,C.secondary);tx(s,'生成概念图，非真实客户',700,643,540,35,23,false,C.secondary);
}
export function business(ctx){const {page,shape,tx,C,arrow}=ctx;
 const s=page('拟议业务关系，非托管或实际支付路径。合格结果以活动规则和核验为准。算例：RM10,000已确认创作者奖励，奖励之外加收假设15%平台服务费RM1,500，品牌支出RM11,500未计税。平台费不是从创作者奖励再扣除；奖励不计平台服务收入。');
 tx(s,'一笔活动预算，多位创作者',52,40,1160,85,54,true);
 tx(s,'品牌发起活动，Wringy 拟组织传播与效果核验',56,128,1160,42,25,false,C.secondary);
 const b=shape(s,'品牌活动预算',54,268,234,112,C.surface);tx(s,'品牌',72,279,196,46,34,true);tx(s,'活动预算与要求',72,331,196,35,22);
 const w=shape(s,'Wringy 活动组织与核验',357,254,257,140,C.citron);tx(s,'Wringy',377,272,220,57,43,true);tx(s,'组织活动 · 核验效果',377,339,222,37,21);
 arrow(s,b,w);
 const cs=[];for(let i=0;i<3;i++){const y=206+i*91;const q=shape(s,'创作者 '+(i+1),687,y,235,69,C.surface);tx(s,'创作者 '+String.fromCharCode(65+i),701,y+10,210,42,28,true);cs.push(q);arrow(s,w,q,'elbow');}
 tx(s,'制作并发布短视频',690,488,270,38,23,false,C.secondary);
 const r=shape(s,'合格结果奖励',1010,269,217,113,C.ink);tx(s,'合格结果',1028,278,184,44,30,true,C.canvas);tx(s,'计算奖励',1028,330,184,39,25,false,C.citron);
 for(const q of cs)arrow(s,q,r,'elbow');
 tx(s,'品牌总支出',55,551,270,36,22,false,C.secondary);tx(s,'创作者奖励',450,551,290,36,22,false,C.secondary);tx(s,'平台服务费',886,551,320,36,22,false,C.secondary);
 tx(s,'RM11,500',52,588,330,68,47,true);tx(s,'=',384,590,60,68,43);tx(s,'RM10,000',450,588,343,68,47,true);tx(s,'+',813,590,60,68,43);tx(s,'RM1,500',884,588,350,68,47,true);
 tx(s,'拟议模式。算例未计税，假设平台费为已确认奖励的15%，在奖励之外另计。',55,669,1170,31,18,false,C.secondary);
}
export async function product(ctx){const {page,tx,C,ROOT,box}=ctx;const draft=false;
 const s=page('三个产品时刻为概念说明，未上线。品牌设定预算与活动规则；创作者选择任务并发布；合格播放按规则核验后计算奖励。奖励确认不等于银行到账。主任务提供 product-triptych.png，50,000合格播放按RM5/千次核算为RM250，金额仅为示例。产品概念图内的文字是图片组成，页标题与概念说明保持原生可编辑。');
 tx(s,'从创建活动到查看奖励',52,24,1165,80,51,true);
 const product=path.join(ROOT,'assets/product-triptych.png');
 if(!draft)s.images.add({blob:new Uint8Array(await fs.readFile(product)),contentType:'image/png',alt:'品牌创建活动、创作者发现活动、合格播放与已核算奖励；概念界面，未上线',position:box(24,112,1232,548),fit:'contain',crop:{left:0,top:.08,right:0,bottom:.10}});
 tx(s,'概念界面，未上线；金额为示例。',52,677,1165,32,20,false,C.secondary);

}