import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export const NODE='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
export const MODULES='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
export const PYTHON='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
export const SKILL='${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
export const BUNDLED_LO='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice';
process.env.RUNTIME_NODE_MODULES=MODULES;
process.env.RUNTIME_NODE=NODE;
process.env.RUNTIME_PYTHON=PYTHON;
const require=createRequire(`${MODULES}/@oai/artifact-tool/package.json`);
export const {Canvas,FontLibrary}=require('skia-canvas');
export const helpers=await import(pathToFileURL(`${SKILL}/container_tools/artifact_tool_utils.mjs`));
export function verifyFont(family='PingFang SC') {
 if(!FontLibrary.families.includes(family)) throw Error(`Font unavailable in artifact renderer: ${family}`);
 return helpers.resolvePresentationFont({fontFamily:family,availableFonts:FontLibrary.families});
}
