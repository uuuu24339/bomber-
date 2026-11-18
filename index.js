// --- HTMLから操作する画面要素を取得 ---
const board = document.getElementById('board');          // 盤面エリア
const statusMessage = document.getElementById('status-message'); // 上部案内メッセージ
const startBtn = document.getElementById('start-btn');    // スタートボタン
const resetBtn = document.getElementById('reset-btn');    // リセットボタン
const ruleBtn = document.getElementById('rule-btn');      // ルールボタン
const p1Card = document.getElementById('p1-card');        // P1プレイヤーカード
const p2Card = document.getElementById('p2-card');        // P2プレイヤーカード
const p1LifeEl = document.getElementById('p1-life');      // P1ライフ表示枠
const p2LifeEl = document.getElementById('p2-life');      // P2ライフ表示枠
const ruleModal = document.getElementById('rule-modal');  // モーダル枠
const closeModal = document.getElementById('close-modal'); // モーダル閉じるボタン

// --- ルールモーダルのページ送り制御用要素 ---
const rulePages = document.querySelectorAll('.rule-page');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');
let currentRulePage = 1;
const totalRulePages = rulePages.length;

// --- ゲーム ルール定数の設定 ---
const totalCells = 16;  // 4x4＝全16マス
const setLimit = 3;     // 各プレイヤーが1回に置く爆弾の数（3個）
const playLimit = 2;    // めくりターンでめくって良いマス数（2マス）

// --- ゲームの状態・変数の初期化 ---
let gameState = 'waiting'; // ゲームの状態（waiting / p1_set / p2_set / p1_play / p2_play / game_over）
let count = 0;             // 設置した爆弾数や、めくったマス数をカウントする変数
let bombMap = Array(totalCells).fill(0); // 各マス（0～15）に置かれた爆弾の個数を記録する配列
let p1Life = 3;            // P1の残りライフ
let p2Life = 3;            // P2の残りライフ

// 爆弾SVGアイコン生成関数
function createBombSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'svg-bomb');
  svg.innerHTML = `
    <!-- 爆弾本体（黒丸） -->
    <circle cx="41" cy="58" r="33" fill="currentColor"/>
    <!-- 爆弾上部の金具 -->
    <path d="M54 35 L69 22 C71 20 74 20 76 22 L80 26 C82 28 82 31 80 33 L67 46 Z" fill="currentColor"/>
    <!-- 本体左上のツヤ（白ハイライト） -->
    <path d="M 20 57 A 20 20 0 0 1 40 37" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
    <!-- 導火線 -->
    <line x1="72" y1="24" x2="80" y2="16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <!-- 5方向に広がる火花 -->
    <line x1="84" y1="12" x2="84" y2="4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line x1="89" y1="14" x2="96" y2="9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line x1="90" y1="19" x2="98" y2="19" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line x1="79" y1="9" x2="74" y2="2" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line x1="74" y1="14" x2="67" y2="14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  `;
  return svg;
}

// ボタンクリック時のイベントリスナーを設定
startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);

// ルールモーダルの開閉処理を設定
ruleBtn.addEventListener('click', () => {
  currentRulePage = 1;
  updateRulePageDisplay();
  ruleModal.classList.remove('hidden');
});
closeModal.addEventListener('click', () => ruleModal.classList.add('hidden'));
window.addEventListener('click', (e) => { if (e.target === ruleModal) ruleModal.classList.add('hidden'); });

// ルールモーダルのページ切替処理
prevPageBtn.addEventListener('click', () => {
  if (currentRulePage > 1) {
    currentRulePage--;
    updateRulePageDisplay();
  }
});

nextPageBtn.addEventListener('click', () => {
  if (currentRulePage < totalRulePages) {
    currentRulePage++;
    updateRulePageDisplay();
  }
});

// ルールモーダルの表示更新
function updateRulePageDisplay() {
  rulePages.forEach(page => {
    if (parseInt(page.dataset.page) === currentRulePage) {
      page.classList.remove('hidden');
    } else {
      page.classList.add('hidden');
    }
  });

  pageIndicator.textContent = `${currentRulePage} / ${totalRulePages}`;
  prevPageBtn.disabled = (currentRulePage === 1);
  nextPageBtn.disabled = (currentRulePage === totalRulePages);
}

