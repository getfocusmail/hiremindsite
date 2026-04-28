(function () {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function wireSupportForm(form) {
    if (!form) return;
    var status = form.querySelector("[data-support-status]");
    var supportEndpoint = "https://formsubmit.co/ajax/getfocusmail@gmail.com";

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (status) { status.textContent = ""; status.className = "status"; }

      var name = (form.name && form.name.value || "").trim();
      var email = (form.email && form.email.value || "").trim();
      var subject = (form.subject && form.subject.value || "").trim();
      var message = (form.message && form.message.value || "").trim();

      if (!email || !validEmail(email)) {
        if (status) { status.textContent = "Please enter a valid email."; status.classList.add("err"); }
        return;
      }

      if (!subject || !message) {
        if (status) { status.textContent = "Please add a subject and message."; status.classList.add("err"); }
        return;
      }

      try {
        var response = await fetch(supportEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            name: name || "Not provided",
            email: email,
            subject: "[HireMind Support] " + subject,
            message: message,
            _captcha: "false"
          })
        });

        if (!response.ok) {
          throw new Error("Support request failed.");
        }

        form.reset();
        if (status) { status.textContent = "Message sent. We'll reply to your email soon."; status.classList.add("ok"); }
      } catch (_) {
        if (status) { status.textContent = "Could not send right now. Please try again in a moment."; status.classList.add("err"); }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);

    wireSupportForm(document.querySelector("[data-support-form]"));
  });
})();
