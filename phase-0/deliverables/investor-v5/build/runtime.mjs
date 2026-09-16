import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { finalizePresentation, applyPresentationChartFont } from '${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations/container_tools/artifact_tool_utils.mjs';
export { fs, path, Presentation, PresentationFile, FileBlob, applyPresentationChartFont };
export const BUILD=import.meta.dirname, ROOT=path.resolve(BUILD,'..');
export const SKILL='${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
export const DEP='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies';
export const PY=path.join(DEP,'python/bin/python3');
export const SOFFICE=path.join(DEP,'native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice');
export const FONT='Noto Sans SC';
process.env.RUNTIME_NODE_MODULES=path.join(DEP,'node/node_modules');
GlobalFonts.registerFromPath(path.resolve(ROOT,'../brand/showcase/fonts/NotoSansSC.ttf'),FONT);
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function loadVisualHandoff(file){
 if(!file)throw Error('Main canonical token and asset handoff is required; no legacy palette fallback.');
 const manifest=JSON.parse(await fs.readFile(file,'utf8'));
 if(manifest.status!=='main-authorized')throw Error('Visual handoff must be explicitly authorized by main.');
 if(!path.isAbsolute(manifest.tokenPath))throw Error('Canonical tokenPath must be absolute.');
 const raw=await fs.readFile(manifest.tokenPath);const tokens=JSON.parse(raw);
 const C={};for(const key of ['background','surface','ink','muted','accent','line']){
  const tokenKey=manifest.colorKeys?.[key];if(!tokenKey)throw Error('Missing canonical color mapping '+key);
  C[key]=tokenKey.split('.').reduce((o,k)=>o?.[k],tokens);if(!C[key])throw Error('Unresolved canonical token '+tokenKey);
 }
 const assets={};const used=new Set();
 for(const [role,a]of Object.entries(manifest.assets??{})){
  if(!a.path||!a.alt||!a.source)throw Error('Asset requires path, alt and source: '+role);
  const bytes=await fs.readFile(a.path);const hash=sha(bytes);
  if(used.has(hash))throw Error('Duplicate image assigned more than once: '+role);used.add(hash);
  assets[role]={...a,bytes,sha256:hash};
 }
 return {C,assets,tokenPath:manifest.tokenPath,tokenSha256:sha(raw),manifest};
}
export async function finalize(candidatePath,finalPath,revision='final'){
 return finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,pythonExecutable:PY,
  integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],
  explicitTotalSlideCount:12,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[9,12],
  materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,
  receiptPath:path.join(BUILD,`validation-${revision}.json`)});
}
export async function renderFinal(finalPath){
 const deck=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 if(deck.slides.items.length!==12)throw Error('Expected ten slides');
 const dir=path.join(ROOT,'output/slides');await fs.mkdir(dir,{recursive:true});
 for(let i=0;i<12;i++){
  const slide=deck.slides.items[i];const png=await deck.export({slide,format:'png',scale:1.5});
  await fs.writeFile(path.join(dir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
  const layout=await slide.export({format:'layout'});await fs.writeFile(path.join(BUILD,`slide-${i+1}.layout.json`),await layout.text());
  console.log('Rendered',i+1);
 }
}
