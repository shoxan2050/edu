/**
 * guard.js - Page Protection
 * Routes users based on auth state and role.
 */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

(function () {
    // Check if already redirecting (prevents infinite loop)
    const redirectKey = '__guard_redirected__';
    if (sessionStorage.getItem(redirectKey) === window.location.pathname) {
        sessionStorage.removeItem(redirectKey);
        console.log("Guard: Skipping (already redirected here)");
        return;
    }

    const path = window.location.pathname;
    const segments = path.split("/").filter(s => s && s !== "index.html");
    const page = segments[segments.length - 1] || "index";

    console.log("Guard: page =", page);

    const publicPages = ["index", "login", "register", "signup"];
    const isPublicPage = publicPages.includes(page);

    // Use unsubscribe to only handle first auth event
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        unsubscribe(); // Stop listening after first event

        console.log("Guard: auth state =", firebaseUser ? "logged in" : "not logged in");

        if (firebaseUser) {
            try {
                const snap = await get(ref(db, `users/${firebaseUser.uid}`));
                const userData = snap.exists() ? snap.val() : {};
                const role = userData.role || 'student';

                window.__AUTH_USER__ = { ...userData, uid: firebaseUser.uid, email: firebaseUser.email };
                document.dispatchEvent(new CustomEvent('authReady', { detail: window.__AUTH_USER__ }));

                console.log("Guard: role =", role, ", isPublicPage =", isPublicPage);

                // Redirect from public pages to appropriate dashboard
                if (isPublicPage) {
                    const target = role === 'teacher' ? '/teacher' : '/dashboard';
                    sessionStorage.setItem(redirectKey, target);
                    console.log("Guard: redirecting to", target);
                    window.location.replace(target);
                    return;
                }

                // Teacher page protection
                if (page === "teacher" && role !== "teacher") {
                    sessionStorage.setItem(redirectKey, '/dashboard');
                    window.location.replace("/dashboard");
                    return;
                }

            } catch (e) {
                console.error("Guard: Error", e);
                window.__AUTH_USER__ = { uid: firebaseUser.uid, email: firebaseUser.email };
                document.dispatchEvent(new CustomEvent('authReady', { detail: window.__AUTH_USER__ }));
            }
        } else {
            window.__AUTH_USER__ = null;
            document.dispatchEvent(new CustomEvent('authReady', { detail: null }));

            // Redirect to login if on protected page
            if (!isPublicPage) {
                sessionStorage.setItem(redirectKey, '/login');
                console.log("Guard: not logged in, redirecting to /login");
                window.location.replace("/login");
            }
        }
    });
})();
