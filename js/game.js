/**
 * Crystal Master: Precision Engineering (Elite Version)
 * Author: Antigravity AI
 * Mechanics: Physics, Precision Docking, Wind Resistance
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// Game State
let animationFrameId;
let state = {
    running: false,
    gameOver: false,
    score: 0,
    level: 1,
    progress: 0,

    // Physics Objects
    panel: {
        x: 0, y: 0, w: 120, h: 180,
        vx: 0, vy: 0, angle: 0, rotation: 0,
        glassColor: 'rgba(56, 189, 248, 0.4)',
        shattered: false
    },
    dock: { x: 0, y: 0, w: 130, h: 190, active: true },

    // Environment
    wind: 0,
    targetWind: 0,
    particles: [],
    cracks: []
};

// --- CORE LOGIC ---

function initSkylineGame() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(); }, { passive: false });

    drawStartScreen();
    window.game = { start: startGame, reset: resetGame };
}

function resizeCanvas() {
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = 550;
}

function startGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.level = 1;
    state.progress = 0;
    state.cracks = [];

    resetPanel();
    spawnNextDock();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

function resetGame() {
    startGame();
}

function resetPanel() {
    state.panel = {
        x: canvas.width / 2 - 60,
        y: -200,
        w: 120,
        h: 180,
        vx: 0,
        vy: 2 + state.level * 0.5,
        angle: (Math.random() - 0.5) * 0.2,
        rotation: (Math.random() - 0.5) * 0.02,
        glassColor: `hsla(${190 + Math.random() * 20}, 80%, 70%, 0.4)`,
        shattered: false
    };
    state.wind = 0;
    state.targetWind = (Math.random() - 0.5) * (state.level * 0.8);
}

function spawnNextDock() {
    state.dock = {
        x: Math.random() * (canvas.width - 200) + 100,
        y: canvas.height - 250,
        w: 130,
        h: 190,
        active: true
    };
}

function handleInput() {
    if (!state.running) {
        if (state.gameOver) resetGame();
        else startGame();
        return;
    }

    // Controlled descend behavior
    state.panel.vy += 1.5;
}

function updatePhysics() {
    if (!state.running || state.gameOver) return;

    // Environmental Forces
    state.wind += (state.targetWind - state.wind) * 0.01;
    state.panel.x += state.wind + state.panel.vx;
    state.panel.y += state.panel.vy;
    state.panel.angle += state.panel.rotation;

    // Control bounds
    if (state.panel.x < 0 || state.panel.x + state.panel.w > canvas.width) {
        shatterGlass();
    }

    // Checking Collision with Dock
    if (state.panel.y + state.panel.h >= state.dock.y) {
        const xDiff = Math.abs((state.panel.x + state.panel.w / 2) - (state.dock.x + state.dock.w / 2));
        const angleDiff = Math.abs(state.panel.angle);

        if (xDiff < 20 && angleDiff < 0.1) {
            // SUCCESSFUL DOCKING
            state.score += 100 + Math.round((1 - angleDiff) * 50);
            state.progress++;
            if (state.progress >= 3) {
                state.level++;
                state.progress = 0;
            }
            createSuccessParticles();
            resetPanel();
            spawnNextDock();
        } else {
            // FAILURE
            shatterGlass();
        }
    }
}

function shatterGlass() {
    state.gameOver = true;
    state.panel.shattered = true;
    for (let i = 0; i < 30; i++) {
        state.particles.push({
            x: state.panel.x + state.panel.w / 2,
            y: state.panel.y + state.panel.h / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 8,
            alpha: 1
        });
    }
}

function createSuccessParticles() {
    for (let i = 0; i < 20; i++) {
        state.particles.push({
            x: state.dock.x + state.dock.w / 2,
            y: state.dock.y + state.dock.h / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 5,
            alpha: 1,
            color: '#4ade80'
        });
    }
}

// --- RENDERING ---

function drawCracks() {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    state.cracks.forEach(c => {
        ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2);
    });
    ctx.stroke();
}

function drawPanel() {
    if (state.panel.shattered) return;

    ctx.save();
    ctx.translate(state.panel.x + state.panel.w / 2, state.panel.y + state.panel.h / 2);
    ctx.rotate(state.panel.angle);

    // Glass Body
    ctx.fillStyle = state.panel.glassColor;
    ctx.fillRect(-state.panel.w / 2, -state.panel.h / 2, state.panel.w, state.panel.h);

    // Shine effect
    const grad = ctx.createLinearGradient(-state.panel.w / 2, -state.panel.h / 2, state.panel.w / 2, state.panel.h / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(-state.panel.w / 2, -state.panel.h / 2, state.panel.w, state.panel.h);

    // Frame
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-state.panel.w / 2, -state.panel.h / 2, state.panel.w, state.panel.h);

    ctx.restore();
}

function drawDock() {
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(state.dock.x, state.dock.y, state.dock.w, state.dock.h);
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText("AREA DE INSTALACIÓN", state.dock.x + state.dock.w / 2, state.dock.y - 10);
}

function drawStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 28px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText('CRYSTAL MASTER', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = '#fff'; ctx.font = '16px Outfit';
    ctx.fillText('Simulador de Ingeniería de Precisión', canvas.width / 2, canvas.height / 2);
    ctx.font = '13px Outfit'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('Click/Tap para controlar el descenso', canvas.width / 2, canvas.height / 2 + 40);
}

function gameLoop() {
    if (!state.running) return;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Structural feel)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < canvas.width; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for (let i = 0; i < canvas.height; i += 50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    updatePhysics();
    drawDock();
    drawPanel();

    // UI
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Orbitron'; ctx.textAlign = 'left';
    ctx.fillText(`PUNTAJE: ${state.score}`, 20, 40);
    ctx.fillText(`NIVEL: ${state.level}`, 20, 70);

    // Wind Indicator
    ctx.textAlign = 'right';
    ctx.fillStyle = Math.abs(state.wind) > 2 ? '#ef4444' : '#fff';
    ctx.fillText(`VIENTO: ${Math.round(state.wind * 10)} km/h`, canvas.width - 20, 40);

    // Particles
    state.particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color || '#38bdf8';
        ctx.fillRect(p.x, p.y, p.size, p.size);
        if (p.alpha <= 0) state.particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    if (state.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 32px Orbitron'; ctx.textAlign = 'center';
        ctx.fillText('FALLO ESTRUCTURAL', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#fff'; ctx.font = '20px Outfit';
        ctx.fillText(`PUNTAJE FINAL: ${state.score}`, canvas.width / 2, canvas.height / 2 + 30);
        ctx.font = '16px Outfit'; ctx.fillText('Click para reintentar', canvas.width / 2, canvas.height / 2 + 70);
        return;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

initSkylineGame();
