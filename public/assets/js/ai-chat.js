// AI Chat Component
// O'quvchilarga yordam beruvchi AI chatbot

import { auth } from './firebase.js';

class AIChat {
    constructor() {
        this.isOpen = false;
        this.chatHistory = [];
        this.context = 'umumiy';
        this.grade = 7;
        this.isLoading = false;
        this.container = null;

        this.init();
    }

    init() {
        // Load saved chat history
        const saved = localStorage.getItem('aiChatHistory');
        if (saved) {
            try {
                this.chatHistory = JSON.parse(saved);
            } catch (e) {
                this.chatHistory = [];
            }
        }

        // Get user grade from localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                this.grade = parseInt(user.sinf) || 7;
            } catch (e) { }
        }

        // Create chat UI
        this.createUI();
        this.attachEvents();
    }

    createUI() {
        // Chat button (floating)
        const chatBtn = document.createElement('button');
        chatBtn.id = 'aiChatFloatingBtn';
        chatBtn.className = 'fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 lg:bottom-6';
        chatBtn.innerHTML = `
            <span class="text-2xl" id="chatBtnIcon">🤖</span>
        `;
        chatBtn.onclick = () => this.toggle();
        document.body.appendChild(chatBtn);

        // Chat drawer
        const drawer = document.createElement('div');
        drawer.id = 'aiChatDrawer';
        drawer.className = 'fixed inset-0 z-50 hidden';
        drawer.innerHTML = `
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="window.aiChat.close()"></div>
            
            <!-- Chat Panel -->
            <div class="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300" id="chatPanel">
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <span class="text-xl">🤖</span>
                        </div>
                        <div>
                            <h3 class="font-bold">AI Yordamchi</h3>
                            <p class="text-xs opacity-80">Savolingizni bering</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.aiChat.clearHistory()" class="p-2 hover:bg-white/20 rounded-full transition" title="Tarixni tozalash">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                        <button onclick="window.aiChat.close()" class="p-2 hover:bg-white/20 rounded-full transition">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Context Selector -->
                <div class="p-3 border-b border-gray-100 bg-gray-50">
                    <select id="chatContextSelect" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500">
                        <option value="umumiy">🎯 Umumiy yordam</option>
                        <option value="matematika">📐 Matematika</option>
                        <option value="fizika">⚡ Fizika</option>
                        <option value="ingliz_tili">🌍 Ingliz tili</option>
                        <option value="ona_tili">📖 Ona tili</option>
                        <option value="kimyo">🧪 Kimyo</option>
                        <option value="biologiya">🌿 Biologiya</option>
                    </select>
                </div>

                <!-- Messages -->
                <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-4">
                    <!-- Welcome message -->
                    <div class="flex gap-3">
                        <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span>🤖</span>
                        </div>
                        <div class="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                            <p class="text-gray-800 text-sm">Salom! Men sizning AI yordamchingizman. Darslar, testlar yoki har qanday mavzu bo'yicha savollaringizga javob berishga tayyorman. 📚</p>
                        </div>
                    </div>
                </div>

                <!-- Input -->
                <div class="p-4 border-t border-gray-100 bg-white">
                    <form id="chatForm" class="flex gap-2">
                        <input type="text" id="chatInput" 
                            class="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 transition"
                            placeholder="Savolingizni yozing..."
                            autocomplete="off">
                        <button type="submit" id="chatSendBtn"
                            class="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
        this.container = drawer;
    }

    attachEvents() {
        // Form submit
        document.getElementById('chatForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Context change
        document.getElementById('chatContextSelect')?.addEventListener('change', (e) => {
            this.context = e.target.value;
        });

        // Enter key
        document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        const drawer = document.getElementById('aiChatDrawer');
        const panel = document.getElementById('chatPanel');
        const btn = document.getElementById('aiChatFloatingBtn');

        drawer.classList.remove('hidden');
        btn.innerHTML = '<span class="text-2xl">✕</span>';

        setTimeout(() => {
            panel.classList.remove('translate-x-full');
        }, 10);

        // Render existing messages
        this.renderMessages();

        // Focus input
        setTimeout(() => {
            document.getElementById('chatInput')?.focus();
        }, 300);
    }

    close() {
        this.isOpen = false;
        const drawer = document.getElementById('aiChatDrawer');
        const panel = document.getElementById('chatPanel');
        const btn = document.getElementById('aiChatFloatingBtn');

        panel.classList.add('translate-x-full');
        btn.innerHTML = '<span class="text-2xl">🤖</span>';

        setTimeout(() => {
            drawer.classList.add('hidden');
        }, 300);
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        // Keep welcome message, add history
        let html = `
            <div class="flex gap-3">
                <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span>🤖</span>
                </div>
                <div class="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                    <p class="text-gray-800 text-sm">Salom! Men sizning AI yordamchingizman. Darslar, testlar yoki har qanday mavzu bo'yicha savollaringizga javob berishga tayyorman. 📚</p>
                </div>
            </div>
        `;

        this.chatHistory.forEach(msg => {
            if (msg.role === 'user') {
                html += `
                    <div class="flex gap-3 justify-end">
                        <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                            <p class="text-sm">${this.escapeHtml(msg.content)}</p>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="flex gap-3">
                        <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span>🤖</span>
                        </div>
                        <div class="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                            <p class="text-gray-800 text-sm whitespace-pre-wrap">${this.escapeHtml(msg.content)}</p>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim();

        if (!message || this.isLoading) return;

        // Clear input
        input.value = '';

        // Add user message to history
        this.chatHistory.push({ role: 'user', content: message });
        this.renderMessages();
        this.saveHistory();

        // Show loading
        this.isLoading = true;
        this.showTypingIndicator();
        document.getElementById('chatSendBtn').disabled = true;

        try {
            // Get auth token
            const user = auth.currentUser;
            if (!user) {
                this.addBotMessage("Iltimos, avval tizimga kiring.");
                return;
            }

            const token = await user.getIdToken();

            const res = await fetch('/.netlify/functions/aiChat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message,
                    context: this.context,
                    grade: this.grade,
                    chatHistory: this.chatHistory.slice(-10) // Last 10 messages for context
                })
            });

            if (!res.ok) {
                throw new Error('AI javob bermadi');
            }

            const data = await res.json();
            this.addBotMessage(data.reply);

        } catch (error) {
            console.error('Chat error:', error);
            this.addBotMessage("Kechirasiz, xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
        } finally {
            this.isLoading = false;
            this.hideTypingIndicator();
            document.getElementById('chatSendBtn').disabled = false;
        }
    }

    addBotMessage(content) {
        this.chatHistory.push({ role: 'assistant', content });
        this.renderMessages();
        this.saveHistory();
    }

    showTypingIndicator() {
        const container = document.getElementById('chatMessages');
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'flex gap-3';
        indicator.innerHTML = `
            <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span>🤖</span>
            </div>
            <div class="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
                <div class="flex gap-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                </div>
            </div>
        `;
        container?.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    }

    hideTypingIndicator() {
        document.getElementById('typingIndicator')?.remove();
    }

    clearHistory() {
        if (confirm("Chat tarixini tozalashni xohlaysizmi?")) {
            this.chatHistory = [];
            this.saveHistory();
            this.renderMessages();
        }
    }

    saveHistory() {
        // Keep only last 50 messages
        if (this.chatHistory.length > 50) {
            this.chatHistory = this.chatHistory.slice(-50);
        }
        localStorage.setItem('aiChatHistory', JSON.stringify(this.chatHistory));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setContext(context) {
        this.context = context;
        const select = document.getElementById('chatContextSelect');
        if (select) {
            select.value = context;
        }
    }
}

// Initialize chat
window.aiChat = new AIChat();

export { AIChat };
