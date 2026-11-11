import Phaser from 'phaser';
import { HuntScene } from './HuntScene';
import { FONT, gameState, makeButton, showMessage } from './Shared';

// ====== НАСТРОЙКИ — меняй числа здесь ======
const PIZZA_PRICE = 10;
const FLASK_CAPACITY = 3;
const SQUEEZE_TIME_MS = 10000;
const PIZZA_MOVE_MS = 800;
const PIZZA_LIFT_MS = 1500;

const CAR_COUNT = 7;
const CAR_GAP = 150;
const CAR_SPEED = 120;
const CAR_LEAVE_MS = 2500;
const CAR_COLORS = [0xef4444, 0x22c55e, 0xeab308, 0x3b82f6, 0xa855f7];

const ROAD_HEIGHT = 100;
const WINDOW_X = 300;
const CONVEYOR_X = 120;

export class GameScene extends Phaser.Scene {
  private roadTop = 0;
  private windowY = 0;
  private flaskX = 0;
  private flaskY = 0;

  private cars: Phaser.GameObjects.Container[] = [];
  private stockText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private flaskLiquid!: Phaser.GameObjects.Graphics;
  private flaskText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.roadTop = height - ROAD_HEIGHT;
    this.windowY = this.roadTop - 60;
    this.flaskX = width / 2;
    this.flaskY = height * 1.5;

