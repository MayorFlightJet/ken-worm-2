// ═══════════════════════════════════════════════
//  WORM.IO — AI Bot Logic
// ═══════════════════════════════════════════════
//
//  State Machine:
//    PATROL  → moving inside own territory, heading to edge
//    VENTURE → left territory, building trail in a rectangular loop
//    RETURN  → heading back to own territory
//

class Bot extends Worm {
    constructor(id, startX, startY, colorScheme, grid) {
        super(id, startX, startY, colorScheme, grid);

        // AI State
        this.state = 'PATROL';
        this.stateTimer = 0;

        // Venture plan
        this.plan = [];          // array of { dx, dy, steps }
        this.planIndex = 0;
        this.planStepsDone = 0;

        // Patrol
        this.patrolTimer = 15 + Math.floor(Math.random() * 20);
        this.patrolTurnTimer = 3 + Math.floor(Math.random() * 5);

        // Difficulty
        this.aggressiveness = 0.5 + Math.random() * 0.5; // 0.5 - 1.0
    }

    // ── Main AI Tick ──────────────────────────
    think() {
        if (!this.alive) return;

        switch (this.state) {
            case 'PATROL':
                this._doPatrol();
                break;
            case 'VENTURE':
                this._doVenture();
                break;
            case 'RETURN':
                this._doReturn();
                break;
        }

        // Safety: always check and avoid walls
        this._avoidWalls();
    }

    // ── PATROL: wander inside territory ───────
    _doPatrol() {
        this.stateTimer++;

        // Random turns inside territory
        this.patrolTurnTimer--;
        if (this.patrolTurnTimer <= 0) {
            this._randomTurn();
            this.patrolTurnTimer = 2 + Math.floor(Math.random() * 4);
        }

        // After enough patrol time, create a venture plan
        if (this.stateTimer >= this.patrolTimer) {
            this._createVenturePlan();
            this.state = 'VENTURE';
            this.stateTimer = 0;
        }
    }

    // ── VENTURE: execute rectangular claim loop ─
    _doVenture() {
        if (this.planIndex >= this.plan.length) {
            // Plan exhausted, switch to return
            this.state = 'RETURN';
            this.stateTimer = 0;
            return;
        }

        const step = this.plan[this.planIndex];

        // Set direction for this leg of the plan
        this.dir = { x: step.dx, y: step.dy };
        this.nextDir = null;
        this.planStepsDone++;

        if (this.planStepsDone >= step.steps) {
            this.planIndex++;
            this.planStepsDone = 0;
        }

        // Safety: if trail gets too long, abort and return
        if (this.trail.length > 40) {
            this.state = 'RETURN';
            this.stateTimer = 0;
        }
    }

    // ── RETURN: head back to own territory ────
    _doReturn() {
        this.stateTimer++;

        // Find direction towards nearest own territory
        const nearest = this.grid.findNearestTerritory(this.x, this.y, this.id);

        if (nearest.dist === 0 || nearest.dist === Infinity) {
            // Already on territory or can't find any - go to patrol
            this.state = 'PATROL';
            this.stateTimer = 0;
            this.patrolTimer = 10 + Math.floor(Math.random() * 15);
            return;
        }

        // Greedy: move towards the nearest territory cell
        const dx = Math.sign(nearest.x - this.x);
        const dy = Math.sign(nearest.y - this.y);

        // Prefer the axis with greater distance
        if (Math.abs(nearest.x - this.x) >= Math.abs(nearest.y - this.y)) {
            if (dx !== 0 && this._isSafeDir(dx, 0)) {
                this.dir = { x: dx, y: 0 };
            } else if (dy !== 0 && this._isSafeDir(0, dy)) {
                this.dir = { x: 0, y: dy };
            }
        } else {
            if (dy !== 0 && this._isSafeDir(0, dy)) {
                this.dir = { x: 0, y: dy };
            } else if (dx !== 0 && this._isSafeDir(dx, 0)) {
                this.dir = { x: dx, y: 0 };
            }
        }

        this.nextDir = null;

        // Timeout: if stuck too long, just patrol
        if (this.stateTimer > 80) {
            this.state = 'PATROL';
            this.stateTimer = 0;
            this.patrolTimer = 5;
        }
    }

