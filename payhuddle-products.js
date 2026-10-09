// ============================================================
// SHARED: PRODUCT MANAGER
// Used on listing and product details
// ============================================================

const ProductManager = {
  getAllProducts() {
    const items = document.querySelectorAll('[fd-product="item"]');
    const products = [];

    items.forEach((el, index) => {
      const p = this.extractProduct(el, index);
      if (p) products.push(p);
    });

    return products;
  },

  extractProduct(el, index) {
    try {
      const nameEl = el.querySelector('[fd-product="name"]');
      const priceEl = el.querySelector('[fd-product="price"]');
      const imageEl = el.querySelector('[fd-product="image"]');

      if (!nameEl || !priceEl) return null;

      const priceText = priceEl.textContent.trim();
      const priceNumeric = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

      const info = this.extractInfo(el);

      const actionAttr = el.getAttribute("fd-filters-action-item");
      const pinnedAttr = el.getAttribute("fd-filters-pinned");

      // forced / pinned logic
      const alwaysVisible = actionAttr === "false" || pinnedAttr === "true";

      if (pinnedAttr === "true") {
        el.classList.add("pinned");
      }

      return {
        id: index,
        name: nameEl.textContent.trim(),
        price: priceText,
        priceNumeric,
        image: imageEl ? imageEl.src : "",
        element: el,
        info,
        alwaysVisible,
        visible: true,
      };
    } catch (err) {
      console.error("Product extract error", err);
      return null;
    }
  },

  extractInfo(scopeEl) {
    const info = {};
    const elements = scopeEl.querySelectorAll("[fd-product-info]");

    elements.forEach((el) => {
      const key = el.getAttribute("fd-product-info");
      if (!key) return;

      // BRAND LIST FIXED
      if (key === "brand") {
        const brands = [];
        const items = el.querySelectorAll('[fd-product-info="brand-name"]');

        items.forEach((bn) => {
          const t = bn.textContent.trim();
          if (t && !brands.includes(t)) brands.push(t);
        });

        info.brand = brands;
        console.log(brands);
        return;
      }

      // SETS NUMBER
      if (key === "sets-num") {
        info["sets-num"] = parseInt(el.textContent.trim(), 10) || 0;
        return;
      }
      if (key === "interface-type") {
        if (!info["interface-type"]) info["interface-type"] = [];
        const t = el.textContent.trim();
        if (t && !info["interface-type"].includes(t)) {
          info["interface-type"].push(t);
        }
        return;
      }

      // ALL OTHER STRINGS
      info[key] = el.textContent.trim();
    });

    if (!Array.isArray(info.brand)) info.brand = info.brand ? [info.brand] : [];
    console.log(info);
    return info;
  },
};

// ============================================================
// SHARED: CART STATE
// Works on all pages
// ============================================================

const CartManager = {
  key: "webflow_shopping_cart",

  getCart() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Cart read error", err);
      return [];
    }
  },

  saveCart(cart) {
    try {
      localStorage.setItem(this.key, JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent("cart-updated"));
    } catch (err) {
      console.error("Cart save error", err);
    }
  },

  addItem(product, qty = 1) {
    const cart = this.getCart();
    const existing = cart.find((i) => i.name === product.name);

    const setsNum = product.info["sets-num"] || "";

    const cardType = Array.isArray(product.info["card-type"])
      ? product.info["card-type"].join(", ")
      : product.info["card-type"] || "";

    const brand = Array.isArray(product.info.brand)
      ? product.info.brand.join(", ")
      : product.info.brand || "";

    // new fields
    const rawInterface = product.info["interface-type"];

    const interfaceType = Array.isArray(rawInterface)
      ? rawInterface.join(", ")
      : rawInterface || "";

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        name: product.name,
        price: product.price,
        priceNumeric: product.priceNumeric,
        image: product.image,
        setsNum,
        cardType,
        brand,
        interfaceType,
        quantity: qty,
        addedAt: Date.now(),
      });
    }

    this.saveCart(cart);
    return cart;
  },

  updateQuantity(name, qty) {
    const cart = this.getCart();
    const item = cart.find((i) => i.name === name);
    if (item) {
      item.quantity = Math.max(1, qty);
      this.saveCart(cart);
    }
    return cart;
  },

  removeItem(name) {
    let cart = this.getCart();
    cart = cart.filter((i) => i.name !== name);
    this.saveCart(cart);
    return cart;
  },

  clear() {
    this.saveCart([]);
  },

  getTotals() {
    const cart = this.getCart();
    const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = cart.reduce((s, i) => s + i.priceNumeric * i.quantity, 0);
    return {
      itemCount,
      subtotal: subtotal.toFixed(2),
    };
  },
};

// ============================================================
// SHARED: CART UI (slide out panel)
// Used wherever .cart-wrap exists
// ============================================================

