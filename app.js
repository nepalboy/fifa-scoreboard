import {
    isFirebaseEnabled,
    getSavedFirebaseConfig,
    saveFirebaseConfig,
    clearFirebaseConfig,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    subscribeToAuth,
    getSettings,
    saveSettings,
    getPlayers,
    savePlayer,
    getMatches,
    saveMatch,
    resetTournament,
    simulateMockLogin,
    simulateMockRegister
} from './firebase-config.js';

// ----------------------------------------------------
// APP STATE
// ----------------------------------------------------
let currentUser = null;
let settings = null;
let players = [];
let matches = [];
let activeView = 'dashboard';
let activeRoundFilter = 'all'; // 'all', '1', '2', '3', '4', '5', '6'
let selectedMatch = null;

// Roster of 64 teams
const TEAMS_64 = [
    { name: 'Argentina', code: 'ar' }, { name: 'France', code: 'fr' },
    { name: 'Brazil', code: 'br' }, { name: 'England', code: 'gb-eng' },
    { name: 'Croatia', code: 'hr' }, { name: 'Netherlands', code: 'nl' },
    { name: 'Portugal', code: 'pt' }, { name: 'Spain', code: 'es' },
    { name: 'Italy', code: 'it' }, { name: 'Germany', code: 'de' },
    { name: 'Belgium', code: 'be' }, { name: 'Uruguay', code: 'uy' },
    { name: 'Mexico', code: 'mx' }, { name: 'USA', code: 'us' },
    { name: 'Senegal', code: 'sn' }, { name: 'Switzerland', code: 'ch' },
    { name: 'Japan', code: 'jp' }, { name: 'Denmark', code: 'dk' },
    { name: 'South Korea', code: 'kr' }, { name: 'Poland', code: 'pl' },
    { name: 'Canada', code: 'ca' }, { name: 'Morocco', code: 'ma' },
    { name: 'Ecuador', code: 'ec' }, { name: 'Australia', code: 'au' },
    { name: 'Cameroon', code: 'cm' }, { name: 'Ghana', code: 'gh' },
    { name: 'Colombia', code: 'co' }, { name: 'Sweden', code: 'se' },
    { name: 'Chile', code: 'cl' }, { name: 'Peru', code: 'pe' },
    { name: 'Nigeria', code: 'ng' }, { name: 'Egypt', code: 'eg' },
    { name: 'Algeria', code: 'dz' }, { name: 'Tunisia', code: 'tn' },
    { name: 'Saudi Arabia', code: 'sa' }, { name: 'Iran', code: 'ir' },
    { name: 'Costa Rica', code: 'cr' }, { name: 'Wales', code: 'gb-wls' },
    { name: 'Austria', code: 'at' }, { name: 'Turkey', code: 'tr' },
    { name: 'Ukraine', code: 'ua' }, { name: 'Czechia', code: 'cz' },
    { name: 'Norway', code: 'no' }, { name: 'Hungary', code: 'hu' },
    { name: 'Greece', code: 'gr' }, { name: 'Ivory Coast', code: 'ci' },
    { name: 'Serbia', code: 'rs' }, { name: 'Qatar', code: 'qa' },
    { name: 'Jamaica', code: 'jm' }, { name: 'Panama', code: 'pa' },
    { name: 'New Zealand', code: 'nz' }, { name: 'South Africa', code: 'za' },
    { name: 'Romania', code: 'ro' }, { name: 'Scotland', code: 'gb-sct' },
    { name: 'Republic of Ireland', code: 'ie' }, { name: 'Northern Ireland', code: 'gb-nir' },
    { name: 'Finland', code: 'fi' }, { name: 'Iceland', code: 'is' },
    { name: 'Slovakia', code: 'sk' }, { name: 'Slovenia', code: 'si' },
    { name: 'Paraguay', code: 'py' }, { name: 'Venezuela', code: 've' },
    { name: 'Bolivia', code: 'bo' }, { name: 'Honduras', code: 'hn' }
];

const ROUND_DETAILS = {
    1: { name: 'Round of 64', matchesCount: 32 },
    2: { name: 'Round of 32', matchesCount: 16 },
    3: { name: 'Round of 16', matchesCount: 8 },
    4: { name: 'Quarter-finals', matchesCount: 4 },
    5: { name: 'Semi-finals', matchesCount: 2 },
    6: { name: 'Finals', matchesCount: 1 }
};

