import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Initialize Configuration
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so frontend (port 8000) can communicate securely with backend (port 5000)
app.use(cors());
app.use(express.json());

// Ensure Uploads directory exists to hold student paper scans
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploads folder statically so frontend can render uploaded images directly on canvas
app.use('/uploads', express.static(uploadDir));

// 2. Configure Multer File Upload Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 3. Initialize Google Gemini AI SDK
// Uses GEMINI_API_KEY environment variable. Defaults to a dummy placeholder if not set yet.
const apiKey = process.env.GEMINI_API_KEY || "";
let ai = null;

if (apiKey) {
  try {
    ai = new GoogleGenerativeAI(apiKey);
    console.log("🟢 Gemini Generative AI SDK successfully initialized!");
  } catch (err) {
    console.error("🔴 Error initializing Gemini Generative AI:", err.message);
  }
} else {
  console.warn("⚠️ GEMINI_API_KEY not found in environment. Running in sandbox simulation mode.");
}

// Helper to convert local file buffer into Gemini inline data format
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

// ==========================================================================
// API ROUTES
// ==========================================================================

/**
 * 1. Image OCR & Coordinate Mapping route
 * Receives student paper scan, runs Gemini Flash Vision, transcribes handwriting
 * and computes coordinate bounding boxes for questions.
 */
app.post('/api/upload', upload.single('paper'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    const filePath = req.file.path;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;

    // Sandbox Fallback if API key is not yet set up
    if (!ai) {
      console.log("ℹ️ No Gemini API Key. Returning simulated OCR and coordinates.");
      return res.json({
        fileName: req.file.filename,
        fileUrl,
        transcriptions: [
          {
            questionId: "q1",
            handwritingSample: "Photosynthesis is how plants make food. They use sunlight, water, and carbon dioxide inside the chloroplasts. This makes glucose and releases oxygen.",
            boundingBox: { x: 80, y: 195, width: 620, height: 105 }
          },
          {
            questionId: "q2",
            handwritingSample: "Mitosis is cell division. The chromosomes align in the middle and split apart into two identical cells. Stages: Prophase, Metaphase, Anaphase, Telophase.",
            boundingBox: { x: 80, y: 440, width: 620, height: 105 }
          },
          {
            questionId: "q3",
            handwritingSample: "Respiration breaks down sugar in the mitochondria to produce ATP energy for cells. Formula: glucose + oxygen -> carbon dioxide + water + ATP.",
            boundingBox: { x: 80, y: 690, width: 620, height: 105 }
          }
        ]
      });
    }

    console.log(`🤖 Starting Gemini OCR on uploaded file: ${req.file.filename}`);

    // Call Gemini 1.5 Flash Vision model for high-speed image handwriting transcription
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imagePart = fileToGenerativePart(filePath, fileType);
    
    const prompt = `
      You are an expert handwriting OCR engine. Analyze this student exam paper. 
      It is a ruled notebook sheet containing printed questions and handwritten answers underneath.
      
      Locate the three handwritten answers corresponding to the printed questions (Q1, Q2, Q3).
      For each answer:
      1. Transcribe the text exactly as written by the student.
      2. Provide approximate coordinate bounding boxes { x, y, width, height } relative to an 800x1100 canvas mapping where the handwriting is located.
         As a reference:
         - Q1 is situated on notebook lines roughly around y = 195 to 300.
         - Q2 is situated on notebook lines roughly around y = 440 to 545.
         - Q3 is situated on notebook lines roughly around y = 690 to 795.
         - Width of handwritten responses is approximately 620 pixels, starting at x = 80.
         
      Return your output strictly as a JSON array of objects, with no wrapping markdown block quotes:
      [
        {
          "questionId": "q1" | "q2" | "q3",
          "handwritingSample": "transcribed answer text",
          "boundingBox": { "x": number, "y": number, "width": number, "height": number }
        }
      ]
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    
    // Clean JSON block markers if Gemini wraps the response
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const transcriptions = JSON.parse(jsonString);

    console.log("🟢 Gemini OCR successfully processed handwritten coordinates!");

    res.json({
      fileName: req.file.filename,
      fileUrl,
      transcriptions
    });

  } catch (error) {
    console.error("🔴 Error in OCR processing route:", error.message);
    res.status(500).json({ error: "Failed to process handwriting OCR: " + error.message });
  }
});

/**
 * 2. Semantic Grading & Marking route
 * Sends student answer, rubric criteria, and model answer to Gemini
 * to receive point allocations, ticked criteria, and comment explanations.
 */
app.post('/api/grade', async (req, res) => {
  try {
    const { questionPrompt, studentAnswer, modelAnswer, rubricCriteria } = req.body;

    if (!studentAnswer) {
      return res.status(400).json({ error: "Student answer is required." });
    }

    // Sandbox fallback if API key is not yet set up
    if (!ai) {
      console.log("ℹ️ No Gemini API Key. Returning simulated grading matching.");
      return res.json({
        score: 4,
        criteriaMet: ["c1_1", "c1_3", "c1_4"],
        comments: "Good attempt! You correctly identified the solar energy, reactants, and products. However, make sure to name the chloroplast organelle for full marks."
      });
    }

    console.log("🤖 Requesting Gemini Semantic Grading evaluation...");

    // Call Gemini 1.5 Pro model for deep reasoning and rubric alignment
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      You are an expert academic teacher's grading assistant. Your task is to evaluate a student's answer against a model answer and check off which specific criteria are met from the provided rubric.
      
      Question Prompt:
      "${questionPrompt}"
      
      Model Perfect Answer:
      "${modelAnswer}"
      
      Student Answer to Grade:
      "${studentAnswer}"
      
      Rubric Criteria (Each item maps to specific points):
      ${JSON.stringify(rubricCriteria, null, 2)}
      
      Instructions:
      1. Carefully compare the Student Answer to the Model Answer and the Rubric Criteria.
      2. Decide which Rubric Criteria are met. If a criterion is met, add its "id" to the "criteriaMet" list. Be fair: accept synonyms or good approximations that demonstrate understanding.
      3. Sum the "points" of all met criteria to compute the final "score". Make sure the score never exceeds the maximum marks.
      4. Write a brief, encouraging teacher's comment explaining strengths and what was missed. Address the student directly (e.g. "You correctly identified...").
      
      Return your output strictly as a JSON object, with no wrapping markdown block quotes:
      {
        "score": number,
        "criteriaMet": ["id1", "id2", ...],
        "comments": "constructive feedback comment string"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const evaluation = JSON.parse(jsonString);

    console.log(`🟢 Gemini successfully graded question! Assigned score: ${evaluation.score}`);

    res.json(evaluation);

  } catch (error) {
    console.error("🔴 Error in semantic grading route:", error.message);
    res.status(500).json({ error: "Failed to grade question: " + error.message });
  }
});

// 3. Serve Frontend SPA Static Assets
app.use(express.static(__dirname));

// 4. Catch-all route to serve the SPA frontend for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`
  ==============================================================
  🚀 SmartGrader AI - Live Server Active!
  🔗 Local Server: http://localhost:${PORT}
  📁 Scans Uploads Directory: ${uploadDir}
  ==============================================================
  `);
});
