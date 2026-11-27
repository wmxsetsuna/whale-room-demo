import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { farmOccluders } from '../src/farm-occlusion.js';
import { configureNavigation, findPath, isWalkable, nearestWalkable, segmentWalkable } from '../src/navigation.js';

const farm = JSON.parse(readFileSync(new URL('../assets/farm/scene.json', import.meta.url), 'utf8'));
const upperCrossing = { x: 725, y: 501 };
const lowerCrossing = { x: 560, y: 581 };

// Each pair of connected junctions/entrances and a visible paving stone between them.
const lanes = [
  [upperCrossing, { x: 882, y: 421 }, { x: 840, y: 442 }],
  [upperCrossing, { x: 579, y: 428 }, { x: 609, y: 447 }],
  [upperCrossing, { x: 890, y: 580 }, { x: 849, y: 555 }],
  [upperCrossing, lowerCrossing, { x: 680, y: 520 }],
  [lowerCrossing, { x: 402, y: 511 }, { x: 519, y: 560 }],
  [lowerCrossing, { x: 400, y: 664 }, { x: 511, y: 601 }],
  [lowerCrossing, { x: 727, y: 668 }, { x: 689, y: 640 }],
];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('each aisle connects directly to its crossings in both directions', () => {
  configureNavigation(farm.navigation);
  for (const [a, b, pavingStone] of lanes) {
    assert.deepEqual(nearestWalkable(pavingStone), pavingStone);
    for (const [start, end] of [[a, b], [b, a]]) {
      const path = findPath(start, end);
      const lane = JSON.stringify([start, end]);
      assert.deepEqual(path.at(-1), end, lane);
      let previous = start;
      let length = 0;
      for (const step of path) {
        assert.ok(segmentWalkable(previous, step), lane);
        length += distance(previous, step);
        previous = step;
      }
      // A slight bend around a corner is fine. Circling the raised bed is a regression.
      assert.ok(length < distance(start, end) * 1.08, lane);
    }
  }
  for (const plot of farm.plots) assert.equal(isWalkable(plot.center), false, plot.id);
});

test('each bed covers the whale on its far sides and clears it along both near sides and corners', () => {
  configureNavigation(farm.navigation);
  const occluders = farmOccluders(farm.navigation);
  // Clickable paving beside the two front boards, around a side corner, and behind both back boards.
  const probes = [
    ['bed1', [[791,458],[665,461],[865,416]], [[664,387],[795,385]]],
    ['bed2', [[956,538],[824,540],[1033,493],[850,555]], [[822,456],[959,452]]],
    ['bed3', [[625,537],[497,539],[703,496]], [[498,462],[631,460]]],
    ['bed4', [[794,624],[661,622],[870,581]], [[658,534],[796,531]]],
    ['bed5', [[461,620],[360,638],[538,578]], [[340,542],[470,542]]],
    ['bed6', [[627,710],[493,710],[706,667]], [[492,614],[631,613]]],
  ];
  for (const [layer, inFront, behind] of probes) {
    const { frontAt } = occluders.find(part => part.layer === layer);
    for (const [points, shouldCover] of [[inFront, false], [behind, true]]) {
      for (const [x, y] of points) {
        assert.ok(isWalkable([x, y]), `unreachable probe at ${x},${y}`);
        assert.equal(y < frontAt(x), shouldCover, `${layer} at ${x},${y}`);
      }
    }
  }
});
