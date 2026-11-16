import { createRequire } from 'node:module';
const require = createRequire('/home/user/redstone-engineers/videos-explicativos/_kit/package.json'); const { chromium } = require('playwright');
const br = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
const css=`body{margin:0;background:transparent;width:1920px;height:1080px;position:relative;font-family:Arial,sans-serif}
.t{position:absolute;font-weight:900;font-size:190px;letter-spacing:-6px;transform-origin:left top;transform:scaleX(.78);white-space:nowrap;color:#fff;-webkit-text-stroke:14px #101820;paint-order:stroke fill;text-shadow:10px 10px 0 #101820}
.b{position:absolute;background:#fff;border:8px solid #101820;font-weight:900;font-size:78px;padding:6px 36px;color:#101820;box-shadow:8px 8px 0 #101820}`;
const S=[`<div class=t style="left:40px;top:30px;font-size:125px;-webkit-text-stroke:10px #101820">DÍA 1</div><div class=t style="left:995px;top:30px;font-size:125px;color:#3ddc4a;-webkit-text-stroke:10px #101820">DÍA 30</div>`,
`<div class=b style="left:60px;top:60px">SENTADILLA</div><div class=t style="left:30px;top:760px;font-size:210px;color:#3ddc4a">CUÁDRICEPS</div>`,
`<div class=b style="left:1180px;top:60px">BÍCEPS</div><div class=t style="left:1050px;top:770px;font-size:210px;color:#ff4d4d">3 SERIES</div>`];
for(let i=0;i<S.length;i++){ await pg.setContent(`<style>${css}</style><body>${S[i]}</body>`); await pg.screenshot({path:`ov${i+1}.png`,omitBackground:true}); }
await br.close();
