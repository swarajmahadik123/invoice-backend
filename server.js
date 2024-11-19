import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import uploadRoutes from "./routes/uploadRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("uploads")); // Serve uploaded files

// Routes
app.use("/api/upload", uploadRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
