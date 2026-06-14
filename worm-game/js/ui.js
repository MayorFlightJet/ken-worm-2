// ═══════════════════════════════════════════════
//  WORM.IO — UI Manager (HUD, Screens, Leaderboard)
// ═══════════════════════════════════════════════

class UI {
    constructor() {
        // DOM elements
        this.hud = document.getElementById('hud');
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.progressBar = document.getElementById('progressBarInner');
        this.progressText = document.getElementById('progressText');
        this.leaderboard = document.getElementById('leaderboard');
        this.killFeed = document.getElementById('killFeed');
        this.gameoverTitle = document.getElementById('gameoverTitle');
        this.statTerritory = document.getElementById('statTerritory');
        this.statKills = document.getElementById('statKills');
        this.statTime = document.getElementById('statTime');

        // State
        this.currentScreen = 'start'; // 'start', 'playing', 'gameover'
        this.killMessages = [];

        // Start screen button
        document.getElementById('btnPlay').addEventListener('click', () => {
            if (this.onPlay) this.onPlay();
        });

        // Also handle touch on play button
        document.getElementById('btnPlay').addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.onPlay) this.onPlay();
        });

        document.getElementById('btnRestart').addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });

        document.getElementById('btnRestart').addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.onRestart) this.onRestart();
        });
    }

    // ── Callbacks ─────────────────────────────
    onPlay = null;
    onRestart = null;

    // ── Screen Management ─────────────────────
    showScreen(screen) {
        this.currentScreen = screen;

        this.startScreen.classList.toggle('hidden', screen !== 'start');
        this.gameOverScreen.classList.toggle('hidden', screen !== 'gameover');

        if (screen === 'playing') {
            this.hud.style.display = '';
        } else if (screen === 'start') {
            this.hud.style.display = 'none';
        }
    }

    // ── Update Progress Bar ───────────────────
    updateProgress(percentage) {
        const pct = Math.min(100, Math.max(0, percentage));
        this.progressBar.style.width = pct + '%';
        this.progressText.textContent = pct.toFixed(1) + '%';

        // Color change based on progress
        if (pct > 75) {
            this.progressBar.style.background = 'linear-gradient(90deg, #00C853, #FFD740, #FF9100)';
        } else if (pct > 50) {
            this.progressBar.style.background = 'linear-gradient(90deg, #00C853, #00E676, #FFD740)';
        } else {
            this.progressBar.style.background = 'linear-gradient(90deg, #00C853, #00E676, #69F0AE)';
        }
    }

    // ── Update Leaderboard ────────────────────
    updateLeaderboard(worms, percentages) {
        // Build entries
        const entries = worms.map((w, i) => ({
            name: w.color.name,
            color: w.color.main,
            pct: percentages[w.id] || 0,
            alive: w.alive,
        }));

        // Sort by percentage descending
        entries.sort((a, b) => b.pct - a.pct);

        // Build HTML
        let html = '<div class="leaderboard-title">Ranking</div>';
        for (const entry of entries) {
            const opacity = entry.alive ? '1' : '0.35';
            html += `
                <div class="leaderboard-entry" style="opacity:${opacity}">
                    <div class="lb-color" style="background:${entry.color};color:${entry.color}"></div>
                    <span class="lb-name">${entry.name}</span>
                    <span class="lb-pct">${entry.pct.toFixed(1)}%</span>
                </div>
            `;
        }

        this.leaderboard.innerHTML = html;
    }

    // ── Kill Feed ─────────────────────────────
    addKillMessage(killerName, killerColor, victimName, victimColor, reason) {
        const msg = document.createElement('div');
        msg.className = 'kill-msg';

        let text = '';
        if (reason === 'wall') {
            text = `<span style="color:${victimColor}">${victimName}</span> hit the wall! 💥`;
        } else if (reason === 'self-trail') {
            text = `<span style="color:${victimColor}">${victimName}</span> hit own trail! 🔄`;
        } else if (reason === 'trail-kill') {
            text = `<span style="color:${killerColor}">${killerName}</span> ✂️ <span style="color:${victimColor}">${victimName}</span>`;
        } else {
            text = `<span style="color:${victimColor}">${victimName}</span> eliminated! ☠️`;
        }

        msg.innerHTML = text;
        this.killFeed.appendChild(msg);

        // Remove after animation
        setTimeout(() => {
            if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 3000);

        // Limit feed size
        while (this.killFeed.children.length > 5) {
            this.killFeed.removeChild(this.killFeed.firstChild);
        }
    }

    // ── Show Game Over ────────────────────────
    showGameOver(won, stats) {
        if (won) {
            this.gameoverTitle.textContent = '🏆 Victory!';
            this.gameoverTitle.className = 'gameover-title win';
        } else {
            this.gameoverTitle.textContent = '💀 Game Over';
            this.gameoverTitle.className = 'gameover-title lose';
        }

        this.statTerritory.textContent = stats.territory.toFixed(1) + '%';
        this.statKills.textContent = stats.kills;
        this.statTime.textContent = this._formatTime(stats.time);

        this.showScreen('gameover');
    }

    // ── Format Time ───────────────────────────
    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return m + ':' + s.toString().padStart(2, '0');
    }
}
