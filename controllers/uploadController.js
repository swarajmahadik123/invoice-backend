import fs from "fs";
import path from "path";
import multer from "multer";

// Get the directory name dynamically for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Set up multer storage and file filter
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      "D:",
      "MERN projects",
      "invoice al",
      "backend",
      "uploads"
    );
    cb(null, uploadPath); // No need to create the directory if it already exists
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format"), false);
  }
};

// Initialize Multer
const upload = multer({ storage, fileFilter });

// Controller for handling file uploads
export const uploadFiles = (req, res) => {
  // Check if files are uploaded
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files selected" });
  }

  // Simulate AI extraction process
  const simulateExtraction = new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("Data extracted successfully!");
    }, 5000);
  });

  simulateExtraction
    .then((message) => {
      res.status(200).json({ message, files: req.files });
    })
    .catch((err) => {
      res.status(500).json({ message: "Error during extraction", error: err });
    });
};

// Multer middleware to handle file uploads (for array of files)
export const uploadMiddleware = upload.array("files"); // Ensure this matches the name attribute in the frontend input
