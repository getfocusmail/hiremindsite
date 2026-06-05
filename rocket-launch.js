(function (global) {
  "use strict";

  var LAUNCH_INTERVAL_MS = 16000;
  var PRE_LAUNCH_MS = 3200;
  var RESIZE_THROTTLE_MS = 120;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function RocketLaunchBackground(host) {
    this.host = host;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.running = false;
    this.rafId = 0;
    this.lastFrame = 0;
    this.visible = true;
    this.resizeTimer = null;
    this.rocket = null;
    this.particles = [];
    this._tick = this._tick.bind(this);
    this._onResize = this._handleResize.bind(this);
  }

  RocketLaunchBackground.prototype._createCanvas = function () {
    var canvas = document.createElement("canvas");
    canvas.className = "rocket-launch-background";
    canvas.setAttribute("aria-hidden", "true");
    this.host.classList.add("rocket-launch-host");
    this.host.insertBefore(canvas, this.host.firstChild);
    return canvas;
  };

  RocketLaunchBackground.prototype._setSize = function () {
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

  RocketLaunchBackground.prototype._computeScale = function () {
    if (this.width < 640) {
      return clamp(this.width / 480, 0.95, 1.35);
    }
    return clamp(this.width / 340, 1.65, 2.75);
  };

  RocketLaunchBackground.prototype._padY = function (scale) {
    return this.height - 24 - 52 * scale;
  };

  RocketLaunchBackground.prototype._padProgress = function (rocket, now) {
    var total = rocket.waitUntil - rocket.padStartedAt;
    if (total <= 0) return 1;
    return clamp((now - rocket.padStartedAt) / total, 0, 1);
  };

  RocketLaunchBackground.prototype._resetRocket = function (delayMs) {
    var scale = this._computeScale();
    var now = performance.now();
    var wait = delayMs != null ? delayMs : PRE_LAUNCH_MS;
    this.rocket = {
      x: this.width * 0.5,
      y: this._padY(scale),
      vx: 0,
      vy: 0,
      scale: scale,
      angle: 0,
      thrust: 0,
      windUp: 0,
      shakeX: 0,
      shakeY: 0,
      state: "pad",
      padStartedAt: now,
      waitUntil: now + wait
    };
    this.particles = [];
  };

  RocketLaunchBackground.prototype._spawnExhaust = function (rocket) {
    var i;
    var baseY = rocket.y + 44 * rocket.scale;
    var spread = 14 * rocket.scale;

    for (i = 0; i < 4; i += 1) {
      this.particles.push({
        type: "exhaust",
        x: rocket.x + (Math.random() - 0.5) * spread,
        y: baseY + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 50,
        vy: 70 + Math.random() * 90,
        life: 0.7 + Math.random() * 0.5,
        size: 2.5 + Math.random() * 5
      });
    }
  };

  RocketLaunchBackground.prototype._spawnPadSmoke = function (x, scale) {
    var i;
    var padY = this.height - 8;
    for (i = 0; i < 22; i += 1) {
      this.particles.push({
        type: "smoke",
        x: x + (Math.random() - 0.5) * 70 * scale,
        y: padY + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 100,
        vy: -30 - Math.random() * 60,
        life: 1 + Math.random() * 0.9,
        size: 10 + Math.random() * 28
      });
    }
  };

  RocketLaunchBackground.prototype._spawnVentSmoke = function (x, scale, progress) {
    this.particles.push({
      type: "smoke",
      x: x + (Math.random() - 0.5) * (50 + progress * 90) * scale,
      y: this.height - 6 + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * (30 + progress * 90),
      vy: -35 - Math.random() * 50 - progress * 70,
      life: 0.5 + Math.random() * 0.5 + progress * 0.5,
      size: (8 + Math.random() * 16) * (0.45 + progress * 0.85)
    });
  };

  RocketLaunchBackground.prototype._spawnIgnitionSpark = function (rocket) {
    var baseY = rocket.y + 46 * rocket.scale;
    this.particles.push({
      type: "spark",
      x: rocket.x + (Math.random() - 0.5) * 18 * rocket.scale,
      y: baseY + (Math.random() - 0.5) * 10 * rocket.scale,
      vx: (Math.random() - 0.5) * 60,
      vy: 40 + Math.random() * 80,
      life: 0.15 + Math.random() * 0.2,
      size: 1 + Math.random() * 2.5
    });
  };

  RocketLaunchBackground.prototype._updateParticles = function (delta) {
    var i;
    var p;

    for (i = this.particles.length - 1; i >= 0; i -= 1) {
      p = this.particles[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.type === "smoke") {
        p.vy -= 20 * delta;
        p.size += delta * 8;
      }
      if (p.type === "spark") {
        p.vy += 120 * delta;
        p.life -= delta * 3.5;
      } else {
        p.life -= delta * (p.type === "smoke" ? 0.9 : 1.6);
      }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  };

  RocketLaunchBackground.prototype._handleResize = function () {
    var self = this;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () {
      self.resizeTimer = null;
      self._setSize();
      if (self.rocket && self.rocket.state === "pad") {
        self.rocket.scale = self._computeScale();
        self.rocket.x = self.width * 0.5;
        self.rocket.y = self._padY(self.rocket.scale);
      }
    }, RESIZE_THROTTLE_MS);
  };

  RocketLaunchBackground.prototype._update = function (delta, now) {
    var rocket = this.rocket;
    var i;
    var p;

    if (!rocket) {
      this._resetRocket(PRE_LAUNCH_MS);
      return;
    }

    if (rocket.state === "cooldown") {
      if (now >= rocket.waitUntil) {
        this._resetRocket(PRE_LAUNCH_MS);
      }
      this._updateParticles(delta);
      return;
    }

    if (rocket.state === "pad") {
      var progress = this._padProgress(rocket, now);
      var intensity = progress * progress;
      var t = now * 0.001;
      var ignitePhase = clamp((progress - 0.5) / 0.5, 0, 1);

      rocket.x = this.width * 0.5;
      rocket.y = this._padY(rocket.scale);
      rocket.windUp = progress;
      rocket.angle = 0;

      rocket.shakeX =
        Math.sin(t * 72) * intensity * 3.2 * rocket.scale +
        Math.sin(t * 131) * intensity * 1.8 * rocket.scale;
      rocket.shakeY =
        Math.cos(t * 88) * intensity * 1.6 * rocket.scale -
        Math.sin(t * 140) * ignitePhase * 2.4 * rocket.scale;

      if (progress > 0.82) {
        rocket.shakeY -= Math.sin(t * 160) * (progress - 0.82) * 14 * rocket.scale;
      }

      if (Math.random() < 0.08 + progress * 0.55) {
        this._spawnVentSmoke(rocket.x, rocket.scale, progress);
      }

      if (ignitePhase > 0) {
        rocket.thrust = ignitePhase * (0.35 + Math.sin(t * 48) * 0.12 + Math.random() * 0.1);
        if (Math.random() > 0.45) {
          this._spawnIgnitionSpark(rocket);
        }
        if (Math.random() > 0.65) {
          this._spawnExhaust(rocket);
        }
      } else {
        rocket.thrust = 0;
      }

      if (now >= rocket.waitUntil) {
        rocket.state = "launching";
        rocket.thrust = 1;
        rocket.vy = -580;
        rocket.vx = 0;
        rocket.shakeX = 0;
        rocket.shakeY = 0;
        rocket.windUp = 1;
        this._spawnPadSmoke(rocket.x, rocket.scale);
        for (i = 0; i < 12; i += 1) {
          this._spawnVentSmoke(rocket.x, rocket.scale, 1);
        }
      }
      this._updateParticles(delta);
      return;
    }

    rocket.shakeX = 0;
    rocket.shakeY = 0;
    rocket.angle = 0;
    rocket.vx = 0;
    rocket.vy -= 32 * delta;
    rocket.y += rocket.vy * delta;

    if (Math.random() > 0.2) {
      this._spawnExhaust(rocket);
    }

    if (rocket.y < -200 * rocket.scale) {
      rocket.state = "cooldown";
      rocket.thrust = 0;
      rocket.waitUntil = now + LAUNCH_INTERVAL_MS;
      this.particles = [];
    }

    this._updateParticles(delta);
  };

  RocketLaunchBackground.prototype._drawLaunchPad = function (ctx, rocket, time) {
    var w = rocket.windUp || 0;
    var pulse = 0.5 + Math.sin(time * (0.004 + w * 0.012)) * 0.5;
    var padR = (48 + w * 42) * rocket.scale;
    var grad = ctx.createRadialGradient(rocket.x, this.height - 6, 0, rocket.x, this.height - 6, padR);
    grad.addColorStop(0, "rgba(253, 224, 171, " + (0.08 + w * 0.22 + pulse * 0.1).toFixed(3) + ")");
    grad.addColorStop(0.35, "rgba(167, 139, 250, " + (0.15 + w * 0.25 + pulse * 0.12).toFixed(3) + ")");
    grad.addColorStop(0.7, "rgba(124, 58, 237, " + (0.06 + w * 0.12).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(124, 58, 237, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(rocket.x, this.height - 8, (38 + w * 22) * rocket.scale, (10 + w * 6) * rocket.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  RocketLaunchBackground.prototype._drawRocket = function (ctx, rocket, time) {
    var s = rocket.scale;
    var thrust = rocket.thrust;
    var isWindUp = rocket.state === "pad" && thrust > 0 && thrust < 1;
    var flamePulse = 0.7 + Math.sin(time * (isWindUp ? 0.055 : 0.018)) * (isWindUp ? 0.45 : 0.3);
    var flameScale = isWindUp ? thrust : 1;
    var flameTip = isWindUp ? 44 + flameScale * 38 + flamePulse * 10 : 98 + flamePulse * 22;
    var grad;
    var finGrad;

    ctx.save();
    ctx.translate(rocket.x + (rocket.shakeX || 0), rocket.y + (rocket.shakeY || 0));
    ctx.scale(s, s);

    if (thrust > 0) {
      grad = ctx.createLinearGradient(0, 38, 0, flameTip + 10);
      grad.addColorStop(0, "rgba(255, 255, 255, " + (0.55 + flameScale * 0.4).toFixed(3) + ")");
      grad.addColorStop(0.15, "rgba(253, 224, 171, " + (0.9 * flamePulse * flameScale).toFixed(3) + ")");
      grad.addColorStop(0.45, "rgba(251, 146, 60, " + (0.75 * flamePulse * flameScale).toFixed(3) + ")");
      grad.addColorStop(0.75, "rgba(167, 139, 250, " + (0.45 * flamePulse * flameScale).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(124, 58, 237, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-14 - flameScale * 2, 44);
      ctx.lineTo(0, flameTip);
      ctx.lineTo(14 + flameScale * 2, 44);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 237, 180, " + (0.35 * flamePulse * flameScale).toFixed(3) + ")";
      ctx.beginPath();
      ctx.ellipse(0, 50, 8 + flameScale * 3, 12 + flameScale * 14 + flamePulse * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    finGrad = ctx.createLinearGradient(-36, 10, -20, 40);
    finGrad.addColorStop(0, "#8b5cf6");
    finGrad.addColorStop(1, "#4c1d95");
    ctx.fillStyle = finGrad;
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.lineTo(-38, 44);
    ctx.lineTo(-18, 36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(38, 44);
    ctx.lineTo(18, 36);
    ctx.closePath();
    ctx.fill();

    grad = ctx.createLinearGradient(-24, -50, 24, 42);
    grad.addColorStop(0, "#f4f4f5");
    grad.addColorStop(0.35, "#d4d4d8");
    grad.addColorStop(0.7, "#a1a1aa");
    grad.addColorStop(1, "#71717a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-24, -10, 48, 58, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    grad = ctx.createLinearGradient(0, -58, 0, -18);
    grad.addColorStop(0, "#ede9fe");
    grad.addColorStop(0.5, "#a78bfa");
    grad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.lineTo(-22, -20);
    ctx.lineTo(22, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 181, 253, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.ellipse(-6, 4, 3, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  RocketLaunchBackground.prototype._drawParticles = function (ctx, type) {
    var i;
    var p;

    for (i = 0; i < this.particles.length; i += 1) {
      p = this.particles[i];
      if (type && p.type !== type) continue;

      if (p.type === "smoke") {
        ctx.fillStyle = "rgba(167, 139, 250, " + (p.life * 0.12).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "spark") {
        ctx.fillStyle = "rgba(255, 251, 235, " + (p.life * 2.2).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(253, 186, 116, " + (p.life * 0.55).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  RocketLaunchBackground.prototype._draw = function (time) {
    var ctx = this.ctx;
    var rocket = this.rocket;

    ctx.clearRect(0, 0, this.width, this.height);
    this._drawParticles(ctx, "smoke");

    if (rocket && (rocket.state === "pad" || rocket.state === "launching")) {
      this._drawLaunchPad(ctx, rocket, time);
      this._drawRocket(ctx, rocket, time);
    }

    this._drawParticles(ctx, "exhaust");
  };

  RocketLaunchBackground.prototype._tick = function (time) {
    if (!this.running) return;
    var delta = this.lastFrame ? clamp((time - this.lastFrame) / 1000, 0.008, 0.05) : 0.016;
    this.lastFrame = time;

    if (this.visible) {
      this._update(delta, performance.now());
      this._draw(time);
    }

    this.rafId = global.requestAnimationFrame(this._tick);
  };

  RocketLaunchBackground.prototype.mount = function () {
    if (this.canvas) return this;

    this.canvas = this._createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    if (!this.ctx) return this;

    if (!this.ctx.roundRect) {
      this.ctx.roundRect = function (x, y, w, h, r) {
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
      };
    }

    this._setSize();
    this._resetRocket(PRE_LAUNCH_MS);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this._onResize);
      this.resizeObserver.observe(this.host);
    } else {
      global.addEventListener("resize", this._onResize, { passive: true });
    }

    if (typeof IntersectionObserver !== "undefined") {
      var self = this;
      this.intersectionObserver = new IntersectionObserver(function (entries) {
        self.visible = entries[0] && entries[0].isIntersecting;
      }, { threshold: 0.05 });
      this.intersectionObserver.observe(this.host);
    }

    this.running = true;
    this.rafId = global.requestAnimationFrame(this._tick);
    return this;
  };

  RocketLaunchBackground.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) global.cancelAnimationFrame(this.rafId);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    else global.removeEventListener("resize", this._onResize);
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.host.classList.remove("rocket-launch-host");
    this.canvas = null;
    this.ctx = null;
    this.rocket = null;
    this.particles = [];
  };

  global.RocketLaunchBackground = RocketLaunchBackground;
})(typeof window !== "undefined" ? window : this);
