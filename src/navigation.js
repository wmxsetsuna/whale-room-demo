/**
 * Foot-contact navigation for 蓝白鲸语_右墙书柜版优化.psd.
 * Coordinates are in the original 2048 × 2048 canvas. Furniture polygons
 * describe their floor footprints, so a pet may correctly pass behind art.
 * No generated scene geometry or external navigation dependency is used.
 */
export let CLEARANCE = 20;
export let FLOOR = [[1024, 990], [1886, 1380], [1026, 1813], [158, 1380]];
export let SPAWN = { x: 1000, y: 1390 };

const ellipse = (x, y, rx, ry, count = 20) => Array.from({ length: count }, (_, i) => {
  const a = i * Math.PI * 2 / count;
  return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
});

export let OBSTACLES = [
  { name: '书桌', id: 'desk', polygon: [[305,1290],[792,1080],[895,1135],[405,1355]] },
  { name: '右墙书柜', id: 'bookshelf', polygon: [[1024,980],[1253,1083],[1220,1110],[1020,1014]] },
  // Body-layer offsets from the revised PSD: bed +76,+36; cabinet +143,-48;
  // chair +31,-142; plant -54,+22. The hidden pouf is not a collision object.
  { name: '床', id: 'bed', polygon: [[1204,1486],[1471,1566],[1891,1384],[1618,1252]] },
  { name: '床头柜', id: 'nightstand', polygon: ellipse(1485,1217,78,32) },
  { name: '椅子', id: 'chair', polygon: ellipse(681,1311,104,60) },
  { name: '绿植', id: 'plant', polygon: ellipse(250,1360,45,36) },
];

export let WAYPOINTS = [
  { name: '地毯中央', ...SPAWN },
  { name: '窗边过道', x: 480, y: 1420 },
  { name: '书柜前', x: 1100, y: 1180 },
  { name: '床尾', x: 1280, y: 1555 },
  { name: '前方空地', x: 1003, y: 1664 },
];

export const ROOM_NAVIGATION = {
  clearance: CLEARANCE,
  gridStep: 18,
  floorPolygon: FLOOR,
  obstacles: OBSTACLES,
  waypoints: WAYPOINTS,
  spawn: SPAWN,
  gridBounds: { minX: 170, minY: 970, maxX: 1880, maxY: 1800 },
};

const number = n => { try { return Number(n); } catch { return NaN; } };
const asPoint = p => Array.isArray(p) ? { x: number(p[0]), y: number(p[1]) } : { x: number(p?.x), y: number(p?.y) };
const finite = p => Number.isFinite(p.x) && Number.isFinite(p.y);
const dist2 = (a,b) => (a.x-b.x)**2 + (a.y-b.y)**2;
const xy = p => ({ x:p[0], y:p[1] });
const edges = polygon => polygon.map((p,i) => [xy(p),xy(polygon[(i+1)%polygon.length])]);
let floorEdges = edges(FLOOR);
let obstacleEdges = OBSTACLES.map(o => edges(o.polygon));
let margin2 = CLEARANCE * CLEARANCE;

function inside(p, polygon) {
  let hit = false;
  for (let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
    const [xi,yi] = polygon[i], [xj,yj] = polygon[j];
    if ((yi>p.y)!==(yj>p.y) && p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}

function pointSegmentDistance2(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
  const t=l ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)) : 0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
}

const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersects(a,b,c,d) {
  const a1=cross(a,b,c),a2=cross(a,b,d),b1=cross(c,d,a),b2=cross(c,d,b);
  if (((a1>0&&a2<0)||(a1<0&&a2>0)) && ((b1>0&&b2<0)||(b1<0&&b2>0))) return true;
  const eps=1e-8;
  return (Math.abs(a1)<eps && pointSegmentDistance2(c,a,b)<eps) ||
    (Math.abs(a2)<eps && pointSegmentDistance2(d,a,b)<eps) ||
    (Math.abs(b1)<eps && pointSegmentDistance2(a,c,d)<eps) ||
    (Math.abs(b2)<eps && pointSegmentDistance2(b,c,d)<eps);
}

