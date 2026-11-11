import Phaser from 'phaser';

export const FONT = 'system-ui, sans-serif';

/** Общие данные игры — их видят обе сцены (пиццерия и охота). */
export const gameState = {
  coins: 0,
  ghostsInBackpack: 0,
  pizzasReady: 0,
  flaskGhosts: 0,
  flaskFinishAt: 0,
};

/** Кнопка с текстом. Не двигается вместе с камерой. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text {
  const button = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#7c3aed',
      padding: { x: 14, y: 8 },
    })
    .setScrollFactor(0)
    .setDepth(10)
    .setInteractive({ useHandCursor: true });

  button.on('pointerdown', onClick);
  return button;
}

/** Короткое сообщение сверху экрана, само исчезает. */
export function showMessage(scene: Phaser.Scene, text: string): void {
  const message = scene.add
    .text(scene.scale.width / 2, 100, text, {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 6 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(20);

  scene.tweens.add({
    targets: message,
    alpha: 0,
    delay: 1500,
    duration: 400,
    onComplete: () => message.destroy(),
  });
}