/* ==========================================================================
   חיבור לFirebase - אימות וסנכרון נתונים
   ========================================================================== */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDPW4kWPkNJ--xbfEJzfn_k7RHOzWg0MsA",
    authDomain: "fitness-tracker-c835a.firebaseapp.com",
    projectId: "fitness-tracker-c835a",
    storageBucket: "fitness-tracker-c835a.firebasestorage.app",
    messagingSenderId: "514671967097",
    appId: "1:514671967097:web:fcbcdd515b88dfe257cda8",
    measurementId: "G-NEE1FXVGGN"
};

// המייל היחיד שמורשה לגשת לאפליקציה
const ALLOWED_EMAIL = 'idantsoar@gmail.com';

// אתחול Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

// הפעלת Cache מקומי (Offline support)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Firestore persistence not enabled:', err.code);
});

/* ==================== עזר לדיבאונס שמירות ==================== */
function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

/* ==================== ניהול UI - מסכי התחברות וטעינה ==================== */
function showLoginScreen(message) {
    const overlay = document.getElementById('authOverlay');
    const msg = document.getElementById('authMessage');
    const btn = document.getElementById('googleSignInBtn');
    const loader = document.getElementById('authLoader');
    if (overlay) overlay.classList.remove('hidden');
    if (msg) msg.textContent = message || 'יש להתחבר כדי לגשת לאפליקציה';
    if (btn) btn.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
    document.querySelector('.app').classList.add('locked');
}

function showLoadingScreen() {
    const overlay = document.getElementById('authOverlay');
    const msg = document.getElementById('authMessage');
    const btn = document.getElementById('googleSignInBtn');
    const loader = document.getElementById('authLoader');
    if (overlay) overlay.classList.remove('hidden');
    if (msg) msg.textContent = 'טוען נתונים מהענן...';
    if (btn) btn.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
}

function hideAuthOverlay() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.querySelector('.app').classList.remove('locked');
}

/* ==================== אובייקט סנכרון מרכזי ==================== */
const cloudSync = {
    user: null,
    ready: false,

    /**
     * מאתחל את האפליקציה - מחכה לאימות לפני המשך
     * Returns: Promise שמתממש כשהמשתמש מחובר ומאומת
     */
    init() {
        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    showLoginScreen('יש להתחבר כדי לגשת לאפליקציה');
                    return;
                }
                if (user.email !== ALLOWED_EMAIL) {
                    alert(`חשבון לא מורשה: ${user.email}\nרק ${ALLOWED_EMAIL} יכול להיכנס.`);
                    await auth.signOut();
                    showLoginScreen('חשבון לא מורשה — יש להתחבר עם החשבון הנכון');
                    return;
                }
                this.user = user;
                this.ready = true;
                showLoadingScreen();
                resolve(user);
            });
        });
    },

    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ login_hint: ALLOWED_EMAIL });
        try {
            await auth.signInWithPopup(provider);
        } catch (err) {
            console.error('Sign-in failed:', err);
            alert('ההתחברות נכשלה: ' + err.message);
        }
    },

    async signOut() {
        await auth.signOut();
        location.reload();
    },

    /* ==================== Firestore ==================== */
    _stateDoc() {
        return db.doc(`users/${this.user.uid}/data/state`);
    },
    _overridesDoc() {
        return db.doc(`users/${this.user.uid}/data/overrides`);
    },

    async loadState() {
        try {
            const snap = await this._stateDoc().get();
            return snap.exists ? snap.data() : null;
        } catch (e) { console.warn('loadState error:', e); return null; }
    },

    // שומר רק user + weeks (לא mealPlan, שמגיע מ-data.json)
    async saveState(state) {
        if (!this.ready) return;
        try {
            const payload = { user: state.user, weeks: state.weeks, _updatedAt: Date.now() };
            await this._stateDoc().set(payload);
        } catch (e) { console.error('saveState error:', e); }
    },

    async loadOverrides() {
        try {
            const snap = await this._overridesDoc().get();
            return snap.exists ? (snap.data().data || {}) : {};
        } catch (e) { console.warn('loadOverrides error:', e); return {}; }
    },

    async saveOverrides(overrides) {
        if (!this.ready) return;
        try {
            await this._overridesDoc().set({ data: overrides, _updatedAt: Date.now() });
        } catch (e) { console.error('saveOverrides error:', e); }
    },

    async resetAll() {
        if (!this.ready) return;
        try {
            await this._stateDoc().delete();
            await this._overridesDoc().delete();
        } catch (e) { console.error('resetAll error:', e); }
    },

    // האזנה לשינויים בזמן אמת ממכשירים אחרים
    subscribeState(callback) {
        return this._stateDoc().onSnapshot((snap) => {
            if (snap.exists && !snap.metadata.hasPendingWrites) {
                callback(snap.data());
            }
        });
    }
};

// גרסאות עם debounce כדי לא להציף את Firestore
cloudSync.saveStateDebounced = debounce(cloudSync.saveState.bind(cloudSync), 600);
cloudSync.saveOverridesDebounced = debounce(cloudSync.saveOverrides.bind(cloudSync), 600);

/* ==================== חיבור כפתור התחברות ==================== */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('googleSignInBtn');
    if (btn) btn.addEventListener('click', () => cloudSync.signInWithGoogle());

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => cloudSync.signOut());
});
