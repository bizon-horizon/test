/**
 * Shared Supabase client and utilities
 */

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase config. Copy js/config.example.js to js/config.js and add your keys.");
  }

  if (window.SUPABASE_URL.includes("YOUR-PROJECT-ID") || window.SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY")) {
    throw new Error("Please update js/config.js with your real Supabase URL and anon key.");
  }

  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return supabaseClient;
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "article";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function excerptFromContent(content, maxLen = 160) {
  const plain = content.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).trim() + "…";
}

function renderMarkdownSimple(text) {
  if (!text) return "";

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  const paragraphs = html.split(/\n\n+/).map((block) => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[23]|ul|blockquote|pre)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  });

  return paragraphs.join("\n");
}

function showConfigError(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-error">
      <strong>Setup required:</strong> Copy <code>js/config.example.js</code> to <code>js/config.js</code>
      and add your free Supabase project URL and anon key. See README.md for steps.
    </div>
  `;
}

async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function updateAuthNav(navEl) {
  if (!navEl) return;

  try {
    const session = await getSession();
    const publishLink = navEl.querySelector('[data-nav="publish"]');
    const loginLink = navEl.querySelector('[data-nav="login"]');
    const logoutBtn = navEl.querySelector('[data-nav="logout"]');
    const authBar = navEl.querySelector(".auth-bar");

    if (session) {
      if (publishLink) publishLink.classList.remove("hidden");
      if (loginLink) loginLink.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
      if (authBar) {
        authBar.innerHTML = `<span class="user-email">${session.user.email}</span>`;
      }
    } else {
      if (publishLink) publishLink.classList.add("hidden");
      if (loginLink) loginLink.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (authBar) authBar.innerHTML = "";
    }
  } catch {
    // Config not set yet — leave default nav
  }
}

async function handleLogout(e) {
  e.preventDefault();
  const sb = getSupabase();
  await sb.auth.signOut();
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector('[data-nav="logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  const nav = document.querySelector(".nav-links");
  updateAuthNav(nav);
});
