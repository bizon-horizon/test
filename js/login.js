let isSignUp = false;

async function initLogin() {
  const statusEl = document.getElementById("status");

  try {
    const session = await getSession();
    if (session) {
      window.location.href = "publish.html";
      return;
    }
  } catch (err) {
    if (err.message.includes("config") || err.message.includes("Supabase")) {
      showConfigError(statusEl);
      document.getElementById("login-form").classList.add("hidden");
    }
  }
}

function setMode(signUp) {
  isSignUp = signUp;
  const btn = document.getElementById("submit-btn");
  const toggle = document.getElementById("toggle-signup");
  btn.textContent = signUp ? "Create account" : "Sign in";
  toggle.textContent = signUp ? "Already have an account? Sign in" : "Create one";
}

document.getElementById("toggle-signup").addEventListener("click", (e) => {
  e.preventDefault();
  setMode(!isSignUp);
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const statusEl = document.getElementById("status");
  const btn = document.getElementById("submit-btn");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  btn.disabled = true;
  statusEl.innerHTML = "";

  try {
    const sb = getSupabase();

    if (isSignUp) {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      statusEl.innerHTML = `
        <div class="alert alert-success">
          Account created! Check your email to confirm (if required by Supabase), then sign in.
        </div>
      `;
      setMode(false);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "publish.html";
    }
  } catch (err) {
    statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initLogin);
