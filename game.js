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
    lives: 3,
    isPlaying: false, // 初始状态为未开始
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
    
    // 创建球
    createBall();
    
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

// 创建球
function createBall() {
    ball = Bodies.circle(
        config.width / 2,
        config.height - 100,
        config.ballRadius,
        {
            render: { fillStyle: colors.ball },
            restitution: 1.2,  // 增加弹性
            friction: 0,
            frictionAir: 0,
            label: 'ball',
            speed: 5
        }
    );
    World.add(engine.world, ball);
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
                removeBrick(brick);
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
    
    // 每帧检查球是否掉落
    Events.on(engine, 'beforeUpdate', () => {
        if (ball.position.y > config.height + 50 && gameState.isPlaying) {
            // 重置球速度，防止继续下落
            Body.setVelocity(ball, { x: 0, y: 0 });
            loseLife();
        }
        
        // 检查是否胜利
        if (gameState.isPlaying && gameState.bricks.length === 0) {
            winGame();
        }
    });
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
        // 重置球的位置
        resetBall();
    }
}

// 重置球
function resetBall() {
    Body.setPosition(ball, { x: config.width / 2, y: config.height - 100 });
    Body.setVelocity(ball, { x: 0, y: 0 });
    
    // 短暂延迟后发射球
    setTimeout(() => {
        if (gameState.isPlaying) {
            launchBall();
        }
    }, 1000);
}

// 发射球
function launchBall() {
    if (!gameState.isPlaying) return;  // 确保游戏在进行中
    
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const speed = 10;  // 增加初始速度
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

// 开始游戏
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.lives = 3;
    updateUI();
    launchBall();
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
    // 清除所有砖块
    gameState.bricks.forEach(brick => World.remove(engine.world, brick));
    
    // 重置游戏状态
    gameState.score = 0;
    gameState.lives = 3;
    gameState.bricks = [];
    
    updateUI();
    
    // 重新创建砖块
    createBricks();
    
    // 重置球
    Body.setPosition(ball, { x: config.width / 2, y: config.height - 100 });
    Body.setVelocity(ball, { x: 0, y: 0 });
    
    // 隐藏游戏结束屏幕
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // 开始游戏
    gameState.isPlaying = true;
    setTimeout(launchBall, 1000);
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
