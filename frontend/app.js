const API_URL = "https://medicart-backend-5mnp.onrender.com/api/medicines";
const API_BASE = "https://medicart-backend-5mnp.onrender.com/api";

let medicines = [];
let cart = [];
let loginMode = false;

let token = localStorage.getItem("medicart-token") || "";
let currentUser = JSON.parse(
  localStorage.getItem("medicart-user") || "null"
);

const medicineGrid = document.getElementById("medicineGrid");
const medicineCount = document.getElementById("medicineCount");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const cartPanel = document.getElementById("cartPanel");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");

const accountButton = document.getElementById("accountButton");
const ordersButton = document.getElementById("ordersButton");
const ordersPanel = document.getElementById("ordersPanel");
const ordersList = document.getElementById("ordersList");
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");

function updateAccountButton() {
  if (currentUser) {
    accountButton.textContent = `Hi, ${currentUser.name.split(" ")[0]}`;
  } else {
    accountButton.textContent = "Create account";
  }
}

async function loadMedicines() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Could not load medicines");
    }

    medicines = await response.json();

    medicines = medicines.map((medicine, index) => {
      return { ...medicine, id: index + 1 };
    });

    addCategories();
    displayMedicines();
  } catch (error) {
    medicineGrid.innerHTML = `
      <p>Could not connect to the backend.
      Make sure the Node server is running.</p>
    `;
  }
}

