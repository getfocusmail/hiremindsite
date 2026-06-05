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

  function wireMobileNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav-toggle");
    var navLinks = document.querySelector(".nav-links");
    if (!nav || !toggle || !navLinks) return;

    function setOpen(open) {
      nav.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("nav-open"));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 860) setOpen(false);
    });
  }

  function initInteractiveBackground() {
    if (typeof InteractiveBackground === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.__hiremindInteractiveBackground) return;

    window.__hiremindInteractiveBackground = new InteractiveBackground();
    window.__hiremindInteractiveBackground.mount();
  }

  function initSectionInteractiveBackground() {
    if (typeof SectionInteractiveBackgroundManager === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.__hiremindSectionBackground) return;

    window.__hiremindSectionBackground = new SectionInteractiveBackgroundManager();
    window.__hiremindSectionBackground.mount();
  }

  function initFeaturedSectionBackground() {
    if (typeof FeaturedSectionBackgroundManager === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.__hiremindFeaturedBackground) return;

    window.__hiremindFeaturedBackground = new FeaturedSectionBackgroundManager();
    window.__hiremindFeaturedBackground.mount();
  }

  function initRocketLaunch() {
    if (typeof RocketLaunchBackground === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.__hiremindRocketLaunch) return;

    var hero = document.querySelector(".hero");
    if (!hero) return;

    window.__hiremindRocketLaunch = new RocketLaunchBackground(hero);
    window.__hiremindRocketLaunch.mount();
  }

  function initShootingStars() {
    if (typeof ShootingStarsBackground === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.__hiremindShootingStars) return;

    var hero = document.querySelector(".hero");
    if (!hero) return;

    window.__hiremindShootingStars = new ShootingStarsBackground(hero);
    window.__hiremindShootingStars.mount();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var hash = window.location.hash;
    if (hash) {
      var target = document.querySelector(hash);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        history.replaceState(null, "", window.location.pathname + window.location.search);
        window.scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, 0);
    }

    initInteractiveBackground();
    initRocketLaunch();
    initShootingStars();
    initSectionInteractiveBackground();
    initFeaturedSectionBackground();
    wireMobileNav();
    wireSupportForm(document.querySelector("[data-support-form]"));
  });
})();
