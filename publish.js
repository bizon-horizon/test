// Publishes a new article. Requires the user to be logged in.

(async function () {
  const user = await currentUser();
  if (!user) {
    location.href = "auth.html";
    return;
  }

  const form = document.getElementById("publishForm");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const content = document.getElementById("content").value.trim();
    if (!title || !content) return;

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Publishing...";

    const { data, error } = await supabaseClient
      .from("articles")
      .insert({ title: title, content: content, author_id: user.id })
      .select("id")
      .single();

    btn.disabled = false;
    btn.textContent = "Publish";

    if (error) {
      alert("Could not publish: " + error.message);
      return;
    }
    location.href = "article.html?id=" + encodeURIComponent(data.id);
  });
})();
