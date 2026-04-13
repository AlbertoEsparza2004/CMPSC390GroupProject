const express = require("express");
const path = require("path");
const db = require("./db");

const PORT = 3000;
const app = express();

// Middleware
app.use(express.json());

// Serve static files from the project root
// Example: http://localhost:3000/Sprint2Alberto/CustomerSingInPage.html
app.use(express.static(path.join(__dirname, "..")));

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

    const partSql = "SELECT PartID, Name FROM Parts WHERE PartID IN (?)";
    db.query(partSql, [primaryPartIds], (partsErr, partRows) => {
      if (partsErr) {
        console.error(partsErr);
        return callback(null, hydratedCars);
      }

      const partMap = new Map();
      (partRows || []).forEach((part) => {
        partMap.set(Number(part.PartID), part.Name || `Part ${part.PartID}`);
      });

      hydratedCars.forEach((car) => {
        const pid = Number(car.PartID);
        if (Number.isInteger(pid) && pid > 0) {
          car.Parts = [{
            PartID: pid,
            Name: partMap.get(pid) || `Part ${pid}`
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
    SELECT ccp.CarID, p.PartID, p.Name
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
        Name: row.Name || `Part ${row.PartID}`
      });
    });

    hydratedCars.forEach((car) => {
      if (car.Parts.length === 0) {
        const pid = Number(car.PartID);
        if (Number.isInteger(pid) && pid > 0) {
          car.Parts = [{
            PartID: pid,
            Name: `Part ${pid}`
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
// SERVER START
// ==========================================

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