// --- 指定したマスの周囲8マスにある爆弾の合計数を計算する関数 ---
function getAdjacentBombCount(index) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  let count = 0;

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
  ];

  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;

    if (r >= 0 && r < 4 && c >= 0 && c < 4) {
      const neighborIndex = r * 4 + c;
      count += bombMap[neighborIndex];
    }
  }

  return count;
}

// --- 初期化処理：盤面の16マスをJavaScriptで動的に生成 ---
for (let i = 0; i < totalCells; i++) {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.dataset.index = i;

  cell.addEventListener('click', () => {
    if (gameState === 'waiting' || gameState === 'game_over') return;

    // 1. プレイヤー1 爆弾設置フェーズ
    if (gameState === 'p1_set') {
      if (cell.dataset.p1Set === 'true' || count >= setLimit) return;
      
      bombMap[i] += 1;
      cell.dataset.p1Set = 'true';
      cell.classList.add('bomb-set-p1');
      
      cell.innerHTML = '';
      cell.appendChild(createBombSvg());
      
      count++;
      updateStatus();

      if (count === setLimit) {
        setTimeout(() => {
          resetBoard(); // 盤面の見た目を緑色にリセット
          gameState = 'p2_set';
          count = 0;
          updateStatus();
        }, 500);
      }
    }
    // 2. プレイヤー2 爆弾設置フェーズ
    else if (gameState === 'p2_set') {
      if (cell.dataset.p2Set === 'true' || count >= setLimit) return;

      bombMap[i] += 1;
      cell.dataset.p2Set = 'true';
      cell.classList.add('bomb-set-p2');
      
      cell.innerHTML = '';
      cell.appendChild(createBombSvg());

      count++;
      updateStatus();

      if (count === setLimit) {
        setTimeout(() => {
          resetBoard(); // 盤面の見た目を緑色にリセット
          gameState = 'p1_play';
          count = 0;
          updateStatus();
        }, 500);
      }
    }
    // 3. めくり（プレイ）フェーズ
    else if (gameState === 'p1_play' || gameState === 'p2_play') {
      if (cell.classList.contains('revealed') || count >= playLimit) return;

      cell.classList.add('revealed');
      count++; // ★ クリックした瞬間に即時カウントアップ

      const bombCount = bombMap[i];

      if (bombCount > 0) {
        cell.innerHTML = '';
        for (let b = 0; b < bombCount; b++) {
          cell.appendChild(createBombSvg());
        }

        if (cell.dataset.p1Set === 'true') {
          cell.classList.add('bomb-owner-p1');
        } else if (cell.dataset.p2Set === 'true') {
          cell.classList.add('bomb-owner-p2');
        }

        if (gameState === 'p1_play') {
          cell.classList.add('revealed-by-p1');
          p1Life -= bombCount;
        } else {
          cell.classList.add('revealed-by-p2');
          p2Life -= bombCount;
        }
        
        updateLifeDisplay();
      } else {
        const adjacentBombs = getAdjacentBombCount(i);
        cell.textContent = adjacentBombs;
        cell.dataset.count = adjacentBombs;
        cell.classList.add('safe');
      }

      if (p1Life <= 0 || p2Life <= 0) {
        endGame();
        return;
      }

      // ★ クリックした瞬間にカウント表示（1/2 や 2/2）を最新に更新
      updateStatus();

      // ★ 2マスめくり終わった場合のみ、1.5秒待ってからターン交代
      if (count === playLimit) {
        setTimeout(() => {
          count = 0;
          gameState = (gameState === 'p1_play') ? 'p2_play' : 'p1_play';
          updateStatus(); // 手番交代後のメッセージ更新
        }, 1500); // 1.5秒ディレイ
      }
    }
  });

  board.appendChild(cell);
}

// --- ゲームスタート時の処理 ---
function startGame() {
  gameState = 'p1_set';
  count = 0;
  bombMap = Array(totalCells).fill(0);
  p1Life = 3;
  p2Life = 3;

  p1Card.classList.remove('winner');
  p2Card.classList.remove('winner');

  updateLifeDisplay(); 
  startBtn.classList.add('hidden');
  resetBtn.classList.remove('hidden');
  resetBoardAll(); 
  updateStatus(); 
}

