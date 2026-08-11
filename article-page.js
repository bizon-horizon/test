// Loads a single article, its comments, and live comment updates.

(function () {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  const articleView = document.getElementById("articleView");
  const commentsEl = document.getElementById("comments");
  const commentFormWrap = document.getElementById("commentFormWrap");
  const commentCountEl = document.getElementById("commentCount");

  let user = null;

  async function loadArticle() {
    const { data, error } = await supabaseClient
      .from("articles")
      .select("id, title, content, author_id, created_at, profiles(username)")
      .eq("id", articleId)
      .maybeSingle();

    if (error) {
      articleView.innerHTML =
        '<p class="error">' + escapeHtml(error.message) + "</p>";
      return;
    }
    if (!data) {
      articleView.innerHTML = '<p class="error">Article not found.</p>';
      return;
    }

    articleView.innerHTML =
      '<article class="card article-full">' +
      "<h1>" +
      escapeHtml(data.title) +
      "</h1>" +
      '<p class="meta">by ' +
      escapeHtml((data.profiles && data.profiles.username) || "Anonymous") +
      " · " +
      formatDate(data.created_at) +
      "</p>" +
      '<div class="article-body">' +
      renderTextWithBreaks(data.content) +
      "</div>" +
      "</article>";
  }

  function commentHtml(c) {
    var isOwn = user && c.author_id === user.id;
    return (
      '<div class="comment">' +
      '<div class="comment-head">' +
      '<span class="comment-author">' +
      escapeHtml((c.profiles && c.profiles.username) || "Anonymous") +
      "</span>" +
      '<span class="comment-date">' +
      formatDate(c.created_at) +
      "</span>" +
      "</div>" +
      '<p class="comment-body">' +
      renderTextWithBreaks(c.content) +
      "</p>" +
      (isOwn
        ? '<button class="btn btn-ghost btn-sm" data-delete-comment="' +
          c.id +
          '">Delete</button>'
        : "") +
      "</div>"
    );
  }

  async function loadComments() {
    const { data, error } = await supabaseClient
      .from("comments")
      .select("id, content, author_id, created_at, profiles(username)")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true });

    if (error) {
      commentsEl.innerHTML =
        '<p class="error">' + escapeHtml(error.message) + "</p>";
      return;
    }

    const list = data || [];
    commentCountEl.textContent = list.length;
    if (list.length === 0) {
      commentsEl.innerHTML =
        '<p class="muted">No comments yet. Start the conversation!</p>';
      return;
    }
    commentsEl.innerHTML = list.map(commentHtml).join("");
  }

  async function deleteComment(id) {
    const { error } = await supabaseClient
      .from("comments")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Could not delete comment: " + error.message);
      return;
    }
    await loadComments();
  }

  async function postComment(e) {
    e.preventDefault();
    const text = document.getElementById("commentText").value.trim();
    if (!text) return;

    const { error } = await supabaseClient.from("comments").insert({
      article_id: articleId,
      author_id: user.id,
      content: text,
    });
    if (error) {
      alert("Could not post comment: " + error.message);
      return;
    }
    document.getElementById("commentText").value = "";
    await loadComments();
  }

  function subscribeComments() {
    supabaseClient
      .channel("comments-" + articleId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: "article_id=eq." + articleId,
        },
        function () {
          loadComments();
        }
      )
      .subscribe();
  }

  commentsEl.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-delete-comment]");
    if (!btn) return;
    if (!confirm("Delete this comment?")) return;
    deleteComment(btn.getAttribute("data-delete-comment"));
  });

  (async function init() {
    user = await currentUser();

    if (user) {
      commentFormWrap.innerHTML =
        '<form id="commentForm" class="comment-form">' +
        '<textarea id="commentText" placeholder="Write a comment..." required></textarea>' +
        '<button type="submit" class="btn btn-primary">Post comment</button>' +
        "</form>";
      document
        .getElementById("commentForm")
        .addEventListener("submit", postComment);
    } else {
      commentFormWrap.innerHTML =
        '<p class="muted">Please <a href="auth.html">log in</a> to comment.</p>';
    }

    if (!articleId) {
      articleView.innerHTML = '<p class="error">No article selected.</p>';
      return;
    }

    await loadArticle();
    await loadComments();
    subscribeComments();
  })();
})();
