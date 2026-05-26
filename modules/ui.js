/**
 * SmartGrader AI - User Interface Controller Module
 * Handles DOM manipulation, routing, modals, drawers, custom canvas-based charts, and scanning overlays.
 */

export class UIController {
  constructor(app) {
    this.app = app;
    this.activePage = "dashboard"; // dashboard, roster, grading, rubrics
    this.selectedSubjectId = "all"; // Default to show all subject folders
    this.initDOM();
  }

  initDOM() {
    // Top-level Navigation Links
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        this.navigateTo(page);
      });
    });

    // Register Upload trigger
    const uploadCard = document.getElementById('upload-card');
    if (uploadCard) {
      uploadCard.addEventListener('click', () => {
        document.getElementById('hidden-file-input').click();
      });
    }

    // Hidden File input change
    const fileInput = document.getElementById('hidden-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.triggerScanningOverlay(e.target.files[0]);
        }
      });
    }

    // Create Folder/Subject button trigger
    const createFolderBtn = document.getElementById('btn-create-folder');
    if (createFolderBtn) {
      createFolderBtn.addEventListener('click', () => {
        const name = prompt("Enter the name of the new Subject Folder:");
        if (name && name.trim()) {
          this.app.createNewSubject(name.trim());
        }
      });
    }

    // Modal triggers and close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });
  }

  // Visual Navigation between SPAs
  navigateTo(pageId) {
    this.activePage = pageId;
    
    // Update active sidebar link
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
      if (item.getAttribute('data-page') === pageId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide/Show page sections
    document.querySelectorAll('.page-section').forEach(section => {
      if (section.id === `${pageId}-page`) {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    });

    // Trigger page-specific initializations
    if (pageId === "dashboard") {
      this.renderDashboard();
    } else if (pageId === "roster") {
      this.renderSubjectFolders();
      this.renderRoster();
    } else if (pageId === "rubrics") {
      this.renderRubrics();
    }
  }

  // Renders the overall classroom analytics dashboard
  renderDashboard() {
    const stats = this.app.getClassroomStats();
    
    // Update Stat Cards
    document.getElementById('stat-graded').innerText = stats.gradedCount;
    document.getElementById('stat-average').innerText = `${stats.classAverage}%`;
    document.getElementById('stat-time').innerText = `${stats.timeSaved} hrs`;
    document.getElementById('stat-papers').innerText = stats.totalCount;

    // Render Grade Distribution Chart
    this.drawGradeChart(stats.gradesCount);

    // Render Recent Papers Table
    this.renderRecentPapersTable();
  }

  // Renders the horizontal subjects folders tabs bar
  renderSubjectFolders() {
    const container = document.getElementById('subject-folder-tabs');
    if (!container) return;

    container.innerHTML = "";

    // "All Folders" capsule tab
    const allTab = document.createElement('button');
    allTab.className = `btn ${this.selectedSubjectId === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`;
    allTab.innerHTML = `<i class="fas fa-folder-open"></i> All Subjects`;
    allTab.style.height = "38px";
    allTab.addEventListener('click', () => {
      this.selectedSubjectId = "all";
      this.renderSubjectFolders();
      this.renderRoster();
    });
    container.appendChild(allTab);

    // Dynamic Subject tabs
    this.app.subjects.forEach(sub => {
      const tab = document.createElement('button');
      tab.className = `btn ${this.selectedSubjectId === sub.id ? 'btn-primary' : 'btn-secondary'} btn-sm`;
      tab.innerHTML = `<i class="fas fa-folder"></i> ${sub.name}`;
      tab.style.height = "38px";
      tab.addEventListener('click', () => {
        this.selectedSubjectId = sub.id;
        this.renderSubjectFolders();
        this.renderRoster();
      });
      container.appendChild(tab);
    });
  }

  // Renders the main student list roster (with filter and delete actions)
  renderRoster() {
    const tbody = document.getElementById('roster-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = "";

    // Filter students by active folder selection
    let filteredStudents = this.app.students;
    if (this.selectedSubjectId !== "all") {
      filteredStudents = this.app.students.filter(s => s.subjectId === this.selectedSubjectId);
    }
    
    filteredStudents.forEach(student => {
      const rubric = this.app.rubrics.find(r => r.id === student.rubricId);
      const row = document.createElement('tr');
      
      const initials = student.name.split(' ').map(n => n[0]).join('');
      const badgeClass = student.status === "Graded" ? "badge-success" : "badge-warning";
      
      row.innerHTML = `
        <td>
          <div class="student-meta">
            <div class="student-initials">${initials}</div>
            <div>
              <div style="font-weight: 600;">${student.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${student.email}</div>
            </div>
          </div>
        </td>
        <td>${rubric ? rubric.name : 'Unknown Exam'}</td>
        <td><span class="badge ${badgeClass}">${student.status}</span></td>
        <td style="font-weight: 700;">${student.status === "Graded" ? `${student.score} / ${student.maxScore}` : '--'}</td>
        <td style="font-weight: 600;">${student.status === "Graded" ? `${student.percentage}%` : '--'}</td>
        <td>
          <span style="font-weight: 800; font-size: 1.1rem; color: ${student.grade === 'A' ? 'var(--success)' : 'var(--text-primary)'}">
            ${student.status === "Graded" ? student.grade : '--'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary btn-sm edit-grade-btn" data-id="${student.id}">
              <i class="fas fa-edit"></i> ${student.status === "Graded" ? "View / Regrade" : "Grade Paper"}
            </button>
            <button class="btn btn-secondary btn-sm delete-paper-btn" data-id="${student.id}" style="color:var(--danger); border-color:rgba(239,68,68,0.15); background:rgba(239,68,68,0.03);" title="Delete submission">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      `;
      
      tbody.appendChild(row);
    });

    // Bind grading button events
    tbody.querySelectorAll('.edit-grade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-id');
        this.app.openGradingSession(studentId);
      });
    });

    // Bind delete button events
    tbody.querySelectorAll('.delete-paper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-id');
        const student = this.app.students.find(s => s.id === studentId);
        if (student && confirm(`Are you sure you want to delete ${student.name}'s exam paper submission?\nThis will permanently erase all marks, comments, and red ink annotations.`)) {
          this.app.deleteStudentPaper(studentId);
        }
      });
    });
  }

  // Renders recent papers on dashboard
  renderRecentPapersTable() {
    const tbody = document.getElementById('recent-papers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    // Sort students by submission date or name, get first 3
    const recent = [...this.app.students].slice(0, 3);
    
    recent.forEach(student => {
      const initials = student.name.split(' ').map(n => n[0]).join('');
      const badgeClass = student.status === "Graded" ? "badge-success" : "badge-warning";
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="student-meta">
            <div class="student-initials" style="width:28px; height:28px; font-size:0.75rem;">${initials}</div>
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">${student.name}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${badgeClass}" style="padding:0.15rem 0.5rem; font-size:0.7rem;">${student.status}</span></td>
        <td style="font-weight: 700; font-size: 0.85rem;">${student.status === "Graded" ? `${student.score}/${student.maxScore}` : '--'}</td>
        <td>
          <button class="btn btn-secondary btn-sm edit-grade-btn" data-id="${student.id}" style="padding:0.25rem 0.6rem; font-size:0.75rem;">
            Grade
          </button>
        </td>
      `;
      
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.edit-grade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-id');
        this.app.openGradingSession(studentId);
      });
    });
  }

  // Render Rubrics Builder list
  renderRubrics() {
    const list = document.getElementById('rubrics-list');
    if (!list) return;
    
    list.innerHTML = "";
    
    this.app.rubrics.forEach(rubric => {
      const card = document.createElement('div');
      card.className = "glass-panel";
      card.style.padding = "1.5rem";
      card.style.marginBottom = "1rem";
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="font-size:1.15rem; color:var(--text-primary);">${rubric.name}</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
              Contains ${rubric.questions.length} Questions | Max Points: ${rubric.totalMaxMarks} Marks
            </p>
          </div>
          <button class="btn btn-secondary btn-sm edit-rubric-btn" data-id="${rubric.id}">
            <i class="fas fa-cog"></i> View Rubric
          </button>
        </div>
      `;
      
      list.appendChild(card);
    });

    list.querySelectorAll('.edit-rubric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        this.openRubricModal(rId);
      });
    });
  }

  // Opens Rubric Settings modal (Read-only builder view)
  openRubricModal(rId) {
    const rubric = this.app.rubrics.find(r => r.id === rId);
    if (!rubric) return;

    const modal = document.getElementById('rubric-modal');
    const title = document.getElementById('rubric-modal-title');
    const container = document.getElementById('rubric-modal-questions');
    
    title.innerText = `Rubric - ${rubric.name}`;
    container.innerHTML = "";

    rubric.questions.forEach(q => {
      const qBox = document.createElement('div');
      qBox.style.background = 'rgba(255, 255, 255, 0.02)';
      qBox.style.border = '1px solid rgba(255,255,255,0.06)';
      qBox.style.borderRadius = '8px';
      qBox.style.padding = '1rem';
      qBox.style.marginBottom = '0.75rem';

      qBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:600; font-size:0.9rem;">
          <span style="color:var(--text-primary);">${q.label}</span>
          <span style="color:var(--primary);">${q.maxMarks} Marks</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">
          <strong>Prompt:</strong> ${q.prompt}
        </div>
        <div style="margin-top:0.75rem;">
          <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.25rem;">
            Grading Criteria
          </div>
          <ul style="list-style:none; padding-left:0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
            ${q.criteria.map(c => `
              <li style="font-size:0.8rem; color:var(--text-secondary); display:flex; justify-content:space-between;">
                <span>• ${c.text}</span>
                <span style="font-weight:600;">+${c.points} pt</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
      container.appendChild(qBox);
    });

    modal.classList.add('open');
  }

  // Draw Grade distribution chart inside Canvas element
  drawGradeChart(gradeCounts) {
    const canvas = document.getElementById('grade-distribution-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    
    // Resize based on container dimensions
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Background clearing
    ctx.clearRect(0, 0, width, height);

    // Chart Configuration
    const paddingLeft = 40;
    const paddingBottom = 30;
    const chartHeight = height - paddingBottom - 10;
    const chartWidth = width - paddingLeft - 10;

    const grades = ['A', 'B', 'C', 'D', 'F'];
    const values = grades.map(g => gradeCounts[g] || 0);
    const maxVal = Math.max(...values, 4); // Grid top value

    // Dotted gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= 4; i++) {
      const y = 10 + (chartHeight * (4 - i)) / 4;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();

      // Axis label values
      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '10px Plus Jakarta Sans';
      ctx.setLineDash([]);
      ctx.fillText(Math.round((maxVal * i) / 4), 10, y + 4);
      ctx.setLineDash([4, 4]);
    }

    ctx.setLineDash([]); // Reset dash

    // Draw bars
    const barWidth = chartWidth / grades.length - 20;
    const spacing = chartWidth / grades.length;

    grades.forEach((grade, idx) => {
      const val = values[idx];
      const barHeight = (val / maxVal) * chartHeight;
      const x = paddingLeft + idx * spacing + 10;
      const y = height - paddingBottom - barHeight;

      // Premium Gradient
      const gradient = ctx.createLinearGradient(x, y, x, height - paddingBottom);
      gradient.addColorStop(0, 'var(--primary)');
      gradient.addColorStop(1, 'var(--secondary)');

      ctx.fillStyle = gradient;
      
      // Draw rounded rectangle bars
      this.drawRoundedRect(ctx, x, y, barWidth, barHeight, 6);
      ctx.fill();

      // Draw values on top of bar
      if (val > 0) {
        ctx.fillStyle = 'var(--text-primary)';
        ctx.font = 'bold 11px Plus Jakarta Sans';
        ctx.fillText(val, x + barWidth / 2 - 4, y - 6);
      }

      // X Axis Label
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = '600 12px Plus Jakarta Sans';
      ctx.fillText(grade, x + barWidth / 2 - 5, height - 10);
    });
  }

  // Draws clean rectangles with rounded corners on Canvas
  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height < radius) radius = height; // Avoid drawing overflow
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Play scanning animation when paper is uploaded
  triggerScanningOverlay(file) {
    const overlay = document.getElementById('scanning-overlay');
    const fill = document.getElementById('scan-progress-fill');
    
    if (!overlay || !fill) return;

    overlay.style.display = "flex";
    fill.style.width = "0%";

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Finalize grading simulation
        setTimeout(() => {
          overlay.style.display = "none";
          this.app.importNewSubmission(file);
        }, 600);
      }
      fill.style.width = `${progress}%`;
    }, 100);
  }
}