const CartUI = {
  wrap: null,
  panel: null,
  itemsWrap: null,
  template: null,

  init() {
    this.wrap = document.querySelector(".cart-wrap");
    this.panel = document.querySelector(".cart-content-container");
    this.itemsWrap = document.querySelector('[fd-cart="items-wrap"]');

    if (!this.wrap || !this.panel || !this.itemsWrap) return;

    const temp = this.itemsWrap.querySelector('[fd-cart="item"]');
    if (temp) {
      this.template = temp.cloneNode(true);
      temp.remove();
    }

    gsap.set(this.wrap, { autoAlpha: 0, display: "none" });
    this.bindEvents();
    this.bindNavButtons();
    this.render();

    window.addEventListener("cart-updated", () => this.render());
  },

  bindEvents() {
    const closeBtn = document.querySelector(".cart-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());

    this.wrap.addEventListener("click", (e) => {
      if (e.target === this.wrap) this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) this.close();
    });

    const checkoutBtn = document.querySelector(".checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleCheckout();
      });
    }
  },

  bindNavButtons() {
    document.querySelectorAll(".cart-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.open();
      });
    });
  },

  isOpen() {
    return this.wrap && this.wrap.style.display === "flex";
  },

  open() {
    if (!this.wrap || !this.panel) return;
    if (this.isOpen()) return;

    document.body.style.overflow = "hidden";

    const tl = gsap.timeline();
    tl.set(this.wrap, { display: "flex" })
      .to(this.wrap, { autoAlpha: 1, duration: 0.25, ease: "power2.out" })
      .fromTo(
        this.panel,
        { x: 80, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" },
        0
      );
  },

  close() {
    if (!this.wrap || !this.panel || !this.isOpen()) return;

    const tl = gsap.timeline();
    tl.to(this.panel, {
      x: 80,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    })
      .to(this.wrap, { autoAlpha: 0, duration: 0.2, ease: "power2.in" }, 0.1)
      .set(this.wrap, { display: "none" })
      .add(() => {
        document.body.style.overflow = "";
        window.dispatchEvent(new CustomEvent("cart-updated"));
      });
  },

  render() {
    if (!this.itemsWrap || !this.template) return;

    this.itemsWrap.innerHTML = "";
    const cart = CartManager.getCart();

    if (!cart.length) {
      this.itemsWrap.innerHTML =
        '<div style="padding: 2rem; text-align:center; color:#666;">Your cart is empty</div>';
      this.updateTotals();
      return;
    }

    cart.forEach((item) => {
      const el = this.template.cloneNode(true);
      this.bindItem(el, item);
      this.itemsWrap.appendChild(el);
    });

    this.updateTotals();
  },

  bindItem(el, item) {
    const nameEl = el.querySelector('[fd-cart-field="product-name"]');
    const priceEl = el.querySelector('[fd-cart-field="product-price"]');
    const imgEl = el.querySelector('[fd-cart-field="product-image"]');
    const qtyInput = el.querySelector('[fd-cart="item-qty-field"]');

    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) priceEl.textContent = item.price;
    if (imgEl && item.image) imgEl.src = item.image;
    if (qtyInput) qtyInput.value = item.quantity;

    const setsEl = el.querySelector('[fd-cart-field="sets-num"]');
    const cardTypeEl = el.querySelector('[fd-cart-field="card-type"]');
    const brandEl = el.querySelector('[fd-cart-field="brand"]');
    const regionEl = el.querySelector('[fd-cart-field="region"]');
    const interfaceEl = el.querySelector('[fd-cart-field="interface-type"]');

    if (regionEl) regionEl.textContent = item.region || "";

    if (interfaceEl) {
      interfaceEl.textContent = item.interfaceType || "";
    }

    if (setsEl) setsEl.textContent = item.setsNum || "";
    if (cardTypeEl) cardTypeEl.textContent = item.cardType || "";
    if (brandEl) brandEl.textContent = item.brand || "";

    const removeBtn = el.querySelector('[fd-cart-field="remove-item"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        gsap.to(el, {
          opacity: 0,
          x: -20,
          duration: 0.25,

          onComplete: () => {
            CartManager.removeItem(item.name);
            this.render();
            window.dispatchEvent(new CustomEvent("cart-updated"));
          },
        });
      });
    }

    const minus = el.querySelector(".minus");
    const plus = el.querySelector(".plus");

    if (minus) {
      minus.addEventListener("click", () => {
        const c = CartManager.getCart().find((i) => i.name === item.name);
        const q = c ? c.quantity : 1;
        const n = Math.max(1, q - 1);
        CartManager.updateQuantity(item.name, n);
        if (qtyInput) qtyInput.value = n;
        this.updateTotals();
      });
    }

    if (plus) {
      plus.addEventListener("click", () => {
        const c = CartManager.getCart().find((i) => i.name === item.name);
        const q = c ? c.quantity : 1;
        const n = q + 1;
        CartManager.updateQuantity(item.name, n);
        if (qtyInput) qtyInput.value = n;
        this.updateTotals();
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("change", (e) => {
        const n = parseInt(e.target.value, 10) || 1;
        CartManager.updateQuantity(item.name, n);
        e.target.value = n;
        this.updateTotals();
      });
    }
  },

  updateTotals() {
    const t = CartManager.getTotals();
    document
      .querySelectorAll('[fd-cart-field="items-count"]')
      .forEach((el) => (el.textContent = t.itemCount));

    const subEl = document.querySelector('[fd-cart-field="subtotal"]');
    if (subEl) subEl.textContent = `$${t.subtotal}`;
  },

  handleCheckout() {
    const cart = CartManager.getCart();
    if (!cart.length) {
      alert("Your cart is empty");
      return;
    }
    this.close();
    setTimeout(() => {
      window.location.href = "/submit-test-set-card";
    }, 400);
  },
};

// ============================================================
// LISTING PAGE: ADD TO CART BUTTONS
// Used only where fd-product="item" exists
// ============================================================

const AddToCartButtons = {
  products: [],

  init() {
    this.products = ProductManager.getAllProducts();
    this.syncButtonsWithCart();

    this.products.forEach((product) => {
      const btn = product.element.querySelector(".add-card-btn");
      if (!btn) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.add(product, btn);
      });
    });

    window.addEventListener("cart-updated", () => {
      this.syncButtonsWithCart();
    });
  },

  add(product, btn) {
    const cart = CartManager.getCart();
    const exists = cart.find((i) => i.name === product.name);

    if (exists) {
      CartUI.open();
      return;
    }

    CartManager.addItem(product);

    // FIX: correct event target
    window.dispatchEvent(new CustomEvent("cart-updated"));

    btn.textContent = "Go to Cart";
    btn.classList.add("in-cart");

    gsap
      .timeline()
      .to(btn, { scale: 0.9, duration: 0.1 })
      .to(btn, { scale: 1, duration: 0.2, ease: "elastic.out(1,0.3)" });

    setTimeout(() => CartUI.open(), 200);
  },

  syncButtonsWithCart() {
    const cart = CartManager.getCart();

    this.products.forEach((product) => {
      const btn = product.element.querySelector(".add-card-btn");
      if (!btn) return;

      const exists = cart.find((i) => i.name === product.name);

      if (exists) {
        btn.textContent = "Go to Cart";
        btn.classList.add("in-cart");
      } else {
        btn.textContent = "Add to Cart";
        btn.classList.remove("in-cart");
      }
    });
  },
};

