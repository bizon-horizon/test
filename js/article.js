async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const statusEl = document.getElementById("status");
  const articleEl = document.getElementById("article-content");

  if (!slug) {
    statusEl.innerHTML = `<div class="alert alert-error">No article specified. <a href="index.html">Back to articles</a></div>`;
    return;
  }

  articleEl.classList.add("hidden");
  statusEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading article…</p>
    </div>
  `;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("articles")
      .select("id, title, slug, content, created_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      statusEl.innerHTML = `<div class="alert alert-error">Article not found. <a href="index.html">Back to articles</a></div>`;
      return;
    }

    document.title = `${data.title} — Article Hub`;

    statusEl.innerHTML = "";
    articleEl.classList.remove("hidden");
    articleEl.innerHTML = `
      <a href="index.html" class="back-link">← All articles</a>
      <header>
        <h1>${escapeHtml(data.title)}</h1>
        <p class="meta">Published ${formatDate(data.created_at)}${
          data.updated_at !== data.created_at ? ` · Updated ${formatDate(data.updated_at)}` : ""
        }</p>
      </header>
      <div class="article-body">${renderMarkdownSimple(data.content)}</div>
    `;
  } catch (err) {
    articleEl.classList.add("hidden");
    statusEl.innerHTML = "";
    if (err.message.includes("config") || err.message.includes("Supabase")) {
      showConfigError(statusEl);
    } else {
      statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", loadArticle);
