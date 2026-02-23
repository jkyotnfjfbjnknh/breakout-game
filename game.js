// 打砖块游戏 - 使用 Matter.js 物理引擎
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite } = Matter;

// 游戏配置
const config = {
    width: window.innerWidth > 600 ? 600 : window.innerWidth - 20,
    height: window.innerHeight > 800 ? 800 : window.innerHeight - 20,
    paddleWidth: 100,
    paddleHeight: 15,
    ballRadius: 10,
    brickRows: 6,
    brickCols: 8,
    brickGap: 5
};

// 游戏状态
let gameState = {
    score: 0,
    lives: 5,
    isPlaying: false,
    bricks: []
};

// 物理引擎
let engine, render, runner;
let paddle, ball;
let brickRows = [];

// 颜色配置
const colors = {
    paddle: '#667eea',
    ball: '#ffffff',
    bricks: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
    background: '#1a1a2e'
};

// ================= 音频系统 =================
const AudioSys = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playPaddle() {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialDecayTo = 0.001;
        gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    },
    playBrickExplosion() {
        if (!this.ctx) this.init();
        // 模拟爆炸噪声
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
    }
};

// ================= 粒子系统 =================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.size = Math.random() * 6 + 2;
        this.color = color;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // 重力
        this.alpha -= this.decay;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}

let particles = [];

function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateAndDrawParticles(ctx, width, height) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.alpha <= 0 || p.y > height) {
            particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
}

// 修改 Render.options 以在渲染循环中添加粒子绘制

// 初始化游戏
function init() {
    // 创建引擎
    engine = Engine.create();
    
    // 创建渲染器
    render = Render.create({
        element: document.getElementById('game-canvas'),
        engine: engine,
        options: {
            width: config.width,
            height: config.height,
            wireframes: false,
            background: config.background
        }
    });

    // 创建边界
    createWalls();
    
    // 创建挡板
    createPaddle();
    
    // 注意：这里不创建球，等点击开始再创建
    
    // 创建砖块
    createBricks();
    
    // 设置输入
    setupInput();
    
    // 碰撞检测
    setupCollisions();
    
    // 运行引擎
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);
    
    // 绑定按钮事件
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
}

// 创建边界墙
function createWalls() {
    const wallOptions = { 
        isStatic: true,
        render: { fillStyle: '#333' },
        restitution: 1
    };
    
    // 左墙
    World.add(engine.world, Bodies.rectangle(-5, config.height/2, 10, config.height, wallOptions));
    // 右墙
    World.add(engine.world, Bodies.rectangle(config.width+5, config.height/2, 10, config.height, wallOptions));
    // 顶墙
    World.add(engine.world, Bodies.rectangle(config.width/2, -5, config.width, 10, wallOptions));
}

// 创建挡板
function createPaddle() {
    paddle = Bodies.rectangle(
        config.width / 2,
        config.height - 50,
        config.paddleWidth,
        config.paddleHeight,
        {
            isStatic: true,
            render: { fillStyle: colors.paddle },
            chamfer: { radius: 5 },
            label: 'paddle'
        }
    );
    World.add(engine.world, paddle);
}

// 创建球（在游戏开始时调用）
function createBall() {
    ball = Bodies.circle(
        config.width / 2,
        config.height - 100,
        config.ballRadius,
        {
            render: { fillStyle: colors.ball },
            restitution: 1.4,  // 增加弹性，更弹
            friction: 0,
            frictionAir: 0,
            label: 'ball'
        }
    );
    World.add(engine.world, ball);
    Body.setVelocity(ball, { x: 0, y: 0 });
}

// 创建砖块
function createBricks() {
    const brickWidth = (config.width - (config.brickCols + 1) * config.brickGap) / config.brickCols;
    const brickHeight = 25;
    
    gameState.bricks = [];
    
    for (let row = 0; row < config.brickRows; row++) {
        brickRows[row] = [];
        for (let col = 0; col < config.brickCols; col++) {
            const brick = Bodies.rectangle(
                config.brickGap + col * (brickWidth + config.brickGap) + brickWidth / 2,
                config.brickGap + row * (brickHeight + config.brickGap) + brickHeight / 2 + 50,
                brickWidth,
                brickHeight,
                {
                    render: { fillStyle: colors.bricks[row % colors.bricks.length] },
                    label: 'brick',
                    brickRow: row,
                    brickCol: col,
                    isStatic: true  // 砖块固定不动
                }
            );
            World.add(engine.world, brick);
            brickRows[row][col] = brick;
            gameState.bricks.push(brick);
        }
    }
}

// 设置输入控制
function setupInput() {
    const canvas = render.canvas;
    let isDragging = false;
    
    // 触摸事件
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // 鼠标事件
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    function handleTouchStart(e) {
        e.preventDefault();
        isDragging = true;
        updatePaddlePosition(e.touches[0].clientX);
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        if (isDragging) {
            updatePaddlePosition(e.touches[0].clientX);
        }
    }
    
    function handleTouchEnd(e) {
        e.preventDefault();
        isDragging = false;
    }
    
    function handleMouseDown(e) {
        isDragging = true;
        updatePaddlePosition(e.clientX);
    }
    
    function handleMouseMove(e) {
        if (isDragging) {
            updatePaddlePosition(e.clientX);
        }
    }
    
    function handleMouseUp() {
        isDragging = false;
    }
    
    function updatePaddlePosition(clientX) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = config.width / rect.width;
        const x = (clientX - rect.left) * scaleX;
        
        // 限制挡板在边界内
        const newX = Math.max(
            config.paddleWidth / 2,
            Math.min(config.width - config.paddleWidth / 2, x)
        );
        
        Body.setPosition(paddle, { x: newX, y: paddle.position.y });
    }
}

