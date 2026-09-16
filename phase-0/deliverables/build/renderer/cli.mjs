import fs from 'node:fs/promises';
import path from 'node:path';
import {renderDeck} from './renderer.mjs';
const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i++){const k=args[i];if(k==='--pdf'||k==='--mark-confirmed')opts[k]=true;else{if(!['--input','--assets','--tokens','--output','--workspace'].includes(k)||!args[i+1])throw Error(`Unknown or incomplete option ${k}`);opts[k]=args[++i];}}
if(!opts['--mark-confirmed'])throw Error('Main must confirm the operation mark; pass --mark-confirmed only after that confirmation. This CLI never marks again.');
if(!opts['--input']||!opts['--output'])throw Error('Required: --input content.json --output absolute.pptx');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const assetFile=opts['--assets']&&path.resolve(opts['--assets']);
const result=await renderDeck(await read(opts['--input']),{theme:opts['--tokens']?await read(opts['--tokens']):{},assets:assetFile?await read(assetFile):{},assetBase:assetFile?path.dirname(assetFile):process.cwd(),output:path.resolve(opts['--output']),workspaceDir:path.resolve(opts['--workspace']??path.dirname(opts['--output'])),pdf:!!opts['--pdf']});console.log(JSON.stringify(result,null,2));