// ============================================================
// FILTER MODAL (UI only, same style as cart)
// ============================================================

const FilterModal = {
  wrap: null,
  panel: null,

  init() {
    this.wrap = document.querySelector(".filters-modal-wrap");
    this.panel = document.querySelector(".filter-content-container");
    if (!this.wrap || !this.panel) return;

    gsap.set(this.wrap, { autoAlpha: 0, display: "none" });
    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll(".filters-trigger").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.open();
      });
    });

    const closeBtn = document.querySelector(".filter-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
      });
    }

    this.wrap.addEventListener("click", (e) => {
      if (e.target === this.wrap) this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) this.close();
    });
  },

  isOpen() {
    return this.wrap && this.wrap.style.display === "flex";
  },

  open() {
    if (this.isOpen()) return;

    document.body.style.overflow = "hidden";

    const tl = gsap.timeline();
    tl.set(this.wrap, { display: "flex" })
      .to(this.wrap, { autoAlpha: 1, duration: 0.25, ease: "power2.out" })
      .fromTo(
        this.panel,
        { x: 80, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" },
        0
      );
  },

  close() {
    if (!this.isOpen()) return;

    const tl = gsap.timeline();
    tl.to(this.panel, {
      x: 80,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    })
      .to(this.wrap, { autoAlpha: 0, duration: 0.2, ease: "power2.in" }, 0.1)
      .set(this.wrap, { display: "none" })
      .add(() => {
        document.body.style.overflow = "";
      });
  },
};

// ============================================================
// LISTING PAGE: FILTER MANAGER
// No realtime filtering
// Applies only on View Items click
// fd-filters-action-item="false" always visible and first
// ============================================================

