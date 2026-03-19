// Advanced Game Engine for Absorbio - Native Implementation
import { Vector2 } from './game-engine';

export interface GameObject {
  id: string;
  x: number;
  y: number;
  radius: number;
  mass: number;
  type: 'player' | 'food' | 'bot' | 'dangerZone' | 'blackHole';
  color?: string;
  name?: string;
  instability?: number;
  massInstability?: number;
  alive?: boolean;
}

export interface Bot extends GameObject {
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  state: 'farm' | 'huntPlayer' | 'huntBot' | 'fear';
  fearTimer: number;
  instabilityThreshold: number;
}

export interface DangerZone extends GameObject {
  baseRadius: number;
  pulse: number;
  pulseSpeed: number;
  vx: number;
  vy: number;
}

export interface BlackHole extends GameObject {
  pullRadius: number;
}

export interface GameState {
  player: GameObject & { instability: number; mass: number; score: number; coins: number };
  foods: GameObject[];
  bots: Bot[];
  dangerZones: DangerZone[];
  blackHoles: BlackHole[];
  score: number;
  coins: number;
  level: number;
  xp: number;
  eventText: string | null;
  isGameOver: boolean;
  mode: 'infinity' | 'time' | 'survival';
}

export class BlackholeEngine {
  public worldSize: number = 8000;
  private gameState: GameState;
  private frameCount: number = 0;
  
  // Event system
  private nextEventTime: number = Date.now() + 30000;
  private eventEndTime: number = 0;
  private currentEvent: 'zone' | 'blackhole' | null = null;
  
  // Rocket Surge
  public rocketActive: boolean = false;
  public rocketTimer: number = 0;
  public rocketCooldown: number = 0;
  public instabilityFreezeTimer: number = 0;

  constructor(mode: 'infinity' | 'time' | 'survival' = 'infinity') {
    this.gameState = {
      player: {
        id: 'player',
        x: this.worldSize / 2,
        y: this.worldSize / 2,
        radius: 15,
        mass: 10,
        type: 'player',
        color: '#a855f7',
        instability: 0,
        score: 0,
        coins: 0,
      },
      foods: [],
      bots: [],
      dangerZones: [],
      blackHoles: [],
      score: 0,
      coins: 0,
      level: 1,
      xp: 0,
      eventText: null,
      isGameOver: false,
      mode,
    };

    this.spawnInitialObjects();
  }

  private spawnInitialObjects() {
    for (let i = 0; i < 200; i++) this.spawnFood();
    for (let i = 0; i < 15; i++) this.spawnBot();
  }

  private spawnFood() {
    const food: GameObject = {
      id: `food-${Math.random()}`,
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      radius: 4 + Math.random() * 6,
      mass: 1,
      type: 'food',
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    };
    this.gameState.foods.push(food);
  }

