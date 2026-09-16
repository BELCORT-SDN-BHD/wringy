#!/usr/bin/env python3
"""Wringy planning model. Standard library only. --init creates editable inputs once.
Run: python3 model-source.py --init ; thereafter python3 model-source.py
All money MYR. No actual traction, quote, legal opinion or TAM implied.
"""
import json, math, hashlib, sys
from pathlib import Path
P = Path(__file__).resolve().parent
SOURCES = [
('salary2026','Randstad 2026技术岗位薪资','https://www.randstad.com.my/most-in-demand-jobs-malaysia-emerging-technology/','软件工程师基本月薪RM7,000–14,000；招聘机构第一方研究，非报价。'),
('salary2025','Randstad 2025薪资指南','https://www.randstad.com.my/s3fs-media/my/public/2024-12/randstad-malaysia-2025-job-market-outlook-and-salary-guide.pdf','工程师3,500/10,000/17,000；设计4,000/13,000/25,000；技术主管10,000/17,000/25,000，基本月薪。'),
('dosm','DOSM 2024工资调查，2025-09-29发布','https://www.dosm.gov.my/portal-main/release-content/salaries-and-wages-survey-report-2024','公民中位月薪2,793，平均3,652；吉隆坡平均4,782。全国基准不是技术招聘报价。'),
('epf','KWSP雇主缴费','https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution','本地60岁以下员工：5,000及以下雇主13%，以上12%；实际必须按工资档表，不能直接套百分比。'),
('socso','PERKESO缴费','https://www.perkeso.gov.my/en/uncategorised/778-contributions.html','第一类雇主SOCSO约1.75%，EIS雇主0.2%；实际按法定表。'),
('socso_ceiling','PERKESO工资上限公告','https://perkeso.gov.my/images/kenyataan_media/2024/011024%20-%20SIARAN%20MEDIA%20KUATKUASA%20PENINGKATAN%20SILING%20GAJI%20RM5000%20KEPADA%20RM6000%20FINAL.pdf','2024-10-01上限提高至RM6,000。'),
('hrd','HRD Corp雇主FAQ','https://hrdcorp.gov.my/faq','适用行业10名或以上本地员工强制1%；5–9名可选择0.5%；本模型未选择自愿注册。'),
('stripe','Stripe马来西亚标准价','https://stripe.com/en-my/pricing','本地卡/FPX 3%+RM1；国际卡另1%，换汇另2%；争议收到90、手动应对90。退款不退原处理费。'),
('connect','Stripe Connect马来西亚公开价','https://stripe.com/en-my/connect/pricing','自行定价方案：活跃账户6/月；出款0.25%+1.50，资金路由另列0.25%；压力测试都计入，合同待确认。'),
('connect_my','Stripe马来西亚Connect适用说明','https://support.stripe.com/questions/connect-availability-for-businesses-located-in-malaysia?locale=en-GB','搜索索引支持Stripe收费并承担损失责任的模式可用；页面直取失败。不据此保证多收款人分账获准。'),
('supabase','Supabase定价','https://supabase.com/pricing','Pro 25美元/月包含首个微型项目，第二项目10美元/月；含每日备份7天。'),
('workers','Cloudflare Workers定价','https://developers.cloudflare.com/workers/platform/pricing/','付费最低5美元/月；额度外另计。'),
('r2','Cloudflare R2定价','https://developers.cloudflare.com/r2/pricing/','标准储存0.015美元/GB月；免费10GB；A类4.50美元/百万，B类0.36美元/百万；互联网出口不收费。'),
('email','Resend定价','https://resend.com/pricing?volume=50000','事务邮件Pro 20美元/月含50,000封；超额0.90美元/千封。'),
('fx','BNM金融市场参考汇率','https://financialmarkets.bnm.gov.my/','2026-09-09 KL USD/MYR参考4.0688；模型按4.20预算，非交易报价。'),
('bnm','BNM审批及注册申请','https://www.bnm.gov.my/application-for-approval-and-registration','支付系统、指定支付工具及商户收单分别涉及审批/注册；具体角色需要本地专业确认。'),
('bnm_directory','BNM受监管机构名单','https://www.bnm.gov.my/list-of-regulatees','签约前核对实际收款/出款主体、许可类别；不能只核对品牌名。'),
('bnm_policy','BNM支付政策文件目录','https://www.bnm.gov.my/payment-systems','列出2025-01-31电子货币、2021-09-15商户收单及2024-04-15电子身份核验政策。'),
('pdpa','JPDP个人资料保护FAQ','https://www.pdp.gov.my/ppdpv1/en/faq/','DPO触发：超过20,000人资料，超过10,000人敏感/财务资料，或规律系统监测；2025-06-01生效。'),
('pdpa_transfer','JPDP跨境资料传输指引','https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN.pdf','跨境传输须满足Act 709第129条条件；使用海外云服务不是自动豁免。'),
('pdpa_breach','JPDP资料泄露通报指引','https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_DBN_ENG.pdf','官方指引已找到；直取文件超限，具体时限未作为本模型法律结论。')]
FORMULAS = {'clients': 'Explicit hypothetical monthly active paying-brand trajectory. churned=prior_clients*churn_rate; new=clients-prior_clients+churned. Fractional expected cohorts allowed.', 'campaigns': 'active_clients * campaigns_per_client; expected volume, not historical counts', 'gmv': 'campaigns * creator_budget_per_campaign (creator funds only, excludes platform fee)', 'net_gmv': 'gmv * (1-refund_rate)', 'gross_fee': 'gmv * proposed_fee_rate', 'revenue': 'gross_fee * (1-refund_rate); only Wringy fee, excludes creator funds and sales tax', 'collections': 'revenue*(1-collection_lag_fraction) + prior_revenue*collection_lag_fraction', 'accounts_receivable': 'revenue*collection_lag_fraction', 'reserve_balance': 'sum(last reserve_hold_months fee collections)*reserve_fraction; own fees only', 'payment_cogs_direct': 'actual gross service-fee cash collected (80% current +20% previous gross fee) * processor_rate + actual paid transaction count * processor_fixed; Wringy bears; routine refund cash deducted separately, original processing fees retained', 'payment_cogs_integrated_stress': 'actual gross creator-budget cash collected + actual gross service-fee cash collected, times processor_rate; plus actual paid transaction count * fixed; plus net_gmv*(payout_rate+routing_rate)+campaigns*creators_per_campaign*(active_account_fee+payout_fixed); all borne by Wringy in stress only', 'dispute_cogs': 'actual_charge_volume*unrecovered_loss_rate + actual paid transaction count*dispute_incidence*(received_dispute_fee+counter_dispute_fee); distinct from routine refunds', 'fulfilment_cogs': 'campaigns*variable_cost_per_campaign + max(0,campaigns-ops_staff*campaign_capacity_per_ops)*overflow_cost_per_campaign', 'cloud_cogs': '(25+10+5+20 + max(0,stored_GB-10)*.015 + email_overage + build_compute_allowance_USD)*budget_fx + campaigns*request_allowance_MYR', 'payroll': 'sum(salary + approximate EPF + min(salary,6000)*(.0175+.002) + schedule_rounding_buffer + salary*benefits_fraction) + HRD if eligible', 'contribution_profit': 'revenue - COGS; COGS includes payment, disputes, variable fulfilment and cloud; fixed delivery staff stays in payroll', 'opex': 'contractors + workspace + admin + tools + acquisition + country_research; excludes payroll, COGS, setup', 'burn': 'COGS+payroll+opex+setup_cash - collections + change_in_reserve; positive=net cash consumption, negative=cash generation', 'cash': 'prior_cash - burn; month1 begins with hypothetical opening financing + declared existing capital', 'funding': 'max(0,peak cumulative burn through H) + 3*fixed monthly cost at H + contingency_rate*(payroll+opex+setup through H) - existing capital; round up to RM10,000; contingency NOT in monthly burn', 'annual': 'Y1=sum(month1:12), Y2=sum(month13:24), Y3=sum(month25:36) illustration; no exit-multiple or TAM', 'year3_clients': 'month24_clients * (1+year3_monthly_client_growth) ** (month-24)', 'budget_cap_stress': 'annual eligible budget = market annual spend * eligible share; average campaigns/client/month = annual eligible budget /12 /campaign budget = 30000/12/8000 =0.3125. Same retained client pool and base team; all campaign-driven costs recomputed; fixed payroll/opex unchanged.', 'combined_execution_stress': 'budget_cap_stress client trajectory/cadence/team; fee=10%; acquisition=max(existing budget,new_clients*RM2000) replaces one opex bucket; creator recruitment/support=campaigns*10 paid participation slots*RM20 added to fulfilment COGS; overflow=RM200 per excess campaign; no joint tax, launch-delay, or financing-tranche stress'}

