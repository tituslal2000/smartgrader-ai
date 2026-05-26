/**
 * SmartGrader AI - Sample Data & Database Module
 * Provides isolated databases, rubrics, subjects, and users persistence.
 */

// 1. Predefined Subjects (Folders)
export const initialSubjects = [
  { id: "sub-bio", name: "Biology" },
  { id: "sub-chem", name: "Chemistry" },
  { id: "sub-math", name: "Mathematics" }
];

// 2. Predefined Rubrics
export const initialRubrics = [
  {
    id: "bio-101",
    name: "Biology 101 - Cell Energetics & Division",
    totalMaxMarks: 15,
    questions: [
      {
        id: "q1",
        label: "Question 1: Photosynthesis Process",
        prompt: "Explain the process of photosynthesis and list the main components involved. (5 Marks)",
        maxMarks: 5,
        modelAnswer: "Photosynthesis is the process where plants use solar energy, water, and carbon dioxide within chloroplasts to produce glucose (chemical energy) and release oxygen as a byproduct.",
        criteria: [
          { id: "c1_1", text: "Mentions solar energy / sunlight", points: 1 },
          { id: "c1_2", text: "Mentions chloroplasts / chlorophyll", points: 1 },
          { id: "c1_3", text: "Lists reactants: Water (H2O) & Carbon Dioxide (CO2)", points: 2 },
          { id: "c1_4", text: "Lists products: Glucose & Oxygen (O2)", points: 1 }
        ]
      },
      {
        id: "q2",
        label: "Question 2: Stages of Mitosis",
        prompt: "Briefly describe what occurs during mitosis and name its four main stages. (5 Marks)",
        maxMarks: 5,
        modelAnswer: "Mitosis is eukaryotic cell division where chromosomes replicate and separate into two identical nuclei. The stages are Prophase (condensation), Metaphase (alignment), Anaphase (separation), and Telophase (nuclear reformation).",
        criteria: [
          { id: "c2_1", text: "Defines cell division / identical chromosome replication", points: 1 },
          { id: "c2_2", text: "Correctly lists all 4 stages (PMAT)", points: 2 },
          { id: "c2_3", text: "Describes stage action (alignment or separation)", points: 2 }
        ]
      },
      {
        id: "q3",
        label: "Question 3: Cellular Respiration",
        prompt: "What is cellular respiration, where does it occur, and what is its primary energy product? (5 Marks)",
        maxMarks: 5,
        modelAnswer: "Cellular respiration is the biochemical process that breaks down glucose in the mitochondria to produce ATP (adenosine triphosphate) energy, along with carbon dioxide and water.",
        criteria: [
          { id: "c3_1", text: "Identifies glucose breakdown / food to energy conversion", points: 1 },
          { id: "c3_2", text: "Names the organelle: Mitochondria", points: 2 },
          { id: "c3_3", text: "Identifies ATP as the primary energy output", points: 2 }
        ]
      }
    ]
  }
];

