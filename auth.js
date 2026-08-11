// Sign up and log in handling.

(function () {
  const messageEl = document.getElementById("message");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const tabBtns = document.querySelectorAll(".tab-btn");

  function switchTab(name) {
    loginForm.classList.toggle("hidden", name !== "login");
    signupForm.classList.toggle("hidden", name !== "signup");
    tabBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
  }

  tabBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      switchTab(b.getAttribute("data-tab"));
    });
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");

    messageEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Logging in...";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    btn.disabled = false;
    btn.textContent = "Log in";

    if (error) {
      messageEl.classList.add("error");
      messageEl.textContent = error.message;
      return;
    }
    location.href = "index.html";
  });

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const btn = document.getElementById("signupBtn");

    if (!username) {
      messageEl.classList.add("error");
      messageEl.textContent = "Please choose a username.";
      return;
    }

    messageEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Creating account...";

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { username: username } },
    });

    btn.disabled = false;
    btn.textContent = "Sign up";

    if (error) {
      messageEl.classList.add("error");
      messageEl.textContent = error.message;
      return;
    }

    if (data.session) {
      location.href = "index.html";
    } else {
      messageEl.classList.remove("error");
      messageEl.textContent =
        "Account created! Check your email to confirm, then log in.";
    }
  });
})();
