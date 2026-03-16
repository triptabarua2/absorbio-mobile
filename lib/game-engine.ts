// Game Engine for Absorbio - Core Physics and Logic

export interface Vector2 {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  mass: number;
  type: 'player' | 'food' | 'enemy';
  color?: string;
  score?: number;
  coins?: number;
}

export interface GameState {
  player: GameObject;
  foods: GameObject[];
  enemies: GameObject[];
  score: number;
  coins: number;
  level: number;
  xp: number;
  gameTime: number;
  isGameOver: boolean;
}

export class GameEngine {
  private worldSize: number = 8000;
  private gameState: GameState;
  private frameCount: number = 0;

  constructor(playerName: string = 'Player') {
    this.gameState = {
      player: {
        id: 'player',
        x: this.worldSize / 2,
        y: this.worldSize / 2,
        radius: 10,
        vx: 0,
        vy: 0,
        mass: 5,
        type: 'player',
        color: '#a855f7',
        score: 0,
        coins: 0,
      },
      foods: [],
      enemies: [],
      score: 0,
      coins: 0,
      level: 1,
      xp: 0,
      gameTime: 0,
      isGameOver: false,
    };

    // Initialize food and enemies
    this.spawnInitialObjects();
  }

  private spawnInitialObjects() {
    // Spawn 50 food items
    for (let i = 0; i < 50; i++) {
      this.spawnFood();
    }

    // Spawn 10 enemies
    for (let i = 0; i < 10; i++) {
      this.spawnEnemy();
    }
  }

  spawnFood() {
    const food: GameObject = {
      id: `food-${Date.now()}-${Math.random()}`,
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      radius: 3 + Math.random() * 5,
      vx: 0,
      vy: 0,
      mass: 1,
      type: 'food',
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      score: 10,
      coins: 1,
    };
    this.gameState.foods.push(food);
  }

  spawnEnemy() {
    const enemy: GameObject = {
      id: `enemy-${Date.now()}-${Math.random()}`,
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      radius: 5 + Math.random() * 10,
      vx: 0,
      vy: 0,
      mass: 2 + Math.random() * 3,
      type: 'enemy',
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      score: 20,
      coins: 2,
    };
    this.gameState.enemies.push(enemy);
  }

  update(deltaTime: number, playerInput: Vector2) {
    if (this.gameState.isGameOver) return;

    this.frameCount++;
    this.gameState.gameTime += deltaTime;

    // Update player movement
    const maxSpeed = 5 - (this.gameState.player.radius - 10) * 0.05; // Slower as bigger
    this.gameState.player.vx = playerInput.x * maxSpeed;
    this.gameState.player.vy = playerInput.y * maxSpeed;

    // Update player position
    this.gameState.player.x += this.gameState.player.vx * deltaTime * 100;
    this.gameState.player.y += this.gameState.player.vy * deltaTime * 100;

    // Clamp player to world bounds
    this.gameState.player.x = Math.max(
      this.gameState.player.radius,
      Math.min(this.worldSize - this.gameState.player.radius, this.gameState.player.x)
    );
    this.gameState.player.y = Math.max(
      this.gameState.player.radius,
      Math.min(this.worldSize - this.gameState.player.radius, this.gameState.player.y)
    );

    // Update enemies (simple AI - move towards player)
    this.gameState.enemies.forEach((enemy) => {
      const dx = this.gameState.player.x - enemy.x;
      const dy = this.gameState.player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const speed = 1.5;
        enemy.vx = (dx / dist) * speed;
        enemy.vy = (dy / dist) * speed;
      }

      enemy.x += enemy.vx * deltaTime * 100;
      enemy.y += enemy.vy * deltaTime * 100;

      // Clamp enemy to world bounds
      enemy.x = Math.max(enemy.radius, Math.min(this.worldSize - enemy.radius, enemy.x));
      enemy.y = Math.max(enemy.radius, Math.min(this.worldSize - enemy.radius, enemy.y));
    });

    // Check collisions with food
    this.gameState.foods = this.gameState.foods.filter((food) => {
      const dx = this.gameState.player.x - food.x;
      const dy = this.gameState.player.y - food.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.gameState.player.radius + food.radius) {
        // Absorb food
        this.gameState.score += food.score || 10;
        this.gameState.coins += food.coins || 1;
        this.gameState.xp += 5;
        this.grow(0.1);

        // Spawn new food to replace
        this.spawnFood();
        return false; // Remove food
      }
      return true;
    });

    // Check collisions with enemies
    this.gameState.enemies.forEach((enemy) => {
      const dx = this.gameState.player.x - enemy.x;
      const dy = this.gameState.player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.gameState.player.radius + enemy.radius) {
        if (this.gameState.player.radius > enemy.radius) {
          // Player absorbs enemy
          this.gameState.score += enemy.score || 20;
          this.gameState.coins += enemy.coins || 2;
          this.gameState.xp += 10;
          this.grow(0.2);
        } else if (enemy.radius > this.gameState.player.radius) {
          // Player is eaten
          this.gameState.isGameOver = true;
        }
      }
    });

    // Level up check
    if (this.gameState.xp >= 200) {
      this.levelUp();
    }

    // Spawn new enemies periodically
    if (this.frameCount % 300 === 0 && this.gameState.enemies.length < 20) {
      this.spawnEnemy();
    }
  }

  private grow(amount: number) {
    const newRadius = this.gameState.player.radius + amount;
    if (newRadius < 50) {
      this.gameState.player.radius = newRadius;
    }
  }

  private levelUp() {
    this.gameState.level++;
    this.gameState.xp -= 200;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  setPlayerInput(input: Vector2) {
    // Input is already applied in update method
  }

  resetGame() {
    this.gameState.isGameOver = false;
    this.gameState.score = 0;
    this.gameState.coins = 0;
    this.gameState.level = 1;
    this.gameState.xp = 0;
    this.gameState.gameTime = 0;
    this.gameState.player = {
      id: 'player',
      x: this.worldSize / 2,
      y: this.worldSize / 2,
      radius: 10,
      vx: 0,
      vy: 0,
      mass: 5,
      type: 'player',
      color: '#a855f7',
      score: 0,
      coins: 0,
    };
    this.gameState.foods = [];
    this.gameState.enemies = [];
    this.frameCount = 0;
    this.spawnInitialObjects();
  }
}
