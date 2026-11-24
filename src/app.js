import { createPet } from '../vendor/kit/body.js';
import { createRig } from '../vendor/kit/rig.js';
import { createWhaleFigure } from '../vendor/whale/figure.js';
import { shenzhenSunSchedule } from './shenzhen-sun.js';
import { initRoomClock } from './room-clock.js';
import { initRoomMap } from './room-map.js';
import { createFurnitureHitTest, createDeskPetHitTest } from './furniture-hit.js';
import { createDeskLoop, loadDeskFrames } from './desk-loop.js';
import { createAtlasPlayer } from './atlas-player.js';
import { initMotionPreview } from './motion-preview.js';
import { initFarmPlots } from './farm-plots.js';
import { initFarmArt } from './farm-art.js';
import { chooseActivity } from './free-activities.js';
import { FLOOR, OBSTACLES, WAYPOINTS, SPAWN, ROOM_NAVIGATION, configureNavigation, findPath, isWalkable, nearestWalkable, navigationStats } from './navigation.js';

const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const data = window.ROOM_DATA;
const scene = $('#scene');
const farmPlots = initFarmPlots(data.farm.plots);
let ctl, route = [], goal = null, walkId = 0, waiting = 2.5, auto = true, paused = false, scale = 1, pace = 1.3;
const guidanceTimeoutMs = 3000;
let resumeFreeActivityTimer;
let bubbleTime = 0, activeStep = false, nextStep = false, lastTime = 0, elapsed = 0, failed = false;
const masks = [];
const svgNode = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); return el; };
const setHidden = (el,on) => on ? el.setAttribute('hidden','') : el.removeAttribute('hidden');
const position = () => ({ x:ctl.pet.x, y:ctl.pet.gy });
const bedside = { x: 1280, y: 1555 };
const mattress = { x: 1525, y: 1320 };
const besideDeskChair = { x: 792, y: 1355 };
const [seatX, seatY] = data.deskSeat.room.seat;
const chairSeat = { x: seatX, y: seatY };
// Foot anchors on the walkable floor, the two steps, and the window cushion.
const windowSteps = [{x:960,y:1082}, {x:960,y:937}, {x:885,y:865}, {x:752,y:800}];
const windowSeat = windowSteps.at(-1);
let perchState = 'ground';
let perchProgress = 0;
const cushionShadow = svgNode('ellipse', {cx:windowSeat.x, cy:windowSeat.y,
  transform:'rotate(-24 752 800)', fill:'#314b74', opacity:0.18, 'pointer-events':'none'});
$('#shadow').before(cushionShadow);
setHidden(cushionShadow, true);
const actor = $('#actor');
let deskLoop;
// Draw the light above the furniture foreground and below the speech bubble.
const furnitureFlash = createAtlasPlayer(scene, {
  ...data.furnitureFlash, image: data.images[data.furnitureFlash.atlasImage],
  // The bright whale emblem is centered around x=158 inside the transparent frames.
  anchor: [158, 208],
});
furnitureFlash.element.id = 'furniture-flash';
$('#bubble').before(furnitureFlash.element);
const roomPlaces = {
  rug: { point: SPAWN, walking: '正走向地毯', staying: '在地毯上休息' },
  window: { point: windowSteps[0], walking: '去窗边看天', staying: '坐在跳台上看天' },
  desk: { point: besideDeskChair, walking: '正走向书桌', staying: '正在用电脑' },
};
const farmPlaces = {
  field: { point: data.farm.navigation.waypoints.find(point => point.id === 'field'), walking: '去田边看看', staying: '在田边看菜园' },
  pond: { point: data.farm.navigation.waypoints.find(point => point.id === 'pond'), walking: '去池边看水', staying: '在池边看天' },
  rest: { point: data.farm.navigation.waypoints.find(point => point.id === 'rest'), walking: '找个地方歇歇', staying: '在农场歇一会儿' },
};
let places = roomPlaces;
let activity = null;
let previousActivity = null;
const roomHint = $('#hint').textContent;
const farmHint = '点土地选地块，点小路指路';
let defaultHint = roomHint;
let deskState = 'idle';
const bedLabels = {
  approaching: '正走向床边',
  flashing: '鲸光闪烁',
  sleeping: '在床上睡觉',
  leaving: '正在下床',
};
let bedState = 'idle';
let afterFurnitureExit = null;