// Math mapping for tournament brackets (Match progression)
function getNextMatchInfo(matchId) {
    if (matchId >= 1 && matchId <= 32) {
        return { nextId: 32 + Math.ceil(matchId / 2), slot: matchId % 2 !== 0 ? 'home' : 'away' };
    } else if (matchId >= 33 && matchId <= 48) {
        return { nextId: 48 + Math.ceil((matchId - 32) / 2), slot: matchId % 2 !== 0 ? 'home' : 'away' };
    } else if (matchId >= 49 && matchId <= 56) {
        return { nextId: 56 + Math.ceil((matchId - 48) / 2), slot: matchId % 2 !== 0 ? 'home' : 'away' };
    } else if (matchId >= 57 && matchId <= 60) {
        return { nextId: 60 + Math.ceil((matchId - 56) / 2), slot: matchId % 2 !== 0 ? 'home' : 'away' };
    } else if (matchId >= 61 && matchId <= 62) {
        return { nextId: 63, slot: matchId % 2 !== 0 ? 'home' : 'away' };
    }
    return null; // Final match 63 has no progression
}

function getMatchLevel(matchId) {
    if (matchId >= 1 && matchId <= 32) return 1;
    if (matchId >= 33 && matchId <= 48) return 2;
    if (matchId >= 49 && matchId <= 56) return 3;
    if (matchId >= 57 && matchId <= 60) return 4;
    if (matchId >= 61 && matchId <= 62) return 5;
    if (matchId == 63) return 6;
    return 1;
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS
// ----------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <div>${message}</div>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ----------------------------------------------------
// RENDER VIEWS
// ----------------------------------------------------
function switchView(viewId) {
    activeView = viewId;
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-view') === viewId) {
            link.classList.add('active');
        }
    });

    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'bracket') renderBracket();
    if (viewId === 'leaderboard') renderLeaderboard();
    if (viewId === 'admin') renderAdmin();
}

// Helper to update the points listed under Tournament Rules dynamically
function updateRulesPointsDisplay() {
    if (!settings || !settings.levelPoints) return;
    for (let level = 1; level <= 6; level++) {
        const points = settings.levelPoints[level];
        const winSpan = document.getElementById(`rules-lvl${level}-win`);
        const tieSpan = document.getElementById(`rules-lvl${level}-tie`);
        if (winSpan && points) winSpan.innerText = points.win;
        if (tieSpan && points) tieSpan.innerText = points.tie;
    }
}

// ----------------------------------------------------
// DATA REFRESH & SYNCRONIZATION
// ----------------------------------------------------
async function loadData() {
    try {
        settings = await getSettings();
        players = await getPlayers();
        matches = await getMatches();
        
        if (matches.length === 0) {
            await initializeNewBracket(false);
            matches = await getMatches();
        }
        
        updateRulesPointsDisplay();
    } catch (e) {
        console.error("Error loading DB data", e);
        showToast("Error connecting to database. Running in offline/cached mode.", "error");
    }
}

async function initializeNewBracket(resetScores = false) {
    const initialMatches = [];
    
    for (let i = 1; i <= 32; i++) {
        const teamAIndex = (i - 1) * 2;
        const teamBIndex = teamAIndex + 1;
        initialMatches.push({
            id: i,
            level: 1,
            homeTeam: TEAMS_64[teamAIndex],
            awayTeam: TEAMS_64[teamBIndex],
            homeScore: null,
            awayScore: null,
            outcome: null,
            completed: false,
            reporterId: null
        });
    }

    for (let i = 33; i <= 63; i++) {
        initialMatches.push({
            id: i,
            level: getMatchLevel(i),
            homeTeam: null,
            awayTeam: null,
            homeScore: null,
            awayScore: null,
            outcome: null,
            completed: false,
            reporterId: null
        });
    }

    await resetTournament(initialMatches, resetScores);
    showToast("Bracket initialized with 64 World Class Teams!", "success");
}

// Recalculates all player points based on completed matches and current settings
async function recalculatePlayerPoints() {
    players.forEach(p => p.points = 0);
    
    matches.forEach(m => {
        if (m.completed && m.reporterId) {
            const reporter = players.find(p => p.id === m.reporterId);
            if (reporter) {
                const levelConfig = settings.levelPoints[m.level];
                if (m.outcome === 'tie') {
                    reporter.points += Number(levelConfig.tie || 0);
                } else if (m.outcome === 'home' || m.outcome === 'away') {
                    reporter.points += Number(levelConfig.win || 0);
                }
            }
        }
    });

    for (const player of players) {
        await savePlayer(player);
    }
    players = await getPlayers(); 
}

// ----------------------------------------------------
// VIEW RENDERING IMPLEMENTATIONS
// ----------------------------------------------------

