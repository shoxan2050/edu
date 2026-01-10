import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/**
 * guard.js: Monitors authenticaton state in real-time.
 * Ensures only authorized users access specific pages.
 */

onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const page = path.split("/").pop().replace(".html", "") || "index";
    const publicPages = ["index", "login", "register", ""];

    if (publicPages.includes(page)) {
        // If logged in on public page, maybe redirect to dashboard
        if (user && (page === "login" || page === "register")) {
            const snap = await get(ref(db, `users/${user.uid}`));
            const role = snap.exists() ? snap.val().role : 'student';
            window.location.href = role === 'teacher' ? 'teacher.html' : 'dashboard.html';
        }
        return;
    }

    // Protection for private pages
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
    }

    // Role-based protection for teacher.html
    if (page === "teacher") {
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists() && snap.val().role !== "teacher") {
            window.location.href = "dashboard.html";
        }
    }
});
