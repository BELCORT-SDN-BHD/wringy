import assert from 'node:assert/strict';
import {paginate,DEFAULT_THEME} from './renderer.mjs';
const rows=Array.from({length:21},(_,i)=>`条目${i+1}：保留每一行内容，不缩小字号。`);
const input={title:'分页检查',language:'zh-CN',slides:[{id:'catalog',title:'目录',layout:'catalog',takeaway:'全部保留',body:rows}]};
const p=paginate(input);assert.deepEqual(p.flatMap(s=>s.body),rows);assert(p.every(s=>s.body.length<=8));assert(p.length>1);
const tableRows=Array.from({length:23},(_,i)=>[String(i),'检查内容']);const q=paginate({...input,slides:[{id:'t',title:'目录表',layout:'table',table:{headers:['编号','内容'],rows:tableRows}}]});assert.deepEqual(q.flatMap(s=>s.table.rows),tableRows);assert(q.every(s=>s.table.rows.length<=8));
assert.throws(()=>paginate({...input,slides:[{id:'x',title:'无数据',layout:'chart'}]}),/chart data/);
console.log('PASS: all 21 catalog items and 23 native-table rows preserved through pagination; absent chart data rejected.');