// 设置碰撞检测
function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        
        pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // 检测球与砖块的碰撞
            if ((bodyA.label === 'ball' && bodyB.label === 'brick') ||
                (bodyB.label === 'ball' && bodyA.label === 'brick')) {
                const brick = bodyA.label === 'brick' ? bodyA : bodyB;
                // 播放爆炸音效
                AudioSys.playBrickExplosion();
                // 生成破碎粒子特效
                spawnParticles(brick.position.x, brick.position.y, brick.render.fillStyle);
                removeBrick(brick);
                // 限制碰撞后的最大速度，防止弹跳力不断增大
                clampBallSpeed(17);
            }
            
            // 检测球与挡板的碰撞（播放音效，避免重复）
            if ((bodyA.label === 'ball' && bodyB.label === 'paddle') ||
                (bodyB.label === 'ball' && bodyA.label === 'paddle')) {
                AudioSys.playPaddle();
            }
            
            // 检测球是否掉落
            if (bodyA.label === 'ball' && bodyA.position.y > config.height + 50) {
                loseLife();
            }
            if (bodyB.label === 'ball' && bodyB.position.y > config.height + 50) {
                loseLife();
            }
        });
    });
    
    // 每帧检查球是否掉落和速度限制
    Events.on(engine, 'beforeUpdate', () => {
        if (ball && ball.position.y > config.height + 50 && gameState.isPlaying) {
            // 重置球速度，防止继续下落
            Body.setVelocity(ball, { x: 0, y: 0 });
            loseLife();
        }
        
        // 持续限制球的最大速度（防止其他碰撞导致的速度累积）
        clampBallSpeed(17);
        
        // 检查是否胜利
        if (gameState.isPlaying && gameState.bricks.length === 0) {
            winGame();
        }
    });
    
    // 渲染粒子特效
    Events.on(render, 'afterRender', () => {
        if (render && render.context) {
            updateAndDrawParticles(render.context, config.width, config.height);
        }
    });
}

// 限制球的最大速度
function clampBallSpeed(maxSpeed) {
    if (!ball) return;
    const v = ball.velocity;
    const speed = Math.hypot(v.x, v.y);
    if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        Body.setVelocity(ball, { x: v.x * scale, y: v.y * scale });
    }
}

// 移除砖块
function removeBrick(brick) {
    if (!gameState.bricks.includes(brick)) return;
    
    World.remove(engine.world, brick);
    gameState.bricks = gameState.bricks.filter(b => b !== brick);
    
    // 更新分数
    gameState.score += 10 * (config.brickRows - brick.brickRow);
    updateUI();
}

// 失去生命
function loseLife() {
    if (!gameState.isPlaying) return;  // 游戏未开始不扣除生命
    
    gameState.lives--;
    updateUI();
    
    if (gameState.lives <= 0) {
        gameOver();
    } else {
        // 移除旧的球
        if (ball) {
            World.remove(engine.world, ball);
            ball = null;
        }
        // 重新创建球（会在 startGame 再次调用 launchBall）
        createBall();
        // 重置挡板位置到屏幕中央
        Body.setPosition(paddle, { x: config.width / 2, y: config.height - 50 });
    }
}

// 开始游戏
function startGame() {
    console.log('startGame invoked');
    document.getElementById('start-screen').classList.add('hidden');
    gameState.isPlaying = true; 
    gameState.score = 0;
    gameState.lives = 5;
    updateUI();

    // 只有在没有球的情况下才创建
    if (!ball) {
        createBall();
    } else {
        console.log('Ball already exists, skipping create');
    }
    
    // 发射球
    launchBall(); 
    console.log('Ball launched');
}

// 发射球 (当游戏开始时)
function launchBall() {
    if (!gameState.isPlaying) return;  // 确保游戏在进行中才发射
    
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; // 增加角度范围
    const speed = 14; // 增加初始速度
    Body.setVelocity(ball, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
    });
}

// 更新 UI
function updateUI() {
    document.getElementById('score').textContent = `得分：${gameState.score}`;
    document.getElementById('lives').textContent = `生命：${'❤️'.repeat(gameState.lives)}`;
}

// 游戏结束
function gameOver() {
    gameState.isPlaying = false;
    document.getElementById('game-over-title').textContent = '游戏结束';
    document.getElementById('final-score').textContent = `最终得分：${gameState.score}`;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// 胜利
function winGame() {
    gameState.isPlaying = false;
    document.getElementById('game-over-title').textContent = '🎉 恭喜通关！';
    document.getElementById('final-score').textContent = `最终得分：${gameState.score}`;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// 重新开始
function restartGame() {
    // 隐藏游戏结束屏幕
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // 重置游戏状态
    gameState.isPlaying = false;
    gameState.score = 0;
    gameState.lives = 5;
    updateUI();
    
    // 移除旧的球（如果存在）
    if (ball) {
        World.remove(engine.world, ball);
        ball = null;
    }
    
    // 清除所有旧砖块
    if (gameState.bricks.length > 0) {
        gameState.bricks.forEach(brick => World.remove(engine.world, brick));
        gameState.bricks = [];
        brickRows = [];
    }
    
    // 重新生成砖块
    createBricks();
    
    // 重置挡板位置到屏幕中央
    Body.setPosition(paddle, { x: config.width / 2, y: config.height - 50 });
    
    // 重新开始
    startGame();
}

// 页面加载完成后初始化
window.addEventListener('load', init);

// 窗口大小变化时调整
window.addEventListener('resize', () => {
    config.width = window.innerWidth > 600 ? 600 : window.innerWidth - 20;
    config.height = window.innerHeight > 800 ? 800 : window.innerHeight - 20;
    render.canvas.width = config.width;
    render.canvas.height = config.height;
});