function renderDashboard() {
    const totalMatches = matches.length;
    const completedCount = matches.filter(m => m.completed).length;
    const activePlayersCount = players.length;
    
    document.getElementById('stat-completed-matches').innerText = `${completedCount}/${totalMatches}`;
    document.getElementById('stat-registered-players').innerText = activePlayersCount;
    
    const topPlayer = players[0];
    document.getElementById('stat-top-player').innerText = topPlayer ? topPlayer.name : 'None';
    document.getElementById('stat-top-score').innerText = topPlayer ? `${topPlayer.points} pts` : '0 pts';

    // 1. RENDER INDIVIDUAL SCORES CARD (PERSONAL STANDINGS)
    const perfAuthDiv = document.getElementById('dash-perf-authenticated');
    const perfUnauthDiv = document.getElementById('dash-perf-unauthenticated');
    const perfAdminBadge = document.getElementById('dash-perf-admin-badge');

    if (currentUser) {
        perfUnauthDiv.style.display = 'none';
        perfAuthDiv.style.display = 'flex';
        
        if (currentUser.role === 'admin') {
            perfAdminBadge.style.display = 'inline-block';
        } else {
            perfAdminBadge.style.display = 'none';
        }

        // Find user rank
        const userRank = players.findIndex(p => p.id === currentUser.id) + 1;
        const userMatches = matches.filter(m => m.completed && m.reporterId === currentUser.id);
        const userWins = userMatches.filter(m => m.outcome === 'home' || m.outcome === 'away').length;
        const userTies = userMatches.filter(m => m.outcome === 'tie').length;

        document.getElementById('dash-perf-avatar').src = currentUser.photoURL;
        document.getElementById('dash-perf-rank').innerText = `#${userRank}`;
        document.getElementById('dash-perf-points').innerText = `${currentUser.points} PTS`;
        document.getElementById('dash-perf-wins').innerText = userWins;
        document.getElementById('dash-perf-ties').innerText = userTies;
        document.getElementById('dash-perf-matches').innerText = userMatches.length;
    } else {
        perfAuthDiv.style.display = 'none';
        perfUnauthDiv.style.display = 'block';
        perfAdminBadge.style.display = 'none';
    }

    // 2. RENDER MINI LEADERBOARD STANDINGS CARD
    const miniLeaderboardBody = document.getElementById('dashboard-leaderboard-list');
    miniLeaderboardBody.innerHTML = '';
    
    // Display up to top 5 players on the dashboard summary
    const displayList = players.slice(0, 5);
    if (displayList.length === 0) {
        miniLeaderboardBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:1rem;">No standings yet.</td></tr>`;
    } else {
        displayList.forEach((player, index) => {
            const rank = index + 1;
            const isSelf = currentUser && player.id === currentUser.id;
            
            const tr = document.createElement('tr');
            tr.style.fontWeight = isSelf ? '700' : 'normal';
            if (isSelf) tr.style.background = 'rgba(0, 240, 255, 0.05)';
            
            tr.innerHTML = `
                <td style="padding: 0.4rem 0.75rem;">#${rank}</td>
                <td style="padding: 0.4rem 0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <img src="${player.photoURL}" alt="" style="width:20px; height:20px; border-radius:50%;">
                        <span>${player.name} ${isSelf ? ' <small style="color:var(--color-primary);">(You)</small>' : ''}</span>
                    </div>
                </td>
                <td style="padding: 0.4rem 0.75rem; text-align:right; font-family:monospace; color:var(--color-primary);">${player.points} PTS</td>
            `;
            miniLeaderboardBody.appendChild(tr);
        });
    }

    // 3. SHOW RECENT ACTIVITY
    const activityContainer = document.getElementById('recent-activity-list');
    activityContainer.innerHTML = '';

    const completedMatchesSorted = [...matches]
        .filter(m => m.completed)
        .sort((a,b) => b.id - a.id)
        .slice(0, 5);

    if (completedMatchesSorted.length === 0) {
        activityContainer.innerHTML = `
            <div class="empty-state" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">
                <i class="fas fa-history" style="font-size:2rem; margin-bottom:1rem;"></i>
                <p>No games played yet. Go to the brackets and submit a score!</p>
            </div>`;
    } else {
        completedMatchesSorted.forEach(m => {
            const reporter = players.find(p => p.id === m.reporterId);
            const levelConfig = ROUND_DETAILS[m.level];
            const ptsEarned = m.outcome === 'tie' ? settings.levelPoints[m.level].tie : settings.levelPoints[m.level].win;
            
            const activityCard = document.createElement('div');
            activityCard.className = 'stat-card';
            activityCard.style.padding = '1rem';
            activityCard.style.marginBottom = '0.75rem';
            
            activityCard.innerHTML = `
                <div class="stat-icon" style="width:40px; height:40px; font-size:1.1rem; background: rgba(16, 185, 129, 0.1); color: var(--color-success);">
                    <i class="fas fa-trophy"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-size:0.85rem; font-weight:700;">
                        ${m.homeTeam.name} <span style="color:var(--color-primary);">${m.homeScore} - ${m.awayScore}</span> ${m.awayTeam.name}
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">
                        Logged by <span style="color:#fff;">${reporter ? reporter.name : 'Unknown'}</span> in ${levelConfig.name} (+${ptsEarned} pts)
                    </div>
                </div>
            `;
            activityContainer.appendChild(activityCard);
        });
    }
}

