import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readSeedInventory } from './src/seed-library.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
let esbuild;
try{esbuild=require('esbuild');}catch{
  const local=process.env.ESBUILD_PATH || 'D:/software/Coopanion/resources/app/node_modules/esbuild';
  esbuild=require(local);
}
const read=p=>fs.readFile(path.join(root,p),'utf8');
const scene=JSON.parse(await read('assets/scene/scene.json'));
const farm=JSON.parse(await read('assets/farm/scene.json'));
farm.layers=JSON.parse(await read('assets/farm/layers.json'));
farm.seeds=readSeedInventory(JSON.parse(await read('assets/farm/seeds.json')));
const model=JSON.parse(await read('vendor/whale/model.json'));
const images={};
async function image(key,file){images[key]='data:image/png;base64,'+(await fs.readFile(path.join(root,file))).toString('base64');}
await image('scene/composite.png','assets/scene/composite.png');
await image('scene/chair-front.png','assets/scene/chair-front.png');
await image('farm/seed-packets.png','assets/farm/seed-packets.png');
await image('farm/crop-sprites.png','assets/farm/crop-sprites.png');
for (const period of ['dusk', 'dawn']) {
  const filename = `time-scenes/${period}.png`;
  await image(filename, `assets/${filename}`);
}
for (const [period, layers] of Object.entries(farm.layers)) {
  for (const {id} of layers) {
    const file = `farm/layers/${period}/${id}.png`;
    await image(file, `assets/${file}`);
  }
}
for(const f of scene.furniture)await image(`scene/${f.file}`,`assets/scene/${f.file}`);
for(const dir of ['tex','feat'])for(const file of await fs.readdir(path.join(root,'vendor/whale',dir)))if(file.endsWith('.png'))await image(`whale/${dir}/${file}`,`vendor/whale/${dir}/${file}`);
const deskFolder = 'whale/tex/蓝鲸女仆_书桌椅_坐稳循环';
const { room, portraitFrame, idleLoop } = JSON.parse(await read(`vendor/${deskFolder}/seat.layout.json`));
const atlasImage = `${deskFolder}/${idleLoop.chairAtlas}`;
await image(atlasImage, `vendor/${atlasImage}`);
const deskSeat = { room, portraitFrame, idleLoop, atlasImage };
const flashFolder = 'whale/tex/鲸光闪烁';
const flashConfig = JSON.parse(await read(`vendor/${flashFolder}/animation.json`));
const flashAtlas = `${flashFolder}/atlas.png`;
await image(flashAtlas, `vendor/${flashAtlas}`);
const furnitureFlash = { ...flashConfig, atlasImage: flashAtlas };
await image('avatar.png','assets/avatar.png');
const result=await esbuild.build({entryPoints:[path.join(root,'src/app.js')],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',logLevel:'warning',define:{'import.meta.url':'"http://localhost/unused-embedded-asset-base"'}});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const data=JSON.stringify({scene,farm,model,images,deskSeat,furnitureFlash}).replaceAll('<','\\u003c');
const template=await read('index.template.html');
const styles=await Promise.all(['src/style.css','src/room-clock.css','src/room-map.css','src/seed-library.css'].map(read));
const html=template.replace('/* STYLE */',()=>styles.join('\n')).replace('/* DATA */',()=>`window.ROOM_DATA=${data};`).replace('/* APP */',()=>js);
await fs.writeFile(path.join(root,'蓝白鲸语-行走Demo.html'),html);
console.log(`Built offline demo (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB).`);