const roomPeriods = {
  day: { label: '白天', image: 'scene/composite.png', sky: '#f3f7fc' },
  dusk: { label: '黄昏', image: 'time-scenes/dusk.png', sky: '#ecdfe6' },
  dawn: { label: '凌晨', image: 'time-scenes/dawn.png', sky: '#222c48' },
};
const farmPeriods = {
  day: { label: '白天', sky: '#f2f6fb' },
  dusk: { label: '傍晚', sky: '#f3e4e2' },
  dawn: { label: '晚上', sky: '#27314e' },
};
let farmArt;
let locationId = 'room';
const sceneScale = () => locationId === 'farm' ? 0.55 : 1;
const petScale = () => scale * sceneScale();
let sceneMode = 'auto';
let scenePeriod;
let shenzhenPeriod;
let clockTimer;

const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
let displayedSunDate;

// Fade the original scene paintings across sunrise, sunset and the end of twilight.
function sceneLighting(now, {sunrise, sunset, nightfall}) {
  if (sceneMode === 'auto') {
    const transitions = [
      { at: sunrise, minutes: 25, from: 'dawn', to: 'day' },
      { at: sunset, minutes: 25, from: 'day', to: 'dusk' },
      { at: nightfall, minutes: 15, from: 'dusk', to: 'dawn' },
    ];
    for (const {at, minutes, from, to} of transitions) {
      const half = minutes * 60000;
      if (now >= at - half && now < at + half) {
        return { from, to, mix: (now - at + half) / (2 * half) };
      }
    }
  }
  return { from: scenePeriod, to: scenePeriod, mix: 0 };
}

function paintRoom(from, to, mix) {
  const setImage = (layer, file) => {
    if (layer.dataset.file !== file) {
      layer.setAttribute('href', data.images[file]);
      layer.dataset.file = file;
    }
  };
  setImage($('#room-image'), roomPeriods[from].image);
  const blend = $('#room-blend');
  if (from !== to) setImage(blend, roomPeriods[to].image);
  blend.setAttribute('opacity', mix);
}

function paintScene(now, schedule) {
  const { from, to, mix } = sceneLighting(now, schedule);
  const farm = locationId === 'farm';
  const periods = farm ? farmPeriods : roomPeriods;
  if (farm) {
    farmArt ??= initFarmArt(scene, data.farm, data.images);
    farmArt.setLighting(from, to, mix);
  } else {
    paintRoom(from, to, mix);
  }
  const panel = $('.room-panel');
  panel.dataset.sky = scenePeriod;
  panel.style.backgroundColor = `color-mix(in srgb, ${periods[from].sky}, ${periods[to].sky} ${mix * 100}%)`;
}

function refreshRoomPeriod() {
  clearTimeout(clockTimer);
  const now = new Date();
  const schedule = shenzhenSunSchedule(now);
  const { dateKey, sunrise, sunset, nightfall, nextMidnight } = schedule;
  if (displayedSunDate !== dateKey) {
    for (const [id, time] of [['sunrise', sunrise], ['sunset', sunset], ['nightfall', nightfall]]) {
      $('#solar-' + id).textContent = beijingTime.format(time);
    }
    displayedSunDate = dateKey;
  }
  if (now < sunrise || now >= nightfall) shenzhenPeriod = 'dawn';
  else if (now < sunset) shenzhenPeriod = 'day';
  else shenzhenPeriod = 'dusk';
  scenePeriod = sceneMode === 'auto' ? shenzhenPeriod : sceneMode;
  const { label } = (locationId === 'farm' ? farmPeriods : roomPeriods)[scenePeriod];
  paintScene(now.getTime(), schedule);
  const status = sceneMode === 'auto' ? `自动 · ${label}` : `手动 · ${label}`;
  const output = $('#scene-period-status');
  if (output.textContent !== status) output.textContent = status;
  const nextEvent = [sunrise, sunset, nightfall, nextMidnight].find(time => time > now);
  // Wake at the actual event and also catch changes to the device clock.
  clockTimer = setTimeout(refreshRoomPeriod, Math.min(10000, nextEvent - now.getTime()));
}

function initRoomPeriods() {
  const buttons = document.querySelectorAll('[data-scene-mode]');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      sceneMode = button.dataset.sceneMode;
      for (const option of buttons) {
        option.setAttribute('aria-pressed', String(option === button));
      }
      refreshRoomPeriod();
    });
  }
  window.addEventListener('pageshow', refreshRoomPeriod);
  window.addEventListener('focus', refreshRoomPeriod);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshRoomPeriod();
  });
  refreshRoomPeriod();
}

