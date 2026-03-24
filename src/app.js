// NOTE: When displaying, creating, or updating items, always handle missing properties gracefully.
// This ensures backward compatibility with files created in previous versions of the app.

let projectData = {
  projectName: "Untitled Project",
  categories: [],
  tasks: [],
  people: [],
  milestones: [],
};
const emojiList = [
  "🏁",
  "🚀",
  "🎉",
  "📅",
  "✅",
  "❗",
  "⭐",
  "🛠️",
  "📈",
  "💡",
  "❌",
  "⏰",
  "🎁",
  "💯",
  "📌",
  "🚩",
  "🎯",
  "🔑",
  "🔒",
  "🚦",
  "📣",
  "📝",
];

let filePathDisplay;
let lastEditedDisplay;
let categoryFilterChoices;

function updateStatusBar(lastEdited = null) {
  if (fileHandle && fileHandle.name) {
    filePathDisplay.textContent = `File: ${fileHandle.name}`;
    filePathDisplay.title = fileHandle.name; // Set tooltip to full file name
  } else {
    filePathDisplay.textContent = "File: (unsaved project)";
    filePathDisplay.title = "No file loaded.";
  }

  if (lastEdited) {
    lastEditedDisplay.textContent = `Last Edited: ${lastEdited.toLocaleString()}`;
  } else {
    lastEditedDisplay.textContent = "";
  }
}

function populateEmojiGrid(selectedEmoji) {
  const emojiGrid = document.getElementById("milestoneEmojiGrid");
  emojiGrid.innerHTML = ""; // Clear existing emojis

  emojiList.forEach((emoji) => {
    const emojiButton = document.createElement("button");
    emojiButton.type = "button"; // Ensure it doesn't submit the form
    emojiButton.classList.add("emoji-button");
    emojiButton.textContent = emoji;

    // Highlight the selected emoji
    if (emoji === selectedEmoji) {
      emojiButton.classList.add("selected");
    }

    emojiButton.addEventListener("click", () => {
      // Remove 'selected' class from all buttons
      document
        .querySelectorAll(".emoji-button")
        .forEach((btn) => btn.classList.remove("selected"));
      // Add 'selected' class to the clicked button
      emojiButton.classList.add("selected");
      // Update the hidden input value
      document.getElementById("milestoneEmoji").value = emoji;
    });

    emojiGrid.appendChild(emojiButton);
  });
}
const CATEGORY_HEADING_HEIGHT = 30; // Adjust as needed
let fileHandle;
let currentMilestoneId = null;
let currentTaskIndex = null;

// Helper function to detect circular dependencies
function hasCircularDependency(tasks, currentTaskIndex, visited = new Set()) {
  if (visited.has(currentTaskIndex)) {
    return true; // Cycle detected
  }
  visited.add(currentTaskIndex);

  const task = tasks[currentTaskIndex];
  if (!task || !Array.isArray(task.dependencies)) {
    visited.delete(currentTaskIndex);
    return false;
  }

  for (const depIndex of task.dependencies) {
    if (depIndex === currentTaskIndex) {
      // Task depends on itself
      visited.delete(currentTaskIndex);
      return true;
    }
    if (hasCircularDependency(tasks, depIndex, visited)) {
      visited.delete(currentTaskIndex);
      return true;
    }
  }

  visited.delete(currentTaskIndex);
  return false;
}

const projectNameDisplay = document.getElementById("projectNameDisplay");
const projectNameInput = document.getElementById("projectNameInput");
const editProjectNameButton = document.getElementById("editProjectNameButton");

function updateProjectNameDisplay() {
  projectNameDisplay.textContent =
    projectData.projectName || "Untitled Project";
  projectNameInput.value = projectData.projectName || "Untitled Project";
}

function startResizing(e, taskIndex, taskElem, direction) {
  isResizing = true;
  resizeTaskIndex = taskIndex;
  resizeTaskElement = taskElem;
  resizeDirection = direction;
  initialMouseX = e.clientX;
  const task = projectData.tasks[taskIndex];
  initialTaskStart = new Date(task.start + "T00:00:00Z");
  initialTaskDuration = task.duration;

  // Prevent text selection
  document.body.style.userSelect = "none";
  ganttChart.classList.add("resizing");
}

function resizeTask(e) {
  const deltaX = e.clientX - initialMouseX;
  const deltaDays = Math.round(deltaX / pixelsPerDay);

  const task = projectData.tasks[resizeTaskIndex];

  // Check for dependency constraints
  let isValid = true;

  if (resizeDirection === "left") {
    // Adjust start date and duration
    const newStartDate = new Date(
      initialTaskStart.getTime() + deltaDays * 24 * 60 * 60 * 1000
    );
    const newDuration = initialTaskDuration - deltaDays;

    if (newDuration >= 1) {
      // For adjusting start date
      const dependencies = task.dependencies || [];
      dependencies.forEach((depIndex) => {
        const depTask = projectData.tasks[depIndex];
        const depEndDate = new Date(depTask.start + "T00:00:00Z");
        depEndDate.setDate(depEndDate.getDate() + depTask.duration);
        if (newStartDate < depEndDate) {
          isValid = false;
        }
      });

      if (isValid) {
        task.start = newStartDate.toISOString().split("T")[0];
        task.duration = newDuration;

        // Update the task element position and width
        resizeTaskElement.style.left = `${
          ((newStartDate - projectStartDate) / (1000 * 60 * 60 * 24)) *
          pixelsPerDay
        }px`;
        resizeTaskElement.style.width = `${task.duration * pixelsPerDay}px`;
      }
    }
  } else if (resizeDirection === "right") {
    // Adjust duration
    const newDuration = initialTaskDuration + deltaDays;
    if (newDuration >= 1) {
      task.duration = newDuration;

      // Update the task element width
      resizeTaskElement.style.width = `${task.duration * pixelsPerDay}px`;
    }
  }
}

function stopResizing(e) {
  isResizing = false;
  resizeTaskIndex = null;
  resizeTaskElement = null;
  resizeDirection = null;
  document.body.style.userSelect = "";
  ganttChart.classList.remove("resizing");

  // Re-render the chart to adjust dependencies and positions
  renderGanttChart(projectData);
  // Save project data
  saveProjectData(projectData, true);
}

function handleScroll() {
    const ganttChartRect = ganttChart.getBoundingClientRect();

    // Select all task bars
    const taskBars = ganttChart.querySelectorAll('.task-bar');

    taskBars.forEach(taskBar => {
        const taskBarRect = taskBar.getBoundingClientRect();
        const taskContent = taskBar.querySelector('.task-content');
        const taskButtons = taskBar.querySelector('.task-buttons');

        if (taskContent && taskButtons) {
            // Calculate the amount the task bar is hidden to the left
            const offset = ganttChartRect.left - taskBarRect.left;

            // Calculate the maximum offset to prevent overlapping with the buttons
            const maxOffset = Math.max(0, taskBarRect.width - taskButtons.offsetWidth - taskContent.offsetWidth);

            if (offset > 0) {
                // Task bar is partially hidden to the left
                const adjustedOffset = Math.min(offset, maxOffset);
                taskContent.style.transform = `translateX(${adjustedOffset}px)`;
            } else {
                // Reset the transform when the task bar is fully visible
                taskContent.style.transform = 'translateX(0)';
            }
        }
    });
}

// When the edit button is clicked
editProjectNameButton.addEventListener("click", () => {
  projectNameDisplay.style.display = "none";
  projectNameInput.style.display = "inline-block";
  projectNameInput.focus();
});

// When the user finishes editing (input loses focus)
projectNameInput.addEventListener("blur", () => {
  projectData.projectName = projectNameInput.value.trim() || "Untitled Project";
  projectNameDisplay.style.display = "inline";
  projectNameInput.style.display = "none";
  updateProjectNameDisplay();
  // Optionally save the project data to persist the name change
  saveProjectData(projectData, true);
});

// Optional: Allow pressing Enter to finish editing
projectNameInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    projectNameInput.blur();
  }
});

