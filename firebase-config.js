// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAFrg4GDc_z6OkYRl5xZpFSknjgmoLFTUU",
  authDomain: "keralareads-f25f5.firebaseapp.com",
  projectId: "keralareads-f25f5",
  storageBucket: "keralareads-f25f5.firebasestorage.app",
  messagingSenderId: "294272704114",
  appId: "1:294272704114:web:24e2e4c5f00fd3d401eceb",
  measurementId: "G-D1MGYQ0LF1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
