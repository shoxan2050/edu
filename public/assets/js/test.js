import { auth } from './firebase.js';
import { logout, showToast } from './auth.js';
import { DbService } from './modules/db-service.js';

const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get('lesson');
const subjectId = urlParams.get('subject');

let questions = [];
let currentIdx = 0;
let userAnswers = [];
let timerInterval = null;
let startTime = null;

const container = document.querySelector('main') || document.body;

// Init
const init = async (user) => {
    if (!user) {
        showToast("Avval tizimga kiring", "error");
        return;
    }

    if (!subjectId || !lessonId) {
        container.innerHTML = `<div class="text-center p-10 text-gray-500">Test parametrlari topilmadi</div>`;
        return;
    }

    try {
        // Direct Firebase load - no backend needed
        const testData = await DbService.getTests(subjectId, lessonId);

        if (!testData || !testData.questions || testData.questions.length === 0) {
            container.innerHTML = `<div class="text-center p-10 text-gray-500">Bu dars uchun testlar hali qo'shilmagan 📝</div>`;
            return;
        }

        questions = testData.questions;
        startTime = Date.now();
        renderQuestion();
        startTimer();

    } catch (error) {
        console.error("Test load error:", error);
        container.innerHTML = `<div class="text-center p-10 text-red-500">Test yuklashda xatolik: ${error.message}</div>`;
    }
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

// Render Question
function renderQuestion() {
    const q = questions[currentIdx];
    const progress = ((currentIdx + 1) / questions.length) * 100;

    // Update progress
    const fill = document.getElementById('testProgress');
    if (fill) fill.style.width = `${progress}%`;
    const text = document.getElementById('progressText');
    if (text) text.textContent = `${currentIdx + 1}/${questions.length}`;

    // Question
    const questionTitle = document.getElementById('questionTitle');
    if (questionTitle) questionTitle.textContent = q.question;

    // Options
    const grid = document.getElementById('optionsGrid');
    if (!grid) return;

    grid.innerHTML = q.options.map((opt, i) => `
        <button class="option-btn w-full p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition font-semibold text-lg flex items-center gap-4 bg-white"
                data-index="${i}">
            <span class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 font-bold">${String.fromCharCode(65 + i)}</span>
            ${opt}
        </button>
    `).join('');

    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => selectOption(parseInt(btn.dataset.index));
    });

    // Disable submit
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50');
    }
}

let selectedOpt = null;

function selectOption(idx) {
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

// Submit button
const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
    submitBtn.onclick = () => {
        if (selectedOpt === null) return;

        userAnswers[currentIdx] = selectedOpt;
        submitBtn.disabled = true;

        // Visual feedback
        const selectedBtn = document.querySelector(`.option-btn[data-index="${selectedOpt}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('bg-indigo-100', 'border-indigo-500');
        }

        setTimeout(() => {
            currentIdx++;
            selectedOpt = null;
            if (currentIdx < questions.length) {
                renderQuestion();
            } else {
                finishTest();
            }
        }, 300);
    };
}

// Finish test - client-side grading
async function finishTest() {
    if (timerInterval) clearInterval(timerInterval);

    const user = auth.currentUser;
    if (!user) return;

    container.innerHTML = `<div class="text-center p-10"><div class="text-2xl font-bold">Natijalar hisoblanmoqda... 🔄</div></div>`;

    // Grade locally
    let correctCount = 0;
    questions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correct) {
            correctCount++;
        }
    });

    const scorePercent = Math.round((correctCount / questions.length) * 100);

    // Save to Firebase
    try {
        await DbService.saveUserProgress(user.uid, subjectId, lessonId, scorePercent);
        await DbService.saveTestResult(user.uid, subjectId, lessonId, scorePercent, userAnswers);
    } catch (e) {
        console.error("Save error:", e);
    }

    // Redirect to result
    window.location.href = `/result?subject=${subjectId}&lesson=${lessonId}&score=${scorePercent}&correct=${correctCount}&total=${questions.length}`;
}

window.addEventListener("beforeunload", () => {
    if (timerInterval) clearInterval(timerInterval);
});
