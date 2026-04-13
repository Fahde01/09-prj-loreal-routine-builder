/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectedBtn = document.getElementById("clearSelected");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const productModal = document.getElementById("productModal");
const modalProductBrand = document.getElementById("modalProductBrand");
const modalProductTitle = document.getElementById("modalProductTitle");
const modalProductDescription = document.getElementById(
  "modalProductDescription",
);
const closeProductModalBtn = document.getElementById("closeProductModal");
const workerUrl = "https://bot-worker.ayofadeni.workers.dev/";

/* Keep product data and selected products in memory */
let allProducts = [];
let currentCategoryProducts = [];
const selectedProducts = [];
const chatHistory = [];
let routineGenerated = false;
const SELECTED_PRODUCTS_STORAGE_KEY = "selectedProductIds";

const ALLOWED_FOLLOW_UP_TOPICS = [
  "routine",
  "skin",
  "skincare",
  "cleanser",
  "serum",
  "moisturizer",
  "sunscreen",
  "spf",
  "acne",
  "hair",
  "haircare",
  "shampoo",
  "conditioner",
  "scalp",
  "makeup",
  "foundation",
  "concealer",
  "lip",
  "fragrance",
  "perfume",
  "scent",
  "beauty",
  "product",
  "products",
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentCategoryProducts = products;

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found in this category
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${isProductSelected(product.id) ? "selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="view-details-btn" data-product-id="${product.id}">
          View details
        </button>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Open the modal and show product details */
function openProductModal(productId) {
  const product = allProducts.find((item) => item.id === productId);

  if (!product || !productModal) {
    return;
  }

  modalProductBrand.textContent = product.brand;
  modalProductTitle.textContent = product.name;
  modalProductDescription.textContent = product.description;
  productModal.hidden = false;
  document.body.classList.add("modal-open");
  closeProductModalBtn.focus();
}

/* Close the modal */
function closeProductModal() {
  if (!productModal) {
    return;
  }

  productModal.hidden = true;
  document.body.classList.remove("modal-open");
}

/* Check if product is already in selectedProducts */
function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Add or remove a product from selectedProducts */
function toggleProductSelection(productId) {
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (selectedIndex === -1) {
    const productToAdd = allProducts.find(
      (product) => product.id === productId,
    );
    if (productToAdd) {
      selectedProducts.push(productToAdd);
    }
  } else {
    selectedProducts.splice(selectedIndex, 1);
  }

  saveSelectedProducts();
  renderSelectedProducts();
  displayProducts(currentCategoryProducts);
}

/* Save selected product IDs to localStorage */
function saveSelectedProducts() {
  try {
    const selectedProductIds = selectedProducts.map((product) => product.id);
    localStorage.setItem(
      SELECTED_PRODUCTS_STORAGE_KEY,
      JSON.stringify(selectedProductIds),
    );
  } catch (error) {
    console.error("Could not save selected products:", error);
  }
}

/* Restore selected products from localStorage */
function restoreSelectedProducts(products) {
  try {
    const savedValue = localStorage.getItem(SELECTED_PRODUCTS_STORAGE_KEY);

    if (!savedValue) {
      return;
    }

    const savedProductIds = JSON.parse(savedValue);

    if (!Array.isArray(savedProductIds)) {
      return;
    }

    selectedProducts.length = 0;

    savedProductIds.forEach((savedId) => {
      const matchedProduct = products.find((product) => product.id === savedId);

      if (matchedProduct) {
        selectedProducts.push(matchedProduct);
      }
    });
  } catch (error) {
    console.error("Could not restore selected products:", error);
  }
}

/* Clear all selected products from memory + localStorage */
function clearSelectedProducts() {
  selectedProducts.length = 0;
  saveSelectedProducts();
  renderSelectedProducts();
  displayProducts(currentCategoryProducts);
}

/* Build the Selected Products section */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="selected-empty">No products selected yet.</p>';

    if (clearSelectedBtn) {
      clearSelectedBtn.hidden = true;
    }

    return;
  }

  if (clearSelectedBtn) {
    clearSelectedBtn.hidden = false;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product-item">
        <span>${product.name}</span>
        <button type="button" class="remove-selected-btn" data-product-id="${product.id}" aria-label="Remove ${product.name}">
          Remove
        </button>
      </div>
    `,
    )
    .join("");
}

/* Build a clean payload from selected products only */
function getSelectedProductData() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

/* Limit follow-up questions to routine + beauty-related topics */
function isAllowedFollowUp(question) {
  const normalizedQuestion = question.toLowerCase();

  return ALLOWED_FOLLOW_UP_TOPICS.some((topic) =>
    normalizedQuestion.includes(topic),
  );
}

/* Add one message block to the chat UI */
function addChatMessage(role, text) {
  const message = document.createElement("p");
  message.className = `chat-message ${role}`;

  const speaker = role === "user" ? "User" : "Assistant";
  message.textContent = `${speaker}: ${text}`;

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send one request to the Cloudflare Worker and return assistant text */
async function requestWorker(messages) {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
    }),
  });

  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error("Worker returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        data.error ||
        data.message ||
        "Worker request failed.",
    );
  }

  const assistantText =
    data.choices?.[0]?.message?.content ||
    data.content ||
    data.reply ||
    data.message ||
    data.response;

  if (!assistantText) {
    throw new Error("No response returned from the worker.");
  }

  return assistantText;
}

/* Call OpenAI and show a personalized routine in the chat window */
async function generateRoutine() {
  if (selectedProducts.length === 0) {
    chatWindow.textContent =
      "Please select at least one product before generating a routine.";
    return;
  }

  const selectedProductData = getSelectedProductData();
  chatWindow.innerHTML = "";
  routineGenerated = false;
  addChatMessage("assistant", "Generating your personalized routine...");
  generateRoutineBtn.disabled = true;

  try {
    const routinePrompt = `Create a personalized routine from these selected products: ${JSON.stringify(selectedProductData)}. Explain order and when to use each product.`;

    const messages = [
      {
        role: "system",
        content:
          "You are a helpful beauty advisor. Build a simple routine using only the products provided by the user, then answer follow-up questions only about that routine and related beauty topics such as skincare, haircare, makeup, and fragrance.",
      },
      {
        role: "user",
        content: routinePrompt,
      },
    ];

    const routineText = await requestWorker(messages);
    chatHistory.length = 0;
    chatHistory.push({ role: "user", content: routinePrompt });
    chatHistory.push({ role: "assistant", content: routineText });
    routineGenerated = true;

    chatWindow.innerHTML = "";
    addChatMessage("assistant", routineText);
  } catch (error) {
    chatWindow.innerHTML = "";
    addChatMessage(
      "assistant",
      `Could not generate a routine: ${error.message}`,
    );
  } finally {
    generateRoutineBtn.disabled = false;
  }
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Let users click a product card to select or unselect it */
productsContainer.addEventListener("click", (e) => {
  const detailsButton = e.target.closest(".view-details-btn");

  if (detailsButton) {
    const productId = Number(detailsButton.dataset.productId);
    openProductModal(productId);
    return;
  }

  const clickedCard = e.target.closest(".product-card");

  if (!clickedCard) {
    return;
  }

  const productId = Number(clickedCard.dataset.productId);
  toggleProductSelection(productId);
});

/* Let users remove selected products directly from the list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-btn");

  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.productId);
  toggleProductSelection(productId);
});

/* Clear all selected products */
if (clearSelectedBtn) {
  clearSelectedBtn.addEventListener("click", clearSelectedProducts);
}

/* Generate a routine when the user clicks the button */
if (generateRoutineBtn) {
  generateRoutineBtn.addEventListener("click", generateRoutine);
}

/* Modal close interactions */
if (closeProductModalBtn) {
  closeProductModalBtn.addEventListener("click", closeProductModal);
}

if (productModal) {
  productModal.addEventListener("click", (e) => {
    if (e.target === productModal) {
      closeProductModal();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && productModal && !productModal.hidden) {
    closeProductModal();
  }
});

/* Initialize selected list from localStorage */
async function initializeSelectedProducts() {
  const products = await loadProducts();
  restoreSelectedProducts(products);
  renderSelectedProducts();
}

initializeSelectedProducts();

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!routineGenerated) {
    addChatMessage(
      "assistant",
      "Generate a routine first, then ask follow-up questions about that routine.",
    );
    return;
  }

  const question = userInput.value.trim();

  if (!question) {
    return;
  }

  if (!isAllowedFollowUp(question)) {
    addChatMessage(
      "assistant",
      "Please ask about your routine or related topics like skincare, haircare, makeup, or fragrance.",
    );
    return;
  }

  addChatMessage("user", question);
  userInput.value = "";

  const selectedProductData = getSelectedProductData();

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful beauty advisor. Use the full conversation history. Only answer questions about the generated routine or related topics like skincare, haircare, makeup, and fragrance. If a question is outside these topics, politely refuse and ask the user to stay on-topic.",
      },
      {
        role: "user",
        content: `The user selected these products: ${JSON.stringify(selectedProductData)}. Keep using this list for advice.`,
      },
      ...chatHistory,
      {
        role: "user",
        content: question,
      },
    ];

    const assistantReply = await requestWorker(messages);
    chatHistory.push({ role: "user", content: question });
    chatHistory.push({ role: "assistant", content: assistantReply });
    addChatMessage("assistant", assistantReply);
  } catch (error) {
    addChatMessage("assistant", `Could not reply: ${error.message}`);
  }
});
