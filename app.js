// 🔗 Replace this with your actual Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbwBT4wcGqFon1o91it64zBptNLwdk8mDOxmXSUCP4ok-yTKZJnIdWUbyICC6J1_sjxJWQ/exec";

// In-memory state
let catalog = [];
let filteredCatalog = [];
let favorites = new Set();
let selectedTypes = new Set();
let currentPriceItem = null;
let currentEditItem = null;

// DOM elements
const productListEl = document.getElementById("productList");
const searchInputEl = document.getElementById("searchInput");
const typeFilterEl = document.getElementById("typeFilter");
const inStockOnlyEl = document.getElementById("inStockOnly");
const favoritesOnlyEl = document.getElementById("favoritesOnly");
const messageBarEl = document.getElementById("messageBar");
const viewListBtn = document.getElementById("viewListBtn");
const imageModalEl = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalCaption = document.getElementById("imageModalCaption");
const imageModalCloseBtn = document.getElementById("imageModalClose");

// Modals
const priceModalEl = document.getElementById("priceModal");
const priceFormEl = document.getElementById("priceForm");
const priceRestaurantNameEl = document.getElementById("priceRestaurantName");
const priceContactNameEl = document.getElementById("priceContactName");
const priceContactPhoneEl = document.getElementById("priceContactPhone");
const priceContactEmailEl = document.getElementById("priceContactEmail");
const priceNotesEl = document.getElementById("priceNotes");
const priceModalProductNameEl = document.getElementById("priceModalProductName");
const priceModalSkuEl = document.getElementById("priceModalSku");
const priceModalItemIdEl = document.getElementById("priceModalItemId");

const listModalEl = document.getElementById("listModal");
const listFormEl = document.getElementById("listForm");
const listNameEl = document.getElementById("listName");
const listRestaurantNameEl = document.getElementById("listRestaurantName");
const listContactNameEl = document.getElementById("listContactName");
const listContactPhoneEl = document.getElementById("listContactPhone");
const listContactEmailEl = document.getElementById("listContactEmail");
const listItemsContainerEl = document.getElementById("listItemsContainer");

const editModalEl = document.getElementById("editModal");
const editFormEl = document.getElementById("editForm");
const editReasonEl = document.getElementById("editReason");
const editModalProductNameEl = document.getElementById("editModalProductName");
const editModalSkuEl = document.getElementById("editModalSku");
const editModalItemIdEl = document.getElementById("editModalItemId");

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadFavoritesFromStorage();
  attachEventListeners();
  fetchCatalog();
});

function attachEventListeners() {
  searchInputEl.addEventListener("input", () => applyFiltersAndRender());
  inStockOnlyEl.addEventListener("change", () => applyFiltersAndRender());
  favoritesOnlyEl.addEventListener("change", () => applyFiltersAndRender());
  viewListBtn.addEventListener("click", openListModal);

  // Close modal buttons
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close-modal");
      closeModalById(targetId);
    });
  });

  // Submit handlers
  priceFormEl.addEventListener("submit", (e) => { e.preventDefault(); submitPriceRequest(); });
  listFormEl.addEventListener("submit", (e) => { e.preventDefault(); submitSaveList(); });
  editFormEl.addEventListener("submit", (e) => { e.preventDefault(); submitEditRequest(); });

  // PRODUCT LIST CLICK (DELEGATION)
  productListEl.addEventListener("click", (e) => {
    const cardEl = e.target.closest(".product-card");
    if (!cardEl) return;

    const itemId = cardEl.getAttribute("data-item-id");
    const item = catalog.find((p) => String(p.itemId) === String(itemId));
    if (!item) return;

    // Image click → open full image
    const imgEl = e.target.closest(".product-img-clickable");
    if (imgEl && imgEl.dataset.fullUrl) {
      window.open(imgEl.dataset.fullUrl, "_blank");
      return;
    }

    if (e.target.closest(".favorite-btn")) {
      toggleFavorite(item.itemId);
      renderCatalog();
      return;
    }

    if (e.target.closest(".ask-price-btn")) {
      openPriceModal(item);
      return;
    }

    if (e.target.closest(".edit-request-btn")) {
      openEditModal(item);
      return;
    }

    if (e.target.closest(".add-to-list-btn")) {
      addToFavoritesFromCard(item);
      return;
    }
  });
} // END attachEventListeners

