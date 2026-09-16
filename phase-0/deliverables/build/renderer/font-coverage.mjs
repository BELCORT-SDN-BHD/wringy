import fs from 'node:fs';
const file=new URL('./assets/fonts/NotoSansSC.ttf',import.meta.url);
export function verifyChineseGlyphs(value){
 const b=fs.readFileSync(file);let cmap;
 for(let i=0;i<b.readUInt16BE(4);i++){const o=12+i*16;if(b.toString('ascii',o,o+4)==='cmap')cmap=b.readUInt32BE(o+8);}
 if(cmap===undefined)throw Error('Noto font lacks cmap');let groups;
 for(let i=0;i<b.readUInt16BE(cmap+2);i++){const o=cmap+b.readUInt32BE(cmap+4+i*8+4);if(b.readUInt16BE(o)===12){groups=[];for(let j=0;j<b.readUInt32BE(o+12);j++){const q=o+16+j*12;groups.push([b.readUInt32BE(q),b.readUInt32BE(q+4),b.readUInt32BE(q+8)]);}break;}}
 if(!groups)throw Error('Noto SC format-12 cmap absent; cannot verify glyphs');
 const chars=[...new Set([...String(value)].filter(c=>/\p{Script=Han}/u.test(c)))];const missing=chars.filter(c=>!groups.some(([a,z,g])=>c.codePointAt(0)>=a&&c.codePointAt(0)<=z&&g+c.codePointAt(0)-a!==0));
 if(missing.length)throw Error(`Noto Sans SC missing glyphs: ${missing.join('')}`);return {font:'Noto Sans SC',hanGlyphCount:chars.length,allPresent:true};
}
