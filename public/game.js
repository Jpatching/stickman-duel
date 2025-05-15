const socket = io();
let roomId;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Game constants
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 60;
const APPLE_SIZE = 15;
const ARROW_LENGTH = 20;
const GRAVITY = 0.3;
const POWER_INCREASE_RATE = 2;
const MAX_POWER = 100;
const ANGLE_CHANGE_RATE = 2;

// Add single-player mode logic
const isSinglePlayer = true; // Set to true for single-player mode

// Game state
const gameState = {
    localPlayer: {
        x: 50,
        y: canvas.height - PLAYER_HEIGHT,
        angle: 45,
        power: 0,
        hasApple: true
    },
    remotePlayer: {
        x: canvas.width - 50,
        y: canvas.height - PLAYER_HEIGHT,
        angle: 135,
        power: 0,
        hasApple: true
    },
    currentArrow: null,
    isMyTurn: false,
    isPoweringUp: false
};

// Input state
const keys = {
    SPACE: false,
    UP: false,
    DOWN: false
};

// Initialize game
socket.emit('join_queue');

socket.on('start_game', ({ room, isFirstPlayer }) => {
    roomId = room;
    gameState.isMyTurn = isFirstPlayer;
    updateTurnStatus();
});

socket.on('turn_update', ({ arrow }) => {
    if (arrow) {
        gameState.currentArrow = arrow;
    }
});

socket.on('apple_hit', ({ winner }) => {
    const message = winner === socket.id ? 'You win!' : 'You lose!';
    document.getElementById('turn-status').textContent = message;
});

// Input handlers
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') keys.SPACE = true;
    if (e.code === 'ArrowUp') keys.UP = true;
    if (e.code === 'ArrowDown') keys.DOWN = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        keys.SPACE = false;
        if (gameState.isMyTurn && gameState.isPoweringUp) {
            shoot();
        }
    }
    if (e.code === 'ArrowUp') keys.UP = false;
    if (e.code === 'ArrowDown') keys.DOWN = false;
});

function updateTurnStatus() {
    const status = gameState.isMyTurn ? 'Your turn!' : "Opponent's turn";
    document.getElementById('turn-status').textContent = status;
}

function shoot() {
    const player = gameState.localPlayer;
    const radians = player.angle * Math.PI / 180;
    const velocity = {
        x: Math.cos(radians) * player.power / 10,
        y: -Math.sin(radians) * player.power / 10
    };
    
    gameState.currentArrow = {
        x: player.x + PLAYER_WIDTH/2,
        y: player.y + PLAYER_HEIGHT/2,
        velocity: velocity
    };
    
    socket.emit('shoot', {
        room: roomId,
        arrow: gameState.currentArrow
    });
    
    gameState.isPoweringUp = false;
    gameState.isMyTurn = false;
    player.power = 0;
    updateTurnStatus();
}

// Update game loop for single-player mode
function updateGame() {
    const player = gameState.localPlayer;
    
    // Update angle
    if (gameState.isMyTurn) {
        if (keys.UP) player.angle = Math.min(player.angle + ANGLE_CHANGE_RATE, 170);
        if (keys.DOWN) player.angle = Math.max(player.angle - ANGLE_CHANGE_RATE, 10);
        
        // Update power
        if (keys.SPACE) {
            gameState.isPoweringUp = true;
            player.power = Math.min(player.power + POWER_INCREASE_RATE, MAX_POWER);
        }
    }
    
    // Update power meter
    document.getElementById('power-fill').style.width = `${player.power}%`;
    document.getElementById('angle-display').textContent = `Angle: ${Math.round(player.angle)}°`;
    
    // Update arrow physics
    if (gameState.currentArrow) {
        gameState.currentArrow.velocity.y += GRAVITY;
        gameState.currentArrow.x += gameState.currentArrow.velocity.x;
        gameState.currentArrow.y += gameState.currentArrow.velocity.y;
        
        // Check for collisions
        checkCollisions();
        if (isSinglePlayer) {
            checkTargetCollisions();
        }
        
        // Remove arrow if off screen
        if (isArrowOffscreen()) {
            gameState.currentArrow = null;
            if (!gameState.isMyTurn) {
                gameState.isMyTurn = true;
                updateTurnStatus();
            }
        }
    }
}

function checkCollisions() {
    const arrow = gameState.currentArrow;
    const target = gameState.isMyTurn ? gameState.remotePlayer : gameState.localPlayer;
    
    // Check apple collision
    const appleX = target.x + PLAYER_WIDTH/2;
    const appleY = target.y - APPLE_SIZE;
    const dx = arrow.x - appleX;
    const dy = arrow.y - appleY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < APPLE_SIZE) {
        target.hasApple = false;
        socket.emit('hit_apple', { room: roomId });
        gameState.currentArrow = null;
    }
    
    // Check player collision (game over if hit)
    if (arrow.x > target.x && 
        arrow.x < target.x + PLAYER_WIDTH &&
        arrow.y > target.y && 
        arrow.y < target.y + PLAYER_HEIGHT) {
        socket.emit('hit_player', { room: roomId });
        gameState.currentArrow = null;
    }
}

