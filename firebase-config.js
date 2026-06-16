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

// Default Mock Database State (Only Admin and Test accounts as requested)
const INITIAL_MOCK_STATE = {
    settings: DEFAULT_SETTINGS,
    players: [
        { id: 'admin', name: 'FIFA Admin', email: 'admin@fifa.com', password: 'admin123', photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin', role: 'admin', points: 0 },
        { id: 'test', name: 'Test Player', email: 'test@fifa.com', password: 'test123', photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Test', role: 'player', points: 0 }
    ],
    matches: []
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
        const { initializeApp: initApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getAuth: initAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { getFirestore: initFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

        app = initApp(firebaseConfig);
        auth = initAuth(app);
        db = initFirestore(app);
        firebaseEnabled = true;
        console.log("Firebase initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Firebase. Falling back to Mock Mode.", e);
    }
}

// Helper: load mock database state
function getMockDB() {
    let mockData = localStorage.getItem(MOCK_DB_KEY);
    if (!mockData) {
        localStorage.setItem(MOCK_DB_KEY, JSON.stringify(INITIAL_MOCK_STATE));
        return INITIAL_MOCK_STATE;
    }
    const parsed = JSON.parse(mockData);
    
    // Ensure only Admin and Test accounts remain for deployment
    let playersUpdated = false;
    
    // Check if we have excess mock accounts (e.g. Rashford, Saka)
    const hasRashford = parsed.players.some(p => p.id === 'mock-player-1');
    const hasSaka = parsed.players.some(p => p.id === 'mock-player-2');
    
    if (hasRashford || hasSaka || parsed.players.length > 20) {
        parsed.players = [
            { id: 'admin', name: 'FIFA Admin', email: 'admin@fifa.com', password: 'admin123', photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin', role: 'admin', points: 0 },
            { id: 'test', name: 'Test Player', email: 'test@fifa.com', password: 'test123', photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Test', role: 'player', points: 0 }
        ];
        playersUpdated = true;
    }
    
    // Ensure admin password is admin123
    const adminUser = parsed.players.find(p => p.id === 'admin');
    if (adminUser && adminUser.password !== 'admin123') {
        adminUser.password = 'admin123';
        playersUpdated = true;
    }
    
    if (playersUpdated) saveMockDB(parsed);
    return parsed;
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

// Auth API - Google Login
export async function loginWithGoogle() {
    if (firebaseEnabled) {
        const { GoogleAuthProvider: AuthProvider, signInWithPopup: popupSignIn } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { doc: fsDoc, getDoc: fsGetDoc, setDoc: fsSetDoc, collection: fsColl, getDocs: fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        const provider = new AuthProvider();
        const result = await popupSignIn(auth, provider);
        
        const user = result.user;
        const playerRef = fsDoc(db, 'players', user.uid);
        const playerSnap = await fsGetDoc(playerRef);
        
        if (!playerSnap.exists()) {
            const playersColl = fsColl(db, 'players');
            const playersSnap = await fsGetDocs(playersColl);
            const isFirstUser = playersSnap.empty;
            
            const newPlayerData = {
                id: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
                role: (isFirstUser || user.email.toLowerCase() === 'admin@fifa.com') ? 'admin' : 'player',
                points: 0
            };
            await fsSetDoc(playerRef, newPlayerData);
            return newPlayerData;
        } else {
            return playerSnap.data();
        }
    } else {
        console.warn("Google Sign-In is simulating in Mock Mode.");
        return simulateMockLogin('test');
    }
}

// Auth API - Email/Password Login (Supports username or email)
export async function loginWithEmail(usernameOrEmail, password) {
    if (firebaseEnabled) {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { doc: fsDoc, getDoc: fsGetDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        // If they type "admin" but Firebase needs email, map it to admin@fifa.com
        let email = usernameOrEmail;
        if (usernameOrEmail.toLowerCase() === 'admin') {
            email = 'admin@fifa.com';
        } else if (usernameOrEmail.toLowerCase() === 'test') {
            email = 'test@fifa.com';
        }
        
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        const playerRef = fsDoc(db, 'players', user.uid);
        const playerSnap = await fsGetDoc(playerRef);
        if (playerSnap.exists()) {
            return playerSnap.data();
        } else {
            return {
                id: user.uid,
                name: user.displayName || email.split('@')[0],
                email: email,
                photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
                role: 'player',
                points: 0
            };
        }
    } else {
        const mockDb = getMockDB();
        // Support searching by email or username (id)
        const user = mockDb.players.find(p => 
            (p.email.toLowerCase() === usernameOrEmail.toLowerCase() || p.id.toLowerCase() === usernameOrEmail.toLowerCase()) && 
            p.password === password
        );
        if (user) {
            currentMockUser = user;
            localStorage.setItem('fifa_current_mock_user', JSON.stringify(user));
            notifyMockAuthSubscribers();
            return user;
        } else {
            throw new Error("Invalid username or password.");
        }
    }
}

// Auth API - Email/Password Registration
export async function registerWithEmail(name, usernameOrEmail, password) {
    const isEmail = usernameOrEmail.includes('@');
    const email = isEmail ? usernameOrEmail : `${usernameOrEmail.toLowerCase().replace(/\s+/g, '')}@fifa.com`;
    const id = isEmail ? usernameOrEmail.split('@')[0] : usernameOrEmail.toLowerCase().replace(/\s+/g, '');

    if (firebaseEnabled) {
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { doc: fsDoc, setDoc: fsSetDoc, collection: fsColl, getDocs: fsGetDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await updateProfile(user, { displayName: name });
        
        const playersColl = fsColl(db, 'players');
        const playersSnap = await fsGetDocs(playersColl);
        const isFirstUser = playersSnap.empty;
        const role = (isFirstUser || id === 'admin' || email.toLowerCase() === 'admin@fifa.com') ? 'admin' : 'player';
        
        const newPlayerData = {
            id: user.uid,
            name: name,
            email: email,
            photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
            role: role,
            points: 0
        };
        
        await fsSetDoc(fsDoc(db, 'players', user.uid), newPlayerData);
        return newPlayerData;
    } else {
        const mockDb = getMockDB();
        const existingUser = mockDb.players.find(p => 
            p.email.toLowerCase() === email.toLowerCase() || p.id.toLowerCase() === id.toLowerCase()
        );
        if (existingUser) {
            throw new Error("Username or Email is already registered.");
        }
        
        const role = (id === 'admin') ? 'admin' : 'player';
        
        const newUser = {
            id: id,
            name: name,
            email: email,
            password: password,
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
    const id = name.toLowerCase().replace(/\s+/g, '');
    const newUser = {
        id: id,
        name: name,
        email: id + '@fifa.com',
        password: 'player123',
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
        const savedMockUser = localStorage.getItem('fifa_current_mock_user');
        if (savedMockUser) {
            currentMockUser = JSON.parse(savedMockUser);
        }
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
        
        const matchesColl = fsColl(db, 'matches');
        const snap = await fsGetDocs(matchesColl);
        let batch = fsWriteBatch(db);
        snap.forEach(d => {
            batch.delete(d.ref);
        });
        await batch.commit();

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

// Security API - Password reset
export async function updateCurrentUserPassword(newPassword) {
    if (firebaseEnabled) {
        const { updatePassword: fbUpdatePassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        if (auth.currentUser) {
            await fbUpdatePassword(auth.currentUser, newPassword);
        } else {
            throw new Error("No authenticated Firebase user found.");
        }
    } else {
        const mockDb = getMockDB();
        const savedMockUser = localStorage.getItem('fifa_current_mock_user');
        if (savedMockUser) {
            const currentMock = JSON.parse(savedMockUser);
            const userInDb = mockDb.players.find(p => p.id === currentMock.id);
            if (userInDb) {
                userInDb.password = newPassword;
                saveMockDB(mockDb);
                
                // Update local storage credentials
                currentMock.password = newPassword;
                localStorage.setItem('fifa_current_mock_user', JSON.stringify(currentMock));
            } else {
                throw new Error("Mock user not found in database.");
            }
        } else {
            throw new Error("No mock user is currently signed in.");
        }
    }
}
