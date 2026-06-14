// ═══════════════════════════════════════════════
//  WORM.IO — Main Game Controller
// ═══════════════════════════════════════════════

class Game {
    constructor() {
        // Core systems
        this.grid = new Grid(CONFIG.GRID_W, CONFIG.GRID_H);
        this.renderer = new Renderer(
            document.getElementById('gameCanvas'),
            document.getElementById('minimapCanvas'),
            this.grid
        );
        this.controls = new Controls();
        this.ui = new UI();

        // Worms array: index 0 = player, rest = bots
        this.worms = [];
        this.player = null;
        this.bots = [];

        // Timing
        this.lastTickTime = 0;
        this.tickInterval = 1000 / CONFIG.TICK_RATE;
        this.tickProgress = 0;
        this.gameTime = 0; // total seconds played
        this.running = false;

        // Bot respawn timers
        this.respawnQueue = [];

        // Setup UI callbacks
        this.ui.onPlay = () => this.startGame();
        this.ui.onRestart = () => this.startGame();

        // Show start screen
        this.ui.showScreen('start');

        // Start render loop (even on start screen for bg)
        this._renderLoop(0);
    }

    // ── Start New Game ────────────────────────
    startGame() {
        // Reset grid
        this.grid.cells.fill(0);

        // Create worms
        this.worms = [];
        this.bots = [];
        this.respawnQueue = [];

        // Player (id = 1)
        const sp = SPAWN_POSITIONS[0];
        this.player = new Worm(1, sp.x, sp.y, WORM_COLORS[0], this.grid);
        this.grid.initTerritory(1, sp.x, sp.y, CONFIG.INITIAL_TERRITORY);
        this.worms.push(this.player);

        // Bots (id = 2, 3, 4)
        for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
            const bsp = SPAWN_POSITIONS[i + 1];
            const bot = new Bot(i + 2, bsp.x, bsp.y, WORM_COLORS[i + 1], this.grid);
            this.grid.initTerritory(i + 2, bsp.x, bsp.y, CONFIG.INITIAL_TERRITORY);
            this.bots.push(bot);
            this.worms.push(bot);
        }

        // Setup controls
        this.controls.init(
            document.getElementById('joystickZone'),
            document.getElementById('joystickBase'),
            document.getElementById('joystickThumb')
        );

        // Reset timing
        this.lastTickTime = performance.now();
        this.tickProgress = 0;
        this.gameTime = 0;
        this.running = true;

        // Camera snap to player
        this.renderer.updateCamera(this.player.x, this.player.y, false);

        // Show playing screen
        this.ui.showScreen('playing');

