(function (global) {
  "use strict";

  var RESIZE_THROTTLE_MS = 120;
  var REGION_CONNECTION = 110;
  var CARD_CONNECTION = 72;
  var REGION_MOUSE_RADIUS = 120;
  var CARD_MOUSE_RADIUS = 90;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function distSq(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }

  function SectionBgInstance(host, type, manager) {
    this.host = host;
    this.type = type;
    this.manager = manager;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.visible = false;
    this.resizeTimer = null;
    this._onResize = this._handleResize.bind(this);
  }

  SectionBgInstance.prototype._particleCount = function () {
    var area = this.width * this.height;
    if (this.type === "region") {
      return clamp(Math.floor(area / 22000), 22, 48);
    }
    return clamp(Math.floor(area / 9000), 10, 22);
  };

  SectionBgInstance.prototype._seedParticles = function () {
    var count = this._particleCount();
    var drift = this.type === "region" ? 0.16 : 0.12;
    this.particles = [];

    for (var i = 0; i < count; i += 1) {
      var x = Math.random() * this.width;
      var y = Math.random() * this.height;
      var angle = Math.random() * Math.PI * 2;
      var speed = drift * (0.4 + Math.random() * 0.6);

      this.particles.push({
        x: x,
        y: y,
        anchorX: x,
        anchorY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: this.type === "region" ? 0.9 + Math.random() * 0.8 : 0.7 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  };

  SectionBgInstance.prototype._createCanvas = function () {
    var canvas = document.createElement("canvas");
    canvas.className = "section-interactive-background";
    canvas.setAttribute("aria-hidden", "true");
    this.host.classList.add("section-bg-host");
    this.host.insertBefore(canvas, this.host.firstChild);
    return canvas;
  };

  SectionBgInstance.prototype._setSize = function () {
    if (!this.canvas) return;

    var rect = this.host.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";

    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  };

  SectionBgInstance.prototype._handleResize = function () {
    var self = this;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () {
      self.resizeTimer = null;
      var prev = self.particles.length;
      self._setSize();
      if (!prev || self._particleCount() !== prev) {
        self._seedParticles();
      } else {
        self.particles.forEach(function (p) {
          p.x = clamp(p.x, 0, self.width);
          p.y = clamp(p.y, 0, self.height);
          p.anchorX = clamp(p.anchorX, 0, self.width);
          p.anchorY = clamp(p.anchorY, 0, self.height);
        });
      }
    }, RESIZE_THROTTLE_MS);
  };

  SectionBgInstance.prototype._localPointer = function () {
    var pointer = this.manager.pointer;
    if (!pointer.active) return null;

    var rect = this.host.getBoundingClientRect();
    return {
      x: pointer.x - rect.left,
      y: pointer.y - rect.top,
      inside:
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
    };
  };

  SectionBgInstance.prototype._update = function (time) {
    var t = time * 0.001;
    var isRegion = this.type === "region";
    var mouseRadius = isRegion ? REGION_MOUSE_RADIUS : CARD_MOUSE_RADIUS;
    var mouseForce = isRegion ? 0.38 : 0.28;
    var returnStrength = isRegion ? 0.02 : 0.024;
    var radiusSq = mouseRadius * mouseRadius;
    var local = this._localPointer();
    var i;
    var p;
    var dx;
    var dy;
    var dist;
    var force;

    for (i = 0; i < this.particles.length; i += 1) {
      p = this.particles[i];

      p.anchorX += Math.sin(t * 0.4 + p.phase) * 0.03;
      p.anchorY += Math.cos(t * 0.32 + p.phase * 1.2) * 0.03;
      p.anchorX = clamp(p.anchorX, 0, this.width);
      p.anchorY = clamp(p.anchorY, 0, this.height);

      p.vx += (p.anchorX - p.x) * returnStrength;
      p.vy += (p.anchorY - p.y) * returnStrength;

      if (local && local.inside) {
        dx = p.x - local.x;
        dy = p.y - local.y;
        dist = distSq(p.x, p.y, local.x, local.y);

        if (dist < radiusSq && dist > 0.01) {
          dist = Math.sqrt(dist);
          force = ((mouseRadius - dist) / mouseRadius) * mouseForce;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.vx *= 0.93;
      p.vy *= 0.93;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) { p.x = 0; p.vx *= -0.45; }
      if (p.x > this.width) { p.x = this.width; p.vx *= -0.45; }
      if (p.y < 0) { p.y = 0; p.vy *= -0.45; }
      if (p.y > this.height) { p.y = this.height; p.vy *= -0.45; }
    }
  };

  SectionBgInstance.prototype._draw = function () {
    var ctx = this.ctx;
    var particles = this.particles;
    var isRegion = this.type === "region";
    var connection = isRegion ? REGION_CONNECTION : CARD_CONNECTION;
    var lineAlpha = isRegion ? 0.16 : 0.2;
    var connDistSq = connection * connection;
    var i;
    var j;
    var p;
    var q;
    var d;
    var alpha;

    ctx.clearRect(0, 0, this.width, this.height);

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      for (j = i + 1; j < particles.length; j += 1) {
        q = particles[j];
        d = distSq(p.x, p.y, q.x, q.y);
        if (d < connDistSq) {
          alpha = (1 - Math.sqrt(d) / connection) * lineAlpha;
          ctx.strokeStyle = "rgba(129, 140, 248, " + alpha.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      ctx.fillStyle = isRegion
        ? "rgba(167, 139, 250, 0.55)"
        : "rgba(196, 181, 253, 0.65)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  SectionBgInstance.prototype.mount = function () {
    if (this.canvas) return this;

    this.canvas = this._createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    if (!this.ctx) return this;

    this._setSize();
    this._seedParticles();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this._onResize);
      this.resizeObserver.observe(this.host);
    } else {
      global.addEventListener("resize", this._onResize, { passive: true });
    }

    return this;
  };

  SectionBgInstance.prototype.destroy = function () {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    } else {
      global.removeEventListener("resize", this._onResize);
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.host.classList.remove("section-bg-host");
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    return this;
  };

  function SectionInteractiveBackgroundManager() {
    this.instances = [];
    this.pointer = { x: -9999, y: -9999, active: false };
    this.rafId = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  SectionInteractiveBackgroundManager.prototype._discoverHosts = function () {
    var regionSelector = ".hero, .section-features";
    var cardSelector = ".card:not(.legal-content)";
    var regions = Array.prototype.slice.call(document.querySelectorAll(regionSelector));
    var cards = Array.prototype.slice.call(document.querySelectorAll(cardSelector));
    var hosts = [];
    var seen = new Set();

    regions.forEach(function (el) {
      if (seen.has(el)) return;
      seen.add(el);
      hosts.push({ el: el, type: "region" });
    });

    cards.forEach(function (el) {
      if (seen.has(el)) return;
      if (el.closest(".section-how, .section--alt")) return;
      seen.add(el);
      hosts.push({ el: el, type: "card" });
    });

    return hosts;
  };

  SectionInteractiveBackgroundManager.prototype._onMouseMove = function (event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.active = true;
  };

  SectionInteractiveBackgroundManager.prototype._onMouseLeave = function () {
    this.pointer.active = false;
    this.pointer.x = -9999;
    this.pointer.y = -9999;
  };

  SectionInteractiveBackgroundManager.prototype._onVisibility = function (entries) {
    entries.forEach(function (entry) {
      entry.target.__sectionBgVisible = entry.isIntersecting;
    });
  };

  SectionInteractiveBackgroundManager.prototype._tick = function (time) {
    if (!this.running) return;

    var i;
    var instance;

    for (i = 0; i < this.instances.length; i += 1) {
      instance = this.instances[i];
      if (!instance.host.__sectionBgVisible) continue;
      instance._update(time);
      instance._draw();
    }

    this.rafId = global.requestAnimationFrame(this._tick);
  };

  SectionInteractiveBackgroundManager.prototype.mount = function () {
    if (this.running) return this;

    var hosts = this._discoverHosts();
    var self = this;

    hosts.forEach(function (item) {
      var instance = new SectionBgInstance(item.el, item.type, self);
      instance.mount();
      self.instances.push(instance);
    });

    if (!this.instances.length) return this;

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(this._onVisibility, {
        root: null,
        rootMargin: "80px 0px",
        threshold: 0.05
      });
      this.instances.forEach(function (instance) {
        instance.host.__sectionBgVisible = false;
        self.intersectionObserver.observe(instance.host);
      });
    } else {
      this.instances.forEach(function (instance) {
        instance.host.__sectionBgVisible = true;
      });
    }

    global.addEventListener("mousemove", this._onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", this._onMouseLeave);

    this.running = true;
    this.rafId = global.requestAnimationFrame(this._tick);
    return this;
  };

  SectionInteractiveBackgroundManager.prototype.destroy = function () {
    this.running = false;

    if (this.rafId) {
      global.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    global.removeEventListener("mousemove", this._onMouseMove);
    document.documentElement.removeEventListener("mouseleave", this._onMouseLeave);

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    while (this.instances.length) {
      this.instances.pop().destroy();
    }

    return this;
  };

  global.SectionInteractiveBackgroundManager = SectionInteractiveBackgroundManager;
})(typeof window !== "undefined" ? window : this);
