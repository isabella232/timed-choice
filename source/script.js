/* global fieldProperties, setAnswer, goToNextField, getPluginParameter, getMetaData, setMetaData */

const choices = fieldProperties.CHOICES
const appearance = fieldProperties.APPEARANCE
const fieldType = fieldProperties.FIELDTYPE
const numChoices = choices.length

const radioButtonsContainer = document.getElementById('radio-buttons-container') // default radio buttons
const selectDropDownContainer = document.getElementById('select-dropdown-container') // minimal appearance
const likertContainer = document.getElementById('likert-container') // likert
const choiceContainers = document.querySelectorAll('.choice-container') // go through all the available choices
const timerDisp = document.querySelector('#timerdisp')
const unitDisp = document.querySelector('#unitdisp')

var dispTimer = getPluginParameter('disp')
if (dispTimer == 0) {
  dispTimer = false
  document.querySelector('#timerContainer').style.display = 'none'
} else {
  dispTimer = true
}

var timeStart = getPluginParameter('duration')
if ((timeStart == null) || isNaN(timeStart)) {
  timeStart = 10000
} else {
  timeStart *= 1000
}

var unit = getPluginParameter('unit')
if (unit == null) {
  unit = 's'
}
unitDisp.innerHTML = unit

var missed = getPluginParameter('pass')
if (missed == null) {
  missed = -99
}

var resume = getPluginParameter('continue')
if (resume == 0) {
  resume = false
} else {
  resume = true
}

var leftoverTime = parseInt(getMetaData())

var startTime // This will get an actual value when the timer starts in startStopTimer()
var round = 1000 // Default, may be changed
var timeLeft // Starts this way for the display.
var timePassed = 0 // Time passed so far
var error = false
var complete = false
var currentAnswer

var allBoxes = document.querySelectorAll('input')

// ADJUST APPEARANCES

if (fieldType === 'select_multiple') { // Changes input type
  for (let c = 0; c < numChoices; c++) {
    const choice = choices[c]
    const box = allBoxes[c]
    box.type = 'checkbox'
    if (choice.CHOICE_SELECTED) {
      box.checked = true // Selects choices that have already been selected
    }
  }
  gatherAnswer()
}

// Prepare the current webview, making adjustments for any appearance options
if ((appearance.includes('minimal') === true) && (fieldType === 'select_one')) { // minimal appearance
  radioButtonsContainer.parentElement.removeChild(radioButtonsContainer) // remove the default radio buttons
  likertContainer.parentElement.removeChild(likertContainer) // remove the likert container
  selectDropDownContainer.style.display = 'block' // show the select dropdown
} else if ((appearance.includes('likert') === true) && (fieldType === 'select_one')) { // likert appearance
  radioButtonsContainer.parentElement.removeChild(radioButtonsContainer) // remove the default radio buttons
  selectDropDownContainer.parentElement.removeChild(selectDropDownContainer) // remove the select dropdown contrainer
  likertContainer.style.display = 'flex' // show the likert container
  // likert-min appearance
  if (appearance.includes('likert-min') === true) {
    var likertChoices = document.getElementsByClassName('likert-choice-container')
    for (var i = 1; i < likertChoices.length - 1; i++) {
      likertChoices[i].querySelector('.likert-choice-label').style.display = 'none' // hide all choice labels except the first and last
    }
    likertChoices[0].querySelector('.likert-choice-label').classList.add('likert-min-choice-label-first') // apply a special class to the first choice label
    likertChoices[likertChoices.length - 1].querySelector('.likert-choice-label').classList.add('likert-min-choice-label-last') // apply a special class to the last choice label
  }
} else { // all other appearances
  if (fieldProperties.LANGUAGE !== null && isRTL(fieldProperties.LANGUAGE)) {
    radioButtonsContainer.dir = 'rtl'
  }

  selectDropDownContainer.parentElement.removeChild(selectDropDownContainer) // remove the select dropdown container
  likertContainer.parentElement.removeChild(likertContainer) // remove the likert container
  // quick appearance
  if ((appearance.includes('quick') === true) && (fieldType === 'select_one')) {
    for (var i = 0; i < choiceContainers.length; i++) {
      choiceContainers[i].classList.add('appearance-quick') // add the 'appearance-quick' class
      choiceContainers[i].getElementsByClassName('choice-label-text')[0].insertAdjacentHTML('beforeend', '<svg class="quick-appearance-icon"><use xlink:href="#quick-appearance-icon" /></svg>') // insert the 'quick' icon
    }
  }
}

