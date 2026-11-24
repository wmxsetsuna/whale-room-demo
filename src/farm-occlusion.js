const svgNamespace = 'http://www.w3.org/2000/svg';

// The rectangular PSD crops also contain shadows and pieces of the paving.
// These outlines limit the foreground to the raised wood and flower petals.
const foreground = [
  { layer: 'bed1', footprint: 'bed-north', outline: '598,417 730,360 859,414 859,433 727,499 599,439' },
  { layer: 'bed2', footprint: 'bed-east', outline: '754,490 889,425 1028,483 1028,510 890,581 754,515' },
  { layer: 'bed3', footprint: 'bed-west', outline: '431,493 564,434 697,490 697,513 558,578 431,517' },
  { layer: 'bed4', footprint: 'bed-middle', outline: '589,569 726,502 865,564 865,598 727,667 589,592' },
  { layer: 'bed5', footprint: 'bed-front-west', outline: '273,572 407,515 532,572 532,595 395,662 273,608' },
  { layer: 'bed6', footprint: 'bed-front-east', outline: '423,648 561,583 700,646 700,684 558,752 423,685' },
  { layer: 'hydrangea', footprint: 'west-planter', outline: '276,576 299,562 306,564 312,566 315,571 314,575 309,579 315,585 315,592 311,594 311,603 307,605 300,603 298,609 285,607 276,601' },
  { layer: 'mail', footprint: 'mailbox' },
];

// Compare the feet with the nearest front edge, including beside tall props
// where the figure can overlap their silhouettes before its feet reach them.
function frontEdgeAt(footprint, x) {
  const { points, left, right } = footprint;
  const px = Math.max(left + .001, Math.min(right - .001, x));
  let front = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    if (ax === bx || px < Math.min(ax, bx) || px > Math.max(ax, bx)) continue;
    front = Math.max(front, ay + (by - ay) * (px - ax) / (bx - ax));
  }
  return front;
}

export function initFarmOcclusion(sceneSVG, farmConfig) {
  const defs = sceneSVG.querySelector('defs');
  const mask = sceneSVG.querySelector('#farm-occlusion');
  function append(parent, tag, attrs) {
    const el = sceneSVG.ownerDocument.createElementNS(svgNamespace, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.append(el);
    return el;
  }

  const parts = foreground.map(({ layer, footprint, outline }) => {
    const points = farmConfig.navigation.obstacles.find(o => o.id === footprint).polygon;
    const xs = points.map(([x]) => x);
    const group = append(mask, 'g', { filter: 'url(#black-alpha)', visibility: 'hidden' });
    if (outline) {
      const id = `farm-mask-edge-${layer}`;
      const clip = append(defs, 'clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      append(clip, 'polygon', { points: outline });
      group.setAttribute('clip-path', `url(#${id})`);
    }
    const base = append(group, 'use', {});
    const blend = append(group, 'use', { style: 'mix-blend-mode:plus-lighter', opacity: 0 });
    return { layer, footprint: { points, left: Math.min(...xs), right: Math.max(...xs) }, group, base, blend, visible: false };
  });

  let lastFrom, lastTo, lastMix;
  function setLighting(from, to, mix) {
    if (lastFrom === from && lastTo === to && lastMix === mix) return;
    for (const {layer, base, blend} of parts) {
      if (lastFrom !== from) base.setAttribute('href', `#farm-${from}-${layer}`);
      if (lastTo !== to) blend.setAttribute('href', `#farm-${to}-${layer}`);
      base.setAttribute('opacity', 1 - mix);
      blend.setAttribute('opacity', mix);
    }
    lastFrom = from;
    lastTo = to;
    lastMix = mix;
  }

  let lastX, lastY;
  function update({x, y}) {
    if (lastX === x && lastY === y) return;
    lastX = x;
    lastY = y;
    for (const part of parts) {
      const visible = y < frontEdgeAt(part.footprint, x);
      if (visible !== part.visible) {
        part.group.setAttribute('visibility', visible ? 'visible' : 'hidden');
        part.visible = visible;
      }
    }
  }

  return { setLighting, update };
}
