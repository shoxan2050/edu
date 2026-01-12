import { auth } from './firebase.js';
import { logout, showToast } from './auth.js';
import { DbService } from './modules/db-service.js';

const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get('lesson');
const subjectId = urlParams.get('subject');

let questions = [];
let currentIdx = 0;
let userAnswers = [];
let skippedQuestions = []; // Track skipped questions
let timerInterval = null;
let startTime = null;
let fiftyFiftyUsed = 0;
const MAX_FIFTY_FIFTY = 2;

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
        const testData = await DbService.getTests(subjectId, lessonId);

        if (!testData || !testData.questions || testData.questions.length === 0) {
            container.innerHTML = `<div class="text-center p-10 text-gray-500">Bu dars uchun testlar hali qo'shilmagan 📝</div>`;
            return;
        }

        questions = testData.questions;
        userAnswers = new Array(questions.length).fill(null);
        startTime = Date.now();
        updateFiftyFiftyCounter();
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

// Update 50:50 counter
function updateFiftyFiftyCounter() {
    const countEl = document.getElementById('fiftyFiftyCount');
    const btnEl = document.getElementById('fiftyFiftyBtn');
    const remaining = MAX_FIFTY_FIFTY - fiftyFiftyUsed;

    if (countEl) countEl.textContent = remaining;
    if (btnEl && remaining <= 0) {
        btnEl.disabled = true;
        btnEl.classList.add('opacity-40', 'cursor-not-allowed');
    }
}

// Update skipped counter
function updateSkippedCounter() {
    const countEl = document.getElementById('skippedCount');
    if (countEl) {
        countEl.textContent = skippedQuestions.length;
        countEl.classList.toggle('hidden', skippedQuestions.length === 0);
    }
}

// Render Question
function renderQuestion() {
    if (currentIdx >= questions.length) {
        // Check if there are skipped questions
        if (skippedQuestions.length > 0) {
            showSkippedQuestions();
        } else {
            finishTest();
        }
        return;
    }

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

    // Reset 50:50 state for this question
    currentQuestionFiftyFiftyUsed = false;

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

    // Update skip button visibility
    const skipBtn = document.getElementById('skipBtn');
    if (skipBtn) {
        skipBtn.classList.remove('hidden');
    }
}

let selectedOpt = null;
let currentQuestionFiftyFiftyUsed = false;

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

// 50:50 Helper - removes 2 wrong answers
window.useFiftyFifty = function () {
    if (fiftyFiftyUsed >= MAX_FIFTY_FIFTY) {
        showToast("50:50 tugadi! ❌", "error");
        return;
    }
    if (currentQuestionFiftyFiftyUsed) {
        showToast("Bu savolda 50:50 ishlatilgan!", "error");
        return;
    }

    const q = questions[currentIdx];
    const correctIdx = q.correct;

    // Get wrong answer indices
    const wrongIndices = q.options
        .map((_, i) => i)
        .filter(i => i !== correctIdx);

    // Shuffle and pick 2 to hide
    const toHide = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);

    // Hide the wrong options
    toHide.forEach(idx => {
        const btn = document.querySelector(`.option-btn[data-index="${idx}"]`);
        if (btn) {
            btn.classList.add('opacity-30', 'pointer-events-none', 'line-through');
            btn.style.textDecoration = 'line-through';
        }
    });

    fiftyFiftyUsed++;
    currentQuestionFiftyFiftyUsed = true;
    updateFiftyFiftyCounter();
    showToast("2 ta noto'g'ri javob olib tashlandi! ✂️", "success");
};

// Skip question for later
window.skipQuestion = function () {
    if (!skippedQuestions.includes(currentIdx)) {
        skippedQuestions.push(currentIdx);
        updateSkippedCounter();
    }

    selectedOpt = null;
    currentIdx++;
    renderQuestion();
};

// Show skipped questions
function showSkippedQuestions() {
    if (skippedQuestions.length === 0) {
        finishTest();
        return;
    }

    showToast(`${skippedQuestions.length} ta o'tkazilgan savol bor!`, "info");

    // Get first skipped question
    currentIdx = skippedQuestions.shift();
    updateSkippedCounter();
    renderQuestion();

    // Hide skip button for skipped questions
    const skipBtn = document.getElementById('skipBtn');
    if (skipBtn) {
        skipBtn.classList.add('hidden');
    }
}

