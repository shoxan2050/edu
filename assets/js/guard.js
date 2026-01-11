/**
 * guard.js - Page Protection
 * Routes users based on auth state and role.
 * FIXED: Added redirect flag to prevent infinite loops
 */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Prevent multiple redirects
if (sessionStorage.getItem('__redirecting__')) {
    sessionStorage.removeItem('__redirecting__');
} else {
    initGuard();
}

async function initGuard() {
    const path = window.location.pathname;

    // Get page name from URL (handles /teacher, /teacher/, /teacher/index.html)
    const segments = path.split("/").filter(s => s && s !== "index.html");
    const page = segments[segments.length - 1] || "index";

    console.log("Guard: page detected =", page, "path =", path);

    const publicPages = ["index", "login", "register", "signup"];
    const isPublicPage = publicPages.includes(page);

    // Wait for auth state
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // User is logged in
            try {
                const snap = await get(ref(db, `users/${firebaseUser.uid}`));
                const userData = snap.exists() ? snap.val() : {};
                const role = userData.role || 'student';

                // Cache for other scripts
                window.__AUTH_USER__ = { ...firebaseUser, ...userData, uid: firebaseUser.uid };
                document.dispatchEvent(new CustomEvent('authReady', { detail: window.__AUTH_USER__ }));

                // Redirect from public pages
                if (isPublicPage) {
                    sessionStorage.setItem('__redirecting__', 'true');
                    window.location.href = role === 'teacher' ? '/teacher' : '/dashboard';
                    return;
                }

                // Teacher page protection
                if (page === "teacher" && role !== "teacher") {
                    sessionStorage.setItem('__redirecting__', 'true');
                    window.location.href = "/dashboard";
                    return;
                }

            } catch (e) {
                console.error("Guard: Error fetching user data", e);
                window.__AUTH_USER__ = firebaseUser;
                document.dispatchEvent(new CustomEvent('authReady', { detail: firebaseUser }));
            }
        } else {
            // Not logged in
            window.__AUTH_USER__ = null;
            document.dispatchEvent(new CustomEvent('authReady', { detail: null }));

            if (!isPublicPage) {
                sessionStorage.setItem('__redirecting__', 'true');
                window.location.href = "/login";
            }
        }
    }, { onlyOnce: true }); // Only fire once per page load
}
