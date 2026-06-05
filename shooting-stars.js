(function (global) {
  "use strict";

  var MAX_STARS = 8;
  var MAX_METEORS = 2;
  var SPAWN_INTERVAL_MS = 1400;
  var METEOR_INTERVAL_MS = 5200;
  var RESIZE_THROTTLE_MS = 120;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function ShootingStarsBackground(host) {
    this.host = host;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.stars = [];
    this.meteors = [];
    this.running = false;
    this.rafId = 0;
    this.lastSpawn = 0;
    this.lastMeteorSpawn = 0;
    this.lastFrame = 0;
    this.visible = true;
    this.resizeTimer = null;
    this._tick = this._tick.bind(this);
    this._onResize = this._handleResize.bind(this);
  }

  ShootingStarsBackground.prototype._createCanvas = function () {
    var canvas = document.createElement("canvas");
    canvas.className = "shooting-stars-background";
    canvas.setAttribute("aria-hidden", "true");
    this.host.classList.add("shooting-stars-host");
    this.host.insertBefore(canvas, this.host.firstChild);
    return canvas;
  };

  ShootingStarsBackground.prototype._setSize = function () {
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

  ShootingStarsBackground.prototype._spawnStar = function () {
    var fromLeft = Math.random() > 0.45;
    var angle = (Math.PI / 180) * (fromLeft ? 22 + Math.random() * 18 : 140 + Math.random() * 18);
    var speed = 280 + Math.random() * 220;
    var x = fromLeft ? -40 - Math.random() * 80 : this.width + 40 + Math.random() * 80;
    var y = Math.random() * this.height * 0.55;

    this.stars.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 115 + Math.random() * 145,
      width: 1.8 + Math.random() * 1.6,
      alpha: 0.38 + Math.random() * 0.32
    });
  };

  ShootingStarsBackground.prototype._spawnMeteor = function () {
    var fromLeft = Math.random() > 0.4;
    var angle = (Math.PI / 180) * (fromLeft ? 26 + Math.random() * 14 : 150 + Math.random() * 14);
    var speed = 380 + Math.random() * 200;
    var x = fromLeft ? -120 - Math.random() * 100 : this.width + 120 + Math.random() * 100;
    var y = Math.random() * this.height * 0.42;

    this.meteors.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 240 + Math.random() * 180,
      coreWidth: 2.8 + Math.random() * 1.4,
      glowWidth: 10 + Math.random() * 8,
      alpha: 0.75 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      shakeAmp: 4 + Math.random() * 5,
      sparks: []
    });
  };

  ShootingStarsBackground.prototype._meteorShake = function (meteor, nx, ny, factor) {
    var perpX = -ny;
    var perpY = nx;
    var p = meteor.phase;
    var amp = meteor.shakeAmp * (factor || 1);
    var wobble =
      Math.sin(p * 16) * amp +
      Math.sin(p * 27.3) * amp * 0.5 +
      Math.sin(p * 41.7) * amp * 0.25;
    var jitter = Math.sin(p * 35) * amp * 0.35;

    return {
      x: perpX * wobble + nx * jitter,
      y: perpY * wobble + ny * jitter
    };
  };

  ShootingStarsBackground.prototype._handleResize = function () {
    var self = this;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () {
      self.resizeTimer = null;
      self._setSize();
    }, RESIZE_THROTTLE_MS);
  };

  ShootingStarsBackground.prototype._isOffscreen = function (body, margin) {
    return (
      body.x < -margin ||
      body.x > this.width + margin ||
      body.y < -margin ||
      body.y > this.height + margin
    );
  };

  ShootingStarsBackground.prototype._update = function (delta, now) {
    var i;
    var j;
    var star;
    var meteor;
    var spark;
    var dt = clamp(delta, 0.008, 0.05);
    var speed;

    if (this.stars.length < MAX_STARS && now - this.lastSpawn > SPAWN_INTERVAL_MS) {
      this._spawnStar();
      this.lastSpawn = now;
      if (Math.random() > 0.55) this._spawnStar();
    }

    if (this.meteors.length < MAX_METEORS && now - this.lastMeteorSpawn > METEOR_INTERVAL_MS) {
      this._spawnMeteor();
      this.lastMeteorSpawn = now;
    }

    for (i = this.stars.length - 1; i >= 0; i -= 1) {
      star = this.stars[i];
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      if (this._isOffscreen(star, star.length + 80)) {
        this.stars.splice(i, 1);
      }
    }

    for (i = this.meteors.length - 1; i >= 0; i -= 1) {
      meteor = this.meteors[i];
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.phase += dt * 18;

      speed = Math.hypot(meteor.vx, meteor.vy);

      if (now - (meteor.lastSparkEmit || 0) > 28) {
        meteor.lastSparkEmit = now;
        var headShake = this._meteorShake(meteor, meteor.vx / speed, meteor.vy / speed, 1);
        meteor.sparks.push({
          x: meteor.x + headShake.x + (Math.random() - 0.5) * 10,
          y: meteor.y + headShake.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 40 - meteor.vx * 0.04,
          vy: (Math.random() - 0.5) * 40 - meteor.vy * 0.04,
          life: 1,
          size: 1 + Math.random() * 2
        });
      }

      for (j = meteor.sparks.length - 1; j >= 0; j -= 1) {
        spark = meteor.sparks[j];
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.life -= dt * 1.8;
        if (spark.life <= 0) meteor.sparks.splice(j, 1);
      }

      if (this._isOffscreen(meteor, meteor.length + 160)) {
        this.meteors.splice(i, 1);
      }
    }
  };

  ShootingStarsBackground.prototype._drawStar = function (ctx, star) {
    var speed = Math.hypot(star.vx, star.vy);
    var tailX = star.x - (star.vx / speed) * star.length;
    var tailY = star.y - (star.vy / speed) * star.length;
    var grad;

    grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
    grad.addColorStop(0, "rgba(167, 139, 250, 0)");
    grad.addColorStop(0.55, "rgba(196, 181, 253, " + (star.alpha * 0.38).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(233, 213, 255, " + star.alpha.toFixed(3) + ")");

    ctx.strokeStyle = grad;
    ctx.lineWidth = star.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(star.x, star.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(245, 243, 255, " + Math.min(star.alpha + 0.18, 0.8).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.width * 1.35, 0, Math.PI * 2);
    ctx.fill();
  };

  ShootingStarsBackground.prototype._drawMeteor = function (ctx, meteor, time) {
    var speed = Math.hypot(meteor.vx, meteor.vy);
    var nx = meteor.vx / speed;
    var ny = meteor.vy / speed;
    var headShake = this._meteorShake(meteor, nx, ny, 1);
    var midShake = this._meteorShake(meteor, nx, ny, 0.55);
    var tailShake = this._meteorShake(meteor, nx, ny, 0.2);
    var headX = meteor.x + headShake.x;
    var headY = meteor.y + headShake.y;
    var midX = meteor.x - nx * meteor.length * 0.45 + midShake.x;
    var midY = meteor.y - ny * meteor.length * 0.45 + midShake.y;
    var tailX = meteor.x - nx * meteor.length + tailShake.x;
    var tailY = meteor.y - ny * meteor.length + tailShake.y;
    var flicker = 0.88 + Math.sin(meteor.phase) * 0.12;
    var alpha = meteor.alpha * flicker;
    var grad;
    var headGlow;
    var i;
    var spark;
    var sparkShake;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
    grad.addColorStop(0, "rgba(99, 102, 241, 0)");
    grad.addColorStop(0.25, "rgba(124, 58, 237, " + (alpha * 0.2).toFixed(3) + ")");
    grad.addColorStop(0.55, "rgba(196, 181, 253, " + (alpha * 0.45).toFixed(3) + ")");
    grad.addColorStop(0.82, "rgba(254, 243, 199, " + (alpha * 0.7).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(255, 255, 255, " + alpha.toFixed(3) + ")");

    ctx.strokeStyle = grad;
    ctx.lineWidth = meteor.glowWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.strokeStyle = grad;
    ctx.lineWidth = meteor.coreWidth;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 22);
    headGlow.addColorStop(0, "rgba(255, 255, 255, " + alpha.toFixed(3) + ")");
    headGlow.addColorStop(0.35, "rgba(253, 224, 171, " + (alpha * 0.75).toFixed(3) + ")");
    headGlow.addColorStop(0.65, "rgba(167, 139, 250, " + (alpha * 0.35).toFixed(3) + ")");
    headGlow.addColorStop(1, "rgba(124, 58, 237, 0)");
    ctx.fillStyle = headGlow;
    ctx.beginPath();
    ctx.arc(headX, headY, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, " + Math.min(alpha + 0.1, 1).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(headX, headY, meteor.coreWidth * 1.6, 0, Math.PI * 2);
    ctx.fill();

    for (i = 0; i < meteor.sparks.length; i += 1) {
      spark = meteor.sparks[i];
      sparkShake = this._meteorShake(meteor, nx, ny, 0.85);
      ctx.fillStyle = "rgba(254, 240, 138, " + (spark.life * 0.65).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(spark.x + sparkShake.x * 0.15, spark.y + sparkShake.y * 0.15, spark.size * spark.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  ShootingStarsBackground.prototype._draw = function (time) {
    var ctx = this.ctx;
    var i;

    ctx.clearRect(0, 0, this.width, this.height);

    for (i = 0; i < this.stars.length; i += 1) {
      this._drawStar(ctx, this.stars[i]);
    }

    for (i = 0; i < this.meteors.length; i += 1) {
      this._drawMeteor(ctx, this.meteors[i], time);
    }
  };

  ShootingStarsBackground.prototype._tick = function (time) {
    if (!this.running) return;
    var delta = this.lastFrame ? (time - this.lastFrame) / 1000 : 0.016;
    this.lastFrame = time;

    if (this.visible) {
      this._update(delta, performance.now());
      this._draw(time);
    }

    this.rafId = global.requestAnimationFrame(this._tick);
  };

  ShootingStarsBackground.prototype.mount = function () {
    if (this.canvas) return this;

    this.canvas = this._createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    if (!this.ctx) return this;

    this._setSize();
    this.lastSpawn = performance.now() - SPAWN_INTERVAL_MS;
    this.lastMeteorSpawn = performance.now() - METEOR_INTERVAL_MS * 0.6;

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

  ShootingStarsBackground.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) global.cancelAnimationFrame(this.rafId);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    else global.removeEventListener("resize", this._onResize);
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.host.classList.remove("shooting-stars-host");
    this.canvas = null;
    this.ctx = null;
    this.stars = [];
    this.meteors = [];
  };

  global.ShootingStarsBackground = ShootingStarsBackground;
})(typeof window !== "undefined" ? window : this);
