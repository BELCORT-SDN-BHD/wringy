import {fs,path,PresentationFile,FileBlob,BUILD} from './runtime.mjs';
export async function render(input,output=path.join(BUILD,'renders'),scale=1.5){
 const p=await PresentationFile.importPptx(await FileBlob.load(input));await fs.mkdir(output,{recursive:true});
 for(const [i,s]of p.slides.items.entries()){
  const stem=`slide-${String(i+1).padStart(2,'0')}`;
  const png=await p.export({slide:s,format:'png',scale});await fs.writeFile(path.join(output,stem+'.png'),new Uint8Array(await png.arrayBuffer()));
  await fs.writeFile(path.join(output,stem+'.layout.json'),await(await s.export({format:'layout'})).text());console.log('Rendered',i+1);
 }return p.slides.items.length;
}
if(process.argv[1]===import.meta.filename)await render(path.resolve(process.argv[2]),process.argv[3]?path.resolve(process.argv[3]):undefined);
