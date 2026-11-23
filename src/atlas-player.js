// The room clock owns playback so pausing or previewing a motion also holds this frame.
export function createAtlasPlayer(parent, { image, frames, columns, rows, cellSize, anchor, durations, loop = false }) {
  const [width, height] = cellSize;
  const [anchorX, anchorY] = anchor;
  const viewport = document.createElementNS(parent.namespaceURI, frames ? 'image' : 'svg');
  if (!frames) {
    const atlas = document.createElementNS(parent.namespaceURI, 'image');
    atlas.setAttribute('href', image);
    atlas.setAttribute('width', width * columns);
    atlas.setAttribute('height', height * rows);
    viewport.setAttribute('overflow', 'hidden');
    viewport.append(atlas);
  }
  viewport.setAttribute('display', 'none');
  viewport.setAttribute('pointer-events', 'none');
  parent.append(viewport);

  let totalMs = 0;
  const frameEnds = durations.map(duration => {
    totalMs += duration;
    return totalMs;
  });
  let timeMs = 0;
  let frame = null;

  function draw(index) {
    if (frame === index) return;
    frame = index;
    if (frames) {
      viewport.setAttribute('href', frames[index].src);
    } else {
      const left = (index % columns) * width;
      const top = Math.floor(index / columns) * height;
      viewport.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
    }
    viewport.dataset.frame = String(index);
  }

  function hide() {
    if (frame === null) return;
    viewport.setAttribute('display', 'none');
    delete viewport.dataset.frame;
    frame = null;
    timeMs = 0;
  }

  return {
    element: viewport,
    get frame() { return frame; },
    show(x, y, scale) {
      viewport.setAttribute('x', x - anchorX * scale);
      viewport.setAttribute('y', y - anchorY * scale);
      viewport.setAttribute('width', width * scale);
      viewport.setAttribute('height', height * scale);
      if (frame === null) {
        draw(0);
        viewport.removeAttribute('display');
      }
    },
    step(seconds) {
      if (frame === null) return;
      timeMs += seconds * 1000;
      // Round sub-microsecond drift at an exact frame boundary.
      const tick = Math.round(timeMs * 1000) / 1000;
      if (!loop && tick >= totalMs) {
        hide();
        return;
      }
      const playhead = loop ? tick % totalMs : tick;
      draw(frameEnds.findIndex(end => playhead < end));
    },
    hide,
  };
}
