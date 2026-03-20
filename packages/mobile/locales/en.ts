export default {
  // Common
  common: {
    cancel: "Cancel",
    ok: "OK",
    back: "Back",
    error: "Error",
    loading: "Loading...",
    studyId: "Study ID",
    appTitle: "Shunt Diary",
    justNow: "Just now",
    minAgo: "{{count}} min ago",
    today: "Today",
    yesterday: "Yesterday",
    dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },

  // Login Screen
  login: {
    title: "Shunt Wizard",
    description: "Please enter your Study ID to log in.",
    placeholder: "Study ID",
    button: "Log In",
    buttonLoading: "Logging in...",
    errorEmpty: "Please enter a Study ID",
    errorInvalid: "Invalid Study ID. Please try again.",
    errorFailed: "Login failed. Please try again later.",
  },

  // Passphrase Screen
  passphrase: {
    title: "Password Required",
    description: "Please enter the password to unlock the app.",
    placeholder: "Password",
    button: "Unlock",
    buttonLoading: "Verifying...",
    errorEmpty: "Please enter your password",
    errorInvalid: "Wrong password or decryption error. Please try again.",
  },

  // Record Screen
  record: {
    logout: "Log Out",
    logoutTitle: "Log Out",
    logoutMessage: "Are you sure you want to log out?",
    studyIdLabel: "Study ID:",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    duration: "Duration: {{duration}} seconds",
    startingIn: "Recording starting in:",
    inProgress: "Recording in progress",
    complete: "Done! The recording is now being saved",
    completeMessage: "This may take up to 30 seconds. You can move your phone now",
    cancelTitle: "Recording will be cancelled",
    cancelMessage: "Please note that we cannot process a recording shorter than 30 seconds. The recording will be cancelled and discarded. You can always start a new one.",
    cancelledToast: "Recording cancelled",
    micPermissionTitle: "Microphone Access Required",
    micPermissionMessage: "ShuntMerlin needs microphone access to record audio. Please enable it in your device settings.",
    micPermissionOpenSettings: "Open Settings",
  },

  // Submit Screen
  submit: {
    title: "Recording Details",
    discardTitle: "Discard Recording?",
    discardMessage: "Are you sure you want to go back and discard this recording?",
    discardButton: "Discard",
    uploadButton: "Upload",
    uploadNextButton: "Upload & Record Next",
    backDiscardButton: "Back & Discard",
    errorNoStudyId: "Please enter a Study ID",
    errorNoPath: "Recording path not found.",
    queuedTitle: "Added to Queue",
    queuedMessage: "The recording will be uploaded in the background.",
    queueErrorMessage: "Recording could not be added to the queue.",
  },

  // Recording Form
  form: {
    studyIdLabel: "Study ID:",
    studyIdPlaceholder: "Enter Study ID",
    positionLabel: "Recording Position:",
    notesLabel: "Notes:",
    notesPlaceholder: "Enter notes (optional)",
  },

  // Recording Positions
  positions: {
    anastomose: "Anastomosis",
    anastomose_3cm: "Anastomosis + 3cm",
    anastomose_8cm: 'Anastomosis + 8cm ("Middle")',
    proximal: "Proximal",
    engstelle: "Stenosis",
  },

  // Queue Indicator
  queue: {
    uploading: "{{count}} recording being uploaded",
    uploadingPlural: "{{count}} recordings being uploaded",
  },

  // Guideline Screen
  guideline: {
    skip: "Skip",
    next: "Next",
    getStarted: "Get Started",
    close: "Close",
    slide1Title: "How to get a high-quality recording",
    slide1Text: "Make sure you are in a quiet place. Don't move, speak, or close the app while recording",
    slide2Title: "Remove the phone cover and find your microphone",
    slide2Text: "The microphone is most likely located at the bottom edge of your phone, next to the charging port",
    slide3Title: "Press the \"New Recording\" button",
    slide3Text: "The recording will start after 5 seconds, giving you enough time to position the phone",
    slide4Title: "Position your phone as shown",
    slide4Text: "Align the phone along the puncture line. The microphone should rest about 2 cm above the start of your shunt on the skin. Do not press on your arm.",
    slide5Title: "Hold the phone still for 30 seconds",
    slide5Text: "Once the recording is done, your phone will vibrate. You can then move it while the recording is being saved",
    viewFullInstructions: "View full instructions",
  },

  // Recordings List
  recordings: {
    thisWeek: "THIS WEEK",
    lastWeek: "LAST WEEK",
    older: "OLDER",
    newButton: "New recording",
    emptyState: "Once you've performed some shunt recordings, you will see an overview here.",
    errorLoading: "Couldn't load recordings",
    retry: "Retry",
  },

  // Low Signal Overlay
  lowSignal: {
    title: "Shunt noise too weak",
    subtitle: "We couldn't clearly detect the sound from your shunt. Please check the following before recording again:",
    check1: "Remove any phone case and clothing between your arm and the microphone",
    check2: "Place your phone's microphone without pressure on the skin, about 2cm above the start of your shunt",
    needHelp: "Need help?",
    newRecording: "New Recording",
    helpTitle: "Need help?",
    helpBody: "If you continue to experience low signal, please contact the study team:",
    helpClose: "Close",
  },

  // Header
  header: {
    offlineTitle: "You are offline",
    offlineMessage: "Your data will be synced as soon as you're online",
  },

  // Recording Overview Screen
  recordingOverview: {
    title: "Shunt recording",
    thankYou: "Thank you for your recording and participating in our study!",
    aiAnalysis: "AI Analysis",
    question: "How is my shunt doing?",
    modelDescription: "We ran your recording through our AI model.",
    whatDoesThisMean: "What does this mean?",
    noAbnormalities: {
      title: "No abnormalities detected",
      description: "Your shunt sounds are within normal range.",
      explanation: "Our AI model analyzed your recording and did not detect any unusual patterns. The flow sounds are consistent with a well-functioning shunt. Continue monitoring regularly.",
    },
    unclear: {
      title: "Unclear result",
      description: "The analysis could not determine a clear result.",
      explanation: "The recording quality or shunt sounds were not clear enough for a definitive assessment. This does not necessarily indicate a problem. Try recording again in a quiet environment, or consult your doctor if you have concerns.",
    },
    abnormalities: {
      title: "Indication of abnormalities",
      description: "Unusual patterns were detected in the recording.",
      explanation: "Our AI model detected patterns that may indicate changes in your shunt flow. This is not a diagnosis — please consult your doctor for a professional evaluation. Bring this recording to your next appointment.",
    },
  },

  // Settings Screen
  settings: {
    title: "Settings",
    studyIdLabel: "Study ID",
    languageLabel: "Language",
    version: "Version",
    deleteAccountTitle: "Delete Account",
    deleteAccountMessage: "Are you sure you want to delete your account? This action cannot be undone.",
    accountSection: "Account",
    passwordLabel: "Password",
    legalSection: "Legal",
    consentsLabel: "Consents",
    legalDisclosureLabel: "Legal Disclosure",
  },

  // Error boundary
  errorBoundary: {
    title: "Something went wrong",
    message: "The app encountered an unexpected error. Your recordings are safe.",
    tryAgain: "Try again",
  },
};
