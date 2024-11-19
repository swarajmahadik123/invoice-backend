import fs from "fs/promises";
import path from "path";
import multer from "multer";
import xlsx from "xlsx";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Get the directory name dynamically for ES modules
const __dirname = "D:Swipeinvoice-backend";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI("AIzaSyCD4D_rJxIZWOlJkn-JTpqQXMEvnJKpGc0");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const fileManager = new GoogleAIFileManager(
  "AIzaSyCD4D_rJxIZWOlJkn-JTpqQXMEvnJKpGc0"
);

// Enhanced multer storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");

    try {
      // Use async mkdir to ensure directory exists
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

// Comprehensive file filter with more detailed validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Excel
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word
  ];

  // Check both MIME type and file extension
  const allowedExtensions = [".xlsx", ".pdf", ".jpeg", ".png", ".jpg", ".docx"];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (
    allowedTypes.includes(file.mimetype) ||
    allowedExtensions.includes(fileExtension)
  ) {
    cb(null, true);
  } else {
    const error = new Error("Unsupported file format");
    error.code = "UNSUPPORTED_FILE_TYPE";
    cb(error, false);
  }
};

// Initialize Multer with enhanced configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Limit number of files to 5
  },
});

// Function to extract data from Excel file
function extractExcelData(filePath) {
  try {
    // Read the workbook
    const workbook = xlsx.readFile(filePath);

    // Get the first sheet name
    const sheetName = workbook.SheetNames[0];

    // Convert sheet to JSON
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    return jsonData;
  } catch (error) {
    console.error("Error extracting Excel data:", error);
    throw new Error(`Failed to extract data from Excel: ${error.message}`);
  }
}

// Improved file processing function with robust error handling
async function processFiles(files) {
  const processedData = {
    invoices: [],
    products: [],
    customers: [],
    rawData: [],
  };
  const processingErrors = [];

  for (const file of files) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (fileExtension === ".xlsx") {
        // Extract data directly from Excel
        const excelJson = extractExcelData(file.path);
        processedData.rawData.push({
          filename: file.originalname,
          data: excelJson,
        });

        try {
          const result = await model.generateContent([
            {
              text: "Please analyze this Excel JSON data and extract information into three structured tables. The files may contain invoices, product information, and customer details. Return a JSON with invoices, products, and customers.",
            },
            {
              text: JSON.stringify(excelJson, null, 2),
            },
          ]);

          const cleanedText =
            result.response.candidates[0].content.parts[0].text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();

          const structuredData = JSON.parse(cleanedText);

          // Merge extracted data
          if (structuredData.invoices)
            processedData.invoices.push(...structuredData.invoices);
          if (structuredData.products)
            processedData.products.push(...structuredData.products);
          if (structuredData.customers)
            processedData.customers.push(...structuredData.customers);
        } catch (geminiError) {
          console.error("Gemini analysis error for Excel file:", geminiError);
          processingErrors.push({
            filename: file.originalname,
            errorMessage: geminiError.message,
          });
        }
      } else {
        // Process non-Excel files
        const uploadResponse = await fileManager.uploadFile(file.path, {
          mimeType: file.mimetype,
          displayName: file.originalname,
        });

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResponse.file.mimeType,
              fileUri: uploadResponse.file.uri,
            },
          },
          {
            text: "Please analyze these files and extract information into three structured tables. Return a JSON with invoices, products, and customers.",
          },
        ]);

        const cleanedText = result.response.candidates[0].content.parts[0].text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const structuredData = JSON.parse(cleanedText);

        // Merge extracted data
        if (structuredData.invoices)
          processedData.invoices.push(...structuredData.invoices);
        if (structuredData.products)
          processedData.products.push(...structuredData.products);
        if (structuredData.customers)
          processedData.customers.push(...structuredData.customers);
      }
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      processingErrors.push({
        filename: file.originalname,
        errorMessage: error.message,
      });
    }
  }

  return {
    processedData,
    processingErrors,
  };
}

// Upload files handler
export const uploadFiles = async (req, res) => {
  try {
    // Validate file upload
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files selected",
      });
    }

    // Process files with comprehensive error handling
    const { processedData, processingErrors } = await processFiles(req.files);

    // Async file cleanup
    const cleanupPromises = req.files.map(async (file) => {
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error(`Error deleting file ${file.originalname}:`, unlinkError);
      }
    });

    // Wait for all cleanup operations
    await Promise.all(cleanupPromises);

    // Prepare response for frontend
    const response = {
      success: true,
      data: {
        invoices: processedData.invoices,
        products: processedData.products,
        customers: processedData.customers,
        rawData: processedData.rawData,
      },
      filesProcessed: req.files.length,
    };

    // Add errors to response if any occurred
    if (processingErrors.length > 0) {
      response.errors = processingErrors;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Comprehensive upload handler error:", error);

    // Attempt to cleanup files even in error scenario
    if (req.files) {
      const cleanupPromises = req.files.map(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error(`Error deleting file in error handler:`, unlinkError);
        }
      });

      await Promise.all(cleanupPromises);
    }

    res.status(500).json({
      success: false,
      error: "Failed to process files",
      details: error.message,
    });
  }
};

// Multer middleware to handle file uploads (for array of files)
export const uploadMiddleware = upload.array("files", 5); // Limit to 5 files
