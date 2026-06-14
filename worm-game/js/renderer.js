// ═══════════════════════════════════════════════
//  WORM.IO — Canvas Renderer
// ═══════════════════════════════════════════════

class Renderer {
    constructor(canvas, minimapCanvas, grid) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.miniCanvas = minimapCanvas;
        this.miniCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
        this.grid = grid;

        // Camera (world coordinates)
        this.camX = 0;
        this.camY = 0;

        // Viewport scale
        this.scale = 1;

        // Background gradient (cached)
        this._bgGradient = null;

        // Animation time
        this.time = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    // ── Resize canvas to fill screen ──────────
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);

        this.viewW = window.innerWidth;
        this.viewH = window.innerHeight;

        // Scale: show about 40 cells horizontally on phone
        this.scale = Math.max(this.viewW, this.viewH) / (45 * CONFIG.CELL_SIZE);
        this.scale = Math.max(this.scale, 1.0);

        // Minimap
        if (this.miniCanvas) {
            this.miniCanvas.width = 110;
            this.miniCanvas.height = 110;
        }

        // Rebuild bg gradient
        this._bgGradient = null;
    }

    // ── Update camera to follow target ────────
    updateCamera(targetX, targetY, smooth) {
        const worldX = targetX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const worldY = targetY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;

        if (smooth) {
            this.camX += (worldX - this.camX) * 0.12;
            this.camY += (worldY - this.camY) * 0.12;
        } else {
            this.camX = worldX;
            this.camY = worldY;
        }
    }

    // ── Main Render ───────────────────────────
    render(worms, playerIndex, tickProgress) {
        const ctx = this.ctx;
        this.time += 0.016;

        // Clear
        ctx.clearRect(0, 0, this.viewW, this.viewH);

        // Background
        this._drawBackground(ctx);

        // Camera transform
        const offsetX = this.viewW / 2 - this.camX * this.scale;
        const offsetY = this.viewH / 2 - this.camY * this.scale;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(this.scale, this.scale);

        // Calculate visible cell range
        const cs = CONFIG.CELL_SIZE;
        const startCellX = Math.max(0, Math.floor((this.camX - this.viewW / 2 / this.scale) / cs) - 1);
        const startCellY = Math.max(0, Math.floor((this.camY - this.viewH / 2 / this.scale) / cs) - 1);
        const endCellX = Math.min(CONFIG.GRID_W, Math.ceil((this.camX + this.viewW / 2 / this.scale) / cs) + 1);
        const endCellY = Math.min(CONFIG.GRID_H, Math.ceil((this.camY + this.viewH / 2 / this.scale) / cs) + 1);

        // Render territories
        this._drawTerritories(ctx, startCellX, startCellY, endCellX, endCellY, worms);

        // Render grid lines
        this._drawGridLines(ctx, startCellX, startCellY, endCellX, endCellY);

        // Render trails
        for (const worm of worms) {
            if (worm.trail.length > 0) {
                this._drawTrail(ctx, worm);
            }
        }

        // Render worm bodies
        for (const worm of worms) {
            if (worm.alive) {
                this._drawWorm(ctx, worm, tickProgress);
            }
        }

        // Render map border
        this._drawBorder(ctx);

        ctx.restore();

        // Render minimap
        this._drawMinimap(worms, playerIndex);
    }

    // ── Background ────────────────────────────
    _drawBackground(ctx) {
        if (!this._bgGradient) {
            this._bgGradient = ctx.createLinearGradient(0, 0, this.viewW, this.viewH);
            this._bgGradient.addColorStop(0, CONFIG.BG_COLOR_1);
            this._bgGradient.addColorStop(0.5, CONFIG.BG_COLOR_2);
            this._bgGradient.addColorStop(1, CONFIG.BG_COLOR_3);
        }
        ctx.fillStyle = this._bgGradient;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // ── Territories ───────────────────────────
    _drawTerritories(ctx, sx, sy, ex, ey, worms) {
        const cs = CONFIG.CELL_SIZE;

        // Batch by owner for fewer style changes
        const batches = {};
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const owner = this.grid.get(x, y);
                if (owner > 0) {
                    if (!batches[owner]) batches[owner] = [];
                    batches[owner].push(x, y);
                }
            }
        }

        for (const ownerId in batches) {
            const worm = worms[parseInt(ownerId) - 1];
            if (!worm) continue;

            ctx.fillStyle = worm.color.territory;
            const cells = batches[ownerId];
            for (let i = 0; i < cells.length; i += 2) {
                ctx.fillRect(cells[i] * cs, cells[i + 1] * cs, cs, cs);
            }

            // Territory border effect (subtle)
            ctx.strokeStyle = worm.color.main + '18';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < cells.length; i += 2) {
                const x = cells[i], y = cells[i + 1];
                // Only draw border edges
                if (this.grid.get(x - 1, y) !== parseInt(ownerId)) {
                    ctx.beginPath();
                    ctx.moveTo(x * cs, y * cs);
                    ctx.lineTo(x * cs, (y + 1) * cs);
                    ctx.stroke();
                }
                if (this.grid.get(x + 1, y) !== parseInt(ownerId)) {
                    ctx.beginPath();
                    ctx.moveTo((x + 1) * cs, y * cs);
                    ctx.lineTo((x + 1) * cs, (y + 1) * cs);
                    ctx.stroke();
                }
                if (this.grid.get(x, y - 1) !== parseInt(ownerId)) {
                    ctx.beginPath();
                    ctx.moveTo(x * cs, y * cs);
                    ctx.lineTo((x + 1) * cs, y * cs);
                    ctx.stroke();
                }
                if (this.grid.get(x, y + 1) !== parseInt(ownerId)) {
                    ctx.beginPath();
                    ctx.moveTo(x * cs, (y + 1) * cs);
                    ctx.lineTo((x + 1) * cs, (y + 1) * cs);
                    ctx.stroke();
                }
            }
        }
    }

    // ── Grid Lines ────────────────────────────
    _drawGridLines(ctx, sx, sy, ex, ey) {
        const cs = CONFIG.CELL_SIZE;
        ctx.strokeStyle = CONFIG.GRID_LINE_COLOR;
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        for (let x = sx; x <= ex; x++) {
            ctx.moveTo(x * cs, sy * cs);
            ctx.lineTo(x * cs, ey * cs);
        }
        for (let y = sy; y <= ey; y++) {
            ctx.moveTo(sx * cs, y * cs);
            ctx.lineTo(ex * cs, y * cs);
        }
        ctx.stroke();
    }

    // ── Trail ─────────────────────────────────
    _drawTrail(ctx, worm) {
        const cs = CONFIG.CELL_SIZE;
        const trail = worm.trail;

        if (trail.length === 0) return;

        // Glowing trail line
        ctx.strokeStyle = worm.color.trail;
        ctx.lineWidth = cs * 0.55;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Shadow glow
        ctx.shadowColor = worm.color.glow;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(trail[0].x * cs + cs / 2, trail[0].y * cs + cs / 2);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x * cs + cs / 2, trail[i].y * cs + cs / 2);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Trail dots at each cell
        ctx.fillStyle = worm.color.main + 'AA';
        for (let i = 0; i < trail.length; i += 3) {
            ctx.beginPath();
            ctx.arc(trail[i].x * cs + cs / 2, trail[i].y * cs + cs / 2, cs * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Worm Body ─────────────────────────────
    _drawWorm(ctx, worm, progress) {
        const cs = CONFIG.CELL_SIZE;
        const halfCs = cs / 2;

        // Interpolated head position
        const head = worm.getVisualPos(progress);
        const headPx = head.x * cs + halfCs;
        const headPy = head.y * cs + halfCs;

        // Draw body segments (from tail to head)
        const body = worm.body;
        for (let i = body.length - 1; i >= 0; i--) {
            const t = 1 - (i / Math.max(body.length, 1));
            const radius = cs * (0.25 + t * 0.15);
            const alpha = 0.4 + t * 0.6;

            ctx.fillStyle = worm.color.main + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(
                body[i].x * cs + halfCs,
                body[i].y * cs + halfCs,
                radius,
                0, Math.PI * 2
            );
            ctx.fill();
        }

        // Head glow
        ctx.shadowColor = worm.color.glow;
        ctx.shadowBlur = 12;

        // Head circle
        const headRadius = cs * 0.45;
        const headGrad = ctx.createRadialGradient(
            headPx - headRadius * 0.3, headPy - headRadius * 0.3, 0,
            headPx, headPy, headRadius
        );
        headGrad.addColorStop(0, worm.color.light);
        headGrad.addColorStop(1, worm.color.main);

        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(headPx, headPy, headRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Eyes
        const eyeOffset = headRadius * 0.35;
        const eyeRadius = headRadius * 0.22;
        const pupilRadius = eyeRadius * 0.55;

        // Eye positions based on direction
        let ex1, ey1, ex2, ey2;
        if (worm.dir.x !== 0) {
            // Moving horizontally
            const frontX = headPx + worm.dir.x * eyeOffset * 0.5;
            ex1 = frontX; ey1 = headPy - eyeOffset;
            ex2 = frontX; ey2 = headPy + eyeOffset;
        } else {
            // Moving vertically
            const frontY = headPy + worm.dir.y * eyeOffset * 0.5;
            ex1 = headPx - eyeOffset; ey1 = frontY;
            ex2 = headPx + eyeOffset; ey2 = frontY;
        }

        // White of eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex1, ey1, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex2, ey2, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (looking in movement direction)
        ctx.fillStyle = '#1a1a2e';
        const pupilOffX = worm.dir.x * pupilRadius * 0.4;
        const pupilOffY = worm.dir.y * pupilRadius * 0.4;
        ctx.beginPath();
        ctx.arc(ex1 + pupilOffX, ey1 + pupilOffY, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex2 + pupilOffX, ey2 + pupilOffY, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Map Border ────────────────────────────
    _drawBorder(ctx) {
        const worldW = CONFIG.GRID_W * CONFIG.CELL_SIZE;
        const worldH = CONFIG.GRID_H * CONFIG.CELL_SIZE;

        // Glow
        ctx.shadowColor = CONFIG.BORDER_GLOW;
        ctx.shadowBlur = 15;

        ctx.strokeStyle = CONFIG.BORDER_COLOR;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, worldW, worldH);

        ctx.shadowBlur = 0;

        // Danger zone (semi-transparent red at edges)
        const dangerSize = CONFIG.CELL_SIZE * 2;
        const dangerColor = 'rgba(255,23,68,0.06)';

        ctx.fillStyle = dangerColor;
        // Top
        ctx.fillRect(0, 0, worldW, dangerSize);
        // Bottom
        ctx.fillRect(0, worldH - dangerSize, worldW, dangerSize);
        // Left
        ctx.fillRect(0, 0, dangerSize, worldH);
        // Right
        ctx.fillRect(worldW - dangerSize, 0, dangerSize, worldH);
    }

    // ── Minimap ───────────────────────────────
    _drawMinimap(worms, playerIndex) {
        if (!this.miniCtx) return;

        const ctx = this.miniCtx;
        const mw = this.miniCanvas.width;
        const mh = this.miniCanvas.height;
        const scaleX = mw / CONFIG.GRID_W;
        const scaleY = mh / CONFIG.GRID_H;

        ctx.clearRect(0, 0, mw, mh);

        // Background
        ctx.fillStyle = 'rgba(15,12,41,0.5)';
        ctx.fillRect(0, 0, mw, mh);

        // Territory blocks (sample every 2 cells for performance)
        for (let y = 0; y < CONFIG.GRID_H; y += 2) {
            for (let x = 0; x < CONFIG.GRID_W; x += 2) {
                const owner = this.grid.get(x, y);
                if (owner > 0 && worms[owner - 1]) {
                    ctx.fillStyle = worms[owner - 1].color.main + '88';
                    ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2.5, scaleY * 2.5);
                }
            }
        }

        // Worm positions
        for (let i = 0; i < worms.length; i++) {
            const w = worms[i];
            if (!w.alive) continue;

            ctx.fillStyle = i === playerIndex ? '#fff' : w.color.main;
            ctx.beginPath();
            ctx.arc(w.x * scaleX, w.y * scaleY, i === playerIndex ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Camera viewport indicator
        const vpW = (this.viewW / this.scale) / CONFIG.CELL_SIZE * scaleX;
        const vpH = (this.viewH / this.scale) / CONFIG.CELL_SIZE * scaleY;
        const vpX = (this.camX / CONFIG.CELL_SIZE) * scaleX - vpW / 2;
        const vpY = (this.camY / CONFIG.CELL_SIZE) * scaleY - vpH / 2;

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(vpX, vpY, vpW, vpH);

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, mw, mh);
    }
}
