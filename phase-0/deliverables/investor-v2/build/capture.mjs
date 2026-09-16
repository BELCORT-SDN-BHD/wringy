import {chromium} from 'playwright';
import path from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
await page.goto('file://'+path.resolve('phase-0/foundation/design-preview.html'));
await page.locator('.screen').nth(1).locator('.reward').screenshot({path:path.resolve('phase-0/deliverables/investor-v2/build/product-concept.png')});
await browser.close();
