/**
 * Theme Service - Manages app themes with localStorage persistence
 */

const THEMES = {
    light: { name: 'Yorug\'', icon: '☀️', class: 'light' },
    dark: { name: 'Qorong\'i', icon: '🌙', class: 'dark' },
    'neon-purple': { name: 'Neon Binafsha', icon: '💜', class: 'neon-purple' },
    'neon-green': { name: 'Neon Yashil', icon: '💚', class: 'neon-green' },
    'neon-blue': { name: 'Neon Ko\'k', icon: '💙', class: 'neon-blue' }
};

export const ThemeService = {
    THEMES,

    init() {
        const saved = localStorage.getItem('theme') || 'light';
        this.apply(saved);
    },

    get() {
        return localStorage.getItem('theme') || 'light';
    },

    apply(themeId) {
        if (!THEMES[themeId]) themeId = 'light';
        document.documentElement.setAttribute('data-theme', themeId);
        localStorage.setItem('theme', themeId);
        console.log('[Theme] Applied:', themeId);
    },

    toggle() {
        const keys = Object.keys(THEMES);
        const current = this.get();
        const idx = keys.indexOf(current);
        const next = keys[(idx + 1) % keys.length];
        this.apply(next);
        return next;
    },

    getAll() {
        return THEMES;
    }
};

// Auto-init on load
ThemeService.init();