function getISOWeekNumber(date) {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
  // Get first day of the year
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  // Calculate full weeks to the nearest Thursday
  const weekNo = Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

let pixelsPerDay = 30; // For horizontal zoom
let taskHeight = 30; // For vertical zoom
let taskSpacing = 5;
const GANTT_CHART_PADDING_TOP = 60; // This should match the padding-top in styles.css

let isPanning = false;
let startX = 0;
let startY = 0;
let scrollLeft = 0;
let scrollTop = 0;

let isShiftKeyDown = false;
let isResizing = false;
let resizeTaskIndex = null;
let resizeTaskElement = null;
let resizeDirection = null; // 'left' or 'right'
let initialMouseX = 0;
let initialTaskStart = null;
let initialTaskDuration = 0;
let projectStartDate;
let timeScaleUnit = 'days'; // Default unit for time scale display: 'days', 'weeks', or 'months'

// Add these event listeners to track the Shift key
document.addEventListener("keydown", (e) => {
  if (e.key === "Shift") {
    isShiftKeyDown = true;
    document.body.classList.add("shift-key-down");
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Shift") {
    isShiftKeyDown = false;
    document.body.classList.remove("shift-key-down");
  }
});

function computeTaskStartDate(
  index,
  taskStartDates,
  projectData,
  visited = {}
) {
  if (taskStartDates[index]) {
    return taskStartDates[index];
  }

  if (visited[index]) {
    throw new Error("Circular dependency detected in tasks.");
  }
  visited[index] = true;

  const task = projectData.tasks[index];

  // Ensure `task.start` exists and is valid
  let taskStartDate;
  if (task.start) {
    taskStartDate = new Date(task.start + "T00:00:00Z");
    if (isNaN(taskStartDate.getTime())) {
      // Invalid date, set to current date
      const currentDateStr = new Date().toISOString().split("T")[0];
      taskStartDate = new Date(currentDateStr + "T00:00:00Z");
    }
  } else {
    // Default start date if missing is current date
    const currentDateStr = new Date().toISOString().split("T")[0];
    taskStartDate = new Date(currentDateStr + "T00:00:00Z");
  }

  if (task.dependencies && task.dependencies.length > 0) {
    const latestDependencyEnd = task.dependencies.reduce(
      (latestDate, depIndex) => {
        const depStartDate = computeTaskStartDate(
          depIndex,
          taskStartDates,
          projectData,
          visited
        );
        const depTask = projectData.tasks[depIndex];
        const depEndDate = new Date(
          depStartDate.getTime() + depTask.duration * 24 * 60 * 60 * 1000
        );
        return depEndDate > latestDate ? depEndDate : latestDate;
      },
      new Date(0)
    );

    if (latestDependencyEnd > taskStartDate) {
      taskStartDate = latestDependencyEnd;
    }
  }

  taskStartDates[index] = taskStartDate;
  delete visited[index];
  return taskStartDate;
}

document
  .getElementById("loadProject")
  .addEventListener("click", async function () {
    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: "YAML Files",
              accept: { "text/yaml": [".yaml", ".yml"] },
            },
          ],
          multiple: false,
        });
        fileHandle = handle;

        const file = await fileHandle.getFile();
        const yamlText = await file.text();
        console.log("Raw YAML content:", yamlText);

        try {
          projectData = jsyaml.load(yamlText);

          // Initialize `projectName` if it's undefined or empty
          if (
            !projectData.projectName ||
            projectData.projectName.trim() === ""
          ) {
            projectData.projectName = "Untitled Project";
          }

          // Initialize tasks array if it's not an array
          if (!Array.isArray(projectData.tasks)) {
            projectData.tasks = [];
            console.warn(
              "Project data did not contain tasks array. Initialized as empty."
            );
          }

          // Initialize properties for each task
          projectData.tasks.forEach((task) => {
            if (!Array.isArray(task.dependencies)) {
              task.dependencies = [];
            }
            // Initialize missing task properties for backward compatibility
            if (!task.name) {
              task.name = "Untitled Task";
            }
            if (!task.start) {
              // Update to use the current date as default start date
              const currentDateStr = new Date().toISOString().split("T")[0]; // Format as 'YYYY-MM-DD'
              task.start = currentDateStr;
            }
            if (!task.duration || isNaN(parseInt(task.duration, 10))) {
              task.duration = 1; // Default duration
            }
            if (!task.categoryId) {
              task.categoryId = null;
            }
            if (!task.description) {
              task.description = "";
            }
            if (!task.status) {
              task.status = "on-track";
            }
            if (!task.statusExplanation) {
              task.statusExplanation = "";
            }
            if (!Array.isArray(task.assignedPeople)) {
              task.assignedPeople = [];
            }
          });
        } catch (parseError) {
          console.error("YAML Parsing Error:", parseError);
          throw new Error("Failed to parse YAML: " + parseError.message);
        }

        // Initialize `categories` if it's undefined
        if (!Array.isArray(projectData.categories)) {
          projectData.categories = [];
        }

        // Initialize `people` if it's undefined
        if (!Array.isArray(projectData.people)) {
          projectData.people = [];
        }

        // Initialize `milestones` if it's undefined (for backward compatibility with older project files)
        if (!Array.isArray(projectData.milestones)) {
          projectData.milestones = [];
        }

        console.log("Loaded projectData:", projectData);

        if (!projectData || typeof projectData !== "object") {
          throw new Error("Invalid project data: not an object");
        }

        if (!Array.isArray(projectData.tasks)) {
          projectData.tasks = [];
          console.warn(
            "Project data did not contain tasks array. Initialized as empty."
          );
        }

        // Initialize dependencies as an array for all tasks
        projectData.tasks.forEach((task) => {
          if (!Array.isArray(task.dependencies)) {
            task.dependencies = [];
          }
        });

        // Use filename as project name only if projectName is missing or empty
        if (!projectData.projectName || projectData.projectName.trim() === "") {
          projectData.projectName = fileHandle.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        }

        updateProjectNameDisplay();
        updateCategoryOptions();
        updateCategoryFilterOptions();
        updateDependenciesOptions();
        renderGanttChart(projectData);
        renderCategoriesList();

        // Save project data and file name to localStorage
        localStorage.setItem("projectData", JSON.stringify(projectData));
        localStorage.setItem("fileName", fileHandle.name);

        // Update status bar with file info
        if (fileHandle && fileHandle.name) {
          const file = await fileHandle.getFile();
          const lastModified = new Date(file.lastModified);
          updateStatusBar(lastModified);

          // Save last edited time to localStorage
          localStorage.setItem("lastEdited", lastModified.toISOString());
        } else {
          updateStatusBar();
        }
      } catch (error) {
        alert("Failed to load project: " + error.message);
        console.error("Error loading project:", error);
      }
    } else {
      alert("Your browser does not support the File System Access API.");
    }
  });

document
  .getElementById("newProject")
  .addEventListener("click", async function () {
    projectData = {
      projectName: "Untitled Project",
      tasks: [],
      categories: [],
      people: [],
    };
    fileHandle = null; // Reset the fileHandle
    updateProjectNameDisplay();
    renderGanttChart(projectData);
    updateDependenciesOptions();

    // Clear localStorage when creating a new project
    localStorage.removeItem("projectData");
    localStorage.removeItem("fileName");

    // Reset status bar
    updateStatusBar();
  });

document
  .getElementById("saveProject")
  .addEventListener("click", async function () {
    await saveProjectData(projectData, false);
  });

document
  .getElementById("saveAsProject")
  .addEventListener("click", async function () {
    fileHandle = null;
    await saveProjectData(projectData, false);
  });

document
  .getElementById("addTaskForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const editIndex = submitButton.getAttribute("data-edit-index");
    const formErrorMessage = document.getElementById("formErrorMessage");

    // Collect form inputs
    const taskName = document.getElementById("taskName").value.trim();
    let taskStart = document.getElementById("taskStart").value;

    // If taskStart is empty, use current date
    if (!taskStart) {
      taskStart = new Date().toISOString().split("T")[0];
    }
    const taskDurationValue = document.getElementById("taskDuration").value;

    // Validate task start date
    if (!taskStart) {
      formErrorMessage.textContent =
        "Please enter a valid start date for the task.";
      return;
    }

    // Validate task duration
    const taskDuration = parseInt(taskDurationValue, 10);
    if (isNaN(taskDuration) || taskDuration < 1) {
      formErrorMessage.textContent =
        "Please enter a valid duration (number greater than 0) for the task.";
      return;
    }

    // Clear the error message when validation passes
    formErrorMessage.textContent = "";

    // Collect task description
    const taskDescription = document
      .getElementById("taskDescription")
      .value.trim();

    // Collect dependencies
    const dependenciesSelect = document.getElementById("taskDependencies");
    let dependencies = Array.from(dependenciesSelect.selectedOptions).map(
      (option) => parseInt(option.value)
    );

    // If editing, remove self-dependency just in case
    if (editIndex !== null) {
      const currentIndex = parseInt(editIndex, 10);
      dependencies = dependencies.filter(
        (depIndex) => depIndex !== currentIndex
      );
    }

    // Collect selected category
    const categorySelect = document.getElementById("taskCategory");
    const categoryId = parseInt(categorySelect.value, 10);

    const taskStatus =
      document.getElementById("taskStatus").value || "on-track";
    const statusExplanation = document
      .getElementById("statusExplanation")
      .value.trim();

    // Collect assigned people
    const assignedPeopleSelect = document.getElementById("taskPeople");
    const assignedPeople = Array.from(assignedPeopleSelect.selectedOptions).map(
      (option) => parseInt(option.value)
    );

    const task = {
      name: taskName,
      start: taskStart,
      duration: taskDuration,
      dependencies: dependencies || [],
      categoryId: categoryId || null,
      description: taskDescription || "",
      status: taskStatus || "on-track",
      statusExplanation: statusExplanation || "",
      assignedPeople: assignedPeople || [],
    };

    // Create a temporary copy of tasks
    let tempTasks = projectData.tasks.slice(); // Shallow copy of the array

    let currentTaskIndex;
    if (editIndex !== null) {
      currentTaskIndex = parseInt(editIndex, 10);
      // Update the task in tempTasks
      tempTasks[currentTaskIndex] = task;
    } else {
      // Set the index for the new task
      currentTaskIndex = tempTasks.length;
      // Add new task to tempTasks
      tempTasks.push(task);
    }

    // Check for circular dependencies
    if (hasCircularDependency(tempTasks, currentTaskIndex)) {
      formErrorMessage.textContent =
        "Circular dependency detected. Please resolve the dependencies.";
      return; // Terminate the submission
    }

    // If no circular dependency is detected, proceed to add or update the task
    if (editIndex !== null) {
      projectData.tasks[currentTaskIndex] = task;
    } else {
      projectData.tasks.push(task);
    }

    // Reset the submit button for future use
    submitButton.textContent = "Add Task";
    submitButton.removeAttribute("data-edit-index");

    renderGanttChart(projectData);
    updateDependenciesOptions();

    try {
      await saveProjectData(projectData, true);
    } catch (error) {
      console.error("Error during save:", error);
      const statusMessage = document.getElementById("statusMessage");
      statusMessage.textContent = "Error saving project.";
      statusMessage.style.color = "red";
    }

    event.target.reset();
    taskModal.style.display = "none";
    choices.removeActiveItems();
  });