// Submit button with Duolingo-style feedback
const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
    submitBtn.onclick = () => {
        if (selectedOpt === null) return;

        userAnswers[currentIdx] = selectedOpt;
        submitBtn.disabled = true;

        const q = questions[currentIdx];
        const isCorrect = selectedOpt === q.correct;

        // Disable all option buttons
        document.querySelectorAll('.option-btn').forEach((btn, i) => {
            btn.classList.add('pointer-events-none');

            // Show correct answer in green
            if (i === q.correct) {
                btn.classList.remove('border-gray-100', 'bg-white');
                btn.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-800');
                btn.querySelector('span').classList.remove('bg-gray-100', 'text-gray-400');
                btn.querySelector('span').classList.add('bg-emerald-500', 'text-white');
            }

            // Show wrong selected answer in red
            if (i === selectedOpt && !isCorrect) {
                btn.classList.remove('border-gray-100', 'bg-white', 'border-indigo-600', 'bg-indigo-50');
                btn.classList.add('border-red-500', 'bg-red-50', 'text-red-800');
                btn.querySelector('span').classList.remove('bg-gray-100', 'text-gray-400');
                btn.querySelector('span').classList.add('bg-red-500', 'text-white');
            }
        });

        // Create feedback panel (Duolingo style)
        const feedbackPanel = document.createElement('div');
        feedbackPanel.id = 'feedbackPanel';
        feedbackPanel.className = `fixed bottom-0 left-0 right-0 p-6 z-50 transform transition-transform duration-300 ${isCorrect
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`;

        const explanation = q.explanation || (isCorrect
            ? "Ajoyib! To'g'ri javob!"
            : `To'g'ri javob: ${q.options[q.correct]}`);

        feedbackPanel.innerHTML = `
            <div class="max-w-2xl mx-auto">
                <div class="flex items-center gap-4 mb-3">
                    <span class="text-4xl">${isCorrect ? '✅' : '❌'}</span>
                    <span class="text-2xl font-bold">${isCorrect ? 'To\'g\'ri!' : 'Noto\'g\'ri!'}</span>
                </div>
                ${!isCorrect ? `
                    <div class="mb-2 text-lg">
                        <strong>To'g'ri javob:</strong> ${q.options[q.correct]}
                    </div>
                ` : ''}
                <div class="text-white/90 text-lg mb-4">
                    💡 ${explanation}
                </div>
                <button onclick="nextQuestion()" class="w-full py-4 ${isCorrect
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            } text-white rounded-2xl font-bold text-lg transition">
                    Keyingi savol →
                </button>
            </div>
        `;

        document.body.appendChild(feedbackPanel);

        // Animate in
        setTimeout(() => {
            feedbackPanel.classList.add('translate-y-0');
        }, 50);
    };
}

// Next question function (called from feedback panel)
window.nextQuestion = function () {
    const feedbackPanel = document.getElementById('feedbackPanel');
    if (feedbackPanel) {
        feedbackPanel.remove();
    }
    currentIdx++;
    selectedOpt = null;
    renderQuestion();
};

// Finish test - client-side grading
async function finishTest() {
    if (timerInterval) clearInterval(timerInterval);

    const user = auth.currentUser;
    if (!user) return;

    container.innerHTML = `<div class="text-center p-10"><div class="text-2xl font-bold">Natijalar hisoblanmoqda... 🔄</div></div>`;

    // Grade locally
    let correctCount = 0;
    let wrongQuestions = [];

    questions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correct) {
            correctCount++;
        } else {
            wrongQuestions.push({
                question: q.question,
                userAnswer: userAnswers[idx] !== null ? q.options[userAnswers[idx]] : 'Javob berilmagan',
                correctAnswer: q.options[q.correct]
            });
        }
    });

    const scorePercent = Math.round((correctCount / questions.length) * 100);

    // Save to Firebase
    try {
        await DbService.saveUserProgress(user.uid, subjectId, lessonId, scorePercent);
        await DbService.saveTestResult(user.uid, subjectId, lessonId, scorePercent, userAnswers);

        // Save wrong questions for retry feature
        if (wrongQuestions.length > 0) {
            sessionStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
        }
    } catch (e) {
        console.error("Save error:", e);
    }

    // Redirect to result with confetti flag
    const confetti = scorePercent >= 70 ? '&confetti=1' : '';
    window.location.href = `/result?subject=${subjectId}&lesson=${lessonId}&score=${scorePercent}&correct=${correctCount}&total=${questions.length}${confetti}`;
}

window.addEventListener("beforeunload", () => {
    if (timerInterval) clearInterval(timerInterval);
});
