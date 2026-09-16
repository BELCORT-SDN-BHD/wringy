import {fs,path,PresentationFile,FileBlob,finalizePresentation,ROOT,BUILD,SKILL,PY,FONT} from './runtime.mjs';
import {execFileSync} from 'node:child_process';
export async function finish(p,rev='v1'){
 const candidate=path.join(BUILD,`candidate-${rev}.pptx`);await(await PresentationFile.exportPptx(p)).save(candidate);
 const final=path.join(ROOT,`output/Wringy-Angel-Deck-${rev}.pptx`);
 await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','13','--require-native-table-slide','15'],explicitTotalSlideCount:17,requiredNativeTableOwnerSlides:[13,15],requiredNativeChartOwnerSlides:[3,14],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,`validation-${rev}.json`)});
 const deck=await PresentationFile.importPptx(await FileBlob.load(final));await fs.mkdir(path.join(ROOT,'output/slides'),{recursive:true});
 for(let i=0;i<17;i++){const slide=deck.slides.items[i],png=await deck.export({slide,format:'png',scale:1.5});await fs.writeFile(path.join(ROOT,'output/slides',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));await fs.writeFile(path.join(BUILD,`slide-${i+1}.layout.json`),await(await slide.export({format:'layout'})).text());console.log('Rendered',i+1);}
 execFileSync(PY,[path.join(BUILD,'preview.py'),rev],{stdio:'inherit'});console.log(final);
}
