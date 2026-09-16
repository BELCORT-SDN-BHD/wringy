import {path,fs,finalizePresentation,ROOT,BUILD,SKILL,PY,FONT} from './runtime.mjs';
export async function finalize(candidatePath,finalPath,{count,charts=[],tables=[]}={}){
 await fs.mkdir(path.dirname(finalPath),{recursive:true});
 return finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...tables.flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:count,requiredNativeChartOwnerSlides:charts,requiredNativeTableOwnerSlides:tables,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,path.basename(finalPath)+'.validation.json')});
}
