import { createRequire } from 'node:module';
const require = createRequire('/home/user/redstone-engineers/videos-explicativos/_kit/package.json'); const { chromium } = require('playwright');
const br = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const pg = await br.newPage({ viewport: { width: 1920, height: 200 } });
const T=["¿QUÉ ES LA CREATINA?","ACTÚA EN TUS MÚSCULOS","SE TOMA EN POLVO","LA CONSTANCIA IMPORTA"];
for (let i=0;i<T.length;i++){
 await pg.setContent(`<body style="margin:0;background:transparent;display:flex;justify-content:center;align-items:center;height:200px"><div style="background:#fff;border:8px solid #111;padding:14px 46px;font:900 84px Arial,sans-serif;color:#111;box-shadow:10px 10px 0 #111">${T[i]}</div></body>`);
 await pg.screenshot({ path:`rot${i+1}.png`, omitBackground:true });
}
await br.close();
