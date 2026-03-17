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
    var overlay = document.getElementById('overlay');
    var overlayText = document.getElementById('overlayText');

    bestEl.textContent = best;

    // Tile size/gap calculations
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

    // Initialize empty grid
    function initGrid() {
        grid = [];
        for (var r = 0; r < SIZE; r++) {
            grid[r] = [];
            for (var c = 0; c < SIZE; c++) {
                grid[r][c] = null;
            }
        }
    }

    // Create a tile DOM element
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

    // Add a random tile (2 or 4)
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

    // Render all tiles (rebuild DOM)
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

    // Slide a single row left, return { row, scored, moved }
    function slideRow(row) {
        var arr = row.filter(function(t) { return t !== null; });
        var scored = 0;
        var merged = [];
        var moved = false;

        // Merge
        for (var i = 0; i < arr.length - 1; i++) {
            if (arr[i].value === arr[i + 1].value) {
                arr[i].value *= 2;
                arr[i].merged = true;
                scored += arr[i].value;
                arr.splice(i + 1, 1);
            }
        }

        // Pad
        while (arr.length < SIZE) {
            arr.push(null);
        }

        // Check if moved
        for (var i = 0; i < SIZE; i++) {
            var oldVal = row[i] ? row[i].value : 0;
            var newVal = arr[i] ? arr[i].value : 0;
            if (oldVal !== newVal) moved = true;
        }

        return { row: arr, scored: scored, moved: moved };
    }

    // Extract row/col based on direction
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

    function move(dir) {
        if (moving) return;
        var totalScored = 0;
        var anyMoved = false;

        for (var i = 0; i < SIZE; i++) {
            var line = getLine(dir, i);
            var result = slideRow(line);
            if (result.moved) anyMoved = true;
            totalScored += result.scored;
            setLine(dir, i, result.row);
        }

        if (!anyMoved) return;

        moving = true;
        score += totalScored;
        scoreEl.textContent = score;
        if (score > best) {
            best = score;
            bestEl.textContent = best;
            localStorage.setItem('2048-best', best);
        }

        // Animate tiles to new positions
        renderTiles();

        // Mark merged tiles
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].merged) {
                    grid[r][c].el.classList.add('merged');
                    grid[r][c].merged = false;

                    // Check win
                    if (grid[r][c].value === 2048 && !won) {
                        won = true;
                        setTimeout(function() {
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

    // Prevent scroll on board
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
