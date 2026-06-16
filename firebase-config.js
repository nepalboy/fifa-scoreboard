// Firebase Config and Mock Database Layer for FIFA Scoreboard Application

const CONFIG_KEY = 'fifa_firebase_config';
const MOCK_DB_KEY = 'fifa_mock_database';

// Default tournament configuration
const DEFAULT_SETTINGS = {
    levelPoints: {
        1: { win: 10, tie: 10 },
        2: { win: 20, tie: 0 },
        3: { win: 40, tie: 0 },
        4: { win: 60, tie: 0 },
        5: { win: 80, tie: 0 },
        6: { win: 100, tie: 0 }
    }
};

// Default Mock Database State
const INITIAL_MOCK_STATE = {
    settings: DEFAULT_SETTINGS,
    players: [
        { id: 'mock-admin', name: 'FIFA Admin', email: 'admin@fifa.com', photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80', role: 'admin', points: 0 },
        { id: 'mock-player-1', name: 'Marcus Rashford', email: 'marcus@fifa.com', photoURL: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&h=100&q=80', role: 'player', points: 40 },
        { id: 'mock-player-2', name: 'Bukayo Saka', email: 'bukayo@fifa.com', photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80', role: 'player', points: 30 }
    ],
    matches: [] // Will be generated in app.js
};

// Check if Firebase config is saved in localStorage
export function getSavedFirebaseConfig() {
    const config = localStorage.getItem(CONFIG_KEY);
    return config ? JSON.parse(config) : null;
}

export function saveFirebaseConfig(config) {
    if (!config || !config.apiKey || !config.authDomain || !config.projectId) {
        throw new Error("Invalid Firebase Configuration fields.");
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    window.location.reload();
}

export function clearFirebaseConfig() {
    localStorage.removeItem(CONFIG_KEY);
    window.location.reload();
}

// ----------------------------------------------------
// STATE INITIALIZATION
// ----------------------------------------------------
let app, auth, db;
let firebaseEnabled = false;

const firebaseConfig = getSavedFirebaseConfig();

if (firebaseConfig) {
    try {
        // Dynamic imports of Firebase libraries from official CDN
        const { initializeApp: initApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getAuth: initAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { getFirestore: initFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

        app = initApp(firebaseConfig);
        auth = initAuth(app);
        db = initFirestore(app);
        firebaseEnabled = true;
        console.log("Firebase initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Firebase with provided config. Falling back to Mock Mode.", e);
    }
}

// Helper: load mock database state
function getMockDB() {
    let mockData = localStorage.getItem(MOCK_DB_KEY);
    if (!mockData) {
        localStorage.setItem(MOCK_DB_KEY, JSON.stringify(INITIAL_MOCK_STATE));
        return INITIAL_MOCK_STATE;
    }
    return JSON.parse(mockData);
}

// Helper: save mock database state
function saveMockDB(data) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(data));
}

// Mock auth listeners list
const mockAuthListeners = [];
let currentMockUser = null;

// ----------------------------------------------------
// EXPOSED INTERFACES (Unified Mock / Firebase API)
// ----------------------------------------------------

export function isFirebaseEnabled() {
    return firebaseEnabled;
}

// Auth API
export async function loginWithGoogle() {
    if (firebaseEnabled) {
        const { GoogleAuthProvider: AuthProvider, signInWithPopup: popupSignIn } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const provider = new AuthProvider();
        const result = await popupSignIn(auth, provider);
        
        // Sync or create user document in Firestore
        const user = result.user;
        const playerRef = doc(db, 'players', user.uid);
        const playerSnap = await getDoc(playerRef);
        
        if (!playerSnap.exists()) {
            // Check if they should be admin (e.g. first user is admin)
            const playersColl = collection(db, 'players');
            const playersSnap = await getDocs(playersColl);
            const isFirstUser = playersSnap.empty;
            
            const newPlayerData = {
                id: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
                role: isFirstUser ? 'admin' : 'player',
                points: 0
            };
            await setDoc(playerRef, newPlayerData);
            return newPlayerData;
        } else {
            return playerSnap.data();
        }
    } else {
        // In mock mode, we trigger mock login modal or default to player 1
        console.warn("Google Sign-In is simulating in Mock Mode. Set up Firebase for real OAuth.");
        return simulateMockLogin('mock-player-1');
    }
}

// Simulates user logins for mock testing
export function simulateMockLogin(userId) {
    const mockDb = getMockDB();
    const user = mockDb.players.find(p => p.id === userId);
    if (user) {
        currentMockUser = user;
        localStorage.setItem('fifa_current_mock_user', JSON.stringify(user));
        notifyMockAuthSubscribers();
    }
    return user;
}

export function simulateMockRegister(name, role = 'player') {
    const mockDb = getMockDB();
    const id = 'mock-' + Math.random().toString(36).substr(2, 9);
    const newUser = {
        id: id,
        name: name,
        email: name.toLowerCase().replace(/\s+/g, '') + '@fifa.com',
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        role: role,
        points: 0
    };
    mockDb.players.push(newUser);
    saveMockDB(mockDb);
    
    currentMockUser = newUser;
    localStorage.setItem('fifa_current_mock_user', JSON.stringify(newUser));
    notifyMockAuthSubscribers();
    return newUser;
}

export async function logout() {
    if (firebaseEnabled) {
        const { signOut: firebaseSignOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        await firebaseSignOut(auth);
    } else {
        currentMockUser = null;
        localStorage.removeItem('fifa_current_mock_user');
        notifyMockAuthSubscribers();
    }
}

export function subscribeToAuth(callback) {
    if (firebaseEnabled) {
        const { onAuthStateChanged: firebaseAuthListener } = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Fetch user data from firestore
                const { doc: fsDoc, getDoc: fsGetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
                const playerRef = fsDoc(db, 'players', user.uid);
                const playerSnap = await fsGetDoc(playerRef);
                if (playerSnap.exists()) {
                    callback(playerSnap.data());
                } else {
                    callback({
                        id: user.uid,
                        name: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        role: 'player',
                        points: 0
                    });
                }
            } else {
                callback(null);
            }
        });
    } else {
        mockAuthListeners.push(callback);
        // Load initial mock user from storage if active
        const savedMockUser = localStorage.getItem('fifa_current_mock_user');
        if (savedMockUser) {
            currentMockUser = JSON.parse(savedMockUser);
        }
        // Emit current user initially
        setTimeout(() => callback(currentMockUser), 50);
    }
}

function notifyMockAuthSubscribers() {
    mockAuthListeners.forEach(cb => cb(currentMockUser));
}

// Settings API
export async function getSettings() {
    if (firebaseEnabled) {
        const { doc: fsDoc, getDoc: fsGetDoc, setDoc: fsSetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const settingsRef = fsDoc(db, 'config', 'settings');
        const settingsSnap = await fsGetDoc(settingsRef);
        if (settingsSnap.exists()) {
            return settingsSnap.data();
        } else {
            // Seed defaults
            await fsSetDoc(settingsRef, DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
    } else {
        return getMockDB().settings;
    }
}

export async function saveSettings(settings) {
    if (firebaseEnabled) {
        const { doc: fsDoc, setDoc: fsSetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const settingsRef = fsDoc(db, 'config', 'settings');
        await fsSetDoc(settingsRef, settings);
    } else {
        const mockDb = getMockDB();
        mockDb.settings = settings;
        saveMockDB(mockDb);
    }
}

// Players Database API
export async function getPlayers() {
    if (firebaseEnabled) {
        const { collection: fsColl, getDocs: fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const playersColl = fsColl(db, 'players');
        const snap = await fsGetDocs(playersColl);
        const list = [];
        snap.forEach(doc => {
            list.push(doc.data());
        });
        return list.sort((a,b) => b.points - a.points);
    } else {
        return getMockDB().players.sort((a,b) => b.points - a.points);
    }
}

export async function savePlayer(player) {
    if (firebaseEnabled) {
        const { doc: fsDoc, setDoc: fsSetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const playerRef = fsDoc(db, 'players', player.id);
        await fsSetDoc(playerRef, player, { merge: true });
    } else {
        const mockDb = getMockDB();
        const index = mockDb.players.findIndex(p => p.id === player.id);
        if (index > -1) {
            mockDb.players[index] = { ...mockDb.players[index], ...player };
        } else {
            mockDb.players.push(player);
        }
        saveMockDB(mockDb);
    }
}

// Matches Database API
export async function getMatches() {
    if (firebaseEnabled) {
        const { collection: fsColl, getDocs: fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const matchesColl = fsColl(db, 'matches');
        const snap = await fsGetDocs(matchesColl);
        const list = [];
        snap.forEach(doc => {
            list.push(doc.data());
        });
        return list.sort((a,b) => a.id - b.id);
    } else {
        return getMockDB().matches;
    }
}

export async function saveMatch(match) {
    if (firebaseEnabled) {
        const { doc: fsDoc, setDoc: fsSetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const matchRef = fsDoc(db, 'matches', String(match.id));
        await fsSetDoc(matchRef, match, { merge: true });
    } else {
        const mockDb = getMockDB();
        const index = mockDb.matches.findIndex(m => m.id === match.id);
        if (index > -1) {
            mockDb.matches[index] = { ...mockDb.matches[index], ...match };
        } else {
            mockDb.matches.push(match);
        }
        saveMockDB(mockDb);
    }
}

export async function resetTournament(matches, playersReset = false) {
    if (firebaseEnabled) {
        const { writeBatch: fsWriteBatch, doc: fsDoc, collection: fsColl, getDocs: fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        // Batch delete old matches
        const matchesColl = fsColl(db, 'matches');
        const snap = await fsGetDocs(matchesColl);
        let batch = fsWriteBatch(db);
        snap.forEach(d => {
            batch.delete(d.ref);
        });
        await batch.commit();

        // Write new matches
        batch = fsWriteBatch(db);
        matches.forEach(match => {
            const matchRef = fsDoc(db, 'matches', String(match.id));
            batch.set(matchRef, match);
        });
        await batch.commit();

        if (playersReset) {
            const playersColl = fsColl(db, 'players');
            const pSnap = await fsGetDocs(playersColl);
            batch = fsWriteBatch(db);
            pSnap.forEach(d => {
                const updated = d.data();
                updated.points = 0;
                batch.set(d.ref, updated);
            });
            await batch.commit();
        }
    } else {
        const mockDb = getMockDB();
        mockDb.matches = matches;
        if (playersReset) {
            mockDb.players.forEach(p => p.points = 0);
        }
        saveMockDB(mockDb);
    }
}