const FilterManager = {
  products: [],
  forced: [],
  filterable: [],

  selections: {
    search: "",
    region: [],
    brand: [],
    "card-type": [],
    "interface-type": [],
    modes: [],
    "test-focus": [],
    "sets-num": { min: 0, max: 99999 },
  },

  active: null,

  init() {
    const grid = document.querySelector(".product-item-grid");
    if (!grid) return;

    const all = ProductManager.getAllProducts();
    if (!all.length) return;

    this.forced = all.filter((p) => p.alwaysVisible);
    this.filterable = all.filter((p) => !p.alwaysVisible);
    this.products = [...this.forced, ...this.filterable];
    document.querySelectorAll(".w-checkbox-input").forEach((el) => {
      el.classList.remove("w--redirected-checked");
    });

    this.buildFilterLists();
    this.buildFilterLists();
    this.updateIndividualCounts();

    this.bindSelectionEvents();
    this.bindButtons();
    this.updateViewCount();
    this.setupInitialSetsRange();
    this.initializeSlider();

    this.applyFilters();
  },

  buildFilterLists() {
    const sets = {
      region: new Set(),
      brand: new Set(),
      "card-type": new Set(),
      "interface-type": new Set(),
      modes: new Set(),
      "test-focus": new Set(),
    };

    // collect unique filter values
    this.filterable.forEach((p) => {
      const info = p.info;

      if (info.region) sets.region.add(info.region);
      info.brand.forEach((b) => sets.brand.add(b));
      if (info["card-type"]) sets["card-type"].add(info["card-type"]);
      if (info["interface-type"])
        sets["interface-type"].add(info["interface-type"]);
      if (info["test-focus"]) sets["test-focus"].add(info["test-focus"]);

      if (info["mode-online"] === "Yes") sets.modes.add("Online");
      if (info["mode-offline"] === "Yes") sets.modes.add("Offline");
      if (info["mode-online-pin"] === "Yes") sets.modes.add("Online PIN");
    });

    // generate Webflow style checkbox items
    Object.keys(sets).forEach((key) => {
      const container = document.querySelector(
        `[fd-filter-group="${key}"] .filters1_list`
      );
      if (!container) return;

      container.innerHTML = "";

      [...sets[key]].sort().forEach((val, i) => {
        const id = `${key}-${i}`;

        container.insertAdjacentHTML(
          "beforeend",
          `
          <div class="filters1_item">
            <label class="w-checkbox filters1_form-checkbox1">
              <input type="checkbox"
                     name="${id}"
                     id="${id}"
                     data-filter-group="${key}"
                     data-filter-value="${val}"
                     class="w-checkbox-input filters1_form-checkbox1-icon">
              <span class="filters1_form-checkbox1-label w-form-label" for="${id}">${val}</span>
            </label>
            <div class="individual-filter-count">0</div>
          </div>
        `
        );
      });
    });
  },

  updateIndividualCounts() {
    this.filterable.forEach((p) => (p.__visibleCheck = false));

    Object.keys(this.selections).forEach((group) => {
      if (!Array.isArray(this.selections[group])) return;

      document
        .querySelectorAll(`[data-filter-group="${group}"]`)
        .forEach((input) => {
          const value = input.dataset.filterValue;
          let count = 0;

          this.filterable.forEach((p) => {
            if (group === "brand") {
              if (p.info.brand.includes(value)) count++;
            } else if (group === "modes") {
              const hasOnline = p.info["mode-online"] === "Yes";
              const hasOffline = p.info["mode-offline"] === "Yes";
              const hasPin = p.info["mode-online-pin"] === "Yes";

              if (value === "Online" && hasOnline) count++;
              if (value === "Offline" && hasOffline) count++;
              if (value === "Online PIN" && hasPin) count++;
            } else if (Array.isArray(p.info[group])) {
              if (p.info[group].includes(value)) count++;
            } else {
              if (p.info[group] === value) count++;
            }
          });

          const wrap = input.closest(".filters1_item");
          if (wrap) {
            const c = wrap.querySelector(".individual-filter-count");
            if (c) c.textContent = count;
          }
        });
    });
  },

  bindSelectionEvents() {
    document.addEventListener("change", (e) => {
      const target = e.target;
      if (target.matches('input[type="checkbox"][data-filter-group]')) {
        const group = target.dataset.filterGroup;
        const value = target.dataset.filterValue;
        const checked = target.checked;
        const arr = this.selections[group];

        if (checked) {
          if (!arr.includes(value)) arr.push(value);
        } else {
          this.selections[group] = arr.filter((v) => v !== value);
        }

        const icon = target.parentElement.querySelector(".w-checkbox-input");
        if (icon) icon.classList.toggle("w--redirected-checked", checked);

        this.updateViewCount();
      }
    });

    const searchInput = document.querySelector('[fd-filter="search-input"]');
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.selections.search = e.target.value.toLowerCase();
        this.updateViewCount();
      });
    }
  },

  bindButtons() {
    document
      .querySelectorAll('[fd-filter-action="view-items"]')
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.active = JSON.parse(JSON.stringify(this.selections));
          this.applyFilters();
          this.scrollToProducts();
          FilterModal.close();
        });
      });

    document.querySelectorAll('[fd-filter-action="clear"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.clearSelections();
      });
    });
  },
  // Setup slider for sets number
  updateSliderRange(min, max) {
    this.selections["sets-num"].min = min;
    this.selections["sets-num"].max = max;

    const minInput = document.querySelector('[fs-cmsfilter-range="from"]');
    const maxInput = document.querySelector('[fs-cmsfilter-range="to"]');

    if (minInput) minInput.value = min;
    if (maxInput) maxInput.value = max;
  },

  // Initialize slider functionality
  initializeSlider() {
    const wrapper = document.querySelector(
      '[fs-rangeslider-element="wrapper"]'
    );
    if (!wrapper) return;

    const track = wrapper.querySelector('[fs-rangeslider-element="track"]');
    const handleLeft = wrapper.querySelector(
      ".filters1_rangeslider2-handle-left"
    );
    const handleRight = wrapper.querySelector(
      ".filters1_rangeslider2-handle-right"
    );
    const fill = wrapper.querySelector('[fs-rangeslider-element="fill"]');
    const minInput = wrapper.querySelector('[fs-cmsfilter-range="from"]');
    const maxInput = wrapper.querySelector('[fs-cmsfilter-range="to"]');
    const displayValues = wrapper.querySelectorAll(
      '[fs-rangeslider-element="display-value"]'
    );

    if (!track || !handleLeft || !handleRight) return;

    const minVal = parseInt(wrapper.getAttribute("fs-rangeslider-min")) || 0;
    const maxVal = parseInt(wrapper.getAttribute("fs-rangeslider-max")) || 100;

    let currentMin = minVal;
    let currentMax = maxVal;

    const updateSlider = () => {
      const percentMin = ((currentMin - minVal) / (maxVal - minVal)) * 100;
      const percentMax = ((currentMax - minVal) / (maxVal - minVal)) * 100;

      handleLeft.style.left = percentMin + "%";
      handleRight.style.left = percentMax + "%";
      fill.style.left = percentMin + "%";
      fill.style.width = percentMax - percentMin + "%";

      if (displayValues[0]) displayValues[0].textContent = currentMin;
      if (displayValues[1]) displayValues[1].textContent = currentMax;

      if (minInput) minInput.value = currentMin;
      if (maxInput) maxInput.value = currentMax;
    };

    // DRAGGING
    let isDragging = false;
    let currentHandle = null;

    const startDrag = (e, handle) => {
      isDragging = true;
      currentHandle = handle;
      e.preventDefault();
    };

    const drag = (e) => {
      if (!isDragging) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = track.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const value = Math.round(minVal + (percent / 100) * (maxVal - minVal));

      if (currentHandle === handleLeft) {
        currentMin = Math.min(value, currentMax - 1);
      } else {
        currentMax = Math.max(value, currentMin + 1);
      }

      updateSlider();
    };

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;

      // save the new range
      this.selections["sets-num"].min = currentMin;
      this.selections["sets-num"].max = currentMax;

      this.updateViewCount();
    };

    // Mouse events
    handleLeft.addEventListener("mousedown", (e) => startDrag(e, handleLeft));
    handleRight.addEventListener("mousedown", (e) => startDrag(e, handleRight));
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);

    // Touch events
    handleLeft.addEventListener("touchstart", (e) => startDrag(e, handleLeft));
    handleRight.addEventListener("touchstart", (e) =>
      startDrag(e, handleRight)
    );
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("touchend", stopDrag);

    // Manual typing updates
    if (minInput) {
      minInput.addEventListener("input", () => {
        currentMin = Math.max(
          minVal,
          Math.min(parseInt(minInput.value) || minVal, currentMax - 1)
        );
        updateSlider();
        this.updateViewCount();
      });
    }

    if (maxInput) {
      maxInput.addEventListener("input", () => {
        currentMax = Math.min(
          maxVal,
          Math.max(parseInt(maxInput.value) || maxVal, currentMin + 1)
        );
        updateSlider();
        this.updateViewCount();
      });
    }

    updateSlider();
  },

  setupInitialSetsRange() {
    let min = Infinity;
    let max = 0;

    this.filterable.forEach((p) => {
      const s = p.info["sets-num"];
      if (typeof s === "number" && s > 0) {
        min = Math.min(min, s);
        max = Math.max(max, s);
      }
    });

    if (min === Infinity) {
      min = 0;
      max = 0;
    }

    this.selections["sets-num"] = { min, max };

    const fromInput = document.querySelector('[fs-cmsfilter-range="from"]');
    const toInput = document.querySelector('[fs-cmsfilter-range="to"]');

    if (fromInput) fromInput.value = min;
    if (toInput) toInput.value = max;

    [fromInput, toInput].forEach((input, idx) => {
      if (!input) return;
      input.addEventListener("change", () => {
        const n = parseInt(input.value, 10);
        if (idx === 0) this.selections["sets-num"].min = isNaN(n) ? min : n;
        if (idx === 1) this.selections["sets-num"].max = isNaN(n) ? max : n;
        this.updateViewCount();
      });
    });
  },

  updateViewCount() {
    // make a temp selection object
    const filters = this.selections;

    let count = 0;

    this.filterable.forEach((p) => {
      let show = true;
      const info = p.info;

      if (filters.search) {
        const s = filters.search;
        const matchName = p.name.toLowerCase().includes(s);
        const matchInfo = Object.values(info).some((v) => {
          if (Array.isArray(v)) return v.join(" ").toLowerCase().includes(s);
          return String(v).toLowerCase().includes(s);
        });
        if (!matchName && !matchInfo) show = false;
      }

      if (show && filters.region.length)
        show = filters.region.includes(info.region);

      if (show && filters.brand.length)
        show = filters.brand.some((b) => info.brand.includes(b));

      if (show && filters["card-type"].length)
        show = filters["card-type"].includes(info["card-type"]);

      if (show && filters["interface-type"].length)
        show = filters["interface-type"].includes(info["interface-type"]);

      if (show && filters.modes.length) {
        const hasOnline = info["mode-online"] === "Yes";
        const hasOffline = info["mode-offline"] === "Yes";
        const hasPin = info["mode-online-pin"] === "Yes";

        show =
          (filters.modes.includes("Online") && hasOnline) ||
          (filters.modes.includes("Offline") && hasOffline) ||
          (filters.modes.includes("Online PIN") && hasPin);
      }

      if (show && filters["test-focus"].length)
        show = filters["test-focus"].includes(info["test-focus"]);

      if (show && typeof info["sets-num"] === "number") {
        const s = info["sets-num"];
        show = s >= filters["sets-num"].min && s <= filters["sets-num"].max;
      }

      if (show) count++;
    });

    document
      .querySelectorAll('[fd-filter-action="view-items"] span')
      .forEach((span) => (span.textContent = count));
  },

  clearSelections() {
    this.selections = {
      search: "",
      region: [],
      brand: [],
      "card-type": [],
      "interface-type": [],
      modes: [],
      "test-focus": [],
      "sets-num": this.selections["sets-num"],
    };

    document
      .querySelectorAll('input[type="checkbox"][data-filter-group]')
      .forEach((cb) => {
        cb.checked = false;
        const icon = cb.parentElement.querySelector(".w-checkbox-input");
        if (icon) icon.classList.remove("w--redirected-checked");
      });

    const searchInput = document.querySelector('[fd-filter="search-input"]');
    if (searchInput) searchInput.value = "";

    this.updateViewCount();
  },

  applyFilters() {
    const filters = this.active || this.selections;

    // forced items always visible
    this.forced.forEach((p) => {
      p.visible = true;
      p.element.style.display = "";
    });

    this.filterable.forEach((p) => {
      let show = true;
      const info = p.info;

      if (filters.search) {
        const s = filters.search;
        const matchName = p.name.toLowerCase().includes(s);
        const matchInfo = Object.values(info).some((v) => {
          if (Array.isArray(v)) return v.join(" ").toLowerCase().includes(s);
          return String(v).toLowerCase().includes(s);
        });
        if (!matchName && !matchInfo) show = false;
      }

      if (show && filters.region.length)
        show = filters.region.includes(info.region);

      if (show && filters.brand.length) {
        show = filters.brand.some((b) => info.brand.includes(b));
      }

      if (show && filters["card-type"].length)
        show = filters["card-type"].includes(info["card-type"]);

      if (show && filters["interface-type"].length)
        show = filters["interface-type"].includes(info["interface-type"]);

      if (show && filters.modes.length) {
        const hasOnline = info["mode-online"] === "Yes";
        const hasOffline = info["mode-offline"] === "Yes";
        const hasPin = info["mode-online-pin"] === "Yes";

        show =
          (filters.modes.includes("Online") && hasOnline) ||
          (filters.modes.includes("Offline") && hasOffline) ||
          (filters.modes.includes("Online PIN") && hasPin);
      }

      if (show && filters["test-focus"].length)
        show = filters["test-focus"].includes(info["test-focus"]);

      if (show && typeof info["sets-num"] === "number") {
        const s = info["sets-num"];
        show = s >= filters["sets-num"].min && s <= filters["sets-num"].max;
      }

      p.visible = show;
      p.element.style.display = show ? "" : "none";
    });

    this.reorderGrid();
    this.updateResultsCount();
  },

  reorderGrid() {
    const grid = document.querySelector(".product-item-grid");
    if (!grid) return;

    grid.innerHTML = "";

    this.forced.forEach((p) => {
      grid.appendChild(p.element);
    });

    this.filterable.forEach((p) => {
      if (p.visible) grid.appendChild(p.element);
    });
  },

  updateResultsCount() {
    const visible = this.products.filter((p) => p.visible).length;
    const total = this.products.length;

    const res = document.querySelector(
      '[fs-cmsfilter-element="results-count"]'
    );
    const all = document.querySelector('[fs-cmsfilter-element="items-count"]');

    if (res) res.textContent = visible;
    if (all) all.textContent = total;
  },

  scrollToProducts() {
    const grid = document.querySelector(".product-item-grid");
    if (!grid) return;
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  },
};