function addCategories() {
  const categories = [
    ...new Set(
      medicines
        .map((medicine) => medicine.category?.trim())
        .filter(Boolean)
    )
  ].sort();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function displayMedicines() {
  const searchText = searchInput.value.toLowerCase().trim();
  const selectedCategory = categoryFilter.value;

  const filteredMedicines = medicines.filter((medicine) => {
    const nameMatches = medicine.drugName
      .toLowerCase()
      .includes(searchText);

    const medicineCategory = medicine.category?.trim() || "";
    const categoryMatches =
      selectedCategory === "" || medicineCategory === selectedCategory;

    return nameMatches && categoryMatches;
  });

  medicineCount.textContent =
    `${filteredMedicines.length} of ${medicines.length} products shown`;

  if (filteredMedicines.length === 0) {
    medicineGrid.innerHTML = "<p>No medicines found.</p>";
    return;
  }

  medicineGrid.innerHTML = filteredMedicines
    .map((medicine) => {
      return `
        <article class="medicine-card">
          <img
            src="${medicine.image}"
            alt="${medicine.drugName}"
            onerror="this.style.display='none'"
          >

          <p class="category">${medicine.category?.trim() || "General"}</p>
          <h3>${medicine.drugName}</h3>

          <p class="manufacturer">
            ${medicine.manufacturer?.trim() || "Manufacturer unavailable"}
          </p>

          <p class="price">₹${medicine.price}</p>

          <button class="add-button" data-id="${medicine.id}">
            Add to cart
          </button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".add-button").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(Number(button.dataset.id));
    });
  });
}

function addToCart(id) {
  const medicine = medicines.find((item) => item.id === id);
  const existingItem = cart.find((item) => item.id === id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...medicine, quantity: 1 });
  }

  updateCart();
}

function changeQuantity(id, amount) {
  const item = cart.find((item) => item.id === id);

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter((item) => item.id !== id);
  }

  updateCart();
}

function updateCart() {
  cartCount.textContent = cart.reduce((total, item) => {
    return total + item.quantity;
  }, 0);

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
  } else {
    cartItems.innerHTML = cart
      .map((item) => {
        return `
          <div class="cart-item">
            <div>
              <strong>${item.drugName}</strong><br>
              ₹${item.price} × ${item.quantity}
            </div>

            <div>
              <button onclick="changeQuantity(${item.id}, -1)">−</button>
              <button onclick="changeQuantity(${item.id}, 1)">+</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const total = cart.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  document.getElementById("cartTotal").textContent = total;
}

function setAuthMode(shouldLogin) {
  loginMode = shouldLogin;

  document.querySelectorAll(".register-field").forEach((field) => {
    field.style.display = loginMode ? "none" : "block";
  });

  document.getElementById("nameInput").required = !loginMode;
  document.getElementById("phoneInput").required = !loginMode;
  document.getElementById("addressInput").required = !loginMode;

  document.getElementById("authTitle").textContent = loginMode
    ? "Sign in to MediCart"
    : "Create your account";

  document.getElementById("authSubmitButton").textContent = loginMode
    ? "Sign in"
    : "Create account";

  document.getElementById("switchAuthButton").textContent = loginMode
    ? "New here? Create an account"
    : "Already have an account? Sign in";

  authMessage.textContent = "";
}

function openAuthModal() {
  setAuthMode(false);
  authForm.reset();
  authModal.classList.remove("hidden");
}

function saveLogin(result) {
  token = result.token;
  currentUser = result.user;

  localStorage.setItem("medicart-token", token);
  localStorage.setItem("medicart-user", JSON.stringify(currentUser));

  updateAccountButton();
}

accountButton.addEventListener("click", () => {
  if (currentUser) {
    const logout = confirm(
      `Signed in as ${currentUser.name}.\n\nPress OK to log out.`
    );

    if (logout) {
      token = "";
      currentUser = null;
      localStorage.removeItem("medicart-token");
      localStorage.removeItem("medicart-user");
      updateAccountButton();
    }

    return;
  }

  openAuthModal();
});

document.getElementById("closeAuth").addEventListener("click", () => {
  authModal.classList.add("hidden");
});

document.getElementById("switchAuthButton").addEventListener("click", () => {
  setAuthMode(!loginMode);
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  const userData = { email, password };

  if (!loginMode) {
    userData.name = document.getElementById("nameInput").value;
    userData.phone = document.getElementById("phoneInput").value;
    userData.address = document.getElementById("addressInput").value;
  }

  const endpoint = loginMode ? "/login" : "/register";

  try {
    const response = await fetch(API_BASE + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    saveLogin(result);
    authModal.classList.add("hidden");

    alert(loginMode ? "Login successful!" : "Account created successfully!");
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

document.getElementById("cartButton").addEventListener("click", () => {
  cartPanel.classList.remove("hidden");
});

document.getElementById("closeCart").addEventListener("click", () => {
  cartPanel.classList.add("hidden");
});

document.getElementById("checkoutButton").addEventListener("click", async () => {
  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  if (!token) {
    alert("Please create an account or sign in before checkout.");
    cartPanel.classList.add("hidden");
    openAuthModal();
    return;
  }

  try {
    const response = await fetch(API_BASE + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: cart.map((item) => {
          return { id: item.id, quantity: item.quantity };
        })
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    alert(`Order saved successfully! Total: ₹${result.order.total}`);

    cart = [];
    updateCart();
    cartPanel.classList.add("hidden");
  } catch (error) {
    alert(error.message);
  }
});
async function loadOrders() {
  if (!token) {
    ordersList.innerHTML = "<p>Please sign in to view your orders.</p>";
    return;
  }

  try {
    const response = await fetch(API_BASE + "/orders", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const orders = await response.json();

    if (!response.ok) {
      throw new Error(orders.message);
    }

    if (orders.length === 0) {
      ordersList.innerHTML = "<p>You have not placed any orders yet.</p>";
      return;
    }

    ordersList.innerHTML = orders
      .slice()
      .reverse()
      .map((order) => {
        const date = new Date(order.orderedAt).toLocaleString();

        return `
          <div class="cart-item">
            <div>
              <strong>Order #${order.id.slice(0, 8)}</strong>
              <p>${date}</p>
              <p>
                ${order.items
                  .map(
                    (item) =>
                      `${item.drugName} × ${item.quantity}`
                  )
                  .join("<br>")}
              </p>
            </div>

            <strong>₹${order.total}</strong>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    ordersList.innerHTML = `<p>${error.message}</p>`;
  }
}

ordersButton.addEventListener("click", () => {
  ordersPanel.classList.remove("hidden");
  loadOrders();
});

document.getElementById("closeOrders").addEventListener("click", () => {
  ordersPanel.classList.add("hidden");
});

searchInput.addEventListener("input", displayMedicines);
categoryFilter.addEventListener("change", displayMedicines);

updateAccountButton();
loadMedicines();