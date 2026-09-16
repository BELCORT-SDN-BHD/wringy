import json,hashlib
from pathlib import Path
r=Path('phase-0/deliverables'); b=r/'brand'; build=r/'build/figma'
results=json.loads((build/'results.json').read_text()); q=json.loads((build/'foundation-queue.json').read_text())
variables=[]; successful=[]
for item in results:
 if item['result'].get('isError'):continue
 for c in item['result'].get('content',[]):
  if c.get('type')=='text':
   try:d=json.loads(c['text'])
   except (ValueError,TypeError):continue
   variables.extend(d.get('variables',[]))
 successful.append(item['step'])
# Successful orchestration cursor was 13; final read-back blocked by quota.
if not variables:
 for step in q[:13]:
  marker='for(const [cn,name,type,raw,scopes] of '
  defs=json.JSONDecoder().raw_decode(step['code'].split(marker,1)[1])[0]
  variables.extend({'name':d[1],'collectionName':d[0],'id':None,'status':'successful batch reported; individual ID requires read-back after quota reset'} for d in defs)
 successful=[x['name'] for x in q[:13]]
assert len(variables)==130,len(variables)
collections=[{'id':'VariableCollectionId:3:4','name':'Wringy Primitives','modeId':'3:2'},{'id':'VariableCollectionId:3:5','name':'Wringy Semantic Light','modeId':'3:3'},{'id':'VariableCollectionId:3:6','name':'Wringy Semantic Dark','modeId':'3:4'},{'id':'VariableCollectionId:3:7','name':'Wringy Metrics','modeId':'3:5'}]
status={'file_key':'qw2UHml58nEnQLtUbC058Z','file_url':'https://www.figma.com/design/qw2UHml58nEnQLtUbC058Z','name':'Wringy — Brand & Design System v1','status':'blocked_figma_starter_mcp_call_limit','updated':'2026-09-10','completed':{'collections':4,'variables':130,'textStyles':0,'effectStyles':0,'componentFamilies':0,'variants':0,'productScreens':0,'exports':0},'blocker':'Figma MCP Starter plan call limit reached. Further use_figma rejected. Main must restore tool access; no workaround attempted.','upgrade_url':'https://www.figma.com/files/team/1564572283073170523/all-projects?upgrade=mcp_rate_limit_paywall','manifest':'figma-manifest.json'}
(b/'figma-file.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
m=dict(status)
m.update({'sourceTokens':str((b/'tokens.json').resolve()),'sourceTokensSHA256':hashlib.sha256((b/'tokens.json').read_bytes()).hexdigest(),'paletteChanged':False,'collections':collections,'variables':variables,'countEvidence':'13 successful batches of10; final read-back rejected. Individual variable IDs were not retained in local result ledger; recover by collection+exact name before resume.','pages':[{'id':'0:1','lastObservedName':'Page 1','status':'blank on initial inspection; no canvas nodes created by worker'}],'boundVariableNodeCount':0,'createdCanvasNodeIds':[],'styles':[],'components':[],'screens':[],'exports':[]})
m['visualChecks']=[{'asset':str((r/'assets/generated'/name).resolve()),'result':'Inspected supplied bitmap; not imported because MCP quota reached.'} for name in ['brand-logo-concept.png','logo-lockup-transparent.png']]
m['fonts']={'independentlyVerifiedFigma':[{'family':'Manrope','styles':['Regular','Medium','SemiBold','Bold']},{'family':'Noto Sans SC','styles':['Regular','Medium','Bold']}],'mappingNote':'Noto600 proposed text style maps to verified Medium; no canonical file edit.'}
m['limitations']=[{'id':'FIGMA-MODE-01','error':'Error: in addMode: Limited to 1 modes only','handling':'Separate single-mode Light and Dark semantic collections, aliased to shared primitives. Native mode switching unavailable; future migration requires multi-mode access.','status':'communicated_to_main'},{'id':'FIGMA-QUOTA-01','error':"You've reached the Figma MCP tool call limit on the Starter plan.",'handling':'Stopped calls; no component/screen/export completion claimed.','status':'blocking'}]
m['resume']={'queuePath':str((build/'foundation-queue.json').resolve()),'nextQueueIndex':13,'totalFoundationCalls':len(q),'successfulSteps':successful,'resultsPath':str((build/'results.json').resolve()),'workflow':'Restore access; inspect IDs; continue remaining import; then three pages, native components, examples and export QA.','plannedCounts':{'variables':207,'textStyles':32,'effectStyles':4,'componentFamilies':31,'screens':4}}
inv=json.loads((b/'component-inventory.json').read_text())
m['componentCoveragePlan']=[{'id':x['id'],'name':x['name_zh'],'status':'not_built_due_to_api_quota','requiredVariants':x['variants'],'requiredStates':x['states']} for x in inv['components']]
m['screenPlan']=[{'slot':slot,'role':role,'viewport':viewport,'purpose':purpose,'status':'not_built'} for slot,role,viewport,purpose in [('BB21','brand','desktop','Campaign management'),('BB22','brand','mobile','Review queue'),('BB23','creator','desktop','Activity/submission status'),('BB24','creator','mobile','Reward/provider status; future integrated-route illustration MYR150.00−2.00=148.00')]]
m['latestProductConstraint']={'source':'2026-09-10 live main handoff','launchModel':'Brand direct pay; no wallet MVP claim.','paymentExample':'Provider status display or explicitly labeled future integrated route. All data marked 示例数据.','doNotEditBrandBook':True}
m['review']='Independent review by main after native completion. No native screenshots available yet.'
(b/'figma-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(build/'resume.md').write_text('''# Native Figma: blocked, resumable

2026-09-10. File qw2UHml58nEnQLtUbC058Z. No delegation.

Four collections and 130 variables succeeded. Collection IDs and exact variable names are in ../../brand/figma-manifest.json. Individual variable IDs require read-back after access is restored; the local result ledger did not retain them.130 count is based on13 successful batch responses, not a final file audit. The next variable batch was rejected by the Starter MCP call limit. No canvas nodes, styles, components, product examples or exports exist from this worker. Do not report finished native assets.

After access is restored, inspect state and match IDs, then continue foundation-queue.json at index 13 (0-based). Every call contains at most10 variable creations or8 text-style creations. Variable/style creation is idempotent; the unexecuted effects step needs an existence check if resumed twice. Log returned IDs in results.json.

The API only permits one mode per collection. Light/Dark are separate semantic collections aliased to common primitives; native theme mode switching is unavailable. Main was notified.

Three pages: Brand & Foundations, Components, Product Examples. Use supplied bitmap logo, never an invented substitute. Manrope/Noto Sans SC font names verified.31 component families must be genuine reusable native structures with properties/variants/bindings, not labels in frames.

Slots: BB21 brand desktop management; BB22 brand mobile review queue; BB23 creator desktop activity/submission status; BB24 creator mobile reward/provider status. Launch model is brand direct pay. The MYR150.00−2.00=148.00 illustration must say future integrated route and 示例数据, never wallet MVP.

Export via node.exportAsync then figma.io.write. Copy actual returned PNG/SVG artifacts into assets/figma; record absolute paths, all node IDs and screenshot QA. No publishing or sharing changes. Main handles independent review.
''')
print(json.dumps({'status':status['status'],'variables':len(variables),'collections':4,'nextQueueIndex':13,'remainingFoundationCalls':len(q)-13,'saved':['brand/figma-file.json','brand/figma-manifest.json','build/figma/resume.md']},indent=2))
