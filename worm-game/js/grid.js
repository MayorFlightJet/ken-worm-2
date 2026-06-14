// ═══════════════════════════════════════════════
//  WORM.IO — Grid System & Territory Logic
// ═══════════════════════════════════════════════

class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        // Each cell stores owner ID: 0 = unclaimed, 1..N = worm IDs
        this.cells = new Uint8Array(width * height);
        this.totalCells = width * height;
    }

    // ── Cell Access ───────────────────────────
    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return this.cells[y * this.width + x];
    }

    set(x, y, owner) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.cells[y * this.width + x] = owner;
    }

    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    // ── Initialize Territory ──────────────────
    // Give a worm a starting square territory
    initTerritory(wormId, centerX, centerY, size) {
        const half = Math.floor(size / 2);
        for (let dy = -half; dy <= half; dy++) {
            for (let dx = -half; dx <= half; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;
                if (this.inBounds(x, y)) {
                    this.set(x, y, wormId);
                }
            }
        }
    }

    // ── Territory Claim — Inverse Flood Fill ──
    // When a worm returns to its territory with a trail,
    // claim all enclosed area.
    //
    // Algorithm:
    // 1. Convert trail cells to worm's territory
    // 2. Create temp map: 1 = worm's cells (barrier), 0 = others
    // 3. BFS flood fill from all edge cells that are 0
    // 4. All cells still 0 after flood = enclosed = claim them
    //
    claimTerritory(wormId, trail) {
        const W = this.width;
        const H = this.height;

        // Step 1: Mark trail as worm's territory
        for (let i = 0; i < trail.length; i++) {
            this.set(trail[i].x, trail[i].y, wormId);
        }

        // Step 2: Build barrier map
        // 0 = not worm's, 1 = worm's territory (barrier), 2 = visited by flood
        const temp = new Uint8Array(this.totalCells);
        for (let i = 0; i < this.totalCells; i++) {
            if (this.cells[i] === wormId) {
                temp[i] = 1; // barrier
            }
        }

        // Step 3: BFS from all edge cells that are NOT barriers
        // Using flat array as queue for performance
        const queue = new Int32Array(this.totalCells * 2);
        let qHead = 0, qTail = 0;

        // Top & bottom edges
        for (let x = 0; x < W; x++) {
            const topIdx = x;
            const botIdx = (H - 1) * W + x;
            if (temp[topIdx] === 0) { temp[topIdx] = 2; queue[qTail++] = x; queue[qTail++] = 0; }
            if (temp[botIdx] === 0) { temp[botIdx] = 2; queue[qTail++] = x; queue[qTail++] = H - 1; }
        }
        // Left & right edges
        for (let y = 1; y < H - 1; y++) {
            const leftIdx = y * W;
            const rightIdx = y * W + (W - 1);
            if (temp[leftIdx] === 0) { temp[leftIdx] = 2; queue[qTail++] = 0; queue[qTail++] = y; }
            if (temp[rightIdx] === 0) { temp[rightIdx] = 2; queue[qTail++] = W - 1; queue[qTail++] = y; }
        }

        // BFS
        while (qHead < qTail) {
            const cx = queue[qHead++];
            const cy = queue[qHead++];

            // Check 4 neighbors
            const neighbors = [
                cx - 1, cy,
                cx + 1, cy,
                cx, cy - 1,
                cx, cy + 1
            ];

            for (let n = 0; n < 8; n += 2) {
                const nx = neighbors[n];
                const ny = neighbors[n + 1];
                if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                    const ni = ny * W + nx;
                    if (temp[ni] === 0) {
                        temp[ni] = 2; // mark as outside
                        queue[qTail++] = nx;
                        queue[qTail++] = ny;
                    }
                }
            }
        }

        // Step 4: All cells still 0 in temp = enclosed → claim
        let claimed = 0;
        for (let i = 0; i < this.totalCells; i++) {
            if (temp[i] === 0) {
                this.cells[i] = wormId;
                claimed++;
            }
        }

        return claimed;
    }

    // ── Clear Territory ───────────────────────
    // Remove all territory owned by a worm (when it dies)
    clearTerritory(wormId) {
        for (let i = 0; i < this.totalCells; i++) {
            if (this.cells[i] === wormId) {
                this.cells[i] = 0;
            }
        }
    }

    // ── Percentage Calculation ────────────────
    getPercentage(wormId) {
        let count = 0;
        for (let i = 0; i < this.totalCells; i++) {
            if (this.cells[i] === wormId) count++;
        }
        return (count / this.totalCells) * 100;
    }

    // ── Get All Percentages ───────────────────
    getAllPercentages(wormCount) {
        const counts = new Array(wormCount + 1).fill(0);
        for (let i = 0; i < this.totalCells; i++) {
            const owner = this.cells[i];
            if (owner > 0 && owner <= wormCount) {
                counts[owner]++;
            }
        }
        const result = {};
        for (let id = 1; id <= wormCount; id++) {
            result[id] = (counts[id] / this.totalCells) * 100;
        }
        return result;
    }

    // ── Find Nearest Territory Cell ───────────
    // Used by AI to navigate back home
    findNearestTerritory(fromX, fromY, wormId) {
        let bestDist = Infinity;
        let bestX = fromX, bestY = fromY;

        // Scan in expanding rings for efficiency
        const maxRadius = Math.max(this.width, this.height);
        for (let r = 1; r < maxRadius; r++) {
            let found = false;
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring edge
                    const x = fromX + dx;
                    const y = fromY + dy;
                    if (this.inBounds(x, y) && this.get(x, y) === wormId) {
                        const dist = Math.abs(dx) + Math.abs(dy);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestX = x;
                            bestY = y;
                            found = true;
                        }
                    }
                }
            }
            if (found) break; // found at this radius, no need to go further
        }

        return { x: bestX, y: bestY, dist: bestDist };
    }
}
