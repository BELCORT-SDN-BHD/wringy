import {fileURLToPath} from 'node:url';
import {FontLibrary,verifyFont} from './runtime.mjs';
export function registerBrandFonts(){
 for(const [family,file]of [['Noto Sans SC','NotoSansSC.ttf'],['Manrope','Manrope.ttf']]){
 FontLibrary.use(family,[fileURLToPath(new URL(`./assets/fonts/${file}`,import.meta.url))]);verifyFont(family);
 }
}
export function resolveTheme(tokens){
 if(!tokens.primitive)return tokens;
 const resolve=value=>{if(typeof value==='string'&&value.startsWith('{')){const key=value.slice(1,-1);const v=key.split('.').reduce((a,k)=>a?.[k],tokens);if(v===undefined)throw Error(`Unresolved token ${value}`);return resolve(v);}return value;};
 const s=tokens.semantic.light,rule=tokens.typography.rules;
 registerBrandFonts();
 return {rule:resolve(s['border.decorative']),background:resolve(s['bg.canvas']),ink:resolve(s['text.primary']),muted:resolve(s['text.secondary']),purple:resolve(s['brand.secondary']),lime:resolve(s['brand.primary']),white:resolve(s['bg.surface']),chartColors:[1,2,3,4].map(i=>resolve(s[`chart.${i}`])),fontFamily:tokens.primitive.fontFamily.cjk,latinFontFamily:tokens.primitive.fontFamily.latin,titleSize:Math.max(42,rule.deckTitlePt*4/3),bodySize:Math.max(24,rule.deckBodyPt*4/3),tableSize:22};
}
