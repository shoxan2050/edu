/**
 * guard.js - Simple Page Protection
 */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// CRITICAL: Module-level flag to prevent multiple redirects
let hasHandledAuth = false;

const path = window.location.pathname.replace(/\/$/, '') || '/'; // Normalize: remove trailing slash
const segments = path.split('/').filter(Boolean);
const page = segments[segments.length - 1] || 'index';

console.log('[Guard] Page:', page, 'Path:', path);

const publicPages = ['index', 'login', 'register', 'signup'];
const isPublicPage = publicPages.includes(page) || path === '/';

const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    // Prevent running twice
    if (hasHandledAuth) {
        console.log('[Guard] Already handled, skipping');
        return;
    }
    hasHandledAuth = true;
    unsubscribe();

    console.log('[Guard] User:', firebaseUser ? firebaseUser.email : 'null');

    if (firebaseUser) {
        // User is logged in
        try {
            const snap = await get(ref(db, `users/${firebaseUser.uid}`));
            const userData = snap.exists() ? snap.val() : {};
            const role = userData.role || 'student';

            // Set global user object
            window.__AUTH_USER__ = { ...userData, uid: firebaseUser.uid, email: firebaseUser.email };
            document.dispatchEvent(new CustomEvent('authReady', { detail: window.__AUTH_USER__ }));

            console.log('[Guard] Role:', role, 'isPublicPage:', isPublicPage);

            // Only redirect if on a public page
            if (isPublicPage) {
                const target = role === 'teacher' ? '/teacher' : '/dashboard';
                console.log('[Guard] Redirecting to:', target);
                window.location.replace(target);
                return;
            }

            // Teacher page protection
            if (page === 'teacher' && role !== 'teacher') {
                console.log('[Guard] Non-teacher on teacher page, redirecting');
                window.location.replace('/dashboard');
                return;
            }

        } catch (e) {
            console.error('[Guard] Error:', e);
            window.__AUTH_USER__ = { uid: firebaseUser.uid, email: firebaseUser.email };
            document.dispatchEvent(new CustomEvent('authReady', { detail: window.__AUTH_USER__ }));
        }
    } else {
        // Not logged in
        window.__AUTH_USER__ = null;
        document.dispatchEvent(new CustomEvent('authReady', { detail: null }));

        // Redirect to login if on protected page
        if (!isPublicPage) {
            console.log('[Guard] Not logged in, redirecting to /login');
            window.location.replace('/login');
        }
    }
});
