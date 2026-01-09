import { auth, db } from './firebase.js';
import { ref, update, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const lessonId = parseInt(urlParams.get('lesson')) || 1;
const subjectId = urlParams.get('subject') || 'math';

let questions = [];
let currentIdx = 0;
let score = 0;
let selectedOpt = null;
let timerInterval = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch('data/tests.json');
        const allTests = await response.json();
        const testData = allTests.find(t => t.lessonId === lessonId && t.subjectId === subjectId);

        if (testData && testData.questions) {
            questions = testData.questions;
            renderQuestion();
        } else {
            alert("Ushbu dars uchun testlar topilmadi yoki ushbu fanga tegishli emas!");
            window.location.href = `path.html?subject=${subjectId}`;
        }
    } catch (error) {
        console.error("Test fetch error:", error);
    }
});

function renderQuestion() {
    selectedOpt = null; // Reset selection
    const q = questions[currentIdx];
    const progress = (currentIdx / questions.length) * 100;

    const testProgress = document.getElementById('testProgress');
    if (testProgress) testProgress.style.width = `${progress}%`;

    const badge = document.getElementById('difficultyBadge');
    if (badge) {
        badge.textContent = q.difficulty;
        badge.className = "px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ";
        if (q.difficulty === 'oson') badge.classList.add('bg-emerald-100', 'text-emerald-700');
        else if (q.difficulty === 'o\'rtacha') badge.classList.add('bg-amber-100', 'text-amber-700');
        else badge.classList.add('bg-rose-100', 'text-rose-700');
    }

    const questionTitle = document.getElementById('questionTitle');
    if (questionTitle) questionTitle.textContent = q.question;

    // Start timer if not already running
    if (!timerInterval) {
        const startTime = Date.now();
        timerInterval = setInterval(() => {
            const now = Date.now();
            const seconds = Math.floor((now - startTime) / 1000);
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    const grid = document.getElementById('optionsGrid');
    if (!grid) return;

    if (q.type === 'tf') {
        grid.className = "grid grid-cols-2 gap-4";
    } else {
        grid.className = "space-y-4";
    }

    grid.innerHTML = q.options.map((opt, i) => `
        <button class="option-btn w-full p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition font-semibold text-lg flex items-center gap-4 bg-white"
                data-index="${i}" id="opt-${i}">
            <span class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 font-bold">${String.fromCharCode(65 + i)}</span>
            ${opt}
        </button>
    `).join('');

    // Add event listeners to buttons
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
        return; // Selection allowed only before checking
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

const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
    submitBtn.onclick = async () => {
        if (selectedOpt === null) return;

        const q = questions[currentIdx];
        const feedback = document.getElementById('feedback');
        const submitBtnEl = document.getElementById('submitBtn');

        submitBtnEl.disabled = true;
        submitBtnEl.classList.add('opacity-50');
        feedback.classList.remove('hidden');

        const correctBtn = document.getElementById(`opt-${q.correct}`);
        const selectedBtn = document.getElementById(`opt-${selectedOpt}`);

        if (selectedOpt === q.correct) {
            score++;
            feedback.textContent = "To'g'ri! 🎉";
            feedback.className = "p-4 rounded-2xl mb-6 text-center font-bold bg-emerald-100 text-emerald-700 animate-fade-in";
            if (selectedBtn) selectedBtn.classList.add('bg-emerald-100', 'border-emerald-500');
        } else {
            feedback.textContent = "Xato! 🤔";
            feedback.className = "p-4 rounded-2xl mb-6 text-center font-bold bg-red-100 text-red-700 animate-fade-in";
            if (selectedBtn) selectedBtn.classList.add('bg-red-100', 'border-red-500');
            if (correctBtn) correctBtn.classList.add('bg-emerald-50', 'border-emerald-500', 'border-dashed');
        }

        // Auto-advance after delay
        setTimeout(() => {
            currentIdx++;
            if (currentIdx < questions.length) {
                renderQuestion();
            } else {
                finishTest();
            }
        }, 1500);
    };
}

async function finishTest() {
    if (timerInterval) clearInterval(timerInterval);
    const percent = Math.round((score / questions.length) * 100);
    const user = auth.currentUser;

    if (user) {
        // Update Firebase Progress
        const updates = {};
        updates[`users/${user.uid}/progress/${subjectId}/${lessonId}`] = percent;
        await update(ref(db), updates);

        // Update streak/activity (logic already in auth.js login, but recording activity is good)
        const now = Date.now();
        await update(ref(db, `users/${user.uid}`), { lastActive: now });
    }

    window.location.href = `result.html?score=${percent}&lesson=${lessonId}&subject=${subjectId}`;
}

window.addEventListener("beforeunload", () => {
    if (timerInterval) clearInterval(timerInterval);
});