function setStatus() {
  if (!ctl) return;
  const ordinaryStatus = ctl.pet.mode === 'sit' ? '坐下来休息' : activeStep ? (locationId === 'farm' ? '在菜园里散步' : '在房间里散步') : auto ? (locationId === 'farm' ? '看看这片菜园' : '看看这间小屋') : '等你指路';
  const deskStatus = { working: '正在用电脑', approaching: '正走向书桌', flashing: '鲸光闪烁', leaving: '正在离座' }[deskState];
  const activityStatus = activity && places[activity.id][activity.phase];
  const perchStatus = { ascending:'正跳上窗边平台', watching:'坐在跳台上看天', descending:'正在跳下平台' }[perchState];
  const status = paused ? '暂停中' : bedLabels[bedState] || deskStatus || perchStatus || activityStatus || ordinaryStatus;
  if ($('#status').textContent !== status) $('#status').textContent = status;
  $('#pause').textContent = paused ? '▷ 继续' : 'Ⅱ 暂停';
}
function say(text, seconds=2.6) {
  if (furnitureFlash.frame !== null) return;
  if (bedState === 'sleeping') {
    text = '呼…… Zzz';
    seconds = Infinity;
  } else if (deskState === 'working') {
    text = '正在用电脑';
    seconds = Infinity;
  }
  $('#bubble text').textContent = text;
  bubbleTime = seconds;
  setHidden($('#bubble'),false);
}
function showWalkMode(on) {
  auto = on;
  $('#auto').classList.toggle('selected',auto);
  $('#manual').classList.toggle('selected',!auto);
  $('#auto').setAttribute('aria-pressed',String(auto));
  $('#manual').setAttribute('aria-pressed',String(!auto));
  setStatus();
}
function setMode(on) {
  clearTimeout(resumeFreeActivityTimer);
  if (activity && activity.id !== 'desk') clearBubble();
  activity = null;
  waiting = 1.2;
  showWalkMode(on);
  if (!on) {
    resumeFreeActivityTimer = setTimeout(() => {
      // Let the current route or furniture interaction reach its destination.
      if (deskState === 'idle' && bedState === 'idle') waiting = 0;
      showWalkMode(true);
    }, guidanceTimeoutMs);
  }
}
function clearRoute() {
  route=[]; activeStep=false; nextStep=false; goal=null;
  ctl?.stopWalk(walkId);
  $('#route-line').setAttribute('d','');
  setHidden($('#destination'),true);
}
function updateRoute() {
  const points=[position(),...route];
  $('#route-line').setAttribute('d', points.length>1 ? points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : '');
  $('#route-line').style.display=$('#debug').checked ? '' : 'none';
}
function startStep() {
  if (!route.length) {
    activeStep = false;
    goal = null;
    waiting = 2.4 + Math.random()*2.6;
    setHidden($('#destination'), true);
    $('#route-line').setAttribute('d', '');
    if (bedState === 'approaching') beginFurnitureEntry('bed');
    else if (deskState === 'approaching') beginFurnitureEntry('desk');
    else if (activity?.phase === 'walking') beginStay();
    setStatus();
    return;
  }
  const target=route[0];
  const id=++walkId;
  activeStep=true;
  if(!ctl.walkTo(target.x,false,id,target.y)){nextStep=true;activeStep=false;}
  updateRoute();setStatus();
}
function walkOnFloor(point) {
  if(!ctl||failed)return false;
  clearRoute();
  ctl.doWord('stand');
  route=findPath(position(),point);
  if(!route.length){say('这里就很好呀');setStatus();return false;}
  goal={...route.at(-1)};
  $('#destination').setAttribute('transform',`translate(${goal.x} ${goal.y})`);
  setHidden($('#destination'),Boolean(activity) && !$('#debug').checked);
  startStep();
  return true;
}

function clearBubble() {
  bubbleTime = 0;
  setHidden($('#bubble'), true);
}

function placePet(x, y) {
  Object.assign(ctl.pet, { x, gy: y, fy: y, target: x, targetY: y, speed: 0 });
}

function startClimbing() {
  clearRoute();
  ctl.standImmediately();
  ctl.pet.facing = -1;
  perchProgress = 0;
  perchState = 'ascending';
  if (activity) activity.phase = 'climbing';
  clearBubble();
  setStatus();
}