// --- リセット（途中やり直し）処理 ---
function resetGame() {
  gameState = 'waiting';
  count = 0;
  bombMap = Array(totalCells).fill(0);
  p1Life = 3;
  p2Life = 3;

  p1Card.classList.remove('winner');
  p2Card.classList.remove('winner');

  updateLifeDisplay();
  resetBoardAll();
  
  startBtn.textContent = 'ゲームスタート';
  startBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');
  
  updateStatus();
}

// --- 残りライフのハート表示更新関数 ---
function updateLifeDisplay() {
  p1LifeEl.textContent = '❤️'.repeat(Math.max(0, p1Life)) || '💀';
  p2LifeEl.textContent = '❤️'.repeat(Math.max(0, p2Life)) || '💀';
}

// --- ゲーム終了（勝敗決定）時の処理 ---
function endGame() {
  gameState = 'game_over';
  p1Card.classList.remove('active');
  p2Card.classList.remove('active');
  
  statusMessage.classList.remove('p1-turn', 'p2-turn');

  if (p1Life <= 0) {
    statusMessage.textContent = '🎉 プレイヤー2 の勝利！';
    p2Card.classList.add('winner');
    statusMessage.classList.add('p2-turn');
  } else {
    statusMessage.textContent = '🎉 プレイヤー1 の勝利！';
    p1Card.classList.add('winner');
    statusMessage.classList.add('p1-turn');
  }

  revealAllCells();

  startBtn.textContent = 'もう一度あそぶ';
  startBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');
}

// 233行目〜260行目（revealAllCells関数）
function revealAllCells() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, index) => {
    const bombCount = bombMap[index];

    // ★ 爆弾が設置されているマスのみオープン表示
    if (bombCount > 0) {
      cell.classList.add('revealed');
      cell.innerHTML = '';
      for (let b = 0; b < bombCount; b++) {
        cell.appendChild(createBombSvg());
      }

      // 設置者に応じた爆弾色を適用
      if (cell.dataset.p1Set === 'true') {
        cell.classList.add('bomb-owner-p1');
      } else if (cell.dataset.p2Set === 'true') {
        cell.classList.add('bomb-owner-p2');
      }
    }
  });
}

// フェーズ切替時の見た目上（表示のみ）リセット処理
function resetBoard() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => {
    cell.innerHTML = '';
    cell.classList.remove(
      'bomb-set-p1', 'bomb-set-p2', 
      'bomb-owner-p1', 'bomb-owner-p2', 
      'revealed-by-p1', 'revealed-by-p2', 
      'safe', 'revealed'
    );
  });
}

// ゲーム再スタート時の完全盤面リセット関数
function resetBoardAll() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => {
    cell.innerHTML = '';
    cell.classList.remove(
      'bomb-set-p1', 'bomb-set-p2', 
      'bomb-owner-p1', 'bomb-owner-p2', 
      'revealed-by-p1', 'revealed-by-p2', 
      'safe', 'revealed'
    );
    delete cell.dataset.p1Set;
    delete cell.dataset.p2Set;
    delete cell.dataset.count;
  });
}

// --- 現在のターン・進行状況に合わせて画面表示を更新する関数 ---
function updateStatus() {
  p1Card.classList.remove('active');
  p2Card.classList.remove('active');
  statusMessage.classList.remove('p1-turn', 'p2-turn');

  if (gameState === 'waiting') {
    statusMessage.textContent = '「スタート」を押して開始';
  } else if (gameState === 'p1_set') {
    p1Card.classList.add('active');
    statusMessage.classList.add('p1-turn');
    statusMessage.textContent = `P1: 爆弾を設置 (${count}/${setLimit})`;
  } else if (gameState === 'p2_set') {
    p1Card.classList.add('active');
    statusMessage.classList.add('p2-turn');
    statusMessage.textContent = `P2: 爆弾を設置 (${count}/${setLimit})`;
  } else if (gameState === 'p1_play') {
    p1Card.classList.add('active');
    statusMessage.classList.add('p1-turn');
    statusMessage.textContent = `P1: マスをめくる (${count}/${playLimit})`;
  } else if (gameState === 'p2_play') {
    p2Card.classList.add('active');
    statusMessage.classList.add('p2-turn');
    statusMessage.textContent = `P2: マスをめくる (${count}/${playLimit})`;
  }
}

// 初回呼び出し（画面アクセス時）
updateStatus();

// ★ ウェブサイトにアクセスした瞬間にルール説明モーダルを自動表示
currentRulePage = 1;
updateRulePageDisplay();
ruleModal.classList.remove('hidden');