function segmentDistance2(a,b,c,d) {
  if (intersects(a,b,c,d)) return 0;
  return Math.min(pointSegmentDistance2(a,c,d),pointSegmentDistance2(b,c,d),
    pointSegmentDistance2(c,a,b),pointSegmentDistance2(d,a,b));
}

/** Whether the pet's foot anchor has the active scene's clearance from solid geometry. */
export function isWalkable(point) {
  const p=asPoint(point);
  if (!finite(p)||!inside(p,FLOOR)) return false;
  if (floorEdges.some(([a,b])=>pointSegmentDistance2(p,a,b)<margin2)) return false;
  for (let i=0;i<OBSTACLES.length;i++) {
    if (inside(p,OBSTACLES[i].polygon)) return false;
    if (obstacleEdges[i].some(([a,b])=>pointSegmentDistance2(p,a,b)<margin2)) return false;
  }
  return true;
}

/** Exact line-of-sight clearance, also used to reject diagonal corner cutting. */
export function segmentWalkable(from,to) {
  const a=asPoint(from),b=asPoint(to);
  if (!isWalkable(a)||!isWalkable(b)) return false;
  // Check floor edges as well so a concave outdoor boundary cannot be cut across.
  if (floorEdges.some(([c,d]) => segmentDistance2(a,b,c,d)<margin2)) return false;
  for (const outline of obstacleEdges) {
    for (const [c,d] of outline) if (segmentDistance2(a,b,c,d)<margin2) return false;
  }
  return true;
}

let gridStep = ROOM_NAVIGATION.gridStep;
let gridBounds = ROOM_NAVIGATION.gridBounds;
let graph=null;

/** Replace the active scene geometry and invalidate its derived navigation data. */
export function configureNavigation(config = ROOM_NAVIGATION) {
  CLEARANCE = config.clearance ?? ROOM_NAVIGATION.clearance;
  margin2 = CLEARANCE * CLEARANCE;
  gridStep = config.gridStep ?? ROOM_NAVIGATION.gridStep;
  FLOOR = config.floorPolygon;
  OBSTACLES = config.obstacles;
  WAYPOINTS = config.waypoints;
  SPAWN = config.spawn;
  floorEdges = edges(FLOOR);
  obstacleEdges = OBSTACLES.map(o => edges(o.polygon));
  gridBounds = config.gridBounds ?? {
    minX: Math.min(...FLOOR.map(point => point[0])),
    minY: Math.min(...FLOOR.map(point => point[1])),
    maxX: Math.max(...FLOOR.map(point => point[0])),
    maxY: Math.max(...FLOOR.map(point => point[1])),
  };
  graph = null;
}

function getGraph() {
  if (graph) return graph;
  const { minX, minY, maxX, maxY } = gridBounds;
  const nodes=[],lookup=new Map();
  for (let gy=0,y=minY;y<=maxY;gy++,y+=gridStep) {
    for (let gx=0,x=minX;x<=maxX;gx++,x+=gridStep) {
      if (!isWalkable({x,y})) continue;
      const n={id:nodes.length,x,y,gx,gy,links:[],component:-1};
      nodes.push(n);lookup.set(`${gx},${gy}`,n);
    }
  }
  for (const n of nodes) {
    for (const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]) {
      const m=lookup.get(`${n.gx+dx},${n.gy+dy}`);
      if (!m||!segmentWalkable(n,m)) continue;
      const cost=Math.hypot(m.x-n.x,m.y-n.y);
      n.links.push({id:m.id,cost});m.links.push({id:n.id,cost});
    }
  }
  const components=[];
  for (const n of nodes) {
    if(n.component>=0) continue;
    const id=components.length,queue=[n];n.component=id;
    for(let i=0;i<queue.length;i++) {
      for(const link of queue[i].links) {
        const m=nodes[link.id];
        if(m.component<0){m.component=id;queue.push(m);}
      }
    }
    components.push(queue);
  }
  const main=components.reduce((a,b)=>b.length>a.length?b:a,[]);
  graph={nodes,main,components};
  return graph;
}

