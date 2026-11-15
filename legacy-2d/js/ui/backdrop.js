// Fills the screen with the market ground behind the menus.
export function addBackdrop(scene) {
  const tile = scene.add.tileSprite(0, 0, scene.scale.width, scene.scale.height, 'dirt').setOrigin(0);

  const onResize = size => tile.setSize(size.width, size.height);
  scene.scale.on('resize', onResize);
  scene.events.once('shutdown', () => scene.scale.off('resize', onResize));
}
