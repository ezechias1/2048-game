(function() {
    var SIZE = 4;
    var grid = [];
    var score = 0;
    var best = parseInt(localStorage.getItem('2048-best')) || 0;
    var won = false;
    var moving = false;

    var tileContainer = document.getElementById('tileContainer');
    var scoreEl = document.getElementById('score');
    var bestEl = document.getElementById('best');
    var scoreAddEl = document.getElementById('scoreAdd');
    var overlay = document.getElementById('overlay');
    var overlayText = document.getElementById('overlayText');

    bestEl.textContent = best;

    // ==========================================
    // SOUND ENGINE (Web Audio API — no files)
    // ==========================================
    var audioCtx = null;
    var soundEnabled = localStorage.getItem('2048-sound') !== 'off';

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type, volume) {
        if (!soundEnabled) return;
        try {
            var ctx = getAudioCtx();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.value = volume || 0.08;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) {}
    }

    function sfxMove() {
        playTone(220, 0.08, 'triangle', 0.06);
    }

    function sfxMerge(value) {
        var freq = 300 + Math.min(value, 2048) * 0.3;
        playTone(freq, 0.15, 'sine', 0.1);
        setTimeout(function() { playTone(freq * 1.5, 0.1, 'sine', 0.06); }, 50);
    }

    function sfxWin() {
        var notes = [523, 659, 784, 1047];
        notes.forEach(function(n, i) {
            setTimeout(function() { playTone(n, 0.3, 'sine', 0.1); }, i * 120);
        });
    }

    function sfxGameOver() {
        playTone(200, 0.3, 'sawtooth', 0.06);
        setTimeout(function() { playTone(150, 0.4, 'sawtooth', 0.04); }, 150);
    }

    function sfxNewGame() {
        playTone(440, 0.1, 'triangle', 0.06);
        setTimeout(function() { playTone(550, 0.1, 'triangle', 0.06); }, 80);
    }

    // Sound toggle
    var soundBtn = document.getElementById('soundBtn');
    function updateSoundBtn() {
        soundBtn.classList.toggle('muted', !soundEnabled);
        soundBtn.title = soundEnabled ? 'Mute Sound' : 'Unmute Sound';
    }
    updateSoundBtn();

    soundBtn.addEventListener('click', function() {
        soundEnabled = !soundEnabled;
        localStorage.setItem('2048-sound', soundEnabled ? 'on' : 'off');
        updateSoundBtn();
        if (soundEnabled) {
            getAudioCtx();
            playTone(440, 0.1, 'triangle', 0.06);
        }
    });

    // ==========================================
    // THEMES
    // ==========================================
    var themes = ['dark', 'light', 'retro', 'neon'];
    var currentTheme = localStorage.getItem('2048-theme') || 'dark';

    function applyTheme(theme) {
        document.body.className = theme === 'dark' ? '' : 'theme-' + theme;
        currentTheme = theme;
        localStorage.setItem('2048-theme', theme);
    }
    applyTheme(currentTheme);

    document.getElementById('themeBtn').addEventListener('click', function() {
        var idx = themes.indexOf(currentTheme);
        var next = themes[(idx + 1) % themes.length];
        applyTheme(next);
    });

    // ==========================================
    // LEADERBOARD
    // ==========================================
    var leaderboard = JSON.parse(localStorage.getItem('2048-leaderboard') || '[]');
    var lbModal = document.getElementById('leaderboardModal');
    var lbBody = document.getElementById('lbBody');
    var lbEmpty = document.getElementById('lbEmpty');

    function saveLeaderboard() {
        localStorage.setItem('2048-leaderboard', JSON.stringify(leaderboard));
    }

    function addToLeaderboard(finalScore, bestTile) {
        if (finalScore === 0) return;
        leaderboard.push({
            score: finalScore,
            tile: bestTile,
            date: new Date().toLocaleDateString()
        });
        leaderboard.sort(function(a, b) { return b.score - a.score; });
        if (leaderboard.length > 10) leaderboard = leaderboard.slice(0, 10);
        saveLeaderboard();
    }

    function getBestTile() {
        var maxVal = 0;
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].value > maxVal) {
                    maxVal = grid[r][c].value;
                }
            }
        }
        return maxVal;
    }

    function renderLeaderboard() {
        lbBody.innerHTML = '';
        if (leaderboard.length === 0) {
            lbEmpty.classList.remove('hidden');
            return;
        }
        lbEmpty.classList.add('hidden');
        leaderboard.forEach(function(entry, i) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + entry.score.toLocaleString() + '</td><td>' + entry.tile + '</td><td>' + entry.date + '</td>';
            lbBody.appendChild(tr);
        });
    }

    document.getElementById('leaderboardBtn').addEventListener('click', function() {
        renderLeaderboard();
        lbModal.classList.remove('hidden');
    });

    document.getElementById('closeLeaderboard').addEventListener('click', function() {
        lbModal.classList.add('hidden');
    });

    lbModal.addEventListener('click', function(e) {
        if (e.target === lbModal) lbModal.classList.add('hidden');
    });

    document.getElementById('clearLbBtn').addEventListener('click', function() {
        leaderboard = [];
        saveLeaderboard();
        renderLeaderboard();
    });

    // ==========================================
    // GAME LOGIC
    // ==========================================
    function getTileSize() {
        var containerWidth = tileContainer.offsetWidth;
        var gap = containerWidth > 400 ? 8 : 6;
        var tileSize = (containerWidth - gap * (SIZE - 1)) / SIZE;
        return { size: tileSize, gap: gap };
    }

    function tilePos(row, col) {
        var t = getTileSize();
        return {
            top: row * (t.size + t.gap),
            left: col * (t.size + t.gap),
            size: t.size
        };
    }

    function initGrid() {
        grid = [];
        for (var r = 0; r < SIZE; r++) {
            grid[r] = [];
            for (var c = 0; c < SIZE; c++) {
                grid[r][c] = null;
            }
        }
    }

    function createTileEl(value, row, col, isNew) {
        var el = document.createElement('div');
        var pos = tilePos(row, col);
        var cls = value <= 2048 ? 'tile-' + value : 'tile-super';
        el.className = 'tile ' + cls + (isNew ? ' new' : '');
        el.textContent = value;
        el.style.width = pos.size + 'px';
        el.style.height = pos.size + 'px';
        el.style.lineHeight = pos.size + 'px';
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        return el;
    }

    function addRandomTile() {
        var empty = [];
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) empty.push({ r: r, c: c });
            }
        }
        if (empty.length === 0) return;
        var spot = empty[Math.floor(Math.random() * empty.length)];
        var value = Math.random() < 0.9 ? 2 : 4;
        var el = createTileEl(value, spot.r, spot.c, true);
        tileContainer.appendChild(el);
        grid[spot.r][spot.c] = { value: value, el: el };
    }

    function renderTiles() {
        tileContainer.innerHTML = '';
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c]) {
                    var tile = grid[r][c];
                    var el = createTileEl(tile.value, r, c, false);
                    tileContainer.appendChild(el);
                    tile.el = el;
                }
            }
        }
    }

    function slideRow(row) {
        var arr = row.filter(function(t) { return t !== null; });
        var scored = 0;
        var moved = false;

        for (var i = 0; i < arr.length - 1; i++) {
            if (arr[i].value === arr[i + 1].value) {
                arr[i].value *= 2;
                arr[i].merged = true;
                scored += arr[i].value;
                arr.splice(i + 1, 1);
            }
        }

        while (arr.length < SIZE) {
            arr.push(null);
        }

        for (var i = 0; i < SIZE; i++) {
            var oldVal = row[i] ? row[i].value : 0;
            var newVal = arr[i] ? arr[i].value : 0;
            if (oldVal !== newVal) moved = true;
        }

        return { row: arr, scored: scored, moved: moved };
    }

    function getLine(dir, idx) {
        var line = [];
        for (var i = 0; i < SIZE; i++) {
            if (dir === 'left') line.push(grid[idx][i]);
            else if (dir === 'right') line.push(grid[idx][SIZE - 1 - i]);
            else if (dir === 'up') line.push(grid[i][idx]);
            else line.push(grid[SIZE - 1 - i][idx]);
        }
        return line;
    }

    function setLine(dir, idx, line) {
        for (var i = 0; i < SIZE; i++) {
            if (dir === 'left') grid[idx][i] = line[i];
            else if (dir === 'right') grid[idx][SIZE - 1 - i] = line[i];
            else if (dir === 'up') grid[i][idx] = line[i];
            else grid[SIZE - 1 - i][idx] = line[i];
        }
    }

    // Score float animation
    var scoreAddTimeout;
    function showScoreAdd(points) {
        clearTimeout(scoreAddTimeout);
        scoreAddEl.textContent = '+' + points;
        scoreAddEl.classList.remove('hidden');
        scoreAddEl.style.animation = 'none';
        scoreAddEl.offsetHeight; // reflow
        scoreAddEl.style.animation = '';
        scoreAddTimeout = setTimeout(function() {
            scoreAddEl.classList.add('hidden');
        }, 600);
    }

    function move(dir) {
        if (moving) return;
        var totalScored = 0;
        var anyMoved = false;
        var hadMerge = false;

        for (var i = 0; i < SIZE; i++) {
            var line = getLine(dir, i);
            var result = slideRow(line);
            if (result.moved) anyMoved = true;
            totalScored += result.scored;
            setLine(dir, i, result.row);
        }

        if (!anyMoved) return;

        moving = true;
        sfxMove();

        score += totalScored;
        scoreEl.textContent = score;
        if (totalScored > 0) showScoreAdd(totalScored);

        if (score > best) {
            best = score;
            bestEl.textContent = best;
            localStorage.setItem('2048-best', best);
        }

        renderTiles();

        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].merged) {
                    grid[r][c].el.classList.add('merged');
                    grid[r][c].merged = false;
                    hadMerge = true;
                    sfxMerge(grid[r][c].value);

                    if (grid[r][c].value === 2048 && !won) {
                        won = true;
                        sfxWin();
                        setTimeout(function() {
                            addToLeaderboard(score, getBestTile());
                            overlayText.textContent = 'You Win!';
                            overlayText.className = 'overlay-text win';
                            overlay.classList.remove('hidden');
                        }, 300);
                    }
                }
            }
        }

        setTimeout(function() {
            addRandomTile();
            moving = false;

            if (isGameOver()) {
                sfxGameOver();
                addToLeaderboard(score, getBestTile());
                setTimeout(function() {
                    overlayText.textContent = 'Game Over!';
                    overlayText.className = 'overlay-text';
                    overlay.classList.remove('hidden');
                }, 200);
            }
        }, 130);
    }

    function isGameOver() {
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) return false;
                var val = grid[r][c].value;
                if (c < SIZE - 1 && grid[r][c + 1] && grid[r][c + 1].value === val) return false;
                if (r < SIZE - 1 && grid[r + 1][c] && grid[r + 1][c].value === val) return false;
            }
        }
        return true;
    }

    function newGame() {
        initGrid();
        tileContainer.innerHTML = '';
        overlay.classList.add('hidden');
        score = 0;
        won = false;
        scoreEl.textContent = '0';
        addRandomTile();
        addRandomTile();
        sfxNewGame();
    }

    // Keyboard
    document.addEventListener('keydown', function(e) {
        var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        if (map[e.key]) {
            e.preventDefault();
            move(map[e.key]);
        }
    });

    // Touch/swipe
    var touchStartX, touchStartY;
    var board = document.getElementById('board');

    board.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    board.addEventListener('touchend', function(e) {
        if (!touchStartX || !touchStartY) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 20) return;

        if (absDx > absDy) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }

        touchStartX = null;
        touchStartY = null;
    }, { passive: true });

    board.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    // Buttons
    document.getElementById('newGameBtn').addEventListener('click', newGame);
    document.getElementById('retryBtn').addEventListener('click', newGame);

    // Handle resize
    window.addEventListener('resize', function() {
        renderTiles();
    });

    // Start
    newGame();
})();
