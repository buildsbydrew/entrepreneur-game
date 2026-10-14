// A thought bubble with a bit of shopping in it, shown above someone's head for a moment.
export function popShopBubble(scene, x, feetY, iconKey, ms = 1800) {
  const bubbleBottom = feetY - 110;

  const bubble = scene.add.image(x, bubbleBottom, 'bubble')
    .setOrigin(0.5, 1)
    .setDisplaySize(52, 60)
    .setDepth(2000);
  const icon = scene.add.image(x, bubbleBottom - 37, iconKey)
    .setDisplaySize(38, 38)
    .setDepth(2001);

  scene.time.delayedCall(ms, () => {
    bubble.destroy();
    icon.destroy();
  });
}
