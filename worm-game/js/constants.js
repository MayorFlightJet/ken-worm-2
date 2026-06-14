// ═══════════════════════════════════════════════
//  WORM.IO — Game Constants & Configuration
// ═══════════════════════════════════════════════

const CONFIG = {
    // Grid
    GRID_W: 100,
    GRID_H: 100,
    CELL_SIZE: 10,       // pixels per cell in world space

    // Timing
    TICK_RATE: 8,        // worm moves per second
    
    // Gameplay
    BOT_COUNT: 3,
    INITIAL_TERRITORY: 5,  // 5x5 starting area per worm
    WORM_BODY_LENGTH: 8,
    RESPAWN_DELAY: 3000,   // ms before bot respawns

    // Rendering
    BG_COLOR_1: '#0f0c29',
    BG_COLOR_2: '#302b63',
    BG_COLOR_3: '#24243e',
    GRID_LINE_COLOR: 'rgba(255,255,255,0.04)',
    BORDER_COLOR: '#ff1744',
    BORDER_GLOW: 'rgba(255,23,68,0.4)',
};

const DIRECTIONS = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 },
};

const WORM_COLORS = [
    {
        main: '#00E676', light: '#69F0AE', dark: '#00C853',
        trail: 'rgba(0,230,118,0.7)', territory: 'rgba(0,230,118,0.22)',
        glow: 'rgba(0,230,118,0.5)', name: 'You'
    },
    {
        main: '#FF5252', light: '#FF8A80', dark: '#D50000',
        trail: 'rgba(255,82,82,0.7)', territory: 'rgba(255,82,82,0.22)',
        glow: 'rgba(255,82,82,0.5)', name: 'Viper'
    },
    {
        main: '#448AFF', light: '#82B1FF', dark: '#2962FF',
        trail: 'rgba(68,138,255,0.7)', territory: 'rgba(68,138,255,0.22)',
        glow: 'rgba(68,138,255,0.5)', name: 'Cobra'
    },
    {
        main: '#FFD740', light: '#FFE57F', dark: '#FFC400',
        trail: 'rgba(255,215,64,0.7)', territory: 'rgba(255,215,64,0.22)',
        glow: 'rgba(255,215,64,0.5)', name: 'Mamba'
    },
];

// Starting positions (grid coords) — spread across map
const SPAWN_POSITIONS = [
    { x: 15, y: 15 },   // Player — top-left area
    { x: 84, y: 15 },   // Bot 1 — top-right
    { x: 84, y: 84 },   // Bot 2 — bottom-right
    { x: 15, y: 84 },   // Bot 3 — bottom-left
];