/* Fetch catalog */

async function fetchCatalog() {
  try {
    setMessage("Loading catalog...", "info", 0);
    productListEl.innerHTML = `
      <div class="empty-state">
        <div class="spinner"></div>
        <p>Loading catalog...</p>
      </div>
    `;
    const url = API_URL + "?action=catalog";
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "API error");
    }
    catalog = data.data || [];
    buildTypeFilterChips();
    applyFiltersAndRender();
    setMessage("Catalog loaded.", "info", 1500);
  } catch (err) {
    console.error(err);
    productListEl.innerHTML = `
      <div class="empty-state">
        <p>Could not load catalog. Please try again later.</p>
      </div>
    `;
    setMessage("Error loading catalog: " + err.message, "error", 6000);
  }
}

/* Filters */

function buildTypeFilterChips() {
  const typeSet = new Set();
  catalog.forEach((item) => {
    (item.types || []).forEach((t) => typeSet.add(t));
  });

  typeFilterEl.innerHTML = "";
  Array.from(typeSet)
    .sort((a, b) => a.localeCompare(b))
    .forEach((type) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "type-chip";
      chip.dataset.type = type;
      chip.innerHTML = `<span class="dot"></span>${type}`;
      chip.addEventListener("click", () => {
        if (selectedTypes.has(type)) {
          selectedTypes.delete(type);
        } else {
          selectedTypes.add(type);
        }
        chip.classList.toggle("active", selectedTypes.has(type));
        applyFiltersAndRender();
      });
      typeFilterEl.appendChild(chip);
    });
}

