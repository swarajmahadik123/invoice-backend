import express from "express";
import {
  uploadFiles,
  uploadMiddleware,
} from "../controllers/uploadController.js";

const router = express.Router();

// Route to handle file upload and extraction
router.post("/files", uploadMiddleware, uploadFiles);

export default router;
