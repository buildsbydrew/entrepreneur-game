// A place the player can walk around, built from its data in src/data/places.json:
// the ground, the props, the ways out at its edges, and things to use.
import * as THREE from 'three';
import { flat, mesh, at, seededRandom } from '../render/shapes.js';
import { createSpace, addSolid } from './collision.js';
import { PROPS } from './props.js';
import { TOWN_PROPS } from './propsTown.js';

export default class Place {
  constructor(scene, data) {
    this.data = data;
    this.id = data.id;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.scene = scene;

    const [w, d] = data.size;
    this.bounds = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 };
    this.space = createSpace(this.bounds);
    this.lamps = [];
    this.houses = [];
    this.interactables = [];
    this.spots = [];            // places to sit, lie, cook, kneel... (see spots.js)

    this.buildGround();
    const ctx = {
      add: obj => this.group.add(obj),
      solid: (x, z, sw, sd) => addSolid(this.space, x, z, sw, sd),
      lamp: lamp => this.lamps.push(lamp),
      house: house => this.houses.push({ ...house, open: 0 }),
      spot: spot => this.spots.push(spot)
    };
    (data.props ?? []).forEach(p => {
      const build = PROPS[p.type] ?? TOWN_PROPS[p.type];
      if (build) build(p, ctx);
      else console.warn(`Unknown prop type "${p.type}" in ${data.id}`);
    });
    // Pebbles belong outside: take away any that ended up on an indoor floor
    (this.stones ?? []).forEach(stone => { if (this.insideHouse(stone.position.x, stone.position.z)) stone.visible = false; });
    (data.exits ?? []).forEach(exit => this.drawExitArrows(exit));
    (data.things ?? []).forEach(thing => this.interactables.push({ ...thing, kind: thing.kind ?? 'look' }));
  }

  // The ground carries on past the edges, so the world doesn't end in a cliff
  buildGround() {
    const [w, d] = this.data.size;
    const color = this.data.ground ?? '#d8b98a';
    this.group.add(flat(new THREE.PlaneGeometry(w + 120, d + 120), color, 0));
    const rand = seededRandom(this.data.seed ?? 7);
    const shade = new THREE.Color(color);
    for (let i = 0; i < (w * d) / 18; i++) {
      const c = shade.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      const patch = flat(new THREE.CircleGeometry(0.6 + rand() * 2, 9), `#${c.getHexString()}`, 0.004 + i * 0.00002);
      patch.scale.y = 0.5 + rand() * 0.5;
      patch.rotation.z = rand() * Math.PI;
      this.group.add(at(patch, (rand() - 0.5) * (w + 20), patch.position.y, (rand() - 0.5) * (d + 20)));
    }
    for (let i = 0; i < (w * d) / 25; i++) {
      const stone = mesh(new THREE.DodecahedronGeometry(0.05 + rand() * 0.07, 0), rand() > 0.5 ? '#a88a66' : '#8f7a62');
      stone.castShadow = false;
      this.group.add(at(stone, (rand() - 0.5) * w, 0.03, (rand() - 0.5) * d));
      this.stones = this.stones ?? [];
      this.stones.push(stone);
    }
  }

  // Three soft arrows on the ground, pointing off the edge where a way out is
  drawExitArrows(exit) {
    const out = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] }[exit.edge];
    const middle = (exit.min + exit.max) / 2;
    const b = this.bounds;
    const edgeX = { west: b.minX, east: b.maxX }[exit.edge];
    const edgeZ = { north: b.minZ, south: b.maxZ }[exit.edge];
    const shape = new THREE.Shape([new THREE.Vector2(-0.35, -0.3), new THREE.Vector2(0.15, 0), new THREE.Vector2(-0.35, 0.3), new THREE.Vector2(-0.2, 0)]);
    for (let i = 0; i < 3; i++) {
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#3b2a20', transparent: true, opacity: 0.25 + i * 0.12, depthWrite: false }));
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = Math.atan2(-out[1], out[0]);
      const inset = 2.6 - i * 0.7;
      const x = edgeX !== undefined ? edgeX - out[0] * inset : middle;
      const z = edgeZ !== undefined ? edgeZ - out[1] * inset : middle;
      this.group.add(at(arrow, x, 0.03, z));
    }
  }

  // Which way out, if any, the player at (x, z) is pushing into
  exitAt(x, z, radius, pushX, pushZ) {
    const b = this.bounds;
    for (const exit of this.data.exits ?? []) {
      const along = exit.edge === 'west' || exit.edge === 'east' ? z : x;
      if (along < exit.min || along > exit.max) continue;
      const leaving = {
        west: x - radius <= b.minX + 0.05 && pushX < 0,
        east: x + radius >= b.maxX - 0.05 && pushX > 0,
        north: z - radius <= b.minZ + 0.05 && pushZ < 0,
        south: z + radius >= b.maxZ - 0.05 && pushZ > 0
      }[exit.edge];
      if (leaving) return exit;
    }
    return null;
  }

  // A point just inside the edge, in the middle of a way out: where people arrive and leave
  edgePoint(exit) {
    const b = this.bounds;
    const middle = (exit.min + exit.max) / 2;
    return {
      west: { x: b.minX + 0.6, z: middle },
      east: { x: b.maxX - 0.6, z: middle },
      north: { x: middle, z: b.minZ + 0.6 },
      south: { x: middle, z: b.maxZ - 0.6 }
    }[exit.edge];
  }

  // The way from a spot to the edge: out through the door first if the spot is indoors
  routeToEdge(from) {
    const exit = (this.data.exits ?? [])[0];
    if (!exit) return [];
    const house = this.insideHouse(from.x, from.z);
    const points = house ? [house.doorIn, house.doorOut] : [];
    return [...points, this.edgePoint(exit)];
  }

  insideHouse(x, z) {
    return this.houses.find(h => x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ) ?? null;
  }

  // Each frame: lift the roof and front wall of the house the player is in, and light the lamps after dark
  update(dt, player, lampLevel) {
    const inside = this.insideHouse(player.x, player.z);
    for (const h of this.houses) {
      const target = h === inside ? 1 : 0;
      h.open += (target - h.open) * Math.min(1, dt * 6);
      // The roof rises a little and then vanishes, so it never hangs between the camera and the room
      h.roof.position.y = h.open * 2.5;
      h.roof.visible = h.open < 0.55;
      h.front.scale.y = 1 - h.open * 0.87;
    }
    for (const lamp of this.lamps) {
      lamp.glass.material.emissiveIntensity = lampLevel * 2.2;
      if (lamp.light) lamp.light.intensity = lampLevel * 8;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material?.map) obj.material.map.dispose();
    });
  }
}
