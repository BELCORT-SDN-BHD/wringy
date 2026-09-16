import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { finalizePresentation, applyPresentationChartFont } from '${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations/container_tools/artifact_tool_utils.mjs';
export { fs, path, Presentation, PresentationFile, FileBlob, finalizePresentation, applyPresentationChartFont };
process.env.RUNTIME_NODE_MODULES='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
export const BUILD=import.meta.dirname;
export const ROOT=path.resolve(BUILD,'..');
export const SKILL='${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
export const PY='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
export const FONT='Noto Sans SC';
GlobalFonts.registerFromPath(path.resolve(ROOT,'../brand/showcase/fonts/NotoSansSC.ttf'),FONT);
export const SEQUENCE=['Company purpose','Problem','Solution','Why now','Market potential','Competition','Business model','Team','Financials','Vision'];
export async function finalize(candidatePath,finalPath){
 return finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','6','--require-native-table-slide','9'],explicitTotalSlideCount:10,tableArithmeticContracts:[{slide:9,table:1,label_column:0,total_row:6,value_columns:[1],component_rows:[1,2,3,4,5]}],requiredNativeTableOwnerSlides:[6,9],requiredNativeChartOwnerSlides:[],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation.json')});
}
export async function renderFinal(finalPath){
 const deck=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 if(deck.slides.items.length!==10)throw new Error('Expected exactly ten slides');
 for(let i=0;i<10;i++){
  const slide=deck.slides.items[i];
  const png=await deck.export({slide,format:'png',scale:1.5});
  await fs.writeFile(path.join(BUILD,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
  console.log('Rendered',i+1);
 }
}