function renderBracket() {
    const roundsContainer = document.getElementById('bracket-rounds-container');
    roundsContainer.innerHTML = '';

    let roundsToRender = [1, 2, 3, 4, 5, 6];
    if (activeRoundFilter !== 'all') {
        roundsToRender = [parseInt(activeRoundFilter)];
    }

    roundsToRender.forEach(roundId => {
        const roundConfig = ROUND_DETAILS[roundId];
        const roundPoints = settings.levelPoints[roundId];
        const roundMatches = matches.filter(m => m.level === roundId);

        const roundColumn = document.createElement('div');
        roundColumn.className = 'bracket-round';
        
        let matchesHtml = '';
        roundMatches.forEach(m => {
            const isCompleted = m.completed;
            const homeWinner = isCompleted && m.outcome === 'home';
            const awayWinner = isCompleted && m.outcome === 'away';
            
            const homeName = m.homeTeam ? m.homeTeam.name : 'TBD';
            const awayName = m.awayTeam ? m.awayTeam.name : 'TBD';
            
            const homeFlag = m.homeTeam ? `<img class="team-flag" src="https://flagcdn.com/w40/${m.homeTeam.code}.png" alt="">` : '<i class="fas fa-question-circle" style="opacity:0.3;"></i>';
            const awayFlag = m.awayTeam ? `<img class="team-flag" src="https://flagcdn.com/w40/${m.awayTeam.code}.png" alt="">` : '<i class="fas fa-question-circle" style="opacity:0.3;"></i>';
            
            const homeScoreText = m.homeScore !== null ? m.homeScore : '-';
            const awayScoreText = m.awayScore !== null ? m.awayScore : '-';

            const isActiveMatch = m.homeTeam && m.awayTeam;

            matchesHtml += `
                <div class="match-card ${isCompleted ? 'completed' : ''} ${isActiveMatch ? 'active-match' : ''}" data-match-id="${m.id}">
                    <div class="match-info-top">
                        <span class="match-id">M${m.id}</span>
                        <span class="match-status ${isCompleted ? 'done' : (isActiveMatch ? 'live' : '')}">
                            ${isCompleted ? 'Full Time' : (isActiveMatch ? 'Ready' : 'Waiting')}
                        </span>
                    </div>
                    <div class="match-team ${homeWinner ? 'winner' : ''}">
                        <div class="match-team-name">${homeFlag} ${homeName}</div>
                        <div class="match-team-score">${homeScoreText}</div>
                    </div>
                    <div class="match-team ${awayWinner ? 'winner' : ''}">
                        <div class="match-team-name">${awayFlag} ${awayName}</div>
                        <div class="match-team-score">${awayScoreText}</div>
                    </div>
                    ${isActiveMatch ? '<div class="match-action-hint"><i class="fas fa-edit"></i> Click to Enter Score</div>' : ''}
                </div>
            `;
        });

        roundColumn.innerHTML = `
            <div class="round-header">
                <div class="round-title">${roundConfig.name}</div>
                <div class="round-points-tag">Win: +${roundPoints.win} | Tie: +${roundPoints.tie}</div>
            </div>
            <div class="round-matches-list">
                ${matchesHtml}
            </div>
        `;
        
        roundsContainer.appendChild(roundColumn);
    });

    document.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', () => {
            const matchId = parseInt(card.getAttribute('data-match-id'));
            const match = matches.find(m => m.id === matchId);
            if (match && match.homeTeam && match.awayTeam) {
                openMatchModal(match);
            }
        });
    });
}

