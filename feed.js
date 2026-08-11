// Loads and renders the article feed on the home page.

(async function () {
  const feedEl = document.getElementById("feed");

  const { data, error } = await supabaseClient
    .from("articles")
    .select("id, title, content, author_id, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedEl.innerHTML = '<p class="error">' + escapeHtml(error.message) + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    feedEl.innerHTML =
      '<p class="muted">No articles yet. Be the first to publish!</p>';
    return;
  }

  feedEl.innerHTML = data
    .map(function (a) {
      var snippet = (a.content || "").replace(/\s+/g, " ").slice(0, 160);
      return (
        '<article class="card article-card">' +
        '<h2><a href="article.html?id=' +
        encodeURIComponent(a.id) +
        '">' +
        escapeHtml(a.title) +
        "</a></h2>" +
        '<p class="meta">by ' +
        escapeHtml((a.profiles && a.profiles.username) || "Anonymous") +
        " · " +
        formatDate(a.created_at) +
        "</p>" +
        '<p class="snippet">' +
        escapeHtml(snippet) +
        "</p>" +
        "</article>"
      );
    })
    .join("");
})();
