(function (global) {
  "use strict";

  var CONNECTION_DIST = 140;
  var MOUSE_RADIUS = 150;
  var MOUSE_FORCE = 0.55;
  var DRIFT_SPEED = 0.22;
  var RETURN_STRENGTH = 0.018;
  var RESIZE_THROTTLE_MS = 120;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function distSq(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }

  function InteractiveBackground(options) {
    this.options = options || {};
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.pointer = { x: -9999, y: -9999, active: false };
    this.rafId = 0;
    this.running = false;
    this.resizeTimer = null;
    this._onResize = this._handleResize.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseLeave = this._handleMouseLeave.bind(this);
    this._tick = this._tick.bind(this);
  }

  InteractiveBackground.prototype._particleCount = function () {
    var area = this.width * this.height;
    return clamp(Math.floor(area / 14000), 48, 110);
  };

  InteractiveBackground.prototype._seedParticles = function () {
    var count = this._particleCount();
    this.particles = [];

    for (var i = 0; i < count; i += 1) {
      var x = Math.random() * this.width;
      var y = Math.random() * this.height;
      var angle = Math.random() * Math.PI * 2;
      var speed = DRIFT_SPEED * (0.35 + Math.random() * 0.65);

      this.particles.push({
        x: x,
        y: y,
        anchorX: x,
        anchorY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2
      });
    }
  };

  InteractiveBackground.prototype._createCanvas = function () {
    var canvas = document.createElement("canvas");
    canvas.className = "interactive-background";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = 0;
    canvas.height = 0;
    document.body.insertBefore(canvas, document.body.firstChild);
    return canvas;
  };

  InteractiveBackground.prototype._setSize = function () {
    if (!this.canvas) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";

    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  };

  InteractiveBackground.prototype._handleResize = function () {
    var self = this;
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(function () {
      self.resizeTimer = null;
      var prevCount = self.particles.length;
      self._setSize();
      if (!prevCount) {
        self._seedParticles();
      } else {
        self.particles.forEach(function (p) {
          p.x = clamp(p.x, 0, self.width);
          p.y = clamp(p.y, 0, self.height);
          p.anchorX = clamp(p.anchorX, 0, self.width);
          p.anchorY = clamp(p.anchorY, 0, self.height);
        });
        if (self._particleCount() !== prevCount) {
          self._seedParticles();
        }
      }
    }, RESIZE_THROTTLE_MS);
  };

  InteractiveBackground.prototype._handleMouseMove = function (event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.active = true;
  };

  InteractiveBackground.prototype._handleMouseLeave = function () {
    this.pointer.active = false;
    this.pointer.x = -9999;
    this.pointer.y = -9999;
  };

  InteractiveBackground.prototype._updateParticles = function (time) {
    var t = time * 0.001;
    var radiusSq = MOUSE_RADIUS * MOUSE_RADIUS;
    var particles = this.particles;
    var i;
    var p;
    var dx;
    var dy;
    var dist;
    var force;

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];

      p.anchorX += Math.sin(t * 0.35 + p.phase) * 0.04;
      p.anchorY += Math.cos(t * 0.28 + p.phase * 1.3) * 0.04;
      p.anchorX = clamp(p.anchorX, 0, this.width);
      p.anchorY = clamp(p.anchorY, 0, this.height);

      p.vx += (p.anchorX - p.x) * RETURN_STRENGTH;
      p.vy += (p.anchorY - p.y) * RETURN_STRENGTH;

      if (this.pointer.active) {
        dx = p.x - this.pointer.x;
        dy = p.y - this.pointer.y;
        dist = distSq(p.x, p.y, this.pointer.x, this.pointer.y);

        if (dist < radiusSq && dist > 0.01) {
          dist = Math.sqrt(dist);
          force = ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) { p.x = 0; p.vx *= -0.5; }
      if (p.x > this.width) { p.x = this.width; p.vx *= -0.5; }
      if (p.y < 0) { p.y = 0; p.vy *= -0.5; }
      if (p.y > this.height) { p.y = this.height; p.vy *= -0.5; }
    }
  };

  InteractiveBackground.prototype._draw = function () {
    var ctx = this.ctx;
    var particles = this.particles;
    var i;
    var j;
    var p;
    var q;
    var d;
    var alpha;
    var connDistSq = CONNECTION_DIST * CONNECTION_DIST;

    ctx.clearRect(0, 0, this.width, this.height);

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      for (j = i + 1; j < particles.length; j += 1) {
        q = particles[j];
        d = distSq(p.x, p.y, q.x, q.y);
        if (d < connDistSq) {
          alpha = (1 - Math.sqrt(d) / CONNECTION_DIST) * 0.22;
          ctx.strokeStyle = "rgba(139, 92, 246, " + alpha.toFixed(3) + ")";
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
      ctx.fillStyle = "rgba(167, 139, 250, 0.75)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  InteractiveBackground.prototype._tick = function (time) {
    if (!this.running) return;
    this._updateParticles(time);
    this._draw();
    this.rafId = global.requestAnimationFrame(this._tick);
  };

  InteractiveBackground.prototype.mount = function () {
    if (this.canvas) return this;

    this.canvas = this._createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    if (!this.ctx) return this;

    this._setSize();
    this._seedParticles();

    window.addEventListener("resize", this._onResize, { passive: true });
    window.addEventListener("mousemove", this._onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", this._onMouseLeave);

    this.running = true;
    this.rafId = global.requestAnimationFrame(this._tick);
    return this;
  };

  InteractiveBackground.prototype.destroy = function () {
    this.running = false;

    if (this.rafId) {
      global.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }

    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("mousemove", this._onMouseMove);
    document.documentElement.removeEventListener("mouseleave", this._onMouseLeave);

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    return this;
  };

  global.InteractiveBackground = InteractiveBackground;
})(typeof window !== "undefined" ? window : this);
