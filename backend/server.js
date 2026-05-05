const express = require("express");
const path = require("path");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(express.json());

// Serve static files from the project root
// Example: http://localhost:3000/Sprint2Alberto/CustomerSingInPage.html
app.use(express.static(path.join(__dirname, "..")));

function ensurePartsReviewOwnershipSchema() {
  db.query("SHOW TABLES LIKE 'partsreviews'", (tableErr, tableRows) => {
    if (tableErr) {
      console.error("Failed to check partsreviews table:", tableErr);
      return;
    }

    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      return;
    }

    db.query("SHOW COLUMNS FROM partsreviews LIKE 'UserID'", (columnErr, columnRows) => {
      if (columnErr) {
        console.error("Failed to inspect partsreviews columns:", columnErr);
        return;
      }

      if (Array.isArray(columnRows) && columnRows.length > 0) {
        return;
      }

      const alterSql = `
        ALTER TABLE partsreviews
        ADD COLUMN UserID INT NULL,
        ADD KEY idx_partsreviews_user (UserID),
        ADD CONSTRAINT fk_partsreviews_user FOREIGN KEY (UserID) REFERENCES \`User\`(UserID)
      `;

      db.query(alterSql, (alterErr) => {
        if (alterErr) {
          console.error("Failed to migrate partsreviews ownership schema:", alterErr);
          return;
        }

        console.log("partsreviews table updated with UserID ownership column.");
      });
    });
  });
}

ensurePartsReviewOwnershipSchema();

function ensureCheckoutSchema() {
  const statements = [
    `
      CREATE TABLE IF NOT EXISTS ShoppingCartItems (
        CartItemID INT NOT NULL AUTO_INCREMENT,
        UserID INT NOT NULL,
        PartID INT NOT NULL,
        Quantity INT NOT NULL DEFAULT 1,
        UnitPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (CartItemID),
        UNIQUE KEY uq_cart_user_part (UserID, PartID),
        KEY idx_cart_user (UserID),
        KEY idx_cart_part (PartID),
        CONSTRAINT fk_cart_user FOREIGN KEY (UserID) REFERENCES \`User\`(UserID),
        CONSTRAINT fk_cart_part FOREIGN KEY (PartID) REFERENCES Parts(PartID)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS CustomerOrders (
        OrderID INT NOT NULL AUTO_INCREMENT,
        OrderNumber VARCHAR(30) NULL,
        UserID INT NOT NULL,
        TotalAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
        Status VARCHAR(30) NOT NULL DEFAULT 'PAID_SIMULATED',
        ShippingAddress VARCHAR(255) NULL,
        PaymentMethod VARCHAR(50) NOT NULL DEFAULT 'SIMULATED',
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (OrderID),
        UNIQUE KEY uq_order_number (OrderNumber),
        KEY idx_orders_user (UserID),
        CONSTRAINT fk_orders_user FOREIGN KEY (UserID) REFERENCES \`User\`(UserID)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS CustomerOrderItems (
        OrderItemID INT NOT NULL AUTO_INCREMENT,
        OrderID INT NOT NULL,
        PartID INT NOT NULL,
        Quantity INT NOT NULL DEFAULT 1,
        UnitPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
        LineTotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (OrderItemID),
        KEY idx_orderitems_order (OrderID),
        KEY idx_orderitems_part (PartID),
        CONSTRAINT fk_orderitems_order FOREIGN KEY (OrderID) REFERENCES CustomerOrders(OrderID) ON DELETE CASCADE,
        CONSTRAINT fk_orderitems_part FOREIGN KEY (PartID) REFERENCES Parts(PartID)
      )
    `
  ];

  const runNext = (idx) => {
    if (idx >= statements.length) {
      console.log("Checkout schema is ready.");
      return;
    }

    db.query(statements[idx], (err) => {
      if (err) {
        console.error("Failed to ensure checkout schema:", err);
        return;
      }

      runNext(idx + 1);
    });
  };

  runNext(0);
}

ensureCheckoutSchema();

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
}

function beginTransactionAsync() {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function commitAsync() {
  return new Promise((resolve, reject) => {
    db.commit((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function rollbackAsync() {
  return new Promise((resolve) => {
    db.rollback(() => resolve());
  });
}

/* Root route */
app.get("/", (req, res) => {
  res.send("CMPSC390 Backend API is running (Charles - Backend).");
});
app.use(express.urlencoded({ extended: true }));

// ==========================================
// ROOT & TEST ROUTES
// ==========================================

app.get("/test", (req, res) => {
  res.send("Backend server is running successfully.");
});

// Serve static files from the workspace root (supports all frontend folders).
// Keep this after API root/test routes so those endpoints are not shadowed by index.html.
app.use(express.static(path.join(__dirname, "..")));

// ==========================================
// CUSTOMER AUTHENTICATION ROUTES
// ==========================================

/* Customer login */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  const sql = "SELECT * FROM `User` WHERE UserName = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Login failed" });
    }

    const user = results[0];

    if (user.Password !== password) {
      return res.status(401).json({ message: "Login failed" });
    }

    res.json({
      message: "Login successful",
      userId: user.UserID,
      username: user.UserName,
      userType: "customer"
    });
  });
});

/* Customer registration */
app.post("/customer/register", (req, res) => {
  const { firstName, lastName, password, userName, zipCode, birthdate } = req.body;

  if (!firstName || !lastName || !password || !userName || !zipCode || !birthdate) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const checkSql = "SELECT * FROM `User` WHERE UserName = ?";
  db.query(checkSql, [userName], (checkErr, checkResults) => {
    if (checkErr) {
      console.error(checkErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (checkResults.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const insertSql = "INSERT INTO `User` (FirstName, LastName, Password, UserName, ZipCode, Birthdate) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(insertSql, [firstName, lastName, password, userName, zipCode, birthdate], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error creating account" });
      }

      res.json({
        message: "Account created successfully",
        userId: result.insertId,
        username: userName,
        userType: "customer"
      });
    });
  });
});

/* Get customer by ID (for dashboard) */
app.get("/customer/:id", (req, res) => {
  const userId = req.params.id;

  const sql = "SELECT UserID, UserName, FirstName, LastName FROM `User` WHERE UserID = ?";

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(results[0]);
  });
});

// ==========================================
// PARTS ROUTES
// ==========================================