def initial():
 return dict(version='1.0',as_of='2026-09-10',currency='MYR',status='研究粗估；全部客户、团队、费率、融资与未来支出为假设；非投资/税务/法律意见',
  canonical_brief='../brief.md',horizon_months=24,illustration_months=36,launch_month=4,
  existing_capital_myr=0,existing_capital_status='未知；零仅用于计算需筹资金，不表示创始人没有资金',illustrative_opening_financing_myr=1500000,
  fee_rate=.15,fee_sensitivity=[.10,.15],refund_rate=.02,collection_lag_fraction=.20,reserve_fraction=.05,reserve_hold_months=2,
  payment_mode='brand_direct',payment_assumption='品牌通过持牌银行/支付服务商直接付创作者并承担该通道费用；Wringy仅收服务费。集成代收另作压力测试，不假设获准。',
  processor_rate=.03,processor_fixed=1,unrecovered_loss_rate=.003,dispute_incidence=.002,received_dispute_fee=90,counter_dispute_fee=90,
  payout_rate=.0025,routing_rate=.0025,payout_fixed=1.5,active_account_fee=6,creators_per_campaign=10,
  variable_cost_per_campaign=40,campaign_capacity_per_ops=50,overflow_cost_per_campaign=90,
  fx=dict(reference_usd_myr=4.0688,reference_date='2026-09-09',budget_usd_myr=4.20,source='fx'),
  cloud=dict(supabase_pro_usd=25,second_project_usd=10,workers_usd=5,email_pro_usd=20,email_included=50000,email_overage_per_1000_usd=.9,emails_per_campaign=200,gb_per_campaign=1,retention_months=12,r2_free_gb=10,r2_gb_usd=.015,request_allowance_myr_per_campaign=1),
  payroll_assumptions=dict(local_citizens_under_60=True,epf_low=.13,epf_high=.12,epf_boundary=5000,socso=.0175,eis=.002,ceiling=6000,schedule_rounding_buffer_per_employee=10,benefits_fraction=.03,annual_salary_increase=.05,hrd_threshold=10,hrd_rate=.01,voluntary_hrd=False),
  budget_cap_stress={'label': '每品牌年预算RM30,000上限压力测试', 'source': 'sea-market.md §5：中间假设；不是已验证市场事实', 'market_annual_spend_myr': 120000, 'eligible_share': 0.25, 'annual_eligible_budget_myr': 30000, 'campaigns_per_client': 0.3125, 'creator_budget_per_campaign': 8000, 'adoption': 'base', 'build': 'base', 'client_definition': '沿用原客户数轨迹，解释为留存可采购品牌池；不是每月每家都有付费活动。0.3125为跨品牌及跨月份平均频率。', 'status': '新增压力情景，原9组不覆盖；100%可适配预算迁入仍是偏乐观上限，未验证。'},
  change_register=[{'date': '2026-09-10', 'authorization': '本轮用户明确授权：保留原中采用情景，新增预算上限压力测试，并刷新密封审查包。', 'issue': '市场中间假设每品牌年度可适配预算120000×25%=30000；原经营中采用1.5×8000×12=144000，是4.8倍；原低采用1×5000×12=60000，是该中间预算的2倍。不同客群解释尚无证据。', 'decision': '原9组保留为历史规划情景；新增same-clients/base-team budget_cap_stress，将平均活动频率改为0.3125；所有活动驱动成本同步。投资稿不得把原中采用与市场中间假设视为同一客群而直接拼接。'}],
  combined_execution_stress={'label': '联合执行压力测试', 'parent': 'budget_cap_stress', 'fee_rate': 0.1, 'brand_acquisition_myr_per_new_client': 2000, 'acquisition_rule': 'max(existing monthly brand acquisition budget, expected new_clients * 2000); replaces bucket, not additive', 'creator_cost_myr_per_paid_participation': 20, 'paid_participation_slots_per_campaign': 10, 'overflow_cost_myr_per_campaign': 200, 'status': '全部为规划成本假设，不是招聘/获客研究基准或实测报价。付费参与次数不等于独立创作者人数；原模型未单列创作者获客费用不等于已证实零成本。', 'excluded_joint_stresses': ['所得税', '上线延迟', '融资分期到账'], 'client_definition': '沿用原客户数轨迹，解释为留存可采购品牌池；不是每月每家都有付费活动。0.3125为跨品牌及跨月份平均频率。'},
  gmv_display_label='记录的活动预算，非平台收款',
  funding=dict(contingency_rate=.15,buffer_months=3,round_to_myr=10000),
  adoption={
   'low':dict(label='低采用',clients=[0,0,0,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,22,24,25],campaigns_per_client=1,creator_budget_per_campaign=5000,churn_rate=.08,year3_monthly_client_growth=.01),
   'base':dict(label='中采用',clients=[0,0,0,3,5,7,9,11,14,17,20,24,28,32,36,40,45,50,55,60,65,70,75,80],campaigns_per_client=1.5,creator_budget_per_campaign=8000,churn_rate=.05,year3_monthly_client_growth=.035),
   'high':dict(label='高采用',clients=[0,0,0,5,8,12,17,23,30,38,47,57,68,80,94,109,125,141,155,167,177,186,193,200],campaigns_per_client=2,creator_budget_per_campaign=10000,churn_rate=.03,year3_monthly_client_growth=.04)},
  build={
   'lean':dict(label='精简团队',roles=[['创始人/产品销售',4000],['全栈工程师',9000],['创作者运营',4000]],ops_staff=1,contractors_first3=3000,contractors_ongoing=1500,workspace=600,admin=1200,tools_per_person=200,acquisition_prelaunch=500,acquisition_live=2000,acquisition_y2=3500,setup={'devices':15000,'legal_provider_privacy':12000,'security_review':8000},compute_allowance_usd=30),
   'base':dict(label='标准团队',roles=[['创始人/产品',6000],['技术主管',12000],['全栈工程师',9000],['设计师',6000],['创作者运营',5000],['品牌销售',6000]],ops_staff=1,contractors_first3=3000,contractors_ongoing=1500,workspace=1800,admin=2500,tools_per_person=250,acquisition_prelaunch=1000,acquisition_live=5000,acquisition_y2=8000,setup={'devices':30000,'legal_provider_privacy':25000,'security_review':20000},compute_allowance_usd=100),
   'staffed':dict(label='完整团队',roles=[['创始人/产品',8000],['技术主管',15000],['工程师A',10000],['工程师B',10000],['设计师',8000],['运营A',5000],['运营B',5000],['品牌销售',8000],['测试工程师',6000],['客户成功',5000]],ops_staff=3,contractors_first3=2000,contractors_ongoing=1000,workspace=3500,admin=4000,tools_per_person=300,acquisition_prelaunch=1500,acquisition_live=9000,acquisition_y2=14000,setup={'devices':50000,'legal_provider_privacy':45000,'security_review':35000},compute_allowance_usd=200)},
  year3=dict(non_payroll_opex_growth=.15,sea_discovery_monthly_myr=5000,scope='仅市场探索差旅/专业咨询预算；不含第二国正式上线。'),
  exclusions=['品牌直接支付的创作者款项及其支付通道费用','创始人未披露的既有债务、资本及团队','股权期权估值、融资交易费用、所得税及折旧；亏损情景不据此推定税务结果','销售税按另加另缴处理，若价格须含税需下调净收入；非税务适用结论','自建银行、银行卡、储值钱包、托管、信贷、资金管理及正式第二国上线'],
  sources=[dict(id=i,title=t,url=u,evidence=e,accessed='2026-09-10') for i,t,u,e in SOURCES],formulas=FORMULAS)