// ============================================================
// GLOBAL INIT
// Runs on all pages, each module checks its own DOM
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.error("GSAP required for this system");
    return;
  }

  // cart always safe
  CartUI.init();

  // listing page stuff
  AddToCartButtons.init();
  // FilterModal.init();
  // FilterManager.init();

  // product details and checkout init will come in next part
});
// ============================================================
// PRODUCT DETAILS PAGE SYSTEM - COMPLETE CODE
// ============================================================

const ProductDetailsPage = {
  product: null,

  init() {
    const root = document.querySelector(".product-header3_product-details");
    if (!root) return;

    this.readProduct();
    this.setupGallery();
    this.setupQty();
    this.setupAddBtn();
    this.syncBtnState();

    window.addEventListener("cart-updated", () => {
      this.syncBtnState();
    });

    console.log("Product details ready");
  },

  readAllTablesInfo(tables) {
    const info = {};

    tables.forEach((table) => {
      if (!table) return;

      table.querySelectorAll("[fd-product-info]").forEach((el) => {
        const key = el.getAttribute("fd-product-info");
        if (!key) return;

        // BRAND HANDLING - FIXED FOR WEBFLOW DYNAMIC LISTS
        if (key === "brand") {
          if (!info.brand) info.brand = [];

          // First try: Check for brand-name attribute
          const brandNames = el.querySelectorAll(
            '[fd-product-info="brand-name"]'
          );

          if (brandNames.length > 0) {
            brandNames.forEach((b) => {
              const t = b.textContent.trim();
              if (t && !info.brand.includes(t)) info.brand.push(t);
            });
          } else {
            // Second try: Check for list items (Webflow dynamic list)
            const listItems = el.querySelectorAll('[role="listitem"]');

            if (listItems.length > 0) {
              listItems.forEach((item) => {
                const t = item.textContent.trim();
                if (t && !info.brand.includes(t)) info.brand.push(t);
              });
            } else {
              // Fallback: Use element's own text
              const t = el.textContent.trim();
              if (t && !info.brand.includes(t)) info.brand.push(t);
            }
          }

          console.log("Brands found:", info.brand);
          return;
        }

        // SETS NUMBER
        if (key === "sets-num") {
          info["sets-num"] = parseInt(el.textContent.trim(), 10) || 0;
          return;
        }
        if (key === "interface-type") {
          if (!info["interface-type"]) info["interface-type"] = [];
          const t = el.textContent.trim();
          if (t && !info["interface-type"].includes(t)) {
            info["interface-type"].push(t);
          }
          return;
        }

        // OTHER FIELDS
        if (!info[key]) {
          info[key] = el.textContent.trim();
        }
      });
    });

    if (!Array.isArray(info.brand)) {
      info.brand = info.brand ? [info.brand] : [];
    }

    console.log("Product info extracted:", info);
    return info;
  },

  readProduct() {
    const nameEl = document.querySelector(".product-detail-head h1");
    const priceEl = document.querySelector(
      ".product-header3_price-wrapper .heading-style-h3"
    );
    const imgEl = document.querySelector(".product-header3_main-image");

    if (!nameEl || !priceEl) {
      console.error("Product name or price not found");
      return;
    }

    const price = priceEl.textContent.trim();
    const priceNum = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;

    const info = this.readAllTablesInfo([
      document.querySelector(".product-details-table-data"),
      ...document.querySelectorAll(".product-details-table"),
    ]);

    this.product = {
      name: nameEl.textContent.trim(),
      price,
      priceNumeric: priceNum,
      image: imgEl ? imgEl.src : "",
      info,
    };

    console.log("Complete product object:", this.product);
  },

  setupGallery() {
    const main = document.querySelector(".product-header3_main-image");
    const thumbs = document.querySelectorAll(
      ".product-header3_item .product-header3_image"
    );

    if (!main || !thumbs.length) return;

    thumbs.forEach((img) => {
      const item = img.closest(".product-header3_item");
      img.style.cursor = "pointer";

      img.addEventListener("click", () => {
        document
          .querySelectorAll(".product-header3_item.current")
          .forEach((el) => el.classList.remove("current"));

        if (item) item.classList.add("current");

        gsap
          .timeline({ ease: "power2.out" })
          .to(main, { opacity: 0, duration: 0.25 })
          .add(() => {
            main.src = img.src;
            if (img.srcset) main.srcset = img.srcset;
          })
          .to(main, { opacity: 1, duration: 0.25, delay: 0.25 });
      });
    });
  },

  setupQty() {
    const input = document.querySelector('[fd-cart="item-qty-field"]');
    const minus = document.querySelector(".qty-btn:not(.plus)");
    const plus = document.querySelector(".qty-btn.plus");

    if (!input) return;

    input.value = 1;

    minus?.addEventListener("click", () => {
      const v = parseInt(input.value, 10) || 1;
      input.value = Math.max(1, v - 1);
    });

    plus?.addEventListener("click", () => {
      const v = parseInt(input.value, 10) || 1;
      input.value = v + 1;
    });

    input.addEventListener("input", () => {
      input.value = Math.max(1, parseInt(input.value, 10) || 1);
    });
  },

  setupAddBtn() {
    const btn = document.querySelector(".add-to-cart-btn");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this.addToCartAction(btn);
    });
  },

  addToCartAction(btn) {
    if (!this.product) return;

    const qtyInput = document.querySelector('[fd-cart="item-qty-field"]');
    const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

    const cart = CartManager.getCart();
    const exists = cart.find((i) => i.name === this.product.name);

    // if product already in cart, update quantity based on input
    if (exists) {
      CartManager.updateQuantity(this.product.name, qty);

      // dispatch event so CartUI updates
      window.dispatchEvent(new CustomEvent("cart-updated"));

      CartUI.open();
      return;
    }

    // First time add
    CartManager.addItem(this.product, qty);

    btn.classList.add("in-cart");
    btn.textContent = "Go to Cart";

    gsap.fromTo(
      btn,
      { scale: 0.9 },
      { scale: 1, duration: 0.3, ease: "elastic.out(1,0.35)" }
    );

    window.dispatchEvent(new CustomEvent("cart-updated"));

    setTimeout(() => CartUI.open(), 250);
  },
  syncBtnState() {
    const btn = document.querySelector(".add-to-cart-btn");
    if (!btn || !this.product) return;

    const cart = CartManager.getCart();
    const exists = cart.find((i) => i.name === this.product.name);

    if (exists) {
      btn.textContent = "Go to Cart";
      btn.classList.add("in-cart");

      const qtyInput = document.querySelector('[fd-cart="item-qty-field"]');
      if (qtyInput) qtyInput.value = exists.quantity;
    } else {
      btn.textContent = "Add to Cart";
      btn.classList.remove("in-cart");

      const qtyInput = document.querySelector('[fd-cart="item-qty-field"]');
      if (qtyInput) qtyInput.value = 1;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ProductDetailsPage.init();
});

