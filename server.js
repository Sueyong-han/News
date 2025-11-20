import express from "express";
import cors from "cors";
import { analyzeNews } from "./api/newsAnalyzer.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.get("/", (req, res) => {
  res.send("News backend is running.");
});

app.get("/news", async (req, res) => {
  try {
    let placee = req.query.place || "에러 못 받음";
    console.log(`place: ${placee}`);
    const data = await analyzeNews(placee);
    
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));





