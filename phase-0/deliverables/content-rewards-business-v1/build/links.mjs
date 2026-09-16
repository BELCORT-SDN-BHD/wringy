import {FONT,C,box} from './runtime.mjs';
export function sourceLink(slide,{key,label,url,slideNumber,x,y,w=550,h=64},links){
 if(!/^https:\/\//.test(url))throw Error('A verified primary HTTPS URL is required');
 const name=`source-link-${key}`;
 const t=slide.shapes.add({name,geometry:'textbox',position:box(x,y,w,h),fill:'none',line:{fill:'none',width:0}});
 t.text=label;t.text.style={typeface:FONT,fontSize:25,bold:false,color:C.primary,autoFit:'none',verticalAlignment:'top'};
 links.push({slide:slideNumber,name,url,x,y,w,h});return t;
}
