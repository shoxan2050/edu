// Shared Theme, Settings Modal, and Drawer Menu for EduPlatform HTML pages
// This script injects the drawer menu and handles theme switching

(function () {
    'use strict';

    // Apply saved theme immediately to prevent flash
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Get user role from localStorage (set by auth.js)
    function getUserRole() {
        try {
            const userData = localStorage.getItem('eduUser');
            if (userData) {
                const user = JSON.parse(userData);
                return user.role || 'student';
            }
        } catch (e) { }
        return 'student';
    }

    function getUserName() {
        try {
            const userData = localStorage.getItem('eduUser');
            if (userData) {
                const user = JSON.parse(userData);
                return user.name || "O'quvchi";
            }
        } catch (e) { }
        return "O'quvchi";
    }

    // Menu items based on role
    const studentMenuItems = [
        { icon: '📊', label: 'Dashboard', path: '/dashboard' },
        { icon: '🛤️', label: "Yo'llar", path: '/path' },
        { icon: '📚', label: 'Mening darslarim', path: '/path' },
        { icon: '📈', label: 'Natijalarim', path: '/dashboard' },
        { icon: '🏆', label: 'Yutuqlarim', path: '/dashboard' },
    ];

    const teacherMenuItems = [
        { icon: '📊', label: 'Dashboard', path: '/dashboard' },
        { icon: '📚', label: 'Fanlar boshqaruvi', path: '/teacher' },
        { icon: '👨‍🎓', label: "O'quvchilar statistikasi", path: '/teacher' },
        { icon: '⚙️', label: 'Boshqaruv paneli', path: '/teacher' },
    ];

    const adminMenuItems = [
        ...teacherMenuItems,
        { icon: '👑', label: 'Admin panel', path: '/admin' },
    ];

    function getMenuItems() {
        const role = getUserRole();
        if (role === 'admin') return adminMenuItems;
        if (role === 'teacher') return teacherMenuItems;
        return studentMenuItems;
    }

    function getRoleLabel() {
        const role = getUserRole();
        if (role === 'admin') return 'Administrator';
        if (role === 'teacher') return "O'qituvchi";
        return "O'quvchi";
    }

    // Drawer HTML
    function createDrawerHTML() {
        const menuItems = getMenuItems();
        const menuHTML = menuItems.map(item => `
            <a href="${item.path}" onclick="closeDrawer()" 
               class="flex items-center gap-4 px-6 py-3 text-gray-700 hover:bg-gray-50 transition">
                <span class="text-xl">${item.icon}</span>
                <span class="font-medium">${item.label}</span>
            </a>
        `).join('');

        return `
        <div id="drawerMenu" class="fixed inset-0 z-50 hidden">
            <!-- Overlay -->
            <div class="fixed inset-0 bg-black/50 transition-opacity" onclick="closeDrawer()"></div>
            
            <!-- Drawer Panel -->
            <div class="relative w-72 max-w-[80vw] bg-white shadow-2xl flex flex-col h-full animate-fade-in">
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-2xl">🎯</span>
                        <button onclick="closeDrawer()" class="text-white/80 hover:text-white text-xl">✕</button>
                    </div>
                    <h2 class="text-xl font-bold">EduPlatform</h2>
                    <p class="text-white/80 text-sm">${getUserName()}</p>
                    <p class="text-white/60 text-xs">${getRoleLabel()}</p>
                </div>

                <!-- Menu Items -->
                <div class="flex-1 py-4 overflow-y-auto">
                    ${menuHTML}

                    <!-- Divider -->
                    <div class="border-t border-gray-100 my-4 mx-4"></div>

                    <!-- Settings -->
                    <button onclick="closeDrawer(); openSettingsModal();" 
                            class="flex items-center gap-4 px-6 py-3 text-gray-700 hover:bg-gray-50 w-full text-left">
                        <span class="text-xl">⚙️</span>
                        <span class="font-medium">Sozlamalar</span>
                    </button>
                </div>

                <!-- Footer -->
                <div class="border-t border-gray-100 p-4">
                    <button onclick="logout()" 
                            class="flex items-center gap-4 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl w-full transition">
                        <span class="text-xl">🚪</span>
                        <span class="font-medium">Chiqish</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }

    // Settings Modal HTML
    const settingsModalHTML = `
    <div id="settingsModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white flex justify-between items-center">
                <h2 class="text-2xl font-bold">⚙️ Sozlamalar</h2>
                <button onclick="closeSettingsModal()" class="text-white/80 hover:text-white text-2xl">✕</button>
            </div>
            <div class="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <!-- Theme Section -->
                <div>
                    <h3 class="font-bold text-gray-900 mb-3">🎨 Mavzu</h3>
                    <div class="grid grid-cols-5 gap-3">
                        <button onclick="setTheme('light')"
                            class="theme-btn flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-indigo-500 transition"
                            data-theme="light">
                            <div class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl">☀️</div>
                            <span class="text-xs text-gray-500">Yorug'</span>
                        </button>
                        <button onclick="setTheme('dark')"
                            class="theme-btn flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-indigo-500 transition"
                            data-theme="dark">
                            <div class="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xl">🌙</div>
                            <span class="text-xs text-gray-500">Qorong'i</span>
                        </button>
                        <button onclick="setTheme('neon-purple')"
                            class="theme-btn flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-purple-500 transition"
                            data-theme="neon-purple">
                            <div class="w-12 h-12 rounded-xl bg-purple-900 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.5)]">💜</div>
                            <span class="text-xs text-purple-400">Neon</span>
                        </button>
                        <button onclick="setTheme('neon-green')"
                            class="theme-btn flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-green-500 transition"
                            data-theme="neon-green">
                            <div class="w-12 h-12 rounded-xl bg-green-900 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(34,197,94,0.5)]">💚</div>
                            <span class="text-xs text-green-400">Matrix</span>
                        </button>
                        <button onclick="setTheme('neon-blue')"
                            class="theme-btn flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-blue-500 transition"
                            data-theme="neon-blue">
                            <div class="w-12 h-12 rounded-xl bg-blue-900 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(14,165,233,0.5)]">💙</div>
                            <span class="text-xs text-blue-400">Cyber</span>
                        </button>
                    </div>
                </div>

                <!-- Password Section -->
                <div class="border-t border-gray-100 pt-6">
                    <h3 class="font-bold text-gray-900 mb-3">🔐 Parolni o'zgartirish</h3>
                    <div class="space-y-3">
                        <input type="password" id="currentPassword" placeholder="Hozirgi parol"
                            class="w-full p-4 border border-gray-200 rounded-xl">
                        <input type="password" id="newPassword" placeholder="Yangi parol"
                            class="w-full p-4 border border-gray-200 rounded-xl">
                        <input type="password" id="confirmPassword" placeholder="Yangi parolni tasdiqlang"
                            class="w-full p-4 border border-gray-200 rounded-xl">
                        <button onclick="changePassword()"
                            class="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600">Parolni yangilash</button>
                    </div>
                </div>
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end">
                <button onclick="closeSettingsModal()"
                    class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Yopish</button>
            </div>
        </div>
    </div>
    `;

    // Inject Hamburger Button into existing nav
    function injectHamburgerButton() {
        const nav = document.querySelector('nav');
        if (nav && !document.getElementById('hamburgerBtn')) {
            const firstChild = nav.firstElementChild;
            if (firstChild) {
                const hamburgerBtn = document.createElement('button');
                hamburgerBtn.id = 'hamburgerBtn';
                hamburgerBtn.className = 'p-2 hover:bg-gray-100 rounded-xl transition mr-2';
                hamburgerBtn.setAttribute('aria-label', 'Menu');
                hamburgerBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                `;
                hamburgerBtn.onclick = openDrawer;

                // Insert at the beginning of nav's first flex container
                const flexContainer = nav.querySelector('.flex');
                if (flexContainer) {
                    flexContainer.insertBefore(hamburgerBtn, flexContainer.firstChild);
                } else {
                    nav.insertBefore(hamburgerBtn, firstChild);
                }
            }
        }
    }

    // Inject once DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        // Inject drawer
        if (!document.getElementById('drawerMenu')) {
            document.body.insertAdjacentHTML('beforeend', createDrawerHTML());
        }

        // Inject settings modal
        if (!document.getElementById('settingsModal')) {
            document.body.insertAdjacentHTML('beforeend', settingsModalHTML);
        }

        // Inject hamburger button
        injectHamburgerButton();

        // Update theme buttons
        updateThemeButtons();
    });

    // Drawer Functions
    window.openDrawer = function () {
        const drawer = document.getElementById('drawerMenu');
        if (drawer) drawer.classList.remove('hidden');
    };

    window.closeDrawer = function () {
        const drawer = document.getElementById('drawerMenu');
        if (drawer) drawer.classList.add('hidden');
    };

    // Settings Modal Functions
    window.openSettingsModal = function () {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('hidden');
            updateThemeButtons();
        }
    };

    window.closeSettingsModal = function () {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.classList.add('hidden');
    };

    // Theme Functions
    window.setTheme = function (theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeButtons();
    };

    function updateThemeButtons() {
        const current = localStorage.getItem('theme') || 'light';
        document.querySelectorAll('.theme-btn').forEach(btn => {
            const isSelected = btn.dataset.theme === current;
            btn.classList.toggle('border-indigo-500', isSelected);
            btn.classList.toggle('bg-indigo-50', isSelected);
        });
    }

    // Logout function
    window.logout = function () {
        localStorage.removeItem('eduUser');
        window.location.href = '/login';
    };

    // Password change (placeholder)
    window.changePassword = function () {
        alert("Parol o'zgartirish funksiyasi keyingi versiyada");
    };

})();