app.get("/parts", (req, res) => {
  const sql = "SELECT * FROM Parts";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/* Get parts with filters (Francisco's implementation) */
app.get("/api/parts", (req, res) => {
  const category = req.query.category;
  const inStock = req.query.inStock;

  let sql = "SELECT * FROM Parts WHERE 1=1";
  const params = [];

  if (category) {
    sql += " AND Category = ?";
    params.push(category);
  }

  if (inStock === "true") {
    sql += " AND Stock > 0";
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ==========================================
// SHOPPING CART & CHECKOUT ROUTES
// ==========================================

app.get("/cart/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid userId is required" });
  }

  try {
    const rows = await queryAsync(
      `
        SELECT
          sci.CartItemID,
          sci.UserID,
          sci.PartID,
          sci.Quantity,
          sci.UnitPrice,
          COALESCE(p.Name, sci.Description) AS Name,
          p.Image,
          p.Category,
          p.Stock,
          p.Availability
        FROM ShoppingCartItems sci
        LEFT JOIN Parts p ON p.PartID = sci.PartID
        WHERE sci.UserID = ?
        ORDER BY sci.CreatedAt DESC
      `,
      [userId]
    );

    const items = (rows || []).map((row) => {
      const quantity = Number(row.Quantity || 0);
      const unitPrice = Number(row.UnitPrice || 0);
      return {
        ...row,
        Quantity: quantity,
        UnitPrice: unitPrice,
        LineTotal: Number((quantity * unitPrice).toFixed(2))
      };
    });

    const totalAmount = Number(
      items.reduce((sum, item) => sum + Number(item.LineTotal || 0), 0).toFixed(2)
    );

    return res.json({ items, totalAmount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.post("/cart", async (req, res) => {
  const userId = Number(req.body.userId);
  const partId = Number(req.body.partId);
  const quantity = Math.max(1, Number(req.body.quantity) || 1);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(partId) || partId <= 0) {
    return res.status(400).json({ message: "Valid userId and partId are required" });
  }

  try {
    const partRows = await queryAsync("SELECT PartID, Stock, Price FROM Parts WHERE PartID = ?", [partId]);
    if (!partRows || partRows.length === 0) {
      return res.status(404).json({ message: "Part not found" });
    }

    const part = partRows[0];
    const stock = Number(part.Stock || 0);
    const unitPrice = Number(part.Price || 0);

    if (stock <= 0) {
      return res.status(400).json({ message: "Part is out of stock" });
    }

    const existingRows = await queryAsync(
      "SELECT CartItemID, Quantity FROM ShoppingCartItems WHERE UserID = ? AND PartID = ?",
      [userId, partId]
    );

    const existingQuantity = existingRows && existingRows.length > 0
      ? Number(existingRows[0].Quantity || 0)
      : 0;
    const nextQuantity = existingQuantity + quantity;

    if (nextQuantity > stock) {
      return res.status(400).json({ message: `Only ${stock} in stock for this part` });
    }

    if (existingRows && existingRows.length > 0) {
      await queryAsync(
        "UPDATE ShoppingCartItems SET Quantity = ?, UnitPrice = ? WHERE CartItemID = ?",
        [nextQuantity, unitPrice, existingRows[0].CartItemID]
      );
    } else {
      await queryAsync(
        "INSERT INTO ShoppingCartItems (UserID, PartID, Quantity, UnitPrice) VALUES (?, ?, ?, ?)",
        [userId, partId, quantity, unitPrice]
      );
    }

    return res.json({ message: "Item added to cart" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.put("/cart/:cartItemId", async (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const userId = Number(req.body.userId);
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(cartItemId) || cartItemId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid cartItemId and userId are required" });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1" });
  }

  try {
    const rows = await queryAsync(
      `
        SELECT sci.CartItemID, sci.PartID, p.Stock, p.Price
        FROM ShoppingCartItems sci
        JOIN Parts p ON p.PartID = sci.PartID
        WHERE sci.CartItemID = ? AND sci.UserID = ?
      `,
      [cartItemId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    const stock = Number(rows[0].Stock || 0);
    if (quantity > stock) {
      return res.status(400).json({ message: `Only ${stock} in stock for this part` });
    }

    const unitPrice = Number(rows[0].Price || 0);
    await queryAsync(
      "UPDATE ShoppingCartItems SET Quantity = ?, UnitPrice = ? WHERE CartItemID = ? AND UserID = ?",
      [quantity, unitPrice, cartItemId, userId]
    );

    return res.json({ message: "Cart item updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.delete("/cart/:cartItemId", async (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const userId = Number((req.body && req.body.userId) || req.query.userId);

  if (!Number.isInteger(cartItemId) || cartItemId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid cartItemId and userId are required" });
  }

  try {
    const result = await queryAsync(
      "DELETE FROM ShoppingCartItems WHERE CartItemID = ? AND UserID = ?",
      [cartItemId, userId]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    return res.json({ message: "Cart item removed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.post("/checkout", async (req, res) => {
  const userId = Number(req.body.userId);
  const shippingAddress = String(req.body.shippingAddress || "").trim() || null;
  const paymentMethod = String(req.body.paymentMethod || "SIMULATED").trim() || "SIMULATED";

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid userId is required" });
  }

  try {
    await beginTransactionAsync();

    const cartItems = await queryAsync(
      `
        SELECT
          sci.CartItemID,
          sci.PartID,
          sci.Quantity,
          sci.UnitPrice,
          COALESCE(p.Name, sci.Description) AS Name,
          p.Stock,
          p.Price
        FROM ShoppingCartItems sci
        LEFT JOIN Parts p ON p.PartID = sci.PartID
        WHERE sci.UserID = ?
        FOR UPDATE
      `,
      [userId]
    );

    if (!cartItems || cartItems.length === 0) {
      await rollbackAsync();
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Only validate stock for real part items
    for (const item of cartItems) {
      if (!item.PartID) continue;
      const stock = Number(item.Stock || 0);
      const qty = Number(item.Quantity || 0);
      if (qty < 1 || qty > stock) {
        await rollbackAsync();
        return res.status(400).json({ message: `Insufficient stock for ${item.Name || `Part ${item.PartID}`}` });
      }
    }

    const totalAmount = Number(
      cartItems.reduce((sum, item) => sum + (Number(item.Quantity || 0) * Number(item.UnitPrice || item.Price || 0)), 0).toFixed(2)
    );

    const orderResult = await queryAsync(
      `
        INSERT INTO CustomerOrders (UserID, TotalAmount, Status, ShippingAddress, PaymentMethod)
        VALUES (?, ?, 'PAID_SIMULATED', ?, ?)
      `,
      [userId, totalAmount, shippingAddress, paymentMethod]
    );

    const orderId = orderResult.insertId;

    const year = new Date().getFullYear();
    const orderNumber = `LA-${year}-${String(orderId).padStart(5, '0')}`;
    try {
      await queryAsync(
        "UPDATE CustomerOrders SET OrderNumber = ? WHERE OrderID = ?",
        [orderNumber, orderId]
      );
    } catch (_) { /* OrderNumber column may not exist yet — non-fatal */ }

    // Only include real part rows in order items
    const partCartItems = cartItems.filter(item => item.PartID);
    if (partCartItems.length > 0) {
      const orderItemValues = partCartItems.map((item) => {
        const qty = Number(item.Quantity || 0);
        const unitPrice = Number(item.UnitPrice || item.Price || 0);
        return [orderId, Number(item.PartID), qty, unitPrice, Number((qty * unitPrice).toFixed(2))];
      });
      await queryAsync(
        "INSERT INTO CustomerOrderItems (OrderID, PartID, Quantity, UnitPrice, LineTotal) VALUES ?",
        [orderItemValues]
      );
    }

    for (const item of cartItems) {
      if (!item.PartID) continue; // skip base car rows
      const qty = Number(item.Quantity || 0);
      const partId = Number(item.PartID);

      const updateResult = await queryAsync(
        `
          UPDATE Parts
          SET Stock = Stock - ?,
              Availability = CASE WHEN (Stock - ?) <= 0 THEN 'Out of Stock' ELSE 'Available' END
          WHERE PartID = ? AND Stock >= ?
        `,
        [qty, qty, partId, qty]
      );

      if (!updateResult || updateResult.affectedRows === 0) {
        await rollbackAsync();
        return res.status(400).json({ message: "Stock changed during checkout. Please refresh and try again." });
      }
    }

    await queryAsync("DELETE FROM ShoppingCartItems WHERE UserID = ?", [userId]);

    await commitAsync();

    return res.json({
      message: "Checkout completed",
      orderId,
      orderNumber,
      totalAmount,
      itemCount: cartItems.length,
      status: "PAID_SIMULATED"
    });
  } catch (err) {
    console.error(err);
    await rollbackAsync();
    return res.status(500).json({ message: "Checkout failed due to database error" });
  }
});

app.get("/orders/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const scope = String(req.query.scope || "all").toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid userId is required" });
  }

  try {
    const currentStatuses = ["PAID_SIMULATED", "PROCESSING"];
    const previousStatuses = ["FULFILLED", "CANCELLED"];

    let statusFilter = [];
    if (scope === "current") {
      statusFilter = currentStatuses;
    } else if (scope === "previous") {
      statusFilter = previousStatuses;
    }

    const whereClause = statusFilter.length
      ? `WHERE UserID = ? AND Status IN (${statusFilter.map(() => "?").join(", ")})`
      : "WHERE UserID = ?";

    const orders = await queryAsync(
      `
        SELECT OrderID, OrderNumber, UserID, TotalAmount, Status, ShippingAddress, PaymentMethod, CreatedAt
        FROM CustomerOrders
        ${whereClause}
        ORDER BY CreatedAt DESC
      `,
      [userId, ...statusFilter]
    );

    if (!orders || orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((order) => Number(order.OrderID));
    const items = await queryAsync(
      `
        SELECT
          coi.OrderItemID,
          coi.OrderID,
          coi.PartID,
          coi.Quantity,
          coi.UnitPrice,
          coi.LineTotal,
          p.Name,
          p.Image,
          p.Category
        FROM CustomerOrderItems coi
        JOIN Parts p ON p.PartID = coi.PartID
        WHERE coi.OrderID IN (?)
        ORDER BY coi.OrderID DESC, coi.OrderItemID ASC
      `,
      [orderIds]
    );

    const itemsByOrderId = new Map();
    (items || []).forEach((item) => {
      const key = Number(item.OrderID);
      if (!itemsByOrderId.has(key)) {
        itemsByOrderId.set(key, []);
      }
      itemsByOrderId.get(key).push(item);
    });

    const hydratedOrders = orders.map((order) => ({
      ...order,
      Items: itemsByOrderId.get(Number(order.OrderID)) || []
    }));

    return res.json(hydratedOrders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.patch("/orders/:orderId/status", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number((req.body && req.body.userId) || req.query.userId);
  const status = String((req.body && req.body.status) || "").toUpperCase();
  const allowedStatuses = new Set(["PROCESSING", "FULFILLED", "CANCELLED"]);

  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(userId) || userId <= 0 || !allowedStatuses.has(status)) {
    return res.status(400).json({ message: "Valid orderId, userId, and status are required" });
  }

  try {
    const result = await queryAsync(
      "UPDATE CustomerOrders SET Status = ? WHERE OrderID = ? AND UserID = ?",
      [status, orderId, userId]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ message: `Order marked as ${status.toLowerCase()}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Database error" });
  }
});

app.post("/cars/:carId/add-to-cart", async (req, res) => {
  const carId = Number(req.params.carId);
  const userId = Number(req.body.userId);

  if (!Number.isInteger(carId) || carId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid carId and userId are required" });
  }

  try {
    await beginTransactionAsync();

    const carRows = await queryAsync(
      `
        SELECT CarID, BaseCar, TotalPrice
        FROM Customized_car
        WHERE CarID = ? AND UserID = ?
        FOR UPDATE
      `,
      [carId, userId]
    );

    if (!carRows || carRows.length === 0) {
      await rollbackAsync();
      return res.status(404).json({ message: "Configuration not found" });
    }

    const car = carRows[0];

    const partRows = await queryAsync(
      `
        SELECT p.PartID, p.Name, p.Stock, p.Price
        FROM Customized_car_parts ccp
        JOIN Parts p ON p.PartID = ccp.PartID
        WHERE ccp.CarID = ?
        FOR UPDATE
      `,
      [carId]
    );

    if (!Array.isArray(partRows) || partRows.length === 0) {
      await rollbackAsync();
      return res.status(400).json({ message: "This build has no parts to add" });
    }

    // Calculate base car price = TotalPrice - sum of part prices
    const partsPriceSum = partRows.reduce((sum, p) => sum + Number(p.Price || 0), 0);
    const baseCarPrice = Math.max(0, Number(car.TotalPrice || 0) - partsPriceSum);
    const baseCarLabel = `Base Vehicle (${car.BaseCar || 'Custom Build'})`;

    let addedCount = 0;

    // Insert base car price as a description-only cart item
    if (baseCarPrice > 0) {
      const existingBase = await queryAsync(
        "SELECT CartItemID FROM ShoppingCartItems WHERE UserID = ? AND PartID IS NULL AND Description = ?",
        [userId, baseCarLabel]
      );
      if (!existingBase || existingBase.length === 0) {
        await queryAsync(
          "INSERT INTO ShoppingCartItems (UserID, PartID, Description, Quantity, UnitPrice) VALUES (?, NULL, ?, 1, ?)",
          [userId, baseCarLabel, baseCarPrice]
        );
        addedCount += 1;
      }
    }

    for (const part of partRows) {
      const partId = Number(part.PartID);
      const unitPrice = Number(part.Price || 0);
      const stock = Number(part.Stock || 0);

      const existingRows = await queryAsync(
        "SELECT CartItemID, Quantity FROM ShoppingCartItems WHERE UserID = ? AND PartID = ?",
        [userId, partId]
      );

      if (existingRows && existingRows.length > 0) {
        const existingQty = Number(existingRows[0].Quantity || 0);
        const nextQty = existingQty + 1;

        if (nextQty > stock) {
          await rollbackAsync();
          return res.status(400).json({ message: `Only ${stock} in stock for part ${part.Name || partId}` });
        }

        await queryAsync(
          "UPDATE ShoppingCartItems SET Quantity = ?, UnitPrice = ? WHERE CartItemID = ?",
          [nextQty, unitPrice, Number(existingRows[0].CartItemID)]
        );
      } else {
        await queryAsync(
          "INSERT INTO ShoppingCartItems (UserID, PartID, Quantity, UnitPrice) VALUES (?, ?, 1, ?)",
          [userId, partId, unitPrice]
        );
      }

      addedCount += 1;
    }

    await commitAsync();
    return res.json({ message: `Added ${addedCount} build part(s) to cart`, addedCount });
  } catch (err) {
    console.error(err);
    await rollbackAsync();
    return res.status(500).json({ message: "Could not add build to cart" });
  }
});

app.post("/cars/:carId/purchase", async (req, res) => {
  const carId = Number(req.params.carId);
  const userId = Number(req.body.userId);
  const shippingAddress = String(req.body.shippingAddress || "").trim() || null;
  const paymentMethod = String(req.body.paymentMethod || "SIMULATED_CAR_PURCHASE").trim() || "SIMULATED_CAR_PURCHASE";

  if (!Number.isInteger(carId) || carId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid carId and userId are required" });
  }

  try {
    await beginTransactionAsync();

    const carRows = await queryAsync(
      `
        SELECT CarID, UserID, BaseCar, TotalPrice, BuildStatus
        FROM Customized_car
        WHERE CarID = ? AND UserID = ?
        FOR UPDATE
      `,
      [carId, userId]
    );

    if (!carRows || carRows.length === 0) {
      await rollbackAsync();
      return res.status(404).json({ message: "Configuration not found" });
    }

    const car = carRows[0];
    const currentStatus = String(car.BuildStatus || "ACTIVE").toUpperCase();
    if (currentStatus === "BOUGHT") {
      await rollbackAsync();
      return res.status(400).json({ message: "This configuration is already bought" });
    }

    const partRows = await queryAsync(
      `
        SELECT p.PartID, p.Name, p.Price, p.Stock
        FROM Customized_car_parts ccp
        JOIN Parts p ON p.PartID = ccp.PartID
        WHERE ccp.CarID = ?
        FOR UPDATE
      `,
      [carId]
    );

    for (const part of (partRows || [])) {
      const stock = Number(part.Stock || 0);
      if (stock < 1) {
        await rollbackAsync();
        return res.status(400).json({ message: `Part out of stock: ${part.Name || part.PartID}` });
      }
    }

    const totalAmount = Number(car.TotalPrice || 0);
    const orderResult = await queryAsync(
      `
        INSERT INTO CustomerOrders (UserID, TotalAmount, Status, ShippingAddress, PaymentMethod)
        VALUES (?, ?, 'PAID_SIMULATED', ?, ?)
      `,
      [userId, totalAmount, shippingAddress, paymentMethod]
    );

    const orderId = Number(orderResult.insertId);

    const carYear = new Date().getFullYear();
    const carOrderNumber = `LA-${carYear}-${String(orderId).padStart(5, '0')}`;
    try {
      await queryAsync(
        "UPDATE CustomerOrders SET OrderNumber = ? WHERE OrderID = ?",
        [carOrderNumber, orderId]
      );
    } catch (_) { /* OrderNumber column may not exist yet — non-fatal */ }

    if (Array.isArray(partRows) && partRows.length > 0) {
      const orderItemValues = partRows.map((part) => {
        const unitPrice = Number(part.Price || 0);
        return [orderId, Number(part.PartID), 1, unitPrice, unitPrice];
      });

      await queryAsync(
        "INSERT INTO CustomerOrderItems (OrderID, PartID, Quantity, UnitPrice, LineTotal) VALUES ?",
        [orderItemValues]
      );

      for (const part of partRows) {
        await queryAsync(
          `
            UPDATE Parts
            SET Stock = Stock - 1,
                Availability = CASE WHEN (Stock - 1) <= 0 THEN 'Out of Stock' ELSE 'Available' END
            WHERE PartID = ? AND Stock >= 1
          `,
          [Number(part.PartID)]
        );
      }
    }

    await queryAsync(
      "UPDATE Customized_car SET BuildStatus = 'BOUGHT' WHERE CarID = ? AND UserID = ?",
      [carId, userId]
    );

    await commitAsync();
    return res.json({
      message: "Car purchase completed",
      orderId,
      orderNumber: carOrderNumber,
      totalAmount,
      status: "PAID_SIMULATED"
    });
  } catch (err) {
    console.error(err);
    await rollbackAsync();
    return res.status(500).json({ message: "Could not complete car purchase" });
  }
});

// ==========================================
// VEHICLE CUSTOMIZATION ROUTES
// ==========================================

function enrichCarsWithParts(cars, callback) {
  if (!cars || cars.length === 0) {
    return callback(null, []);
  }

  const hydratedCars = cars.map((car) => ({
    ...car,
    Parts: []
  }));

  const carById = new Map();
  hydratedCars.forEach((car) => {
    carById.set(Number(car.CarID), car);
  });

  const primaryPartIds = [
    ...new Set(
      hydratedCars
        .map((car) => Number(car.PartID))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ];

  const hydratePrimaryPartFallback = () => {
    if (primaryPartIds.length === 0) {
      return callback(null, hydratedCars);
    }

    const partSql = "SELECT PartID, Name, Category FROM Parts WHERE PartID IN (?)";
    db.query(partSql, [primaryPartIds], (partsErr, partRows) => {
      if (partsErr) {
        console.error(partsErr);
        return callback(null, hydratedCars);
      }

      const partMap = new Map();
      (partRows || []).forEach((part) => {
        partMap.set(Number(part.PartID), {
          Name: part.Name || `Part ${part.PartID}`,
          Category: part.Category || ""
        });
      });

      hydratedCars.forEach((car) => {
        const pid = Number(car.PartID);
        const mappedPart = partMap.get(pid);
        if (Number.isInteger(pid) && pid > 0) {
          car.Parts = [{
            PartID: pid,
            Name: (mappedPart && mappedPart.Name) || `Part ${pid}`,
            Category: (mappedPart && mappedPart.Category) || ""
          }];
        }
      });

      return callback(null, hydratedCars);
    });
  };

  const carIds = hydratedCars
    .map((car) => Number(car.CarID))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (carIds.length === 0) {
    return hydratePrimaryPartFallback();
  }

  const partsSql = `
    SELECT ccp.CarID, p.PartID, p.Name, p.Category
    FROM Customized_car_parts ccp
    JOIN Parts p ON p.PartID = ccp.PartID
    WHERE ccp.CarID IN (?)
    ORDER BY ccp.CarID, p.PartID
  `;

  db.query(partsSql, [carIds], (partsErr, partRows) => {
    if (partsErr) {
      if (partsErr.code !== "ER_NO_SUCH_TABLE") {
        console.error(partsErr);
      }
      return hydratePrimaryPartFallback();
    }

    (partRows || []).forEach((row) => {
      const car = carById.get(Number(row.CarID));
      if (!car) {
        return;
      }

      car.Parts.push({
        PartID: Number(row.PartID),
        Name: row.Name || `Part ${row.PartID}`,
        Category: row.Category || ""
      });
    });

    hydratedCars.forEach((car) => {
      if (car.Parts.length === 0) {
        const pid = Number(car.PartID);
        if (Number.isInteger(pid) && pid > 0) {
          car.Parts = [{
            PartID: pid,
            Name: `Part ${pid}`,
            Category: ""
          }];
        }
      }
    });

    return callback(null, hydratedCars);
  });
}

function fetchCarsForUser(userId, statuses, callback) {
  const normalizedUserId = Number(userId);
  const normalizedStatuses = (Array.isArray(statuses) ? statuses : [statuses])
    .filter(Boolean)
    .map((status) => String(status).toUpperCase());

  const fallbackSql = "SELECT * FROM Customized_car WHERE UserID = ? ORDER BY CarID DESC";

  const runFallbackQuery = () => {
    db.query(fallbackSql, [normalizedUserId], (fallbackErr, fallbackRows) => {
      if (fallbackErr) {
        return callback(fallbackErr);
      }

      if (normalizedStatuses.length > 0 && !normalizedStatuses.includes("ACTIVE")) {
        return callback(null, []);
      }

      return enrichCarsWithParts(fallbackRows, callback);
    });
  };

  const statusClause = normalizedStatuses.length
    ? ` AND BuildStatus IN (${normalizedStatuses.map(() => "?").join(", ")})`
    : "";
  const sql = `SELECT * FROM Customized_car WHERE UserID = ?${statusClause} ORDER BY CarID DESC`;
  const params = [normalizedUserId, ...normalizedStatuses];

  db.query(sql, params, (err, rows) => {
    if (err) {
      const missingStatusColumn =
        err.code === "ER_BAD_FIELD_ERROR" &&
        String(err.sqlMessage || "").toLowerCase().includes("buildstatus");

      if (missingStatusColumn) {
        return runFallbackQuery();
      }

      return callback(err);
    }

    return enrichCarsWithParts(rows, callback);
  });
}

app.get("/cars/:userId", (req, res) => {
  const userId = req.params.userId;

  fetchCarsForUser(userId, ["ACTIVE"], (err, cars) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json(cars);
  });
});

app.get("/cars/history/:userId", (req, res) => {
  const userId = req.params.userId;

  fetchCarsForUser(userId, ["DELETED", "BOUGHT"], (err, cars) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({
      deleted: cars.filter((car) => String(car.BuildStatus || "").toUpperCase() === "DELETED"),
      bought: cars.filter((car) => String(car.BuildStatus || "").toUpperCase() === "BOUGHT")
    });
  });
});

app.patch("/cars/:carId/status", (req, res) => {
  const carId = Number(req.params.carId);
  const userId = Number((req.body && req.body.userId) || req.query.userId);
  const buildStatus = String((req.body && req.body.buildStatus) || req.query.buildStatus || "").toUpperCase();
  const allowedStatuses = new Set(["ACTIVE", "DELETED", "BOUGHT"]);

  if (!Number.isInteger(carId) || carId <= 0 || !Number.isInteger(userId) || userId <= 0 || !allowedStatuses.has(buildStatus)) {
    return res.status(400).json({ message: "Valid carId, userId, and buildStatus are required" });
  }

  const updateSql = "UPDATE Customized_car SET BuildStatus = ? WHERE CarID = ? AND UserID = ?";
  db.query(updateSql, [buildStatus, carId, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error while updating configuration status" });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    return res.json({ message: `Configuration marked as ${buildStatus.toLowerCase()}` });
  });
});

app.delete("/cars/:carId", (req, res) => {
  const carId = Number(req.params.carId);
  const bodyUserId = req.body && req.body.userId;
  const userId = Number(bodyUserId || req.query.userId);

  if (!Number.isInteger(carId) || carId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid carId and userId are required" });
  }

  const softDeleteSql = "UPDATE Customized_car SET BuildStatus = 'DELETED' WHERE CarID = ? AND UserID = ?";
  db.query(softDeleteSql, [carId, userId], (deleteErr, result) => {
    if (deleteErr) {
      console.error(deleteErr);
      return res.status(500).json({ message: "Database error while deleting configuration" });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    return res.json({ message: "Configuration moved to deleted builds" });
  });
});

app.post("/cars", (req, res) => {
  const { userId, baseCar, partId, partIds, totalPrice } = req.body;
  console.log("REQ.BODY totalPrice:", totalPrice);

  if (!userId || !baseCar) {
    return res.status(400).json({ message: "userId and baseCar are required" });
  }

  const normalizedPartIds = [
    ...new Set(
      (Array.isArray(partIds) ? partIds : [partId])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ];

  const primaryPartId = normalizedPartIds[0] || null;

  const sqlWithPart = `
    INSERT INTO Customized_car (BaseCar, TotalPrice, PartID, UserID)
    VALUES (?, ?, ?, ?)
  `;

  //db.query(sqlWithPart, [baseCar, Number(totalPrice) || 0, primaryPartId, userId], (err, result) => {
    const total = parseFloat(totalPrice);
    console.log("PARSED total:", total);
    
    db.query(sqlWithPart, [baseCar, total, primaryPartId, userId], (err, result) => {
    if (!err) {
      const carId = result.insertId;

      if (normalizedPartIds.length === 0) {
        return res.json({
          message: "Vehicle configuration saved",
          carId
        });
      }

      const createCarPartsTableSql = `
        CREATE TABLE IF NOT EXISTS Customized_car_parts (
          CarID INT NOT NULL,
          PartID INT NOT NULL,
          PRIMARY KEY (CarID, PartID),
          FOREIGN KEY (CarID) REFERENCES Customized_car(CarID) ON DELETE CASCADE,
          FOREIGN KEY (PartID) REFERENCES Parts(PartID)
        )
      `;

      db.query(createCarPartsTableSql, (tableErr) => {
        if (tableErr) {
          console.error(tableErr);
          return res.json({
            message: "Vehicle configuration saved",
            carId
          });
        }
          
        console.log("NORMALIZED PART IDS:", normalizedPartIds);
        const values = normalizedPartIds.map((pid) => [carId, pid]);
        const insertCarPartsSql = "INSERT IGNORE INTO Customized_car_parts (CarID, PartID) VALUES ?";

        db.query(insertCarPartsSql, [values], (partsErr) => {
          if (partsErr) {
            console.error(partsErr);
          }

          return res.json({
            message: "Vehicle configuration saved",
            carId
          });
        });
      });

      return;
    }

    const isMissingPartIdColumn =
      err &&
      (err.code === "ER_BAD_FIELD_ERROR" ||
        String(err.sqlMessage || "").toLowerCase().includes("unknown column") ||
        String(err.sqlMessage || "").includes("PartID"));

    if (!isMissingPartIdColumn) {
      console.error(err);
      return res.status(500).json({
        message: err.sqlMessage || "Database error while saving configuration"
      });
    }

    // Fallback for local schemas that do not include PartID in Customized_car.
    const sqlNoPart = `
      INSERT INTO Customized_car (BaseCar, TotalPrice, UserID)
      VALUES (?, ?, ?)
    `;

    db.query(sqlNoPart, [baseCar, Number(totalPrice) || 0, userId], (fallbackErr, fallbackResult) => {
      if (fallbackErr) {
        console.error(fallbackErr);
        return res.status(500).json({ message: "Database error while saving configuration" });
      }

      res.json({
        message: "Vehicle configuration saved",
        carId: fallbackResult.insertId
      });
    });
  });
});

app.put("/cars/:carId", (req, res) => {
  const carId = Number(req.params.carId);
  const { userId, baseCar, partIds, totalPrice } = req.body;

  if (!carId || !userId || !baseCar) {
    return res.status(400).json({ message: "carId, userId, and baseCar arerequired" });
  }
 
  const updateCarSql = `UPDATE Customized_car SET BaseCar = ?, TotalPrice = ? WHERE CarID = ? AND UserID = ?`;

  db.query(updateCarSql, [baseCar, totalPrice, carId, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error updating car" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Car not found" });
    }

    const deletePartsSql = "DELETE FROM Customized_car_parts WHERE CarID = ?";

    db.query(deletePartsSql, [carId], (deleteErr) => {
      if (deleteErr) {
        console.error(deleteErr);
      }
      
      if (!partIds || partIds.length === 0) {
        return res.json({ message: "Car updated successfully" });
      }

      const values = partIds.map(pid => [carId, Number(pid)]);
      const insertPartsSql = `INSERT INTO Customized_car_parts (CarID, PartID) VALUES ?`;

      db.query(insertPartsSql, [values], (partsErr) => {
        if (partsErr) {
          console.error(partsErr);
        }

        return res.json({ message: "Car updated successfully" });
      });
    });
  });
});

// ==========================================
// TRADE MARKETPLACE ROUTES
// ==========================================

app.get("/trades", (req, res) => {
  const sql = `
    SELECT Trades.*, User.UserName, Parts.Name AS PartName
    FROM Trades
    JOIN User ON Trades.OwnerUserID = User.UserID
    LEFT JOIN Parts ON Trades.OfferedPartID = Parts.PartID
    WHERE Trades.Status = 'OPEN'
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);
  });
});

app.post("/createTrade", (req, res) => {
  const { OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL } = req.body;

  const ownerUserId = Number(OwnerUserID);
  const offeredPartId = Number(OfferedPartID);
  const minPrice = Number(DesiredMinPrice);
  const maxPrice = Number(DesiredMaxPrice);

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0 || !Number.isInteger(offeredPartId) || offeredPartId <= 0) {
    return res.status(400).json({ message: "Valid OwnerUserID and OfferedPartID are required" });
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice < 0 || maxPrice < 0 || minPrice > maxPrice) {
    return res.status(400).json({ message: "Valid DesiredMinPrice and DesiredMaxPrice are required" });
  }

  const condition = String(ConditionDescription || "").trim();
  if (!condition) {
    return res.status(400).json({ message: "ConditionDescription is required" });
  }

  const sql = `
    INSERT INTO Trades
    (OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL, Status)
    VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
  `;

  db.query(sql, [ownerUserId, offeredPartId, minPrice, maxPrice, condition, ImageURL || null], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade created successfully", tradeId: results.insertId });
  });
});

app.post("/acceptTrade/:id", (req, res) => {
  const tradeId = Number(req.params.id);
  const userId = Number(req.body.userId);

  if (!Number.isInteger(tradeId) || tradeId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid trade id and userId are required" });
  }

  // Verify that the user is the trade owner
  const verifySql = "SELECT OwnerUserID FROM Trades WHERE TradeID = ?";
  db.query(verifySql, [tradeId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Trade not found" });
    }

    if (results[0].OwnerUserID !== userId) {
      return res.status(403).json({ message: "Only the trade owner can accept trades" });
    }

    const sql = "UPDATE Trades SET Status = 'ACCEPTED' WHERE TradeID = ?";
    db.query(sql, [tradeId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({ message: "Trade accepted successfully" });
    });
  });
});

app.post("/createOffer", (req, res) => {
  const { TradeID, OfferingUserID, OfferedPartDescription } = req.body;

  const tradeId = Number(TradeID);
  const offeringUserId = Number(OfferingUserID);
  const offeredPartDescription = String(OfferedPartDescription || "").trim();

  if (!Number.isInteger(tradeId) || tradeId <= 0 || !Number.isInteger(offeringUserId) || offeringUserId <= 0 || !offeredPartDescription) {
    return res.status(400).json({ message: "Valid TradeID, OfferingUserID, and OfferedPartDescription are required" });
  }

  const sql = `INSERT INTO TradeOffers (TradeID, OfferingUserID, OfferedPartDescription) VALUES (?, ?, ?)`;

  db.query(sql, [tradeId, offeringUserId, offeredPartDescription], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade offer submitted!" });
  });
});

app.get("/offers/:tradeId", (req, res) => {
  const sql = `SELECT TradeOffers.*, User.UserName FROM TradeOffers JOIN User ON TradeOffers.OfferingUserID = User.UserID WHERE TradeOffers.TradeID = ?`;

  db.query(sql, [req.params.tradeId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);
  });
});

app.post("/acceptOffer/:id", (req, res) => {
  const offerId = Number(req.params.id);
  const userId = Number(req.body.userId);

  if (!Number.isInteger(offerId) || offerId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Valid offer id and userId are required" });
  }

  const getOfferSql = `SELECT TradeID FROM TradeOffers WHERE OfferID = ?`;
  db.query(getOfferSql, [offerId], (offerErr, offerResults) => {
    if (offerErr) {
      console.error(offerErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (!offerResults || offerResults.length === 0) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const tradeId = offerResults[0].TradeID;

    // Verify that the user is the trade owner
    const verifySql = "SELECT OwnerUserID FROM Trades WHERE TradeID = ?";
    db.query(verifySql, [tradeId], (verifyErr, verifyResults) => {
      if (verifyErr) {
        console.error(verifyErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (!verifyResults || verifyResults.length === 0) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (verifyResults[0].OwnerUserID !== userId) {
        return res.status(403).json({ message: "Only the trade owner can accept offers" });
      }

      const acceptTradeSql = "UPDATE Trades SET Status = 'ACCEPTED' WHERE TradeID = ?";
      db.query(acceptTradeSql, [tradeId], (tradeErr) => {
        if (tradeErr) {
          console.error(tradeErr);
          return res.status(500).json({ error: "Database error" });
        }

        const cleanupOffersSql = "DELETE FROM TradeOffers WHERE TradeID = ?";
        db.query(cleanupOffersSql, [tradeId], (cleanupErr) => {
          if (cleanupErr) {
            console.error(cleanupErr);
            return res.status(500).json({ error: "Database error" });
          }

          res.json({ message: "Offer accepted and trade completed" });
        });
      });
    });
  });
});

app.post("/declineOffer/:id", (req, res) => {
  const offerId = Number(req.params.id);

  if (!Number.isInteger(offerId) || offerId <= 0) {
    return res.status(400).json({ message: "Valid offer id is required" });
  }

  const sql = "DELETE FROM TradeOffers WHERE OfferID = ?";

  db.query(sql, [offerId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Offer declined." });
  });
});

app.post("/clearTrades", (req, res) => {
  const deleteOffersSql = "DELETE FROM TradeOffers";
  db.query(deleteOffersSql, (offersErr) => {
    if (offersErr) {
      console.error(offersErr);
      return res.status(500).json({ error: "Database error" });
    }

    const deleteTradesSql = "DELETE FROM Trades";
    db.query(deleteTradesSql, (tradesErr, tradeResults) => {
      if (tradesErr) {
        console.error(tradesErr);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({
        message: "All trades removed.",
        removedTrades: tradeResults.affectedRows
      });
    });
  });
});

// ==========================================
// EMPLOYEE AUTHENTICATION & ROUTES
// ==========================================

app.post("/Employeelogin", (req, res) => {
  const { EmployeeID, password } = req.body;

  if (!EmployeeID || !password) {
    return res.status(400).json({ message: "Employee ID and password required" });
  }

  const sql = `SELECT * FROM Employees JOIN EmployeePerformance ON Employees.EmployeeID = EmployeePerformance.EmployeeID 
               WHERE Employees.EmployeeID = ? AND EmployeePerformance.ActivelyEmployed = TRUE`;
  
  db.query(sql, [EmployeeID], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Login failed" });
    }

    const employee = results[0];

    if (employee.Password !== password) {
      return res.status(401).json({ message: "Login failed" });
    }

    res.json({
      message: "Login successful",
      employeeId: employee.EmployeeID,
      firstName: employee.FirstName,
      lastName: employee.LastName,
      isManager: employee.Management === 1,
      userType: "employee"
    });
  });
});

// ==========================================
// EMPLOYEE SCHEDULE & INFORMATION ROUTES
// ==========================================

app.get("/getSchedule", (req, res) => {
  const employeeID = req.query.EmployeeID;

  if (!employeeID) {
    return res.status(400).json({ message: "EmployeeID is required" });
  }

  const sql = `SELECT Employees.EmployeeID, Employees.FirstName, Employees.LastName, Schedule.MonthNum, Schedule.WeekNum, Schedule.Mon, Schedule.Tue, Schedule.Wed, Schedule.Thu, Schedule.Fri, Schedule.Sat, Schedule.Sun 
               FROM Schedule JOIN Employees ON Schedule.EmployeeID = Employees.EmployeeID WHERE Schedule.EmployeeID = ?`;
  
  db.query(sql, [employeeID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    res.json(results);
  });
});

app.get("/getPoints", (req, res) => {
  const employeeID = req.query.EmployeeID;

  if (!employeeID) {
    return res.status(400).json({ message: "EmployeeID is required" });
  }

  const sql = `SELECT Points FROM EmployeePerformance WHERE EmployeeID = ?`;
  
  db.query(sql, [employeeID], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    if (result.length === 0) {
      return res.json({ Points: 0 });
    }
    res.json(result[0]);
  });
});

app.get("/getEmployeePay", (req, res) => {
  const employeeID = req.query.EmployeeID;

  if (!employeeID) {
    return res.status(400).json({ message: "EmployeeID is required" });
  }

  const sql = `SELECT HourlyPay FROM Employees WHERE EmployeeID = ?`;
  
  db.query(sql, [employeeID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(results[0]);
  });
});

app.get("/contactInfo", (req, res) => {
  const employeeID = req.query.EmployeeID;

  if (!employeeID) {
    return res.status(400).json({ message: "EmployeeID is required" });
  }

  const sql = `SELECT PhoneNumber, EmergencyPhoneNumber, Address, PersonalEmail, WorkEmail FROM EmployeeContactInfo WHERE EmployeeID = ?`;
  
  db.query(sql, [employeeID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Employee contact info not found" });
    }
    res.json(results[0]);
  });
});

// ==========================================
// EMPLOYEE TIME OFF MANAGEMENT
// ==========================================

app.post("/request-dayoff", (req, res) => {
  const { EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason, Type } = req.body;
  const employeeId = String(EmployeeID || "").trim();
  const monthNum = Number(MonthNum);
  const weekNum = Number(WeekNum);
  const normalizedDay = String(DayOfWeek || "").trim();
  const reason = String(Reason || "").trim();
  const requestType = (Type || "off").toString().trim().toLowerCase() === "work" ? "work" : "off";
  const validDays = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

  if (!employeeId || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 || !Number.isInteger(weekNum) || weekNum < 1 || weekNum > 6 || !validDays.has(normalizedDay) || !reason) {
    return res.status(400).json({ message: "Valid EmployeeID, MonthNum, WeekNum, DayOfWeek, and Reason are required" });
  }

  const sql = `INSERT INTO TimeOffRequests (EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason, Type, Status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`;
  
  db.query(sql, [employeeId, monthNum, weekNum, normalizedDay, reason, requestType], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Request failed");
    }
    res.send("Request submitted!");
  });
});

// ==========================================
// MANAGER-ONLY ROUTES
// ==========================================

app.get("/getTimeOffRequests", (req, res) => {
  const sql = `SELECT TimeOffRequests.*, Employees.FirstName, Employees.LastName FROM TimeOffRequests 
               JOIN Employees ON TimeOffRequests.EmployeeID = Employees.EmployeeID WHERE Status = 'Pending'`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json(results);
  });
});

app.post("/approveRequest", (req, res) => {
  const { RequestID } = req.body;

  if (!RequestID) {
    return res.status(400).json({ message: "RequestID is required" });
  }

  const getRequest = `SELECT EmployeeID, MonthNum, WeekNum, DayOfWeek, Type FROM TimeOffRequests WHERE RequestID = ?`;
  
  db.query(getRequest, [RequestID], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    const request = results[0];
    let dayColumn = request.DayOfWeek;

    // Map day names to column names
    const dayMap = {
      "Monday": "Mon",
      "Tuesday": "Tue",
      "Wednesday": "Wed",
      "Thursday": "Thu",
      "Friday": "Fri",
      "Saturday": "Sat",
      "Sunday": "Sun"
    };
    
    dayColumn = dayMap[dayColumn] || dayColumn;

    const validScheduleColumns = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!validScheduleColumns.includes(dayColumn)) {
      return res.status(400).json({ message: "Invalid day of week on request" });
    }

    const type = (request.Type || "").toString().trim().toLowerCase();
    const scheduleValue = type === "work" ? 1 : 0;

    const updateSchedule = `UPDATE Schedule SET ${dayColumn} = ? WHERE EmployeeID = ? AND MonthNum = ? AND WeekNum = ?`;
    db.query(updateSchedule, [scheduleValue, request.EmployeeID, request.MonthNum, request.WeekNum], (err, scheduleResult) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Schedule update error");
      }

      if (!scheduleResult || scheduleResult.affectedRows === 0) {
        return res.status(404).send("No schedule row matched this request. Check month/week/day.");
      }
      
      const updateStatus = `UPDATE TimeOffRequests SET Status = 'Approved' WHERE RequestID = ?`;
      db.query(updateStatus, [RequestID], (statusErr) => {
        if (statusErr) {
          console.error(statusErr);
          return res.status(500).send("Status update error");
        }
        res.send("Approved");
      });
    });
  });
});

app.post("/denyRequest", (req, res) => {
  const { RequestID } = req.body;

  if (!RequestID) {
    return res.status(400).json({ message: "RequestID is required" });
  }

  const sql = `UPDATE TimeOffRequests SET Status = 'Denied' WHERE RequestID = ?`;
  
  db.query(sql, [RequestID], (err) => {
    if (err) {
      console.error(err);
      return res.send("Database error");
    }
    res.send("Denied");
  });
});

app.get("/getEmployeeStats", (req, res) => {
  const employeeID = req.query.EmployeeID;
  const sql = `SELECT Employees.EmployeeID, Employees.FirstName, Employees.LastName, Employees.HourlyPay,
               EmployeePerformance.Points, EmployeePerformance.Comments, EmployeePerformance.ActivelyEmployed
               FROM Employees JOIN EmployeePerformance ON Employees.EmployeeID = EmployeePerformance.EmployeeID
               WHERE Employees.EmployeeID = ?`;
  
  db.query(sql, [employeeID], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(results[0]);
  });
});

app.get("/getEmployees", (req, res) => {
  const sql = `SELECT EmployeeID, FirstName, LastName, HireDate FROM Employees`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json(results);
  });
});