def payroll(I,B,m):
 a=I['payroll_assumptions']; inc=(1+a['annual_salary_increase'])**((m-1)//12)
 gross=epf=socso=eis=benefits=0
 for _,sal in B['roles']:
  s=sal*inc; gross+=s; epf+=s*(a['epf_low'] if s<=a['epf_boundary'] else a['epf_high']); socso+=min(s,a['ceiling'])*a['socso']; eis+=min(s,a['ceiling'])*a['eis']; benefits+=s*a['benefits_fraction']
 n=len(B['roles']); hrd=gross*a['hrd_rate'] if n>=a['hrd_threshold'] else 0
 return dict(gross=gross,epf_estimate=epf,socso_estimate=socso,eis_estimate=eis,benefits=benefits,hrd=hrd,schedule_rounding_buffer=n*a['schedule_rounding_buffer_per_employee'],total=gross+epf+socso+eis+benefits+hrd+n*a['schedule_rounding_buffer_per_employee'])

def simulate(I,ak,bk,fee=None,integrated=False,execution=None):
 A=I['adoption'][ak]; B=I['build'][bk]; C=I['cloud']; fee=I['fee_rate'] if fee is None else fee
 rows=[]; cash=I['existing_capital_myr']+I['illustrative_opening_financing_myr']; prior_reserve=prior_rev=prior_clients=0
 for m in range(1,37):
  clients=A['clients'][m-1] if m<=24 else A['clients'][-1]*(1+A['year3_monthly_client_growth'])**(m-24)
  churned=prior_clients*A['churn_rate']; new=clients-prior_clients+churned
  campaigns=clients*A['campaigns_per_client']; gmv=campaigns*A['creator_budget_per_campaign']; netgmv=gmv*(1-I['refund_rate']); grossfee=gmv*fee; rev=grossfee*(1-I['refund_rate'])
  collections=rev*(1-I['collection_lag_fraction'])+prior_rev*I['collection_lag_fraction']; ar=rev*I['collection_lag_fraction']
  hist=[r['collections'] for r in rows]+[collections]; reserve=sum(hist[-I['reserve_hold_months']:])*I['reserve_fraction']; reserve_delta=reserve-prior_reserve
  gross_collections=collections/(1-I['refund_rate'])
  creator_gross_collections=(gmv*(1-I['collection_lag_fraction'])+(rows[-1]['gmv'] if rows else 0)*I['collection_lag_fraction']) if integrated else 0
  chargevol=gross_collections+creator_gross_collections
  paid_transactions=campaigns*(1-I['collection_lag_fraction'])+(rows[-1]['campaigns'] if rows else 0)*I['collection_lag_fraction']
  processing=chargevol*I['processor_rate']+paid_transactions*I['processor_fixed']; connected=netgmv*(I['payout_rate']+I['routing_rate'])+campaigns*I['creators_per_campaign']*(I['payout_fixed']+I['active_account_fee']) if integrated else 0
  dispute=chargevol*I['unrecovered_loss_rate']+paid_transactions*I['dispute_incidence']*(I['received_dispute_fee']+I['counter_dispute_fee'])
  overflow=max(0,campaigns-B['ops_staff']*I['campaign_capacity_per_ops']); fulfil=campaigns*I['variable_cost_per_campaign']+overflow*I['overflow_cost_per_campaign']
  if execution: fulfil+=campaigns*execution['paid_participation_slots_per_campaign']*execution['creator_cost_myr_per_paid_participation']
  camhist=[r['campaigns'] for r in rows]+[campaigns]; gb=sum(camhist[-C['retention_months']:])*C['gb_per_campaign']; emails=campaigns*C['emails_per_campaign']; emailover=math.ceil(max(0,emails-C['email_included'])/1000)*C['email_overage_per_1000_usd']
  cloudusd=C['supabase_pro_usd']+C['second_project_usd']+C['workers_usd']+C['email_pro_usd']+B['compute_allowance_usd']+math.ceil(max(0,gb-C['r2_free_gb']))*C['r2_gb_usd']+emailover
  cloud=cloudusd*I['fx']['budget_usd_myr']+campaigns*C['request_allowance_myr_per_campaign']; cogs=processing+connected+dispute+fulfil+cloud
  pay=payroll(I,B,m); acq=B['acquisition_prelaunch'] if m<I['launch_month'] else B['acquisition_live'] if m<=12 else B['acquisition_y2']
  if execution: acq=max(acq,new*execution['brand_acquisition_myr_per_new_client'])
  contract=B['contractors_first3'] if m<=3 else B['contractors_ongoing']; opex=contract+B['workspace']+B['admin']+len(B['roles'])*B['tools_per_person']+acq
  if m>24: opex=opex*(1+I['year3']['non_payroll_opex_growth'])+I['year3']['sea_discovery_monthly_myr']
  setup=sum(B['setup'].values())/3 if m<=3 else 0
  cp=rev-cogs; op=cp-pay['total']-opex; burn=cogs+pay['total']+opex+setup-collections+reserve_delta; cash-=burn
  churned=prior_clients*A['churn_rate']; new=clients-prior_clients+churned
  rows.append(dict(month=m,clients=clients,new_clients=new,churned_clients=churned,campaigns=campaigns,gmv=gmv,creator_refunds=gmv-netgmv,net_gmv=netgmv,creator_funds_in_wringy_cash=0,gross_fee=grossfee,fee_refunds=grossfee-rev,revenue=rev,collections=collections,gross_fee_cash_collected=gross_collections,fee_refund_cash=gross_collections-collections,actual_charge_volume=chargevol,paid_transactions=paid_transactions,creator_gross_cash_at_provider=creator_gross_collections,accounts_receivable=ar,reserve_balance=reserve,change_in_reserve=reserve_delta,processing_cogs=processing,connect_cogs=connected,dispute_cogs=dispute,fulfilment_cogs=fulfil,overflow_campaigns=overflow,cloud_cogs=cloud,cogs=cogs,contribution_profit=cp,payroll=pay['total'],payroll_detail=pay,opex=opex,acquisition_spend=acq,setup_cash=setup,operating_profit_before_setup=op,burn=burn,cash=cash,stored_gb=gb,implied_acquisition_spend_per_new_client=acq/new if new else None))
  if execution: rows[-1].update(creator_paid_participations=campaigns*execution['paid_participation_slots_per_campaign'],creator_participation_cogs=campaigns*execution['paid_participation_slots_per_campaign']*execution['creator_cost_myr_per_paid_participation'])
  prior_reserve=reserve; prior_rev=rev; prior_clients=clients
 return rows

SUMKEYS=['campaigns','gmv','net_gmv','revenue','cogs','contribution_profit','payroll','opex','setup_cash','burn','collections']
def annual(rows):
 return [dict(year=y,projection_not_actual=True,annual_illustration_only=y==3,**{k:sum(r[k] for r in rows[(y-1)*12:y*12]) for k in SUMKEYS},clients_end=rows[y*12-1]['clients'],cash_end=rows[y*12-1]['cash']) for y in (1,2,3)]
def funding(I,rows,h):
 rs=rows[:h]; cum=0; peak=0
 for r in rs: cum+=r['burn']; peak=max(peak,cum)
 fixed=rs[-1]['payroll']+rs[-1]['opex']+rs[-1]['cloud_cogs']
 buffer=fixed*I['funding']['buffer_months']; cont=I['funding']['contingency_rate']*sum(r['payroll']+r['opex']+r['setup_cash'] for r in rs)
 gross=peak+buffer+cont; net=max(0,gross-I['existing_capital_myr']); unit=I['funding']['round_to_myr']; ask=math.ceil(net/unit)*unit
 return dict(months=h,peak_cash_need=peak,three_month_buffer=buffer,contingency=cont,existing_capital_deduction=I['existing_capital_myr'],rounding=ask-net,ask=ask,cash_at_h_if_ask_funded=I['existing_capital_myr']+ask-sum(r['burn'] for r in rs),contingency_in_monthly_burn=False)
def summary(I,rows):
 out={k:sum(r[k] for r in rows[:24]) for k in SUMKEYS}; out.update(month24_clients=rows[23]['clients'],month24_gmv=rows[23]['gmv'],month24_revenue=rows[23]['revenue'],month24_burn=rows[23]['burn'],month24_cash=rows[23]['cash'],first_negative_cash_month=next((r['month'] for r in rows[:24] if r['cash']<0),None),first_operating_profit_month=next((r['month'] for r in rows[:24] if r['operating_profit_before_setup']>=0),None),funding18=funding(I,rows,18),funding24=funding(I,rows,24),first3_month_build_and_launch_cash=sum(r['burn'] for r in rows[:3]))
 return out

def reconcile(I,rows):
 tol=1e-6; opening=I['existing_capital_myr']+I['illustrative_opening_financing_myr']; cum=0; prior=0
 for r in rows:
  cum+=r['burn']
  assert abs(r['cash']-(opening-cum))<tol
  assert abs(r['processing_cogs']-(r['actual_charge_volume']*I['processor_rate']+r['paid_transactions']*I['processor_fixed']))<tol
  assert abs(r['gross_fee_cash_collected']-r['fee_refund_cash']-r['collections'])<tol
  assert abs(r['revenue']-r['cogs']-r['contribution_profit'])<tol
  assert abs(r['gmv']-r['net_gmv']-r['creator_refunds'])<tol
  assert abs(r['gross_fee']-r['revenue']-r['fee_refunds'])<tol
  assert abs(r['cogs']-sum(r[k] for k in ['processing_cogs','connect_cogs','dispute_cogs','fulfilment_cogs','cloud_cogs']))<tol
  assert abs(r['clients']-(prior-r['churned_clients']+r['new_clients']))<tol
  assert r['new_clients']>=-tol and r['creator_funds_in_wringy_cash']==0
  prior=r['clients']
 assert abs(sum(r['revenue']-r['collections'] for r in rows)-rows[-1]['accounts_receivable'])<tol
 assert abs(sum(r['change_in_reserve'] for r in rows)-rows[-1]['reserve_balance'])<tol
 for h in [18,24]:
  f=funding(I,rows,h); assert abs(f['ask']-(max(0,f['peak_cash_need']+f['three_month_buffer']+f['contingency']-f['existing_capital_deduction'])+f['rounding']))<tol
  assert min(I['existing_capital_myr']+f['ask']-sum(x['burn'] for x in rows[:m]) for m in range(1,h+1))>=-tol
 return True

def rounded(x):
 if isinstance(x,float): return round(x,4)
 if isinstance(x,dict): return {k:rounded(v) for k,v in x.items()}
 if isinstance(x,list): return [rounded(v) for v in x]
 return x

def main():
 inp=P/'model-inputs.json'
 if '--init' in sys.argv:
  if inp.exists(): raise SystemExit('Inputs already exist: edit them; refusing overwrite.')
  inp.write_text(json.dumps(initial(),ensure_ascii=False,indent=2)+'\n')
 I=json.loads(inp.read_text()); output=dict(version=I['version'],as_of=I['as_of'],input_sha256=hashlib.sha256(inp.read_bytes()).hexdigest(),currency='MYR',status='全部为未经验证的规划情景；正利润不是已发生或已经验证的业绩；现金为所得税前。',scenarios={},fee_sensitivity={},integrated_payment_stress={},checks={})
 for ak in I['adoption']:
  for bk in I['build']:
   rows=simulate(I,ak,bk); reconcile(I,rows); key=ak+'_'+bk
   output['scenarios'][key]=dict(adoption=ak,build=bk,monthly=rows[:24],annual=annual(rows),summary=summary(I,rows))
 for f in I['fee_sensitivity']:
  rows=simulate(I,'base','base',fee=f); reconcile(I,rows)
  output['fee_sensitivity'][str(f)]=dict(summary=summary(I,rows),month24=rows[23])
 rows=simulate(I,'base','base',integrated=True); reconcile(I,rows)
 output['integrated_payment_stress']=dict(status='条件性成本压力测试，非上线方案；全额资金均在供应商体系，Wringy自由现金仍不包含创作者款项。',monthly=rows[:24],summary=summary(I,rows))
 cap=I['budget_cap_stress']; stress=json.loads(json.dumps(I))
 assert abs(cap['market_annual_spend_myr']*cap['eligible_share']-cap['annual_eligible_budget_myr'])<1e-6
 assert abs(cap['campaigns_per_client']*cap['creator_budget_per_campaign']*12-cap['annual_eligible_budget_myr'])<1e-6
 stress['adoption'][cap['adoption']]['campaigns_per_client']=cap['campaigns_per_client']
 stress['adoption'][cap['adoption']]['creator_budget_per_campaign']=cap['creator_budget_per_campaign']
 capped=simulate(stress,cap['adoption'],cap['build']); reconcile(stress,capped)
 original=output['scenarios'][cap['adoption']+'_'+cap['build']]['monthly']
 assert all(abs(a['clients']-b['clients'])<1e-6 and abs(a['payroll']-b['payroll'])<1e-6 and abs(a['opex']-b['opex'])<1e-6 for a,b in zip(capped,original))
 assert all(abs(r['gmv']-r['clients']*cap['annual_eligible_budget_myr']/12)<1e-6 for r in capped)
 output['budget_cap_stress']=dict(assumptions=cap,monthly=capped[:24],annual=annual(capped),summary=summary(stress,capped))
 execution=I['combined_execution_stress']; execution_inputs=json.loads(json.dumps(stress))
 execution_inputs['overflow_cost_per_campaign']=execution['overflow_cost_myr_per_campaign']
 exrows=simulate(execution_inputs,cap['adoption'],cap['build'],fee=execution['fee_rate'],execution=execution); reconcile(execution_inputs,exrows)
 output['combined_execution_stress']=dict(assumptions=execution,monthly=exrows[:24],annual=annual(exrows),summary=summary(execution_inputs,exrows))
 lowrows=output['scenarios']['low_base']['monthly']; lowcum=0; lowcash=[]
 for r in lowrows:
  lowcum+=r['burn']; lowcash.append(dict(month=r['month'],cash=1200000+I['existing_capital_myr']-lowcum))
 output['funding_shortfall_checks']=dict(low_base_with_1200000=dict(opening_financing=1200000,existing_capital=I['existing_capital_myr'],monthly_cash=lowcash,first_negative_cash_month=next((r['month'] for r in lowcash if r['cash']<0),None)))
 zero=json.loads(json.dumps(I)); zero['adoption']['base']['clients']=[0]*24
 zr=simulate(zero,'base','base'); reconcile(zero,zr); assert all(r['revenue']==0 and r['gmv']==0 for r in zr)
 rich=json.loads(json.dumps(I)); rich['existing_capital_myr']=10000000
 rr=simulate(rich,'base','base'); reconcile(rich,rr); assert funding(rich,rr,24)['ask']==0
 output['checks']=dict(passed=True,scenario_count=9,monthly_rows=216,budget_cap_stress_monthly_rows=24,budget_cap_checks_passed=True,combined_execution_monthly_rows=24,combined_execution_checks_passed=True,checks=['36月逐月现金连续','收入扣直接成本等于贡献利润','创作者预算/退款/净额勾稽','平台费退款勾稽','成本组件勾稽','收单费用按实际毛扣款额及付费交易数计算','客户留存与新增勾稽','累计收入减收款等于应收','冻结款变动等于余额','18/24月融资用途加总且区间现金非负','零客户情景收入与GMV为零','既有资本超出需要时融资额截断为零','三年年度前两年直接由24月求和'],rounding='计算用全精度，JSON保留4位小数；展示可能有RM1以内尾差')
 (P/'model-calculations.json').write_text(json.dumps(rounded(output),ensure_ascii=False,indent=2)+'\n')
 write_report(I,output)
 print(json.dumps({k:{'build3':round(v['summary']['first3_month_build_and_launch_cash']),'ask18':v['summary']['funding18']['ask'],'ask24':v['summary']['funding24']['ask'],'m24revenue':v['summary']['month24_revenue'],'m24cash':round(v['summary']['month24_cash'])} for k,v in output['scenarios'].items()},indent=2))
 print('PASS: 9 scenarios / 216 monthly rows; fee and integrated stress; zero-client boundary; cash, revenue, COGS, funds, funding reconciliations.')

def table(headers,rows):
 return '| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+''.join('| '+' | '.join(str(x) for x in row)+' |\n' for row in rows)+'\n'
def money(v): return f'{v:,.0f}'
def wan(v): return f'{v/10000:,.1f}'
def write_report(I,O):
 S=O['scenarios']; base=S['base_base']; b=base['summary']; lines=[]
 def add(t): lines.append(t+'\n')
 add('# Wringy：马来西亚首发经营模型与建设预算（中文演示资料）\n\n研究日：2026-09-10。币种：马来西亚令吉（RM/MYR）。所有现金为所得税前规划现金，盈利情景须补税务模型后才可用于投资决策。这是可编辑的规划模型，不是已发生业绩、供应商报价或法律结论。不估算TAM，也不依赖并行市场研究。')
 add(f'标准团队前三个月建设及启动约 **RM{wan(b["first3_month_build_and_launch_cash"])}万**。24个月资金需求须并列：原中采用高频假设 **RM{wan(b["funding24"]["ask"])}万**；每品牌年RM30,000预算上限 **RM{wan(O["budget_cap_stress"]["summary"]["funding24"]["ask"])}万**；低采用 **RM{wan(S["low_base"]["summary"]["funding24"]["ask"])}万**；新增联合执行压力测试 **RM{wan(O["combined_execution_stress"]["summary"]["funding24"]["ask"])}万**。均包含峰值现金缺口、三个月缓冲、单列应急额；不是已验证融资报价。')
 add('**预算一致性提示（新增）**：上方RM120万对应原经营中采用，隐含每品牌年RM144,000奖励预算，不能直接与市场研究中间假设RM30,000/年拼接。新增同客户数、标准团队的预算上限压力测试见后文；在该情景下24个月筹资为RM'+money(O['budget_cap_stress']['summary']['funding24']['ask'])+'。未验证更高预算客群前，投资稿应并列展示此差异。')
 add('## 边界与证据等级\n\n已核对本项目`../brief.md`和`../../founder-inputs.md`：品牌+创作者方向、马来西亚起步及粗估授权存在；真实客户验证、团队名单、资本、正式产品规格和支付合同未提供。本轮仅做研究及模型，不建设线上产品。上述空缺作为假设处理。\n\n直接来源的薪资/公开价格/法规信息见文末；客户轨迹、预算、退款率、容量、回款速度和费率全部是本模型假设。精简/标准/完整团队是独立成本轴，不代表低/中/高增长必须配相应团队。没有把市场规模转成客户数。')
 add('## 产品切口与支付边界\n\n假设客户是马来西亚中小品牌或代理商；流程是创建活动 → 邀请创作者 → 提交链接/素材 → 品牌审批 → 生成应付奖励账本 → 核对持牌服务商付款记录。奖励账本只记录“谁完成什么、应付多少、是否已付”，不是可充值、转账或消费的钱包。首版以响应式网页为主。\n\n首发方案：品牌通过其银行或持牌支付服务商直接向创作者付款；Wringy仅对自己的服务费使用Stripe收款。品牌承担创作者付款通道费用，Wringy承担自身服务费收单、退款及争议成本。品牌账单显示创作者预算与服务费两项，创作者预算不进入Wringy银行账户。未宣称银行转账免费；实际品牌通道价不在Wringy收入/成本中，也没有假造报价。\n\n例：RM8,000创作者预算，15%服务费RM1,200，品牌总支出RM9,200加自身出款费用及适用税。10名创作者的奖励按合同分配，非默认均分；若均分是每人RM800。Wringy正常交易支付费RM37（1,200×3%+1），不是对8,000收取15%后再把全额叫作收入。')
 add('## 图表1｜费率与单次活动经济性（可直接用于中文PPT）\n\n口径：RM8,000奖励预算；2%退款预期；不含固定团队/云成本，另含RM40变动履约成本。期望值允许小数。')
 unit=[]
 for f in [.10,.15]:
  fee=8000*f; rev=fee*.98; payment=fee*.03+1; loss=fee*.003+.002*180; cp=rev-payment-loss-40
  unit.append([f'{f:.0%}（提议）',money(fee),money(rev),money(payment),money(loss),money(cp),f'{cp/rev:.1%}'])
 add(table(['平台费率','毛服务费','退款后收入','收单费','预计损失/争议','单活动贡献¹','贡献率¹'],unit))
 add('¹用于解释单位成本；完整月度贡献利润另扣云服务及超出运营容量的外包费用。退款预期2%扣平台收入并减少创作者净预算；支付商原处理费保留在成本。另0.3%服务费金额计无法追回的损失、0.2%活动计争议且每次预留RM180（收到与手动应对两笔）；两者不同于正常退款，不重复扣同一笔本金。这些发生率未经验证。品牌直付创作者的退款由品牌、创作者与支付方处理，Wringy保留证据与账本；不承诺垫付奖励。')
 add('## 图表2｜公开成本基准与模型落点')
 add(table(['项目','第一方可查基准','模型用法'],[
 ['技术月薪','2026工程师RM7,000–14,000 [salary2026]','工程师RM9,000–10,000；技术主管12,000–15,000，非报价'],
 ['本地工资参照','DOSM全国平均3,652；吉隆坡4,782 [dosm]','运营4,000–5,000；创始人4,000–8,000为人为津贴假设'],
 ['设计/测试','Randstad 2025设计4,000/13,000/25,000；人工测试5,000/10,000/15,000 [salary2025]','设计6,000–8,000、测试6,000为预算选点'],
 ['雇主缴费','EPF 13%/12%；SOCSO约1.75%，EIS 0.2%并受工资表/上限约束 [epf][socso][socso_ceiling]','每名员工另留RM10/月档表尾差；福利3%，年度加薪5%是假设'],
 ['HRD','适用行业10人起1%；5–9人自愿0.5% [hrd]','完整团队10人预留1%；其余未选择自愿注册'],
 ['基础云服务','Supabase25+第二项目10、Workers5、Resend20美元/月 [supabase][workers][email]','公开底价USD60≈RM252/月；另计用量及性能预算，不代表总技术成本'],
 ['美元换算','BNM 2026-09-09：USD1=RM4.0688 [fx]','模型USD1=RM4.20，约3.2%汇率余量；不是另加15%应急额'],
 ['Stripe马来西亚','本地卡/FPX 3%+RM1 [stripe]','首发仅处理实际收取的平台服务费；Wringy承担；国际卡及换汇排除在基准外']]))
 add('法定雇主缴费是预算近似：假设马来西亚公民、未满60岁、一般雇员。发薪时须按最新KWSP/PERKESO档表和适用员工身份核算，员工个人扣款不额外增加雇主成本。RM10尾差是预算余量，不是已核对每名员工的实缴金额。完整团队的HRD适用性仍需确认；奖金、额外招聘中介费和特殊签证成本未假造为零报价。')
 add('## 图表3｜三档团队与建设现金（同一首版范围，单位RM）')
 tr=[]
 for bk,B in I['build'].items():
  r=S['base_'+bk]['monthly']; su=S['base_'+bk]['summary']
  tr.append([B['label'],len(B['roles']),money(r[0]['payroll']),money(r[3]['opex']),money(sum(B['setup'].values())),money(su['first3_month_build_and_launch_cash'])])
 add(table(['团队','全职人数','首年月完整薪资成本','上线后月其他运营费²','一次性启动支出','前三月总现金³'],tr))
 add('²运营费含按团队人数的协作/开发工具预算（每人RM200/250/300）、外包、办公、行政及获客，不是已购买工具清单。³前三月含薪资、云、运营及一次性支出；不是另一个需叠加的开发报价。设备15k/30k/50k、合同/隐私/支付准入12k/25k/45k、安全复核8k/20k/35k均为研究规划限额，不是供应商报价。外包设计/测试只补足团队角色，不把已列全职工资重复列为开发费。精简团队单工程师带来延期和关键人风险，三个月只是目标；延期三个月约再耗三个无收入月份，需切范围而非承诺同速交付。')
 for bk,B in I['build'].items(): add('**'+B['label']+'**：'+'；'.join(f'{n} RM{money(v)}/月' for n,v in B['roles'])+'。')
 add('## 图表4｜低/中/高采用路径（全部假设）')
 add(table(['路径','M6/M12/M18/M24活跃品牌','每品牌月活动','每活动奖励预算','月流失假设','M24月GMV','M24月净收入'],[[A['label'],' / '.join(str(A['clients'][m-1]) for m in [6,12,18,24]),A['campaigns_per_client'],money(A['creator_budget_per_campaign']),f'{A["churn_rate"]:.0%}',money(S[ak+'_base']['summary']['month24_gmv']),money(S[ak+'_base']['summary']['month24_revenue'])] for ak,A in I['adoption'].items()]))
 add('M1–3建设，无收入；M4首批付费活动。客户数是“当月活跃付费品牌”，不是注册用户或累计客户。新增=当月活跃−上月活跃×(1−流失率)；模型导出新增及流失，不能把净新增当总获客。每品牌活动频率允许小数，是预期平均值。销售费用反推的每新增客户开支仅用于检验渠道是否现实，不是实测获客成本。高采用未证明销售渠道能支持该速度；例如中采用M24净增5家，但计入流失后需新获8.75家，RM8,000营销费折合约RM914/新客户（未含销售工资），必须通过试点验证。高采用需要超出固定运营容量的外包预算，模型已每超额活动计RM90；仍须验证质量与管理负荷。')
 add('## 图表5｜24个月融资矩阵：增长与成本分开（单位RM万）')
 add(table(['采用路径 / 团队','精简','标准','完整'],[[I['adoption'][ak]['label']]+[wan(S[ak+'_'+bk]['summary']['funding24']['ask']) for bk in I['build']] for ak in I['adoption']]))
 add('融资矩阵含峰值现金缺口＋期末三个月固定开支缓冲＋15%计划薪资/运营/启动支出的应急额，向上取整至RM1万。不把未发生应急额放进月度成本。高采用可能在24个月内转正，所以采用“期间峰值缺口”，不能用期末盈利抵销较早破产风险。')
 add('## 图表6｜标准团队：18/24个月资金用途（单位RM万）')
 add(table(['采用','期限','峰值现金缺口','三月缓冲','单列应急额','建议筹资'],[[I['adoption'][ak]['label'],h,wan((f:=S[ak+'_base']['summary']['funding'+str(h)])['peak_cash_need']),wan(f['three_month_buffer']),wan(f['contingency']),wan(f['ask'])] for ak in I['adoption'] for h in [18,24]]))
 add('真实既有可用资金未知，以0作为融资缺口计算占位；填入`existing_capital_myr`会相应减少融资需求。另用“假设M1已到账RM150万”统一展示9情景现金与runway（可支撑月份），不声称已经融资。缓冲是期末月薪资＋运营＋云成本的3倍；应急额覆盖未计划支出，两者分别列示。税款及创作者资金不可用于延长runway。')
 add(table(['标准团队采用情景','假设150万的首次月末现金不足','M24剩余现金（RM万）','假设模型首次月利润非负（未验证）'],[[I['adoption'][ak]['label'],S[ak+'_base']['summary']['first_negative_cash_month'] or '24月内未耗尽',wan(S[ak+'_base']['summary']['month24_cash']),S[ak+'_base']['summary']['first_operating_profit_month'] or '24月内未达到'] for ak in I['adoption']]))
 add('表中的正利润只由假设推算，不表示商业模式已验证；必须以试点真实收入、退款、履约成本和复购重新计算后再作投资判断。首次月末现金为负的前一个月是完整可支撑月数；模型不推测月中哪一天耗尽。24月内未耗尽不代表永续。融资额的里程碑：M3可审阅原型、供应商/合同确认、数据隔离与退款核对通过；M6有付费活动与首次复购证据；M12中采用24活跃品牌、检验连续3个月真实贡献利润与流失；M18中采用50活跃品牌、月75活动，检验回款及运营负荷；M24中采用80品牌、120活动，决定第二国是否值得另行融资。以上都是门槛/目标，未宣称已完成。M12启动后续融资准备，不等现金只剩3个月。若M12品牌池低于原中采用24家的70%（16.8家），触发产品范围与招聘复核；不自动裁员、不在现金模型中虚构成本节省。')
 add('## 图表7｜三年年度示例：中采用×标准团队（RM万）')
 add(table(['年度','GMV（非收入）','平台净收入','直接成本','贡献利润','薪资','其他运营费','启动支出','净烧钱'],[[str(a['year'])+('（示例）' if a['year']==3 else ''),*[wan(a[k]) for k in ['gmv','revenue','cogs','contribution_profit','payroll','opex','setup_cash','burn']]] for a in base['annual']]))
 add('Y1=M1–12合计，Y2=M13–24合计，严格来自同一月度模型。Y3只作年度示例：中采用客户每月增长3.5%，月活动频率/单价不变；薪资再增5%、非薪运营增15%、另每月RM5,000东南亚调研。低/高路径第三年月增1%/4%，各年度结果也在JSON内。正式跨国上线、当地法律实体与团队成本没有计入；不能把Y3当SEA扩张承诺。经营利润不是现金：应收、冻结款和一次性设备支出造成差异。')
 add('## 图表8｜价格与支付架构敏感性：中采用×标准团队')
 rows=[]
 for f,v in O['fee_sensitivity'].items():
  su=v['summary']; rows.append([f'{float(f):.0%}，品牌直付创作者',wan(su['revenue']),wan(su['contribution_profit']),wan(su['funding24']['ask'])])
 su=O['integrated_payment_stress']['summary']; rows.append(['15%，全额代收费用压力（非完整资本需求）',wan(su['revenue']),wan(su['contribution_profit']),wan(su['funding24']['ask'])])
 add(table(['情景','24月平台收入（万）','24月贡献利润（万）','24月筹资（万）'],rows))
 add('全额代收压力测试假设供应商可获准处理奖励+平台费，Wringy承担全额3%+RM1、净奖励0.25%出款＋0.25%资金路由、每活动10个活跃创作者×(RM6+RM1.50)，同一人跨活动未去重，故偏保守。另将无法追回损失的0.3%施加于全额，不只平台费。公开Connect费用来自[connect]，不是Wringy已拿到的配置；若资金路由与出款最终合同合并收费，去掉相应重复价目项后重跑。此压力测试未含供应商对创作者本金的额外滚动储备，故不能单独作为集成方案融资报价。首发方案无这项本金敞口。')
 add('## 预算一致性变更登记与压力测试（2026-09-10）')
 add('用户本轮授权新增，不覆盖原9组。市场研究`sea-market.md §5`的中间假设为每品牌RM120,000/年×25%可适配份额＝RM30,000/年。原经营中采用每品牌1.5活动/月×RM8,000×12＝RM144,000/年，为4.8倍；原低采用也为RM60,000/年，是同一中间预算的2倍。市场参数本身也是假设，不是官方统计或验证事实。')
 add('推荐先并列预算上限情景；只有真实采购记录证明目标客户是更高预算的独立客群，才可将原中采用作为其基准。不能用“不同客群”口头解释来消除差异。新增情景沿用原中采用的客户轨迹与标准团队，但客户解释为留存可采购品牌池，不是每家每月付费；月均活动频率0.3125×RM8,000＝RM2,500/月，每年RM30,000。活动数是跨品牌与跨月份期望平均值。')
 cap=O['budget_cap_stress']; cs=cap['summary']; orig=O['scenarios']['base_base']['summary']
 add(table(['对照','每品牌年奖励预算RM','M24月活动','M24月GMV','M24月净收入','24月贡献利润','24月筹资'],[['原中采用（保留，较高预算待证）',money(144000),O['scenarios']['base_base']['monthly'][23]['campaigns'],money(orig['month24_gmv']),money(orig['month24_revenue']),money(orig['contribution_profit']),money(orig['funding24']['ask'])],['RM30,000预算上限压力测试',money(I['budget_cap_stress']['annual_eligible_budget_myr']),cap['monthly'][23]['campaigns'],money(cs['month24_gmv']),money(cs['month24_revenue']),money(cs['contribution_profit']),money(cs['funding24']['ask'])]]))
 add(f"新增情景18个月筹资RM{money(cs['funding18']['ask'])}，24个月RM{money(cs['funding24']['ask'])}；以假设开局RM150万计算，M24现金RM{money(cs['month24_cash'])}。所有按活动变化的履约、超额运营、收单交易数、邮件、储存及请求成本都按新频率重算；固定团队、获客及其他运营预算保留，不能将原成本简单乘比例。")
 add('这仍假设100%的可适配预算迁入Wringy；未加入份额流失或更低复购，不能称“保守预测”。审查者重点判断：客户池/当月付费品牌定义、迁入份额、付费采购证据是否足以支持原预算。原报告前面的RM120万融资只适用于原高于市场中间预算的经营路径，不能单独作为与市场中间假设一致的融资提案。正式修订记录位于`model-inputs.json → change_register`。')
 add('## 密封审查后：联合执行压力测试（新增，不替换原情景）')
 ex=O['combined_execution_stress']; es=ex['summary']; er=ex['monthly'][23]
 add('使用年RM30,000预算上限、原中采用客户轨迹、标准团队与品牌直付路径；服务费降至10%。品牌获客支出为原月预算与新增品牌数×RM2,000两者取较高值，替换原获客桶而非重复相加。每活动10个付费参与名额×RM20招聘/支持成本加入变动履约成本；这是参与次数，不是去重人数。额外人工活动成本从RM90提高至RM200；预算上限24个月内未超出50活动/月容量，故这项暂不产生额外成本。全部均是规划假设，不是实测CAC或市场报价。')
 add(table(['指标','联合执行压力测试'],[['24个月筹资RM',money(es['funding24']['ask'])],['M24记录的活动预算，非平台收款RM',money(er['gmv'])],['M24净平台收入RM',money(er['revenue'])],['M24品牌获客费RM',money(er['acquisition_spend'])],['M24创作者付费参与次数',er['creator_paid_participations']],['M24创作者招募/支持成本RM',money(er['creator_participation_cogs'])],['M24月烧钱RM',money(er['burn'])],['假设开局150万：M24现金RM',money(er['cash'])]]))
 add('创作者新增费用独立于原RM40/活动的交付、审核与对账费用。原模型未单列创作者获客费，不代表零获客成本已被验证。本组没有联合施加所得税、上线延迟或融资分期到账冲击，也没有假定LTV/CAC必须达到3–5等未经支持标准；未来需用真实客户及参与者记录验证。')
 short=O['funding_shortfall_checks']['low_base_with_1200000']; negative=short['first_negative_cash_month']
 add(f'密封审查C1的精确核对：若仅到账RM120万并走低采用×标准团队路径，首次月末现金为负是M{negative}（已按完整逐月现金计算，而非年度均摊估算）。M{negative-1}现金RM{money(short["monthly_cash"][negative-2]["cash"])}；M{negative}现金RM{money(short["monthly_cash"][negative-1]["cash"])}。')
 add('全额代收费用压力测试仅说明条件性费用影响，其融资数字不是完整资本需求：未计创作者本金的额外滚动储备/担保等合同要求，不可作为可执行集成融资方案。付款是否经平台托管不决定能否统计活动交易预算；为避免误读，对外统一显示“记录的活动预算，非平台收款”，内部gmv字段保留。')
 add('## 简明架构与建设计划\n\n品牌/创作者网页 → Cloudflare网页与轻量接口 → Supabase登录、数据库、权限 → 私有R2素材；Resend发送状态邮件。独立支付适配层只存供应商交易号、金额和状态，Stripe托管页面收平台服务费，品牌上传/同步创作者付款证明。审批与奖励账本有更正记录、不可静默改账；回调重复时不得重复记账。\n\nM1：品牌/创作者访谈与手工活动、权限原型、合同中的审批/授权/退款定义；M2：活动、提交、审批、账本与托管收款测试；M3：组织数据隔离、管理员双人复核、异常付款、重复回调、备份恢复与隐私演练，完成后小范围试点；M4–6：真实履约、回款及复购验证。精简团队优先链接提交和人工对账；完整团队增加测试/客服覆盖，不增加银行产品。\n\n云预算底价不等于工程总价。每活动暂估1GB文件保留12个月、200封邮件；R2存储按累计保留量计算，邮件超量按公开价计算，网络请求另按RM1/活动预算。性能/日志/备份升级分别留USD30/100/200每月，未给其虚假供应商SKU；定期压测替换为实测。视频转码、全网抓取、AI推荐和短信均不在首版范围，避免用免费额度假装可承载无限视频。Supabase数据库区域与R2储存位置须在数据流评估后选择，不承诺马来西亚数据驻留。')
 add('## 身份、许可与隐私的上线核验\n\nBNM官方申请页区分支付系统、指定支付工具与商户收单的批准/注册事项[bnm]；政策目录列电子货币与电子身份核验政策[bnm_policy]。仅接入某家支付公司不能证明Wringy一定无需许可。签约前把合同卖方、资金流、退款责任和实际收/出款实体画清楚，让本地顾问及供应商确认边界，并核对BNM名单[bnm_directory]。不自建银行、卡、储值、托管、跨境汇款、借贷或资金管理。\n\n身份核验：让支付商收取所需身份证明并返回核验状态；Wringy尽量只保留账户标识、状态和可追溯证据，不自建身份证/生物识别库。品牌的公司资料、授权联系人与创作者的内容使用授权仍须单独核对；支付商核验不替代内容权利核验。审核奖励是履约判断，不宣称等同法定KYC。\n\nJPDP FAQ列DPO任命触发条件：超过20,000人的个人资料、超过10,000人的敏感/财务资料，或规律而系统地监测行为[pdpa]。因此不能写“小平台不用DPO”。跨境云传输依第129条条件评估[pdpa_transfer]；隐私告知、访问权限、保存期限、删除/导出请求、处理商合同及泄露应对应纳入试点前检查。官方泄露指引已定位[pdpa_breach]，本次直取超限，未据此断言具体适用通报时限。此处是研究核验事项，不作法律结论。')
 add('## 24个月逐月表：中采用×标准团队（金额RM，现金假设开局150万）\n\n全部9组每月客户、活动、GMV、收入、COGS、薪资、运营费、烧钱、现金及收款/应收/储备细项在`model-calculations.json → scenarios → 情景名 → monthly`。以下为演示附录可直接使用的一组。COGS指直接服务成本；贡献利润=平台收入−COGS，固定员工薪资另列。烧钱为正表示净支出。')
 add(table(['月','品牌','活动','GMV','收入','COGS','薪资','运营费','启动支出','烧钱','现金'],[[r['month'],money(r['clients']),f'{r["campaigns"]:g}',*[money(r[k]) for k in ['gmv','revenue','cogs','payroll','opex','setup_cash','burn','cash']]] for r in base['monthly']]))
 add('## 模型编辑、公式与核对\n\n仅编辑`model-inputs.json`，运行同目录`python3 model-source.py`；会重算`model-calculations.json`与本说明。脚本仅用Python标准库，不依赖云服务。不使用`--init`覆盖已有假设。文件中`formulas`解释公式，脚本是执行定义；`sources`保存来源、日期和证据。\n\n现金仅包含Wringy自身款项。服务费收入按当月履约并扣2%退款确认；80%当月收款、20%次月收款。收单费按当月实际毛扣款（本月80%+上月20%的服务费）×3%，另按实际支付交易数×RM1；退款现金另扣，处理费不退。全额代收压力测试同样按实际收到的奖励款加平台费扣款计费，绝不只对GMV计费。首发奖励款的银行/支付通道费用由品牌另付；全额代收压力测试所有收单、出款、路由和账户成本均假设由Wringy承担。为保守规划，自身收款5%冻结两个月；这不是Stripe合同条款。应收和冻结款均不计可用现金。供应商返还与月度成本均按同月结算近似，法定缴费实际到期日差异未逐日模拟。\n\n验证已通过：9个情景216行月度记录；费率与全额支付压力测试；零客户边界；逐月现金连续、贡献利润、成本分项、奖励退款、服务费退款、客户新增/流失、应收、冻结款、融资用途及期间现金充足性核对。前三月建设现金已进入烧钱，融资时不重复计入。完整精度计算，JSON四位小数、演示取整可有尾差。')
 add('## 研究来源（第一方，访问日均为2026-09-10）')
 for s in I['sources']: add(f'- **[{s["id"]}] [{s["title"]}]({s["url"]})**：{s["evidence"]}')
 add('## 给两份中文演示的使用提示\n\n投资/伙伴PPT可用上述8组图表，标题必须保留“规划情景/假设”，不能称为业绩。Whop学习PPT若借用财务案例，必须标“Wringy假设案例”；不能把15%描述为Whop Content Rewards公开费率。引用财务数字统一读取计算JSON，不在PPT再手改。输入被修改后，生成表格采用新值；解释性案例及来源价格是2026-09-10研究快照，应随新的商业假设一并复核。')
 (P/'operating-model.md').write_text('\n'.join(lines).replace('GMV', '记录的活动预算，非平台收款'))

if __name__=='__main__': main()
