const interactiveIds = new Set(['bed', 'desk']);

async function readAlpha(canvas, src, width, height) {
  const sprite = new Image();
  sprite.src = src;
  await sprite.decode();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(sprite, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[4 * i + 3];
  return { width, height, alpha };
}

function alphaAt(mask, x, y) {
  const col = Math.floor(x), row = Math.floor(y);
  if (col < 0 || row < 0 || col >= mask.width || row >= mask.height) return 0;
  return mask.alpha[row * mask.width + col];
}

// Read the alpha channels once, in the same front-to-back order as the PSD.
export async function createFurnitureHitTest(sceneManifest, images) {
  const topFirst = sceneManifest.verification?.layerOrder === 'top-to-bottom';
  const layers = [...sceneManifest.furniture].sort((a, b) =>
    topFirst ? a.index - b.index : b.index - a.index);
  const canvas = document.createElement('canvas');
  const masks = [];

  for (const { id, file, x, y, width, height } of layers) {
    const mask = await readAlpha(canvas, images[`scene/${file}`], width, height);
    masks.push({ id, x, y, ...mask });
  }
  canvas.width = 0;

  return point => {
    let visibility = 1;
    for (const mask of masks) {
      const opacity = alphaAt(mask, point.x - mask.x, point.y - mask.y);
      if (opacity === 0) continue;
      if (interactiveIds.has(mask.id) && visibility * opacity >= 127.5) return mask.id;
      // The chair back can hide a desk pixel even though the chair has no action.
      visibility *= 1 - opacity / 255;
      if (visibility < 0.5) break;
    }
    return null;
  };
}

export async function createDeskPetHitTest({ deskSeat, images }) {
  const { room, portraitFrame, idleLoop, atlasImage } = deskSeat;
  const [seatX, seatY] = room.seat;
  const [anchorX, anchorY] = portraitFrame.seatInCell;
  const [chairX, chairY] = room.chairOrigin;
  const [w, h] = idleLoop.cellSize;
  const { columns, rows, count } = idleLoop;
  const canvas = document.createElement('canvas');
  const chair = await readAlpha(canvas, images['scene/chair-front.png'], ...room.chairSize);
  const atlas = await readAlpha(canvas, images[atlasImage], w * columns, h * rows);
  canvas.width = 0;

  return (point, frame, scale) => {
    if (!Number.isInteger(frame) || frame < 0 || frame >= count || !(scale > 0)) return false;
    const x = Math.floor((point.x - seatX) / scale + anchorX);
    const y = Math.floor((point.y - seatY) / scale + anchorY);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const opacity = alphaAt(atlas, frame % columns * w + x, Math.floor(frame / columns) * h + y);
    const front = alphaAt(chair, point.x - chairX, point.y - chairY);
    return opacity * (1 - front / 255) >= 127.5;
  };
}