    this.registerHuntScene();
    this.createCity();
    this.createPizzeria();
    this.createLab();
    this.createQueue();
    this.createHud();
    this.setupScrolling();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    this.moveCars(dt);
    this.trySell();
    this.checkFlask();
    this.updateFlask();
    this.updateHud();
  }

  private registerHuntScene(): void {
    if (!this.scene.get('HuntScene')) {
      this.scene.add('HuntScene', HuntScene, false);
    }
  }

  // ---------- Город ----------

  private createCity(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x38bdf8).setOrigin(0, 0); // небо

    // облака
  const cloudRnd = new Phaser.Math.RandomDataGenerator(['city-clouds']);
  for (let i = 0; i < 5; i++) {
    const cx = cloudRnd.between(60, width - 60);
    const cy = cloudRnd.between(30, 110);
    const scale = cloudRnd.realInRange(0.8, 1.3);

    const puffs = [
      { dx: 0,   dy: 0,   w: 70, h: 34 },
      { dx: -30, dy: 6,   w: 50, h: 26 },
      { dx: 30,  dy: 6,   w: 50, h: 26 },
      { dx: -12, dy: -12, w: 44, h: 30 },
      { dx: 14,  dy: -10, w: 40, h: 28 },
    ];
    puffs.forEach((p) => {
      this.add.ellipse(
        cx + p.dx * scale,
        cy + p.dy * scale,
        p.w * scale,
        p.h * scale,
        0xffffff,
        0.9,
      );
    });
    }

    // дома с окнами
    for (let i = 0; i * 100 < width; i++) {
      const buildingHeight = 120 + ((i * 3) % 4) * 35;
      const bx = i * 100;
      const by = this.roadTop - buildingHeight;

      this.add.rectangle(bx + 40, by + buildingHeight / 2, 80, buildingHeight, 0x475569);
      this.add.rectangle(bx + 4, by + buildingHeight / 2, 6, buildingHeight, 0x64748b);
      this.add.rectangle(bx + 40, by - 3, 88, 6, 0x334155);

      const rows = Math.floor((buildingHeight - 20) / 26);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          const wx = bx + 14 + c * 36;
          const wy = by + 16 + r * 26;
          const lit = (i + r + c) % 3 !== 0;
          this.add.rectangle(wx + 8, wy + 8, 16, 16, lit ? 0xfde047 : 0x1e293b);
          this.add.rectangle(wx + 8, wy + 8, 16, 2, 0x0f172a);
          this.add.rectangle(wx + 8, wy + 8, 2, 16, 0x0f172a);
        }
      }
    }

    // дорога
    this.add.rectangle(0, this.roadTop, width, ROAD_HEIGHT, 0x374151).setOrigin(0, 0);
    this.add.rectangle(0, this.roadTop, width, 6, 0x1f2937).setOrigin(0, 0);
    this.add.rectangle(0, this.roadTop - 2, width, 4, 0x94a3b8).setOrigin(0, 0);
    for (let x = 0; x < width; x += 90) {
      this.add.rectangle(x, this.roadTop + ROAD_HEIGHT - 12, 50, 6, 0xe5e7eb).setOrigin(0, 0);
    }
  }

  // ---------- Пиццерия ----------

  private createPizzeria(): void {
    const wallTop = this.roadTop - 200;

    // стены
    this.add.rectangle(200, this.roadTop - 100, 300, 200, 0xfde68a);
    // кирпичики
    for (let y = wallTop; y < this.roadTop; y += 16) {
      for (let x = 50; x < 350; x += 32) {
        const shifted = ((y - wallTop) / 16) % 2 === 1 ? 16 : 0;
        this.add.rectangle(x + shifted + 15, y + 7, 30, 14, 0xfacc15, 0.5);
      }
    }
    // крыша
    this.add.rectangle(200, wallTop - 15, 330, 30, 0xdc2626);
    this.add.rectangle(200, wallTop - 3, 330, 6, 0x991b1b);
    // вывеска
    this.add.rectangle(200, wallTop - 14, 160, 24, 0x7f1d1d);

    this.add
      .text(200, wallTop + 30, '🍕 Pizza', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#7f1d1d',
      })
      .setOrigin(0.5);

    // окно выдачи
    this.add.rectangle(WINDOW_X, this.windowY, 80, 60, 0x0f172a);
    this.add.rectangle(WINDOW_X, this.windowY, 72, 52, 0x1e293b);
    this.add.rectangle(WINDOW_X, this.windowY + 32, 100, 8, 0x92400e);
    this.add.rectangle(WINDOW_X, this.windowY + 30, 100, 2, 0xb45309);

    this.stockText = this.add
      .text(WINDOW_X, this.windowY, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);

    // люк конвейера
    this.add.rectangle(CONVEYOR_X, this.windowY, 44, 60, 0x0f172a);
    this.add.rectangle(CONVEYOR_X, this.windowY, 36, 52, 0x334155);
  }

  // ---------- Лаборатория ----------

  private createLab(): void {
    const { width, height } = this.scale;
    const beltY = this.flaskY + 85;

    this.add.rectangle(0, height, width, height, 0x1e1b2e).setOrigin(0, 0); // подземелье

    // земля сверху — комья
    this.add.rectangle(0, height, width, 14, 0x78350f).setOrigin(0, 0);
    for (let x = 0; x < width; x += 12) {
      const c = (x / 12) % 2 === 0 ? 0x92400e : 0x5b2a0c;
      this.add.rectangle(x, height + 4, 8, 10, c).setOrigin(0, 0);
    }

    // конвейер
    this.add.rectangle(CONVEYOR_X, beltY, this.flaskX - CONVEYOR_X, 16, 0x111827).setOrigin(0, 0.5);
    for (let x = CONVEYOR_X; x < this.flaskX; x += 16) {
      this.add.rectangle(x, beltY, 12, 12, 0x374151);
    }
    // шахта
    this.add.rectangle(CONVEYOR_X, this.windowY, 36, beltY - this.windowY + 8, 0x0b1220).setOrigin(0.5, 0);
    for (let y = this.windowY; y < beltY; y += 14) {
      this.add.rectangle(CONVEYOR_X, y, 32, 10, 0x1f2937);
    }

    this.createFlask();

    
  }

  private createFlask(): void {
    // стекло
    const glass = this.add.rectangle(this.flaskX, this.flaskY, 100, 150, 0xffffff, 0.1);
    glass.setStrokeStyle(4, 0xe2e8f0);
    glass.setInteractive({ useHandCursor: true });
    glass.on('pointerdown', () => this.onFlaskClick());

    // горлышко
    this.add.rectangle(this.flaskX, this.flaskY - 90, 28, 18, 0xe2e8f0);
    this.add.rectangle(this.flaskX, this.flaskY - 96, 36, 8, 0x94a3b8);
    // блик
    this.add.rectangle(this.flaskX - 38, this.flaskY, 8, 130, 0xffffff, 0.2);

    this.flaskLiquid = this.add.graphics();
    this.flaskText = this.add
      .text(this.flaskX, this.flaskY - 105, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  // ---------- Машины ----------

  private slotX(index: number): number {
    return WINDOW_X + index * CAR_GAP;
  }

  private createQueue(): void {
    for (let i = 0; i < CAR_COUNT; i++) {
      this.cars.push(this.createCar(this.slotX(i)));
    }
  }

  private createCar(x: number): Phaser.GameObjects.Container {
    const color = Phaser.Utils.Array.GetRandom(CAR_COLORS);
    const parts = [
      this.add.rectangle(0, 0, 110, 30, color), // кузов
      this.add.rectangle(0, -22, 60, 24, color), // крыша
      this.add.rectangle(0, -22, 44, 16, 0x93c5fd), // окно
      this.add.rectangle(0, -22, 44, 2, 0x1e293b), // рамка окна
      this.add.text(0, -22, '👤', { fontSize: '14px' }).setOrigin(0.5),
      this.add.circle(-32, 18, 9, 0x111827), // колёса
      this.add.circle(32, 18, 9, 0x111827),
      this.add.circle(-32, 18, 4, 0x475569), // диски
      this.add.circle(32, 18, 4, 0x475569),
    ];
    return this.add.container(x, this.roadTop + 55, parts);
  }

  private moveCars(dt: number): void {
    this.cars.forEach((car, index) => {
      const target = this.slotX(index);
      if (car.x > target) car.x = Math.max(target, car.x - CAR_SPEED * dt);
    });
  }

  // ---------- Продажа ----------

  private trySell(): void {
    const firstCar = this.cars[0];
    if (firstCar.x > this.slotX(0) + 1) return;
    if (gameState.pizzasReady === 0) return;

    gameState.pizzasReady--;
    gameState.coins += PIZZA_PRICE;
    this.showCoinPopup();
    this.sendCarAway();
  }

  private sendCarAway(): void {
    const car = this.cars.shift() as Phaser.GameObjects.Container;
    this.tweens.add({
      targets: car,
      x: -150,
      duration: CAR_LEAVE_MS,
      onComplete: () => car.destroy(),
    });

    const newCarX = Math.max(this.slotX(this.cars.length), this.scale.width + 80);
    this.cars.push(this.createCar(newCarX));
  }

  private showCoinPopup(): void {
    const popup = this.add
      .text(WINDOW_X, this.windowY - 50, `+${PIZZA_PRICE} монет`, {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#facc15',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: popup,
      y: popup.y - 50,
      alpha: 0,
      duration: 1200,
      onComplete: () => popup.destroy(),
    });
  }

  // ---------- Лаборатория: логика ----------

  private onFlaskClick(): void {
    if (gameState.flaskFinishAt > 0) return;

    if (gameState.ghostsInBackpack === 0) {
      showMessage(this, 'В рюкзаке нет призраков');
      return;
    }

    gameState.ghostsInBackpack--;
    gameState.flaskGhosts++;

    if (gameState.flaskGhosts === FLASK_CAPACITY) {
      gameState.flaskFinishAt = Date.now() + SQUEEZE_TIME_MS;
    }
  }

  private checkFlask(): void {
    if (gameState.flaskFinishAt === 0) return;
    if (Date.now() < gameState.flaskFinishAt) return;

    gameState.flaskGhosts = 0;
    gameState.flaskFinishAt = 0;
    this.sendPizzaUp();
  }

  private sendPizzaUp(): void {
    const pizza = this.add
      .text(this.flaskX, this.flaskY + 85, '🍕', { fontSize: '40px' })
      .setOrigin(0.5)
      .setDepth(6);

    this.tweens.add({
      targets: pizza,
      x: CONVEYOR_X,
      duration: PIZZA_MOVE_MS,
      onComplete: () => this.liftPizza(pizza),
    });
  }

  private liftPizza(pizza: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: pizza,
      y: this.windowY,
      duration: PIZZA_LIFT_MS,
      onComplete: () => {
        pizza.destroy();
        gameState.pizzasReady++;
      },
    });
  }

  private updateFlask(): void {
    const squeezing = gameState.flaskFinishAt > 0;
    const level = gameState.flaskGhosts / FLASK_CAPACITY;
    const color = squeezing ? 0xfacc15 : 0xa78bfa;

    this.flaskLiquid.clear();
    const totalH = 140;
    const filledH = Math.floor((totalH * level) / 8) * 8;
    const baseY = this.flaskY + 70;
    for (let i = 0; i < filledH; i += 8) {
      const shade = i % 16 === 0 ? 0x8b5cf6 : color;
      this.flaskLiquid.fillStyle(shade, 1);
      this.flaskLiquid.fillRect(this.flaskX - 44, baseY - i - 8, 88, 8);
    }
    if (level > 0) {
      const t = Math.floor(Date.now() / 300) % 4;
      this.flaskLiquid.fillStyle(0xffffff, 0.6);
      this.flaskLiquid.fillRect(this.flaskX - 20 + t * 10, baseY - filledH + 4, 4, 4);
    }

    if (squeezing) {
      const secondsLeft = Math.ceil((gameState.flaskFinishAt - Date.now()) / 1000);
      this.flaskText.setText(`… ${secondsLeft} с`);
    } else {
      this.flaskText.setText(`Призраков: ${gameState.flaskGhosts}/${FLASK_CAPACITY}`);
    }
  }

  // ---------- HUD и прокрутка ----------

  private createHud(): void {
    const { width, height } = this.scale;

    this.hudText = this.add
      .text(20, 16, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(10);

    makeButton(this, width - 20, height - 20, 'Обнаружены призраки!', () => this.goToHunt()).setOrigin(1, 1);
  }

  private updateHud(): void {
    this.hudText.setText(
      `Монеты: ${gameState.coins}\nПризраки в рюкзаке: ${gameState.ghostsInBackpack}`,
    );
    const stock = gameState.pizzasReady;
    this.stockText.setText(stock > 0 ? `🍕 x${stock}` : '');
  }

  private setupScrolling(): void {
    this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height * 2);

    this.input.on('wheel', (_pointer: unknown, _objects: unknown, _dx: number, deltaY: number) => {
      const camera = this.cameras.main;
      camera.scrollY = Phaser.Math.Clamp(camera.scrollY + deltaY, 0, this.scale.height);
    });

    this.events.on('wake', () => {
      this.cameras.main.scrollY = 0;
    });
  }

  private goToHunt(): void {
    this.scene.launch('HuntScene');
    this.scene.sleep();
  }
}