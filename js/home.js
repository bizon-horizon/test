async function loadArticles() {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("article-list");

  listEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading articles from the cloud…</p>
    </div>
  `;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("articles")
      .select("id, title, slug, excerpt, content, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    statusEl.innerHTML = "";

    if (!data || data.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h2>No articles yet</h2>
          <p>Sign in and publish your first article — it will appear here for everyone to read.</p>
          <p style="margin-top:1rem"><a href="login.html">Sign in to publish →</a></p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = data.map((article) => {
      const excerpt = article.excerpt || excerptFromContent(article.content);
      return `
        <a href="article.html?slug=${encodeURIComponent(article.slug)}" class="article-card">
          <h2>${escapeHtml(article.title)}</h2>
          <p class="excerpt">${escapeHtml(excerpt)}</p>
          <span class="meta">${formatDate(article.created_at)}</span>
        </a>
      `;
    }).join("");
  } catch (err) {
    listEl.innerHTML = "";
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

document.addEventListener("DOMContentLoaded", loadArticles);