// ====================================================================
// CHECKOUT PAGE SYSTEM
// ====================================================================

const CheckoutPage = {
  init() {
    const root = document.querySelector(".checkout-section");
    if (!root) return;

    this.listWrap = document.querySelector(".checkout-products-items-list");
    this.summaryWrap = document.querySelector(
      ".checkout-products-items-list-copy"
    );
    this.emptyState = document.querySelector('[fd-checkout="empty"]');

    this.template = this.listWrap?.querySelector('[fd-checkout="item"]');
    if (this.template) this.template.remove();

    this.render();
    this.updateSummary();
    this.bindEvents();
    this.observeFormSuccess();

    window.addEventListener("cart-updated", () => {
      this.render();
      this.updateSummary();
    });

    console.log("Checkout ready");
  },

  getCart() {
    return CartManager.getCart();
  },

  bindEvents() {
    const back = document.querySelector(".btn-secondar5y");
    if (back) {
      back.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/merchant-test-cards";
      });
    }
  },

  render() {
    if (!this.listWrap || !this.template) return;

    this.listWrap.innerHTML = "";
    const cart = this.getCart();

    // Empty cart case
    if (!cart.length) {
      if (this.summaryWrap) this.summaryWrap.style.display = "none";

      // If user created a custom empty div
      if (this.emptyState) {
        this.emptyState.style.display = "flex";
      } else {
        // fallback default
        this.listWrap.innerHTML = `
        <div style="padding:3rem;text-align:center;color:#666;">
          <div style="font-size:3rem;">🛒</div>
          <h3>Your cart is empty</h3>
          <a href="/merchant-test-cards" class="button w-button" style="margin-top:1rem;">Browse Products</a>
        </div>
      `;
      }

      return;
    }

    // If cart has items hide custom empty state
    if (this.emptyState) {
      this.emptyState.style.display = "none";
    }

    cart.forEach((item) => {
      const el = this.template.cloneNode(true);

      const img = el.querySelector('[fd-checkout-field="product-image"]');
      if (img) img.src = item.image;

      const name = el.querySelector('[fd-cart-field="product-name"]');
      if (name) name.textContent = item.name;

      const sets = el.querySelector('[fd-checkout-field="sets-num"]');
      if (sets) sets.textContent = item.setsNum || "";

      const type = el.querySelector('[fd-checkout-field="interface-type"]');
      if (type) type.textContent = item.interfaceType || "";

      const brand = el.querySelector('[fd-checkout-field="brand"]');
      if (brand) brand.textContent = item.brand || "";

      const qtyInput = el.querySelector('[fd-checkout-field="item-qty-field"]');
      if (qtyInput) {
        qtyInput.value = item.quantity;
      }

      const price = el.querySelector('[fd-checkout-field="product-price"]');
      if (price) {
        const total = (item.priceNumeric * item.quantity).toFixed(2);
        price.textContent = `$${total}`;
      }

      // Bind quantity controls
      this.bindQuantityControls(el, item, qtyInput, price);

      // Bind remove button
      this.bindRemoveButton(el, item);

      this.listWrap.appendChild(el);
    });

    if (this.summaryWrap) this.summaryWrap.style.display = "block";
  },

  bindQuantityControls(el, item, qtyInput, priceEl) {
    const minus = el.querySelector(".minus");
    const plus = el.querySelector(".plus");

    if (minus) {
      minus.addEventListener("click", () => {
        const currentQty = parseInt(qtyInput.value, 10) || 1;
        const newQty = Math.max(1, currentQty - 1);
        
        CartManager.updateQuantity(item.name, newQty);
        qtyInput.value = newQty;
        
        // Update price display
        if (priceEl) {
          const total = (item.priceNumeric * newQty).toFixed(2);
          priceEl.textContent = `$${total}`;
        }
        
        this.updateSummary();
        window.dispatchEvent(new CustomEvent("cart-updated"));
      });
    }

    if (plus) {
      plus.addEventListener("click", () => {
        const currentQty = parseInt(qtyInput.value, 10) || 1;
        const newQty = currentQty + 1;
        
        CartManager.updateQuantity(item.name, newQty);
        qtyInput.value = newQty;
        
        // Update price display
        if (priceEl) {
          const total = (item.priceNumeric * newQty).toFixed(2);
          priceEl.textContent = `$${total}`;
        }
        
        this.updateSummary();
        window.dispatchEvent(new CustomEvent("cart-updated"));
      });
    }

    // Manual input change
    if (qtyInput) {
      qtyInput.addEventListener("change", (e) => {
        const newQty = Math.max(1, parseInt(e.target.value, 10) || 1);
        
        CartManager.updateQuantity(item.name, newQty);
        e.target.value = newQty;
        
        // Update price display
        if (priceEl) {
          const total = (item.priceNumeric * newQty).toFixed(2);
          priceEl.textContent = `$${total}`;
        }
        
        this.updateSummary();
        window.dispatchEvent(new CustomEvent("cart-updated"));
      });
    }
  },

  bindRemoveButton(el, item) {
    const removeBtn = el.querySelector('[fd-checkout-field="remove-item"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        // Animate out
        gsap.to(el, {
          opacity: 0,
          x: -20,
          duration: 0.25,
          onComplete: () => {
            CartManager.removeItem(item.name);
            this.render();
            this.updateSummary();
            window.dispatchEvent(new CustomEvent("cart-updated"));
          },
        });
      });
    }
  },

