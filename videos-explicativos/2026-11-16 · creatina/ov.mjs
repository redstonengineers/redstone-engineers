
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/home/user/redstone-engineers/videos-explicativos/_kit/package.json'); const { chromium } = require('playwright');
const L=JSON.parse(fs.readFileSync('labels.json','utf8'));
const br = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const pg = await br.newPage({ viewport:{width:1920,height:1080} });
for (const [k,t] of Object.entries(L)){
  const fs_ = t.length>26?62:(t.length>20?72:84);
  await pg.setContent(`<body style="margin:0;background:transparent;width:1920px;height:1080px;position:relative;font-family:Arial,sans-serif"><div style="position:absolute;left:0;right:0;bottom:70px;display:flex;justify-content:center"><div style="background:#fff;border:9px solid #101820;padding:8px 44px;font-weight:900;font-size:${fs_}px;color:#101820;box-shadow:10px 10px 0 #101820;white-space:nowrap">${t}</div></div></body>`);
  await pg.screenshot({path:`ov/${String(k).padStart(2,'0')}.png`,omitBackground:true});
}
await br.close();
