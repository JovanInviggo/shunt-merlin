import { createContext, ReactNode, useContext, useState } from "react";

type Language = "de" | "en";

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  de: {
    "app.name": "Shunt Merlin",

    // Login
    "login.title": "Anmelden",
    "login.subtitle": "Melden Sie sich mit Ihrem Admin-Konto an",
    "login.email": "E-Mail",
    "login.password": "Passwort",
    "login.button": "Anmelden",
    "login.loading": "Wird angemeldet...",
    "login.error": "Ungültige E-Mail oder Passwort",
    "login.logout": "Abmelden",

    // Navigation
    "nav.home": "Home",
    "nav.patients": "Studienteilnehmer",

    // Header / language switcher
    "lang.de": "DE",
    "lang.en": "EN",

    // Home page
    "home.title": "Home",
    "home.totalPatients.title": "Studienteilnehmer Gesamt",
    "home.totalPatients.subtitle": "Aktive Überwachung",
    "home.last30Days.title": "Letzten 30 Tage",
    "home.last30Days.subtitle": "Aufnahmen empfangen",
    "home.newRecordings.title": "4 neue Aufnahmen warten auf Ihre Überprüfung",
    "home.export.button": "Alle Daten exportieren",
    "home.export.successTitle": "Export erfolgreich",
    "home.export.successDescription": "Alle Daten wurden als CSV exportiert",
    "home.export.errorTitle": "Export fehlgeschlagen",
    "home.export.errorDescription": "Beim Exportieren der Daten ist ein Fehler aufgetreten",
    "home.recording.detailsTitle": "Aufnahme Details",
    "home.recording.audioPlayback": "Audio-Wiedergabe",
    "home.recording.play": "Aufnahme abspielen",
    "home.recording.pause": "Pause",
    "home.recording.classification": "Klassifizierung",
    "home.recording.classification.normal": "Normal",
    "home.recording.classification.abnormal": "Abnormal",
    "home.recording.classification.needsReview": "Benötigt Überprüfung",
    "home.recording.tagsLabel": "Labels & Tags",
    "home.recording.newTagPlaceholder": "Neues Tag hinzufügen...",
    "home.recording.notesLabel": "Klinische Notizen",
    "home.recording.notesPlaceholder": "Klinische Beobachtungen und Notizen hinzufügen...",
    "home.recording.vascularAccessTitle": "Studienteilnehmer Gefäßzugang",
    "home.recording.vascularAccess.type": "Zugangstyp:",
    "home.recording.vascularAccess.location": "Ort:",
    "home.recording.vascularAccess.createdAt": "Anlagedatum:",
    "home.recording.vascularAccess.lastReview": "Letzte Bewertung:",
    "home.recording.reviewedButton.reviewed": "Geprüft",
    "home.recording.reviewedButton.markAsReviewed": "Als geprüft markieren",

    // Patients list
    "patients.title": "Studienteilnehmer",
    "patients.search.placeholder": "Nach Study-ID suchen...",
    "patients.add.button": "Neuen Studienteilnehmer anlegen",
    "patients.add.dialogTitle": "Neuen Studienteilnehmer anlegen",
    "patients.add.dialogDescription":
      "Geben Sie die Study-ID des Studienteilnehmers ein. Die Telefonnummer ist optional.",
    "patients.add.studyId.label": "Study ID",
    "patients.add.studyId.required": "Study-ID ist erforderlich",
    "patients.add.studyId.duplicate":
      "Diese Study-ID existiert bereits. Bitte verwenden Sie eine eindeutige Study-ID.",
    "patients.add.phone.label": "Telefon (optional)",
    "patients.add.vascularAccess.label": "Shunt Typ (optional)",
    "patients.add.cancel": "Abbrechen",
    "patients.add.save": "Studienteilnehmer speichern",
    "patients.table.studyId": "Study ID",
    "patients.table.lastRecording": "Letzte Aufnahme",
    "patients.table.totalRecordings": "Gesamtaufnahmen",
    "patients.table.vascularAccess": "Gefäßzugang",
    "patients.table.status": "Status",
    "patients.table.review": "Überprüfen",
    "patients.table.status.active": "Aktiv",
    "patients.table.flagged.tooltip": "Zur Überprüfung markiert",

    // Patient detail
    "patientDetail.backToPatients": "Zurück zu Studienteilnehmer",
    "patientDetail.tabs.recordings": "Aufnahmen",
    "patientDetail.tabs.info": "Info",
    "patientDetail.info.nav.patient": "Studienteilnehmer Information",
    "patientDetail.info.nav.nephrologist": "Behandelnder Nephrologe",
    "patientDetail.info.nav.shunt": "Gefäßzugang",
    "patientDetail.info.patient.title": "Studienteilnehmer Information",
    "patientDetail.info.patient.studyId": "Study ID",
    "patientDetail.info.patient.phone": "Telefon",
    "patientDetail.info.patient.vascularAccess": "Gefäßzugang Typ",
    "patientDetail.info.patient.phoneNotProvided": "Nicht angegeben",
    "patientDetail.info.nephrologist.title": "Behandelnder Nephrologe",
    "patientDetail.info.nephrologist.primaryContact": "Hauptkontakt",
    "patientDetail.info.nephrologist.phone": "Telefon",
    "patientDetail.info.nephrologist.street": "Straße",
    "patientDetail.info.nephrologist.postalCode": "Postleitzahl",
    "patientDetail.info.nephrologist.city": "Stadt",
    "patientDetail.info.nephrologist.country": "Land",
    "patientDetail.info.shunt.title": "Gefäßzugang",
    "patientDetail.info.shunt.field1": "Zugangsstelle",
    "patientDetail.info.shunt.field2": "Reifungsdatum",
    "patientDetail.info.shunt.field3": "Flow Rate (ml/min)",
    "patientDetail.info.shunt.field4": "Komplikationshistorie",
    "patientDetail.info.emptyValue": "—",
    "patientDetail.toast.fieldSaved": "{{field}} gespeichert",
    "patientDetail.toast.undo": "Rückgängig",
    "patientDetail.toast.reverted": "Änderung rückgängig gemacht",

    "patientDetail.recording.detailsTitle": "Aufnahme Details",
    "patientDetail.recording.audioPlayback": "Audio-Wiedergabe",
    "patientDetail.recording.play": "Abspielen",
    "patientDetail.recording.pause": "Pause",
    "patientDetail.recording.classification": "Klassifizierung",
    "patientDetail.recording.notesLabel": "Klinische Notizen",
    "patientDetail.recording.notesPlaceholder": "Klinische Beobachtungen und Notizen hinzufügen...",
    "patientDetail.recording.tagsLabel": "Labels & Tags",
    "patientDetail.recording.tagsPlaceholder": "Tag zum Hinzufügen auswählen...",
    "patientDetail.recording.vascularAccessTitle": "Studienteilnehmer Gefäßzugang",
    "patientDetail.recording.vascularAccess.type": "Zugangstyp:",
    "patientDetail.recording.vascularAccess.location": "Ort:",
    "patientDetail.recording.vascularAccess.createdAt": "Anlagedatum:",
    "patientDetail.recording.vascularAccess.lastReview": "Letzte Bewertung:",
    "patientDetail.recording.flag.add": "Zur Überprüfung markieren",
    "patientDetail.recording.flag.remove": "Markierung entfernen",
    "patientDetail.recording.flag.toast.added": "Zur Überprüfung markiert",
    "patientDetail.recording.flag.toast.removed": "Markierung entfernt",
    "patientDetail.recording.reviewedButton.reviewed": "Geprüft",
    "patientDetail.recording.reviewedButton.markAsReviewed": "Als geprüft markieren",

    // NotFound
    "notFound.title": "Ups! Seite nicht gefunden",
    "notFound.backToHome": "Zurück zu Home",

    // Index / welcome
    "index.title": "Willkommen zu Ihrer Blank App",
    "index.subtitle": "Beginnen Sie hier mit Ihrem fantastischen Projekt!",
  },
  en: {
    "app.name": "Shunt Merlin",

    // Login
    "login.title": "Sign in",
    "login.subtitle": "Sign in with your admin account",
    "login.email": "Email",
    "login.password": "Password",
    "login.button": "Sign in",
    "login.loading": "Signing in...",
    "login.error": "Invalid email or password",
    "login.logout": "Sign out",

    // Navigation
    "nav.home": "Home",
    "nav.patients": "Study Participants",

    // Header / language switcher
    "lang.de": "DE",
    "lang.en": "EN",

    // Home page
    "home.title": "Home",
    "home.totalPatients.title": "Total study participants",
    "home.totalPatients.subtitle": "Active monitoring",
    "home.last30Days.title": "Last 30 days",
    "home.last30Days.subtitle": "Recordings received",
    "home.newRecordings.title": "new recordings are waiting for your review",
    "home.export.button": "Export all data",
    "home.export.successTitle": "Export successful",
    "home.export.successDescription": "All data has been exported as CSV",
    "home.export.errorTitle": "Export failed",
    "home.export.errorDescription": "An error occurred while exporting the data",
    "home.recording.detailsTitle": "Recording details",
    "home.recording.audioPlayback": "Audio playback",
    "home.recording.play": "Play recording",
    "home.recording.pause": "Pause",
    "home.recording.classification": "Classification",
    "home.recording.classification.normal": "Normal",
    "home.recording.classification.abnormal": "Abnormal",
    "home.recording.classification.needsReview": "Needs review",
    "home.recording.tagsLabel": "Labels & tags",
    "home.recording.newTagPlaceholder": "Add new tag...",
    "home.recording.notesLabel": "Clinical notes",
    "home.recording.notesPlaceholder": "Add clinical observations and notes...",
    "home.recording.vascularAccessTitle": "Participant vascular access",
    "home.recording.vascularAccess.type": "Access type:",
    "home.recording.vascularAccess.location": "Location:",
    "home.recording.vascularAccess.createdAt": "Created on:",
    "home.recording.vascularAccess.lastReview": "Last assessment:",
    "home.recording.reviewedButton.reviewed": "Reviewed",
    "home.recording.reviewedButton.markAsReviewed": "Mark as reviewed",

    // Patients list
    "patients.title": "Study participants",
    "patients.search.placeholder": "Search by study ID...",
    "patients.add.button": "Add new study participant",
    "patients.add.dialogTitle": "Add new study participant",
    "patients.add.dialogDescription":
      "Enter the study ID of the participant. The phone number is optional.",
    "patients.add.studyId.label": "Study ID",
    "patients.add.studyId.required": "Study ID is required",
    "patients.add.studyId.duplicate":
      "This study ID already exists. Please use a unique study ID.",
    "patients.add.phone.label": "Phone (optional)",
    "patients.add.vascularAccess.label": "Shunt type (optional)",
    "patients.add.cancel": "Cancel",
    "patients.add.save": "Save participant",
    "patients.table.studyId": "Study ID",
    "patients.table.lastRecording": "Last recording",
    "patients.table.totalRecordings": "Total recordings",
    "patients.table.vascularAccess": "Vascular access",
    "patients.table.status": "Status",
    "patients.table.review": "Review",
    "patients.table.status.active": "Active",
    "patients.table.flagged.tooltip": "Marked for review",

    // Patient detail
    "patientDetail.backToPatients": "Back to study participants",
    "patientDetail.tabs.recordings": "Recordings",
    "patientDetail.tabs.info": "Info",
    "patientDetail.info.nav.patient": "Participant information",
    "patientDetail.info.nav.nephrologist": "Treating nephrologist",
    "patientDetail.info.nav.shunt": "Vascular access",
    "patientDetail.info.patient.title": "Participant information",
    "patientDetail.info.patient.studyId": "Study ID",
    "patientDetail.info.patient.phone": "Phone",
    "patientDetail.info.patient.vascularAccess": "Vascular access type",
    "patientDetail.info.patient.phoneNotProvided": "Not provided",
    "patientDetail.info.nephrologist.title": "Treating nephrologist",
    "patientDetail.info.nephrologist.primaryContact": "Primary contact",
    "patientDetail.info.nephrologist.phone": "Phone",
    "patientDetail.info.nephrologist.street": "Street",
    "patientDetail.info.nephrologist.postalCode": "Postal code",
    "patientDetail.info.nephrologist.city": "City",
    "patientDetail.info.nephrologist.country": "Country",
    "patientDetail.info.shunt.title": "Vascular access",
    "patientDetail.info.shunt.field1": "Access site",
    "patientDetail.info.shunt.field2": "Maturation date",
    "patientDetail.info.shunt.field3": "Flow rate (ml/min)",
    "patientDetail.info.shunt.field4": "Complication history",
    "patientDetail.info.emptyValue": "—",
    "patientDetail.toast.fieldSaved": "{{field}} saved",
    "patientDetail.toast.undo": "Undo",
    "patientDetail.toast.reverted": "Change reverted",

    "patientDetail.recording.detailsTitle": "Recording details",
    "patientDetail.recording.audioPlayback": "Audio playback",
    "patientDetail.recording.play": "Play",
    "patientDetail.recording.pause": "Pause",
    "patientDetail.recording.classification": "Classification",
    "patientDetail.recording.notesLabel": "Clinical notes",
    "patientDetail.recording.notesPlaceholder": "Add clinical observations and notes...",
    "patientDetail.recording.tagsLabel": "Labels & tags",
    "patientDetail.recording.tagsPlaceholder": "Select tag to add...",
    "patientDetail.recording.vascularAccessTitle": "Participant vascular access",
    "patientDetail.recording.vascularAccess.type": "Access type:",
    "patientDetail.recording.vascularAccess.location": "Location:",
    "patientDetail.recording.vascularAccess.createdAt": "Created on:",
    "patientDetail.recording.vascularAccess.lastReview": "Last assessment:",
    "patientDetail.recording.flag.add": "Mark for review",
    "patientDetail.recording.flag.remove": "Remove mark",
    "patientDetail.recording.flag.toast.added": "Marked for review",
    "patientDetail.recording.flag.toast.removed": "Mark removed",
    "patientDetail.recording.reviewedButton.reviewed": "Reviewed",
    "patientDetail.recording.reviewedButton.markAsReviewed": "Mark as reviewed",

    // NotFound
    "notFound.title": "Oops! Page not found",
    "notFound.backToHome": "Back to home",

    // Index / welcome
    "index.title": "Welcome to your blank app",
    "index.subtitle": "Start your amazing project here!",
  },
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("de");

  const t = (key: string): string => {
    const dict = translations[language];
    const value = dict[key] ?? key;
    return value;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