function isArrowOffscreen() {
    const arrow = gameState.currentArrow;
    return arrow.x < 0 || 
           arrow.x > canvas.width || 
           arrow.y > canvas.height;
}

// Add health bars and scores
function drawHealthBar(player, x, y) {
    ctx.fillStyle = 'red';
    ctx.fillRect(x, y, 100, 10);
    ctx.fillStyle = 'green';
    ctx.fillRect(x, y, player.hasApple ? 100 : 0, 10);
}

function drawScoreboard() {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(`Your Score: ${gameState.localPlayer.score || 0}`, 10, 20);
    ctx.fillText(`Opponent Score: ${gameState.remotePlayer.score || 0}`, canvas.width - 200, 20);
}

// Load character images
const characterImages = {
    ninja: new Image(),
    knight: new Image(),
    futuristic: new Image(),
    archer: new Image()
};
characterImages.ninja.src = 'public/images/ninja.png';
characterImages.knight.src = 'public/images/knight.png';
characterImages.futuristic.src = 'public/images/futuristic.png';
characterImages.archer.src = 'public/images/archer.png';

// Update player visuals
function drawPlayer(player, characterType) {
    const characterImage = characterImages[characterType];
    if (characterImage.complete) {
        ctx.drawImage(characterImage, player.x, player.y - PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT * 2);
    } else {
        // Fallback to a rectangle if the image is not loaded yet
        ctx.fillStyle = '#000';
        ctx.fillRect(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT);
    }

    // Draw apple if player still has it
    if (player.hasApple) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(player.x + PLAYER_WIDTH / 2, player.y - APPLE_SIZE, APPLE_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Draw apple leaf
        ctx.fillStyle = 'green';
        ctx.fillRect(player.x + PLAYER_WIDTH / 2 - 2, player.y - APPLE_SIZE * 2, 4, 8);
    }

    // Draw health bar
    drawHealthBar(player, player.x, player.y - 20);
}

// Update render function to use character types
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = '#654321';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Draw players with character types
    drawPlayer(gameState.localPlayer, 'ninja');
    if (!isSinglePlayer) {
        drawPlayer(gameState.remotePlayer, 'archer');
    }

    // Draw targets
    renderTargets();

    // Draw current arrow
    if (gameState.currentArrow) {
        drawArrow(gameState.currentArrow);
    }

    // Draw aim line when powering up
    if (gameState.isMyTurn && gameState.isPoweringUp) {
        drawAimLine();
    }

    // Draw scoreboard
    drawScoreboard();
}

function drawArrow(arrow) {
    const angle = Math.atan2(arrow.velocity.y, arrow.velocity.x);
    
    ctx.save();
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(angle);
    
    // Draw arrow body
    ctx.strokeStyle = 'brown';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-ARROW_LENGTH, 0);
    ctx.lineTo(ARROW_LENGTH, 0);
    ctx.stroke();
    
    // Draw arrowhead
    ctx.fillStyle = 'brown';
    ctx.beginPath();
    ctx.moveTo(ARROW_LENGTH, 0);
    ctx.lineTo(ARROW_LENGTH - 10, -5);
    ctx.lineTo(ARROW_LENGTH - 10, 5);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function drawAimLine() {
    const player = gameState.localPlayer;
    const radians = player.angle * Math.PI / 180;
    const lineLength = player.power * 2;
    
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT/2);
    ctx.lineTo(
        player.x + PLAYER_WIDTH/2 + Math.cos(radians) * lineLength,
        player.y + PLAYER_HEIGHT/2 - Math.sin(radians) * lineLength
    );
    ctx.stroke();
}

function initializeSinglePlayer() {
    gameState.remotePlayer = {
        x: canvas.width - 100,
        y: canvas.height - PLAYER_HEIGHT,
        angle: 135,
        power: 0,
        hasApple: true
    };

    // Add a static target for practice
    gameState.targets = [
        { x: canvas.width - 150, y: canvas.height - 100, size: APPLE_SIZE }
    ];
}

function renderTargets() {
    ctx.fillStyle = 'red';
    gameState.targets.forEach(target => {
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function checkTargetCollisions() {
    const arrow = gameState.currentArrow;
    gameState.targets = gameState.targets.filter(target => {
        const dx = arrow.x - target.x;
        const dy = arrow.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < target.size) {
            console.log('Target hit!');
            return false; // Remove the target if hit
        }
        return true;
    });
}

// Initialize single-player mode if enabled
if (isSinglePlayer) {
    initializeSinglePlayer();
}

// Game loop
function gameLoop() {
    updateGame();
    render();
    requestAnimationFrame(gameLoop);
}

gameLoop();
