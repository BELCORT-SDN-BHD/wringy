export const reviewSources={
 brands:'https://contentrewards.com/brands-terms',
 creators:'https://contentrewards.com/terms',
 pricing:'https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/pricing/creators',
 home:'https://contentrewards.com/',
 legacy:'https://whop.com/blog/set-up-content-rewards/',
 brief:'phase-0/research/review-mechanisms-v1/deck-brief.md'
};
export const reviewPages=[
 {key:'review-roles',title:'Content Rewards／Whop 的审核分工',foot:'当前条款更新于2026-09-03 · 品牌人工决定内容，不自动通过 · 2026-09-10核查',
 note:'CR指Content Rewards。当前组织条款§§3、6–8、18与创作者条款§§7–11、16（页面标注2026-09-03更新）为本页口径。品牌可以选择发布前审稿，草稿通过后公开帖子仍需最终审核。品牌人工批准或拒绝内容，拒绝须对应已公布的活动要求，不能临时加入私聊要求。自动风险标记暂停相关付款并交人工复核，不等于拒稿。CR客服不能代品牌批准。CR管理投稿、播放核验和应付记录；Whop处理充值、身份核验和提现。内容通过不等于银行到账。2025-05-14旧教程提到AI初检后48小时自动通过，新组织条款§6.1明确无自动通过。旧活动应核对实际接受的合同版本，不能只看域名判断。平台私有算法不可得，不暗示Wringy已实现。',sources:[reviewSources.brands,reviewSources.creators,reviewSources.legacy,reviewSources.brief]},
 {key:'review-timing',title:'当前按播放计酬与提现时间线',foot:'条款版本2026-09-03 · 7天＋3天可调整或暂停，非银行到账承诺',
 note:'CPM指每千次合格播放计酬。创作者定价页When do I get paid?、创作者条款§§7、10–11、组织条款§§5–6描述当前批准后7天计酬，再等待3天，允许调整与风险暂停。Whop提现另行处理，没有统一银行到账承诺。按公布内容要求、有效播放口径、窗口和奖励上限核算，异常播放交人工。公开私有算法权重不可得，首页FAQ独立观看验证限部分代理商beta，不是普遍开放能力。创作者可申诉风险标记，普通拒稿由品牌决定是否改判。成立异常可退回未结算奖励；已结算奖励不走同一逆转流程，但另有确认欺诈抵扣等合同救济，不表示永久不可追索。底部四类状态为Wringy拟议设计而非Whop现成界面。',sources:[reviewSources.pricing,reviewSources.creators,reviewSources.brands,reviewSources.home,reviewSources.brief]},
 {key:'review-design-appendix',title:'设计附录：Wringy 的审核记录',foot:'Wringy 设计提案，尚未冻结或实现 · 无固定审核时限承诺 · 非 CR 后台截图',
 note:'设计提案：内容、计量、奖励与付款状态分开。品牌按已公布规则批准草稿、要求修改、最终批准或拒绝，拒绝绑定当时已公布要求。创作者查看下一处理人、补交证据、申请风险复核或拒稿复议。管理员分别处理风险申诉、品牌决定复议协调及资金异常，记录依据、裁决与账务执行结果。每笔奖励记录原始/排除/计入播放、快照来源与时间、规则版本、帖子及账号归属、发布时间/提交/批准/计量截点、上限与可用预算、操作人与理由及证据权限。快照是本次核算采用的数据与采集时刻。异常候选包括发错账号、披露缺失、断连删帖、预算不足、重复提交、规则变更、待审退款、未结算逆转与已结算追索。没有采用旧48小时自动通过规则，也没有批准固定审核服务时限。',sources:[reviewSources.brief,'phase-0/foundation/review-design-v1.md']}
];
export async function fillReviewRoles({s,tx,line,ico,C}){
 const xs=[64,474,884];
 for(let i=0;i<3;i++)await ico(s,['inbox','adjustments-horizontal','external-link'][i],xs[i]+5,177,34);
 ['品牌','Content Rewards','Whop 资金通道'].forEach((v,i)=>tx(s,v,xs[i],237,330,54,34,true));
 tx(s,'判断内容是否合格',64,316,330,45,27,true);
 tx(s,'可选发布前审稿\n公开帖子再做最终审核\n拒稿须对应已公布要求',64,387,350,148,26);
 tx(s,'核验播放，处理风险',474,316,355,45,27,true);
 tx(s,'自动标记送人工复核\n风险标记不等于拒稿\n客服不代品牌批准内容',474,387,355,148,26);
 tx(s,'处理资金与提现',884,316,332,45,27,true);
 tx(s,'充值与身份核验\n处理提现流程\n银行到账须另有记录',884,387,332,148,26);
 line(s,64,567,1152);
 tx(s,'内容通过、奖励确认与银行到账，分别记录。',64,599,1152,46,29,true);
}
export async function fillReviewTiming({s,tx,line,ico,C}){
 const xs=[64,466,868];
 ['批准后计酬','等待期','Whop 提现'].forEach((v,i)=>tx(s,v,xs[i],205,348,48,30,true));
 tx(s,'7天',64,277,348,99,68,true);tx(s,'3天',466,277,348,99,68,true);tx(s,'另行处理',868,290,348,79,43,true);
 line(s,365,318,73);tx(s,'›',395,280,50,66,49,true);line(s,766,318,73);tx(s,'›',797,280,50,66,49,true);
 tx(s,'按活动规则核算合格播放',64,395,348,74,25);tx(s,'可调整或因风险暂停',466,395,348,74,25);tx(s,'还受身份与资金审核影响',868,395,348,74,25);
 line(s,64,493,1152);
 tx(s,'播放量还须匹配规则、受众、窗口与上限。',64,521,1152,45,28,true);
 tx(s,'Wringy 提案：内容状态、计量状态、奖励状态、付款状态分开显示。',64,598,1152,47,25);
}
export async function fillReviewAppendix({s,tx,line,ico,C}){
 const xs=[64,355,646,937];
 ['内容状态','计量状态','奖励状态','付款状态'].forEach((v,i)=>tx(s,v,xs[i],204,276,51,31,true));
 ['草稿／公开帖与版本','原始／排除／计入播放','规则、上限与可用预算','应付／实际到账记录'].forEach((v,i)=>tx(s,v,xs[i],273,276,76,23));
 line(s,64,371,1152);
 tx(s,'每次核算可追溯',64,408,544,45,30,true);
 tx(s,'适用规则版本与帖子归属\n播放快照来源及采集时间\n风险证据、操作人与理由',64,477,544,141,27);
 tx(s,'每次处理有明确责任人',705,408,511,45,30,true);
 tx(s,'品牌：按公布要求判断内容\n创作者：查看进度、补交证据\n管理员：风险复核与资金异常',705,477,511,141,26);
 tx(s,'全部投稿、拒稿与申诉的实际工时，回流财务成本。',64,620,1152,34,23);
}
