// Request access on Bob's landing page: posts the form to /api/bob-access, which emails an invite straight back when
// self-serve is on ({invite: "sent"}), else the request to Bob's owner.
document.getElementById("ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target, button = form.querySelector("button"), err = document.getElementById("ask-err");
  const SAY = {
    bad_input: "Check your name and email.",
    slow_down: "That's a lot of requests. Try again in an hour.",
  };
  button.disabled = true;
  err.textContent = "";
  const r = await fetch("/api/bob-access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  }).catch(() => null);
  const { error, invite } = (await r?.json().catch(() => null)) ?? {};
  if (r?.ok) {
    form.hidden = true;
    const done = document.getElementById("ask-done");
    if (invite === "sent") {
      done.querySelector("h3").textContent = "Check your email.";
      done.querySelector("p").textContent = "Your invite code is on its way. Open Bob on your Mac and type it in with your email.";
    }
    done.hidden = false;
    return;
  }
  err.textContent = SAY[error] ?? "Couldn't send that. Try again in a minute.";
  button.disabled = false;
});
