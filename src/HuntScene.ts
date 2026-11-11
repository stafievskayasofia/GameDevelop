import Phaser from 'phaser';
import { FONT, gameState, makeButton, showMessage } from './shared';

// ====== НАСТРОЙКИ — меняй числа здесь ======

const WORLD_WIDTH = 2600;
const FOREST_WIDTH = 170;
const GROUND_HEIGHT = 100;

// Охотник: размеры
const PLAYER_W = 36;
const PLAYER_H = 60;
const STUN_TIME = 1000;

// Охотник: бег (разгон и торможение, как у настоящего персонажа, а не мгновенно)
const PLAYER_SPEED = 260; // максимальная скорость
const GROUND_ACCEL = 2200; // разгон на земле
const GROUND_FRICTION = 2600; // торможение на земле
const AIR_ACCEL = 1300; // управление в воздухе (слабее, чем на земле)
const AIR_FRICTION = 400; // в воздухе почти не тормозим

// Охотник: прыжок
const JUMP_SPEED = 650; // начальная скорость прыжка
const JUMP_CUT_SPEED = 220; // отпустил ↑ в полёте вверх — прыжок обрывается
const GRAVITY = 1800;
const MAX_FALL_SPEED = 1100; // быстрее этого не падаем
const COYOTE_TIME = 0.1; // сек после схода с пня, когда ещё можно прыгнуть

const STUMP_W = 50;
const STUMP_H = 45;
const STUMP_XS = [450, 1050, 1580, 2150];

const BURROWS = [
  { x: 800, ghosts: 2 },
  { x: 1300, ghosts: 1 },
  { x: 1850, ghosts: 2 },
];

const BAIT_RANGE = 500;
const NOTICE_DISTANCE = 250;
// Должна быть больше NOTICE_DISTANCE хотя бы на 50: призраки стоят чуть в стороне от центра норы,
// и иначе ближний заметил бы охотника сразу после выхода.
const EMERGE_DISTANCE = 330;
const GHOST_W = 40;
const GHOST_H = 44;
const GHOST_WALK_SPEED = 90;
const GHOST_FLEE_SPEED = 210;
const HIDDEN_SCALE = 0.55;

const HARPOON_SPEED = 900;
const HARPOON_RANGE = 550;
const HARPOON_COOLDOWN = 500;
const PULL_SPEED = 700;

const BAR_WIDTH = 200;

type GhostState = 'hidden' | 'toBait' | 'eating' | 'fleeing' | 'caught' | 'inBackpack' | 'escaped';

interface Burrow {
  x: number;
  baited: boolean;
  bait?: Phaser.GameObjects.Text;
}

interface Ghost {
  sprite: Phaser.GameObjects.Text;
  burrow: Burrow;
  state: GhostState;
  targetX: number;
  fleeDir: number;
}

interface Harpoon {
  x: number;
  y: number;
  dir: number;
  startX: number;
  target?: Ghost;
}

export class HuntScene extends Phaser.Scene {
  private groundY = 0;

  private player!: Phaser.GameObjects.Container;
  private gun!: Phaser.GameObjects.Container;
  private stars!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private burrows: Burrow[] = [];
  private ghosts: Ghost[] = [];
  private harpoon?: Harpoon;
  private rope!: Phaser.GameObjects.Graphics;

  private hudBar!: Phaser.GameObjects.Graphics;
  private backpackText!: Phaser.GameObjects.Text;
  private captureText!: Phaser.GameObjects.Text;

  private velocityX = 0;
  private velocityY = 0;
  private onGround = true;
  private coyoteTimer = 0; // сколько ещё секунд можно прыгнуть после схода с опоры
  private facing = 1;
  private stunnedUntil = 0;
  private nextShotAt = 0;
  private levelOver = false;

