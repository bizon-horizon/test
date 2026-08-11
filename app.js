// Shared helpers used by every page. Load after lib/supabase.min.js and config.js.

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function renderTextWithBreaks(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

async function currentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user || null;
}

async function ensureProfile() {
  const user = await currentUser();
  if (!user) return null;
  const username =
    (user.user_metadata && user.user_metadata.username) ||
    "user_" + user.id.slice(0, 8);
  const { error } = await supabaseClient
    .from("profiles")
    .upsert({ id: user.id, username: username }, { onConflict: "id" });
  if (error) console.warn("Could not sync profile:", error.message);
  return user;
}

async function updateNav() {
  const badge = document.getElementById("userBadge");
  const authLink = document.getElementById("authLink");
  const logoutBtn = document.getElementById("logoutBtn");
  if (!badge) return;

  const user = await currentUser();
  if (user) {
    const name =
      (user.user_metadata && user.user_metadata.username) || user.email;
    badge.textContent = "Signed in as " + name;
    badge.classList.remove("hidden");
    if (authLink) authLink.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
    if (authLink) authLink.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
  }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.href = "index.html";
  });
}

(async () => {
  await ensureProfile();
  updateNav();
})();
