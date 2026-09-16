import {Presentation,FONT,C,box,applyPresentationChartFont} from './runtime.mjs';
export const createDeck=()=>Presentation.create({slideSize:{width:1280,height:720}});
export function tx(s,value,x,y,w,h,size=28,bold=false,color=C.foreground){
 const t=s.shapes.add({geometry:'textbox',position:box(x,y,w,h),fill:'none',line:{fill:'none',width:0}});
 t.text=String(value);t.text.style={typeface:FONT,fontSize:size,bold,color,autoFit:'none',verticalAlignment:'top'};return t;
}
export function page(p,{title,subtitle='',footnote='',notes='',sources=[]}){
 const s=p.slides.add();s.background.fill=C.background;
 if(title)tx(s,title,56,44,1168,116,48,true);
 if(subtitle)tx(s,subtitle,59,158,1160,68,25,false,C['muted-foreground']);
 if(footnote)tx(s,footnote,58,664,1094,42,16,false,C['muted-foreground']);
 tx(s,String(p.slides.items.length).padStart(2,'0'),1164,669,62,27,16,false,C['muted-foreground']);
 s.speakerNotes.textFrame.setText(notes+'\n\n来源\n'+sources.join('\n'));return s;
}
export function rule(s,x,y,width,color=C.border){return s.shapes.add({geometry:'rect',position:box(x,y,width,1),fill:color,line:{fill:'none',width:0}});}
export function steps(s,items,{y=288}={}){
 const width=1168/items.length;
 items.forEach((item,i)=>{const x=56+i*width;tx(s,String(i+1).padStart(2,'0'),x,y,width-30,72,48,true,C.primary);rule(s,x,y+90,width-32);tx(s,item.title,x,y+116,width-32,100,32,true);if(item.body)tx(s,item.body,x,y+223,width-32,119,25,false,C['muted-foreground']);});
}
export function nativeTable(s,values,{x=56,y=235,width=1168,rowH=65,colWidths,font=24}={}){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width,height:rowH*values.length,columnWidths:colWidths,values});
 t.styleOptions={headerRow:false,bandedRows:false};t.borders.assign({style:'solid',fill:C.border,width:0.5});
 values.forEach((row,r)=>{t.rows[r].height=rowH;row.forEach((_,j)=>{let c=t.getCell(r,j);c.fill=C.background;c.text.style={typeface:FONT,fontSize:font,bold:r===0,color:r===0?C.primary:C.foreground,autoFit:'none'};});});return t;
}
export function chart(s,type,options){const c=s.charts.add(type,{chartFill:'none',chartLine:{fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{fill:'none',width:0},...options});applyPresentationChartFont(c,{fontFamily:FONT});return c;}