app.post("/addPoints", (req, res) => {
  const { EmployeeID, points } = req.body;
  const sql = `UPDATE EmployeePerformance SET Points = Points + ? WHERE EmployeeID = ?`;
  
  db.query(sql, [points, EmployeeID], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json({ message: "Points added" });
  });
});

app.post("/terminateEmployee", (req, res) => {
  const { EmployeeID } = req.body;
  const sql = `UPDATE EmployeePerformance SET ActivelyEmployed = FALSE WHERE EmployeeID = ?`;
  db.query(sql, [EmployeeID], (err) => {
    if (err) { console.error(err); return res.status(500).send("Database error"); }
    res.json({ message: "Employee terminated" });
  });
});

app.post("/giveRaise", (req, res) => {
  const { EmployeeID, raise } = req.body;
  const sql = `UPDATE Employees SET HourlyPay = HourlyPay + ? WHERE EmployeeID = ?`;
  db.query(sql, [raise, EmployeeID], (err) => {
    if (err) { console.error(err); return res.status(500).send("Database error"); }
    res.json({ message: "Raise applied" });
  });
});

app.post("/recognitionComment", (req, res) => {
  const { EmployeeID, comment } = req.body;
  const sql = `UPDATE EmployeePerformance SET Comments = ? WHERE EmployeeID = ?`;
  db.query(sql, [comment, EmployeeID], (err) => {
    if (err) { console.error(err); return res.status(500).send("Database error"); }
    res.json({ message: "Comment saved" });
  });
});

