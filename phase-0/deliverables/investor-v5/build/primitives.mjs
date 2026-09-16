import {fs,FONT} from './runtime.mjs';
import sharp from 'sharp';
export function text(slide,value,box,{size=30,bold=false,color,align='left'}={}){
 const q=slide.shapes.add({geometry:'textbox',name:value.slice(0,60),position:box,fill:'none',line:{fill:'none',width:0}});
 q.text=value;q.text.style={typeface:FONT,fontSize:size,bold,color,alignment:align,autoFit:'none',verticalAlignment:'top'};return q;
}
export function image(slide,asset,box,fit='cover',crop=undefined){
 return slide.images.add({blob:new Uint8Array(asset.bytes),contentType:'image/png',alt:asset.alt,fit,position:box,...(crop?{crop}: {})});
}
export async function tabler(slide,svgPath,box,color){
 // Recolor licensed original artwork. Do not synthesize new paths or illustrations.
 const svg=(await fs.readFile(svgPath,'utf8')).replaceAll('currentColor',color);
 const bytes=await sharp(Buffer.from(svg)).resize(144,144).png().toBuffer();
 return slide.images.add({blob:new Uint8Array(bytes),contentType:'image/png',alt:'Tabler licensed semantic icon',fit:'contain',position:box});
}
