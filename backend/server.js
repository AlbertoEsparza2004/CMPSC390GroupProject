const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from the project root
// Example: http://localhost:3000/Sprint2Alberto/CustomerSingInPage.html
app.use(express.static(path.join(__dirname, "..")));

/* Root route */
app.get("/", (req, res) => {
  res.send("CMPSC390 Backend API is running (Charles - Backend).");
});

/* Test route */
app.get("/test", (req, res) => {
  res.send("Backend server is running successfully (charlesDev).");
});

/* GET all parts */
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

/* User login */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Basic validation
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
      userId: user.UserID ?? user.id ?? null,
      username: user.UserName ?? username,
    });
  });
});

/* Get customer by ID (for dashboard) */
app.get("/customer/:id", (req, res) => {
  const userId = req.params.id;

  const sql = "SELECT UserID, UserName FROM `User` WHERE UserID = ?";

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

/* Code for trade listings */
app.get("/trades", (req, res) => {

  const sql = "SELECT * FROM Trades WHERE Status = 'OPEN'";

  db.query(sql, (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);

  });

});


/* code that allows you to post a trade offer */
app.post("/createTrade", (req, res) => {

  const { OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL } = req.body;

  const sql = `
    INSERT INTO Trades
    (OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade created successfully" });

  });

});


/* code that lets you accept a trade */
app.post("/acceptTrade/:id", (req, res) => {

  const tradeId = req.params.id;

  const sql = "UPDATE Trades SET Status = 'ACCEPTED' WHERE TradeID = ?";

  db.query(sql, [tradeId], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade accepted successfully" });

  });

});

/* code that allows you to create a trade offer */
app.post("/createOffer", (req, res) => {

  const { TradeID, OfferingUserID, OfferedPartDescription } = req.body;

  const sql = `
  INSERT INTO TradeOffers (TradeID, OfferingUserID, OfferedPartDescription)
  VALUES (?, ?, ?)
  `;

  db.query(sql, [TradeID, OfferingUserID, OfferedPartDescription], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade offer submitted!" });

  });

});


/* code that lets you view offers for your trade */
app.get("/offers/:tradeId", (req, res) => {

  const sql = "SELECT * FROM TradeOffers WHERE TradeID = ?";

  db.query(sql, [req.params.tradeId], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);

  });

});

/* code that allows you to decline a trade offer*/
app.post("/declineOffer/:id", (req, res) => {

  const offerId = req.params.id;

  const sql = "DELETE FROM TradeOffers WHERE OfferID = ?";

  db.query(sql, [offerId], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Offer declined." });

  });

});

/* code that allows you to accept a specific offer */
app.post("/acceptOffer/:id", (req, res) => {

const offerId = req.params.id;

/* code that gets offer info */
const sql = `
SELECT TradeOffers.*, Trades.OwnerUserID
FROM TradeOffers
JOIN Trades ON TradeOffers.TradeID = Trades.TradeID
WHERE OfferID = ?
`;

db.query(sql,[offerId],(err,results)=>{

if(err){
console.error(err);
return res.status(500).json({error:"Database error"});
}

if(results.length === 0){
return res.status(404).json({message:"Offer not found"});
}

const offer = results[0];

/* code that updates trade as accepted */
const updateTrade = "UPDATE Trades SET Status='ACCEPTED' WHERE TradeID=?";

db.query(updateTrade,[offer.TradeID],(err)=>{

if(err){
console.error(err);
return res.status(500).json({error:"Database error"});
}

/* code that deletes other offers for this trade, since one has already been selected */
const deleteOthers = "DELETE FROM TradeOffers WHERE TradeID=? AND OfferID!=?";

db.query(deleteOthers,[offer.TradeID,offerId]);

res.json({
message:
"Trade complete! Please drop your part off at the nearest Legacy Auto location. If we do not receive your part within 30 days, you will be fined. If you dropped off a part and the other user did not, we will hold your part in storage for 90 days. You can close this message once you understand."
});

});

});

});
/* Start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});