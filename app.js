/**
 * SmartGrader AI - Main Application Entry & State Manager
 * Orchestrates modules, data updates, and visual components.
 */

import { getSavedState, saveState, initialStudents, initialRubrics, getRegisteredUsers, registerNewUser } from './modules/data.js';
import { GradingBoard } from './modules/grading.js';
import { UIController } from './modules/ui.js';
import { transcribeHandwriting, analyzeAnswerWithAI } from './modules/ocr-engine.js';

// Resolve the API base URL dynamically.
// If loaded from development frontend on port 8000, route to port 5000 backend.
// Otherwise (same-origin, e.g. served via port 5000 or hosted in production), use relative paths.
const API_BASE = window.location.port === '8000' ? 'http://localhost:5000' : '';

class SmartGraderApp {
  constructor() {
    // 1. Authentication & Session Check
    const activeSession = sessionStorage.getItem("sg_active_user");
    if (activeSession) {
      this.currentUser = JSON.parse(activeSession);
      // Load user isolated workspace data
      const saved = getSavedState(this.currentUser.email);
      this.rubrics = saved.rubrics;
      this.students = saved.students;
      this.subjects = saved.subjects;
      
      // Update sidebar visual elements
      setTimeout(() => this.updateSidebarUserCard(), 50);
      
      // Close overlay
      document.getElementById('auth-overlay').classList.remove('open');
    } else {
      this.currentUser = null;
      this.rubrics = [];
      this.students = [];
      this.subjects = [];
      
      // Display login screen overlay
      document.getElementById('auth-overlay').classList.add('open');
    }
    
    this.activeStudent = null;
    this.activeRubric = null;
    this.activeQuestion = null;

    // 2. Initialize Controllers
    this.ui = new UIController(this);
    this.initGradingBoard();

    // 3. Bind Global Actions
    this.bindActionEvents();

    // 4. Initial Navigation
    if (this.currentUser) {
      this.ui.navigateTo("dashboard");
    }
  }

  // Set up the HTML5 canvas layer inside standard editor workspace
  initGradingBoard() {
    const canvas = document.getElementById('draw-canvas');
    const overlay = document.getElementById('paper-vector-overlay');
    const container = document.getElementById('paper-container');
    
    if (!canvas || !overlay || !container) return;

    this.gradingBoard = new GradingBoard({
      container,
      overlay,
      canvas,
      onBoxClick: (qId) => this.selectQuestion(qId),
      onDrawingUpdate: (strokes) => {
        if (this.activeStudent) {
          this.activeStudent.redInkStrokes = strokes;
          this.persistState();
        }
      }
    });

    // Make sure resizing redraws visual overlays and strokes
    window.addEventListener('resize', () => {
      if (this.activeStudent) {
        this.gradingBoard.resizeCanvas();
        this.gradingBoard.renderBoundingBoxes();
      }
    });
  }