function renderTimeScale(projectStartDate, projectEndDate) {
  projectStartDate = new Date(
    projectStartDate.toISOString().split("T")[0] + "T00:00:00Z"
  );
  projectEndDate = new Date(
    projectEndDate.toISOString().split("T")[0] + "T00:00:00Z"
  );

  const timeScale = document.createElement("div");
  timeScale.classList.add("time-scale");

  const days = Math.ceil((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24));

  // Calculate the total width of the timescale
  const totalWidth = (days + 1) * pixelsPerDay;
  timeScale.style.width = `${totalWidth}px`;

  // Clear any existing grid lines and labels
  // (Assuming this function is called fresh each time)

  if (timeScaleUnit === 'days') {
    // Render days
    for (let i = 0; i <= days; i++) {
      const date = new Date(projectStartDate.getTime() + i * 24 * 60 * 60 * 1000);

      // Create vertical grid lines
      const daySeparator = document.createElement("div");
      daySeparator.classList.add("day-separator");
      daySeparator.style.left = `${i * pixelsPerDay}px`;
      timeScale.appendChild(daySeparator);

      // Add date labels every 7 days
      if (i % 7 === 0) {
        const dateLabel = document.createElement("div");
        dateLabel.classList.add("date-label");
        dateLabel.style.left = `${i * pixelsPerDay}px`;
        dateLabel.textContent = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        timeScale.appendChild(dateLabel);
      }
    }
  } else if (timeScaleUnit === 'weeks') {
    // Render weeks

    // Adjust start date to the Monday before or equal to projectStartDate
    const startDate = new Date(projectStartDate);
    const day = startDate.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Adjust when day is Sunday
    startDate.setDate(startDate.getDate() + diff);

    let date = new Date(startDate);
    while (date <= projectEndDate) {
      const daysFromStart = (date - projectStartDate) / (1000 * 60 * 60 * 24);
      const position = daysFromStart * pixelsPerDay;

      // Create vertical grid lines
      const weekSeparator = document.createElement("div");
      weekSeparator.classList.add("day-separator");
      weekSeparator.style.left = `${position}px`;
      timeScale.appendChild(weekSeparator);

      // Calculate Swedish (ISO) week number
      const weekNumber = getISOWeekNumber(date);

      // Add week label
      const dateLabel = document.createElement("div");
      dateLabel.classList.add("date-label");
      dateLabel.style.left = `${position}px`;
      dateLabel.textContent = `W.${weekNumber}`;
      timeScale.appendChild(dateLabel);

      // Advance to next week
      date.setDate(date.getDate() + 7);
    }
  } else if (timeScaleUnit === 'months') {
    // Render months
    const currentDate = new Date(projectStartDate.getFullYear(), projectStartDate.getMonth(), 1);
    while (currentDate <= projectEndDate) {
      const daysFromStart = (currentDate - projectStartDate) / (1000 * 60 * 60 * 24);
      const position = daysFromStart * pixelsPerDay;

      // Calculate the number of days in the current month
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      const daysInMonth = (nextMonth - currentDate) / (1000 * 60 * 60 * 24);
      const monthWidth = daysInMonth * pixelsPerDay;

      // Create vertical grid lines for the month
      const monthSeparator = document.createElement("div");
      monthSeparator.classList.add("day-separator", "month-separator");
      monthSeparator.style.left = `${position}px`;
      timeScale.appendChild(monthSeparator);

      // Create and position the date label
      const dateLabel = document.createElement("div");
      dateLabel.classList.add("date-label", "month-label");
      dateLabel.style.left = `${position}px`;
      dateLabel.style.width = `${monthWidth}px`; // Set the width to span the entire month
      dateLabel.textContent = currentDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      timeScale.appendChild(dateLabel);

      // Advance to the next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  // Add current date symbol to the time scale
  const currentDate = new Date(
    new Date().toISOString().split("T")[0] + "T00:00:00Z"
  );

  if (currentDate >= projectStartDate && currentDate <= projectEndDate) {
    const daysFromStartToCurrent =
      (currentDate - projectStartDate) / (1000 * 60 * 60 * 24);
    const currentDatePosition = daysFromStartToCurrent * pixelsPerDay;

    const currentDateSymbol = document.createElement("div");
    currentDateSymbol.classList.add("current-date-symbol");
    currentDateSymbol.style.left = `${currentDatePosition}px`;

    // Use a symbol or emoji to represent the current date
    currentDateSymbol.innerHTML = "&#x1F539;"; // Small blue diamond symbol

    currentDateSymbol.style.position = "absolute";
    currentDateSymbol.style.top = "0"; // Adjust vertical position as needed

    timeScale.appendChild(currentDateSymbol);
  }

  return timeScale;
}

function updateCategoryFilterOptions() {
  const choicesList = projectData.categories.map((category) => ({
    value: category.id.toString(),
    label: category.name,
    selected: true, // All categories selected by default
  }));

  // Add the 'Uncategorized' option
  choicesList.push({
    value: 'uncategorized',
    label: 'Uncategorized',
    selected: true,
  });

  categoryFilterChoices.clearChoices();
  categoryFilterChoices.setChoices(choicesList, 'value', 'label', false);

  // Ensure all categories are selected
  const allValues = choicesList.map(choice => choice.value);
  categoryFilterChoices.setValue(allValues);
}

function renderGanttChart(projectData) {
  if (!projectData || !Array.isArray(projectData.tasks)) {
    console.error("Invalid project data provided to renderGanttChart.");
    return;
  }

  // Ensure `projectData.milestones` is an array
  if (!Array.isArray(projectData.milestones)) {
    projectData.milestones = [];
  }

  const ganttChart = document.getElementById("ganttChart");
  ganttChart.innerHTML = "";

  if (projectData.tasks.length === 0 && projectData.milestones.length === 0)
    return;

  // Get selected categories from the Choices instance
  const selectedCategoryIds = categoryFilterChoices.getValue(true); // Returns array of selected values as strings

  // Check if 'uncategorized' is selected
  const showUncategorized = selectedCategoryIds.includes('uncategorized');

  const taskStartDates = {};
  projectData.tasks.forEach((task, index) => {
    computeTaskStartDate(index, taskStartDates, projectData);
  });

  // Group tasks by categories (only include tasks from selected categories)
  const tasksByCategory = {};
  projectData.tasks.forEach((task, index) => {
    // Use 'uncategorized' for tasks without a categoryId
    const categoryId =
      task.categoryId !== undefined && task.categoryId !== null
        ? task.categoryId.toString()
        : 'uncategorized';

    // Check if the category is selected
    if (
      (categoryId === 'uncategorized' && showUncategorized) ||
      selectedCategoryIds.includes(categoryId)
    ) {
      if (!tasksByCategory[categoryId]) {
        tasksByCategory[categoryId] = [];
      }
      tasksByCategory[categoryId].push({ task, index });
    }
  });

  // Collect start and end dates of displayed tasks
  const startDates = [];
  const endDates = [];

  Object.values(tasksByCategory).forEach(taskArray => {
    taskArray.forEach(({ task, index }) => {
      const startDate = taskStartDates[index];
      const endDate = new Date(startDate.getTime() + task.duration * 24 * 60 * 60 * 1000);
      startDates.push(startDate);
      endDates.push(endDate);
    });
  });

  // Collect milestone dates
  const milestoneDates = projectData.milestones.map(
    (milestone) => new Date(milestone.date + "T00:00:00Z")
  );

  if (startDates.length === 0) {
    ganttChart.innerHTML = ''; // Clear the chart
    const noTasksMessage = document.createElement('div');
    noTasksMessage.textContent = 'No tasks to display. Please select at least one category.';
    noTasksMessage.style.padding = '20px';
    ganttChart.appendChild(noTasksMessage);
    return; // Exit the function early
  }

  let startDate = new Date(Math.min(...startDates));
  let endDate = new Date(Math.max(...endDates));

  if (milestoneDates.length > 0) {
    const earliestMilestoneDate = new Date(Math.min(...milestoneDates));
    const latestMilestoneDate = new Date(Math.max(...milestoneDates));

    if (earliestMilestoneDate < startDate) {
      startDate = earliestMilestoneDate;
    }
    if (latestMilestoneDate > endDate) {
      endDate = latestMilestoneDate;
    }
  }

  projectStartDate = startDate;
  projectEndDate = endDate;

  const fragment = document.createDocumentFragment();
  const TIME_SCALE_HEIGHT = 60; // The height of the time scale in pixels
  let currentTop = TIME_SCALE_HEIGHT; // Start rendering tasks below the time scale

  // Sort tasks within each category by starting date
  Object.keys(tasksByCategory).forEach((categoryId) => {
    tasksByCategory[categoryId].sort((a, b) => {
      const startDateA = taskStartDates[a.index];
      const startDateB = taskStartDates[b.index];
      return startDateA - startDateB;
    });
  });

  // Iterate over categories as per projectData.categories order
  for (const category of projectData.categories) {
    const categoryId = category.id;
    const categoryTasks = tasksByCategory[categoryId] || [];

    if (categoryTasks.length > 0) {
      // Render category heading
      const categoryElement = document.createElement("div");
      categoryElement.classList.add("category-heading");
      categoryElement.style.top = `${currentTop}px`;
      categoryElement.textContent = category.name;
      categoryElement.style.borderLeftColor = category.color;
      fragment.appendChild(categoryElement);
      currentTop += taskHeight + 10;

      // Render tasks within this category
      categoryTasks.forEach(({ task, index }) => {
        const taskElement = document.createElement("div");
        taskElement.classList.add("task-bar");

        // Use default values for missing properties
        const taskName = task.name || "Untitled Task";
        const taskDuration = task.duration || 1; // Default duration of 1 day

        taskElement.style.width = `${taskDuration * pixelsPerDay}px`;
        taskElement.style.height = `${taskHeight}px`;

        // Ensure `taskStartDate` is valid
        let taskStartDate = taskStartDates[index];
        if (!taskStartDate || isNaN(taskStartDate.getTime())) {
          // Set to current date if invalid
          const currentDateStr = new Date().toISOString().split("T")[0];
          taskStartDate = new Date(currentDateStr + "T00:00:00Z");
        }

        const daysFromStart =
          (taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24);

        taskElement.style.left = `${daysFromStart * pixelsPerDay}px`;
        taskElement.style.top = `${currentTop}px`;

        // Set task color based on category
        taskElement.style.backgroundColor = category.color;

        const tooltipContent = `
                    Name: ${taskName}
                    Start: ${taskStartDate.toISOString().split("T")[0]}
                    Duration: ${taskDuration} days
                    Dependencies: ${
                      (task.dependencies || [])
                        .map((depIndex) => projectData.tasks[depIndex]?.name)
                        .join(", ") || "None"
                    }
                `;

        taskElement.setAttribute("data-tooltip", tooltipContent);

        const taskEndDate = new Date(
          taskStartDate.getTime() + taskDuration * 24 * 60 * 60 * 1000
        );

        let displayStatus = task.status || "on-track";
        const currentDate = new Date();

        // If current date is past the task's end date and task is not scrapped or finished
        if (
          currentDate > taskEndDate &&
          displayStatus !== "scrapped" &&
          displayStatus !== "finished"
        ) {
          displayStatus = "high risk";
        }

        let statusIndicatorHTML;

        if (displayStatus === "finished") {
          statusIndicatorHTML = `<div class="status-indicator ${getStatusClass(
            displayStatus
          )}">🎉</div>`;
        } else {
          statusIndicatorHTML = `<div class="status-indicator ${getStatusClass(
            displayStatus
          )}"></div>`;
        }

        // Get the first assignee's name, if any
        let firstAssigneeName = "";
        if (
          Array.isArray(task.assignedPeople) &&
          task.assignedPeople.length > 0
        ) {
          const firstPersonId = task.assignedPeople[0];
          const firstPerson = projectData.people.find(
            (p) => p.id === firstPersonId
          );
          if (firstPerson) {
            firstAssigneeName = firstPerson.name;
          }
        }

        // Modify taskElement based on assignment
        let assignmentDisplay = "";
        if (!firstAssigneeName) {
          // Task is unassigned
          taskElement.style.border = "2px solid red";
          assignmentDisplay = " ❓";
        } else {
          // Task has an assignee, display the name
          assignmentDisplay = `<span class="assignee-name">${firstAssigneeName}</span>`;
        }

        taskElement.innerHTML = `
                    <div class="task-content">
                        ${statusIndicatorHTML}
                        <span class="task-name">${taskName}${assignmentDisplay}</span>
                    </div>
                    <div class="task-resize-handle left"></div>
                    <div class="task-buttons">
                        <button class="edit-task" data-index="${index}"><i class="fas fa-edit"></i></button>
                        <button class="delete-task" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                    <div class="task-resize-handle right"></div>
                `;
        taskElement.setAttribute("role", "button");
        taskElement.setAttribute("tabindex", "0");
        taskElement.setAttribute("aria-label", `Task: ${task.name}`);
        taskElement.setAttribute("data-index", index);

        taskElement.addEventListener("mousedown", (e) => {
          e.stopPropagation();
        });

        taskElement.addEventListener("touchstart", (e) => {
          e.stopPropagation();
        });

        fragment.appendChild(taskElement);
        currentTop += taskHeight + taskSpacing;

        // Get the resize handles
        const leftHandle = taskElement.querySelector(
          ".task-resize-handle.left"
        );
        const rightHandle = taskElement.querySelector(
          ".task-resize-handle.right"
        );

        // Add event listeners for mousedown on the resize handles
        leftHandle.addEventListener("mousedown", (e) => {
          if (isShiftKeyDown) {
            e.stopPropagation();
            startResizing(e, index, taskElement, "left");
          }
        });

        rightHandle.addEventListener("mousedown", (e) => {
          if (isShiftKeyDown) {
            e.stopPropagation();
            startResizing(e, index, taskElement, "right");
          }
        });
      });
    }
  }

  // Handle 'Uncategorized' tasks after defined categories
  const uncategorizedTasks = tasksByCategory["uncategorized"] || [];
  if (uncategorizedTasks.length > 0) {
    // Render 'Uncategorized' category heading
    const categoryElement = document.createElement("div");
    categoryElement.classList.add("category-heading");
    categoryElement.style.top = `${currentTop}px`;
    categoryElement.textContent = "Uncategorized";
    categoryElement.style.borderLeftColor = "#999";
    fragment.appendChild(categoryElement);
    currentTop += taskHeight + 10;

    // Render tasks within this category
    uncategorizedTasks.forEach(({ task, index }) => {
      // Existing code to render each task (same as in the loop above)
      // ... (copy the task rendering code from above and paste it here)
    });
  }

  ganttChart.appendChild(fragment);

  // Append the time scale first
  const timeScale = renderTimeScale(projectStartDate, projectEndDate);
  ganttChart.appendChild(timeScale);

  // Render milestones and append them to the timeScale
  projectData.milestones.forEach((milestone) => {
    const milestoneDate = new Date(milestone.date + "T00:00:00Z");
    const daysFromStart =
      (milestoneDate - projectStartDate) / (1000 * 60 * 60 * 24);

    const milestoneElement = document.createElement("div");
    milestoneElement.classList.add("milestone");
    milestoneElement.style.left = `${daysFromStart * pixelsPerDay}px`;
    milestoneElement.style.top = "30px"; // Position within time scale

    // Set milestone color based on category
    let category;
    if (milestone.categoryId !== null) {
      category = projectData.categories.find(
        (cat) => cat.id === milestone.categoryId
      );
    }
    milestoneElement.style.color = category ? category.color : "#000";

    // Set milestone icon or emoji
    const milestoneIcon = milestone.emoji || "🚩"; // Use custom emoji or default
    milestoneElement.innerHTML = milestoneIcon;

    // Tooltip content
    const tooltipContent = `
            Milestone: ${milestone.name}
            Date: ${milestone.date}
        `;
    milestoneElement.setAttribute("data-tooltip", tooltipContent);

    // Optional: Adjust styling if needed
    milestoneElement.style.fontSize = "24px"; // Ensure emoji is visible

    // Add event listener to show milestone details
    milestoneElement.addEventListener("click", () => {
      showMilestoneDetails(milestone.id);
    });

    timeScale.appendChild(milestoneElement);
  });
}

document
  .getElementById("ganttChart")
  .addEventListener("click", async function (event) {
    const editButton = event.target.closest(".edit-task");
    const deleteButton = event.target.closest(".delete-task");
    const taskBar = event.target.closest(".task-bar");

    if (editButton) {
      const taskIndex = parseInt(editButton.getAttribute("data-index"), 10);
      editTask(taskIndex);
    } else if (deleteButton) {
      const taskIndex = parseInt(deleteButton.getAttribute("data-index"), 10);
      await deleteTask(taskIndex);
    } else if (taskBar) {
      // Open the task details modal
      const taskIndex = parseInt(taskBar.getAttribute("data-index"), 10);
      showTaskDetails(taskIndex);
    }
  });

function showTaskDetails(taskIndex) {
  currentTaskIndex = taskIndex; // Store the current task index
  const task = projectData.tasks[taskIndex];
  document.getElementById("detailTaskName").textContent =
    task.name || "Untitled Task";

  // Handle missing description
  const rawDescription = marked.parse(task.description || "No description.");
  const sanitizedDescription = DOMPurify.sanitize(rawDescription);
  document.getElementById("detailTaskDescription").innerHTML =
    sanitizedDescription;

  document.getElementById("detailTaskStart").textContent =
    task.start || "Unknown Start Date";
  document.getElementById("detailTaskDuration").textContent =
    (task.duration || 1) + " days";
  document.getElementById("detailTaskDependencies").textContent =
    (task.dependencies || [])
      .map((depIndex) => projectData.tasks[depIndex]?.name)
      .join(", ") || "None";

  // Compute inbound dependencies (tasks that depend on this task)
  const inboundDependencies = projectData.tasks
    .map((otherTask, idx) => {
      if (
        Array.isArray(otherTask.dependencies) &&
        otherTask.dependencies.includes(taskIndex)
      ) {
        return otherTask.name || "Untitled Task";
      }
      return null;
    })
    .filter((taskName) => taskName !== null);

  // Display inbound dependencies
  document.getElementById("detailInboundDependencies").textContent =
    inboundDependencies.join(", ") || "None";

  // Handle missing status
  document.getElementById("detailTaskStatus").textContent =
    task.status || "on-track";

  // Handle missing status explanation
  const rawStatusExplanation = marked.parse(
    task.statusExplanation || "No status explanation."
  );
  const sanitizedStatusExplanation = DOMPurify.sanitize(rawStatusExplanation);
  document.getElementById("detailStatusExplanation").innerHTML =
    sanitizedStatusExplanation;

  // Display assigned people
  document.getElementById("detailAssignedPeople").textContent =
    (task.assignedPeople || [])
      .map(
        (personId) => projectData.people.find((p) => p.id === personId)?.name
      )
      .join(", ") || "None";

  // Show the modal
  const taskDetailsModal = document.getElementById("taskDetailsModal");
  taskDetailsModal.style.display = "block";
}

// Add event listener to close the task details modal
const taskDetailsModal = document.getElementById("taskDetailsModal");
const closeTaskDetailsModalButton =
  taskDetailsModal.querySelector(".close-button");
closeTaskDetailsModalButton.addEventListener("click", () => {
  taskDetailsModal.style.display = "none";
});

// Close the modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === taskDetailsModal) {
    taskDetailsModal.style.display = "none";
  }
});

