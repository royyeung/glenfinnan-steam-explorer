// Identify what is under given screen pixels in a view. Usage: tools/run.sh pick.mjs <view> x,y x,y ...
import { serve, browser, openPage } from './common.mjs';
const [view, ...pts] = process.argv.slice(2);
const { server, url } = await serve(); const b = await browser();
const { page } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
const r = await page.evaluate(([view, pts]) => {
  GX.view(view); const T = GX.THREE, rc = new T.Raycaster(), cam = GX.app.camera;
  return pts.map((s) => { const [x, y] = s.split(',').map(Number); rc.setFromCamera(new T.Vector2(x / 640 - 1, 1 - y / 360), cam);
    const hits = rc.intersectObjects(GX.app.scene.children, true).filter((h) => h.object.visible && h.object.name !== 'sky').slice(0, 3);
    return { px: s, hits: hits.map((h) => ({ name: h.object.name, mat: h.object.material.name, d: +h.distance.toFixed(2), p: h.point.toArray().map((v) => +v.toFixed(2)) })) }; });
}, [view, pts]);
console.log(JSON.stringify(r, null, 1));
await b.close(); server.close();