function renderLeaderboard() {
    const listBody = document.getElementById('leaderboard-list');
    listBody.innerHTML = '';

    if (players.length === 0) {
        listBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No players registered yet.</td></tr>`;
        return;
    }

    players.forEach((player, index) => {
        const rank = index + 1;
        let rankBadgeClass = '';
        if (rank <= 3) rankBadgeClass = `rank-${rank}`;
        
        const tr = document.createElement('tr');
        tr.className = 'leaderboard-row';
        tr.innerHTML = `
            <td>
                <div class="rank-badge ${rankBadgeClass}">${rank}</div>
            </td>
            <td>
                <div class="player-cell">
                    <img class="player-avatar" src="${player.photoURL}" alt="">
                    <div>
                        <div class="player-name-cell">
                            ${player.name}
                            ${player.role === 'admin' ? '<span class="player-badge-admin">Admin</span>' : ''}
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-muted);">${player.email}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-size:0.9rem;">
                    ${matches.filter(m => m.completed && m.reporterId === player.id).length} Match(es)
                </div>
            </td>
            <td>
                <div class="points-value">${player.points} PTS</div>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function renderAdmin() {
    for (let level = 1; level <= 6; level++) {
        const points = settings.levelPoints[level];
        const winInput = document.getElementById(`pts-lvl${level}-win`);
        const tieInput = document.getElementById(`pts-lvl${level}-tie`);
        
        if (winInput) winInput.value = points.win;
        if (tieInput) tieInput.value = points.tie;
    }

    const usersTable = document.getElementById('admin-users-list');
    usersTable.innerHTML = '';

    players.forEach(player => {
        const tr = document.createElement('tr');
        const isAdmin = player.role === 'admin';
        
        tr.innerHTML = `
            <td>
                <div class="player-cell">
                    <img class="player-avatar" src="${player.photoURL}" alt="" style="width:30px; height:30px;">
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${player.name}</div>
                        <div style="font-size:0.75rem; color:var(--color-text-muted);">${player.email}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="player-badge-admin" style="background: ${isAdmin ? 'rgba(255, 183, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${isAdmin ? 'var(--color-secondary)' : 'var(--color-text-muted)'};">
                    ${player.role}
                </span>
            </td>
            <td>
                ${currentUser && currentUser.id !== player.id ? `
                    <button class="btn btn-secondary promote-btn" data-user-id="${player.id}" style="padding:0.25rem 0.6rem; font-size:0.75rem;">
                        ${isAdmin ? 'Demote to Player' : 'Promote to Admin'}
                    </button>
                ` : '<span style="font-size:0.75rem; color:var(--color-text-muted);">Locked (Current User)</span>'}
            </td>
        `;
        usersTable.appendChild(tr);
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.getAttribute('data-user-id');
            const targetUser = players.find(p => p.id === userId);
            if (targetUser) {
                targetUser.role = targetUser.role === 'admin' ? 'player' : 'admin';
                await savePlayer(targetUser);
                showToast(`Role updated for ${targetUser.name}!`, "success");
                loadData().then(renderAdmin);
            }
        });
    });
}

// ----------------------------------------------------
// MATCH MODAL SCORING OVERLAYS
// ----------------------------------------------------
function openMatchModal(match) {
    selectedMatch = match;
    const modal = document.getElementById('match-modal');
    
    document.getElementById('modal-match-id').innerText = `Match M${match.id} - ${ROUND_DETAILS[match.level].name}`;
    
    const teamAName = document.getElementById('modal-team-a-name');
    const teamBName = document.getElementById('modal-team-b-name');
    const teamAFlag = document.getElementById('modal-team-a-flag');
    const teamBFlag = document.getElementById('modal-team-b-flag');
    
    teamAName.innerText = match.homeTeam.name;
    teamBName.innerText = match.awayTeam.name;
    teamAFlag.src = `https://flagcdn.com/w80/${match.homeTeam.code}.png`;
    teamBFlag.src = `https://flagcdn.com/w80/${match.awayTeam.code}.png`;

    const scoreA = document.getElementById('modal-score-a');
    const scoreB = document.getElementById('modal-score-b');
    scoreA.value = match.homeScore !== null ? match.homeScore : '';
    scoreB.value = match.awayScore !== null ? match.awayScore : '';

    const outcomeWinA = document.getElementById('outcome-win-a');
    const outcomeWinB = document.getElementById('outcome-win-b');
    const outcomeTie = document.getElementById('outcome-tie');
    
    outcomeWinA.className = 'outcome-btn';
    outcomeWinB.className = 'outcome-btn';
    outcomeTie.className = 'outcome-btn';

    if (match.completed) {
        if (match.outcome === 'home') outcomeWinA.classList.add('selected-win');
        if (match.outcome === 'away') outcomeWinB.classList.add('selected-win');
        if (match.outcome === 'tie') outcomeTie.classList.add('selected-tie');
    }

    const tieWarning = document.getElementById('tie-knockout-warning');
    tieWarning.style.display = 'none';

    const updateOutcomeButtons = () => {
        const sA = parseInt(scoreA.value);
        const sB = parseInt(scoreB.value);
        
        outcomeWinA.className = 'outcome-btn';
        outcomeWinB.className = 'outcome-btn';
        outcomeTie.className = 'outcome-btn';
        tieWarning.style.display = 'none';

        if (!isNaN(sA) && !isNaN(sB)) {
            if (sA > sB) {
                outcomeWinA.classList.add('selected-win');
            } else if (sB > sA) {
                outcomeWinB.classList.add('selected-win');
            } else {
                outcomeTie.classList.add('selected-tie');
                if (match.level > 1) {
                    tieWarning.style.display = 'block';
                }
            }
        }
    };

    scoreA.oninput = updateOutcomeButtons;
    scoreB.oninput = updateOutcomeButtons;

    modal.classList.add('active');
}

