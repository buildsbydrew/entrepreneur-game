// Moves a character toward a target, easing off as they get close.
// No drawing happens here, so it can be tested on its own.
// Returns the new position, whether they have arrived, which way they face, and how fast they are going.
export function stepToward(from, to, maxSpeed, deltaMs) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  const speed = Math.min(maxSpeed, 40 + distance * 2.5); // slows down near the end
  const step = (speed * deltaMs) / 1000;

  const facing = Math.abs(dx) >= Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');

  if (distance <= step || distance < 2) {
    return { x: to.x, y: to.y, arrived: true, facing, pace: 0 };
  }

  return {
    x: from.x + (dx / distance) * step,
    y: from.y + (dy / distance) * step,
    arrived: false,
    facing,
    pace: speed / maxSpeed
  };
}
