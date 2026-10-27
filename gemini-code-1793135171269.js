const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiOverlay = document.getElementById('ui-overlay');
const menuTitle = document.getElementById('menu-title');
const menuSubtitle = document.getElementById('menu-subtitle');
const btn1P = document.getElementById('btn-1p');
const btn2P = document.getElementById('btn-2p');

// Configurações Globais
const GRAVITY = 0.45;
const FIELD_Y = 400;
const GOAL_WIDTH = 80;
const GOAL_HEIGHT = 160;

let gameMode = '1P'; // '1P' ou '2P'
let gameState = 'MENU'; // 'MENU', 'PLAYING', 'GOAL', 'GAMEOVER'
let timer = 90;
let timerInterval = null;
let goalPauseTimer = 0;

// Sistema de Efeitos Sonoros com Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'kick') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'goal') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'powerup') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

// Teclado
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Objetos do Jogo
const ball = {
  x: 450, y: 200, vx: 0, vy: 0, radius: 14, baseRadius: 14,
  reset() {
    this.x = 450;
    this.y = 180;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = -2;
    this.radius = this.baseRadius;
  }
};

class Player {
  constructor(x, color, isAI = false, facingRight = true) {
    this.startX = x;
    this.x = x;
    this.y = FIELD_Y - 40;
    this.vx = 0;
    this.vy = 0;
    this.radius = 35;
    this.color = color;
    this.isAI = isAI;
    this.facingRight = facingRight;
    this.score = 0;
    
    this.kickAngle = 0;
    this.isKicking = false;
    this.speed = 5;
    this.jumpForce = 11;
    this.frozen = false;
    this.freezeTimer = 0;
  }

  reset() {
    this.x = this.startX;
    this.y = FIELD_Y - this.radius;
    this.vx = 0;
    this.vy = 0;
    this.kickAngle = 0;
    this.isKicking = false;
    this.frozen = false;
  }

  update() {
    if (this.frozen) {
      this.freezeTimer--;
      if (this.freezeTimer <= 0) this.frozen = false;
      return;
    }

    // Gravidade
    this.vy += GRAVITY;
    this.y += this.vy;
    this.x += this.vx;

    // Chão
    if (this.y + this.radius >= FIELD_Y) {
      this.y = FIELD_Y - this.radius;
      this.vy = 0;
    }

    // Limites de Campo
    if (this.x - this.radius < 0) this.x = this.radius;
    if (this.x + this.radius > canvas.width) this.x = canvas.width - this.radius;

    // Animação de Chute
    if (this.isKicking) {
      this.kickAngle += 0.35;
      if (this.kickAngle >= Math.PI / 2) {
        this.kickAngle = 0;
        this.isKicking = false;
      }
    }
  }

  kick() {
    if (!this.isKicking && !this.frozen) {
      this.isKicking = true;
      this.kickAngle = 0.1;
      playSound('kick');
    }
  }
}

const player1 = new Player(250, '#d32f2f', false, true);
const player2 = new Player(650, '#1976d2', true, false);

// Power-ups
const powerUpTypes = [
  { name: 'SPEED', color: '#ffeb3b', icon: '⚡' },
  { name: 'JUMP', color: '#4caf50', icon: '👟' },
  { name: 'BIGBALL', color: '#ff9800', icon: '⚽' },
  { name: 'FREEZE', color: '#00bcd4', icon: '❄️' }
];

let activePowerUp = null;

function spawnPowerUp() {
  if (activePowerUp || Math.random() > 0.003) return;
  const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
  activePowerUp = {
    x: 200 + Math.random() * 500,
    y: 150 + Math.random() * 100,
    radius: 18,
    type: type
  };
}

// Lógica da Inteligência Artificial
function updateAI() {
  if (!player2.isAI || player2.frozen) return;

  const distToBall = ball.x - player2.x;
  
  // Movimento básico em direção à bola
  if (ball.x > 350) {
    if (distToBall < -10) player2.vx = -player2.speed * 0.85;
    else if (distToBall > 10) player2.vx = player2.speed * 0.85;
    else player2.vx = 0;
  } else {
    // Voltar para a defesa
    const targetX = 680;
    if (player2.x < targetX - 10) player2.vx = player2.speed * 0.7;
    else if (player2.x > targetX + 10) player2.vx = -player2.speed * 0.7;
    else player2.vx = 0;
  }

  // Pular se a bola estiver alta e próxima
  if (Math.abs(distToBall) < 80 && ball.y < player2.y - 30 && player2.y + player2.radius >= FIELD_Y) {
    player2.vy = -player2.jumpForce;
  }

  // Chutar quando estiver perto
  if (Math.abs(distToBall) < 65 && Math.abs(ball.y - player2.y) < 60) {
    player2.kick();
  }
}

