// ═══════════════════════════════════════════════
//  WORM.IO — Worm Base Class
// ═══════════════════════════════════════════════

class Worm {
    constructor(id, startX, startY, colorScheme, grid) {
        this.id = id;
        this.grid = grid;
        this.color = colorScheme;

        // Position (grid coordinates)
        this.x = startX;
        this.y = startY;
        this.prevX = startX;
        this.prevY = startY;

        // Direction
        this.dir = { ...DIRECTIONS.RIGHT };
        this.nextDir = null; // buffered input

        // Trail (cells left outside territory)
        this.trail = [];
        this.trailSet = new Set(); // for O(1) lookup: "x,y" strings

        // Body segments (for visual rendering)
        this.body = [];
        this.bodyLength = CONFIG.WORM_BODY_LENGTH;

        // State
        this.alive = true;
        this.isOutside = false;
        this.kills = 0;
        this.homeX = startX;
        this.homeY = startY;
    }

    // ── Key helper ────────────────────────────
    static key(x, y) {
        return (x << 16) | (y & 0xFFFF);
    }

    // ── Set Direction (with 180° prevention) ──
    setDirection(dx, dy) {
        // Prevent 180° reversal
        if (this.dir.x + dx === 0 && this.dir.y + dy === 0) return;
        this.nextDir = { x: dx, y: dy };
    }

    // ── Move one step ─────────────────────────
    move() {
        if (!this.alive) return;

        // Apply buffered direction
        if (this.nextDir) {
            // Double-check 180° prevention
            if (this.dir.x + this.nextDir.x !== 0 || this.dir.y + this.nextDir.y !== 0) {
                this.dir = this.nextDir;
            }
            this.nextDir = null;
        }

        // Save previous position for interpolation
        this.prevX = this.x;
        this.prevY = this.y;

        // Add current position to body history
        this.body.unshift({ x: this.x, y: this.y });
        if (this.body.length > this.bodyLength) {
            this.body.pop();
        }

        // Move head
        this.x += this.dir.x;
        this.y += this.dir.y;

        // Check bounds (wall collision)
        if (!this.grid.inBounds(this.x, this.y)) {
            this.die('wall');
            return 'dead';
        }

        // Check self-trail collision
        const posKey = Worm.key(this.x, this.y);
        if (this.trailSet.has(posKey)) {
            this.die('self-trail');
            return 'dead';
        }

        // Check cell ownership
        const cellOwner = this.grid.get(this.x, this.y);

        if (cellOwner === this.id) {
            // Returned to own territory
            if (this.trail.length > 0) {
                const claimed = this.grid.claimTerritory(this.id, this.trail);
                this.trail = [];
                this.trailSet.clear();
                this.isOutside = false;
                return { type: 'claim', claimed: claimed };
            }
            this.isOutside = false;
        } else {
            // Outside own territory
            this.isOutside = true;
            this.trail.push({ x: this.x, y: this.y });
            this.trailSet.add(posKey);
        }

        return 'ok';
    }

    // ── Die ───────────────────────────────────
    die(reason) {
        this.alive = false;
        this.trail = [];
        this.trailSet.clear();
        this.deathReason = reason;
    }

    // ── Respawn ───────────────────────────────
    respawn(x, y) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.homeX = x;
        this.homeY = y;
        this.dir = { ...DIRECTIONS.RIGHT };
        this.nextDir = null;
        this.trail = [];
        this.trailSet.clear();
        this.body = [];
        this.alive = true;
        this.isOutside = false;
        this.deathReason = null;

        // Give starting territory
        this.grid.initTerritory(this.id, x, y, CONFIG.INITIAL_TERRITORY);
    }

    // ── Check if a position is on this worm's trail ──
    isOnTrail(x, y) {
        return this.trailSet.has(Worm.key(x, y));
    }

    // ── Get interpolated visual position ──────
    getVisualPos(progress) {
        return {
            x: this.prevX + (this.x - this.prevX) * progress,
            y: this.prevY + (this.y - this.prevY) * progress,
        };
    }
}