function advancePerch(seconds) {
  if (perchState !== 'ascending' && perchState !== 'descending') return;
  const up = perchState === 'ascending';
  const top = windowSteps.length - 1;
  perchProgress = Math.max(0, Math.min(top, perchProgress + seconds * (up ? 1 : -1) / 0.52));
  const i = Math.min(Math.floor(perchProgress), top - 1);
  const t = perchProgress - i;
  const a = windowSteps[i], b = windowSteps[i + 1];
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t - 4 * t * (1 - t) * 52;
  placePet(x, y);
  if (up && perchProgress === top) {
    perchState = 'watching';
    ctl.pet.facing = -1;
    ctl.doWord('sit');
    if (activity) activity.phase = 'staying';
    say('看看窗外的天色');
    $('#hint').textContent = '点地面，叫她跳下来';
  } else if (!up && perchProgress === 0) {
    perchState = 'ground';
    $('#hint').textContent = defaultHint;
    const next = afterFurnitureExit;
    afterFurnitureExit = null;
    next?.();
  }
  setStatus();
}

function onWindowCushion({x,y}) {
  // The seat follows the left wall. Its central stitched seam runs diagonally.
  const a = {x:669,y:830}, b = {x:835,y:765};
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = Math.max(0, Math.min(1, ((x-a.x)*dx + (y-a.y)*dy) / (dx*dx+dy*dy)));
  return Math.hypot(x-a.x-t*dx, y-a.y-t*dy) <= 21;
}

function requestWindowSeat() {
  setMode(false);
  paused = false;
  if (perchState === 'ascending' || perchState === 'watching') return;
  onFloor(() => {
    const p = windowSteps[0];
    activity = {id:'window', phase:'walking', remaining:2.5};
    if (Math.hypot(ctl.pet.x-p.x, ctl.pet.gy-p.y) <= 2) startClimbing();
    else if (!walkOnFloor(p)) activity = null;
  });
}

function showFurnitureFlash(point) {
  clearBubble();
  setHidden(actor, true);
  ctl.pet.emitAt = Infinity;
  furnitureFlash.show(point.x, point.y, scale);
  $('#hint').textContent = '鲸光闪烁';
  setStatus();
}

function beginFurnitureEntry(id) {
  const desk = id === 'desk';
  const point = desk ? besideDeskChair : bedside;
  if (desk) deskState = 'flashing';
  else bedState = 'flashing';
  placePet(point.x, point.y);
  ctl.pet.facing = desk ? -1 : 1;
  ctl.doWord(desk ? 'sit' : 'sleep');
  showFurnitureFlash(point);
}

function beginFurnitureExit() {
  const desk = deskState === 'working';
  if (desk) {
    deskState = 'leaving';
    displayDeskLoop(false);
  } else {
    bedState = 'leaving';
    ctl.pet.facing = -1;
  }
  ctl.standImmediately();
  showFurnitureFlash(desk ? chairSeat : mattress);
}

function revealActor() {
  ctl.pet.emitAt = 0;
  setHidden(actor, false);
}

function advanceFurnitureFlash(seconds) {
  furnitureFlash.step(seconds);
  if (furnitureFlash.frame !== null) return;
  revealActor();
  if (deskState === 'leaving' || bedState === 'leaving') {
    const floorPoint = deskState === 'leaving' ? besideDeskChair : bedside;
    placePet(floorPoint.x, floorPoint.y);
    ctl.render(false); // Queued gestures can now emit at the new floor position.
    deskState = bedState = 'idle';
    $('#hint').textContent = defaultHint;
    const action = afterFurnitureExit;
    afterFurnitureExit = null;
    action();
  } else if (deskState === 'flashing') {
    placePet(chairSeat.x, chairSeat.y);
    deskState = 'working';
    displayDeskLoop(true);
    if (activity?.id === 'desk') activity.phase = 'staying';
    say('正在用电脑', Infinity);
    $('#hint').textContent = '点地面，叫她离开书桌';
  } else {
    placePet(mattress.x, mattress.y);
    bedState = 'sleeping';
    say('呼…… Zzz', Infinity);
    $('#hint').textContent = '点地面，叫她起床';
  }
  setStatus();
}

function cancelFurnitureFlash() {
  if (furnitureFlash.frame === null) return;
  furnitureFlash.hide();
  afterFurnitureExit = null;
  bedState = deskState = 'idle';
  revealActor();
  ctl.doWord('stand');
  $('#hint').textContent = defaultHint;
}

function onChair() {
  return deskState === 'working' || deskState === 'leaving';
}

function displayDeskLoop(working) {
  actor.classList.toggle('desk-working', working);
  if (working) deskLoop.show(chairSeat.x, chairSeat.y, scale);
  else deskLoop.hide();
}

