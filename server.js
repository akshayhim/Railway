import mysql from "mysql2";
import express from "express";
const app = express();
import cors from "cors";
import bcrypt from "bcrypt";

app.use(cors());
app.use(express.json());

const conn = mysql
  .createPool({
    host: "127.0.0.1",
    user: "root",
    password: "kiit",
    database: "railway",
  })
  .promise();

//----------------------------------------------------------------------

function generateRandomPNR() {
  return Math.floor(100000 + Math.random() * 900000);
}

async function searchTrains(source, destination) {
  const [rows] = await conn.query(
    "SELECT * FROM Train WHERE Source = ? AND Destination = ?",
    [source, destination]
  );
  return rows;
}

async function getTrainDetails(trainId) {
  const [rows] = await conn.query(
    "SELECT * FROM TrainDetails WHERE TrainNo = ?",
    [trainId]
  );
  return rows;
}

//-----------------------------------------------------------------------

app.post("/register", async (req, res) => {
  const { email, password, name, age, gender } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [result] = await conn.query(
      "INSERT INTO Customer (Email, Password, Name, Age, Gender) VALUES (?, ?, ?, ?, ?)",
      [email, hashedPassword, name, age, gender]
    );

    req.session.userId = result.insertId;
    req.session.userName = name;

    res
      .status(201)
      .json({ message: "Registration successful", userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/search", async (req, res) => {
  const { source, destination } = req.query;

  try {
    const data = await searchTrains(source, destination);
    if (data.length > 0) {
      res.status(200).json({ message: "Successfully fetched", data });
    } else {
      res.status(404).json({ error: "No available trains" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/traindetails/:id", async (req, res) => {
  const trainId = req.params.id;

  try {
    const details = await getTrainDetails(trainId);
    if (details.length > 0) {
      res.status(200).json({ message: "Successfully fetched", details });
    } else {
      res.status(404).json({ error: "Train details not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/bookseat", async (req, res) => {
  const { trainNo, classType } = req.body;

  try {
    const [trainDetails] = await conn.query(
      "SELECT TrainName, ${classType}Price, Source, Destination FROM TrainDetails WHERE TrainId = ?",
      [trainNo]
    );
    const { TrainName, Price, Source, Destination } = trainDetails[0];

    const [result] = await conn.query(
      "INSERT INTO Transaction (trainNo, trainName, price, PNR, Source, Destn, CustomerID, CustomerName, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        trainNo,
        TrainName,
        Price,
        generateRandomPNR(),
        Source,
        Destination,
        req.session.userId,
        req.session.userName,
        "Pending",
      ]
    );

    res.status(201).json({
      message: "Seat booked successfully",
      bookingId: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/confirmticket/:bookingId", async (req, res) => {
  const bookingId = req.params.bookingId;

  try {
    await conn.query(
      'UPDATE Transaction SET Status = "Confirm" WHERE BookingID = ?',
      [bookingId]
    );

    const [bookingResult] = await conn.query(
      "SELECT trainNo FROM Transaction WHERE BookingID = ?",
      [bookingId]
    );
    const trainNo = bookingResult[0].trainNo;

    const { classType } = req.body;

    // Decrementing available seats for the selected class in TrainDetails table
    await conn.query(
      `UPDATE TrainDetails SET ${classType}Seats = ${classType}Seats - 1 WHERE TrainNo = ?`,
      [trainNo]
    );

    res.status(200).json({ message: "Ticket confirmed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//-------------------------------------------------------------------------

app.listen(5000, () => {
  console.log(`Server is up and running on http://localhost:${PORT}`);
});
