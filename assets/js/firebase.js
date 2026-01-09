import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCy8SLCFTgc_mB8B4JJqrUGsX5Lr2NUuPo",
  authDomain: "space0411-a00b1.firebaseapp.com",
  databaseURL: "https://space0411-a00b1-default-rtdb.firebaseio.com",
  projectId: "space0411-a00b1",
  storageBucket: "space0411-a00b1.firebasestorage.app",
  messagingSenderId: "1018550863390",
  appId: "1:1018550863390:web:d023ce44fbe8ce7171d00f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