  // Setup Event Bindings for Grader Control Bar and Editing Drawer
  bindActionEvents() {
    // Canvas tool selectors
    document.getElementById('tool-select').addEventListener('click', () => {
      this.setGradingTool("select");
    });
    document.getElementById('tool-pen').addEventListener('click', () => {
      this.setGradingTool("pen");
    });
    document.getElementById('tool-clear').addEventListener('click', () => {
      this.gradingBoard.clearDrawings();
    });

    // Run AI Grader button (Copilot Panel)
    const runAiBtn = document.getElementById('btn-run-ai');
    if (runAiBtn) {
      runAiBtn.addEventListener('click', () => {
        this.runAIGradingCurrentPaper();
      });
    }

    // Save changes inside Editing Drawer
    const saveDrawerBtn = document.getElementById('btn-save-drawer');
    if (saveDrawerBtn) {
      saveDrawerBtn.addEventListener('click', () => {
        this.saveActiveQuestionDrawer();
      });
    }

    // Close Editing Drawer
    const closeDrawerBtn = document.getElementById('btn-close-drawer');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        document.getElementById('grading-drawer').classList.remove('open');
      });
    }

    // Export Graded Paper
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportStudentReport();
      });
    }

    // Save Student Roster Close Modal
    const modalCloseBtn = document.getElementById('btn-close-rubric-modal');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => {
        document.getElementById('rubric-modal').classList.remove('open');
      });
    }

    // Form score updates on input
    const slider = document.getElementById('drawer-score-slider');
    const number = document.getElementById('drawer-score-number');
    
    if (slider && number) {
      slider.addEventListener('input', (e) => {
        number.value = e.target.value;
      });
      number.addEventListener('change', (e) => {
        let val = parseInt(e.target.value) || 0;
        val = Math.max(0, Math.min(val, slider.max));
        slider.value = val;
        number.value = val;
      });
    }

    // ==========================================================
    // AUTHENTICATION & LOGIN SCREEN LISTENERS
    // ==========================================================
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');
    const helpNote = document.getElementById('auth-help-note');
    const errorBanner = document.getElementById('auth-error-banner');
    
    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        helpNote.style.display = 'block';
        if (errorBanner) errorBanner.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.style.display = 'flex';
        loginForm.style.display = 'none';
        helpNote.style.display = 'none';
        if (errorBanner) errorBanner.style.display = 'none';
      });
    }

    // Sign In Submit Action
    const loginSubmit = document.getElementById('btn-login-submit');
    if (loginSubmit) {
      loginSubmit.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        this.loginUser(email, pass);
      });
    }

    // Create Account Submit Action
    const registerSubmit = document.getElementById('btn-register-submit');
    if (registerSubmit) {
      registerSubmit.addEventListener('click', () => {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const pass = document.getElementById('register-password').value;
        this.registerUser(name, email, pass);
      });
    }

    // Logout Click Action
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logoutSession();
      });
    }
  }

  // Calculate stats for Dashboard display cards
  getClassroomStats() {
    const totalCount = this.students.length;
    const graded = this.students.filter(s => s.status === "Graded");
    const gradedCount = graded.length;
    
    let sumPercentage = 0;
    graded.forEach(s => sumPercentage += s.percentage);
    
    const classAverage = gradedCount > 0 ? Math.round(sumPercentage / gradedCount) : 0;
    
    // Auto-calculate grading hours saved based on graded count (average 20 mins per paper)
    const timeSaved = gradedCount * 0.33; // 20 mins = 0.33 hours

    // Grade letters mapping
    const gradesCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    graded.forEach(s => {
      if (gradesCount[s.grade] !== undefined) {
        gradesCount[s.grade]++;
      }
    });

    return {
      totalCount,
      gradedCount,
      classAverage,
      timeSaved: timeSaved.toFixed(1),
      gradesCount
    };
  }

  // Switch workspace to visual editor and load student details
  openGradingSession(studentId) {
    const student = this.students.find(s => s.id === studentId);
    const rubric = this.rubrics.find(r => r.id === student.rubricId);
    
    if (!student || !rubric) return;

    this.activeStudent = student;
    this.activeRubric = rubric;
    this.activeQuestion = null;

    // Update Grader Screen titles
    document.getElementById('grader-student-name').innerText = student.name;
    document.getElementById('grader-exam-title').innerText = rubric.name;
    
    // Load components in Visual Canvas
    this.gradingBoard.loadPaper(student, rubric);
    this.setGradingTool("select");

    // Close open drawer
    document.getElementById('grading-drawer').classList.remove('open');

    // Load grading list sidebar
    this.renderGradingSidebar();

    // Trigger visual page switch
    this.ui.navigateTo("grading");
  }

  // Redraw sidebar questions lists inside visual workspace
  renderGradingSidebar() {
    const listContainer = document.getElementById('grading-sidebar-questions');
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // Score tally indicators
    let paperScore = 0;
    let paperMax = 0;

    this.activeRubric.questions.forEach(q => {
      const studentQ = this.activeStudent.questions[q.id];
      const maxScore = q.maxMarks;
      const curScore = studentQ ? studentQ.score : 0;

      paperScore += curScore;
      paperMax += maxScore;

      const badgeClass = studentQ && studentQ.status === "correct" ? "badge-success" : 
                         studentQ && studentQ.status === "partial" ? "badge-warning" : "badge-danger";

      const item = document.createElement('div');
      item.className = `question-list-item ${this.activeQuestion && this.activeQuestion.id === q.id ? 'active' : ''}`;
      
      item.innerHTML = `
        <div class="item-left">
          <div class="item-title">${q.label}</div>
          <div class="item-snippet">${studentQ && studentQ.ocrText ? studentQ.ocrText : 'No OCR text available'}</div>
        </div>
        <div class="item-right">
          <span class="score-text">${curScore}/${maxScore}</span>
          <span class="badge ${badgeClass}" style="width: 10px; height: 10px; border-radius: 50%; padding: 0;"></span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectQuestion(q.id);
      });

      listContainer.appendChild(item);
    });

    // Update Paper overall stats
    document.getElementById('grader-sidebar-total-score').innerText = `${paperScore} / ${paperMax}`;
    const pct = paperMax > 0 ? Math.round((paperScore / paperMax) * 100) : 0;
    document.getElementById('grader-sidebar-total-percent').innerText = `${pct}%`;
  }

  // Handle active selection tools (Select vs Red Ink Pen)
  setGradingTool(tool) {
    this.gradingBoard.setTool(tool);

    document.getElementById('tool-select').classList.remove('active');
    document.getElementById('tool-pen').classList.remove('active');

    if (tool === "select") {
      document.getElementById('tool-select').classList.add('active');
    } else {
      document.getElementById('tool-pen').classList.add('active');
    }
  }

  // Trigger selection of a question bounding box or sidebar item
  selectQuestion(qId) {
    const question = this.activeRubric.questions.find(q => q.id === qId);
    if (!question) return;

    this.activeQuestion = question;

    // Highlight in list
    this.renderGradingSidebar();

    // Visual highlight on board overlay
    this.gradingBoard.focusQuestion(qId);

    // Open inline grading editing drawer
    this.openGradingDrawer();
  }

  // Open Drawer containing Criteria checkmarks and Handwriting samples
  openGradingDrawer() {
    const q = this.activeQuestion;
    const studentQ = this.activeStudent.questions[q.id];
    const drawer = document.getElementById('grading-drawer');
    
    if (!q || !studentQ || !drawer) return;

    // Set Text fields
    document.getElementById('drawer-q-label').innerText = q.label;
    document.getElementById('drawer-handwriting-sample').innerText = studentQ.handwritingSample || "";
    
    // Set Slider bounds
    const slider = document.getElementById('drawer-score-slider');
    const number = document.getElementById('drawer-score-number');
    
    slider.max = q.maxMarks;
    slider.value = studentQ.score;
    number.value = studentQ.score;

    // Set comments
    document.getElementById('drawer-comments').value = studentQ.comments || "";

    // Set OCR Transcription editor
    const ocrTextarea = document.getElementById('drawer-ocr-text');
    ocrTextarea.value = studentQ.ocrText || transcribeHandwriting(studentQ.handwritingSample);

    // Populate Rubric criteria mapping boxes
    const criteriaBox = document.getElementById('drawer-rubric-criteria');
    criteriaBox.innerHTML = "";

    q.criteria.forEach(crit => {
      const label = document.createElement('label');
      label.className = "criteria-item";
      
      const isChecked = studentQ.criteriaMet && studentQ.criteriaMet.includes(crit.id);
      
      label.innerHTML = `
        <input type="checkbox" class="criteria-checkbox" data-crit-id="${crit.id}" data-points="${crit.points}" ${isChecked ? 'checked' : ''}>
        <span class="criteria-text">${crit.text}</span>
        <span class="criteria-points">+${crit.points} pt</span>
      `;

      // Auto update score slider when clicking criteria checkmarks
      const checkbox = label.querySelector('.criteria-checkbox');
      checkbox.addEventListener('change', () => {
        this.recalculateScoreFromDrawerCheckboxes();
      });

      criteriaBox.appendChild(label);
    });

    // Slide in
    drawer.classList.add('open');
  }

  // Auto calculate sum of checked marks inside drawer
  recalculateScoreFromDrawerCheckboxes() {
    let scoreSum = 0;
    document.querySelectorAll('.criteria-checkbox').forEach(box => {
      if (box.checked) {
        scoreSum += parseInt(box.getAttribute('data-points')) || 0;
      }
    });

    const max = this.activeQuestion.maxMarks;
    scoreSum = Math.min(scoreSum, max);

    // Update UI elements inside drawer
    document.getElementById('drawer-score-slider').value = scoreSum;
    document.getElementById('drawer-score-number').value = scoreSum;
  }

  // Persists edited drawer marks into student record
  saveActiveQuestionDrawer() {
    if (!this.activeStudent || !this.activeQuestion) return;

    const qId = this.activeQuestion.id;
    const studentQ = this.activeStudent.questions[qId];

    // Read marks
    const scoreVal = parseInt(document.getElementById('drawer-score-slider').value) || 0;
    const commentsVal = document.getElementById('drawer-comments').value;
    const ocrVal = document.getElementById('drawer-ocr-text').value;

    // Read met criteria
    const criteriaMet = [];
    document.querySelectorAll('.criteria-checkbox').forEach(box => {
      if (box.checked) {
        criteriaMet.push(box.getAttribute('data-crit-id'));
      }
    });

    // Map correctness status class
    let correctness = "incorrect";
    if (scoreVal === this.activeQuestion.maxMarks) {
      correctness = "correct";
    } else if (scoreVal > 0) {
      correctness = "partial";
    }

    // Save record details
    studentQ.score = scoreVal;
    studentQ.comments = commentsVal;
    studentQ.ocrText = ocrVal;
    studentQ.criteriaMet = criteriaMet;
    studentQ.status = correctness;

    // Save student overall sums
    this.recomputeOverallStudentScores(this.activeStudent);

    // Sync database and render elements
    this.persistState();
    this.gradingBoard.renderBoundingBoxes();
    this.renderGradingSidebar();

    // Slide out drawer
    document.getElementById('grading-drawer').classList.remove('open');
  }

  // Re-tally all marks, grades, and average percentages
  recomputeOverallStudentScores(student) {
    const rubric = this.rubrics.find(r => r.id === student.rubricId);
    if (!rubric) return;

    let totalScore = 0;
    let totalMax = rubric.totalMaxMarks;
    let isFullyGraded = true;

    rubric.questions.forEach(q => {
      const studentQ = student.questions[q.id];
      if (studentQ) {
        totalScore += studentQ.score;
      }
    });

    student.score = totalScore;
    student.maxScore = totalMax;
    
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    student.percentage = pct;

    // Map Grade letters
    let letter = "F";
    if (pct >= 90) letter = "A";
    else if (pct >= 80) letter = "B";
    else if (pct >= 70) letter = "C";
    else if (pct >= 60) letter = "D";

    student.grade = letter;
    student.status = "Graded";
  }

  // Run Live Google Gemini AI Semantic Rubric Grading
  async runAIGradingCurrentPaper() {
    if (!this.activeStudent || !this.activeRubric) return;

    const runBtn = document.getElementById('btn-run-ai');
    const originalHtml = runBtn.innerHTML;
    runBtn.innerHTML = "<i class='fas fa-sync fa-spin'></i> AI Marking...";
    runBtn.disabled = true;

    try {
      console.log(`🤖 Requesting Gemini grading for ${this.activeStudent.name}...`);

      // Run semantic grading for all exam questions in parallel!
      const gradingPromises = this.activeRubric.questions.map(async q => {
        const studentQ = this.activeStudent.questions[q.id];
        if (!studentQ) return;

        const response = await fetch(`${API_BASE}/api/grade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionPrompt: q.prompt,
            studentAnswer: studentQ.ocrText || studentQ.handwritingSample,
            modelAnswer: q.modelAnswer,
            rubricCriteria: q.criteria
          })
        });

        if (!response.ok) {
          throw new Error(`Grading request failed with status: ${response.status}`);
        }

        const evaluation = await response.json();

        // Update question record
        studentQ.ocrText = studentQ.ocrText || studentQ.handwritingSample;
        studentQ.score = evaluation.score;
        studentQ.comments = evaluation.comments;
        studentQ.criteriaMet = evaluation.criteriaMet;
        
        let correctness = "incorrect";
        if (evaluation.score === q.maxMarks) {
          correctness = "correct";
        } else if (evaluation.score > 0) {
          correctness = "partial";
        }
        studentQ.status = correctness;
      });

      await Promise.all(gradingPromises);

      // Recalculate paper totals and save
      this.recomputeOverallStudentScores(this.activeStudent);
      this.persistState();

      // Refresh visuals on canvas and sidebar
      this.gradingBoard.renderBoundingBoxes();
      this.renderGradingSidebar();

      // Select first question to update drawer contents
      this.selectQuestion(this.activeRubric.questions[0].id);

      alert("AI Grading Complete! All answers have been marked against the rubric via Gemini Pro.");

    } catch (err) {
      console.error("🔴 Error running live AI grading:", err);
      alert(`Failed to connect to the grading server. Please ensure the backend server is running at ${API_BASE || window.location.origin}.`);
    } finally {
      runBtn.innerHTML = originalHtml;
      runBtn.disabled = false;
    }
  }

  // Uploads student paper image, runs Gemini Vision OCR, and creates record
  importNewSubmission(file) {
    const fileName = file.name;
    
    // Construct multi-part form data to upload image binary
    const formData = new FormData();
    formData.append('paper', file);

    console.log(`📤 Uploading file "${fileName}" to backend server for OCR mapping...`);

    fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Upload failed with status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      // Generate a new student record
      const idNum = this.students.length + 1;
      const newId = `stu-00${idNum}`;
      
      const targetRubric = this.rubrics[0]; // Default to Bio-101
      const activeFolderId = this.ui.selectedSubjectId !== "all" ? this.ui.selectedSubjectId : (this.subjects[0]?.id || "sub-bio");

      // Construct mapped student questions from Gemini OCR response!
      const questionsMapped = {};
      const defaultBoxes = {
        q1: { x: 80, y: 195, width: 620, height: 105 },
        q2: { x: 80, y: 440, width: 620, height: 105 },
        q3: { x: 80, y: 690, width: 620, height: 105 }
      };

      targetRubric.questions.forEach(q => {
        const trans = data.transcriptions?.find(t => t.questionId === q.id);
        
        questionsMapped[q.id] = {
          score: 0,
          comments: "",
          ocrText: trans ? trans.handwritingSample : "",
          handwritingSample: trans ? trans.handwritingSample : "Could not transcribe answer.",
          criteriaMet: [],
          boundingBox: trans ? trans.boundingBox : defaultBoxes[q.id],
          status: "incorrect"
        };
      });

      const newStudent = {
        id: newId,
        name: "Marcus Vance",
        email: "marcus.vance@academy.edu",
        rubricId: targetRubric.id,
        subjectId: activeFolderId,
        status: "Grading",
        score: 0,
        maxScore: targetRubric.totalMaxMarks,
        percentage: 0,
        grade: "U",
        submissionDate: new Date().toISOString().split('T')[0],
        paperImage: data.fileUrl, // Store live static file URL served from server!
        questions: questionsMapped,
        redInkStrokes: []
      };

      this.students.push(newStudent);
      this.persistState();

      // Redirect to student roster & reload list
      this.ui.navigateTo("roster");
      
      setTimeout(() => {
        alert(`Import Successful!\nFile "${fileName}" processed successfully. Mapped OCR handwriting transcription and bounding boxes. Marcus Vance added to queue.`);
      }, 200);
    })
    .catch(err => {
      console.error("🔴 Error uploading student paper scan:", err);
      alert(`Failed to upload paper. Please ensure the backend server is running at ${API_BASE || window.location.origin}.`);
    });
  }

  // Trigger a full printable window modal to export graded results card
  exportStudentReport() {
    if (!this.activeStudent) return;

    const student = this.activeStudent;
    const rubric = this.activeRubric;
    
    // Construct report document window HTML
    const printWindow = window.open('', '_blank');
    
    let questionsHtml = "";
    rubric.questions.forEach(q => {
      const studentQ = student.questions[q.id];
      questionsHtml += `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1rem; color: #1e293b;">
            <span>${q.label}</span>
            <span style="color: #4f46e5;">${studentQ.score} / ${q.maxMarks} Marks</span>
          </div>
          <div style="font-size: 0.85rem; color: #475569; margin: 0.5rem 0;">
            <strong>Rubric Criteria Ticked:</strong>
            ${q.criteria.map(c => {
              const checked = studentQ.criteriaMet.includes(c.id);
              return `<span style="display:inline-block; padding: 2px 6px; font-size:0.75rem; border-radius:4px; margin-right:5px; background: ${checked ? '#d1fae5; color:#065f46;' : '#f1f5f9; color:#64748b;'}">${checked ? '✓' : '✗'} ${c.text}</span>`;
            }).join('')}
          </div>
          <div style="font-size: 0.9rem; color: #1e293b; background: #faf5ff; padding: 0.75rem; border-radius: 6px; font-family: cursive; margin: 0.75rem 0; border-left: 3px solid #a855f7;">
            "${studentQ.handwritingSample}"
          </div>
          <div style="font-size: 0.85rem; color: #475569;">
            <strong>Teacher Comments:</strong> ${studentQ.comments || "No comments written."}
          </div>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
      <head>
        <title>Student Graded Paper - ${student.name}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem; }
          .badge { display: inline-block; padding: 0.25rem 0.75rem; font-weight: 700; border-radius: 20px; font-size: 1.25rem; }
          .badge-success { background: #d1fae5; color: #065f46; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 1.5rem; text-align: right;">
          <button onclick="window.print()" style="padding: 0.5rem 1.25rem; background: #6366f1; border: none; color: white; font-weight: 600; border-radius: 6px; cursor: pointer;">Print Report / Save as PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 1.75rem;">SmartGrader AI - Evaluation Report</h1>
            <p style="margin: 5px 0 0 0; color: #64748b;">Generated Grader Feedback & Mark Sheet</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: 800; color: #4f46e5;">Score: ${student.score} / ${student.maxScore} (${student.percentage}%)</div>
            <div style="margin-top: 5px;"><span class="badge badge-success">Grade: ${student.grade}</span></div>
          </div>
        </div>
        
        <div style="margin-bottom: 2rem;">
          <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Student Metadata</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr><td style="padding: 5px 0; color:#64748b;">Student Name:</td><td style="font-weight:600;">${student.name}</td></tr>
            <tr><td style="padding: 5px 0; color:#64748b;">Class/Exam:</td><td style="font-weight:600;">${rubric.name}</td></tr>
            <tr><td style="padding: 5px 0; color:#64748b;">Grading Date:</td><td style="font-weight:600;">${student.submissionDate}</td></tr>
          </table>
        </div>

        <div>
          <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Detailed Question Breakdown</h3>
          ${questionsHtml}
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  // Creates a new Subject Folder
  createNewSubject(name) {
    const id = `sub-${Date.now()}`;
    const newSubject = { id, name };
    this.subjects.push(newSubject);
    this.persistState();
    
    // Refresh folders bar and roster
    this.ui.selectedSubjectId = id; // Auto-select the newly created folder!
    this.ui.renderSubjectFolders();
    this.ui.renderRoster();
  }

  // Deletes a student paper submission
  deleteStudentPaper(studentId) {
    this.students = this.students.filter(s => s.id !== studentId);
    this.persistState();
    
    // Refresh visual roster table & dashboard charts
    this.ui.renderRoster();
    this.ui.renderDashboard();
  }

  // Authenticates credentials and starts user session
  loginUser(email, password) {
    const errorBanner = document.getElementById('auth-error-banner');
    const errorText = document.getElementById('auth-error-text');
    
    try {
      const users = getRegisteredUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
      
      if (!user) {
        throw new Error("Invalid email or password. Please try again.");
      }

      // Start Session
      this.currentUser = user;
      sessionStorage.setItem("sg_active_user", JSON.stringify(user));

      // Load private database collections
      const saved = getSavedState(user.email);
      this.rubrics = saved.rubrics;
      this.students = saved.students;
      this.subjects = saved.subjects;

      // Update sidebar visual profile card
      this.updateSidebarUserCard();

      // Clear input fields
      document.getElementById('login-email').value = "";
      document.getElementById('login-password').value = "";

      // Hide auth overlay & redirect to dashboard
      document.getElementById('auth-overlay').classList.remove('open');
      if (errorBanner) errorBanner.style.display = 'none';

      this.ui.navigateTo("dashboard");

    } catch (err) {
      if (errorBanner && errorText) {
        errorText.innerText = err.message;
        errorBanner.style.display = 'flex';
      } else {
        alert(err.message);
      }
    }
  }

  // Registers a new user account into sandbox database
  registerUser(name, email, password) {
    const errorBanner = document.getElementById('auth-error-banner');
    const errorText = document.getElementById('auth-error-text');

    try {
      if (!name.trim() || !email.trim() || !password) {
        throw new Error("All registration fields are required.");
      }

      // Register via database module
      const newUser = registerNewUser(email, password, name);

      // Log in automatically!
      this.loginUser(newUser.email, password);

      // Clear inputs
      document.getElementById('register-name').value = "";
      document.getElementById('register-email').value = "";
      document.getElementById('register-password').value = "";

    } catch (err) {
      if (errorBanner && errorText) {
        errorText.innerText = err.message;
        errorBanner.style.display = 'flex';
      } else {
        alert(err.message);
      }
    }
  }

  // Destroys session token and returns securely to login overlay
  logoutSession() {
    if (confirm("Are you sure you want to log out of your SmartGrader workspace?")) {
      sessionStorage.removeItem("sg_active_user");
      this.currentUser = null;
      this.rubrics = [];
      this.students = [];
      this.subjects = [];

      // Open auth overlay & reset visual overlays
      document.getElementById('auth-overlay').classList.add('open');
      this.ui.navigateTo("dashboard"); // Hide other screens
    }
  }

  // Updates the visual teacher avatar and profile name inside sidebar
  updateSidebarUserCard() {
    if (!this.currentUser) return;
    
    const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    document.getElementById('sidebar-avatar').innerText = initials;
    document.getElementById('sidebar-user-name').innerText = this.currentUser.name;
    document.getElementById('sidebar-user-role').innerText = this.currentUser.role || "Teacher / Grader";
  }

  // Sync state to local storage database
  persistState() {
    if (this.currentUser) {
      saveState(this.rubrics, this.students, this.subjects, this.currentUser.email);
    }
  }
}

// Instantiate the App coordinator
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SmartGraderApp();
});