// Get references to the edit and delete buttons
const editTaskButton = document.getElementById("editTaskButton");
const deleteTaskButton = document.getElementById("deleteTaskButton");

// Event listener for the Edit button
editTaskButton.addEventListener("click", () => {
  if (currentTaskIndex !== null) {
    editTask(currentTaskIndex);
    taskDetailsModal.style.display = "none";
  }
});

// Event listener for the Delete button
deleteTaskButton.addEventListener("click", async () => {
  if (currentTaskIndex !== null) {
    await deleteTask(currentTaskIndex);
    taskDetailsModal.style.display = "none";
  }
});

function editTask(taskIndex) {
  const task = projectData.tasks[taskIndex];

  // Ensure dependencies is an array
  if (!Array.isArray(task.dependencies)) {
    task.dependencies = [];
  }

  updateDependenciesOptions(taskIndex);
  updateCategoryOptions();
  updatePeopleOptions();

  // Ensure defaults for missing properties
  document.getElementById("taskName").value = task.name || "";
  document.getElementById("taskStart").value =
    task.start || new Date().toISOString().split("T")[0];
  document.getElementById("taskDuration").value = task.duration || 1;
  document.getElementById("taskDescription").value = task.description || "";
  document.getElementById("taskStatus").value = task.status || "on-track";
  document.getElementById("statusExplanation").value =
    task.statusExplanation || "";

  // Pre-select dependencies
  choices.setChoiceByValue((task.dependencies || []).map(String));

  // Pre-select assigned people
  peopleChoices.setChoiceByValue((task.assignedPeople || []).map(String));

  // Set the selected category
  const categorySelect = document.getElementById("taskCategory");
  categorySelect.value = task.categoryId || "";

  const submitButton = document.querySelector('#addTaskForm button[type="submit"]');
  submitButton.textContent = "Update Task";
  submitButton.setAttribute("data-edit-index", taskIndex);

  modalTitle.textContent = "Edit Task";
  taskModal.style.display = "block";
}

