(function (global) {
  "use strict";

  var RESIZE_THROTTLE_MS = 100;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function FeaturedSectionInstance(host, manager) {
    this.host = host;
    this.manager = manager;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.blobs = [];
    this.sparks = [];
    this.resizeTimer = null;
    this._onResize = this._handleResize.bind(this);
  }

  FeaturedSectionInstance.prototype._createCanvas = function () {
    var canvas = document.createElement("canvas");
    canvas.className = "featured-section-background";
    canvas.setAttribute("aria-hidden", "true");
    this.host.classList.add("featured-bg-host");
    this.host.insertBefore(canvas, this.host.firstChild);
    return canvas;
  };

  FeaturedSectionInstance.prototype._setSize = function () {
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

  FeaturedSectionInstance.prototype._seed = function () {
    var i;
    this.blobs = [];
    this.sparks = [];

    for (i = 0; i < 6; i += 1) {
      this.blobs.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: 120 + Math.random() * 180,
        hue: 250 + Math.random() * 40,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.45
      });
    }

    for (i = 0; i < 55; i += 1) {
      this.sparks.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.5) * 2.4,
        life: Math.random(),
        trail: []
      });
    }

  };

  FeaturedSectionInstance.prototype._handleResize = function () {
    var self = this;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () {
      self.resizeTimer = null;
      self._setSize();
      self._seed();
    }, RESIZE_THROTTLE_MS);
  };

  FeaturedSectionInstance.prototype._localPointer = function () {
    var pointer = this.manager.pointer;
    if (!pointer.active) return null;
    var rect = this.host.getBoundingClientRect();
    return {
      x: (pointer.x - rect.left) / this.width,
      y: (pointer.y - rect.top) / this.height,
      inside:
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
    };
  };

  FeaturedSectionInstance.prototype._draw = function (time) {
    var ctx = this.ctx;
    var t = time * 0.001;
    var w = this.width;
    var h = this.height;
    var local = this._localPointer();
    var mx = local && local.inside ? local.x * w : w * 0.5;
    var my = local && local.inside ? local.y * h : h * 0.5;
    var i;
    var j;
    var blob;
    var spark;
    var grad;

    ctx.fillStyle = "#08080e";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (i = 0; i < this.blobs.length; i += 1) {
      blob = this.blobs[i];
      blob.x += Math.sin(t * blob.speed + blob.phase) * 1.8;
      blob.y += Math.cos(t * blob.speed * 0.85 + blob.phase) * 1.4;
      blob.x += (mx - blob.x) * 0.0025;
      blob.y += (my - blob.y) * 0.0025;
      blob.x = clamp(blob.x, -blob.r * 0.3, w + blob.r * 0.3);
      blob.y = clamp(blob.y, -blob.r * 0.3, h + blob.r * 0.3);

      grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      grad.addColorStop(0, "hsla(" + blob.hue + ", 75%, 48%, 0.18)");
      grad.addColorStop(0.45, "hsla(" + (blob.hue + 20) + ", 70%, 42%, 0.07)");
      grad.addColorStop(1, "hsla(" + blob.hue + ", 65%, 38%, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (i = 0; i < this.sparks.length; i += 1) {
      spark = this.sparks[i];
      spark.vx += (Math.random() - 0.5) * 0.08;
      spark.vy += (Math.random() - 0.5) * 0.08;
      if (local && local.inside) {
        spark.vx += (mx - spark.x) * 0.00008;
        spark.vy += (my - spark.y) * 0.00008;
      }
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life += 0.02;

      if (spark.x < 0 || spark.x > w || spark.y < 0 || spark.y > h || spark.life > 1) {
        spark.x = Math.random() * w;
        spark.y = Math.random() * h;
        spark.vx = (Math.random() - 0.5) * 2.8;
        spark.vy = (Math.random() - 0.5) * 2.8;
        spark.life = 0;
        spark.trail = [];
      }

      spark.trail.unshift({ x: spark.x, y: spark.y });
      if (spark.trail.length > 6) spark.trail.pop();

      for (j = 1; j < spark.trail.length; j += 1) {
        ctx.strokeStyle = "rgba(167, 139, 250, " + (j / spark.trail.length * 0.14).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(spark.trail[j - 1].x, spark.trail[j - 1].y);
        ctx.lineTo(spark.trail[j].x, spark.trail[j].y);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(196, 181, 253, 0.42)";
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  FeaturedSectionInstance.prototype.draw = function (time) {
    if (!this.ctx) return;
    this._draw(time);
  };

  FeaturedSectionInstance.prototype.mount = function () {
    if (this.canvas) return this;

    this.canvas = this._createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    if (!this.ctx) return this;

    this._setSize();
    this._seed();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this._onResize);
      this.resizeObserver.observe(this.host);
    } else {
      global.addEventListener("resize", this._onResize, { passive: true });
    }

    return this;
  };

  FeaturedSectionInstance.prototype.destroy = function () {
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
    this.host.classList.remove("featured-bg-host");
    this.canvas = null;
    this.ctx = null;
  };

  function FeaturedSectionBackgroundManager() {
    this.instances = [];
    this.pointer = { x: 0, y: 0, active: false };
    this.rafId = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  FeaturedSectionBackgroundManager.prototype._discover = function () {
    return Array.prototype.slice.call(
      document.querySelectorAll(".section-how, .section--alt")
    );
  };

  FeaturedSectionBackgroundManager.prototype._onMouseMove = function (event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.active = true;
  };

  FeaturedSectionBackgroundManager.prototype._onMouseLeave = function () {
    this.pointer.active = false;
  };

  FeaturedSectionBackgroundManager.prototype._onVisibility = function (entries) {
    entries.forEach(function (entry) {
      entry.target.__featuredBgVisible = entry.isIntersecting;
    });
  };

  FeaturedSectionBackgroundManager.prototype._tick = function (time) {
    if (!this.running) return;
    var i;
    var instance;
    for (i = 0; i < this.instances.length; i += 1) {
      instance = this.instances[i];
      if (!instance.host.__featuredBgVisible) continue;
      instance.draw(time);
    }
    this.rafId = global.requestAnimationFrame(this._tick);
  };

  FeaturedSectionBackgroundManager.prototype.mount = function () {
    if (this.running) return this;

    var hosts = this._discover();
    var self = this;

    hosts.forEach(function (host) {
      var instance = new FeaturedSectionInstance(host, self);
      instance.mount();
      self.instances.push(instance);
    });

    if (!this.instances.length) return this;

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(this._onVisibility, {
        root: null,
        rootMargin: "100px 0px",
        threshold: 0.02
      });
      this.instances.forEach(function (instance) {
        instance.host.__featuredBgVisible = false;
        self.intersectionObserver.observe(instance.host);
      });
    } else {
      this.instances.forEach(function (instance) {
        instance.host.__featuredBgVisible = true;
      });
    }

    global.addEventListener("mousemove", this._onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", this._onMouseLeave);

    this.running = true;
    this.rafId = global.requestAnimationFrame(this._tick);
    return this;
  };

  FeaturedSectionBackgroundManager.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) global.cancelAnimationFrame(this.rafId);
    global.removeEventListener("mousemove", this._onMouseMove);
    document.documentElement.removeEventListener("mouseleave", this._onMouseLeave);
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    while (this.instances.length) this.instances.pop().destroy();
    return this;
  };

  global.FeaturedSectionBackgroundManager = FeaturedSectionBackgroundManager;
})(typeof window !== "undefined" ? window : this);
