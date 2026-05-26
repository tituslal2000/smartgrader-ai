/**
 * SmartGrader AI - Interactive Visual Grading Board
 * Manages paper scaling, handwriting bounding boxes, and freehand red-ink drawing.
 */

export class GradingBoard {
  constructor(options) {
    this.container = options.container;         // The .paper-container element
    this.overlay = options.overlay;             // The .paper-vector-overlay div
    this.canvas = options.canvas;               // The drawing canvas element
    this.ctx = this.canvas.getContext('2d');
    
    this.onBoxClick = options.onBoxClick;       // Callback when bounding box is clicked
    this.onDrawingUpdate = options.onDrawingUpdate; // Callback when red strokes are updated
    
    this.currentStudent = null;
    this.currentRubric = null;
    this.activeQuestionId = null;
    this.currentTool = "select";                // 'select' or 'pen'
    
    // Freehand drawing state
    this.isDrawing = false;
    this.strokes = [];
    this.currentStroke = [];
    
    this.initEventListeners();
  }

  // Initialize mouse/touch listeners for drawing
  initEventListeners() {
    const handleStart = (e) => {
      if (this.currentTool !== "pen") return;
      this.isDrawing = true;
      const coords = this.getRelativeCoords(e);
      this.currentStroke = [coords];
      
      this.ctx.beginPath();
      this.ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // Red-ink
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.moveTo(coords.x, coords.y);
    };

    const handleMove = (e) => {
      if (!this.isDrawing || this.currentTool !== "pen") return;
      e.preventDefault();
      const coords = this.getRelativeCoords(e);
      this.currentStroke.push(coords);
      
      this.ctx.lineTo(coords.x, coords.y);
      this.ctx.stroke();
    };

    const handleEnd = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.currentStroke.length > 1) {
        this.strokes.push([...this.currentStroke]);
        if (this.onDrawingUpdate) {
          this.onDrawingUpdate(this.strokes);
        }
      }
      this.currentStroke = [];
    };

    // Desktop mouse events
    this.overlay.addEventListener('mousedown', handleStart);
    this.overlay.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    // Mobile touch events
    this.overlay.addEventListener('touchstart', (e) => handleStart(e.touches[0]));
    this.overlay.addEventListener('touchmove', (e) => handleMove(e.touches[0]));
    window.addEventListener('touchend', handleEnd);
  }

  // Get mouse coordinates relative to the scaled paper container
  getRelativeCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    // Support both mouse events and touch events
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Load a student's paper structure, rubric, and strokes
  loadPaper(student, rubric) {
    this.currentStudent = student;
    this.currentRubric = rubric;
    this.strokes = student.redInkStrokes || [];
    this.activeQuestionId = null;

    // Dynamic background paper image swap (lets users view their actual uploaded documents!)
    const paperImg = this.container.querySelector('.student-paper-image') || document.getElementById('student-paper-image');
    if (paperImg) {
      if (student.paperImage) {
        paperImg.src = student.paperImage;
      } else {
        // Default ruled school notebook sheet SVG
        paperImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1100' viewBox='0 0 800 1100'><rect width='800' height='1100' fill='%23fafaf9'/><line x1='120' y1='0' x2='120' y2='1100' stroke='%23fca5a5' stroke-width='2'/><!-- Ruled notebook lines -->" + Array.from({length:34}, (_,i) => `%3Cline x1='0' y1='${100+i*28}' x2='800' y2='${100+i*28}' stroke='%23e2e8f0' stroke-width='1'/%3E`).join('') + "%3C!-- Questions printed --%3E%3Ctext x='140' y='140' font-family='Plus Jakarta Sans, sans-serif' font-size='14' font-weight='700' fill='%231e293b'%3EQ1. Explain the process of photosynthesis and list the main components involved. (5 Marks)%3C/text%3E%3Ctext x='140' y='385' font-family='Plus Jakarta Sans, sans-serif' font-size='14' font-weight='700' fill='%231e293b'%3EQ2. Briefly describe what occurs during mitosis and name its four main stages. (5 Marks)%3C/text%3E%3Ctext x='140' y='630' font-family='Plus Jakarta Sans, sans-serif' font-size='14' font-weight='700' fill='%231e293b'%3EQ3. What is cellular respiration, where does it occur, and what is its primary energy product? (5 Marks)%3C/text%3E%3C/svg%3E";
      }
    }
    
    // Dynamic Blue-Ink Handwriting text layer
    const answersLayer = document.getElementById('handwritten-answers-layer');
    if (answersLayer) {
      answersLayer.innerHTML = "";
      rubric.questions.forEach(q => {
        const studentQ = student.questions[q.id];
        if (studentQ && studentQ.handwritingSample) {
          const ansDiv = document.createElement('div');
          ansDiv.style.position = 'absolute';
          ansDiv.style.left = `${(studentQ.boundingBox.x / 800) * 100}%`;
          ansDiv.style.top = `${((studentQ.boundingBox.y + 15) / 1100) * 100}%`; // Offset slightly for ruled lines alignment
          ansDiv.style.width = `${(studentQ.boundingBox.width / 800) * 100}%`;
          ansDiv.style.height = `${(studentQ.boundingBox.height / 1100) * 100}%`;
          ansDiv.style.fontFamily = 'var(--font-handwriting)';
          ansDiv.style.fontSize = '1.75rem';
          ansDiv.style.color = 'var(--accent-cyan)';
          ansDiv.style.textShadow = '0 0 1px rgba(6,182,212,0.15)';
          ansDiv.style.lineHeight = '1.4';
          ansDiv.style.pointerEvents = 'none';
          ansDiv.innerText = studentQ.handwritingSample;
          answersLayer.appendChild(ansDiv);
        }
      });
    }

    this.resizeCanvas();
    this.renderBoundingBoxes();
    this.redrawStrokes();
  }

  // Set active drawing/navigation tool
  setTool(tool) {
    this.currentTool = tool;
    if (tool === "pen") {
      this.overlay.style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23ef4444\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z\"/></svg>') 2 18, crosshair";
    } else {
      this.overlay.style.cursor = "crosshair";
    }
  }

  // Clears all drawings from red-ink layer
  clearDrawings() {
    this.strokes = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.onDrawingUpdate) {
      this.onDrawingUpdate(this.strokes);
    }
  }

  // Redraws saved strokes
  redrawStrokes() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes.forEach(stroke => {
      if (stroke.length < 2) return;
      this.ctx.beginPath();
      this.ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        this.ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      this.ctx.stroke();
    });
  }

  // Scales the canvas cleanly for retina / crisp drawing
  resizeCanvas() {
    const parent = this.canvas.parentElement;
    const img = parent.querySelector('.student-paper-image');
    
    if (img && img.complete) {
      this.canvas.width = img.naturalWidth || 800;
      this.canvas.height = img.naturalHeight || 1100;
      this.redrawStrokes();
    } else if (img) {
      img.onload = () => {
        this.canvas.width = img.naturalWidth || 800;
        this.canvas.height = img.naturalHeight || 1100;
        this.redrawStrokes();
        this.renderBoundingBoxes();
      };
    }
  }

  // Render bounding boxes around handwritten text regions
  renderBoundingBoxes() {
    // Clear old bounding boxes in the overlay
    this.overlay.innerHTML = "";
    if (!this.currentStudent || !this.currentRubric) return;

    this.currentRubric.questions.forEach(q => {
      const studentQ = this.currentStudent.questions[q.id];
      if (!studentQ || !studentQ.boundingBox) return;

      const box = studentQ.boundingBox;
      const boxDiv = document.createElement('div');
      
      boxDiv.className = `grading-box ${studentQ.status || 'incorrect'}`;
      if (q.id === this.activeQuestionId) {
        boxDiv.classList.add('active');
      }

      // Position absolute inside container
      boxDiv.style.left = `${(box.x / 800) * 100}%`;
      boxDiv.style.top = `${(box.y / 1100) * 100}%`;
      boxDiv.style.width = `${(box.width / 800) * 100}%`;
      boxDiv.style.height = `${(box.height / 1100) * 100}%`;
      
      // Score Tag indicator
      const scoreTag = document.createElement('div');
      scoreTag.className = 'box-score-tag';
      scoreTag.innerText = `${studentQ.score} / ${q.maxMarks}`;
      boxDiv.appendChild(scoreTag);

      // Register click
      boxDiv.addEventListener('click', (e) => {
        if (this.currentTool === "pen") return; // Let drawing draw instead of opening box
        e.stopPropagation();
        
        // Highlight this box
        document.querySelectorAll('.grading-box').forEach(b => b.classList.remove('active'));
        boxDiv.classList.add('active');
        this.activeQuestionId = q.id;

        if (this.onBoxClick) {
          this.onBoxClick(q.id);
        }
      });

      this.overlay.appendChild(boxDiv);
    });
  }

  // Programmatically focus a question bounding box
  focusQuestion(qId) {
    this.activeQuestionId = qId;
    this.renderBoundingBoxes();
  }
}