function beginStay() {
  if (activity.id === 'window') {
    startClimbing();
    return;
  }
  if (activity.id === 'desk') {
    beginFurnitureEntry('desk');
    return;
  }
  activity.phase = 'staying';
  ctl.doWord(locationId === 'farm' && activity.id !== 'rest' ? 'look' : 'sit');
  say(locationId === 'farm' ? places[activity.id].staying : '在地毯上歇一会儿');
  setStatus();
}

function chooseNextActivity() {
  clearBubble();
  const next = chooseActivity(shenzhenPeriod, previousActivity, Math.random, locationId);
  previousActivity = next.id;
  activity = { ...next, phase: 'walking', remaining: next.duration };
  const target = places[next.id].point;
  if (Math.hypot(ctl.pet.x - target.x, ctl.pet.gy - target.y) <= 2) {
    beginStay();
  } else if (walkOnFloor(target)) {
    if (next.id === 'desk') deskState = 'approaching';
    setStatus();
  } else {
    activity = null;
    waiting = 2;
  }
}

function advanceFreeActivity(seconds) {
  if (!auto || bedState === 'leaving' || deskState === 'leaving' || perchState === 'descending') return;
  if (activity) {
    if (activity.phase !== 'staying') return;
    activity.remaining = Math.max(0, activity.remaining - seconds);
    if (activity.remaining === 0) {
      activity = null;
      onFloor(chooseNextActivity);
    }
  } else if (!activeStep && !nextStep && furnitureFlash.frame === null && perchState !== 'ascending') {
    waiting -= seconds;
    if (waiting <= 0) onFloor(chooseNextActivity);
  }
}

function requestFurniture(id) {
  const desk = id === 'desk';
  const state = desk ? deskState : bedState;
  setMode(false);
  if (state !== 'idle' && state !== 'leaving') {
    if (goal) setHidden($('#destination'),false);
    return;
  }
  paused = false;
  const point = desk ? besideDeskChair : bedside;
  onFloor(() => {
    clearBubble();
    if (Math.hypot(ctl.pet.x - point.x, ctl.pet.gy - point.y) <= 2) {
      clearRoute();
      beginFurnitureEntry(id);
    } else if (walkOnFloor(point)) {
      if (desk) deskState = 'approaching';
      else bedState = 'approaching';
      $('#hint').textContent = desk ? '去书桌用电脑' : '去床上睡一会儿';
      setStatus();
    }
  });
}

// While leaving, replace the queued floor command without restarting the flash.
function onFloor(action) {
  if (perchState !== 'ground') {
    afterFurnitureExit = action;
    if (perchState !== 'descending') {
      clearBubble();
      ctl.standImmediately();
      ctl.pet.facing = 1;
      perchState = 'descending';
      setStatus();
    }
    return true;
  }
  if (deskState === 'leaving' || bedState === 'leaving') {
    afterFurnitureExit = action;
    return true;
  }
  if (deskState === 'working' || bedState === 'sleeping') {
    afterFurnitureExit = action;
    beginFurnitureExit();
    return true;
  }
  cancelFurnitureFlash();
  deskState = bedState = 'idle';
  return action();
}

