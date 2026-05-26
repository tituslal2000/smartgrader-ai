/**
 * SmartGrader AI - Simulated AI Vision & OCR Engine
 * Analyzes handwritten text, performs semantic matching with rubrics, and suggests grades/comments.
 */

// Simple keyword dictionary to match criteria in answers
const keywordMatcher = {
  // Photosynthesis Q1
  c1_1: ["sunlight", "solar", "light", "sun"],
  c1_2: ["chloroplast", "chlorophyll", "plastid"],
  c1_3: [
    { words: ["water", "carbon dioxide"], type: "and" },
    { words: ["h2o", "co2"], type: "and" },
    { words: ["water", "co2"], type: "and" },
    { words: ["h2o", "carbon dioxide"], type: "and" }
  ],
  c1_4: [
    { words: ["glucose", "oxygen"], type: "and" },
    { words: ["sugar", "oxygen"], type: "and" },
    { words: ["glucose", "o2"], type: "and" },
    { words: ["sugar", "o2"], type: "and" }
  ],

  // Mitosis Q2
  c2_1: ["division", "splitting", "divide", "replica", "clone", "identical"],
  c2_2: [
    { words: ["prophase", "metaphase", "anaphase", "telophase"], type: "and" }
  ],
  c2_3: ["align", "middle", "split", "separation", "separate", "pull", "condense", "nuclear", "reform"],

  // Respiration Q3
  c3_1: ["break", "convert", "sugar", "glucose", "release", "energy"],
  c3_2: ["mitochondria", "mitochondrion", "powerhouse"],
  c3_3: ["atp", "adenosine triphosphate"]
};

/**
 * Simulates OCR text transcription based on handwriting input
 */
export function transcribeHandwriting(rawHandwriting) {
  // Simulate OCR fixing slight spelling mistakes and capitalization
  if (!rawHandwriting) return "";
  
  // OCR sometimes makes transcription tweaks
  let transcribed = rawHandwriting
    .replace(/\bco2\b/gi, "CO2")
    .replace(/\bh2o\b/gi, "H2O")
    .replace(/\batp\b/gi, "ATP")
    .replace(/\bprophas\b/gi, "prophase");

  return transcribed;
}

/**
 * Runs the AI Grading algorithm on a student's answer based on a question's rubric
 */
export function analyzeAnswerWithAI(ocrText, questionRubric) {
  const textLower = ocrText.toLowerCase();
  const criteriaMet = [];
  let score = 0;

  // Evaluate each criterion
  questionRubric.criteria.forEach(criterion => {
    const rules = keywordMatcher[criterion.id];
    if (!rules) return;

    let matched = false;

    for (const rule of rules) {
      if (typeof rule === "string") {
        // Direct string match
        if (textLower.includes(rule.toLowerCase())) {
          matched = true;
          break;
        }
      } else if (rule.type === "and") {
        // All words in group must match
        const allMatched = rule.words.every(word => textLower.includes(word.toLowerCase()));
        if (allMatched) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      criteriaMet.push(criterion.id);
      score += criterion.points;
    }
  });

  // Ensure score doesn't exceed question max
  score = Math.min(score, questionRubric.maxMarks);

  // Generate an automated feedback comment
  const feedback = generateFeedback(score, questionRubric.maxMarks, criteriaMet, questionRubric.criteria);

  // Calculate OCR Confidence
  const confidence = 85 + Math.floor(Math.random() * 14); // 85% to 99%

  return {
    score,
    comments: feedback,
    criteriaMet,
    ocrConfidence: confidence
  };
}

/**
 * Generates natural language feedback based on grading results
 */
function generateFeedback(score, maxMarks, criteriaMet, allCriteria) {
  if (score === maxMarks) {
    return "Excellent! The answer covers all the key requirements and demonstrates a complete, accurate understanding of the concepts.";
  }

  if (score === 0) {
    return "Incorrect. The answer does not address the core requirements. Please review the model answer and rubric criteria.";
  }

  // Figure out what's missing
  const missedCriteria = allCriteria.filter(crit => !criteriaMet.includes(crit.id));
  const strengths = allCriteria.filter(crit => criteriaMet.includes(crit.id));

  let comment = "Good effort! ";

  if (strengths.length > 0) {
    comment += `You correctly identified the following: ${strengths.map(s => s.text.toLowerCase().replace(/mentions\s|lists\s|names\s/, "")).join(", ")}. `;
  }

  if (missedCriteria.length > 0) {
    comment += `To gain full marks, ensure you also include: ${missedCriteria.map(m => m.text.toLowerCase().replace(/mentions\s|lists\s|names\s/, "")).join(", ")}.`;
  }

  return comment;
}
