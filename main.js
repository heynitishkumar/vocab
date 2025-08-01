const state = {};
let currentSet = "";
let timer = null;
let startTime = 0;
let allQuizzes = {}; // dynamically loaded

function shuffleArray(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function loadSet(letter) {
  fetch(`set${letter.toLowerCase()}.json`)
    .then(response => response.json())
    .then(data => {
      allQuizzes[letter] = data[letter];
      startQuiz(letter);
    })
    .catch(err => {
      alert(`Failed to load Set ${letter}: ${err}`);
    });
}

function startQuiz(letter) {
  currentSet = letter;
  if (!state[letter]) {
    state[letter] = {
      questions: allQuizzes[letter],
      index: 0,
      score: 0,
      times: [],
      completed: false,
      feedbacks: []
    };
  }
  const quiz = state[letter];
  quiz.index = 0;
  quiz.completed = false;
  loadQuestion(letter);
}


function loadQuestion(letter) {
  clearInterval(timer);
  const quiz = state[letter];
  const q = quiz.questions[quiz.index];
  const area = document.getElementById("quizArea");

  const previousChoice = quiz.feedbacks[quiz.index]?.selected;

  area.innerHTML = `
    <div class="question">Q${quiz.index + 1}: ${q.question}</div>
    ${shuffleArray(q.options).map(opt =>
      `<div class="option"><input type="radio" name="answer" value="${opt}" ${opt === previousChoice ? 'checked' : ''} onchange="submitAnswer()" /> ${opt}</div>`
    ).join('')}
    <div class="timer" id="timer">Time left: 15s</div>
    <button id="screenshotBtn">📸 Take Screenshot</button>
   
  `;

  setTimeout(() => {
    const btn = document.getElementById("screenshotBtn");
    btn.addEventListener("click", () => {
      const quizBox = document.querySelector(".quiz-box");
      html2canvas(quizBox).then(canvas => {
        const link = document.createElement("a");
        link.download = `quiz-question-${quiz.index + 1}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  }, 50);

  startTimer();
  startTime = Date.now();
}

function startTimer() {
  clearInterval(timer);
  let timeLeft = 15;
  const display = document.getElementById("timer");
  display.innerText = `Time left: ${timeLeft}s`;

  timer = setInterval(() => {
    timeLeft--;
    display.innerText = `Time left: ${timeLeft}s`;
    if (timeLeft === 0) {
      clearInterval(timer);
      submitAnswer(true);
    }
  }, 1000);
}

function submitAnswer(auto = false, manualNext = false) {
  clearInterval(timer);
  const quiz = state[currentSet];
  const q = quiz.questions[quiz.index];
  const selected = document.querySelector('input[name="answer"]:checked');
  const timeSpent = Math.round((Date.now() - startTime) / 1000);
  if (!quiz.times[quiz.index]) quiz.times[quiz.index] = timeSpent;

  let message = "";
  const choice = selected ? selected.value : null;

  if (!quiz.feedbacks[quiz.index]) {
    if (!choice) {
      message = `⏰ Time's up!<br><strong>Correct:</strong> ${q.answer}<br>${q.explanation}`;
    } else if (choice === q.answer) {
      quiz.score++;
      message = `✅ Correct! ${q.explanation}`;
    } else {
      message = `❌ Incorrect.<br><strong>Correct:</strong> ${q.answer}<br>${q.explanation}`;
    }

    quiz.feedbacks[quiz.index] = {
      question: q.question,
      feedback: message,
      selected: choice
    };
  }

  const fb = document.createElement("div");
  fb.className = "feedback";
  fb.innerHTML = message;
  document.getElementById("quizArea").appendChild(fb);

  if (!auto && !manualNext) {
    setTimeout(() => {
      quiz.index++;
      if (quiz.index < quiz.questions.length) {
        loadQuestion(currentSet);
      } else {
        quiz.completed = true;
        showSummary(currentSet);
      }
    }, 100);
  }

  if (manualNext) {
    quiz.index++;
    if (quiz.index < quiz.questions.length) {
      loadQuestion(currentSet);
    } else {
      quiz.completed = true;
      showSummary(currentSet);
    }
  }
}

function navigateNext() {
  submitAnswer(false, true);
}

function navigatePrevious() {
  const quiz = state[currentSet];
  if (quiz.index > 0) {
    quiz.index--;
    loadQuestion(currentSet);
  }
}

function showSummary(letter) {
  const quiz = state[letter];
  const area = document.getElementById("quizArea");
  let summary = `<div class="summary"><h3>📊 ${letter} Words – Quiz Summary</h3>`;
  summary += `<p><strong>Score:</strong> ${quiz.score} / ${quiz.questions.length}</p>`;
  summary += `<strong>⏱ Time per question:</strong><br>`;
  quiz.times.forEach((t, i) => {
    summary += `Q${i + 1}: ${t} seconds<br>`;
  });
  summary += `<br><strong>📝 Feedback:</strong><br>`;
  quiz.feedbacks.forEach((f, i) => {
    summary += `<p><strong>Q${i + 1}:</strong> ${f.question}<br>${f.feedback}</p>`;
  });
  summary += `<br><button onclick="reviewAnswers('${letter}')">🔁 Review Questions</button>`;
  summary += `<button onclick="exportFullSummary('${letter}')">📥 Export Full PDF</button>`;
  summary += `</div>`;
  area.innerHTML = summary;
}

function reviewAnswers(letter) {
  const quiz = state[letter];
  const area = document.getElementById("quizArea");

  let reviewHTML = `<div class="summary"><h3>🔁 Review – ${letter} Words</h3>`;

  quiz.questions.forEach((q, i) => {
    const userFeedback = quiz.feedbacks[i];
    const userChoice = userFeedback?.selected;

    reviewHTML += `
      <div class="question"><strong>Q${i + 1}:</strong> ${q.question}</div>
      <ul>
        ${q.options.map(opt => {
          const isCorrect = opt === q.answer;
          const isSelected = opt === userChoice;
          const mark = isCorrect ? "✅" : isSelected ? "❌" : "▫";
          const label = isSelected ? ' <em>(you chose this)</em>' : "";
          return `<li>${mark} ${opt}${label}</li>`;
        }).join("")}
      </ul>
      <div class="feedback">${userFeedback.feedback}</div><hr>
    `;
  });

  reviewHTML += `<button onclick="showSummary('${letter}')">⬅ Back to Summary</button>`;
  reviewHTML += `</div>`;
  area.innerHTML = reviewHTML;
}
 
function toggleSidebar() {
  document.body.classList.toggle("hide-sidebar");
}
async function exportFullSummary(letter) {
  const { jsPDF } = window.jspdf;
  const quizArea = document.getElementById("quizArea");
  const originalHTML = quizArea.innerHTML;

  // Switch to review mode to show all questions and feedbacks
  reviewAnswers(letter);

  // Allow a short delay for rendering
  await new Promise(resolve => setTimeout(resolve, 300));

  html2canvas(quizArea, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`vocab-review-${letter}.pdf`);

    // Restore original summary view
    showSummary(letter);
  });
}


function submitQuizNow() {
  if (confirm("Are you sure you want to submit the quiz now?")) {
    const quiz = state[currentSet];
    quiz.completed = true;
    showSummary(currentSet);
  }
}
