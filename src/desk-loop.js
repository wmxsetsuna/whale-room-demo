import { createAtlasPlayer } from './atlas-player.js';

// Make each visible image a native-resolution cell, even when the room starts hidden or small.
export async function loadDeskFrames() {
  const { images, deskSeat } = window.ROOM_DATA;
  const { idleLoop, atlasImage } = deskSeat;
  const { columns, rows, count, cellSize: [width, height] } = idleLoop;
  const atlas = new Image();
  atlas.src = images[atlasImage];
  await atlas.decode();
  if (atlas.naturalWidth !== width * columns || atlas.naturalHeight !== height * rows) {
    throw new Error('坐姿图集的像素尺寸与配置不符');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const frames = [];
  try {
    for (let i = 0; i < count; i++) {
      const left = (i % columns) * width;
      const top = Math.floor(i / columns) * height;
      context.clearRect(0, 0, width, height);
      context.drawImage(atlas, left, top, width, height, 0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('无法读取坐姿动画帧');
      const frame = new Image();
      frame.src = URL.createObjectURL(blob);
      frames.push(frame);
      await frame.decode();
    }
    return frames;
  } catch (error) {
    for (const frame of frames) URL.revokeObjectURL(frame.src);
    throw error;
  }
}

export function createDeskLoop(parent, frames) {
  const { idleLoop, portraitFrame } = window.ROOM_DATA.deskSeat;
  return createAtlasPlayer(parent, {
    frames, cellSize: idleLoop.cellSize,
    anchor: portraitFrame.seatInCell,
    durations: Array(idleLoop.count).fill(idleLoop.msPerFrame),
    loop: true,
  });
}