  private paused = false;
  private pauseStartedAt = 0;
  private pauseOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super('HuntScene');
  }

  create(): void {
    this.resetLevelState();
    this.groundY = this.scale.height - GROUND_HEIGHT;

    this.createBackground();
    this.createGround();
    this.createBurrows();
    this.createStumps();
    this.createGhosts();
    this.createPlayer();
    this.createRope();
    this.createForests();
    this.createHud();
    this.setupCamera();
    this.setupKeyboard();

    showMessage(this, '← → ходить, ↑ прыжок. ↓ — приманка, Пробел — гарпун.');
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;

    const dt = Math.min(delta / 1000, 0.05);
    this.updatePlayer(dt);
    this.checkEmerge();
    this.updateGhosts(dt);
    this.updateHarpoon(dt);
    this.updateHud();
    this.checkLevelEnd();
  }

  private resetLevelState(): void {
    this.burrows = [];
    this.ghosts = [];
    this.harpoon = undefined;
    this.velocityX = 0;
    this.velocityY = 0;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.facing = 1;
    this.stunnedUntil = 0;
    this.nextShotAt = 0;
    this.levelOver = false;
    this.paused = false;
    this.pauseStartedAt = 0;
    this.pauseOverlay = undefined;
  }

  // ---------- Фон ----------

  private createBackground(): void {
    const colors = [
      0x050814, 0x070b1a, 0x090e20, 0x0b1126, 0x0d142c, 0x0f1732,
      0x111a38, 0x131d3e, 0x152044, 0x17234a, 0x192650, 0x1a2140,
    ];
    const bandH = Math.ceil(this.scale.height / colors.length);
    for (let i = 0; i < colors.length; i++) {
      this.add
        .rectangle(0, i * bandH, WORLD_WIDTH, bandH + 1, colors[i])
        .setOrigin(0, 0);
    }

    const rnd = new Phaser.Math.RandomDataGenerator(['hunt-sky']);
    for (let i = 0; i < 120; i++) {
      const sx = rnd.between(0, WORLD_WIDTH);
      const sy = rnd.between(10, this.groundY - 120);
      const s = rnd.between(1, 2);
      const c = rnd.pick([0xffffff, 0xc7d2fe, 0x93c5fd]);
      this.add.rectangle(sx, sy, s, s, c).setOrigin(0, 0);
    }

    const moonX = 700;
    const moonY = 80;
    this.add.circle(moonX, moonY, 40, 0xfef9c3).setScrollFactor(0);
    this.add.circle(moonX - 10, moonY - 10, 6, 0xe5d68a).setScrollFactor(0);
    this.add.circle(moonX + 12, moonY + 6, 5, 0xe5d68a).setScrollFactor(0);
    this.add.circle(moonX + 4, moonY + 18, 4, 0xe5d68a).setScrollFactor(0);
  }

  // ---------- Земля ----------

  private createGround(): void {
    const browns = [0x2a1d12, 0x3b2a1a, 0x4a3520, 0x3b2a1a];
    const tile = 10;
    for (let y = this.groundY; y < this.scale.height; y += tile) {
      const idx = Math.floor((y - this.groundY) / tile) % browns.length;
      this.add.rectangle(0, y, WORLD_WIDTH, tile, browns[idx]).setOrigin(0, 0);
    }
    const rnd = new Phaser.Math.RandomDataGenerator(['hunt-dirt']);
    for (let i = 0; i < 400; i++) {
      const x = rnd.between(0, WORLD_WIDTH);
      const y = rnd.between(this.groundY + 10, this.scale.height - 6);
      const c = rnd.pick([0x5a4028, 0x6b4a2f, 0x2a1d12]);
      this.add.rectangle(x, y, rnd.between(2, 4), rnd.between(2, 3), c).setOrigin(0, 0);
    }
    for (let x = 0; x < WORLD_WIDTH; x += 6) {
      const h = 6 + (x * 13) % 5;
      this.add.rectangle(x, this.groundY - h + 4, 3, h, 0x22c55e).setOrigin(0, 0);
      this.add.rectangle(x + 3, this.groundY - h + 6, 2, h - 2, 0x16a34a).setOrigin(0, 0);
    }
    this.add.rectangle(0, this.groundY, WORLD_WIDTH, 6, 0x15803d).setOrigin(0, 0);
  }

  // ---------- Норы ----------

  private createBurrows(): void {
    BURROWS.forEach((config) => {
      this.add.rectangle(config.x, this.groundY + 10, 120, 20, 0x6b4423);
      this.add.rectangle(config.x, this.groundY + 2, 90, 16, 0x7d5028);
      this.add.rectangle(config.x, this.groundY - 4, 60, 12, 0x8b5a2b);
      this.add.rectangle(config.x, this.groundY - 2, 30, 16, 0x1a0f08);
      this.burrows.push({ x: config.x, baited: false });
    });
  }

  // ---------- Пни ----------

  private createStumps(): void {
    STUMP_XS.forEach((x) => {
      const top = this.groundY - STUMP_H;
      this.add.rectangle(x, this.groundY - STUMP_H / 2, STUMP_W, STUMP_H, 0x8b5a2b);
      this.add.rectangle(x + 15, this.groundY - STUMP_H / 2, 10, STUMP_H, 0x6b4423);
      this.add.rectangle(x, top + 4, STUMP_W, 8, 0xc08a52);
      this.add.rectangle(x, top + 4, 30, 2, 0x8b5a2b);
      this.add.rectangle(x, top + 4, 16, 2, 0x6b4423);
      this.add.rectangle(x, top + 4, 6, 2, 0x4a2f18);
    });
  }

  // ---------- Призраки ----------

  private createGhosts(): void {
    BURROWS.forEach((config, index) => {
      for (let i = 0; i < config.ghosts; i++) {
        const offset = (i - (config.ghosts - 1) / 2) * 50;
        const sprite = this.add
          .text(config.x + offset, this.groundY - 18, '👻', { fontFamily: FONT, fontSize: '44px' })
          .setOrigin(0.5)
          .setScale(HIDDEN_SCALE)
          .setAlpha(0.7);

        this.ghosts.push({
          sprite,
          burrow: this.burrows[index],
          state: 'hidden',
          targetX: config.x,
          fleeDir: 1,
        });
      }
    });
  }

  // ---------- Охотник ----------

  private createPlayer(): void {
    const gunBody = this.add.rectangle(0, 0, 28, 6, 0x9ca3af);
    const gunGrip = this.add.rectangle(-8, 4, 6, 6, 0x6b7280);
    this.gun = this.add.container(24, -5, [gunBody, gunGrip]);

    this.stars = this.add
      .text(0, -PLAYER_H / 2 - 50, '⭐⭐⭐', { fontFamily: FONT, fontSize: '20px' })
      .setOrigin(0.5)
      .setVisible(false);

    const body = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, 0x2563eb);
    const bodyShade = this.add.rectangle(PLAYER_W / 2 - 4, 0, 6, PLAYER_H, 0x1e40af);
    const belt = this.add.rectangle(0, PLAYER_H / 2 - 18, PLAYER_W, 6, 0x1e3a8a);
    const head = this.add.rectangle(0, -PLAYER_H / 2 - 10, 26, 22, 0xfcd34d);
    const eyeL = this.add.rectangle(-6, -PLAYER_H / 2 - 12, 4, 4, 0x111827);
    const eyeR = this.add.rectangle(6, -PLAYER_H / 2 - 12, 4, 4, 0x111827);
    const hatBrim = this.add.rectangle(0, -PLAYER_H / 2 - 20, 34, 6, 0x1e3a8a);
    const hatTop = this.add.rectangle(0, -PLAYER_H / 2 - 28, 22, 10, 0x1e3a8a);
    const legL = this.add.rectangle(-9, PLAYER_H / 2 + 4, 10, 14, 0x1e40af);
    const legR = this.add.rectangle(9, PLAYER_H / 2 + 4, 10, 14, 0x1e40af);
    const bootL = this.add.rectangle(-9, PLAYER_H / 2 + 12, 10, 6, 0x3b2a1a);
    const bootR = this.add.rectangle(9, PLAYER_H / 2 + 12, 10, 6, 0x3b2a1a);

    const parts = [
      body, bodyShade, belt,
      head, eyeL, eyeR,
      hatBrim, hatTop,
      legL, legR, bootL, bootR,
      this.gun, this.stars,
    ];
    this.player = this.add.container(FOREST_WIDTH + 100, this.groundY - PLAYER_H / 2, parts);
  }

  private createRope(): void {
    this.rope = this.add.graphics().setDepth(4);
  }

  // ---------- Лес ----------

  private createForests(): void {
    const height = this.scale.height;
    this.add.rectangle(0, 0, FOREST_WIDTH, height, 0x021a0e).setOrigin(0, 0).setDepth(5);
    this.add
      .rectangle(WORLD_WIDTH, 0, FOREST_WIDTH, height, 0x021a0e)
      .setOrigin(1, 0)
      .setDepth(5);

    for (let x = 20; x < FOREST_WIDTH; x += 45) {
      this.drawTree(x);
      this.drawTree(WORLD_WIDTH - x);
    }
  }

  private drawTree(x: number): void {
    const y = this.groundY;
    this.add.rectangle(x, y - 20, 14, 40, 0x5b3a1e).setDepth(6);
    this.add.rectangle(x, y - 60, 60, 40, 0x166534).setDepth(6);
    this.add.rectangle(x, y - 90, 40, 30, 0x15803d).setDepth(6);
    this.add.rectangle(x, y - 112, 20, 20, 0x16a34a).setDepth(6);
    this.add.rectangle(x, y - 120, 12, 6, 0x86efac).setDepth(6);
  }

  // ---------- HUD ----------

  private createHud(): void {
    const { width, height } = this.scale;
    const textStyle = {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    };

    this.backpackText = this.add.text(20, 14, '', textStyle).setScrollFactor(0).setDepth(10);
    this.captureText = this.add
      .text(20 + BAR_WIDTH + 12, 44, '', textStyle)
      .setScrollFactor(0)
      .setDepth(10);
    this.hudBar = this.add.graphics().setScrollFactor(0).setDepth(10);

    makeButton(this, 20, height - 60, 'Приманка 🧠', () => this.throwBait());
    makeButton(this, 190, height - 60, 'Гарпун 🔱', () => this.shootHarpoon());
    makeButton(this, width - 20, height - 60, 'В пиццерию 🍕', () => this.goToPizzeria()).setOrigin(1, 0);

    // Кнопка паузы — правый верхний угол
    makeButton(this, width - 20, 16, 'Пауза ⏸', () => this.togglePause()).setOrigin(1, 0);
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  private setupKeyboard(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-DOWN', () => this.throwBait());
    this.input.keyboard.on('keydown-SPACE', () => this.shootHarpoon());
  }

  // ---------- Пауза ----------

  private togglePause(): void {
    if (this.levelOver) return;

    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.paused = true;
    this.pauseStartedAt = this.time.now;
    this.showPauseOverlay();
  }

  private resumeGame(): void {
    const pausedFor = this.time.now - this.pauseStartedAt;
    this.paused = false;

    if (this.stunnedUntil > 0) this.stunnedUntil += pausedFor;
    if (this.nextShotAt > 0) this.nextShotAt += pausedFor;

    this.hidePauseOverlay();
  }

  private showPauseOverlay(): void {
    if (this.pauseOverlay) return;

    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0);
    const title = this.add
      .text(width / 2, height / 2 - 60, 'ПАУЗА', {
        fontFamily: FONT,
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // Кнопка "Продолжить" — обычная makeButton, но внутри контейнера
    const resumeButton = this.add
      .text(width / 2, height / 2 + 20, 'Продолжить ▶', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#7c3aed',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resumeButton.on('pointerdown', () => this.resumeGame());

    this.pauseOverlay = this.add
      .container(0, 0, [dim, title, resumeButton])
      .setScrollFactor(0)
      .setDepth(50);
  }

  private hidePauseOverlay(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
  }

  // ---------- Охотник: движение ----------

  private isStunned(): boolean {
    return this.time.now < this.stunnedUntil;
  }

  /** Порядок каждый кадр: скорость -> шаг по X (с пнями) -> прыжок -> гравитация. */
  private updatePlayer(dt: number): void {
    const stunned = this.isStunned();
    this.stars.setVisible(stunned);

    // оглушённый охотник ничего не нажимает: просто тормозит и падает
    const dir = stunned ? 0 : this.readDirection();
    if (dir !== 0) this.turnTo(dir);

    this.updateHorizontalSpeed(dt, dir);
    this.moveHorizontally(dt);

    if (!stunned) this.tryJump();
    this.applyGravity(dt);
  }

  private readDirection(): number {
    return (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
  }

  private turnTo(dir: number): void {
    this.facing = dir;
    this.gun.x = dir * 24;
    this.gun.scaleX = dir;
  }

  /** Подтягивает значение к цели не быстрее, чем step за кадр. */
  private approach(value: number, target: number, step: number): number {
    if (value < target) return Math.min(value + step, target);
    return Math.max(value - step, target);
  }

  /** Разгон, когда держим кнопку, и торможение, когда отпустили. */
  private updateHorizontalSpeed(dt: number, dir: number): void {
    const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const friction = this.onGround ? GROUND_FRICTION : AIR_FRICTION;
    const rate = dir === 0 ? friction : accel;

    this.velocityX = this.approach(this.velocityX, dir * PLAYER_SPEED, rate * dt);
  }

  private moveHorizontally(dt: number): void {
    if (this.velocityX === 0) return;

    const minX = FOREST_WIDTH + PLAYER_W / 2;
    const maxX = WORLD_WIDTH - FOREST_WIDTH - PLAYER_W / 2;
    let newX = this.player.x + this.velocityX * dt;

    // упёрлись в пень сбоку: встаём вплотную к нему и останавливаемся
    const stumpX = this.findBlockingStump(newX);
    if (stumpX !== undefined) {
      const side = this.player.x < stumpX ? -1 : 1;
      newX = stumpX + (side * (PLAYER_W + STUMP_W)) / 2;
      this.velocityX = 0;
    }

    // упёрлись в лес
    if (newX < minX || newX > maxX) {
      newX = Phaser.Math.Clamp(newX, minX, maxX);
      this.velocityX = 0;
    }

    this.player.x = newX;
  }

  /** Пень преграждает путь, если ноги охотника ниже верхушки пня. Возвращает X пня. */
  private findBlockingStump(x: number): number | undefined {
    const feet = this.player.y + PLAYER_H / 2;
    return STUMP_XS.find(
      (stumpX) =>
        Math.abs(x - stumpX) < (PLAYER_W + STUMP_W) / 2 && feet > this.groundY - STUMP_H + 1,
    );
  }

  /** Прыжок: можно сразу после схода с опоры (COYOTE_TIME); отпустил ↑ — прыжок ниже. */
  private tryJump(): void {
    const upHeld = this.cursors.up.isDown;

    if (upHeld && this.coyoteTimer > 0) {
      this.velocityY = -JUMP_SPEED;
      this.onGround = false;
      this.coyoteTimer = 0;
    }

    if (!upHeld && this.velocityY < -JUMP_CUT_SPEED) {
      this.velocityY = -JUMP_CUT_SPEED;
    }
  }

  private floorY(): number {
    const aboveStump = STUMP_XS.some(
      (stumpX) => Math.abs(this.player.x - stumpX) < (PLAYER_W + STUMP_W) / 2,
    );
    return aboveStump ? this.groundY - STUMP_H : this.groundY;
  }

  private applyGravity(dt: number): void {
    this.velocityY = Math.min(this.velocityY + GRAVITY * dt, MAX_FALL_SPEED);
    let feet = this.player.y + PLAYER_H / 2 + this.velocityY * dt;
    const floor = this.floorY();

    if (feet >= floor) {
      feet = floor;
      this.velocityY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.player.y = feet - PLAYER_H / 2;

    this.coyoteTimer = this.onGround ? COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);
  }

  // ---------- Приманка ----------

  private throwBait(): void {
    if (this.paused) return;

    const burrow = this.findBurrowForBait();
    if (!burrow) {
      showMessage(this, 'Рядом нет нор с призраками');
      return;
    }

    const baitX = this.player.x;
    burrow.baited = true;
    burrow.bait = this.add
      .text(baitX, this.groundY - 12, '🧠', { fontFamily: FONT, fontSize: '26px' })
      .setOrigin(0.5);

    this.ghosts
      .filter((ghost) => ghost.burrow === burrow)
      .forEach((ghost, i, arr) => {
        const offset = (i - (arr.length - 1) / 2) * 50;
        ghost.targetX = baitX + offset;
      });
  }

  private findBurrowForBait(): Burrow | undefined {
    let best: Burrow | undefined;
    let bestDistance = BAIT_RANGE;

    this.burrows.forEach((burrow) => {
      const distance = Math.abs(burrow.x - this.player.x);
      if (!burrow.baited && distance <= bestDistance) {
        best = burrow;
        bestDistance = distance;
      }
    });
    return best;
  }

  // ---------- Призраки ----------

  private checkEmerge(): void {
    this.burrows.forEach((burrow) => {
      if (!burrow.baited) return;
      if (Math.abs(this.player.x - burrow.x) < EMERGE_DISTANCE) return;

      this.ghosts
        .filter((ghost) => ghost.burrow === burrow && ghost.state === 'hidden')
        .forEach((ghost) => this.emerge(ghost));
    });
  }

  private emerge(ghost: Ghost): void {
    ghost.state = 'toBait';
    ghost.sprite.setScale(1).setAlpha(1);
    ghost.sprite.y = this.groundY - GHOST_H / 2;
  }

  private updateGhosts(dt: number): void {
    this.ghosts.forEach((ghost) => {
      switch (ghost.state) {
        case 'toBait':
          this.walkToBait(ghost, dt);
          this.checkNotice(ghost);
          break;
        case 'eating':
          this.checkNotice(ghost);
          break;
        case 'fleeing':
          this.flee(ghost, dt);
          this.checkTouch(ghost);
          break;
        case 'caught':
          this.pullToPlayer(ghost, dt);
          break;
        default:
          break;
      }
    });
  }

  private walkToBait(ghost: Ghost, dt: number): void {
    const distance = ghost.targetX - ghost.sprite.x;
    const step = GHOST_WALK_SPEED * dt;

    if (Math.abs(distance) <= step) {
      ghost.sprite.x = ghost.targetX;
      this.startEating(ghost);
    } else {
      ghost.sprite.x += Math.sign(distance) * step;
    }
  }

  private startEating(ghost: Ghost): void {
    ghost.state = 'eating';
    ghost.burrow.bait?.destroy();
    ghost.burrow.bait = undefined;
  }

  private checkNotice(ghost: Ghost): void {
    if (Math.abs(this.player.x - ghost.sprite.x) < NOTICE_DISTANCE) {
      this.startFleeing(ghost);
    }
  }

  private startFleeing(ghost: Ghost): void {
    ghost.state = 'fleeing';
    ghost.fleeDir = ghost.sprite.x < WORLD_WIDTH / 2 ? -1 : 1;
  }

  private flee(ghost: Ghost, dt: number): void {
    ghost.sprite.x += ghost.fleeDir * GHOST_FLEE_SPEED * dt;

    const reachedForest =
      ghost.sprite.x < FOREST_WIDTH || ghost.sprite.x > WORLD_WIDTH - FOREST_WIDTH;
    if (reachedForest) {
      ghost.state = 'escaped';
      ghost.sprite.setVisible(false);
    }
  }

  private checkTouch(ghost: Ghost): void {
    if (this.isStunned()) return;

    const touchesX = Math.abs(ghost.sprite.x - this.player.x) < (GHOST_W + PLAYER_W) / 2;
    const touchesY = Math.abs(ghost.sprite.y - this.player.y) < (GHOST_H + PLAYER_H) / 2;
    if (touchesX && touchesY) {
      this.stunnedUntil = this.time.now + STUN_TIME;
    }
  }

  /** Пойманный призрак летит к охотнику по прямой (а не только по X), даже если охотник в прыжке. */
  private pullToPlayer(ghost: Ghost, dt: number): void {
    const dx = this.player.x - ghost.sprite.x;
    const dy = this.player.y - ghost.sprite.y;
    const distance = Math.hypot(dx, dy);
    const step = PULL_SPEED * dt;

    if (distance <= step + 20) {
      this.putInBackpack(ghost);
      return;
    }

    ghost.sprite.x += (dx / distance) * step;
    ghost.sprite.y += (dy / distance) * step;
  }

  private putInBackpack(ghost: Ghost): void {
    ghost.state = 'inBackpack';
    ghost.sprite.setVisible(false);
    gameState.ghostsInBackpack++;
    this.harpoon = undefined;
  }

  private countGhosts(state: GhostState): number {
    return this.ghosts.filter((ghost) => ghost.state === state).length;
  }

  // ---------- Гарпун ----------

  private shootHarpoon(): void {
    if (this.paused) return;
    if (this.harpoon || this.isStunned() || this.time.now < this.nextShotAt) return;

    this.harpoon = {
      x: this.player.x + this.gun.x,
      y: this.player.y - 5,
      dir: this.facing,
      startX: this.player.x,
    };
  }

  private updateHarpoon(dt: number): void {
    this.rope.clear();
    const harpoon = this.harpoon;
    if (!harpoon) return;

    if (!harpoon.target) this.flyHarpoon(harpoon, dt);
    if (this.harpoon) this.drawRope(harpoon);
  }

  private flyHarpoon(harpoon: Harpoon, dt: number): void {
    harpoon.x += harpoon.dir * HARPOON_SPEED * dt;

    // гарпун, как и охотник, не проходит сквозь пень (над пнем — пролетает)
    if (this.harpoonHitsStump(harpoon)) {
      this.missHarpoon();
      return;
    }

    const hitGhost = this.findHitGhost(harpoon);
    if (hitGhost) {
      hitGhost.state = 'caught';
      harpoon.target = hitGhost;
      return;
    }

    if (Math.abs(harpoon.x - harpoon.startX) > HARPOON_RANGE) {
      this.missHarpoon();
    }
  }

  private missHarpoon(): void {
    this.harpoon = undefined;
    this.nextShotAt = this.time.now + HARPOON_COOLDOWN;
  }

  private harpoonHitsStump(harpoon: Harpoon): boolean {
    const belowStumpTop = harpoon.y > this.groundY - STUMP_H;
    return belowStumpTop && STUMP_XS.some((stumpX) => Math.abs(harpoon.x - stumpX) < STUMP_W / 2);
  }

  private findHitGhost(harpoon: Harpoon): Ghost | undefined {
    const targetable: GhostState[] = ['toBait', 'eating', 'fleeing'];
    return this.ghosts.find(
      (ghost) =>
        targetable.includes(ghost.state) &&
        Math.abs(harpoon.x - ghost.sprite.x) < GHOST_W / 2 + 5 &&
        Math.abs(harpoon.y - ghost.sprite.y) < GHOST_H / 2 + 10,
    );
  }

  private drawRope(harpoon: Harpoon): void {
    const tipX = harpoon.target ? harpoon.target.sprite.x : harpoon.x;
    const tipY = harpoon.target ? harpoon.target.sprite.y : harpoon.y;

    this.rope.lineStyle(3, 0xe5e7eb);
    this.rope.lineBetween(this.player.x + this.gun.x, this.player.y - 5, tipX, tipY);
    this.rope.fillStyle(0xfacc15);
    this.rope.fillCircle(tipX, tipY, 6);
  }

  // ---------- HUD ----------

  private updateHud(): void {
    const total = this.ghosts.length;
    const caught = this.countGhosts('inBackpack');

    this.backpackText.setText(`Рюкзак: ${gameState.ghostsInBackpack} 👻`);
    this.captureText.setText(`Захват: ${caught}/${total}`);

    this.hudBar.clear();
    this.hudBar.fillStyle(0x1f2937);
    this.hudBar.fillRect(20, 48, BAR_WIDTH, 18);
    this.hudBar.fillStyle(0x22c55e);
    this.hudBar.fillRect(20, 48, (BAR_WIDTH * caught) / total, 18);
  }

  private checkLevelEnd(): void {
    if (this.levelOver) return;

    const unfinished = this.ghosts.some(
      (ghost) => ghost.state !== 'inBackpack' && ghost.state !== 'escaped',
    );
    if (unfinished) return;

    this.levelOver = true;
    const caught = this.countGhosts('inBackpack');
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `Охота окончена!\nПоймано: ${caught} из ${this.ghosts.length}`,
        {
          fontFamily: FONT,
          fontSize: '36px',
          color: '#ffffff',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
  }

  private goToPizzeria(): void {
    this.scene.stop();
    this.scene.wake('GameScene');
  }
}