observeFormSuccess() {
  const successEl = document.querySelector(".checkout-right-wrap .w-form-done");
  const form = document.querySelector(".checkout-right-wrap");
  
  if (!successEl && !form) {
    console.warn("Neither success element nor form found - cart clear won't work");
    console.warn(successEl, form);
    return;
  }

  const clearCartNow = () => {
    console.log("Clearing cart after successful submission");
    CartManager.clear();
    window.dispatchEvent(new CustomEvent("cart-updated"));
  };

  // Method 1: Watch success element
  if (successEl) {
    const observer = new MutationObserver(() => {
      const display = window.getComputedStyle(successEl).display;
      if (display === "block" || display === "flex") {
        console.log("Success message visible - clearing cart");
        clearCartNow();
        observer.disconnect(); // Stop observing after clearing
      } 
    });

    observer.observe(successEl, {
      attributes: true,
      attributeFilter: ["style"],
    });
    console.log("MutationObserver attached to success element");
  } else {console.warn("MutationObserver not attached to success element")}

  // Method 2: Intercept form submission
  if (form) {
    form.addEventListener("submit", (e) => {
      console.log("Form submitted, waiting for success...");
      
      // Check multiple times to catch the success state
      const checkInterval = setInterval(() => {
        if (successEl) {
          const display = window.getComputedStyle(successEl).display;
          if (display === "block" || display === "flex") {
            console.log("Success detected via interval");
            clearCartNow();
            clearInterval(checkInterval);
          }
        }
      }, 100);

      // Stop checking after 5 seconds
      setTimeout(() => clearInterval(checkInterval), 5000);
    });
  } else {console.warn("Form not submitted")}
},

  updateSummary() {
    const cart = this.getCart();

    const subtotal = cart.reduce((s, i) => s + i.priceNumeric * i.quantity, 0);
    const taxRate = 0.1415;
    const taxes = subtotal * taxRate;
    const total = subtotal + taxes;

    const subEl = document.querySelector('[fd-checkout="subtotal"]');
    if (subEl) subEl.textContent = `$${subtotal.toFixed(2)}`;

    const taxEl = document.querySelector('[fd-checkout="taxes"]');
    if (taxEl) taxEl.textContent = `$${taxes.toFixed(2)}`;

    const totalEl = document.querySelector('[fd-checkout="total"]');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    // ========== Fill Hidden Product Details Textarea ==========
    const textarea = document.querySelector("#Checkout-Form-Product-Details");
    if (textarea) {
      let text = "";

      cart.forEach((item) => {
        const line = `
  Product: ${item.name}
  Quantity: ${item.quantity}
  Sets In Each: ${item.setsNum || ""}
  Brand: ${item.brand || ""}
  Interface Type: ${item.interfaceType || ""}
  
  ------------------------------
  `;
        text += line;
      });

      /* Future totals (commented)
      text += `
  Subtotal: $${subtotal.toFixed(2)}
  Taxes: $${taxes.toFixed(2)}
  Grand Total: $${total.toFixed(2)}
  `;
      */

      textarea.value = text.trim();
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  CheckoutPage.init();
});

