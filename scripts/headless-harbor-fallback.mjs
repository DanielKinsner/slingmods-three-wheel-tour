import { chromium } from 'playwright';
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root=join(process.env.LOCALAPPDATA,'ms-playwright');
const executablePath=readdirSync(root).filter(n=>n.startsWith('chromium_headless_shell-')).map(n=>join(root,n,'chrome-headless-shell-win64','chrome-headless-shell.exe')).find(existsSync);
const browser=await chromium.launch({headless:true,executablePath,args:['--use-angle=d3d11']});
const result={scope:'Isolated headless WebGL: deliberate missing optional harbor GLB',errors:[],warningSeen:false};
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('Optional harbor art unavailable'))result.warningSeen=true;});
 await page.route('**/models/harbor-kit.glb',r=>r.abort('failed'));
 await page.goto('http://127.0.0.1:4175/?webgl=1');
 await page.locator('[data-action="quick"]').waitFor({timeout:90000});
 await page.click('[data-action="quick"]');
 await page.click('[data-quicktrack="5"]');
 await page.click('[data-mode="free"]');
 await page.click('[data-action="race"]');
 await page.waitForTimeout(1500);
 await page.keyboard.down('w');
 await page.waitForTimeout(5000);
 await page.keyboard.up('w');
 result.tour=await page.evaluate(()=>window.__tour);
 await page.screenshot({path:'evidence/blender-upgrade/missing-kit-fallback.png'});
 if (!result.warningSeen||result.errors.length||result.tour.paused||result.tour.player.distance<20)throw Error('Missing-kit fallback failed');
} catch(e){result.errors.push(String(e));process.exitCode=1;}finally{await browser.close();writeFileSync('evidence/blender-upgrade/fallback.json',JSON.stringify(result,null,2));console.log(JSON.stringify({errors:result.errors,warningSeen:result.warningSeen,distance:result.tour?.player.distance}));}
