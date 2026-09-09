import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('evidence/playground',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.HEADLESS_CHROMIUM || 'C:/Users/SM - Dan/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--use-angle=d3d11']});
try {
 const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://slingmods-three-wheel-tour.vercel.app/?webgl=1');
 await page.locator('[data-action="quick"]').waitFor({timeout:90000});
 await page.waitForFunction(()=>window.__tour?.drawCalls>0,{},{timeout:90000});
 await page.screenshot({path:'evidence/playground/baseline-home.png'});
 await writeFile('evidence/playground/baseline.json',JSON.stringify({errors,diagnostics:await page.evaluate(()=>window.__tour)},null,2));
 console.log('Actual production baseline rendered in isolated headless WebGL.');
}finally { await browser.close(); }