function walkTo(point, manual = false) {
  if (manual) {
    setMode(false);
    paused = false;
  }
  return onFloor(() => walkOnFloor(point));
}
// Front-most ground contact at this x, not the image's rectangle. This follows
// the diagonal bed/desk edges and keeps the pet in front when it passes beside them.
function frontY(poly,x) {
  const min=Math.min(...poly.map(p=>p[0])),max=Math.max(...poly.map(p=>p[0]));
  x=Math.max(min+.01,Math.min(max-.01,x));
  const ys=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    if((a[0]<=x&&b[0]>=x)||(b[0]<=x&&a[0]>=x)){
      if(a[0]===b[0])ys.push(a[1],b[1]);
      else ys.push(a[1]+(x-a[0])/(b[0]-a[0])*(b[1]-a[1]));
    }
  }
  return Math.max(...ys);
}
function updateOcclusion() {
  const p=position();
  if (locationId === 'farm') farmArt.update(p);
  const seated = onChair();
  $('#shadow').style.opacity = seated || perchState !== 'ground' ? '0' : '';
  setHidden(cushionShadow, perchState !== 'watching');
  cushionShadow.setAttribute('rx', 41 * scale);
  cushionShadow.setAttribute('ry', 7 * scale);
  for(const m of masks) {
    const aboveBed = m.id === 'bed' && (bedState === 'sleeping' || bedState === 'leaving');
    // On the cushion only the chair's near-side parts cover the whale.
    // The desk is behind the seat even though the raised anchor overlaps its footprint.
    const atDesk = seated && (m.id === 'desk' || m.id === 'chair');
    const front = locationId === 'room' && !aboveBed && !atDesk && p.y < frontY(m.polygon,p.x);
    if(front!==m.visible){m.el.setAttribute('visibility',front?'visible':'hidden');m.visible=front;}
  }
  $('#bubble').setAttribute('transform',`translate(${p.x} ${p.y-280*petScale()}) scale(${sceneScale()})`);
}
function drawDebug() {
  const g=$('#nav-debug');
  g.replaceChildren();
  g.append(svgNode('polygon',{points:FLOOR.map(p=>p.join(',')).join(' '),fill:'#93cbb3','fill-opacity':.12,stroke:'#71ad94','stroke-width':3}));
  for(const o of OBSTACLES){
    g.append(svgNode('polygon',{points:o.polygon.map(p=>p.join(',')).join(' '),fill:'#cd8798','fill-opacity':.19,stroke:'#bb7c92','stroke-width':3}));
  }
  for(const p of WAYPOINTS) g.append(svgNode('circle',{cx:p.x,cy:p.y,r:5,fill:'#6293be'}));
}
function eventPoint(event) {
  return new DOMPoint(event.clientX,event.clientY).matrixTransform(scene.getScreenCTM().inverse());
}
function greet(action) {
  if(!ctl)return;
  activity = null;
  paused = false;
  return onFloor(() => greetOnFloor(action));
}
function greetOnFloor(action) {
  paused=false;clearRoute();
  ctl.doWord('stand');
  if(action==='love'){ctl.setExpr('love',3);ctl.emitHeart();say('有你在，真好 ♡');}
  else if(action==='wave'){ctl.doWord('wave');say('嗨，今天也请多关照');}
  else {ctl.doWord('sit');say('一起歇一会吧');}
  waiting=action==='sit'?10:5;
  setStatus();
}

function resetPet() {
  farmPlots.clear();
  activity = null;
  previousActivity = null;
  perchState = 'ground';
  perchProgress = 0;
  afterFurnitureExit = null;
  cancelFurnitureFlash();
  deskState = bedState = 'idle';
  displayDeskLoop(false);
  revealActor();
  clearBubble();
  clearRoute();
  // A fresh controller also clears the seated/sleeping pose when travel is paused.
  const figure = ctl.figure;
  figure.reset();
  $('#effects').replaceChildren();
  ctl = createScenePet(figure);
  ctl.render();
  waiting = 2.5;
  $('#hint').textContent = defaultHint;
  updateOcclusion();
  setStatus();
}

function createScenePet(figure) {
  return createPet({petG:$('#pet'),shadowEl:$('#shadow'),fxG:$('#effects')},{
    figure,
    bounds:()=>({
      W:locationId === 'farm' ? data.farm.width : data.scene.width,
      H:locationId === 'farm' ? data.farm.height : data.scene.height,
      floorY:locationId === 'farm' ? data.farm.height : 1830,
      S:petScale(),
    }),
    startX:SPAWN.x,startY:SPAWN.y,ground:'free',roam:'off',sfx:{play(){}},
    onEvent(kind,detail){
      if(kind==='arrived'&&detail.walkId===walkId){route.shift();activeStep=false;nextStep=true;}
    },
  });
}

function changeLocation(destination) {
  if (destination === locationId) return;
  locationId = destination;
  const farm = locationId === 'farm';
  configureNavigation(farm ? data.farm.navigation : ROOM_NAVIGATION);
  places = farm ? farmPlaces : roomPlaces;
  defaultHint = farm ? farmHint : roomHint;
  scene.setAttribute('viewBox', farm ? data.farm.viewBox.join(' ') : '80 110 1880 1790');
  scene.setAttribute('aria-label', defaultHint);
  scene.setAttribute('role', farm ? 'group' : 'img');
  setHidden($('#farm-plots'), !farm);
  setHidden($('#farm-art'), !farm);
  setHidden($('#scene-art'), farm);
  $('.room-panel').setAttribute('aria-label', farm ? '大肥鱼的菜园' : '蓝白鲸语房间');
  $('.room-panel').classList.toggle('farm-scene', farm);
  $('#location-label').textContent = farm ? '大肥鱼的菜园' : '她的小房间';
  $('#travel').textContent = farm ? '回房间' : '去农场';
  $('#reset').textContent = farm ? '↺ 回到入口' : '↺ 回到地毯';
  for (const button of document.querySelectorAll('[data-scene-mode]')) {
    if (button.dataset.sceneMode !== 'auto') {
      button.textContent = (farm ? farmPeriods : roomPeriods)[button.dataset.sceneMode].label;
    }
  }
  refreshRoomPeriod();
  resetPet();
  drawDebug();
}