function applyFiltersAndRender() {
  const search = (searchInputEl.value || "").toLowerCase().trim();
  const inStockOnly = inStockOnlyEl.checked;
  const favoritesOnly = favoritesOnlyEl.checked;

  filteredCatalog = catalog.filter((item) => {
    // Search filter (now includes description)
    if (search) {
     const haystack = [
      item.productName,
      item.description,
      item.supplier,    // ✅ new line
      item.sku,
      item.dimension,
      item.volume,
      item.type,
      item.memo,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    // Type filter (multi-select)
    if (selectedTypes.size > 0) {
      const itemTypes = new Set(item.types || []);
      let hasMatch = false;
      selectedTypes.forEach((t) => {
        if (itemTypes.has(t)) hasMatch = true;
      });
      if (!hasMatch) return false;
    }

    // In stock
    if (inStockOnly) {
      const stockVal = Number(item.stock || 0);
      if (!(stockVal > 0)) return false;
    }

    // Favorites only
    if (favoritesOnly) {
      if (!favorites.has(String(item.itemId))) return false;
    }

    return true;
  });

  renderCatalog();
}

/* Render */

function renderCatalog() {
  if (!filteredCatalog.length) {
    productListEl.innerHTML = `
      <div class="empty-state">
        <p>No products match your filters.</p>
      </div>
    `;
    return;
  }

  const html = filteredCatalog
    .map((item) => {
      const isFav = favorites.has(String(item.itemId));
      const stockLabel =
        item.stock === "" || item.stock === null || item.stock === undefined
          ? "N/A"
          : item.stock;

      const typesHtml = (item.types || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");

      const descShort = (item.description || "").slice(0, 120);
      const desc =
        item.description && item.description.length > 120
          ? descShort + "…"
          : descShort;

      const imageHtml = item.pictureUrl
        ? `<img
             src="${escapeHtml(item.pictureUrl)}"
             alt="${escapeHtml(item.productName || "")}"
             class="product-img-clickable"
             data-full-url="${escapeHtml(item.pictureUrl)}"
           />`
        : `<div class="product-thumb-fallback">📦</div>`;

      return `
        <article class="product-card" data-item-id="${escapeHtml(
          String(item.itemId)
        )}">
          <div class="product-thumb">
            ${imageHtml}
          </div>
          <div class="product-main">
            <div>
              <div class="product-header">
                <div>
                  <h2 class="product-title">${escapeHtml(
                    item.productName || ""
                  )}</h2>
                  <p class="product-subtitle">${escapeHtml(desc)}</p>
                </div>
                <button type="button" class="favorite-btn ${
                  isFav ? "active" : ""
                }">
                  <span>${isFav ? "♥" : "♡"}</span>
                </button>
              </div>
              <div class="product-meta">
                <span class="meta-item">
                  <span class="meta-label">SKU:</span>
                  <span>${escapeHtml(item.sku || "-")}</span>
                </span>
                <span class="meta-item">
                  <span class="meta-label">Units/Box:</span>
                  <span>${escapeHtml(
                    item.unitsPerBox == null ? "-" : String(item.unitsPerBox)
                  )}</span>
                </span>
                <span class="meta-item">
                  <span class="meta-label">Stock:</span>
                  <span>${escapeHtml(String(stockLabel))}</span>
                </span>
                ${
                  item.dimension
                    ? `<span class="meta-item"><span class="meta-label">Dim:</span><span>${escapeHtml(
                        item.dimension
                      )}</span></span>`
                    : ""
                }
                ${
                  item.volume
                    ? `<span class="meta-item"><span class="meta-label">Vol:</span><span>${escapeHtml(
                        item.volume
                      )}</span></span>`
                    : ""
                }
              </div>
              ${
                typesHtml
                  ? `<div class="product-tags">${typesHtml}</div>`
                  : ""
              }
            </div>
            <div class="product-actions">
              <button type="button" class="btn btn-primary ask-price-btn">
                Ask for price
              </button>
              <button type="button" class="btn btn-ghost add-to-list-btn">
                Add to favorites
              </button>
              <button type="button" class="btn btn-ghost edit-request-btn">
                Request edit
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  productListEl.innerHTML = html;
}

// Product list click handlers (event delegation)
productListEl.addEventListener("click", (e) => {
  const cardEl = e.target.closest(".product-card");
  if (!cardEl) return;

  const itemId = cardEl.getAttribute("data-item-id");
  const item = catalog.find((p) => String(p.itemId) === String(itemId));
  if (!item) return;

  // Click on product image → open full-size in new tab
  const imgEl = e.target.closest(".product-img-clickable");
  if (imgEl && imgEl.dataset.fullUrl) {
    window.open(imgEl.dataset.fullUrl, "_blank");
    return;
  }

  if (e.target.closest(".favorite-btn")) {
    toggleFavorite(item.itemId);
    renderCatalog();
    return;
  }

  if (e.target.closest(".ask-price-btn")) {
    openPriceModal(item);
    return;
  }

  if (e.target.closest(".edit-request-btn")) {
    openEditModal(item);
    return;
  }

  if (e.target.closest(".add-to-list-btn")) {
    addToFavoritesFromCard(item);
    return;
  }
});

/* Favorites */

function loadFavoritesFromStorage() {
  try {
    const raw = localStorage.getItem("d2dFavorites");
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      favorites = new Set(arr.map((v) => String(v)));
    }
  } catch (err) {
    console.warn("Could not load favorites from storage:", err);
  }
}

function saveFavoritesToStorage() {
  const arr = Array.from(favorites);
  localStorage.setItem("d2dFavorites", JSON.stringify(arr));
}

function toggleFavorite(itemId) {
  const idStr = String(itemId);
  if (favorites.has(idStr)) {
    favorites.delete(idStr);
    setMessage("Removed from favorites.", "info", 1500);
  } else {
    favorites.add(idStr);
    setMessage("Added to favorites.", "info", 1500);
  }
  saveFavoritesToStorage();
}

function addToFavoritesFromCard(item) {
  toggleFavorite(item.itemId);
  renderCatalog();
}

/* Modals */

function openImageModal(url, caption) {
  if (!url) return;
  imageModalImg.src = url;
  imageModalCaption.textContent = caption || "";
  imageModalEl.classList.remove("hidden");
}

function closeImageModal() {
  imageModalEl.classList.add("hidden");
  imageModalImg.src = "";
}

if (imageModalCloseBtn) {
  imageModalCloseBtn.addEventListener("click", closeImageModal);
}
if (imageModalEl) {
  imageModalEl.addEventListener("click", (e) => {
    if (e.target === imageModalEl || e.target.classList.contains("modal-backdrop")) {
      closeImageModal();
    }
  });
}

function openModal(el) {
  el.classList.remove("hidden");
}

function closeModal(el) {
  el.classList.add("hidden");
}

function closeModalById(id) {
  const el = document.getElementById(id);
  if (el) {
    closeModal(el);
  }
}

/* Price Modal */

function openPriceModal(item) {
  currentPriceItem = item;
  priceModalProductNameEl.textContent = item.productName || "";
  priceModalSkuEl.textContent = item.sku ? `SKU: ${item.sku}` : "";
  priceModalItemIdEl.textContent = `Item ID: ${item.itemId}`;

  // Clear form
  priceRestaurantNameEl.value = "";
  priceContactNameEl.value = "";
  priceContactPhoneEl.value = "";
  priceContactEmailEl.value = "";
  priceNotesEl.value = "";

  openModal(priceModalEl);
}

async function submitPriceRequest() {
  if (!currentPriceItem) return;

  const restaurantName = priceRestaurantNameEl.value.trim();
  const contactName = priceContactNameEl.value.trim();
  const contactPhone = priceContactPhoneEl.value.trim();
  const contactEmail = priceContactEmailEl.value.trim();
  const notes = priceNotesEl.value.trim();

  if (!restaurantName) {
    setMessage("Restaurant name is required.", "error", 4000);
    return;
  }
  if (!contactPhone && !contactEmail) {
    setMessage("Phone or email is required.", "error", 4000);
    return;
  }

  const payload = {
    action: "priceRequest",
    itemId: String(currentPriceItem.itemId),
    sku: currentPriceItem.sku || "",
    productName: currentPriceItem.productName || "",
    restaurantName,
    contactName,
    contactPhone,
    contactEmail,
    notes,
  };

  try {
    setMessage("Sending price request...", "info", 0);
    await fetch(API_URL, {
  method: "POST",
  mode: "no-cors",
  headers: {
    "Content-Type": "text/plain;charset=utf-8",
  },
  body: JSON.stringify(payload),
});

// We can’t read the response in no-cors mode, but Apps Script will run.
setMessage("Price request sent. David will contact you soon.", "info", 5000);
    closeModal(priceModalEl);
  } catch (err) {
    console.error(err);
    setMessage("Failed to send price request: " + err.message, "error", 6000);
  }
}

/* List Modal */

function openListModal() {
  // Build the list of favorite items
  const favItems = catalog.filter((item) =>
    favorites.has(String(item.itemId))
  );

  if (!favItems.length) {
    setMessage("You have no favorites yet. Add some items first.", "info", 4000);
    return;
  }

  // Pre-fill list name with first restaurant name if previously used, or empty
  listNameEl.value = "";
  listRestaurantNameEl.value = "";
  listContactNameEl.value = "";
  listContactPhoneEl.value = "";
  listContactEmailEl.value = "";

  listItemsContainerEl.innerHTML = favItems
    .map((item) => {
      return `
        <div class="list-item-row" data-item-id="${escapeHtml(
          String(item.itemId)
        )}">
          <div class="list-item-title">
            <strong>${escapeHtml(item.productName || "")}</strong>
            <span style="color:#9aa1b6;font-size:0.78rem;">${
              item.sku ? " • " + escapeHtml(item.sku) : ""
            }</span>
          </div>
          <div class="list-item-qty">
            <input type="number" min="1" value="1" />
          </div>
        </div>
      `;
    })
    .join("");

  openModal(listModalEl);
}

async function submitSaveList() {
  const listName = listNameEl.value.trim();
  const restaurantName = listRestaurantNameEl.value.trim();
  const contactName = listContactNameEl.value.trim();
  const contactPhone = listContactPhoneEl.value.trim();
  const contactEmail = listContactEmailEl.value.trim();

  if (!listName) {
    setMessage("List name is required.", "error", 4000);
    return;
  }
  if (!restaurantName) {
    setMessage("Restaurant name is required.", "error", 4000);
    return;
  }
  if (!contactPhone && !contactEmail) {
    setMessage("Phone or email is required.", "error", 4000);
    return;
  }

  const rows = Array.from(
    listItemsContainerEl.querySelectorAll(".list-item-row")
  );
  const items = [];
  rows.forEach((row) => {
    const itemId = row.getAttribute("data-item-id");
    const item = catalog.find((p) => String(p.itemId) === String(itemId));
    if (!item) return;
    const qtyInput = row.querySelector("input[type='number']");
    let quantity = Number(qtyInput.value || 1);
    if (!(quantity > 0)) quantity = 1;
    items.push({
      itemId: String(item.itemId),
      sku: item.sku || "",
      productName: item.productName || "",
      quantity,
    });
  });

  if (!items.length) {
    setMessage("No items in the list.", "error", 4000);
    return;
  }

  const payload = {
    action: "saveList",
    listName,
    restaurantName,
    contactName,
    contactPhone,
    contactEmail,
    items,
  };

  try {
    setMessage("Saving list...", "info", 0);
    await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  
  setMessage(
    "List saved and sent. David will review it shortly.",
    "info",
    5000
  );
  closeModal(listModalEl);
    } catch (err) {
      console.error(err);
      setMessage("Failed to save list: " + err.message, "error", 6000);
    }
  }

/* Edit Modal */

function openEditModal(item) {
  currentEditItem = item;
  editModalProductNameEl.textContent = item.productName || "";
  editModalSkuEl.textContent = item.sku ? `SKU: ${item.sku}` : "";
  editModalItemIdEl.textContent = `Item ID: ${item.itemId}`;
  editReasonEl.value = "";
  openModal(editModalEl);
}

async function submitEditRequest() {
  if (!currentEditItem) return;
  const reason = editReasonEl.value.trim();

  const payload = {
    action: "editRequest",
    itemId: String(currentEditItem.itemId),
    sku: currentEditItem.sku || "",
    productName: currentEditItem.productName || "",
    reason,
  };

  try {
    setMessage("Sending edit request...", "info", 0);
   await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  
  setMessage(
    "Edit request submitted. David will review this item.",
    "info",
    5000
  );
  closeModal(editModalEl);
  } catch (err) {
    console.error(err);
    setMessage("Failed to submit edit request: " + err.message, "error", 6000);
  }
}

/* Utils */

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMessage(text, type = "info", timeout = 3000) {
  if (!messageBarEl) return;

  messageBarEl.textContent = text || "";
  messageBarEl.className = "message-bar " + type; // type = info / error / success
  messageBarEl.classList.remove("hidden");

  if (timeout > 0) {
    setTimeout(() => {
      messageBarEl.classList.add("hidden");
    }, timeout);
  }
}

// Secret admin shortcut: press SHIFT + 6 ( ^ )
document.addEventListener('keydown', function(e) {
  // We only want plain Shift (no Ctrl/Cmd/Alt)
  if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const key = e.key;   // usually '6' or '^' when Shift+6 is pressed
  const isSix = (key === '6' || key === '^');

  if (isSix) {
    window.location.href =
      'https://script.google.com/a/macros/drop2drop.com/s/AKfycbwBT4wcGqFon1o91it64zBptNLwdk8mDOxmXSUCP4ok-yTKZJnIdWUbyICC6J1_sjxJWQ/exec?action=adminUI';
  }
});