  private spawnBot() {
    const bot: Bot = {
      id: `bot-${Math.random()}`,
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      radius: 15 + Math.random() * 20,
      mass: 10 + Math.random() * 50,
      type: 'bot',
      name: `Bot ${Math.floor(Math.random() * 1000)}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      vx: 0, vy: 0,
      targetX: Math.random() * this.worldSize,
      targetY: Math.random() * this.worldSize,
      state: 'farm',
      fearTimer: 0,
      instabilityThreshold: 100000 + Math.random() * 400000,
      alive: true,
      massInstability: 0,
    };
    this.gameState.bots.push(bot);
  }

  private clampToCircularWorld(x: number, y: number, radius: number) {
    const centerX = this.worldSize / 2;
    const centerY = this.worldSize / 2;
    const maxRadius = this.worldSize / 2 - radius;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) {
      const angle = Math.atan2(dy, dx);
      return {
        x: centerX + Math.cos(angle) * maxRadius,
        y: centerY + Math.sin(angle) * maxRadius,
      };
    }
    return { x, y };
  }

  update(deltaTime: number, playerInput: Vector2) {
    if (this.gameState.isGameOver) return;
    this.frameCount++;

    // 1. Update Player
    const speedMult = this.rocketActive ? 2.5 : 1.0;
    const maxSpeed = (5 - (this.gameState.player.radius - 15) * 0.02) * speedMult;
    this.gameState.player.x += playerInput.x * maxSpeed * deltaTime * 100;
    this.gameState.player.y += playerInput.y * maxSpeed * deltaTime * 100;
    
    const clamped = this.clampToCircularWorld(this.gameState.player.x, this.gameState.player.y, this.gameState.player.radius);
    this.gameState.player.x = clamped.x;
    this.gameState.player.y = clamped.y;

    // 2. Update Instability
    this.updateInstability(deltaTime);

    // 3. Update Bots AI
    this.updateBots(deltaTime);

    // 4. Update Events (Danger Zones, Black Holes)
    this.updateEvents(deltaTime);

    // 5. Collisions
    this.handleCollisions();

    // 6. Level Up
    const xpNeeded = 200 + 40 * Math.pow(this.gameState.level, 3);
    if (this.gameState.xp >= xpNeeded) {
      this.gameState.level++;
      this.gameState.xp -= xpNeeded;
    }

    // 7. Rocket Cooldown
    if (this.rocketTimer > 0) {
      this.rocketTimer -= deltaTime;
      if (this.rocketTimer <= 0) this.rocketActive = false;
    }
    if (this.rocketCooldown > 0) this.rocketCooldown -= deltaTime;
    if (this.instabilityFreezeTimer > 0) this.instabilityFreezeTimer -= deltaTime;
  }

  private updateInstability(deltaTime: number) {
    if (this.instabilityFreezeTimer > 0) return;
    
    const player = this.gameState.player;
    if (player.mass > 50000) {
      const overMass = player.mass - 50000;
      const rate = 0.01 + (overMass / 500000) * 0.4;
      player.instability += rate * deltaTime * 10;
    } else {
      player.instability = Math.max(0, player.instability - 0.12 * deltaTime * 10);
    }

    if (player.instability >= 100) this.gameState.isGameOver = true;
  }

  private updateBots(deltaTime: number) {
    this.gameState.bots.forEach(bot => {
      if (!bot.alive) return;

      // Simple AI State Machine
      const distToPlayer = Math.sqrt(Math.pow(bot.x - this.gameState.player.x, 2) + Math.pow(bot.y - this.gameState.player.y, 2));
      
      if (distToPlayer < 500 && this.gameState.player.radius > bot.radius * 1.2) {
        bot.state = 'fear';
        bot.targetX = bot.x + (bot.x - this.gameState.player.x);
        bot.targetY = bot.y + (bot.y - this.gameState.player.y);
      } else if (distToPlayer < 800 && bot.radius > this.gameState.player.radius * 1.2) {
        bot.state = 'huntPlayer';
        bot.targetX = this.gameState.player.x;
        bot.targetY = this.gameState.player.y;
      } else {
        bot.state = 'farm';
        if (Math.random() < 0.01) {
          bot.targetX = Math.random() * this.worldSize;
          bot.targetY = Math.random() * this.worldSize;
        }
      }

      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
        const speed = 1.5;
        bot.vx = (dx / dist) * speed;
        bot.vy = (dy / dist) * speed;
      }

      bot.x += bot.vx * deltaTime * 100;
      bot.y += bot.vy * deltaTime * 100;
      
      const clamped = this.clampToCircularWorld(bot.x, bot.y, bot.radius);
      bot.x = clamped.x;
      bot.y = clamped.y;

      // Bot Instability
      if (bot.mass > 100000) {
        bot.massInstability = (bot.massInstability || 0) + 0.05 * deltaTime * 10;
        if (bot.massInstability >= 100) bot.alive = false;
      }
    });
  }

  private updateEvents(deltaTime: number) {
    const now = Date.now();
    if (!this.currentEvent && now > this.nextEventTime) {
      this.currentEvent = Math.random() > 0.5 ? 'zone' : 'blackhole';
      this.eventEndTime = now + 30000;
      this.gameState.eventText = this.currentEvent === 'zone' ? '⚠️ Danger Zone!' : '🌀 Black Hole!';
      
      if (this.currentEvent === 'zone') {
        this.gameState.dangerZones = [{
          id: 'dz-1', x: Math.random() * this.worldSize, y: Math.random() * this.worldSize,
          radius: 300, baseRadius: 300, pulse: 0, pulseSpeed: 0.05, vx: 1, vy: 1, type: 'dangerZone',
          mass: 0
        }];
      } else {
        this.gameState.blackHoles = [{
          id: 'bh-1', x: this.worldSize / 2, y: this.worldSize / 2,
          radius: 200, pullRadius: 800, mass: 1000000, type: 'blackHole'
        }];
      }
      setTimeout(() => this.gameState.eventText = null, 3000);
    }

    if (this.currentEvent && now > this.eventEndTime) {
      this.currentEvent = null;
      this.gameState.dangerZones = [];
      this.gameState.blackHoles = [];
      this.nextEventTime = now + 60000;
    }

    // Update Danger Zone pulse
    this.gameState.dangerZones.forEach(zone => {
      zone.pulse += zone.pulseSpeed;
      zone.radius = zone.baseRadius + Math.sin(zone.pulse) * 50;
      zone.x += zone.vx;
      zone.y += zone.vy;
    });
  }

  private handleCollisions() {
    const player = this.gameState.player;

    // Player vs Food
    this.gameState.foods = this.gameState.foods.filter(food => {
      const dist = Math.sqrt(Math.pow(player.x - food.x, 2) + Math.pow(player.y - food.y, 2));
      if (dist < player.radius) {
        player.mass += 1;
        player.score += 10;
        player.coins += 1;
        this.gameState.xp += 5;
        player.radius = 15 + Math.pow(player.mass, 0.35) * 2;
        this.spawnFood();
        return false;
      }
      return true;
    });

    // Player vs Bots
    this.gameState.bots.forEach(bot => {
      if (!bot.alive) return;
      const dist = Math.sqrt(Math.pow(player.x - bot.x, 2) + Math.pow(player.y - bot.y, 2));
      if (dist < player.radius + bot.radius) {
        if (player.radius > bot.radius * 1.1) {
          player.mass += bot.mass;
          player.score += 100;
          this.gameState.xp += 50;
          bot.alive = false;
          player.radius = 15 + Math.pow(player.mass, 0.35) * 2;
        } else if (bot.radius > player.radius * 1.1) {
          this.gameState.isGameOver = true;
        }
      }
    });
  }

  activateSurge() {
    if (this.rocketCooldown > 0 || this.gameState.player.mass < 20000) return;
    this.rocketActive = true;
    this.rocketTimer = 10;
    this.rocketCooldown = 40;
    this.instabilityFreezeTimer = 10;
  }

  getGameState() { return this.gameState; }
}
