// Global realtime chat. Any visitor (logged in or not) can read;
// posting a message requires being logged in.

(function () {
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");

  const profileCache = {};

  async function profileName(id) {
    if (profileCache[id]) return profileCache[id];
    const { data } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", id)
      .maybeSingle();
    const name =
      (data && data.username) || "user_" + String(id).slice(0, 6);
    profileCache[id] = name;
    return name;
  }

  function msgHtml(m) {
    return (
      '<div class="chat-message">' +
      '<span class="chat-author">' +
      escapeHtml(m._name) +
      "</span>" +
      '<span class="chat-date">' +
      formatDate(m.created_at) +
      "</span>" +
      '<p class="chat-text">' +
      escapeHtml(m.content) +
      "</p>" +
      "</div>"
    );
  }

  async function render(list) {
    if (list.length === 0) {
      messagesEl.innerHTML = '<p class="muted">No messages yet. Say hello!</p>';
      return;
    }
    for (let i = 0; i < list.length; i++) {
      list[i]._name = await profileName(list[i].author_id);
    }
    messagesEl.innerHTML = list.map(msgHtml).join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load recent history.
  (async function loadHistory() {
    const { data, error } = await supabaseClient
      .from("chat_messages")
      .select("id, author_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      messagesEl.innerHTML =
        '<p class="error">' + escapeHtml(error.message) + "</p>";
      return;
    }
    await render((data || []).reverse());
  })();

  // Live updates.
  supabaseClient
    .channel("global-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      async function (payload) {
        const m = payload.new;
        m._name = await profileName(m.author_id);
        messagesEl.insertAdjacentHTML("beforeend", msgHtml(m));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    )
    .subscribe();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const user = await currentUser();
    if (!user) {
      alert("Please log in to chat.");
      location.href = "auth.html";
      return;
    }

    const { error } = await supabaseClient.from("chat_messages").insert({
      author_id: user.id,
      content: text,
    });
    if (error) {
      alert("Could not send message: " + error.message);
      return;
    }
    input.value = "";
  });
})();