    // ── Create a rectangular venture plan ─────
    _createVenturePlan() {
        // Determine a random direction to go
        const dirs = [
            { x: 0, y: -1 }, // up
            { x: 1, y: 0 },  // right
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }, // left
        ];

        // Pick a direction that leads outside territory
        let exitDir = dirs[Math.floor(Math.random() * dirs.length)];

        // Size of the rectangle to claim
        const legLength = Math.floor(4 + Math.random() * 8 * this.aggressiveness);
        const legWidth = Math.floor(3 + Math.random() * 6 * this.aggressiveness);

        // Turn direction: right (clockwise) or left
        const clockwise = Math.random() > 0.5;

        const turnRight = (d) => ({ x: -d.y, y: d.x });
        const turnLeft = (d) => ({ x: d.y, y: -d.x });
        const turn = clockwise ? turnRight : turnLeft;

        const d1 = exitDir;
        const d2 = turn(d1);
        const d3 = turn(d2);
        const d4 = turn(d3);

        this.plan = [
            { dx: d1.x, dy: d1.y, steps: legLength },
            { dx: d2.x, dy: d2.y, steps: legWidth },
            { dx: d3.x, dy: d3.y, steps: legLength },
            { dx: d4.x, dy: d4.y, steps: legWidth + 2 }, // extra to ensure return
        ];
        this.planIndex = 0;
        this.planStepsDone = 0;
    }

    // ── Safety: avoid walls ───────────────────
    _avoidWalls() {
        const nx = this.x + this.dir.x;
        const ny = this.y + this.dir.y;

        if (!this.grid.inBounds(nx, ny)) {
            // Try turning
            const alternatives = this._getAlternativeDirections();
            for (const alt of alternatives) {
                const ax = this.x + alt.x;
                const ay = this.y + alt.y;
                if (this.grid.inBounds(ax, ay) && this._isSafeDir(alt.x, alt.y)) {
                    this.dir = alt;
                    this.nextDir = null;
                    // If we were venturing, abort plan
                    if (this.state === 'VENTURE') {
                        this.state = 'RETURN';
                        this.stateTimer = 0;
                    }
                    return;
                }
            }
        }
    }

    // ── Check if a direction is safe ──────────
    _isSafeDir(dx, dy) {
        const nx = this.x + dx;
        const ny = this.y + dy;

        // Out of bounds
        if (!this.grid.inBounds(nx, ny)) return false;

        // Would hit own trail
        if (this.trailSet.has(Worm.key(nx, ny))) return false;

        // Prevent 180 reversal
        if (this.dir.x + dx === 0 && this.dir.y + dy === 0) return false;

        return true;
    }

    // ── Get alternative directions ────────────
    _getAlternativeDirections() {
        const allDirs = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
        ];

        // Shuffle for variety
        for (let i = allDirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allDirs[i], allDirs[j]] = [allDirs[j], allDirs[i]];
        }

        return allDirs.filter(d => !(d.x === this.dir.x && d.y === this.dir.y));
    }

    // ── Random turn ───────────────────────────
    _randomTurn() {
        const options = [];
        const allDirs = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
        ];

        for (const d of allDirs) {
            // Skip 180 reversal and current direction
            if (d.x + this.dir.x === 0 && d.y + this.dir.y === 0) continue;
            if (this._isSafeDir(d.x, d.y)) {
                options.push(d);
            }
        }

        if (options.length > 0) {
            this.dir = options[Math.floor(Math.random() * options.length)];
            this.nextDir = null;
        }
    }
}