// minimal appearance
if ((appearance.includes('minimal') === true) && (fieldType === 'select_one')) {
  selectDropDownContainer.onchange = change // when the select dropdown is changed, call the change() function (which will update the current value)
} else if ((appearance.includes('likert') === true) && (fieldType === 'select_one')) { // likert appearance
  var likertButtons = document.querySelectorAll('div[name="opt"]')
  for (var i = 0; i < likertButtons.length; i++) {
    likertButtons[i].onclick = function () {
      // clear previously selected option (if any)
      var selectedOption = document.querySelector('.likert-input-button.selected')
      if (selectedOption) {
        selectedOption.classList.remove('selected')
      }
      this.classList.add('selected') // mark clicked option as selected
      change.apply({ value: this.getAttribute('data-value') }) // call the change() function and tell it which value was selected
    }
  }
} else { // all other appearances
  var buttons = document.querySelectorAll('input[name="opt"]')
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].onchange = function () {
      // remove 'selected' class from a previously selected option (if any)
      var selectedOption = document.querySelector('.choice-container.selected')
      if ((selectedOption) && (fieldType === 'select_one')) {
        selectedOption.classList.remove('selected')
      }
      this.parentElement.classList.add('selected') // add 'selected' class to the new selected option
      change.apply(this) // call the change() function and tell it which value was selected
    }
  }
}

// Timing calculations
if (unit === 'ms') {
  unit = 'milliseconds'
  round = 1
} else if (unit === 'cs') {
  unit = 'centiseconds'
  round = 10
} else if (unit === 'ds') {
  unit = 'deciseconds'
  round = 100
} else {
  unit = 'seconds'
  round = 1000
}

establishTimeLeft()

if (!error) {
  setInterval(timer, 1)
}

// FUNCTIONS
function clearAnswer () {
  // minimal appearance
  if (appearance.includes('minimal') === true) {
    selectDropDownContainer.value = ''
  } else if (appearance.includes('likert') === true) { // likert appearance
    var selectedOption = document.querySelector('.likert-input-button.selected')
    if (selectedOption) {
      selectedOption.classList.remove('selected')
    }
  } else { // all other appearances
    var selectedOption = document.querySelector('input[name="opt"]:checked')
    if (selectedOption) {
      selectedOption.checked = false
      selectedOption.parentElement.classList.remove('selected')
    }
  }
}

// Save the user's response (update the current answer)
function change () {
  if (fieldType === 'select_one') {
    setAnswer(this.value)
    // If the appearance is 'quick', then also progress to the next field
    if (appearance.includes('quick') === true) {
      goToNextField()
    }
  } else {
    gatherAnswer()
  }
}

function gatherAnswer () {
  const selected = []
  for (let c = 0; c < numChoices; c++) {
    if (allBoxes[c].checked === true) {
      selected.push(choices[c].CHOICE_VALUE)
    }
  }
  currentAnswer = selected.join(' ')
  setAnswer(currentAnswer)
}

// If the field label or hint contain any HTML that isn't in the form definition, then the < and > characters will have been replaced by their HTML character entities, and the HTML won't render. We need to turn those HTML entities back to actual < and > characters so that the HTML renders properly. This will allow you to render HTML from field references in your field label or hint.
function unEntity (str) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
if (fieldProperties.LABEL) {
  document.querySelector('#label').innerHTML = unEntity(fieldProperties.LABEL)
}
if (fieldProperties.HINT) {
  document.querySelector('.hint').innerHTML = unEntity(fieldProperties.HINT)
}

// Detect right-to-left languages
function isRTL (s) {
  var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' + '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF'
  var rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC'
  var rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']')

  return rtlDirCheck.test(s)
}

// TIME FUNCTIONS

function timer () {
  if (!complete) {
    timePassed = Date.now() - startTime
    timeLeft = timeStart - timePassed
  }

  if (timeLeft < 0) { // Timer ended
    blockInput()
    complete = true
    timeLeft = 0
    timerDisp.innerHTML = String(Math.ceil(timeLeft / round))

    if ((currentAnswer == null) || (currentAnswer === '') || (Array.isArray(currentAnswer) && (currentAnswer.length === 0))) {
      setAnswer(missed)
    }
    setMetaData(0)
    goToNextField()
  }
  setMetaData(timeLeft)

  timerDisp.innerHTML = String(Math.ceil(timeLeft / round))
}

function establishTimeLeft () { // This checks the current answer and leftover time, and either auto-advances if there is no time left, or establishes how much time is left.
  if ((currentAnswer !== '') && (!resume)) {
    complete = true
    timeLeft = 0
    blockInput()
  } else {
    if ((leftoverTime == null) || (leftoverTime === '') || isNaN(leftoverTime)) {
      checkComplete(currentAnswer)
      startTime = Date.now()
      timeLeft = timeStart
    } else if (isNaN(leftoverTime)) {
      checkComplete(currentAnswer)
      startTime = Date.now()
      timeLeft = timeStart
    } else {
      complete = false
      timeLeft = parseInt(leftoverTime)
      startTime = Date.now() - (timeStart - timeLeft)
    }
  } // End ELSE
} // End establishTimeLeft

function checkComplete (cur) {
  if (cur.length !== 0) {
    complete = true
    goToNextField()
  } else {
    complete = false
  }
}

function blockInput () {
  for (const b of allBoxes) {
    b.disabled = true
  }
}
