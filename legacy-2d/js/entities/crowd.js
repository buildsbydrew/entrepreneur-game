// Keeps track of everyone in the market, so people can see who is in their way.
// No drawing happens here. A "person" is anything with an `image` that has an x and a y,
// where y is where their feet are.
const WIDTH = 48; // how close two people can stand side by side
const DEPTH = 20; // how close one can stand behind another (the market is drawn from above, at an angle)

export default class Crowd {
  constructor(solids = []) {
    this.people = [];
    this.solids = solids; // the solid things in the market: stalls, crates, poles
  }

  add(person) {
    this.people.push(person);
  }

  remove(person) {
    this.people = this.people.filter(other => other !== person);
  }

  // Whoever is standing where a person at (x, y) would stand, or null
  blocker(self, x, y) {
    return this.people.find(other =>
      other !== self && Math.abs(other.image.x - x) < WIDTH && Math.abs(other.image.y - y) < DEPTH
    ) ?? null;
  }

  // Is there room for a person to stand at (x, y)? Nobody there, and nothing solid.
  isFree(self, x, y) {
    if (this.blocker(self, x, y)) return false;

    // A person's feet take up a box 34 wide and 20 tall, just above y
    return !this.solids.some(solid =>
      Math.abs(solid.x - x) < solid.width / 2 + 17 && Math.abs(solid.y - (y - 10)) < solid.height / 2 + 10
    );
  }
}
