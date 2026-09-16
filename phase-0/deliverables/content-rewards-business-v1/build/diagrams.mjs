import {C,box} from './runtime.mjs';
import {tx} from './template.mjs';
// Native editable semantic diagrams. Content is supplied by the main story.
export function businessDiagram(slide,{nodes,edges}){
 const objects=new Map();
 for(const node of nodes){
  const {id,title,body='',x,y,w=260,h=130,emphasis=false}=node;
  const shape=slide.shapes.add({name:id,geometry:'rect',position:box(x,y,w,h),fill:emphasis?C.primary:C.secondary,line:{fill:'none',width:0}});
  objects.set(id,shape);
  tx(slide,title,x+18,y+16,w-36,52,30,true,emphasis?C['primary-foreground']:C.foreground);
  if(body)tx(slide,body,x+18,y+75,w-36,h-80,24,false,emphasis?C['primary-foreground']:C['muted-foreground']);
 }
 for(const edge of edges){
  if(!objects.has(edge.from)||!objects.has(edge.to))throw Error('Diagram edge has unknown node');
  slide.shapes.connect(objects.get(edge.from),objects.get(edge.to),{kind:edge.kind||'straight',fromSide:edge.fromSide||'right',toSide:edge.toSide||'left',line:{fill:C.primary,width:2},tail:{type:'arrow',width:'med',length:'med'}});
 }
}
export function campaignFlow(slide,items,{top=270}={}){
 if(items.length<2||items.length>5)throw Error('Use 2–5 concise campaign stages');
 const gap=34,width=(1168-gap*(items.length-1))/items.length;
 businessDiagram(slide,{nodes:items.map((item,i)=>({id:`stage-${i}`,x:56+i*(width+gap),y:top,w:width,h:164,...item})),edges:items.slice(1).map((_,i)=>({from:`stage-${i}`,to:`stage-${i+1}`}))});
}
