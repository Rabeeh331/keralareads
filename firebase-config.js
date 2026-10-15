
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFrg4GDc_z6OkYRl5xZpFSknjgmoLFTUU",
authDomain: "keralareads-f25f5.firebaseapp.com",
projectId: "keralareads-f25f5",
storageBucket: "keralareads-f25f5.firebasestorage.app",
messagingSenderId: "294272704114",
appId: "1:294272704114:web:24e2e4c5f00fd3d401eceb",
measurementId: "G-D1MGYQ0LF1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