async function deleteTask(taskIndex) {
  const taskName = projectData.tasks[taskIndex].name;

  // Check for inbound dependencies
  const inboundDependencies = projectData.tasks.filter((task, idx) => {
    return task.dependencies && task.dependencies.includes(taskIndex);
  });

  if (inboundDependencies.length > 0) {
    const dependentTaskNames = inboundDependencies
      .map((task) => `\n- ${task.name || "Untitled Task"}`)
      .join("");
    alert(
      `Cannot delete "${taskName}" because the following tasks depend on it:${dependentTaskNames}`
    );
    return;
  }

  const confirmDelete = confirm(
    `Are you sure you want to delete the task "${taskName}"?`
  );
  if (!confirmDelete) return;

  projectData.tasks.splice(taskIndex, 1);

  // Update dependencies of other tasks
  projectData.tasks.forEach((task) => {
    if (task.dependencies) {
      task.dependencies = task.dependencies.map((depIndex) =>
        depIndex > taskIndex ? depIndex - 1 : depIndex
      );
    }
  });

  renderGanttChart(projectData);
  updateDependenciesOptions();

  await saveProjectData(projectData, true);
}

let choices;
let peopleChoices;

document.addEventListener("DOMContentLoaded", () => {
  // Assign DOM elements after the content has loaded
  filePathDisplay = document.getElementById("filePathDisplay");
  lastEditedDisplay = document.getElementById("lastEditedDisplay");

  // Initialize zoom controls visibility
  const zoomControls = document.querySelector('.zoom-controls');
  const zoomToggleButton = document.getElementById('zoomToggleButton');
  const hideZoomControlsButton = document.createElement('button');

  // Create a hide button inside the zoom controls
  hideZoomControlsButton.id = 'hideZoomControlsButton';
  hideZoomControlsButton.classList.add('hide-zoom-controls-button');
  hideZoomControlsButton.innerHTML = '<i class="fas fa-times"></i>';
  hideZoomControlsButton.setAttribute('aria-label', 'Hide zoom controls');
  zoomControls.appendChild(hideZoomControlsButton);

  // Function to show the zoom controls
  function showZoomControls() {
    document.body.classList.add('zoom-controls-visible');
    document.body.classList.remove('zoom-controls-hidden');
  }

  // Function to hide the zoom controls
  function hideZoomControls() {
    document.body.classList.add('zoom-controls-hidden');
    document.body.classList.remove('zoom-controls-visible');
  }

  // Event listener to show zoom controls when the magnifying glass is clicked
  zoomToggleButton.addEventListener('click', showZoomControls);

  // Event listener to hide zoom controls when the close button is clicked
  hideZoomControlsButton.addEventListener('click', hideZoomControls);

  // Set initial state: Hide the zoom controls
  hideZoomControls();

  // Get reference to the fullscreen toggle button
  const toggleFullscreenButton = document.getElementById('toggleFullscreen');
  const exitFullscreenButton = document.getElementById('exitFullscreenButton');

  toggleFullscreenButton.addEventListener('click', () => {
    // Toggle the 'fullscreen-mode' class on the body
    document.body.classList.toggle('fullscreen-mode');

    // Change the icon and text depending on the mode
    if (document.body.classList.contains('fullscreen-mode')) {
      toggleFullscreenButton.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
    } else {
      toggleFullscreenButton.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
    }
  });

  // Event listener for the exit fullscreen button
  exitFullscreenButton.addEventListener('click', () => {
    // Exit fullscreen mode by removing the class
    document.body.classList.remove('fullscreen-mode');
    // Update the toggle fullscreen button text and icon
    toggleFullscreenButton.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
  });

  choices = new Choices("#taskDependencies", {
    removeItemButton: true,
    shouldSort: false,
    searchResultLimit: 10,
    placeholderValue: "Select dependencies...",
    duplicateItemsAllowed: false,
  });

  peopleChoices = new Choices("#taskPeople", {
    removeItemButton: true,
    shouldSort: false,
    searchResultLimit: 10,
    placeholderValue: "Assign people...",
    duplicateItemsAllowed: false,
  });

  categoryFilterChoices = new Choices("#categoryFilter", {
    removeItemButton: true,
    shouldSort: false,
    placeholderValue: "Filter by category...",
    searchResultLimit: 10,
    duplicateItemsAllowed: false,
  });

  // Add event listener to re-render the chart when the category selection changes
  categoryFilterChoices.passedElement.element.addEventListener('change', () => {
    renderGanttChart(projectData);
  });

  const ganttChart = document.getElementById("ganttChart");

  // Mouse events
  ganttChart.addEventListener("mousedown", (e) => {
    if (isResizing || isShiftKeyDown) return; // Do not initiate panning if resizing or Shift is down
    if (e.target !== ganttChart) return; // Only initiate panning when clicking on empty space
    isPanning = true;
    startX = e.pageX - ganttChart.offsetLeft;
    startY = e.pageY - ganttChart.offsetTop;
    scrollLeft = ganttChart.scrollLeft;
    scrollTop = ganttChart.scrollTop;
    ganttChart.classList.add("grabbing");
  });

  ganttChart.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    e.preventDefault();
    const x = e.pageX - ganttChart.offsetLeft;
    const y = e.pageY - ganttChart.offsetTop;
    const walkX = x - startX;
    const walkY = y - startY;
    ganttChart.scrollLeft = scrollLeft - walkX;
    ganttChart.scrollTop = scrollTop - walkY;
  });

  ganttChart.addEventListener("mouseup", () => {
    isPanning = false;
    ganttChart.classList.remove("grabbing");
  });

  ganttChart.addEventListener("mouseleave", () => {
    isPanning = false;
    ganttChart.classList.remove("grabbing");
  });

  ganttChart.addEventListener('scroll', handleScroll);

  // Touch events for mobile devices
  ganttChart.addEventListener("touchstart", (e) => {
    if (isResizing || isShiftKeyDown) return; // Do not initiate panning if resizing or Shift is down
    if (e.target !== ganttChart) return;
    isPanning = true;
    startX = e.touches[0].pageX - ganttChart.offsetLeft;
    startY = e.touches[0].pageY - ganttChart.offsetTop;
    scrollLeft = ganttChart.scrollLeft;
    scrollTop = ganttChart.scrollTop;
    ganttChart.classList.add("grabbing");
  });

  ganttChart.addEventListener("touchmove", (e) => {
    if (!isPanning) return;
    const x = e.touches[0].pageX - ganttChart.offsetLeft;
    const y = e.touches[0].pageY - ganttChart.offsetTop;
    const walkX = x - startX;
    const walkY = y - startY;
    ganttChart.scrollLeft = scrollLeft - walkX;
    ganttChart.scrollTop = scrollTop - walkY;
  });

  ganttChart.addEventListener("touchend", () => {
    isPanning = false;
    ganttChart.classList.remove("grabbing");
  });

  // Add event listeners for resizing
  document.addEventListener("mousemove", (e) => {
    if (isResizing) {
      resizeTask(e);
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (isResizing) {
      stopResizing(e);
    }
  });

  // Get references to the zoom controls
  const horizontalZoomInput = document.getElementById("horizontalZoom");
  const verticalZoomInput = document.getElementById("verticalZoom");
  const horizontalZoomValue = document.getElementById("horizontalZoomValue");
  const verticalZoomValue = document.getElementById("verticalZoomValue");

  // Update the values on page load
  horizontalZoomValue.textContent = pixelsPerDay;
  verticalZoomValue.textContent = taskHeight;

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Event listener for horizontal zoom
  horizontalZoomInput.addEventListener(
    "input",
    debounce(() => {
      pixelsPerDay = parseInt(horizontalZoomInput.value, 10);
      horizontalZoomValue.textContent = pixelsPerDay;
      renderGanttChart(projectData);
    }, 100)
  );

  // Event listener for vertical zoom
  verticalZoomInput.addEventListener(
    "input",
    debounce(() => {
      taskHeight = parseInt(verticalZoomInput.value, 10);
      verticalZoomValue.textContent = taskHeight;
      taskSpacing = Math.round(taskHeight / 6);
      renderGanttChart(projectData);
    }, 100)
  );

  // Tab functionality for categories modal
  const tabButtons = categoriesModal.querySelectorAll(".tab-button");
  const tabContents = categoriesModal.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

      // Deactivate all tabs and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Activate selected tab and content
      button.classList.add("active");
      categoriesModal.querySelector(`#${targetTab}Tab`).classList.add("active");
    });
  });

  // Initialize Spectrum color picker
  $("#categoryColor").spectrum({
    preferredFormat: "hex",
    showInput: true,
    showPalette: true,
    palette: [
      ["#4CAF50", "#FF9800", "#2196F3", "#9C27B0", "#F44336", "#FFC107"],
      ["#E91E63", "#00BCD4", "#8BC34A", "#CDDC39", "#FFC107", "#FF5722"],
      ["#795548", "#9E9E9E", "#607D8B", "#000000", "#FFFFFF"],
    ],
  });

  // Attach event listener to the addCategoryForm
  document
    .getElementById("addCategoryForm")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const categoryNameInput = document.getElementById("categoryName");
      const categoryName = categoryNameInput.value.trim();

      if (!categoryName) {
        // Display an error message or highlight the input
        categoryNameInput.focus();
        return;
      }

      const categoryColor = document.getElementById("categoryColor").value;
      const editId = event.target.getAttribute("data-edit-id");

      if (editId) {
        // Update existing category
        const category = projectData.categories.find(
          (cat) => cat.id === parseInt(editId, 10)
        );
        if (category) {
          category.name = categoryName;
          category.color = categoryColor;
        }
        // Reset form
        event.target.removeAttribute("data-edit-id");
        document.querySelector(
          '#addCategoryForm button[type="submit"]'
        ).textContent = "Add Category";
      } else {
        // Add new category
        const category = {
          id: Date.now(),
          name: categoryName,
          color: categoryColor,
        };
        projectData.categories.push(category);
      }

      // Update UI and save data
      renderCategoriesList();
      updateCategoryOptions();
      updateCategoryFilterOptions(); // Refresh the category filter dropdown
      renderGanttChart(projectData);
      saveProjectData(projectData, true);

      // Reset the form
      event.target.reset();
    });

  // Attach event listener to the manage categories button
  manageCategoriesButton.addEventListener("click", () => {
    categoriesModal.style.display = "block";
    renderCategoriesList();
  });

  // Attach event listener to the close button of the categories modal
  closeCategoriesModalButton.addEventListener("click", () => {
    categoriesModal.style.display = "none";
    document.getElementById("addCategoryForm").reset();
  });

  // Now render the chart and update dependencies options
  renderGanttChart(projectData);
  updateDependenciesOptions();
  updateCategoryFilterOptions();
});

