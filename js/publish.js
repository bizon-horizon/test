async function requireAuth() {
  const statusEl = document.getElementById("status");

  try {
    const session = await getSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    return session;
  } catch (err) {
    if (err.message.includes("config") || err.message.includes("Supabase")) {
      showConfigError(statusEl);
      document.getElementById("publish-form").classList.add("hidden");
    }
    return null;
  }
}

async function uniqueSlug(sb, baseSlug) {
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 20) {
    const { data } = await sb.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

document.getElementById("publish-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const statusEl = document.getElementById("status");
  const btn = document.getElementById("submit-btn");
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();

  btn.disabled = true;
  statusEl.innerHTML = `<div class="alert alert-info">Saving to cloud database…</div>`;

  try {
    const sb = getSupabase();
    const baseSlug = slugify(title);
    const slug = await uniqueSlug(sb, baseSlug);
    const excerpt = excerptFromContent(content);

    const { data, error } = await sb.from("articles").insert({
      title,
      slug,
      content,
      excerpt,
      author_id: session.user.id,
    }).select("slug").single();

    if (error) throw error;

    statusEl.innerHTML = `<div class="alert alert-success">Published! Redirecting…</div>`;
    setTimeout(() => {
      window.location.href = `article.html?slug=${encodeURIComponent(data.slug)}`;
    }, 800);
  } catch (err) {
    statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", requireAuth);