// Processar Controles
function handleInput() {
  // Player 1 (Setas + Espaço)
  if (!player1.frozen) {
    player1.vx = 0;
    if (keys['ArrowLeft']) player1.vx = -player1.speed;
    if (keys['ArrowRight']) player1.vx = player1.speed;
    if (keys['ArrowUp'] && player1.y + player1.radius >= FIELD_Y) {
      player1.vy = -player1.jumpForce;
    }
    if (keys['Space']) player1.kick();
  }

  // Player 2 (A/D/W + M) - Apenas no modo 2P
  if (!player2.isAI && !player2.frozen) {
    player2.vx = 0;
    if (keys['KeyA']) player2.vx = -player2.speed;
    if (keys['KeyD']) player2.vx = player2.speed;
    if (keys['KeyW'] && player2.y + player2.radius >= FIELD_Y) {
      player2.vy = -player2.jumpForce;
    }
    if (keys['KeyM']) player2.kick();
  }
}

// Colisões e Física da Bola
function updatePhysics() {
  ball.vy += GRAVITY * 0.7;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Fricção de Ar
  ball.vx *= 0.99;
  ball.vy *= 0.99;

  // Chão
  if (ball.y + ball.radius >= FIELD_Y) {
    ball.y = FIELD_Y - ball.radius;
    ball.vy *= -0.65;
    ball.vx *= 0.95;
  }

  // Teto
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy *= -0.7;
  }

  // Paredes Laterais (fora dos gols)
  if (ball.y < FIELD_Y - GOAL_HEIGHT) {
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx *= -0.7;
    }
    if (ball.x + ball.radius >= canvas.width) {
      ball.x = canvas.width - ball.radius;
      ball.vx *= -0.7;
    }
  }

  // Colisão com Traves Superiores
  const checkCrossbar = (gx, gy) => {
    const dx = ball.x - gx;
    const dy = ball.y - gy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ball.radius + 6) {
      const angle = Math.atan2(dy, dx);
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * 0.8 + 2;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      playSound('kick');
    }
  };

  checkCrossbar(GOAL_WIDTH, FIELD_Y - GOAL_HEIGHT);
  checkCrossbar(canvas.width - GOAL_WIDTH, FIELD_Y - GOAL_HEIGHT);

  // Colisão Jogador vs Bola
  [player1, player2].forEach(p => {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ball.radius + p.radius) {
      const angle = Math.atan2(dy, dx);
      const force = 8;
      ball.vx = Math.cos(angle) * force + p.vx * 0.5;
      ball.vy = Math.sin(angle) * force + p.vy * 0.5;
      playSound('kick');
    }

    // Colisão com a Chuteira
    if (p.isKicking) {
      const shoeX = p.x + (p.facingRight ? 30 : -30);
      const shoeY = p.y + 20;
      const sdx = ball.x - shoeX;
      const sdy = ball.y - shoeY;
      if (Math.sqrt(sdx * sdx + sdy * sdy) < ball.radius + 20) {
        ball.vx = (p.facingRight ? 1 : -1) * 12;
        ball.vy = -7;
        playSound('kick');
      }
    }
  });

  // Colisão com Power-ups
  if (activePowerUp) {
    const pdx = ball.x - activePowerUp.x;
    const pdy = ball.y - activePowerUp.y;
    if (Math.sqrt(pdx * pdx + pdy * pdy) < ball.radius + activePowerUp.radius) {
      applyPowerUp(activePowerUp.type, ball.vx > 0 ? player1 : player2);
      activePowerUp = null;
      playSound('powerup');
    }
  }

  // Verificação de Gols
  if (ball.y > FIELD_Y - GOAL_HEIGHT) {
    if (ball.x - ball.radius < GOAL_WIDTH - 10) {
      triggerGoal(player2);
    } else if (ball.x + ball.radius > canvas.width - GOAL_WIDTH + 10) {
      triggerGoal(player1);
    }
  }
}