function updateDependenciesOptions(excludeIndex = null) {
  const choicesList = projectData.tasks
    .map((task, index) => {
      if (index !== excludeIndex) {
        return { value: index.toString(), label: task.name };
      }
      return null;
    })
    .filter((item) => item !== null);

  choices.clearChoices();
  choices.setChoices(choicesList, "value", "label", false);
}

async function saveProjectData(projectData, autosave = false) {
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = "Saving...";

  if ("showSaveFilePicker" in window) {
    if (!fileHandle) {
      if (autosave) {
        // Autosave to localStorage when fileHandle is not available
        localStorage.setItem("projectData", JSON.stringify(projectData));
        statusMessage.textContent = "Autosaved to local storage.";
        setTimeout(() => {
          statusMessage.textContent = "";
        }, 5000);
        return;
      } else {
        // Prompt the user to pick a file to save
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: "project.yaml",
            types: [
              {
                description: "YAML Files",
                accept: { "text/yaml": [".yaml", ".yml"] },
              },
            ],
          });
        } catch (err) {
          console.error("Save cancelled:", err);
          statusMessage.textContent = "Save cancelled.";
          return;
        }
      }
    }

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(jsyaml.dump(projectData));
        await writable.close();
        statusMessage.textContent = autosave
          ? "Autosaved."
          : "Project saved successfully.";
        statusMessage.style.color = "green";

        // Update status bar with current time
        const now = new Date();
        updateStatusBar(now);

        // Save last edited time to localStorage
        localStorage.setItem("lastEdited", now.toISOString());
      } catch (err) {
        console.error("Error during save:", err);
        statusMessage.textContent = "Error saving project.";
        statusMessage.style.color = "red";
      }
    }

    // Update localStorage with the latest project data
    localStorage.setItem("projectData", JSON.stringify(projectData));
    if (fileHandle && fileHandle.name) {
      localStorage.setItem("fileName", fileHandle.name);
    }
  } else {
    // Fallback for browsers that do not support the File System Access API
    const yamlData = jsyaml.dump(projectData);
    const blob = new Blob([yamlData], { type: "text/yaml" });
    if (!autosave) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "project.yaml";
      link.click();
      URL.revokeObjectURL(url);
      statusMessage.textContent =
        "Project saved successfully (fallback method).";
    } else {
      console.warn("Autosave skipped: unsupported in this browser.");
      statusMessage.textContent = "Autosave not supported in this browser.";
    }
  }

  setTimeout(() => {
    statusMessage.textContent = "";
    statusMessage.style.color = "";
  }, 5000);
}

const taskModal = document.getElementById("taskModal");
const openTaskModalButton = document.getElementById("openTaskModal");
const closeModalButton = taskModal.querySelector(".close-button");
const modalTitle = document.getElementById("modalTitle");

// Get references to the manage categories button and modal
const manageCategoriesButton = document.getElementById(
  "manageCategoriesButton"
);
const categoriesModal = document.getElementById("categoriesModal");
const closeCategoriesModalButton =
  categoriesModal.querySelector(".close-button");

// Get references to the manage people button and modal
const managePeopleButton = document.getElementById("managePeopleButton");
const peopleModal = document.getElementById("peopleModal");
const closePeopleModalButton = peopleModal.querySelector(".close-button");

// Get references to the milestone modal elements
const milestoneModal = document.getElementById("milestoneModal");
const openMilestoneModalButton = document.getElementById("openMilestoneModal");
const closeMilestoneModalButton = milestoneModal.querySelector(".close-button");
const milestoneModalTitle = document.getElementById("milestoneModalTitle");

// Open the categories modal when the button is clicked
manageCategoriesButton.addEventListener("click", () => {
  categoriesModal.style.display = "block";
  renderCategoriesList();
});

// Close the modal when the close button is clicked
closeCategoriesModalButton.addEventListener("click", () => {
  categoriesModal.style.display = "none";
  document.getElementById("addCategoryForm").reset();
});

// Close the modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === categoriesModal) {
    categoriesModal.style.display = "none";
    document.getElementById("addCategoryForm").reset();
  }
});

// Open the people modal when the button is clicked
managePeopleButton.addEventListener("click", () => {
  peopleModal.style.display = "block";
  renderPeopleList();
});

// Close the people modal when the close button is clicked
closePeopleModalButton.addEventListener("click", () => {
  peopleModal.style.display = "none";
  document.getElementById("addPersonForm").reset();
});

// Close the people modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === peopleModal) {
    peopleModal.style.display = "none";
    document.getElementById("addPersonForm").reset();
  }
});

