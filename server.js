const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

mongoose.connect(
  "mongodb+srv://atsuser:Siva_db_2109@cluster0.f6flvb1.mongodb.net/ats_checker"
);

const User = mongoose.model("User", new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  otp: String,
  otpExpires: Date,
  monthlyChecks: { type: Number, default: 0 },
  lastReset: Date
}));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "sivaprasadsingle@gmail.com",
    pass: "ppqabphhupvagwqv"
  }
});

function resetMonthlyUsage(user) {
  const now = new Date();
  if (!user.lastReset || now.getMonth() !== user.lastReset.getMonth()) {
    user.monthlyChecks = 0;
    user.lastReset = now;
  }
}

app.post("/send-otp", async (req, res) => {
  const { email, firstName, lastName } = req.body;

  let user = await User.findOne({ email });
  if (!user && (!firstName || !lastName)) {
    return res.status(400).json({ error: "Name required for signup" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  if (!user) user = new User({ email, firstName, lastName });
  user.otp = otp;
  user.otpExpires = expiry;

  await user.save();

  await transporter.sendMail({
    to: email,
    subject: "Your OTP",
    html: `<h2>${otp}</h2>`
  });

  res.sendStatus(200);
});

app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.otp !== otp || new Date() > user.otpExpires) {
    return res.sendStatus(401);
  }

  user.otp = null;
  resetMonthlyUsage(user);
  await user.save();

  res.sendStatus(200);
});

app.get("/account/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const user = await User.findOne({ email });
  if (!user) return res.sendStatus(404);

  res.json({
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    remaining: 2 - user.monthlyChecks
  });
});

app.post("/analyze", upload.single("resume"), async (req, res) => {
  const { email, jd } = req.body;
  const user = await User.findOne({ email });
  if (!user || !req.file || !jd) return res.sendStatus(400);

  resetMonthlyUsage(user);
  if (user.monthlyChecks >= 2)
    return res.status(403).json({ error: "Monthly limit reached" });

  user.monthlyChecks += 1;
  await user.save();

  res.json({
    score: 78,
    keywords: 65,
    format: "Good",
    remainingChecks: 2 - user.monthlyChecks
  });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
