// ═══════════════════════════════════════════════
//  WORM.IO — Touch Controls (Virtual Joystick + Keyboard)
// ═══════════════════════════════════════════════

class Controls {
    constructor() {
        // Current input direction (null = no change)
        this.inputDir = null;

        // Joystick DOM elements
        this.joystickBase = null;
        this.joystickThumb = null;
        this.joystickZone = null;

        // Joystick state
        this.joystickActive = false;
        this.joystickCenter = { x: 0, y: 0 };
        this.joystickRadius = 50;

        // Swipe state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.SWIPE_THRESHOLD = 30;
        this.SWIPE_TIME = 300;

        this._setupKeyboard();
    }

    // ── Initialize with DOM elements ──────────
    init(joystickZone, joystickBase, joystickThumb) {
        this.joystickZone = joystickZone;
        this.joystickBase = joystickBase;
        this.joystickThumb = joystickThumb;

        const rect = joystickBase.getBoundingClientRect();
        this.joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        this.joystickRadius = rect.width / 2 - 24;

        this._setupTouch();
    }

    // ── Consume input direction ───────────────
    // Returns direction and clears it
    consumeDirection() {
        const dir = this.inputDir;
        this.inputDir = null;
        return dir;
    }

    // ── Peek at input direction ───────────────
    peekDirection() {
        return this.inputDir;
    }

    // ── Keyboard Setup ────────────────────────
    _setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':    case 'w': case 'W':
                    this.inputDir = { ...DIRECTIONS.UP };
                    e.preventDefault();
                    break;
                case 'ArrowDown':  case 's': case 'S':
                    this.inputDir = { ...DIRECTIONS.DOWN };
                    e.preventDefault();
                    break;
                case 'ArrowLeft':  case 'a': case 'A':
                    this.inputDir = { ...DIRECTIONS.LEFT };
                    e.preventDefault();
                    break;
                case 'ArrowRight': case 'd': case 'D':
                    this.inputDir = { ...DIRECTIONS.RIGHT };
                    e.preventDefault();
                    break;
            }
        });
    }

    // ── Touch Setup ───────────────────────────
    _setupTouch() {
        if (!this.joystickZone) return;

        // Joystick touch
        this.joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystickActive = true;
            this.joystickThumb.classList.add('active');

            // Recalculate center in case of layout change
            const rect = this.joystickBase.getBoundingClientRect();
            this.joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            this._handleJoystickMove(e.touches[0]);
        }, { passive: false });

        this.joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystickActive) {
                this._handleJoystickMove(e.touches[0]);
            }
        }, { passive: false });

        this.joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystickActive = false;
            this.joystickThumb.classList.remove('active');
            this.joystickThumb.style.transform = 'translate(0, 0)';
        }, { passive: false });

        // Swipe on left half of screen
        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            // Only handle swipe on left half
            if (touch.clientX < window.innerWidth * 0.5) {
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
                this.touchStartTime = Date.now();
            }
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const elapsed = Date.now() - this.touchStartTime;

            if (elapsed < this.SWIPE_TIME && touch.clientX < window.innerWidth * 0.6) {
                const dx = touch.clientX - this.touchStartX;
                const dy = touch.clientY - this.touchStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > this.SWIPE_THRESHOLD) {
                    if (absDx > absDy) {
                        this.inputDir = dx > 0 ? { ...DIRECTIONS.RIGHT } : { ...DIRECTIONS.LEFT };
                    } else {
                        this.inputDir = dy > 0 ? { ...DIRECTIONS.DOWN } : { ...DIRECTIONS.UP };
                    }
                }
            }
        }, { passive: true });
    }

    // ── Handle Joystick Movement ──────────────
    _handleJoystickMove(touch) {
        const dx = touch.clientX - this.joystickCenter.x;
        const dy = touch.clientY - this.joystickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Clamp thumb to joystick radius
        const clampedDist = Math.min(distance, this.joystickRadius);
        const angle = Math.atan2(dy, dx);
        const thumbX = Math.cos(angle) * clampedDist;
        const thumbY = Math.sin(angle) * clampedDist;

        this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

        // Only register direction if thumb is pulled enough
        if (distance > 15) {
            // Snap to 4 cardinal directions
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);

            if (absX > absY) {
                this.inputDir = dx > 0 ? { ...DIRECTIONS.RIGHT } : { ...DIRECTIONS.LEFT };
            } else {
                this.inputDir = dy > 0 ? { ...DIRECTIONS.DOWN } : { ...DIRECTIONS.UP };
            }
        }
    }

    // ── Recalculate joystick position ─────────
    recalculate() {
        if (this.joystickBase) {
            const rect = this.joystickBase.getBoundingClientRect();
            this.joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            this.joystickRadius = rect.width / 2 - 24;
        }
    }
}