async function init() {
  initRoomClock();
  initRoomPeriods();
  const [hitFurniture, hitDeskPet, deskFrames] = await Promise.all([
    createFurnitureHitTest(data.scene, data.images), createDeskPetHitTest(data), loadDeskFrames(),
  ]);
  deskLoop = createDeskLoop(actor, deskFrames);
  deskLoop.element.id = 'desk-loop';
  const hitPet = p => furnitureFlash.frame === null &&
    (deskState === 'working' ? hitDeskPet(p, deskLoop.frame, scale) : ctl.hitPet(p));
  $('#avatar').src=data.images['avatar.png'];
  for(const f of data.scene.furniture){
    const shape=OBSTACLES.find(o=>o.id===f.id);
    const el=svgNode('image',{x:f.x,y:f.y,width:f.width,height:f.height,href:data.images[`scene/${f.file}`],filter:'url(#black-alpha)'});
    $('#occluders').append(el);masks.push({id:f.id,el,polygon:shape.polygon,visible:null});
    if (f.id === 'chair') {
      const bounds = { x: f.x, y: f.y, width: f.width, height: f.height };
      const front = svgNode('mask', { ...bounds, id: 'seated-chair-front',
        maskUnits: 'userSpaceOnUse', style: 'mask-type:alpha' });
      front.append(svgNode('image', { ...bounds, href: data.images['scene/chair-front.png'] }));
      scene.querySelector('defs').append(front);
    }
  }
  drawDebug();
  const loadFigure = () => createWhaleFigure(new URL('.',location.href),{
    kit:{createRig},model:data.model,scheme:'deepseek-maid',asset:p=>data.images[`whale/${p}`]
  });
  const figure = await loadFigure();
  ctl=createScenePet(figure);
  ctl.render();updateOcclusion();setStatus();
  const preview = initMotionPreview(loadFigure, deskFrames);
  const roomMap = initRoomMap({
    getLocation: () => locationId,
    travelTo: destination => { if (!preview.motion) changeLocation(destination); },
  });
  $('#loading').hidden=true;
  scene.addEventListener('pointermove', event => {
    const p = eventPoint(event);
    scene.style.cursor = (locationId === 'room' && (hitFurniture(p) || onWindowCushion(p))) || hitPet(p) ? 'pointer' : '';
  });
  scene.addEventListener('click',event=>{
    if (preview.motion) return;
    farmPlots.clear();
    const p=eventPoint(event);
    const furniture = locationId === 'room' && hitFurniture(p);
    if (furniture && masks.find(mask => mask.id === furniture).visible) {
      requestFurniture(furniture);
      return;
    }
    if(hitPet(p)){greet('wave');return;}
    if(locationId === 'room' && onWindowCushion(p)){requestWindowSeat();return;}
    if (furniture) { requestFurniture(furniture); return; }
    // Clicks on walls and the page margins are not floor commands.
    if(locationId === 'room' && (p.y<990||p.y>1840||p.x<150||p.x>1900)){say('点一下房间里的地面吧');return;}
    const snapped=nearestWalkable(p);
    const snapDistance = locationId === 'farm' ? 55 : 160;
    if(!snapped||Math.hypot(p.x-snapped.x,p.y-snapped.y)>snapDistance){say(locationId === 'farm' ? '沿着小路走吧' : '那里放着家具呢');return;}
    walkTo(snapped,true);
    if(!isWalkable(p))$('#hint').textContent=locationId === 'farm' ? '走到旁边的小路上' : '目标在家具附近，走到旁边的空地';
    else $('#hint').textContent='收到，这就过去';
  });
  function changeWalkMode(on) {
    if (on && auto && activity) return;
    setMode(on);
    paused = false;
    onFloor(() => {
      clearRoute();
      ctl.doWord('stand');
      $('#hint').textContent = defaultHint;
      setStatus();
    });
  }
  $('#auto').onclick = () => changeWalkMode(true);
  $('#manual').onclick = () => changeWalkMode(false);
  $('#pause').onclick=()=>{paused=!paused;setStatus();};
  $('#travel').disabled = false;
  $('#travel').onclick = () => {
    if (!preview.motion) roomMap.goTo(locationId === 'room' ? 'farm' : 'room');
  };
  $('#reset').onclick=()=>{
    paused = false;
    resetPet();
    say(locationId === 'farm' ? '回到菜园入口啦' : '回到最喜欢的地毯上');
  };
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>greet(b.dataset.action));
  $('#speed').oninput=e=>{pace=Number(e.target.value);$('#speed-value').textContent=pace<1?'慢慢来':pace<1.6?'悠闲':'轻快';};
  $('#scale').oninput = e => {
    scale = Number(e.target.value);
    $('#scale-value').textContent = `${Math.round(scale * 100)}%`;
    ctl.resize();
    if (deskState === 'working') displayDeskLoop(true);
    if (furnitureFlash.frame !== null) furnitureFlash.show(ctl.pet.x, ctl.pet.gy, scale);
    ctl.render(deskState !== 'working');
    updateOcclusion();
  };
  $('#debug').onchange=()=>{
    setHidden($('#nav-debug'),!$('#debug').checked);
    if (activity?.phase === 'walking' && goal) setHidden($('#destination'),!$('#debug').checked);
    updateRoute();
  };
  $('#focus').onclick=()=>{$('.app').classList.toggle('focused');};
  scene.addEventListener('keydown',e=>{
    if (preview.motion) return;
    if(e.code==='Space'){e.preventDefault();paused=!paused;setStatus();}
    const delta={ArrowLeft:[-130,0],ArrowRight:[130,0],ArrowUp:[0,-95],ArrowDown:[0,95]}[e.key];
    if(delta){e.preventDefault();const origin = perchState !== 'ground' ? windowSteps[0] : onChair() ? besideDeskChair : bedState === 'idle' || bedState === 'approaching' ? position() : bedside;walkTo({x:origin.x+delta[0],y:origin.y+delta[1]},true);}
  });
  document.addEventListener('visibilitychange',()=>{lastTime=0;});
  // A read-only snapshot plus explicit local commands keep the demo inspectable.
  window.roomDemo={
    snapshot:()=>({ready:true,location:locationId,selectedPlot:farmPlots.selectedId,position:position(),mode:ctl.pet.mode,bedState,deskState,perchState,deskLoopFrame:deskLoop.frame,furnitureFlashFrame:furnitureFlash.frame,auto,paused,activity:activity && {...activity},goal,route:route.map(p=>({...p})),scale,pace,sceneMode,scenePeriod,shenzhenPeriod,previewMotion:preview.motion,previewMode:preview.mode,previewDeskLoopFrame:preview.deskLoopFrame,walkable:isWalkable(position()),occludedBy:masks.filter(m=>m.visible).map(m=>m.id)}),
    goTo:(x,y)=>walkTo({x,y},true),greet,stats:navigationStats,
    setAuto:on=>changeWalkMode(!!on),pause:on=>{paused=!!on;setStatus();}
  };
  function frame(now){
    const seconds = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    const dt = Math.min(.04, seconds);
    lastTime = now;
    if (preview.motion && !document.hidden) {
      preview.step(dt, seconds);
    } else if(!paused&&!document.hidden){
      elapsed+=dt;
      const wasFlashing = furnitureFlash.frame !== null;
      if(nextStep){nextStep=false;startStep();}
      // Keep the body's physics stable when the walking tempo is accelerated.
      let advance=dt*pace;while(advance>0){const step=Math.min(advance,1/60);ctl.step(step);advance-=step;}
      deskLoop.step(seconds);
      if (wasFlashing) advanceFurnitureFlash(seconds);
      advancePerch(dt);
      ctl.render(deskState !== 'working');updateOcclusion();
      if(activeStep&&$('#debug').checked)updateRoute();
      if (!wasFlashing) advanceFreeActivity(seconds);
      if(bubbleTime>0){bubbleTime-=dt;if(bubbleTime<=0)setHidden($('#bubble'),true);}
      if(Math.floor(elapsed*3)!==Math.floor((elapsed-dt)*3))setStatus();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
init().catch(error=>{
  failed=true;console.error(error);
  $('#loading').innerHTML='<p>角色加载失败</p><p style="font-size:11px;letter-spacing:0">请用 Edge 或 Chrome 打开此文件，并启用浏览器图形加速。</p>';
  $('#status').textContent='加载失败';
  window.roomDemo={snapshot:()=>({ready:false,error:String(error)})};
});
