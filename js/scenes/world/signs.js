// Wooden name boards that hang over stalls.
// These methods are added to the scene, so `this` is the scene.

export const signsMethods = {
  // A wooden name board that hangs just above a stall's roof
  makeSign(x, roofY, name) {
    const label = this.add.text(0, 0, name, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fff4dc'
    }).setOrigin(0.5);
    if (label.width > 220) label.setScale(220 / label.width); // long names shrink to fit

    const w = label.displayWidth + 36;
    const h = 36;
    const board = this.add.graphics();
    board.fillStyle(0x8d5524, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    board.lineStyle(3, 0x3b2a20, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    board.lineBetween(-w / 2 + 18, h / 2, -w / 2 + 18, h / 2 + 8);
    board.lineBetween(w / 2 - 18, h / 2, w / 2 - 18, h / 2 + 8);

    return this.add.container(x, roofY - h / 2 - 8, [board, label]);
  },
};