function applyPowerUp(type, player) {
  const opponent = player === player1 ? player2 : player1;
  
  if (type.name === 'SPEED') {
    player.speed = 8;
    setTimeout(() => player.speed = 5, 5000);
  } else if (type.name === 'JUMP') {
    player.jumpForce = 15;
    setTimeout(() => player.jumpForce = 11, 5000);
  } else if (type.name === 'BIGBALL') {
    ball.radius = 28;
    setTimeout(() => ball.radius = ball.baseRadius, 6000);
  } else if (type.name === 'FREEZE') {
    opponent.frozen = true;
    opponent.freezeTimer = 180; // ~3s
  }
}

function triggerGoal(scoringPlayer) {
  if (gameState !== 'PLAYING') return;
  
  scoringPlayer.score++;
  gameState = 'GOAL';
  goalPauseTimer = 100;
  playSound('goal');
}

// Desenho Gráfico
function drawStadium() {
  // Arquibancada e Torcida
  ctx.fillStyle = '#2d114d';
  ctx.fillRect(0, 0, canvas.width, 240);

  // Torcida Pixelada Emoldurada
  const colors = ['#e53935', '#00acc1', '#fdd835', '#4caf50', '#ff9800', '#ffffff'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 30; col++) {
      ctx.fillStyle = colors[(col + row * 3) % colors.length];
      const offset = (row % 2 === 0) ? 0 : 15;
      ctx.beginPath();
      ctx.arc(col * 30 + 15 + offset, 60 + row * 30, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Cabeça
      ctx.fillStyle = '#ffcc80';
      ctx.beginPath();
      ctx.arc(col * 30 + 15 + offset, 52 + row * 30, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Painel de LED Publicitário
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, 230, canvas.width, 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('★ FRIV CLASSIC FOOTBALL HEADS ★ GOAL! ★ SPORTS HEADS ★', 180, 244);

  // Gramado
  const stripeWidth = 60;
  for (let x = 0; x < canvas.width; x += stripeWidth) {
    ctx.fillStyle = (x / stripeWidth) % 2 === 0 ? '#4bc441' : '#3cb032';
    ctx.fillRect(x, FIELD_Y, stripeWidth, canvas.height - FIELD_Y);
  }

  // Linhas do Campo
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;

  // Linha do Chão
  ctx.beginPath();
  ctx.moveTo(0, FIELD_Y);
  ctx.lineTo(canvas.width, FIELD_Y);
  ctx.stroke();

  // Linha Central e Círculo
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, FIELD_Y);
  ctx.lineTo(canvas.width / 2, FIELD_Y - 180);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width / 2, FIELD_Y - 80, 50, 0, Math.PI * 2);
  ctx.stroke();

  // Traves / Gols
  const drawGoal = (x, isLeft) => {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 5;

    // Rede
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(isLeft ? 0 : x, FIELD_Y - GOAL_HEIGHT, GOAL_WIDTH, GOAL_HEIGHT);

    // Trave Externa
    ctx.beginPath();
    ctx.moveTo(isLeft ? 0 : canvas.width, FIELD_Y - GOAL_HEIGHT);
    ctx.lineTo(isLeft ? GOAL_WIDTH : canvas.width - GOAL_WIDTH, FIELD_Y - GOAL_HEIGHT);
    ctx.lineTo(isLeft ? GOAL_WIDTH : canvas.width - GOAL_WIDTH, FIELD_Y);
    ctx.stroke();
  };

  drawGoal(0, true);
  drawGoal(canvas.width - GOAL_WIDTH, false);
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  // Efeito de Congelado
  if (p.frozen) {
    ctx.fillStyle = 'rgba(0, 188, 212, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corpo / Cabeça Grande
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // Rosto / Olhos
  const eyeOffset = p.facingRight ? 12 : -12;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(eyeOffset, -6, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(eyeOffset + (p.facingRight ? 3 : -3), -6, 4, 0, Math.PI * 2);
  ctx.fill();

  // Boca / Expressão
  ctx.beginPath();
  ctx.arc(eyeOffset / 2, 12, 6, 0, Math.PI);
  ctx.stroke();

  // Chuteira / Animação de Chute
  ctx.save();
  const shoeX = p.facingRight ? 15 : -15;
  ctx.translate(shoeX, 22);
  
  if (p.isKicking) {
    ctx.rotate((p.facingRight ? -1 : 1) * p.kickAngle * 1.5);
  }

  ctx.fillStyle = '#111';
  ctx.fillRect(p.facingRight ? 0 : -22, 0, 22, 12);
  ctx.fillStyle = '#fff';
  ctx.fillRect(p.facingRight ? 2 : -20, 8, 18, 4); // Solado
  ctx.restore();

  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // Detalhes da Bola
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPowerUp() {
  if (!activePowerUp) return;
  ctx.save();
  ctx.translate(activePowerUp.x, activePowerUp.y);

  ctx.fillStyle = activePowerUp.type.color;
  ctx.beginPath();
  ctx.arc(0, 0, activePowerUp.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(activePowerUp.type.icon, 0, 1);

  ctx.restore();
}

function drawHUD() {
  // Placar Inferior Estilo Friv
  ctx.fillStyle = '#fbd000';
  ctx.fillRect(0, 440, canvas.width, 60);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 436, canvas.width, 4);

  // Caixa de Tempo
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.fillRect(280, 448, 110, 44);
  ctx.strokeRect(280, 448, 110, 44);

  const mins = Math.floor(timer / 60).toString().padStart(2, '0');
  const secs = (timer % 60).toString().padStart(2, '0');
  ctx.fillStyle = '#000';
  ctx.font = 'bold 26px Impact';
  ctx.fillText(`${mins}:${secs}`, 298, 480);

  // Placar
  ctx.font = 'bold 36px Impact';
  ctx.fillStyle = '#d32f2f';
  ctx.fillText(player1.score, 450, 483);

  ctx.fillStyle = '#000';
  ctx.fillText(':', 488, 480);

  ctx.fillStyle = '#1976d2';
  ctx.fillText(player2.score, 515, 483);

  // Mensagem de Gol
  if (gameState === 'GOAL') {
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 64px Impact';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText('GOLOOOO!', canvas.width / 2 - 130, 200);
    ctx.fillText('GOLOOOO!', canvas.width / 2 - 130, 200);
  }
}

// Loop Principal
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawStadium();

  if (gameState === 'PLAYING' || gameState === 'GOAL') {
    if (gameState === 'PLAYING') {
      handleInput();
      updateAI();
      updatePhysics();
      spawnPowerUp();
    } else if (gameState === 'GOAL') {
      goalPauseTimer--;
      if (goalPauseTimer <= 0) {
        ball.reset();
        player1.reset();
        player2.reset();
        gameState = 'PLAYING';
      }
    }

    player1.update();
    player2.update();

    drawPowerUp();
    drawPlayer(player1);
    drawPlayer(player2);
    drawBall();
  }

  drawHUD();
  requestAnimationFrame(gameLoop);
}

// Gestão de Tempo e Estados
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState === 'PLAYING') {
      timer--;
      if (timer <= 0) {
        endGame();
      }
    }
  }, 1000);
}

function startGame(mode) {
  gameMode = mode;
  player2.isAI = (mode === '1P');

  player1.score = 0;
  player2.score = 0;
  timer = 90;

  player1.reset();
  player2.reset();
  ball.reset();

  uiOverlay.style.display = 'none';
  gameState = 'PLAYING';
  startTimer();
}

function endGame() {
  gameState = 'GAMEOVER';
  clearInterval(timerInterval);

  let winnerText = 'EMPATE!';
  if (player1.score > player2.score) winnerText = 'JOGADOR 1 VENCEU!';
  else if (player2.score > player1.score) winnerText = player2.isAI ? 'A IA VENCEU!' : 'JOGADOR 2 VENCEU!';

  menuTitle.innerText = winnerText;
  menuSubtitle.innerText = `Placar Final: ${player1.score} x ${player2.score}`;
  btn1P.innerText = 'JOGAR NOVAMENTE (1P)';
  btn2P.innerText = 'JOGAR NOVAMENTE (2P)';
  uiOverlay.style.display = 'flex';
}

// Eventos de Clique dos Botões
btn1P.addEventListener('click', () => startGame('1P'));
btn2P.addEventListener('click', () => startGame('2P'));

// Iniciar Loop
requestAnimationFrame(gameLoop);