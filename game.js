// 创建球
function createBall() {
    ball = Bodies.circle(
        config.width / 2,
        config.height - 100,
        config.ballRadius,
        {
            render: { fillStyle: colors.ball },
            restitution: 1.2,  // 保持固定的弹性值
            friction: 0,
            frictionAir: 0,
            label: 'ball',
            // 初始速度设为0，只在 startGame/restartGame 中通过 launchBall() 发射
            inertia: 0, 
            frictionStatic: 0 // 确保球不会因静摩擦而卡住
        }
    );
    World.add(engine.world, ball);
    // 确保球在未开始游戏时保持静止
    Body.setVelocity(ball, { x: 0, y: 0 });
}

// 重置球
function resetBall() {
    Body.setPosition(ball, { x: config.width / 2, y: config.height - 100 });
    // 重置速度为静止，等待 startGame() 触发 launchBall()
    Body.setVelocity(ball, { x: 0, y: 0 });
}

// 启动游戏
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    // 确保在设置 isPlaying 为 true 后再发射球
    gameState.isPlaying = true; 
    gameState.score = 0;
    gameState.lives = 3;
    updateUI();

    // 仅在此处发射球
    launchBall(); 
}

// 发射球 (当游戏开始时)
function launchBall() {
    if (!gameState.isPlaying) return;  // 确保游戏在进行中才发射
    
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const speed = 10;  // 调整速度，但不是通过击中砖块增加
    Body.setVelocity(ball, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
    });
}

// ... (rest of the code)
