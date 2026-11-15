// What people can't walk through: solid boxes (walls, furniture, stalls) and other people.
// No drawing happens here, so it can be tested on its own. Positions are on the ground: x (east) and z (south).

export function createSpace(bounds) {
  return { bounds, solids: [], people: [] };
}

// A solid box centred at (x, z), w wide (east-west) and d deep (north-south)
export function addSolid(space, x, z, w, d) {
  const solid = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
  space.solids.push(solid);
  return solid;
}

// A person is a circle: { pos: { x, z }, radius }
export function addPerson(space, person) {
  space.people.push(person);
}

export function removePerson(space, person) {
  space.people = space.people.filter(p => p !== person);
}

function hitsSolid(space, x, z, r) {
  const b = space.bounds;
  if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
  return space.solids.some(s => x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ);
}

// Would standing at (x, z) bump into another person? Moving away from someone you already
// overlap is always allowed, so nobody can ever get stuck.
function hitsPerson(space, self, from, x, z, r) {
  return space.people.some(other => {
    if (other === self) return false;
    const reach = r + other.radius;
    const after = Math.hypot(other.pos.x - x, other.pos.z - z);
    if (after >= reach) return false;
    const before = Math.hypot(other.pos.x - from.x, other.pos.z - from.z);
    return after < before; // only blocked if this step gets closer
  });
}

export function isFree(space, self, x, z, r) {
  return !hitsSolid(space, x, z, r) && !hitsPerson(space, self, self?.pos ?? { x, z }, x, z, r);
}

// Moves a person by (dx, dz), one direction at a time, so they slide along walls instead of sticking.
// Returns which directions were blocked.
export function moveWithCollision(space, self, dx, dz) {
  const pos = self.pos;
  const r = self.radius;
  let blockedX = false;
  let blockedZ = false;

  const nx = pos.x + dx;
  if (!hitsSolid(space, nx, pos.z, r) && !hitsPerson(space, self, pos, nx, pos.z, r)) pos.x = nx;
  else blockedX = dx !== 0;

  const nz = pos.z + dz;
  if (!hitsSolid(space, pos.x, nz, r) && !hitsPerson(space, self, pos, pos.x, nz, r)) pos.z = nz;
  else blockedZ = dz !== 0;

  return { blockedX, blockedZ };
}