// Open the milestone modal when the button is clicked
openMilestoneModalButton.addEventListener("click", () => {
  milestoneModalTitle.textContent = "Add Milestone";
  updateMilestoneCategoryOptions();
  // Set default emoji
  const defaultEmoji = "🚩";
  document.getElementById("milestoneEmoji").value = defaultEmoji;
  populateEmojiGrid(defaultEmoji);

  // Reset submit button text to 'Add Milestone'
  document.querySelector('#addMilestoneForm button[type="submit"]').textContent = 'Add Milestone';
  // Ensure data-edit-id attribute is removed
  document.getElementById('addMilestoneForm').removeAttribute('data-edit-id');

  milestoneModal.style.display = "block";
});

// Close the milestone modal when the close button is clicked
closeMilestoneModalButton.addEventListener("click", () => {
  milestoneModal.style.display = "none";
  document.getElementById("addMilestoneForm").reset();
  document.getElementById("milestoneFormErrorMessage").textContent = "";
});

// Close the milestone modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === milestoneModal) {
    milestoneModal.style.display = "none";
    document.getElementById("addMilestoneForm").reset();
    document.getElementById("milestoneFormErrorMessage").textContent = "";
  }
});

// Tab functionality for people modal
const peopleTabButtons = peopleModal.querySelectorAll(".tab-button");
const peopleTabContents = peopleModal.querySelectorAll(".tab-content");

peopleTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetTab = button.getAttribute("data-tab");

    // Deactivate all tabs and contents
    peopleTabButtons.forEach((btn) => btn.classList.remove("active"));
    peopleTabContents.forEach((content) => content.classList.remove("active"));

    // Activate selected tab and content
    button.classList.add("active");
    peopleModal.querySelector(`#${targetTab}Tab`).classList.add("active");
  });
});

// This event listener is now moved inside the DOMContentLoaded event

function renderCategoriesList() {
  const categoriesList = document.getElementById("categoriesList");
  categoriesList.innerHTML = "";

  projectData.categories.forEach((category) => {
    const categoryItem = document.createElement("li");
    categoryItem.classList.add("category-item");
    categoryItem.setAttribute("data-category-id", category.id);

    const colorIndicator = document.createElement("div");
    colorIndicator.classList.add("color-indicator");
    colorIndicator.style.backgroundColor = category.color;

    const categoryName = document.createElement("span");
    categoryName.textContent = category.name || "Unnamed Category";

    const editButton = document.createElement("button");
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.addEventListener("click", () => {
      editCategory(category.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.addEventListener("click", () => {
      deleteCategory(category.id);
    });

    categoryItem.appendChild(colorIndicator);
    categoryItem.appendChild(categoryName);
    categoryItem.appendChild(editButton);
    categoryItem.appendChild(deleteButton);

    categoriesList.appendChild(categoryItem);
  });

  // Destroy existing Sortable instance if it exists
  if (window.categorySortableInstance) {
    window.categorySortableInstance.destroy();
  }

  // Initialize a new Sortable instance
  window.categorySortableInstance = new Sortable(categoriesList, {
    animation: 150,
    onEnd: () => {
      // Get the new order of category IDs
      const newOrder = Array.from(
        document.querySelectorAll("#categoriesList .category-item")
      ).map((item) => parseInt(item.getAttribute("data-category-id"), 10));

      // Reorder projectData.categories based on the new order
      projectData.categories.sort((a, b) => {
        return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
      });

      // Save the updated projectData
      saveProjectData(projectData, true);

      // Re-render the Gantt chart to reflect the new category order
      renderGanttChart(projectData);
    },
  });
}

function editCategory(categoryId) {
  const category = projectData.categories.find((cat) => cat.id === categoryId);
  if (!category) return;

  // Switch to the "Add Category" tab
  categoriesModal.querySelector('.tab-button[data-tab="add"]').click();

  // Populate the form with existing category data
  document.getElementById("categoryName").value = category.name;
  $("#categoryColor").spectrum("set", category.color);

  // Store the category ID in the form for editing
  document
    .getElementById("addCategoryForm")
    .setAttribute("data-edit-id", categoryId);
  document.querySelector('#addCategoryForm button[type="submit"]').textContent =
    "Update Category";
}

function deleteCategory(categoryId) {
  const confirmDelete = confirm(
    "Are you sure you want to delete this category?"
  );
  if (!confirmDelete) return;

  // Remove category from projectData
  projectData.categories = projectData.categories.filter(
    (cat) => cat.id !== categoryId
  );

  // Remove categoryId from tasks that used this category
  projectData.tasks.forEach((task) => {
    if (task.categoryId === categoryId) {
      delete task.categoryId;
    }
  });

  renderCategoriesList();
  updateCategoryOptions();
  updateCategoryFilterOptions(); // Refresh the category filter dropdown
  renderGanttChart(projectData);
  saveProjectData(projectData, true);
}

function updateCategoryOptions() {
  const categorySelect = document.getElementById("taskCategory");
  categorySelect.innerHTML = "";

  // Add an option for 'Uncategorized'
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Uncategorized";
  categorySelect.appendChild(defaultOption);

  projectData.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });
  updateCategoryFilterOptions();
}

openTaskModalButton.addEventListener("click", () => {
  modalTitle.textContent = "Add Task";
  // Reset submit button text to 'Add Task'
  document.querySelector('#addTaskForm button[type="submit"]').textContent = 'Add Task';
  // Ensure data-edit-index attribute is removed
  document.querySelector('#addTaskForm button[type="submit"]').removeAttribute('data-edit-index');
  // Include all tasks as potential dependencies
  updateDependenciesOptions();
  updateCategoryOptions();
  taskModal.style.display = "block";
});

closeModalButton.addEventListener("click", () => {
  taskModal.style.display = "none";
  document.getElementById("addTaskForm").reset();
  document.getElementById("formErrorMessage").textContent = "";
  choices.removeActiveItems();
});

window.addEventListener("click", (event) => {
  if (event.target === taskModal) {
    taskModal.style.display = "none";
    document.getElementById("addTaskForm").reset();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  flatpickr("#taskStart", {
    dateFormat: "Y-m-d",
  });

  flatpickr("#milestoneDate", {
    dateFormat: "Y-m-d",
  });

  // Initial loading of project data from local storage
  const savedProjectData = localStorage.getItem("projectData");
  if (savedProjectData) {
    projectData = JSON.parse(savedProjectData);

    // Initialize `categories` if it's undefined
    if (!Array.isArray(projectData.categories)) {
      projectData.categories = [];
    }

    // Initialize `people` if it's undefined
    if (!Array.isArray(projectData.people)) {
      projectData.people = [];
    }
    if (!Array.isArray(projectData.milestones)) {
      projectData.milestones = [];
    }

    updateProjectNameDisplay();
    updateCategoryOptions();
    renderCategoriesList();
    updateCategoryFilterOptions();

    const savedFileName = localStorage.getItem("fileName") || "Last Project";

    // Inform user that autosave to file is not enabled
    const statusMessage = document.getElementById("statusMessage");
    statusMessage.innerHTML =
      'Autosave to file is not enabled. Please <a href="#" id="saveNowLink">save your project</a> to enable autosave to file.';
    statusMessage.style.color = "red";

    // Add event listener to the link
    document
      .getElementById("saveNowLink")
      .addEventListener("click", function (event) {
        event.preventDefault();
        document.getElementById("saveProject").click();
      });
  } else {
    // No saved project data; use default empty projectData
    projectData = {
      projectName: "Untitled Project",
      tasks: [],
      categories: [],
      people: [],
      milestones: [],
    };
    updateProjectNameDisplay();
    updateCategoryOptions();
    renderCategoriesList();
  }

  // Now render the chart and update dependencies
  renderGanttChart(projectData);
  updateDependenciesOptions();

  // Initialize status bar
  const savedLastEdited = localStorage.getItem("lastEdited");
  if (fileHandle && fileHandle.name) {
    const lastEdited = savedLastEdited ? new Date(savedLastEdited) : null;
    updateStatusBar(lastEdited);
  } else {
    updateStatusBar();
  }
});

// Ensure updateStatusBar is accessible outside DOMContentLoaded if needed
window.updateStatusBar = updateStatusBar;
function getStatusClass(status) {
  switch (status) {
    case "on-track":
      return "status-on-track";
    case "some risk":
      return "status-some-risk";
    case "high risk":
      return "status-high-risk";
    case "scrapped":
      return "status-scrapped";
    case "finished":
      return "status-finished";
    default:
      return "";
  }
}
function renderPeopleList() {
  const peopleList = document.getElementById("peopleList");
  peopleList.innerHTML = "";

  projectData.people.forEach((person) => {
    const personItem = document.createElement("div");
    personItem.classList.add("person-item");

    const personName = document.createElement("span");
    personName.textContent = person.name || "Unnamed Person";

    const editButton = document.createElement("button");
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.addEventListener("click", () => {
      editPerson(person.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.addEventListener("click", () => {
      deletePerson(person.id);
    });

    personItem.appendChild(personName);
    personItem.appendChild(editButton);
    personItem.appendChild(deleteButton);

    peopleList.appendChild(personItem);
  });
}

function editPerson(personId) {
  const person = projectData.people.find((p) => p.id === personId);
  if (!person) return;

  // Switch to the "Add Person" tab
  peopleModal.querySelector('.tab-button[data-tab="add-person"]').click();

  // Populate the form with existing person data
  document.getElementById("personName").value = person.name;

  // Store the person ID in the form for editing
  document
    .getElementById("addPersonForm")
    .setAttribute("data-edit-id", personId);
  document.querySelector('#addPersonForm button[type="submit"]').textContent =
    "Update Person";
}

function deletePerson(personId) {
  // Check if the person is assigned to any tasks
  const assignedTasks = projectData.tasks.filter((task) => {
    return (
      Array.isArray(task.assignedPeople) &&
      task.assignedPeople.includes(personId)
    );
  });

  if (assignedTasks.length > 0) {
    // List assigned tasks
    const taskNames = assignedTasks
      .map((task) => `\n- ${task.name || "Untitled Task"}`)
      .join("");
    const confirmDelete = confirm(
      `This person is assigned to the following tasks:${taskNames}\n\n` +
        "Are you sure you want to delete this person? Their assignments will be removed from these tasks."
    );
    if (!confirmDelete) return;
  } else {
    const confirmDelete = confirm(
      "Are you sure you want to delete this person?"
    );
    if (!confirmDelete) return;
  }

  // Remove person from projectData
  projectData.people = projectData.people.filter((p) => p.id !== personId);

  // Remove personId from tasks that have this person assigned
  projectData.tasks.forEach((task) => {
    if (Array.isArray(task.assignedPeople)) {
      task.assignedPeople = task.assignedPeople.filter((id) => id !== personId);
    }
  });

  // Update the Gantt chart to reflect the removal
  renderGanttChart(projectData);

  renderPeopleList();
  updatePeopleOptions();
  saveProjectData(projectData, true);
}

function updatePeopleOptions() {
  const peopleChoicesList = projectData.people.map((person) => ({
    value: person.id.toString(),
    label: person.name,
  }));

  peopleChoices.clearChoices();
  peopleChoices.setChoices(peopleChoicesList, "value", "label", false);
}

document
  .getElementById("addPersonForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const personNameInput = document.getElementById("personName");
    const personName = personNameInput.value.trim();

    if (!personName) {
      personNameInput.focus();
      return;
    }

    const editId = event.target.getAttribute("data-edit-id");

    if (editId) {
      // Update existing person
      const person = projectData.people.find(
        (p) => p.id === parseInt(editId, 10)
      );
      if (person) {
        person.name = personName;
      }
      // Reset form
      event.target.removeAttribute("data-edit-id");
      document.querySelector(
        '#addPersonForm button[type="submit"]'
      ).textContent = "Add Person";
    } else {
      // Add new person
      const person = {
        id: Date.now(),
        name: personName,
      };
      projectData.people.push(person);
    }

    // Update UI and save data
    renderPeopleList();
    updatePeopleOptions();
    saveProjectData(projectData, true);

    // Reset the form
    event.target.reset();
  });
document
  .getElementById("addMilestoneForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const formErrorMessage = document.getElementById(
      "milestoneFormErrorMessage"
    );

    const milestoneName = document.getElementById("milestoneName").value.trim();
    const milestoneDate = document.getElementById("milestoneDate").value;
    const milestoneCategoryId =
      parseInt(document.getElementById("milestoneCategory").value, 10) || null;
    const milestoneDescription = document
      .getElementById("milestoneDescription")
      .value.trim();
    const milestoneEmoji =
      document.getElementById("milestoneEmoji").value.trim() || "🚩"; // Use default if not provided

    // Basic validation
    if (!milestoneName || !milestoneDate) {
      formErrorMessage.textContent = "Please fill in all required fields.";
      return;
    }

    // Clear error message
    formErrorMessage.textContent = "";

    const editId = event.target.getAttribute("data-edit-id");

    if (editId) {
      // Update existing milestone
      const milestone = projectData.milestones.find(
        (m) => m.id === parseInt(editId, 10)
      );
      if (milestone) {
        milestone.name = milestoneName;
        milestone.date = milestoneDate;
        milestone.categoryId = milestoneCategoryId;
        milestone.description = milestoneDescription;
        milestone.emoji = milestoneEmoji;
      }
      // Reset form state
      event.target.removeAttribute("data-edit-id");
      milestoneModalTitle.textContent = "Add Milestone";
      // Reset submit button text to 'Add Milestone'
      document.querySelector('#addMilestoneForm button[type="submit"]').textContent = 'Add Milestone';
    } else {
      // Add new milestone
      const milestone = {
        id: Date.now(),
        name: milestoneName,
        date: milestoneDate,
        categoryId: milestoneCategoryId,
        description: milestoneDescription,
        emoji: milestoneEmoji,
      };
      projectData.milestones.push(milestone);
    }

    // Update the chart
    renderGanttChart(projectData);
    await saveProjectData(projectData, true);

    // Reset form and close modal
    event.target.reset();
    milestoneModal.style.display = "none";
  });

function showMilestoneDetails(milestoneId) {
  currentMilestoneId = milestoneId; // Store the current milestone ID
  const milestone = projectData.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return;

  document.getElementById("detailMilestoneName").textContent =
    milestone.name || "Unnamed Milestone";

  // Handle missing description
  const rawDescription = marked.parse(
    milestone.description || "No description."
  );
  const sanitizedDescription = DOMPurify.sanitize(rawDescription);
  document.getElementById("detailMilestoneDescription").innerHTML =
    sanitizedDescription;

  document.getElementById("detailMilestoneDate").textContent =
    milestone.date || "Unknown Date";

  // Get category name
  let categoryName = "Uncategorized";
  if (milestone.categoryId !== null) {
    const category = projectData.categories.find(
      (cat) => cat.id === milestone.categoryId
    );
    if (category) {
      categoryName = category.name;
    }
  }
  document.getElementById("detailMilestoneCategory").textContent = categoryName;

  // Display the emoji
  document.getElementById("detailMilestoneEmoji").textContent =
    milestone.emoji || "";

  // Show the modal
  const milestoneDetailsModal = document.getElementById(
    "milestoneDetailsModal"
  );
  milestoneDetailsModal.style.display = "block";
}

// Add event listener to close the milestone details modal
const milestoneDetailsModal = document.getElementById("milestoneDetailsModal");
const closeMilestoneDetailsModalButton =
  milestoneDetailsModal.querySelector(".close-button");
closeMilestoneDetailsModalButton.addEventListener("click", () => {
  milestoneDetailsModal.style.display = "none";
});

// Get references to the settings modal elements
const settingsModal = document.getElementById("settingsModal");
const openSettingsModalButton = document.getElementById("openSettingsModal");
const closeSettingsModalButton = settingsModal.querySelector(".close-button");

// Open the settings modal when the button is clicked
openSettingsModalButton.addEventListener("click", () => {
  // Set the current value in the select input
  document.getElementById("timeScaleUnit").value = timeScaleUnit;
  settingsModal.style.display = "block";
});

// Close the settings modal when the close button is clicked
closeSettingsModalButton.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

// Close the settings modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.style.display = "none";
  }
});