app.post("/promoteManager", (req, res) => {
  const { EmployeeID } = req.body;
  const sql = `UPDATE Employees SET Management = TRUE WHERE EmployeeID = ?`;
  db.query(sql, [EmployeeID], (err) => {
    if (err) { console.error(err); return res.status(500).send("Database error"); }
    res.json({ message: "Employee promoted to manager" });
  });
});

app.post("/rehireEmployee", (req, res) => {
  const { EmployeeID } = req.body;
  const sql = `UPDATE EmployeePerformance SET ActivelyEmployed = TRUE WHERE EmployeeID = ?`;
  db.query(sql, [EmployeeID], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json({ message: "Employee rehired" });
  });
});

app.post("/changePassword", (req, res) => {
  const { EmployeeID, oldPassword, newPassword } = req.body;
  const sql = `SELECT Password FROM Employees WHERE EmployeeID = ?`;
  db.query(sql, [EmployeeID], (err, results) => {
    if (err) { console.error(err); return res.status(500).send("Database error"); }
    if (results.length === 0) return res.status(404).send("Employee not found");
    if (results[0].Password !== oldPassword) return res.status(401).send("Old password incorrect");
    const updateSql = `UPDATE Employees SET Password = ? WHERE EmployeeID = ?`;
    db.query(updateSql, [newPassword, EmployeeID], (err2) => {
      if (err2) { console.error(err2); return res.status(500).send("Database error"); }
      res.send("Password updated successfully");
    });
  });
});

