(function () {
    const user = JSON.parse(localStorage.getItem("user"));
    const path = window.location.pathname;
    const file = path.split('/').pop().toLowerCase() || 'index.html';

    // Public pages that don't need auth
    // Resilient to Netlify/hosting where index.html might be omitted from URL
    const isPublic = file === 'index.html' ||
        file === 'login.html' ||
        file === 'register.html' ||
        path === '/' ||
        path === '' ||
        file === 'login' ||
        file === 'register';

    if (!user && !isPublic) {
        window.location.href = "login.html";
    }

    if (user && isPublic && file !== 'index.html' && path !== '/' && path !== '') {
        window.location.href = user.role === "teacher" ? "teacher.html" : "dashboard.html";
    }
})();