// ====================================================================
// TEST CARDS TABLE GENERATOR
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".test-cards-table");
  if (!container) return;

  const rows = Array.from(container.querySelectorAll("p")).map((p) =>
    p.textContent
      .replace(/\u00A0/g, " ") // fix unicode spaces
      .replace(/\s+/g, " ") // collapse spaces
      .trim()
  );

  const table = document.createElement("table");
  table.className = "generated-test-cards-table product-details-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th class="product-table-item is-title">Card Name</th>
        <th class="product-table-item is-title">Scheme</th>
        <th class="product-table-item is-title">Interface</th>
        <th class="product-table-item is-title">CVM</th>
        <th class="product-table-item is-title">Masked PAN</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  rows.forEach((row) => {
    // CLEAN "null" properly:
    row = row.replace(/null/gi, "");

    let parts = row.split(" - ").map((x) => x.trim());

    // always force exactly 5 columns
    while (parts.length < 5) parts.push("");

    if (parts.length > 5) {
      const pan = parts.slice(4).join(" ");
      parts = parts.slice(0, 4);
      parts.push(pan.trim());
    }

    const [cardName, scheme, interfaceType, cvm, maskedPan] = parts;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="product-table-item">${cardName}</td>
      <td class="product-table-item">${scheme}</td>
      <td class="product-table-item">${interfaceType}</td>
      <td class="product-table-item">${cvm}</td>
      <td class="product-table-item">${maskedPan}</td>
    `;
    tbody.appendChild(tr);
  });

  container.innerHTML = "";
  container.appendChild(table);
});
