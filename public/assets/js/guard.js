/**
 * guard.js - Page Protection using AuthService
 * Routes users based on auth state and role.
 */

import { AuthService } from './modules/auth-service.js';

(async () => {
    const path = window.location.pathname;
    const page = path.split("/").pop().replace(".html", "") || "index";
    const publicPages = ["index", "index.html", "login", "register", "signup", ""];

    const user = await AuthService.getCurrentUser();

    if (user) {
        // Dispatch event for legacy listeners (backward compatibility)
        document.dispatchEvent(new CustomEvent('authReady', { detail: user }));
        window.__AUTH_USER__ = user; // Cache for late listeners

        // Redirect from public pages to dashboard
        if (publicPages.includes(page)) {
            const role = await AuthService.getRole();
            window.location.href = role === 'teacher' ? 'teacher.html' : 'dashboard.html';
            return;
        }

        // Teacher page protection
        if (page === "teacher") {
            const role = await AuthService.getRole();
            if (role !== "teacher") {
                window.location.href = "dashboard.html";
                return;
            }
        }
    } else {
        // Not logged in
        document.dispatchEvent(new CustomEvent('authReady', { detail: null }));
        window.__AUTH_USER__ = null;

        if (!publicPages.includes(page)) {
            window.location.href = "index.html";
        }
    }
})();
