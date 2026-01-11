import { auth } from './firebase.js';
import { logout, showToast } from './auth.js';
import { DbService } from './modules/db-service.js';

const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get('lesson'); // UUID string
const subjectId = urlParams.get('subject') || 'math';

let questions = [];
let currentIdx = 0;
let score = 0;
let selectedOpt = null;
let timerInterval = null;

const PASS_PERCENT = 70;

const init = async (user) => {
    // ... (rest of init)
    let retryCount = 0;
    const maxRetries = 2;
    let dataFetched = false;

    const container = document.querySelector('main') || document.body; // Define container here for new error handling

    while (retryCount <= maxRetries && !dataFetched) {
        try {
            const currentUser = auth.currentUser; // Use currentUser to avoid conflict with init's user param
            if (!currentUser) throw new Error("User not initialized");

            const token = await currentUser.getIdToken();

            // SECURE FETCH: Call backend function (No answers exposed)
            const response = await fetch(`/.netlify/functions/fetchTest?subjectId=${subjectId}&lessonId=${lessonId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Test hali mavjud emas");
                throw new Error("Test yuklashda xatolik");
            }

            const testData = await response.json();
            questions = testData.questions || [];

            if (questions.length === 0) {
                container.innerHTML = `<div class="text-center text-gray-500 py-10">Bu dars uchun testlar hali qo'shilmagan.</div>`;
                return; // Exit init if no questions
            }

            renderQuestion();
            startTimer(); // Assuming startTimer is a new function or existing timer logic moved here
            dataFetched = true; // Mark as fetched on success

        } catch (error) {
            console.error(`Fetch attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            if (retryCount > maxRetries) {
                showToast("Server bilan aloqa uzildi. ❌", "error");
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

function renderQuestion() {
    if (timerInterval) clearInterval(timerInterval);
    selectedOpt = null;
    const q = questions[currentIdx];

    const progress = ((currentIdx + 1) / questions.length) * 100;

    const fill = document.getElementById('testProgress');
    if (fill) fill.style.width = `${progress}%`;
    const text = document.getElementById('progressText');
    if (text) text.textContent = `${currentIdx + 1}/${questions.length}`;

    const badge = document.getElementById('difficultyBadge');
    if (badge) {
        let d = q.difficulty?.toLowerCase() || 'medium';
        if (d === 'easy') d = 'oson';
        if (d === 'medium') d = "o'rtacha";
        if (d === 'hard') d = 'qiyin';

        badge.textContent = d;
        badge.className = "px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ";
        if (d === 'oson') badge.classList.add('bg-emerald-100', 'text-emerald-700');
        else if (d === "o'rtacha") badge.classList.add('bg-amber-100', 'text-amber-700');
        else badge.classList.add('bg-rose-100', 'text-rose-700');
    }

    const questionTitle = document.getElementById('questionTitle');
    if (questionTitle) questionTitle.textContent = q.question;

    // --- CHEAT-PROOF TIMER ---
    const storageKey = `test_start_${subjectId}_${lessonId}`;
    let startTime = sessionStorage.getItem(storageKey);

    if (!startTime) {
        startTime = Date.now();
        sessionStorage.setItem(storageKey, startTime);
    } else {
        startTime = parseInt(startTime);
    }

    if (!timerInterval) {
        timerInterval = setInterval(() => {
            const now = Date.now();
            const seconds = Math.floor((now - startTime) / 1000);
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.textContent = `${m}:${s}`;
        }, 1000);
    }
    // -------------------------

    const grid = document.getElementById('optionsGrid');
    if (!grid) return;

    grid.className = q.type === 'tf' ? "grid grid-cols-2 gap-4" : "space-y-4";

    grid.innerHTML = q.options.map((opt, i) => `
        <button class="option-btn w-full p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition font-semibold text-lg flex items-center gap-4 bg-white"
                data-index="${i}" id="opt-${i}">
            <span class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 font-bold">${String.fromCharCode(65 + i)}</span>
            ${opt}
        </button>
    `).join('');

    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => selectOption(parseInt(btn.dataset.index));
    });

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50');
    }

    const feedback = document.getElementById('feedback');
    if (feedback) feedback.classList.add('hidden');
}

function selectOption(idx) {
    if (document.getElementById('submitBtn').disabled === false && selectedOpt !== null && document.getElementById('feedback').classList.contains('hidden') === false) {
        return;
    }
    selectedOpt = idx;
    document.querySelectorAll('.option-btn').forEach((btn, i) => {
        btn.classList.toggle('border-indigo-600', i === idx);
        btn.classList.toggle('bg-indigo-50', i === idx);
    });
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
    }
}

// --- REFACTORED FOR BACKEND GRADING ---
let userAnswers = []; // Store answers here

const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
    submitBtn.onclick = async () => {
        if (selectedOpt === null) return;

        // Store answer
        userAnswers[currentIdx] = selectedOpt;

        const submitBtnEl = document.getElementById('submitBtn');
        submitBtnEl.disabled = true;
        submitBtnEl.classList.add('opacity-50');

        // UI Feedback: Just highlight selection (Neutral)
        // No Immediate Correct/Incorrect feedback as answers are hidden
        const selectedBtn = document.getElementById(`opt-${selectedOpt}`);
        if (selectedBtn) {
            selectedBtn.classList.add('bg-indigo-100', 'border-indigo-500');
        }

        // Wait a bit then move on
        setTimeout(() => {
            currentIdx++;
            if (currentIdx < questions.length) {
                renderQuestion();
            } else {
                finishTest();
            }
        }, 500);
    };
}

async function finishTest() {
    if (timerInterval) clearInterval(timerInterval);
    const storageKey = `test_start_${subjectId}_${lessonId}`;
    sessionStorage.removeItem(storageKey);

    const user = auth.currentUser;
    if (!user) return;

    // Show Loading
    const container = document.querySelector('main') || document.body;
    container.innerHTML = `<div class="text-center p-10"><div class="text-2xl font-bold mb-4">Natijalar hisoblanmoqda... 🔄</div></div>`;

    try {
        // CALL BACKEND GRADING
        const token = await user.getIdToken();
        const res = await fetch('/.netlify/functions/submitTest', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subjectId,
                lessonId,
                answers: userAnswers
            })
        });

        if (!res.ok) throw new Error("Submission failed");

        const result = await res.json();
        // result = { success: true, score: 80, ... }

        setTimeout(() => {
            // Redirect to result page (Score is now safe in DB, query param just for UX/Fallback)
            // We pass score just for immediate render if needed, but result.html will verify from DB
            window.location.href = `/result?subject=${subjectId}&lesson=${lessonId}&score=${result.score}`;
        }, 500);

    } catch (e) {
        console.error("Submission error", e);
        showToast("Xatolik yuz berdi. Qayta urinib ko'ring.", "error");
        setTimeout(() => location.reload(), 2000);
    }
}

window.addEventListener("beforeunload", () => {
    if (timerInterval) clearInterval(timerInterval);
});