        // Start game loop
        this._gameLoop(performance.now());
    }

    // ── Main Game Loop ────────────────────────
    _gameLoop(timestamp) {
        if (!this.running) return;

        const elapsed = timestamp - this.lastTickTime;
        this.tickProgress = Math.min(elapsed / this.tickInterval, 1);

        // Fixed timestep: tick when enough time has passed
        if (elapsed >= this.tickInterval) {
            this.lastTickTime = timestamp;
            this.tickProgress = 0;
            this.gameTime += this.tickInterval / 1000;

            this._tick();
        }

        // Update camera to follow player smoothly
        if (this.player.alive) {
            const visualPos = this.player.getVisualPos(this.tickProgress);
            this.renderer.updateCamera(visualPos.x, visualPos.y, true);
        }

        // Render
        this.renderer.render(this.worms, 0, this.tickProgress);

        // Update UI
        this._updateUI();

        requestAnimationFrame((t) => this._gameLoop(t));
    }

    // ── Render-only loop (for menu screens) ───
    _renderLoop(timestamp) {
        if (this.running) return; // game loop takes over

        // Simple animated bg
        const ctx = this.renderer.ctx;
        this.renderer._drawBackground(ctx);

        requestAnimationFrame((t) => this._renderLoop(t));
    }

    // ── Game Tick (fixed timestep logic) ──────
    _tick() {
        // Process bot respawns
        this._processRespawns();

        // 1. Process player input
        const inputDir = this.controls.consumeDirection();
        if (inputDir && this.player.alive) {
            this.player.setDirection(inputDir.x, inputDir.y);
        }

        // 2. Bot AI decisions
        for (const bot of this.bots) {
            if (bot.alive) {
                bot.think();
            }
        }

        // 3. Move all worms
        for (const worm of this.worms) {
            if (!worm.alive) continue;

            const result = worm.move();

            if (result === 'dead') {
                this._onWormDeath(worm);
            } else if (result && result.type === 'claim') {
                // Territory was claimed — check for kills from territory takeover
            }
        }

        // 4. Check trail collisions (head vs other's trail)
        this._checkTrailCollisions();

        // 5. Check head-to-head collisions
        this._checkHeadCollisions();

        // 6. Check win condition
        this._checkWinCondition();
    }

    // ── Trail Collision Detection ─────────────
    // If worm A's head is on worm B's trail → worm B dies
    _checkTrailCollisions() {
        for (const attacker of this.worms) {
            if (!attacker.alive) continue;

            for (const victim of this.worms) {
                if (!victim.alive || attacker === victim) continue;

                // Is attacker's head on victim's trail?
                if (victim.isOnTrail(attacker.x, attacker.y)) {
                    victim.die('trail-kill');
                    attacker.kills++;

                    this.ui.addKillMessage(
                        attacker.color.name, attacker.color.main,
                        victim.color.name, victim.color.main,
                        'trail-kill'
                    );

                    if (victim === this.player) {
                        this._onPlayerDeath();
                        return;
                    } else {
                        this._onBotDeath(victim);
                    }
                }
            }
        }
    }

    // ── Head Collision Detection ───────────────
    _checkHeadCollisions() {
        for (let i = 0; i < this.worms.length; i++) {
            for (let j = i + 1; j < this.worms.length; j++) {
                const a = this.worms[i];
                const b = this.worms[j];
                if (!a.alive || !b.alive) continue;

                if (a.x === b.x && a.y === b.y) {
                    // Both die
                    a.die('head-collision');
                    b.die('head-collision');

                    this.ui.addKillMessage(
                        a.color.name, a.color.main,
                        b.color.name, b.color.main,
                        'trail-kill'
                    );

                    if (a === this.player || b === this.player) {
                        this._onPlayerDeath();
                        return;
                    }

                    this._onBotDeath(a);
                    this._onBotDeath(b);
                }
            }
        }
    }

    // ── Worm Death Handlers ───────────────────
    _onWormDeath(worm) {
        const reason = worm.deathReason || 'unknown';

        if (reason === 'wall' || reason === 'self-trail') {
            this.ui.addKillMessage(
                '', '', worm.color.name, worm.color.main, reason
            );
        }

        if (worm === this.player) {
            this._onPlayerDeath();
        } else {
            this._onBotDeath(worm);
        }
    }

    _onPlayerDeath() {
        // Game over
        const pct = this.grid.getPercentage(this.player.id);
        this.running = false;

        setTimeout(() => {
            this.ui.showGameOver(false, {
                territory: pct,
                kills: this.player.kills,
                time: this.gameTime,
            });
            this._renderLoop(0);
        }, 500);
    }

    _onBotDeath(bot) {
        // Clear bot territory
        this.grid.clearTerritory(bot.id);

        // Schedule respawn
        this.respawnQueue.push({
            bot: bot,
            respawnAt: performance.now() + CONFIG.RESPAWN_DELAY,
        });
    }

    // ── Process Bot Respawns ──────────────────
    _processRespawns() {
        const now = performance.now();

        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            const entry = this.respawnQueue[i];
            if (now >= entry.respawnAt) {
                // Find a safe spawn position
                const pos = this._findSafeSpawn();
                entry.bot.respawn(pos.x, pos.y);

                this.respawnQueue.splice(i, 1);
            }
        }
    }

    // ── Find safe spawn position ──────────────
    _findSafeSpawn() {
        const margin = 10;
        for (let attempt = 0; attempt < 50; attempt++) {
            const x = margin + Math.floor(Math.random() * (CONFIG.GRID_W - margin * 2));
            const y = margin + Math.floor(Math.random() * (CONFIG.GRID_H - margin * 2));

            // Check if area is mostly unclaimed
            let safe = true;
            const half = Math.floor(CONFIG.INITIAL_TERRITORY / 2);
            for (let dy = -half; dy <= half && safe; dy++) {
                for (let dx = -half; dx <= half && safe; dx++) {
                    const owner = this.grid.get(x + dx, y + dy);
                    if (owner > 0) safe = false;
                }
            }

            if (safe) return { x, y };
        }

        // Fallback: random position
        return {
            x: margin + Math.floor(Math.random() * (CONFIG.GRID_W - margin * 2)),
            y: margin + Math.floor(Math.random() * (CONFIG.GRID_H - margin * 2)),
        };
    }

    // ── Win Condition ─────────────────────────
    _checkWinCondition() {
        const percentages = this.grid.getAllPercentages(this.worms.length);

        for (const worm of this.worms) {
            if (!worm.alive) continue;
            if ((percentages[worm.id] || 0) >= 80) {
                // Win at 80% for practical gameplay
                this.running = false;

                const isPlayerWin = worm === this.player;

                setTimeout(() => {
                    this.ui.showGameOver(isPlayerWin, {
                        territory: percentages[this.player.id] || 0,
                        kills: this.player.kills,
                        time: this.gameTime,
                    });
                    this._renderLoop(0);
                }, 800);

                return;
            }
        }
    }

    // ── Update HUD ────────────────────────────
    _updateUI() {
        if (!this.running) return;

        const percentages = this.grid.getAllPercentages(this.worms.length);
        const playerPct = percentages[this.player.id] || 0;

        this.ui.updateProgress(playerPct);
        this.ui.updateLeaderboard(this.worms, percentages);
    }
}

// ── Initialize Game ───────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
