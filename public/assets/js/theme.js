// Shared Navbar and Settings Modal for EduPlatform HTML pages
// This script injects the navbar and handles theme switching

(function () {
    'use strict';

    // Apply saved theme immediately to prevent flash
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

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

    // Inject Settings Modal once DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        // Only inject if not already present
        if (!document.getElementById('settingsModal')) {
            document.body.insertAdjacentHTML('beforeend', settingsModalHTML);
        }

        // Update theme button states
        updateThemeButtons();
    });

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
        if (modal) {
            modal.classList.add('hidden');
        }
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

    // Password change (placeholder)
    window.changePassword = function () {
        alert("Parol o'zgartirish funksiyasi keyingi versiyada");
    };

})();
