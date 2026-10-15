import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const $ = (selector) => document.querySelector(selector);
let mode = "login";

function showMessage(message, type = "") {
  const box = $("#authMessage");
  if (!box) return;
  box.textContent = message;
  box.className = `auth-message ${type}`.trim();
}

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  $("#authModalTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("#authModeHelp").textContent = signup
    ? "Create a free KeralaReads account with your email and password."
    : "Log in to your KeralaReads account.";
  $("#authSubmitBtn").textContent = signup ? "Create account" : "Log in";
  $("#authSwitchText").textContent = signup ? "Already have an account?" : "New to KeralaReads?";
  $("#authModeToggle").textContent = signup ? "Log in" : "Create an account";
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("#forgotPasswordBtn").hidden = signup;
  showMessage("");
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists with this email. Try logging in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication yet."
  };
  return messages[error?.code] || error?.message || "Authentication failed. Please try again.";
}

$("#authModeToggle")?.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

$("#authForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const submit = $("#authSubmitBtn");

  if (!email || !password) {
    showMessage("Enter your email and password.", "error");
    return;
  }
  if (password.length < 6) {
    showMessage("Password must be at least 6 characters.", "error");
    return;
  }

  submit.disabled = true;
  submit.textContent = mode === "signup" ? "Creating account…" : "Logging in…";
  showMessage("");

  try {
    if (mode === "signup") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(credential.user, { displayName: email.split("@")[0] });
      } catch (profileError) {
        console.warn("Profile name could not be set:", profileError);
      }
      showMessage("Account created successfully.", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("Logged in successfully.", "success");
    }

    window.setTimeout(() => {
      const modalElement = $("#authModal");
      const modal = window.bootstrap?.Modal.getInstance(modalElement);
      modal?.hide();
      $("#authForm")?.reset();
      setMode("login");
    }, 650);
  } catch (error) {
    console.error("Firebase Authentication error:", error);
    showMessage(friendlyError(error), "error");
  } finally {
    submit.disabled = false;
    submit.textContent = mode === "signup" ? "Create account" : "Log in";
  }
});

$("#forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) {
    showMessage("Enter your email address first.", "error");
    $("#authEmail").focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("If an account exists for this email, a password reset email has been sent.", "success");
  } catch (error) {
    console.error("Password reset error:", error);
    showMessage(friendlyError(error), "error");
  }
});

$("#logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase sign-out error:", error);
    alert(friendlyError(error));
  }
});

let authStateKnown = false;
const authModalElement = $("#authModal");

// Prevent closing the login modal until Firebase confirms a signed-in user.
authModalElement?.addEventListener("hide.bs.modal", (event) => {
  if (!authStateKnown || !auth.currentUser) event.preventDefault();
});

onAuthStateChanged(auth, (user) => {
  authStateKnown = true;
  const loginButton = $("#loginNavBtn");
  const userLabel = $("#authUserLabel");
  const logoutButton = $("#logoutBtn");

  if (user) {
    document.body.classList.remove("login-required");
    if (loginButton) loginButton.hidden = true;
    if (userLabel) {
      userLabel.hidden = false;
      userLabel.textContent = user.email || "Signed in";
      userLabel.title = user.email || "Signed in";
    }
    if (logoutButton) logoutButton.hidden = false;
    window.bootstrap?.Modal.getInstance(authModalElement)?.hide();
  } else {
    document.body.classList.add("login-required");
    if (loginButton) loginButton.hidden = false;
    if (userLabel) userLabel.hidden = true;
    if (logoutButton) logoutButton.hidden = true;
    if (authModalElement && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(authModalElement, {
        backdrop: "static", keyboard: false, focus: true
      }).show();
    }
  }
});

setMode("login");
