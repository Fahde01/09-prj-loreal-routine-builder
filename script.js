/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
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
const apiUrl = "https://api.openai.com/v1/chat/completions";
const apiKey = window.OPENAI_API_KEY || "";

/* Keep product data and selected products in memory */
let allProducts = [];
let currentCategoryProducts = [];
const selectedProducts = [];
const chatHistory = [];

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

  renderSelectedProducts();
  displayProducts(currentCategoryProducts);
}

/* Build the Selected Products section */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="selected-empty">No products selected yet.</p>';
    return;
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

/* Add one message block to the chat UI */
function addChatMessage(role, text) {
  const message = document.createElement("p");
  message.className = `chat-message ${role}`;

  const speaker = role === "user" ? "User" : "Assistant";
  message.textContent = `${speaker}: ${text}`;

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send one request to OpenAI and return assistant text */
async function requestOpenAI(messages) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "OpenAI request failed.");
  }

  const data = await response.json();
  const assistantText = data.choices?.[0]?.message?.content;

  if (!assistantText) {
    throw new Error("No response returned from API.");
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

  if (!apiKey) {
    chatWindow.textContent =
      "API key not found. Add OPENAI_API_KEY in sceret.js.";
    return;
  }

  const selectedProductData = getSelectedProductData();
  chatWindow.innerHTML = "";
  addChatMessage("assistant", "Generating your personalized routine...");
  generateRoutineBtn.disabled = true;

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful beauty advisor. Build a simple routine using only the products provided by the user.",
      },
      {
        role: "user",
        content: `Create a personalized routine from these selected products: ${JSON.stringify(selectedProductData)}. Explain order and when to use each product.`,
      },
    ];

    const routineText = await requestOpenAI(messages);
    chatHistory.length = 0;
    chatHistory.push({ role: "assistant", content: routineText });

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

/* Initialize selected list with empty state */
renderSelectedProducts();

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!apiKey) {
    addChatMessage(
      "assistant",
      "API key not found. Add OPENAI_API_KEY in sceret.js.",
    );
    return;
  }

  if (selectedProducts.length === 0) {
    addChatMessage(
      "assistant",
      "Select at least one product before asking questions.",
    );
    return;
  }

  const question = userInput.value.trim();

  if (!question) {
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
          "You are a helpful beauty advisor. Only recommend products from the list the user selected.",
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

    const assistantReply = await requestOpenAI(messages);
    chatHistory.push({ role: "user", content: question });
    chatHistory.push({ role: "assistant", content: assistantReply });
    addChatMessage("assistant", assistantReply);
  } catch (error) {
    addChatMessage("assistant", `Could not reply: ${error.message}`);
  }
});
