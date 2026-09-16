import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { finalizePresentation, applyPresentationChartFont } from '${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations/container_tools/artifact_tool_utils.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const BUILD=import.meta.dirname;
const SKILL='${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const PY='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const FONT='Noto Sans SC';
GlobalFonts.registerFromPath(path.resolve(ROOT,'../brand/showcase/fonts/NotoSansSC.ttf'),FONT);
const tokens=JSON.parse(await fs.readFile(path.resolve(ROOT,'../../foundation/design-tokens-v1.json'),'utf8'));
const C={bg:tokens.color.canvas,ink:tokens.color.ink,blue:tokens.color.accent,muted:tokens.color.muted,rule:tokens.color.line,white:tokens.color.surface};
const candidate=path.join(BUILD,'candidate.pptx');
const output=path.join(ROOT,'output','Wringy-Investor-v2-Reviewed.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:output,pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...[10,15,16,17].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:17,requiredNativeTableOwnerSlides:[10,15,16,17],requiredNativeChartOwnerSlides:[7,13],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation-reviewed.json')});
console.log('FINALIZED',output);
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(output));
for(let i=0;i<17;i++){
 const s=finalDeck.slides.items[i];const png=await finalDeck.export({slide:s,format:'png',scale:1.5});
 await fs.writeFile(path.join(BUILD,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 console.log('RENDERED',i+1);
}