// 3. Predefined Default Students (Assigned specifically to Prof. Robertson's account)
export const initialStudents = [
  {
    id: "stu-001",
    name: "Alex Rivera",
    email: "alex.rivera@academy.edu",
    rubricId: "bio-101",
    subjectId: "sub-bio",
    status: "Graded",
    score: 14,
    maxScore: 15,
    percentage: 93,
    grade: "A",
    submissionDate: "2026-05-25",
    questions: {
      q1: {
        score: 5,
        comments: "Excellent overview of the reactants and products. Highlighted chloroplast structures accurately.",
        ocrText: "Photosynthesis is how plants make food. They use sunlight, water, and carbon dioxide inside the chloroplasts. This makes glucose (sugar) and releases oxygen as a byproduct.",
        handwritingSample: "Photosynthesis is how plants make food. They use sunlight, water, and carbon dioxide inside the chloroplasts. This makes glucose and releases oxygen.",
        criteriaMet: ["c1_1", "c1_2", "c1_3", "c1_4"],
        boundingBox: { x: 80, y: 195, width: 620, height: 105 },
        status: "correct"
      },
      q2: {
        score: 4,
        comments: "Great descriptions, but missed explaining cell nucleus reformation in Telophase.",
        ocrText: "Mitosis is cell division. The chromosomes align in the middle and then split apart into two identical cells. The stages are Prophase, Metaphase, Anaphase, and Telophase.",
        handwritingSample: "Mitosis is cell division. The chromosomes align in the middle and split apart into two identical cells. Stages: Prophase, Metaphase, Anaphase, Telophase.",
        criteriaMet: ["c2_1", "c2_2"],
        boundingBox: { x: 80, y: 440, width: 620, height: 105 },
        status: "partial"
      },
      q3: {
        score: 5,
        comments: "Perfect answer. Clean diagram description of ATP conversion.",
        ocrText: "Respiration breaks down sugar in the mitochondria to produce ATP energy for cells. The formula is glucose + oxygen -> carbon dioxide + water + ATP.",
        handwritingSample: "Respiration breaks down sugar in the mitochondria to produce ATP energy for cells. Formula: glucose + oxygen -> carbon dioxide + water + ATP.",
        criteriaMet: ["c3_1", "c3_2", "c3_3"],
        boundingBox: { x: 80, y: 690, width: 620, height: 105 },
        status: "correct"
      }
    },
    redInkStrokes: []
  },
  {
    id: "stu-002",
    name: "Chloe Chen",
    email: "chloe.chen@academy.edu",
    rubricId: "bio-101",
    subjectId: "sub-bio",
    status: "Graded",
    score: 11,
    maxScore: 15,
    percentage: 73,
    grade: "C",
    submissionDate: "2026-05-25",
    questions: {
      q1: {
        score: 4,
        comments: "Good, but missed mentioning the chloroplast organelle.",
        ocrText: "Plants take sunlight, water, and CO2 to convert them into sugars like glucose. Oxygen is also made and released into the air.",
        handwritingSample: "Plants take sunlight, water, and CO2 to convert them into sugars like glucose. Oxygen is also made and released into the air.",
        criteriaMet: ["c1_1", "c1_3", "c1_4"],
        boundingBox: { x: 80, y: 195, width: 620, height: 105 },
        status: "partial"
      },
      q2: {
        score: 3,
        comments: "Forgot to list Telophase, and descriptions are a bit vague.",
        ocrText: "Mitosis is division of chromosomes. The stages are Prophase, Metaphase, Anaphase. I forgot the last one.",
        handwritingSample: "Mitosis is division of chromosomes. The stages are Prophase, Metaphase, Anaphase. I forgot the last one.",
        criteriaMet: ["c2_1", "c2_3"],
        boundingBox: { x: 80, y: 440, width: 620, height: 105 },
        status: "partial"
      },
      q3: {
        score: 4,
        comments: "Missed naming ATP explicitly as the product, just said energy.",
        ocrText: "Cellular respiration is done inside the mitochondria where food is broken down to yield chemical energy for cell work.",
        handwritingSample: "Cellular respiration is done inside the mitochondria where food is broken down to yield chemical energy for cell work.",
        criteriaMet: ["c3_1", "c3_2"],
        boundingBox: { x: 80, y: 690, width: 620, height: 105 },
        status: "partial"
      }
    },
    redInkStrokes: []
  }
];

// Helper to save isolated state keyed by the teacher's email address
export function getSavedState(email) {
  if (!email) return { rubrics: [], students: [], subjects: [] };

  const emailClean = email.toLowerCase().trim();
  
  const rubrics = localStorage.getItem(`sg_rubrics_${emailClean}`);
  const students = localStorage.getItem(`sg_students_${emailClean}`);
  const subjects = localStorage.getItem(`sg_subjects_${emailClean}`);

  // Seed default students ONLY for our pre-set teacher
  let defaultStudents = [];
  if (emailClean === "prof.robertson@academy.edu") {
    defaultStudents = initialStudents;
  }

  return {
    rubrics: rubrics ? JSON.parse(rubrics) : initialRubrics,
    students: students ? JSON.parse(students) : defaultStudents,
    subjects: subjects ? JSON.parse(subjects) : initialSubjects
  };
}

export function saveState(rubrics, students, subjects, email) {
  if (!email) return;
  const emailClean = email.toLowerCase().trim();
  
  localStorage.setItem(`sg_rubrics_${emailClean}`, JSON.stringify(rubrics));
  localStorage.setItem(`sg_students_${emailClean}`, JSON.stringify(students));
  localStorage.setItem(`sg_subjects_${emailClean}`, JSON.stringify(subjects));
}

// ==========================================================================
// USER DATABASE AUTHENTICATION HELPERS
// ==========================================================================

export function getRegisteredUsers() {
  const users = localStorage.getItem("sg_users");
  
  // Default master teacher account pre-loaded
  const defaultUsers = [
    {
      email: "prof.robertson@academy.edu",
      password: "password123",
      name: "Prof. T. Robertson",
      role: "Biology Coordinator"
    }
  ];

  if (!users) {
    localStorage.setItem("sg_users", JSON.stringify(defaultUsers));
    return defaultUsers;
  }

  return JSON.parse(users);
}

export function registerNewUser(email, password, name) {
  const users = getRegisteredUsers();
  const emailClean = email.toLowerCase().trim();

  if (users.some(u => u.email === emailClean)) {
    throw new Error("An account with this email address already exists.");
  }

  const newUser = {
    email: emailClean,
    password, // Simple standard verification for sandbox client flow
    name: name || "Instructor",
    role: "Teacher / Grader"
  };

  users.push(newUser);
  localStorage.setItem("sg_users", JSON.stringify(users));
  return newUser;
}
