const spriteRows = ['carrot', 'tomato', 'cabbage', 'strawberry', 'pumpkin', 'blueberry'];
// Each cell in the supplied atlas is 224 × 160. Roots share a baseline
// except for the full cabbage, which sits lower in its frame.
const cellWidth = 224, cellHeight = 160;
const stageScales = [.86, .65, .55];
const plantingOffsets = [
  [],
  [[0, 3]],
  [[32, -13], [-32, 14]],
  [[46, -9], [-45, -5], [2, 23]],
];

export function initFarmCropView(scene, plots, spriteSheet) {
  function append(parent, tag, attrs = {}) {
    const node = scene.ownerDocument.createElementNS(scene.namespaceURI, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.append(node);
    return node;
  }

  const defs = scene.querySelector('defs');
  append(defs, 'image', { id: 'farm-growth-sheet', width: 672, height: 960, href: spriteSheet });
  const crops = append(defs, 'g', { id: 'farm-crops', 'pointer-events': 'none' });
  const shadows = append(crops, 'g', { fill: '#524b39', opacity: .19 });
  const leaves = append(crops, 'g');
  const mask = append(scene.querySelector('#farm-occlusion'), 'g', { filter: 'url(#black-alpha)' });
  const centers = new Map(plots.map(plot => [plot.id, plot.center]));
  let occluders = [], footY;

  function setCrops(planted) {
    const plants = [];
    for (const { plotId, icon, seedId, stage, count } of planted) {
      const center = centers.get(plotId);
      if (!center) continue;
      let row = spriteRows.indexOf(icon);
      if (row < 0) row = spriteRows.indexOf(seedId);
      // Custom varieties can reuse a known icon. Unillustrated varieties
      // grow into a larger, leafy rosette from the same watercolor sheet.
      const generic = row < 0;
      if (generic) row = spriteRows.indexOf('cabbage');
      const column = generic && stage === 3 ? 1 : stage - 1;
      const scale = generic && stage === 3 ? .94 : stageScales[stage - 1];
      for (const [dx, dy] of plantingOffsets[count]) {
        plants.push({ plotId, seedId, stage, row, column, scale, x: center.x + dx, y: center.y + dy });
      }
    }
    plants.sort((a, b) => a.y - b.y);
    shadows.replaceChildren();
    leaves.replaceChildren();
    mask.replaceChildren();
    occluders = plants.map(({ plotId, seedId, stage, row, column, scale, x, y }, index) => {
      append(shadows, 'ellipse', { cx: x, cy: y, rx: 8 * stage, ry: 2 * stage });
      const baseline = row === 2 && column === 2 ? 149 : 138;
      const plant = append(leaves, 'g', {
        id: 'farm-plant-' + index,
        'data-crop-plot': plotId, 'data-seed-id': seedId, 'data-stage': stage,
      });
      const frame = append(plant, 'svg', {
        x: x - cellWidth / 2 * scale, y: y - baseline * scale,
        width: cellWidth * scale, height: cellHeight * scale,
        viewBox: [column * cellWidth, row * cellHeight, cellWidth, cellHeight].join(' '),
        overflow: 'hidden',
      });
      append(frame, 'use', { href: '#farm-growth-sheet' });
      // Referencing a positioned group preserves its scene coordinates in
      // the character mask, including just the painted alpha of the leaves.
      const silhouette = append(mask, 'use', {
        href: '#' + plant.id, visibility: footY < y ? 'visible' : 'hidden',
      });
      return { silhouette, y };
    });
  }

  function update({ y }) {
    if (y === footY) return;
    for (const part of occluders) {
      if ((footY < part.y) !== (y < part.y)) {
        part.silhouette.setAttribute('visibility', y < part.y ? 'visible' : 'hidden');
      }
    }
    footY = y;
  }

  function addToStack(stack, phase) {
    const use = append(stack, 'use', { href: '#farm-crops' });
    // The background PSDs already include their lighting. Apply matching
    // color to the crops inside each stack so twilight blends both together.
    const tint = {
      dusk: '1.01 0 0 0 .025  0 .83 0 0 .035  0 0 .78 0 .06  0 0 0 1 0',
      dawn: '.5 0 0 0 .025  0 .53 0 0 .03  0 0 .73 0 .09  0 0 0 1 0',
    }[phase];
    if (tint) {
      const id = 'farm-crop-light-' + phase;
      const filter = append(defs, 'filter', { id, 'color-interpolation-filters': 'sRGB' });
      append(filter, 'feColorMatrix', { type: 'matrix', values: tint });
      use.setAttribute('filter', 'url(#' + id + ')');
    }
  }
  return { setCrops, update, addToStack };
}