function closeMatchModal() {
    const modal = document.getElementById('match-modal');
    modal.classList.remove('active');
    selectedMatch = null;
}

// Submits a match outcome and handles bracket progression
async function submitMatchOutcome() {
    if (!currentUser) {
        showToast("Please sign in to report match scores.", "error");
        return;
    }

    const scoreAInput = document.getElementById('modal-score-a').value;
    const scoreBInput = document.getElementById('modal-score-b').value;

    if (scoreAInput.trim() === '' || scoreBInput.trim() === '') {
        showToast("Both team scores are required.", "error");
        return;
    }

    const scoreA = parseInt(scoreAInput);
    const scoreB = parseInt(scoreBInput);
    
    if (isNaN(scoreA) || isNaN(scoreB)) {
        showToast("Invalid score numbers entered.", "error");
        return;
    }

    let outcome = 'tie';
    let winnerTeam = null;
    if (scoreA > scoreB) {
        outcome = 'home';
        winnerTeam = selectedMatch.homeTeam;
    } else if (scoreB > scoreA) {
        outcome = 'away';
        winnerTeam = selectedMatch.awayTeam;
    }

    if (outcome === 'tie' && selectedMatch.level > 1) {
        showToast("Knockout rounds cannot end in a tie. Decide a winner.", "error");
        return;
    }

    selectedMatch.homeScore = scoreA;
    selectedMatch.awayScore = scoreB;
    selectedMatch.outcome = outcome;
    selectedMatch.completed = true;
    selectedMatch.reporterId = currentUser.id;

    const pointsConfig = settings.levelPoints[selectedMatch.level];
    const pointsAwarded = outcome === 'tie' ? Number(pointsConfig.tie) : Number(pointsConfig.win);
    
    await saveMatch(selectedMatch);
    showToast(`Match recorded! You earned +${pointsAwarded} points.`, "success");

    const nextInfo = getNextMatchInfo(selectedMatch.id);
    if (nextInfo && winnerTeam) {
        const nextMatch = matches.find(m => m.id === nextInfo.nextId);
        if (nextMatch) {
            if (nextInfo.slot === 'home') {
                nextMatch.homeTeam = winnerTeam;
            } else {
                nextMatch.awayTeam = winnerTeam;
            }
            nextMatch.homeScore = null;
            nextMatch.awayScore = null;
            nextMatch.outcome = null;
            nextMatch.completed = false;
            nextMatch.reporterId = null;
            
            await saveMatch(nextMatch);
        }
    }

    await recalculatePlayerPoints();
    await loadData();
    
    closeMatchModal();
    renderBracket();
    renderDashboard();
}