document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedUnit = document.getElementById("timeScaleUnit").value;
  timeScaleUnit = selectedUnit;
  // Close the modal
  settingsModal.style.display = "none";
  // Re-render the chart with the new time scale unit
  renderGanttChart(projectData);
});

// Close the modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === milestoneDetailsModal) {
    milestoneDetailsModal.style.display = "none";
  }
});

// Get references to the edit and delete buttons
const editMilestoneButton = document.getElementById("editMilestoneButton");
const deleteMilestoneButton = document.getElementById("deleteMilestoneButton");

// Event listener for the Edit button
editMilestoneButton.addEventListener("click", () => {
  if (currentMilestoneId !== null) {
    editMilestone(currentMilestoneId);
    milestoneDetailsModal.style.display = "none";
  }
});

// Event listener for the Delete button
deleteMilestoneButton.addEventListener("click", async () => {
  if (currentMilestoneId !== null) {
    await deleteMilestone(currentMilestoneId);
    milestoneDetailsModal.style.display = "none";
  }
});

function editMilestone(milestoneId) {
  const milestone = projectData.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return;

  // Switch modal title to 'Edit Milestone'
  milestoneModalTitle.textContent = "Edit Milestone";

  // Populate the form with existing milestone data
  document.getElementById("milestoneName").value = milestone.name;
  document.getElementById("milestoneDate").value = milestone.date;
  document.getElementById("milestoneDescription").value =
    milestone.description || "";

  // Set the selected category
  document.getElementById("milestoneCategory").value =
    milestone.categoryId || "";

  // Set a data attribute to indicate edit mode
  document
    .getElementById("addMilestoneForm")
    .setAttribute("data-edit-id", milestoneId);

  // Set the selected emoji
  const selectedEmoji = milestone.emoji || "🚩"; // Use default if not set
  document.getElementById("milestoneEmoji").value = selectedEmoji;
  populateEmojiGrid(selectedEmoji);

  // Update submit button text to 'Update Milestone'
  document.querySelector('#addMilestoneForm button[type="submit"]').textContent = 'Update Milestone';

  // Open the milestone modal
  milestoneModal.style.display = "block";
}

async function deleteMilestone(milestoneId) {
  const confirmDelete = confirm(
    "Are you sure you want to delete this milestone?"
  );
  if (!confirmDelete) return;

  // Remove milestone from projectData
  projectData.milestones = projectData.milestones.filter(
    (m) => m.id !== milestoneId
  );

  // Update the Gantt chart
  renderGanttChart(projectData);

  await saveProjectData(projectData, true);
}

function updateMilestoneCategoryOptions() {
  const categorySelect = document.getElementById("milestoneCategory");
  categorySelect.innerHTML = "";

  // Add an option for no category
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Uncategorized";
  categorySelect.appendChild(defaultOption);

  projectData.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });
}
