import { initFarmOcclusion } from './farm-occlusion.js';

export function initFarmArt(scene, farm, images) {
  const defs = scene.querySelector('defs');
  const stacks = document.createDocumentFragment();
  for (const [phase, layers] of Object.entries(farm.layers)) {
    const group = document.createElementNS(scene.namespaceURI, 'g');
    group.id = 'farm-stack-' + phase;
    for (const { id, x, y, width, height } of layers) {
      // Place highlights on the soil, underneath the actual foreground art.
      if (id === 'hydrangea') {
        const highlights = document.createElementNS(scene.namespaceURI, 'use');
        highlights.setAttribute('href', '#farm-plot-highlights');
        group.append(highlights);
      }
      const image = document.createElementNS(scene.namespaceURI, 'image');
      image.id = `farm-${phase}-${id}`;
      image.setAttribute('x', x);
      image.setAttribute('y', y);
      image.setAttribute('width', width);
      image.setAttribute('height', height);
      image.setAttribute('href', images[`farm/layers/${phase}/${id}.png`]);
      group.append(image);
    }
    stacks.append(group);
  }
  defs.append(stacks);

  const base = scene.querySelector('#farm-base');
  const blend = scene.querySelector('#farm-blend');
  const occlusion = initFarmOcclusion(scene, farm);
  function showStack(element, phase, opacity) {
    const href = '#farm-stack-' + phase;
    if (element.getAttribute('href') !== href) element.setAttribute('href', href);
    const weight = String(opacity);
    if (element.getAttribute('opacity') !== weight) element.setAttribute('opacity', weight);
  }
  return {
    setLighting(from, to, mix) {
      showStack(base, from, 1 - mix);
      showStack(blend, to, mix);
      occlusion.setLighting(from, to, mix);
    },
    update: occlusion.update,
  };
}
