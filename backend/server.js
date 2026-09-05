const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { data: rawMedicines } = require("./data/data");

// Give every dataset medicine an ID
const medicines = rawMedicines.map((medicine, index) => {
  return { ...medicine, id: index + 1 };
});

const usersFile = path.join(__dirname, "users.json");
const ordersFile = path.join(__dirname, "orders.json");

// Temporarily stores logged-in users while server is running
const sessions = new Map();

function readJson(filePath) {
  const fileData = fs.readFileSync(filePath, "utf8");
  return JSON.parse(fileData);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON data"));
      }
    });
  });
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function getCurrentUser(request, users) {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace("Bearer ", "");
  const userId = sessions.get(token);

  return users.find((user) => user.id === userId);
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address
  };
}

const server = http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  // Browser sends this before some POST requests
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const users = readJson(usersFile);

    // Get all medicines from the dataset
    if (request.method === "GET" && request.url === "/api/medicines") {
      sendJson(response, 200, medicines);
      return;
    }

    // Create a new user account
    if (request.method === "POST" && request.url === "/api/register") {
      const { name, email, phone, address, password } =
        await readRequestBody(request);

      if (!name || !email || !phone || !address || !password) {
        sendJson(response, 400, {
          message: "Please fill in every field."
        });
        return;
      }

      const userExists = users.some((user) => {
        return user.email.toLowerCase() === email.toLowerCase();
      });

      if (userExists) {
        sendJson(response, 409, {
          message: "An account already exists with this email."
        });
        return;
      }

      const salt = crypto.randomBytes(16).toString("hex");

      const newUser = {
        id: crypto.randomUUID(),
        name,
        email: email.toLowerCase(),
        phone,
        address,
        passwordHash: hashPassword(password, salt),
        salt,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      writeJson(usersFile, users);

      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, newUser.id);

      sendJson(response, 201, {
        message: "Account created successfully.",
        token,
        user: safeUser(newUser)
      });
      return;
    }

    // Login with an existing account
    if (request.method === "POST" && request.url === "/api/login") {
      const { email, password } = await readRequestBody(request);

      const user = users.find((user) => {
        return user.email === email.toLowerCase();
      });

      if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
        sendJson(response, 401, {
          message: "Incorrect email or password."
        });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, user.id);

      sendJson(response, 200, {
        message: "Login successful.",
        token,
        user: safeUser(user)
      });
      return;
    }

    // Save an order for the logged-in user
    if (request.method === "POST" && request.url === "/api/orders") {
      const user = getCurrentUser(request, users);

      if (!user) {
        sendJson(response, 401, {
          message: "Please log in before checkout."
        });
        return;
      }

      const { items } = await readRequestBody(request);

      if (!items || items.length === 0) {
        sendJson(response, 400, {
          message: "Cart is empty."
        });
        return;
      }

      const orderItems = items.map((item) => {
        const medicine = medicines.find((medicine) => {
          return medicine.id === item.id;
        });

        return {
          id: medicine.id,
          drugName: medicine.drugName,
          price: medicine.price,
          quantity: item.quantity
        };
      });

      const total = orderItems.reduce((sum, item) => {
        return sum + item.price * item.quantity;
      }, 0);

      const orders = readJson(ordersFile);

      const newOrder = {
        id: crypto.randomUUID(),
        userId: user.id,
        items: orderItems,
        total,
        orderedAt: new Date().toISOString()
      };

      orders.push(newOrder);
      writeJson(ordersFile, orders);

      sendJson(response, 201, {
        message: "Order placed successfully.",
        order: newOrder
      });
      return;
    }

    // Get all orders belonging to the logged-in user
    if (request.method === "GET" && request.url === "/api/orders") {
      const user = getCurrentUser(request, users);

      if (!user) {
        sendJson(response, 401, {
          message: "Please log in first."
        });
        return;
      }

      const orders = readJson(ordersFile);

      const userOrders = orders.filter((order) => {
        return order.userId === user.id;
      });

      sendJson(response, 200, userOrders);
      return;
    }

    sendJson(response, 404, { message: "Route not found." });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { message: "Server error." });
  }
});

server.listen(5000, () => {
  console.log("Backend is running at http://localhost:5000");
});