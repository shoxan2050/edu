import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
            window.location.href = "login.html";
        }
        return;
    }

    try {
        const snapshot = await get(ref(db, 'users/' + user.uid));
        if (snapshot.exists()) {
            const userData = snapshot.val();

            // Re-sync localStorage with fresh data
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                email: user.email,
                ...userData
            }));

            // Update UI
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('welcomeName').textContent = userData.name;
            document.getElementById('streakCount').textContent = userData.streak || 0;

            // Calculate overall progress (Average of only active subjects)
            let totalPercent = 0;
            let activeSubjectsCount = 0;
            const progressObj = userData.progress || {};

            Object.values(progressObj).forEach(subj => {
                const lessonPercents = Object.values(subj);
                if (lessonPercents.length > 0) {
                    const subjAvg = lessonPercents.reduce((a, b) => a + b, 0) / lessonPercents.length;
                    totalPercent += subjAvg;
                    activeSubjectsCount++;
                }
            });
            const avgProgress = activeSubjectsCount > 0 ? Math.round(totalPercent / activeSubjectsCount) : 0;

            document.getElementById('progressText').textContent = avgProgress;
            const circle = document.getElementById('progressCircle');
            if (circle) {
                const r = circle.getAttribute('r') || 40;
                const circumference = 2 * Math.PI * r;
                circle.style.strokeDasharray = `${circumference} ${circumference}`;
                const offset = circumference - (avgProgress / 100) * circumference;
                circle.style.strokeDashoffset = offset;
            }

            loadSubjects(userData.progress || {});
        }
    } catch (error) {
        console.error("Dashboard load error", error);
    }
});

async function loadSubjects(userProgress) {
    const list = document.getElementById('subjectsList');
    if (!list) return;

    try {
        const res = await fetch('data/subjects.json');
        const subjects = await res.json();

        list.innerHTML = subjects.map(s => {
            const subjectData = userProgress[s.id] || {};
            const lessonPercents = Object.values(subjectData);
            const progress = lessonPercents.length > 0 ? Math.round(lessonPercents.reduce((a, b) => a + b, 0) / lessonPercents.length) : 0;
            const completedCount = lessonPercents.filter(p => p >= 80).length;

            return `
                <a href="path.html?subject=${s.id}" class="bg-white p-6 rounded-3xl border border-gray-100 hover:shadow-xl transition flex items-center justify-between group">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition">
                            ${s.icon}
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900">${s.name}</h3>
                            <p class="text-gray-500 text-sm">${completedCount} dars tugatildi</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-indigo-600">${progress}%</div>
                        <div class="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                            <div class="h-full bg-indigo-600 rounded-full" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    } catch (error) {
        console.error("Subjects load error", error);
    }
}

import { logout } from './auth.js';

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.onclick = logout;
}