function closestNode(p,visible=false) {
  const candidates=getGraph().main;
  let result=null,best=Infinity;
  for(const n of candidates) {
    const d=Math.hypot(p.x-n.x,p.y-n.y);
    if(d<best){best=d;result=n;}
  }
  // Most points connect to the closest grid node. Avoid testing long segments
  // to each increasingly close node while scanning the grid in row order.
  if(!visible||!result||segmentWalkable(p,result))return result;
  const ordered=candidates.map(n=>({n,d:dist2(p,n)})).sort((a,b)=>a.d-b.d);
  return ordered.find(({n})=>segmentWalkable(p,n))?.n??null;
}

/** Snap finite off-floor clicks to reachable floor; malformed coordinates return null. */
export function nearestWalkable(point) {
  const p=asPoint(point);
  if(!finite(p))return null;
  if(isWalkable(p)&&closestNode(p,true)) return p;
  const n=closestNode(p);
  return n?{x:n.x,y:n.y}:null;
}

class MinHeap {
  constructor(){this.values=[];}
  push(item){
    const a=this.values;a.push(item);let i=a.length-1;
    while(i>0){const p=(i-1)>>1;if(a[p].score<=item.score)break;a[i]=a[p];i=p;}a[i]=item;
  }
  pop(){
    const a=this.values,root=a[0],last=a.pop();
    if(a.length){let i=0;while(true){let c=i*2+1;if(c>=a.length)break;
      if(c+1<a.length&&a[c+1].score<a[c].score)c++;
      if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return root;
  }
  get length(){return this.values.length;}
}

/**
 * A* followed by collision-safe string pulling. Result excludes the starting point.
 * Finite off-floor goals snap to the floor. Invalid/blocked starts return []:
 * callers must explicitly place a pet at nearestWalkable(start) before routing,
 * rather than accidentally animating it through a solid obstacle to a valid node.
 */
export function findPath(from,to) {
  const start=asPoint(from),goal=nearestWalkable(to);
  if(!isWalkable(start))return [];
  if(!start||!goal||dist2(start,goal)<.01) return [];
  if(segmentWalkable(start,goal)) return [goal];
  const source=closestNode(start,true),target=closestNode(goal,true);
  if(!source||!target) return [];
  const {nodes}=getGraph(),cost=new Float64Array(nodes.length),previous=new Int32Array(nodes.length);
  cost.fill(Infinity);previous.fill(-1);cost[source.id]=0;
  const closed=new Uint8Array(nodes.length),open=new MinHeap();
  open.push({id:source.id,score:Math.hypot(source.x-target.x,source.y-target.y)});
  while(open.length){
    const {id}=open.pop();if(closed[id])continue;closed[id]=1;
    if(id===target.id)break;
    for(const link of nodes[id].links){
      if(closed[link.id])continue;
      const next=cost[id]+link.cost;if(next>=cost[link.id])continue;
      cost[link.id]=next;previous[link.id]=id;
      const n=nodes[link.id];open.push({id:link.id,score:next+Math.hypot(n.x-target.x,n.y-target.y)});
    }
  }
  if(!Number.isFinite(cost[target.id]))return [];
  const raw=[goal];let id=target.id;
  while(id!==-1){const n=nodes[id];raw.push({x:n.x,y:n.y});if(id===source.id)break;id=previous[id];}
  raw.push(start);raw.reverse();
  const result=[];let index=0;
  while(index<raw.length-1){
    let next=raw.length-1;
    while(next>index+1&&!segmentWalkable(raw[index],raw[next]))next--;
    if(dist2(raw[index],raw[next])>.01)result.push(raw[next]);index=next;
  }
  return result;
}

/** Reachable, spaced-out destinations for autonomous wandering. */
export function randomDestination(from,random=Math.random) {
  const p=nearestWalkable(from),nodes=getGraph().main;
  if(!nodes.length)return null;
  let n=nodes[0];
  for(let i=0;i<40;i++){
    n=nodes[Math.min(nodes.length-1,Math.floor(Math.max(0,random())*nodes.length))];
    if(!p||dist2(p,n)>230**2)break;
  }
  return {x:n.x,y:n.y};
}

export function navigationStats() {
  const g=getGraph();return {gridStep,clearance:CLEARANCE,nodes:g.nodes.length,
    reachableNodes:g.main.length,componentSizes:g.components.map(c=>c.length)};
}