/* ==========================================
   DISCUSSION THREAD FEATURE
========================================== */

// Get recent discussions
app.get("/discussions", (req, res) => {
    const sql = "SELECT Discussions.*, User.UserName FROM Discussions JOIN User ON Discussions.UserID = User.UserID ORDER BY CreatedAt DESC LIMIT 10";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

// Create a discussion
app.post("/discussions", (req, res) => {
    const { userId, title, content } = req.body;
    if (!userId || !title || !content) return res.status(400).json({ error: "Missing fields" });
    const sql = "INSERT INTO Discussions (UserID, Title, Content) VALUES (?, ?, ?)";
    db.query(sql, [userId, title, content], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Discussion created!", discussionId: results.insertId });
    });
});

// Get replies for a discussion
app.get("/discussions/:id/replies", (req, res) => {
    const discussionId = req.params.id;
    const sql = "SELECT DiscussionReplies.*, User.UserName FROM DiscussionReplies JOIN User ON DiscussionReplies.UserID = User.UserID WHERE DiscussionID = ? ORDER BY CreatedAt ASC";
    db.query(sql, [discussionId], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

// Post a reply
app.post("/discussions/:id/replies", (req, res) => {
    const discussionId = req.params.id;
    const { userId, content } = req.body;
    if (!userId || !content) return res.status(400).json({ error: "Missing fields" });
    const sql = "INSERT INTO DiscussionReplies (DiscussionID, UserID, Content) VALUES (?, ?, ?)";
    db.query(sql, [discussionId, userId, content], (err) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Reply posted!" });
    });
});

/* ==========================================
   DELETE DISCUSSION (ONLY OWNER)
========================================== */
app.delete("/discussions/:id", (req, res) => {
    const discussionId = req.params.id;
    const userId = Number(req.body.userId);

    // 🔍 DEBUG LOG (VERY IMPORTANT)
    console.log("DELETE request received:", {
        discussionId,
        userId
    });

    const sql = "DELETE FROM Discussions WHERE DiscussionID = ? AND UserID = ?";

    db.query(sql, [discussionId, userId], (err, result) => {
        if (err) {
            console.error("❌ DELETE ERROR:", err); // shows exact DB issue
            return res.status(500).json({ error: "Database error" });
        }

        if (result.affectedRows === 0) {
            console.warn("⚠️ Delete blocked: not owner or post doesn't exist");
            return res.status(403).json({ error: "Not authorized to delete this post" });
        }

        console.log("✅ Post deleted successfully");
        res.json({ message: "Post deleted" });
    });
});


/* ==========================================
   BOOKMARK TOGGLE (ADD / REMOVE)
========================================== */
app.post("/bookmarks", (req, res) => {
    const { userId, discussionId } = req.body;

    console.log("Bookmark toggle:", { userId, discussionId });

    const checkSql = "SELECT * FROM Bookmarks WHERE UserID = ? AND DiscussionID = ?";

    db.query(checkSql, [userId, discussionId], (err, results) => {
        if (err) {
            console.error("❌ Bookmark check error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
            // 🔴 REMOVE bookmark
            const deleteSql = "DELETE FROM Bookmarks WHERE UserID = ? AND DiscussionID = ?";
            db.query(deleteSql, [userId, discussionId], (err) => {
                if (err) {
                    console.error("❌ Bookmark delete error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                console.log("⭐ Bookmark removed");
                res.json({ bookmarked: false });
            });

        } else {
            // 🟢 ADD bookmark
            const insertSql = "INSERT INTO Bookmarks (UserID, DiscussionID) VALUES (?, ?)";
            db.query(insertSql, [userId, discussionId], (err) => {
                if (err) {
                    console.error("❌ Bookmark insert error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                console.log("⭐ Bookmark added");
                res.json({ bookmarked: true });
            });
        }
    });
});


/* ==========================================
   GET BOOKMARKED POSTS
========================================== */
app.get("/bookmarks/:userId", (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT Discussions.*, User.UserName
        FROM Bookmarks
        JOIN Discussions ON Bookmarks.DiscussionID = Discussions.DiscussionID
        JOIN User ON Discussions.UserID = User.UserID
        WHERE Bookmarks.UserID = ?
        ORDER BY Discussions.CreatedAt DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("❌ Fetch bookmarks error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(results);
    });
});
// ==========================================
// PARTS REVIEWS ROUTES
// ==========================================

app.get("/api/partsreviews/:partId", (req, res) => {
  const partId = parseInt(req.params.partId, 10);
  if (isNaN(partId)) {
    return res.status(400).json({ error: "Invalid part ID" });
  }
  db.query(
    `
      SELECT partsreviews.*, User.UserName AS ReviewUserName
      FROM partsreviews
      LEFT JOIN User ON User.UserID = partsreviews.UserID
      WHERE PartID = ?
      ORDER BY posted DESC
    `,
    [partId],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results);
    }
  );
});

app.post("/api/partsreviews", (req, res) => {
  const { PartID, rating, comment, userId } = req.body;
  const parsedPartId = parseInt(PartID, 10);
  const parsedRating = parseInt(rating, 10);
  const parsedUserId = parseInt(userId, 10);

  if (!parsedPartId || isNaN(parsedPartId) || !parsedRating || isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5 || !parsedUserId || isNaN(parsedUserId)) {
    return res.status(400).json({ error: "Missing or invalid required fields" });
  }

  db.query(
    "INSERT INTO partsreviews (PartID, PartRating, comment, UserID) VALUES (?, ?, ?, ?)",
    [parsedPartId, parsedRating, comment || null, parsedUserId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ success: true });
    }
  );
});

app.delete("/api/partsreviews/:reviewId", (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  const userId = parseInt((req.body && req.body.userId) || req.query.userId, 10);

  if (!reviewId || isNaN(reviewId) || !userId || isNaN(userId)) {
    return res.status(400).json({ error: "Missing or invalid review/user ID" });
  }

  db.query(
    "DELETE FROM partsreviews WHERE PartReviewID = ? AND UserID = ?",
    [reviewId, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!result || result.affectedRows === 0) {
        return res.status(403).json({ error: "Not authorized to delete this review" });
      }

      res.json({ success: true });
    }
  );
});

// ==========================================
// SERVER START
// ==========================================

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
