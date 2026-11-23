import { createPet, KIT_MOTIONS } from '../vendor/kit/body.js';
import { createDeskLoop } from './desk-loop.js';

const deskMotion = 'desk-seated-loop';

const labels = {
  stand: '站立', jump: '跳跃', hop: '小跳', look: '四处张望', turn: '转身',
  nod: '点头', shake: '摇头', spin: '转圈', sit: '坐下', sleep: '睡觉',
  dizzy: '晕乎乎', walk: '走路', run: '跑步', wave: '挥手', bow: '鞠躬',
  shiver: '发抖', flap: '扑腾', dance: '跳舞',
  [deskMotion]: '书桌椅 · 坐稳循环',
};

function createDeskPreview(stageSvg, { W, floorY }, deskFrames) {
  const { scene, images, deskSeat } = window.ROOM_DATA;
  const chair = scene.furniture.find(item => item.id === 'chair');
  const [seatX, seatY] = deskSeat.room.seat;
  const [x, y, w, h] = deskSeat.portraitFrame.cropInRoom;
  const left = Math.min(chair.x, x), right = Math.max(chair.x + chair.width, x + w);
  const top = Math.min(chair.y, y), bottom = Math.max(chair.y + chair.height, y + h);
  const scale = Math.min(1, (floorY - 40) / (bottom - top), W / (right - left));
  const translateX = (W - scale * (left + right)) / 2;
  const translateY = floorY - scale * bottom;
  const group = document.createElementNS(stageSvg.namespaceURI, 'g');
  group.id = 'preview-desk-loop';
  group.setAttribute('transform', `translate(${translateX} ${translateY}) scale(${scale})`);
  group.style.display = 'none';
  stageSvg.append(group);
  function addChairImage(key) {
    const image = document.createElementNS(stageSvg.namespaceURI, 'image');
    for (const attr of ['x', 'y', 'width', 'height']) image.setAttribute(attr, chair[attr]);
    image.setAttribute('href', images[key]);
    group.append(image);
  }
  addChairImage(`scene/${chair.file}`);
  const loop = createDeskLoop(group, deskFrames);
  addChairImage('scene/chair-front.png');
  return {
    show() { loop.show(seatX, seatY, 1); group.style.display = ''; },
    hide() { loop.hide(); group.style.display = 'none'; },
    step(dt) { loop.step(dt); },
    get frame() { return loop.frame; },
  };
}

export function initMotionPreview(loadFigure, deskFrames) {
  const get = id => document.getElementById(id);
  const select = get('preview-motion');
  const play = get('play-motion');
  const stop = get('stop-motion');
  const stage = get('motion-stage');
  const status = get('motion-preview-status');
  const room = document.querySelector('.room-panel');
  const section = select.closest('.motion-preview');
  const others = [...document.querySelector('.controls').children].filter(el => el !== section);
  const compact = matchMedia('(max-width: 740px)');
  const parts = { petG: get('preview-pet'), shadowEl: get('preview-shadow'), fxG: get('preview-effects') };
  const bounds = () => ({ W: 600, H: 460, floorY: 405, S: 1 });
  const deskPreview = createDeskPreview(parts.petG.ownerSVGElement, bounds(), deskFrames);
  let figurePromise;
  let controller;
  let motion = null;
  let revision = 0;

  const motions = [...KIT_MOTIONS, deskMotion];
  for (const word of motions) select.add(new Option(labels[word] ?? word, word));
  select.value = 'wave';
  const countLabel = motions.length + ' 个动作';
  status.textContent = countLabel;

  function placeStage() {
    const parent = compact.matches ? section : room;
    if (stage.parentElement !== parent) parent.append(stage);
  }
  compact.addEventListener('change', placeStage);
  placeStage();

  function close() {
    revision++;
    motion = null;
    controller = null;
    deskPreview.hide();
    stage.hidden = true;
    stop.hidden = true;
    play.textContent = '播放';
    status.textContent = countLabel;
    for (const el of others) el.inert = false;
    room.classList.remove('previewing');
    get('scene').removeAttribute('inert');
    play.focus({ preventScroll: true });
  }

  async function playMotion() {
    const request = ++revision;
    const word = select.value;
    motion = word;
    controller = null;
    deskPreview.hide();
    for (const element of Object.values(parts)) element.style.display = 'none';
    stage.hidden = false;
    stop.hidden = false;
    play.textContent = '重播';
    get('preview-title').textContent = labels[word] ?? word;
    status.textContent = '准备中';
    for (const el of others) el.inert = true;
    room.classList.add('previewing');
    get('scene').setAttribute('inert', '');

    try {
      if (word === deskMotion) {
        deskPreview.show();
        status.textContent = '预览中';
        return;
      }
      // Keep a single preview figure mounted. Replaying creates only a fresh
      // motion controller, including when the previous body is mid-jump.
      figurePromise ??= loadFigure().catch(error => { figurePromise = null; throw error; });
      const figure = await figurePromise;
      if (request !== revision) return;
      figure.reset();
      parts.fxG.replaceChildren();
      const movingAcross = word === 'walk' || word === 'run';
      controller = createPet(parts, {
        figure, bounds, startX: movingAcross ? 160 : 300, roam: 'off', sfx: { play() {} },
      });
      if (movingAcross) controller.walkTo(440, word === 'run', 1);
      else controller.doWord(word);
      controller.step(1 / 60);
      controller.render();
      for (const element of Object.values(parts)) element.style.display = '';
      status.textContent = '预览中';
    } catch (error) {
      if (request !== revision) return;
      console.error(error);
      close();
      status.textContent = '加载失败，请重试';
    }
  }

  play.addEventListener('click', playMotion);
  select.addEventListener('change', () => { if (motion) playMotion(); });
  stop.addEventListener('click', close);
  get('close-motion-stage').addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (motion && event.key === 'Escape') { event.preventDefault(); close(); }
  });

  return {
    get motion() { return motion; },
    get mode() { return controller?.pet.mode ?? (motion === deskMotion ? deskMotion : null); },
    get deskLoopFrame() { return deskPreview.frame; },
    step(dt, seconds = dt) {
      if (motion === deskMotion) { deskPreview.step(seconds); return; }
      if (!controller) return;
      while (dt > 0) {
        const slice = Math.min(dt, 1 / 60);
        controller.step(slice);
        dt -= slice;
      }
      controller.render();
    },
  };
}
