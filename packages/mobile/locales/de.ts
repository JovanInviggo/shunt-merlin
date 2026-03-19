export default {
  // Common
  common: {
    cancel: "Abbrechen",
    ok: "OK",
    back: "Zurück",
    error: "Fehler",
    loading: "Wird geladen...",
    studyId: "Studien-ID",
    appTitle: "Shunt-Tagebuch",
    justNow: "Gerade eben",
  },

  // Login Screen
  login: {
    title: "Shunt Wizard Recorder",
    description: "Bitte geben Sie Ihre Study-ID ein, um sich anzumelden.",
    placeholder: "Study-ID",
    button: "Anmelden",
    buttonLoading: "Anmeldung...",
    errorEmpty: "Bitte geben Sie eine Study-ID ein",
    errorInvalid: "Ungültige Study-ID. Bitte versuchen Sie es erneut.",
    errorFailed: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.",
  },

  // Passphrase Screen
  passphrase: {
    title: "Passwort erforderlich",
    description: "Bitte gebe das Passwort ein um die App freizuschalten.",
    placeholder: "Passwort",
    button: "Entsperren",
    buttonLoading: "Wird überprüft...",
    errorEmpty: "Bitte geben Sie Ihr Passwort ein",
    errorInvalid: "Falsches Passwort oder Fehler bei der Entschlüsselung. Bitte versuchen Sie es erneut.",
  },

  // Record Screen
  record: {
    logout: "Abmelden",
    logoutTitle: "Abmelden",
    logoutMessage: "Möchten Sie sich wirklich abmelden?",
    studyIdLabel: "Study-ID:",
    startRecording: "Aufnahme starten",
    stopRecording: "Aufnahme stoppen",
    duration: "Aufnahmedauer: {{duration}} Sekunden",
    startingIn: "Aufnahme beginnt in:",
    inProgress: "Aufnahme läuft",
    complete: "Fertig! Die Aufnahme wird jetzt gespeichert",
    completeMessage: "Das kann bis zu 30 Sekunden dauern. Sie können Ihr Handy jetzt bewegen",
    cancelTitle: "Aufnahme wird abgebrochen",
    cancelMessage: "Bitte beachten Sie, dass wir eine Aufnahme unter 30 Sekunden nicht verarbeiten können. Die Aufnahme wird abgebrochen und gelöscht. Sie können jederzeit eine neue starten.",
    micPermissionTitle: "Mikrofonzugriff erforderlich",
    micPermissionMessage: "ShuntMerlin benötigt Zugriff auf Ihr Mikrofon, um Audio aufzunehmen. Bitte aktivieren Sie dies in den Geräteeinstellungen.",
    micPermissionOpenSettings: "Einstellungen öffnen",
  },

  // Submit Screen
  submit: {
    title: "Aufnahmedetails",
    discardTitle: "Aufnahme verwerfen?",
    discardMessage: "Sind Sie sicher, dass Sie zurückgehen und diese Aufnahme verwerfen möchten?",
    discardButton: "Verwerfen",
    uploadButton: "Hochladen",
    uploadNextButton: "Hochladen & weitere Aufnahme",
    backDiscardButton: "Zurück & Verwerfen",
    errorNoStudyId: "Bitte geben Sie eine Studien-ID ein",
    errorNoPath: "Aufnahmepfad nicht gefunden.",
    queuedTitle: "Zur Warteschlange hinzugefügt",
    queuedMessage: "Die Aufnahme wird im Hintergrund hochgeladen.",
    queueErrorMessage: "Aufnahme konnte nicht zur Warteschlange hinzugefügt werden.",
  },

  // Recording Form
  form: {
    studyIdLabel: "Studien-ID:",
    studyIdPlaceholder: "Studien-ID eingeben",
    positionLabel: "Aufnahmeposition:",
    notesLabel: "Notizen:",
    notesPlaceholder: "Notizen eingeben (optional)",
  },

  // Recording Positions
  positions: {
    anastomose: "Anastomose",
    anastomose_3cm: "Anastomose + 3cm",
    anastomose_8cm: 'Anastomose + 8cm ("Mitte")',
    proximal: "Proximal",
    engstelle: "Engstelle",
  },

  // Queue Indicator
  queue: {
    uploading: "{{count}} Aufnahme wird hochgeladen",
    uploadingPlural: "{{count}} Aufnahmen werden hochgeladen",
  },

  // Guideline Screen
  guideline: {
    skip: "Überspringen",
    next: "Weiter",
    getStarted: "Loslegen",
    slide1Title: "So erhalten Sie eine hochwertige Aufnahme",
    slide1Text: "Stellen Sie sicher, dass Sie sich an einem ruhigen Ort befinden. Bewegen Sie sich nicht, sprechen Sie nicht und schließen Sie die App während der Aufnahme nicht",
    slide2Title: "Entfernen Sie die Handyhülle und finden Sie Ihr Mikrofon",
    slide2Text: "Das Mikrofon befindet sich höchstwahrscheinlich an der Unterkante Ihres Handys, neben dem Ladeanschluss",
    slide3Title: "Drücken Sie die Taste \"Neue Aufnahme\"",
    slide3Text: "Die Aufnahme beginnt nach 5 Sekunden, sodass Sie genug Zeit haben, das Handy zu positionieren",
    slide4Title: "Positionieren Sie Ihr Handy wie gezeigt",
    slide4Text: "Richten Sie das Handy entlang der Punktionslinie aus. Das Mikrofon sollte etwa 2 cm über dem Anfang Ihres Shunts auf der Haut ruhen. Drücken Sie nicht auf Ihren Arm.",
    slide5Title: "Halten Sie das Handy 30 Sekunden lang still",
    slide5Text: "Sobald die Aufnahme beendet ist, vibriert Ihr Handy. Sie können es dann bewegen, während die Aufnahme gespeichert wird",
    viewFullInstructions: "Vollständige Anleitung anzeigen",
  },

  // Recordings List
  recordings: {
    thisWeek: "DIESE WOCHE",
    lastWeek: "LETZTE WOCHE",
    older: "ÄLTER",
    newButton: "Neue Aufnahme",
    emptyState: "Sobald Sie einige Shunt-Aufnahmen gemacht haben, sehen Sie hier eine Übersicht.",
    errorLoading: "Aufnahmen konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },

  // Low Signal Overlay
  lowSignal: {
    title: "Shunt-Geräusch zu schwach",
    subtitle: "Wir konnten das Geräusch Ihres Shunts nicht klar erkennen. Bitte überprüfen Sie Folgendes, bevor Sie erneut aufnehmen:",
    check1: "Entfernen Sie jede Handyhülle und Kleidung zwischen Ihrem Arm und dem Mikrofon",
    check2: "Legen Sie das Mikrofon Ihres Handys ohne Druck auf die Haut, etwa 2 cm über dem Anfang Ihres Shunts",
    needHelp: "Brauchen Sie Hilfe?",
    newRecording: "Neue Aufnahme",
    helpTitle: "Brauchen Sie Hilfe?",
    helpBody: "Wenn Sie weiterhin ein schwaches Signal haben, wenden Sie sich bitte an das Studienteam:",
    helpClose: "Schließen",
  },

  // Header
  header: {
    offlineTitle: "Sie sind offline",
    offlineMessage: "Ihre Daten werden synchronisiert, sobald Sie wieder online sind",
  },

  // Recording Overview Screen
  recordingOverview: {
    title: "Shunt-Aufnahme",
    thankYou: "Vielen Dank für Ihre Aufnahme und Ihre Teilnahme an unserer Studie!",
    aiAnalysis: "KI-Analyse",
    question: "Wie geht es meinem Shunt?",
    modelDescription: "Wir haben Ihre Aufnahme durch unser KI-Modell laufen lassen.",
    whatDoesThisMean: "Was bedeutet das?",
    noAbnormalities: {
      title: "Keine Auffälligkeiten erkannt",
      description: "Ihre Shunt-Geräusche liegen im Normalbereich.",
      explanation: "Unser KI-Modell hat Ihre Aufnahme analysiert und keine ungewöhnlichen Muster erkannt. Die Durchflussgeräusche stimmen mit einem gut funktionierenden Shunt überein. Fahren Sie mit der regelmäßigen Überwachung fort.",
    },
    unclear: {
      title: "Unklares Ergebnis",
      description: "Die Analyse konnte kein eindeutiges Ergebnis ermitteln.",
      explanation: "Die Aufnahmequalität oder die Shunt-Geräusche waren nicht deutlich genug für eine eindeutige Bewertung. Das bedeutet nicht unbedingt ein Problem. Versuchen Sie, erneut in einer ruhigen Umgebung aufzunehmen, oder konsultieren Sie Ihren Arzt, wenn Sie Bedenken haben.",
    },
    abnormalities: {
      title: "Hinweis auf Auffälligkeiten",
      description: "In der Aufnahme wurden ungewöhnliche Muster erkannt.",
      explanation: "Unser KI-Modell hat Muster erkannt, die auf Veränderungen im Shunt-Fluss hindeuten könnten. Dies ist keine Diagnose — bitte konsultieren Sie Ihren Arzt für eine professionelle Bewertung. Bringen Sie diese Aufnahme zu Ihrem nächsten Termin mit.",
    },
  },

  // Settings Screen
  settings: {
    title: "Einstellungen",
    studyIdLabel: "Studien-ID",
    languageLabel: "Sprache",
    version: "Version",
    deleteAccountTitle: "Konto löschen",
    deleteAccountMessage: "Sind Sie sicher, dass Sie Ihr Konto löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
    accountSection: "Konto",
    passwordLabel: "Passwort",
    legalSection: "Rechtliches",
    consentsLabel: "Einwilligungen",
    legalDisclosureLabel: "Impressum",
  },

  // Error boundary
  errorBoundary: {
    title: "Etwas ist schiefgelaufen",
    message: "In der App ist ein unerwarteter Fehler aufgetreten. Ihre Aufnahmen sind sicher.",
    tryAgain: "Erneut versuchen",
  },
};