// ----------------------------------------------------
// INITIALIZATION AND EVENT LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // Setup UI navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.getAttribute('data-view'));
        });
    });

    // Setup bracket filter tabs
    const setupBracketFilters = () => {
        const container = document.getElementById('bracket-filter-tabs');
        container.innerHTML = `<button class="filter-btn active" data-round="all">All Rounds</button>`;
        for (let r = 1; r <= 6; r++) {
            container.innerHTML += `<button class="filter-btn" data-round="${r}">${ROUND_DETAILS[r].name}</button>`;
        }
        
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeRoundFilter = btn.getAttribute('data-round');
                renderBracket();
            });
        });
    };
    setupBracketFilters();

    // Setup Modals
    document.getElementById('modal-cancel').onclick = closeMatchModal;
    document.getElementById('modal-close-btn').onclick = closeMatchModal;
    document.getElementById('modal-submit').onclick = submitMatchOutcome;

    // ----------------------------------------------------
    // LANDING PAGE AUTH CARD EVENT LISTENERS
    // ----------------------------------------------------
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('credentials-login-form');
    const registerForm = document.getElementById('credentials-register-form');

    tabLogin.onclick = () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    };

    tabRegister.onclick = () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
    };

    // Credentials login submit
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;

        try {
            const user = await loginWithEmail(email, pass);
            showToast(`Welcome back, ${user.name}!`, "success");
            loginForm.reset();
        } catch (err) {
            showToast(err.message || "Login failed.", "error");
        }
    };

    // Credentials registration submit
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-fullname').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-password').value;

        try {
            const user = await registerWithEmail(name, email, pass);
            showToast(`Account created! Logged in as ${user.name}`, "success");
            registerForm.reset();
            tabLogin.click();
        } catch (err) {
            showToast(err.message || "Registration failed.", "error");
        }
    };

    // Header Sign In (Fallback Google login trigger)
    document.getElementById('btn-login').onclick = async () => {
        try {
            const user = await loginWithGoogle();
            if (user) showToast(`Signed in as ${user.name}`, "success");
        } catch (e) {
            showToast("Google Sign-In failed.", "error");
        }
    };

    // Card Google Login
    document.getElementById('btn-google-login').onclick = async () => {
        try {
            const user = await loginWithGoogle();
            if (user) showToast(`Signed in as ${user.name}`, "success");
        } catch (e) {
            showToast("Google Sign-In failed.", "error");
        }
    };

    // Global Logouts
    const handleLogoutAction = async () => {
        await logout();
        showToast("Signed out successfully", "info");
    };
    document.getElementById('btn-logout').onclick = handleLogoutAction;
    document.getElementById('btn-dashboard-logout').onclick = handleLogoutAction;

    // Quick-link to Brackets from Landing Card
    document.getElementById('btn-dashboard-go-brackets').onclick = () => {
        switchView('bracket');
    };

    // ----------------------------------------------------
    // DEV SETTINGS PANEL & ADMIN TOOLS
    // ----------------------------------------------------
    const setupSidebar = document.getElementById('setup-sidebar');
    document.getElementById('btn-open-setup').onclick = () => setupSidebar.classList.add('active');
    document.getElementById('btn-close-setup').onclick = () => setupSidebar.classList.remove('active');
    
    const savedConfig = getSavedFirebaseConfig();
    const configStatusText = document.getElementById('firebase-config-status');
    if (savedConfig) {
        document.getElementById('fb-apikey').value = savedConfig.apiKey || '';
        document.getElementById('fb-authdomain').value = savedConfig.authDomain || '';
        document.getElementById('fb-projectid').value = savedConfig.projectId || '';
        document.getElementById('fb-storagebucket').value = savedConfig.storageBucket || '';
        document.getElementById('fb-messagingsenderid').value = savedConfig.messagingSenderId || '';
        document.getElementById('fb-appid').value = savedConfig.appId || '';
        configStatusText.innerHTML = '<span style="color:var(--color-success); font-weight:700;"><i class="fas fa-check-circle"></i> Connected to Firebase</span>';
    } else {
        configStatusText.innerHTML = '<span style="color:var(--color-warning); font-weight:700;"><i class="fas fa-exclamation-triangle"></i> Running in Offline Mock Mode</span>';
    }

    document.getElementById('btn-save-config').onclick = () => {
        const apiKey = document.getElementById('fb-apikey').value.trim();
        const authDomain = document.getElementById('fb-authdomain').value.trim();
        const projectId = document.getElementById('fb-projectid').value.trim();
        const storageBucket = document.getElementById('fb-storagebucket').value.trim();
        const messagingSenderId = document.getElementById('fb-messagingsenderid').value.trim();
        const appId = document.getElementById('fb-appid').value.trim();

        if (!apiKey || !authDomain || !projectId) {
            showToast("API Key, Auth Domain, and Project ID are required.", "error");
            return;
        }

        try {
            saveFirebaseConfig({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
            showToast("Firebase Config saved! Reloading...", "success");
        } catch (e) {
            showToast(e.message, "error");
        }
    };

    document.getElementById('btn-clear-config').onclick = () => {
        clearFirebaseConfig();
    };

    document.getElementById('admin-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role !== 'admin') {
            showToast("Admin access required.", "error");
            return;
        }

        const newSettings = { levelPoints: {} };
        for (let level = 1; level <= 6; level++) {
            const winVal = parseInt(document.getElementById(`pts-lvl${level}-win`).value);
            const tieVal = parseInt(document.getElementById(`pts-lvl${level}-tie`).value);
            
            if (isNaN(winVal) || isNaN(tieVal)) {
                showToast("All points must be valid numbers.", "error");
                return;
            }
            newSettings.levelPoints[level] = { win: winVal, tie: tieVal };
        }

        try {
            await saveSettings(newSettings);
            settings = newSettings;
            showToast("Configurations saved! Recalculating scores...", "success");
            await recalculatePlayerPoints();
            await loadData();
            renderBracket();
            renderDashboard();
            renderAdmin();
        } catch (err) {
            showToast("Failed to save settings.", "error");
        }
    };

    document.getElementById('btn-execute-reset').onclick = async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            showToast("Unauthorized! Admin access required.", "error");
            return;
        }

        const resetType = document.getElementById('admin-reset-type').value;
        const resetPoints = document.getElementById('admin-reset-points').checked;

        if (confirm("Reset tournament? This cannot be undone.")) {
            if (resetType === 'randomize') {
                const shuffled = [...TEAMS_64].sort(() => Math.random() - 0.5);
                const newMatches = [];
                for (let i = 1; i <= 32; i++) {
                    const idx = (i - 1) * 2;
                    newMatches.push({
                        id: i,
                        level: 1,
                        homeTeam: shuffled[idx],
                        awayTeam: shuffled[idx + 1],
                        homeScore: null,
                        awayScore: null,
                        outcome: null,
                        completed: false,
                        reporterId: null
                    });
                }
                for (let i = 33; i <= 63; i++) {
                    newMatches.push({
                        id: i,
                        level: getMatchLevel(i),
                        homeTeam: null,
                        awayTeam: null,
                        homeScore: null,
                        awayScore: null,
                        outcome: null,
                        completed: false,
                        reporterId: null
                    });
                }
                await resetTournament(newMatches, resetPoints);
            } else {
                matches.forEach(m => {
                    m.homeScore = null;
                    m.awayScore = null;
                    m.outcome = null;
                    m.completed = false;
                    m.reporterId = null;
                    if (m.level > 1) {
                        m.homeTeam = null;
                        m.awayTeam = null;
                    }
                });
                await resetTournament(matches, resetPoints);
            }

            showToast("Tournament reset executed successfully!", "success");
            await loadData();
            renderBracket();
            renderDashboard();
            renderLeaderboard();
        }
    };

    // Quick Mock Logins from dev panel (Mapped to admin and test)
    document.getElementById('mock-login-admin').onclick = () => {
        const user = simulateMockLogin('admin');
        showToast(`Mock Logged In: ${user.name} (Admin)`, "success");
    };
    document.getElementById('mock-login-player1').onclick = () => {
        const user = simulateMockLogin('test');
        showToast(`Mock Logged In: ${user.name} (Player)`, "success");
    };

    // ----------------------------------------------------
    // AUTH SUBSCRIPTION RUNNER
    // ----------------------------------------------------
    subscribeToAuth(async (user) => {
        currentUser = user;
        const profileBadge = document.getElementById('user-profile-badge');
        const loginBtn = document.getElementById('btn-login');
        const logoutBtn = document.getElementById('btn-logout');
        const adminTab = document.getElementById('nav-admin');
        const headerNav = document.getElementById('header-nav');
        const rulesCard = document.getElementById('dashboard-rules-card');
        const header = document.querySelector('header');
        const heroCard = document.querySelector('.hero-card');
        const statsGrid = document.querySelector('.dashboard-stats');
        const splitGrid = document.querySelector('.dashboard-split-grid');
        const recentMatches = document.getElementById('dashboard-recent-matches');
        const heroContainer = document.querySelector('.hero-container');
        const body = document.body;

        const unauthFlow = document.getElementById('auth-unauthenticated-flow');
        const authFlow = document.getElementById('auth-authenticated-flow');

        if (currentUser) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';
            profileBadge.style.display = 'flex';
            
            document.getElementById('badge-user-avatar').src = currentUser.photoURL;
            document.getElementById('badge-user-name').innerText = currentUser.name;
            document.getElementById('badge-user-role').innerText = currentUser.role;

            unauthFlow.style.display = 'none';
            authFlow.style.display = 'flex';
            document.getElementById('welcome-user-avatar').src = currentUser.photoURL;
            document.getElementById('welcome-user-name').innerText = currentUser.name;
            document.getElementById('welcome-user-role').innerText = currentUser.role;

            // Show full authenticated layout panels
            if (header) header.style.display = 'block';
            if (headerNav) headerNav.style.display = 'flex';
            if (rulesCard) rulesCard.style.display = 'block';
            if (heroCard) heroCard.style.display = 'flex';
            if (statsGrid) statsGrid.style.display = 'grid';
            if (splitGrid) splitGrid.style.display = 'grid';
            if (recentMatches) recentMatches.style.display = 'grid';
            if (heroContainer) heroContainer.classList.remove('login-mode');
            if (body) body.classList.remove('login-layout');

            if (currentUser.role === 'admin') {
                adminTab.style.display = 'inline-flex';
            } else {
                adminTab.style.display = 'none';
                if (activeView === 'admin') switchView('dashboard');
            }
        } else {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'none';
            profileBadge.style.display = 'none';
            adminTab.style.display = 'none';

            // Hide everything except the centered login form on landing page
            if (header) header.style.display = 'none';
            if (headerNav) headerNav.style.display = 'none';
            if (rulesCard) rulesCard.style.display = 'none';
            if (heroCard) heroCard.style.display = 'none';
            if (statsGrid) statsGrid.style.display = 'none';
            if (splitGrid) splitGrid.style.display = 'none';
            if (recentMatches) recentMatches.style.display = 'none';
            if (heroContainer) heroContainer.classList.add('login-mode');
            if (body) body.classList.add('login-layout');

            unauthFlow.style.display = 'block';
            authFlow.style.display = 'none';
            
            // Redirect unauthenticated user to dashboard
            if (activeView !== 'dashboard') switchView('dashboard');
        }

        await loadData();
        
        if (activeView === 'dashboard') renderDashboard();
        if (activeView === 'bracket') renderBracket();
        if (activeView === 'leaderboard') renderLeaderboard();
        if (activeView === 'admin') renderAdmin();
    });

    await loadData();
    switchView('dashboard');
});
