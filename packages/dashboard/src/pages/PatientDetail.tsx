import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, Play, Pause, RotateCcw, Edit3, Check, X, Tag, Plus, Flag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WaveformChart } from "@/components/WaveformChart";
import { useI18n } from "@/i18n";

// Mock patient data
const patientData = {
  id: 1,
  studyId: "P001",
  phone: "(555) 123-4567",
  vascularAccess: "Unterarm links",
  avatarColor: "hsl(220, 90%, 56%)",
  nephrologist: {
    primaryContact: "Dr. Sarah Williams",
    phone: "(555) 987-6543",
    email: "s.williams@nephrology.com",
    street: "456 Medical Center Dr",
    postalCode: "12345",
    city: "Springfield",
    country: "USA"
  },
  shuntInfo: {
    field1: "",
    field2: "",
    field3: "",
    field4: ""
  }
};
const getInitials = (studyId: string) => {
  // Extract first 2 characters from study ID or use first character twice if only one char
  return studyId.length >= 2 ? studyId.substring(0, 2).toUpperCase() : studyId.toUpperCase();
};

// Mock recordings data
const recordings = [{
  id: 1,
  date: "2025-11-25",
  time: "09:30",
  duration: "45s",
  classification: "normal",
  notes: "",
  reviewed: false,
  flaggedForReview: false,
  waveform: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50'%3E%3Cpath d='M0,25 Q10,15 20,25 T40,25 Q50,20 60,25 T80,25 Q90,30 100,25 T120,25 Q130,20 140,25 T160,25 Q170,30 180,25 T200,25' stroke='%2308bcd0' fill='none' stroke-width='2'/%3E%3C/svg%3E",
  recordingData: {
    deviceType: "iPhone 14 Pro",
    microphoneType: "Built-in",
    recordingQuality: "High (44.1 kHz)",
    bitDepth: "16-bit",
    fileFormat: "WAV",
    fileSize: "2.4 MB",
    environment: "Clinic Room A",
    noiseLevel: "Low"
  }
}, {
  id: 2,
  date: "2025-11-22",
  time: "14:20",
  duration: "38s",
  classification: "normal",
  notes: "Patient reported feeling well",
  reviewed: true,
  flaggedForReview: false,
  waveform: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50'%3E%3Cpath d='M0,25 Q10,15 20,25 T40,25 Q50,20 60,25 T80,25 Q90,30 100,25 T120,25 Q130,20 140,25 T160,25 Q170,30 180,25 T200,25' stroke='%2308bcd0' fill='none' stroke-width='2'/%3E%3C/svg%3E",
  recordingData: {
    deviceType: "Samsung Galaxy S23",
    microphoneType: "Built-in",
    recordingQuality: "High (48 kHz)",
    bitDepth: "24-bit",
    fileFormat: "FLAC",
    fileSize: "1.8 MB",
    environment: "Home",
    noiseLevel: "Medium"
  }
}, {
  id: 3,
  date: "2025-11-19",
  time: "10:15",
  duration: "52s",
  classification: "abnormal",
  notes: "Slight turbulence detected, monitoring required",
  reviewed: false,
  flaggedForReview: true,
  waveform: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50'%3E%3Cpath d='M0,25 Q10,10 20,25 T40,25 Q50,35 60,25 T80,25 Q90,15 100,25 T120,25 Q130,35 140,25 T160,25 Q170,15 180,25 T200,25' stroke='%23eab308' fill='none' stroke-width='2'/%3E%3C/svg%3E",
  recordingData: {
    deviceType: "iPhone 13",
    microphoneType: "External USB-C",
    recordingQuality: "Ultra (96 kHz)",
    bitDepth: "24-bit",
    fileFormat: "WAV",
    fileSize: "4.2 MB",
    environment: "Clinic Room B",
    noiseLevel: "Very Low"
  }
}];

const PatientDetail = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const initialTab = searchParams.get('tab') || 'recordings';
  const [selectedRecording, setSelectedRecording] = useState<number | null>(null);
  const [recordingNotes, setRecordingNotes] = useState<{
    [key: number]: string;
  }>(Object.fromEntries(recordings.map(r => [r.id, r.notes])));
  const [classifications, setClassifications] = useState<{
    [key: number]: string;
  }>(Object.fromEntries(recordings.map(r => [r.id, r.classification])));
  const [recordingTags, setRecordingTags] = useState<{
    [key: number]: string[];
  }>({
    1: ["stenosis", "turbulent flow"],
    2: ["clear", "normal flow"],
    3: ["irregular", "requires monitoring"]
  });
  const [availableTags] = useState<string[]>(["stenosis", "turbulent flow", "clear", "normal flow", "irregular", "requires monitoring", "thrill present", "bruit detected", "weak signal", "excellent flow"]);
  const [newTag, setNewTag] = useState("");
  const [reviewedStatus, setReviewedStatus] = useState<{
    [key: number]: boolean;
  }>(Object.fromEntries(recordings.map(r => [r.id, r.reviewed])));
  const [flaggedStatus, setFlaggedStatus] = useState<{
    [key: number]: boolean;
  }>(Object.fromEntries(recordings.map(r => [r.id, r.flaggedForReview])));

  const handleToggleFlag = (recordingId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlaggedStatus(prev => ({
      ...prev,
      [recordingId]: !prev[recordingId]
    }));
    toast({
      title: flaggedStatus[recordingId]
        ? t("patientDetail.recording.flag.toast.removed")
        : t("patientDetail.recording.flag.toast.added")
    });
  };

  // Patient info editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedPatientData, setEditedPatientData] = useState(patientData);
  const [tempValue, setTempValue] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [previousField, setPreviousField] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Audio playback state
  const [playingRecording, setPlayingRecording] = useState<number | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<{
    [key: number]: number;
  }>({});
  const playbackIntervalRef = useRef<{
    [key: number]: NodeJS.Timeout;
  }>({});
  const handleAddTag = (recordingId: number) => {
    if (newTag.trim()) {
      setRecordingTags({
        ...recordingTags,
        [recordingId]: [...(recordingTags[recordingId] || []), newTag.trim()]
      });
      setNewTag("");
    }
  };
  const handleRemoveTag = (recordingId: number, tagToRemove: string) => {
    setRecordingTags({
      ...recordingTags,
      [recordingId]: (recordingTags[recordingId] || []).filter(tag => tag !== tagToRemove)
    });
  };
  const handlePlayPause = (recordingId: number) => {
    if (playingRecording === recordingId) {
      // Pause
      setPlayingRecording(null);
      if (playbackIntervalRef.current[recordingId]) {
        clearInterval(playbackIntervalRef.current[recordingId]);
        delete playbackIntervalRef.current[recordingId];
      }
    } else {
      // Stop other recordings
      Object.keys(playbackIntervalRef.current).forEach(key => {
        clearInterval(playbackIntervalRef.current[parseInt(key)]);
        delete playbackIntervalRef.current[parseInt(key)];
      });

      // Start playing
      setPlayingRecording(recordingId);
      const startProgress = playbackProgress[recordingId] || 0;
      if (startProgress >= 1) {
        // Reset if at end
        setPlaybackProgress({
          ...playbackProgress,
          [recordingId]: 0
        });
      }

      // Simulate playback - 45s duration, update every 50ms
      const duration = 45000; // 45 seconds in ms
      const updateInterval = 50; // Update every 50ms
      const increment = updateInterval / duration;
      playbackIntervalRef.current[recordingId] = setInterval(() => {
        setPlaybackProgress(prev => {
          const currentProgress = prev[recordingId] || 0;
          const newProgress = currentProgress + increment;
          if (newProgress >= 1) {
            // Finished playing
            clearInterval(playbackIntervalRef.current[recordingId]);
            delete playbackIntervalRef.current[recordingId];
            setPlayingRecording(null);
            return {
              ...prev,
              [recordingId]: 1
            };
          }
          return {
            ...prev,
            [recordingId]: newProgress
          };
        });
      }, updateInterval);
    }
  };
  const handleRestart = (recordingId: number) => {
    // Stop any current playback
    if (playbackIntervalRef.current[recordingId]) {
      clearInterval(playbackIntervalRef.current[recordingId]);
      delete playbackIntervalRef.current[recordingId];
    }

    // Reset progress
    setPlaybackProgress({
      ...playbackProgress,
      [recordingId]: 0
    });

    // Start playing from beginning
    setPlayingRecording(recordingId);

    // Start playback interval
    const duration = 45000;
    const updateInterval = 50;
    const increment = updateInterval / duration;
    playbackIntervalRef.current[recordingId] = setInterval(() => {
      setPlaybackProgress(prev => {
        const currentProgress = prev[recordingId] || 0;
        const newProgress = currentProgress + increment;
        if (newProgress >= 1) {
          clearInterval(playbackIntervalRef.current[recordingId]);
          delete playbackIntervalRef.current[recordingId];
          setPlayingRecording(null);
          return {
            ...prev,
            [recordingId]: 1
          };
        }
        return {
          ...prev,
          [recordingId]: newProgress
        };
      });
    }, updateInterval);
  };
  const handleSeek = (recordingId: number, progress: number) => {
    setPlaybackProgress({
      ...playbackProgress,
      [recordingId]: progress
    });
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(playbackIntervalRef.current).forEach(interval => {
        clearInterval(interval);
      });
    };
  }, []);
  const handleEditField = (field: string, currentValue: string) => {
    // Auto-save current field if switching to a different field
    if (editingField && editingField !== field && tempValue !== previousValue) {
      handleAutoSave(editingField as keyof typeof patientData);
    }
    setEditingField(field);
    setTempValue(currentValue);
    setPreviousValue(currentValue);
    setPreviousField(field);
  };
  const handleAutoSave = (field: keyof typeof patientData) => {
    const fieldLabels: { [key: string]: string } = {
      studyId: t("patientDetail.info.patient.studyId"),
      phone: t("patientDetail.info.patient.phone"),
      vascularAccess: t("patientDetail.info.patient.vascularAccess")
    };
    setEditedPatientData({
      ...editedPatientData,
      [field]: tempValue
    });
    setEditingField(null);
    toast({
      title: t("patientDetail.toast.fieldSaved").replace("{{field}}", fieldLabels[field]),
      action: (
        <Button variant="outline" size="sm" onClick={() => handleUndo(field)}>
          {t("patientDetail.toast.undo")}
        </Button>
      )
    });
    setTempValue("");
  };
  const handleUndo = (field: keyof typeof patientData) => {
    setEditedPatientData({
      ...editedPatientData,
      [field]: previousValue
    });
    toast({
      title: t("patientDetail.toast.reverted")
    });
  };
  const handleSaveField = (field: keyof typeof patientData) => {
    if (tempValue !== previousValue) {
      handleAutoSave(field);
    } else {
      setEditingField(null);
      setTempValue("");
    }
  };
  const handleDiscardField = () => {
    setEditingField(null);
    setTempValue("");
  };

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingField) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveField(editingField as keyof typeof patientData);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDiscardField();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingField, tempValue, previousValue]);

  // Click-outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingField && editContainerRef.current && !editContainerRef.current.contains(event.target as Node)) {
        if (tempValue !== previousValue) {
          handleAutoSave(editingField as keyof typeof patientData);
        } else {
          handleDiscardField();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingField, tempValue, previousValue]);
  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={() => navigate("/patients")} className="h-10 w-10 rounded-full p-0">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("patientDetail.backToPatients")}
      </span>
    </div>

    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarFallback style={{
          backgroundColor: editedPatientData.avatarColor
        }} className="text-white font-semibold text-xl">
          {getInitials(editedPatientData.studyId)}
        </AvatarFallback>
      </Avatar>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        {editedPatientData.studyId}
      </h2>
    </div>

    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList className="bg-muted">
        <TabsTrigger value="recordings">
          {t("patientDetail.tabs.recordings")}
        </TabsTrigger>
        <TabsTrigger value="info">
          {t("patientDetail.tabs.info")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="space-y-4">
        <div className="flex gap-4">
          {/* Left Navigation - Separate Box */}
          <Card className="shrink-0 max-w-[240px]">
            <CardContent className="p-1.5 space-y-0.5">
              <button
                onClick={() =>
                  document.getElementById("patient-info")?.scrollIntoView({
                    behavior: "smooth"
                  })
                }
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-base font-medium"
              >
                {t("patientDetail.info.nav.patient")}
              </button>
              <button
                onClick={() =>
                  document.getElementById("treating-nephrologist")?.scrollIntoView({
                    behavior: "smooth"
                  })
                }
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-base font-medium"
              >
                {t("patientDetail.info.nav.nephrologist")}
              </button>
              <button
                onClick={() =>
                  document.getElementById("shunt-info")?.scrollIntoView({
                    behavior: "smooth"
                  })
                }
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-base font-medium"
              >
                {t("patientDetail.info.nav.shunt")}
              </button>
            </CardContent>
          </Card>

          {/* Right Content - Main Box */}
          <Card className="flex-1">
            <CardContent className="p-6 space-y-8">

              {/* Patient Information Section */}
              <div id="patient-info" className="scroll-mt-6">
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  {t("patientDetail.info.patient.title")}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {/* Study ID */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.patient.studyId")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "studyId" ? editContainerRef : null}>
                      {editingField === "studyId" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveField("studyId")} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.studyId}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("studyId", editedPatientData.studyId)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Phone */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.patient.phone")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "phone" ? editContainerRef : null}>
                      {editingField === "phone" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveField("phone")} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">
                          {editedPatientData.phone || t("patientDetail.info.patient.phoneNotProvided")}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("phone", editedPatientData.phone)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Vascular Access Type */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.patient.vascularAccess")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "vascularAccess" ? editContainerRef : null}>
                      {editingField === "vascularAccess" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveField("vascularAccess")} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.vascularAccess}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("vascularAccess", editedPatientData.vascularAccess)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Treating Nephrologist Section */}
              <div id="treating-nephrologist" className="scroll-mt-6 pt-8 border-t">
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  {t("patientDetail.info.nephrologist.title")}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {/* Primary Contact */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.primaryContact")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistPrimaryContact" ? editContainerRef : null}>
                      {editingField === "nephrologistPrimaryContact" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              primaryContact: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.primaryContact}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistPrimaryContact", editedPatientData.nephrologist.primaryContact)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Phone */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.phone")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistPhone" ? editContainerRef : null}>
                      {editingField === "nephrologistPhone" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              phone: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.phone}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistPhone", editedPatientData.nephrologist.phone)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Email */}
                    <div className="text-muted-foreground">Email</div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistEmail" ? editContainerRef : null}>
                      {editingField === "nephrologistEmail" ? <>
                        <Input ref={inputRef} type="email" value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              email: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.email}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistEmail", editedPatientData.nephrologist.email)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Street */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.street")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistStreet" ? editContainerRef : null}>
                      {editingField === "nephrologistStreet" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              street: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.street}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistStreet", editedPatientData.nephrologist.street)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Postal Code */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.postalCode")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistPostalCode" ? editContainerRef : null}>
                      {editingField === "nephrologistPostalCode" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              postalCode: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.postalCode}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistPostalCode", editedPatientData.nephrologist.postalCode)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* City */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.city")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistCity" ? editContainerRef : null}>
                      {editingField === "nephrologistCity" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              city: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.city}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistCity", editedPatientData.nephrologist.city)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Country */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.nephrologist.country")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "nephrologistCountry" ? editContainerRef : null}>
                      {editingField === "nephrologistCountry" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            nephrologist: {
                              ...editedPatientData.nephrologist,
                              country: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">{editedPatientData.nephrologist.country}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("nephrologistCountry", editedPatientData.nephrologist.country)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Shunt Information Section */}
              <div id="shunt-info" className="scroll-mt-6 pt-8 border-t">
                <h2 className="text-2xl font-semibold mb-6 text-foreground">
                  {t("patientDetail.info.shunt.title")}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {/* Shunt Field 1 */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.shunt.field1")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "shuntField1" ? editContainerRef : null}>
                      {editingField === "shuntField1" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            shuntInfo: {
                              ...editedPatientData.shuntInfo,
                              field1: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">
                          {editedPatientData.shuntInfo.field1 || t("patientDetail.info.emptyValue")}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("shuntField1", editedPatientData.shuntInfo.field1)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Shunt Field 2 */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.shunt.field2")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "shuntField2" ? editContainerRef : null}>
                      {editingField === "shuntField2" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            shuntInfo: {
                              ...editedPatientData.shuntInfo,
                              field2: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">
                          {editedPatientData.shuntInfo.field2 || t("patientDetail.info.emptyValue")}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("shuntField2", editedPatientData.shuntInfo.field2)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Shunt Field 3 */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.shunt.field3")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "shuntField3" ? editContainerRef : null}>
                      {editingField === "shuntField3" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            shuntInfo: {
                              ...editedPatientData.shuntInfo,
                              field3: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">
                          {editedPatientData.shuntInfo.field3 || t("patientDetail.info.emptyValue")}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("shuntField3", editedPatientData.shuntInfo.field3)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>

                    {/* Shunt Field 4 */}
                    <div className="text-muted-foreground">
                      {t("patientDetail.info.shunt.field4")}
                    </div>
                    <div className="group relative flex items-center gap-2" ref={editingField === "shuntField4" ? editContainerRef : null}>
                      {editingField === "shuntField4" ? <>
                        <Input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} className="flex-1" autoFocus />
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditedPatientData({
                            ...editedPatientData,
                            shuntInfo: {
                              ...editedPatientData.shuntInfo,
                              field4: tempValue
                            }
                          });
                          handleDiscardField();
                        }} className="h-8 w-8 p-0">
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDiscardField} className="h-8 w-8 p-0">
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </> : <>
                        <span className="text-foreground font-medium">
                          {editedPatientData.shuntInfo.field4 || t("patientDetail.info.emptyValue")}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleEditField("shuntField4", editedPatientData.shuntInfo.field4)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </>}
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="recordings" className="space-y-4">
        <div className="space-y-4">
          {recordings.map(recording => <Card key={recording.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={e => {
            // Don't open panel if clicking the play button
            const target = e.target as HTMLElement;
            if (!target.closest('button')) {
              setSelectedRecording(recording.id);
            }
          }}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button className="h-12 w-12 rounded-lg p-0" onClick={e => {
                        e.stopPropagation();
                        handlePlayPause(recording.id);
                      }}>
                        {playingRecording === recording.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={e => {
                        e.stopPropagation();
                        handleRestart(recording.id);
                      }}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {recording.date} at {recording.time}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round((playbackProgress[recording.id] || 0) * 45)}s / {recording.duration}
                      </p>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleToggleFlag(recording.id, e)}
                        >
                          <Flag className={`h-4 w-4 ${flaggedStatus[recording.id] ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{flaggedStatus[recording.id] ? "Markierung entfernen" : "Zur Überprüfung markieren"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="h-32 bg-white rounded-lg border border-border overflow-hidden">
                  <WaveformChart progress={playbackProgress[recording.id] || 0} interactive={true} onSeek={progress => handleSeek(recording.id, progress)} />
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={classifications[recording.id] === "normal" ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20" : classifications[recording.id] === "abnormal" ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20" : "bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20"}>
                    {classifications[recording.id]}
                  </Badge>
                </div>

                {recordingNotes[recording.id] && <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    {recordingNotes[recording.id]}
                  </p>
                </div>}
              </div>
            </CardContent>
          </Card>)}
        </div>

        {/* Recording Detail Side Panel */}
        <Sheet open={selectedRecording !== null} onOpenChange={open => !open && setSelectedRecording(null)}>
          <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none overflow-y-auto">
            {selectedRecording && (() => {
              const recording = recordings.find(r => r.id === selectedRecording);
              if (!recording) return null;
              return <>
                <SheetHeader>
                  <SheetTitle>{t("patientDetail.recording.detailsTitle")}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 pt-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback style={{
                        backgroundColor: editedPatientData.avatarColor
                      }} className="text-white font-semibold text-xs">
                        {getInitials(editedPatientData.studyId)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{editedPatientData.studyId}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>
                      {recording.date} {recording.time} • {t("patientDetail.recording.vascularAccess.lastReview")} {recording.duration}
                    </span>
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Audio Player */}
                  <div className="space-y-3">
                    <Label>{t("patientDetail.recording.audioPlayback")}</Label>
                    <div className="h-20 bg-white rounded-lg border border-border overflow-hidden">
                      <WaveformChart height={80} progress={playbackProgress[recording.id] || 0} interactive={true} onSeek={progress => handleSeek(recording.id, progress)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="gap-2" onClick={() => handlePlayPause(recording.id)}>
                        {playingRecording === recording.id ? (
                          <>
                            <Pause className="h-3 w-3" />
                            {t("patientDetail.recording.pause")}
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            {t("patientDetail.recording.play")}
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRestart(recording.id)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {Math.round((playbackProgress[recording.id] || 0) * 45)}s / 45s
                      </span>
                    </div>
                  </div>

                  {/* Classification */}
                  <div className="space-y-2">
                    <Label>{t("patientDetail.recording.classification")}</Label>
                    <Select value={classifications[recording.id]} onValueChange={value => setClassifications({
                      ...classifications,
                      [recording.id]: value
                    })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
                            {t("home.recording.classification.normal")}
                          </Badge>
                        </SelectItem>
                        <SelectItem value="abnormal">
                          <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
                            {t("home.recording.classification.abnormal")}
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tags/Labels */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      {t("patientDetail.recording.tagsLabel")}
                    </Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(recordingTags[recording.id] || []).map((tag, index) => <Badge key={index} variant="secondary" className="gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(recording.id, tag)} />
                      </Badge>)}
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={newTag}
                        onValueChange={value => {
                          setNewTag(value);
                          if (value && !recordingTags[recording.id]?.includes(value)) {
                            setRecordingTags({
                              ...recordingTags,
                              [recording.id]: [...(recordingTags[recording.id] || []), value]
                            });
                            setNewTag("");
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue
                            placeholder={t("patientDetail.recording.tagsPlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {availableTags.filter(tag => !recordingTags[recording.id]?.includes(tag)).map(tag => <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>{t("patientDetail.recording.notesLabel")}</Label>
                    <Textarea
                      value={recordingNotes[recording.id]}
                      onChange={e =>
                        setRecordingNotes({
                          ...recordingNotes,
                          [recording.id]: e.target.value
                        })
                      }
                      placeholder={t("patientDetail.recording.notesPlaceholder")}
                      rows={4}
                      className="bg-background"
                    />
                  </div>

                  {/* Recording Data Section */}
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="font-semibold text-foreground mb-3">Recording Data</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Device Type:</span>
                        <span className="font-medium">{recording.recordingData.deviceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Microphone Type:</span>
                        <span className="font-medium">{recording.recordingData.microphoneType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recording Quality:</span>
                        <span className="font-medium">{recording.recordingData.recordingQuality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bit Depth:</span>
                        <span className="font-medium">{recording.recordingData.bitDepth}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File Format:</span>
                        <span className="font-medium">{recording.recordingData.fileFormat}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File Size:</span>
                        <span className="font-medium">{recording.recordingData.fileSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Environment:</span>
                        <span className="font-medium">{recording.recordingData.environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Noise Level:</span>
                        <span className="font-medium">{recording.recordingData.noiseLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vascular Access Information */}
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="font-semibold text-foreground mb-3">
                      {t("patientDetail.recording.vascularAccessTitle")}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("patientDetail.recording.vascularAccess.type")}
                        </span>
                        <span className="font-medium">{editedPatientData.vascularAccess}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("patientDetail.recording.vascularAccess.location")}
                        </span>
                        <span className="font-medium">Linker Unterarm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("patientDetail.recording.vascularAccess.createdAt")}
                        </span>
                        <span className="font-medium">2024-03-15</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("patientDetail.recording.vascularAccess.lastReview")}
                        </span>
                        <span className="font-medium">{recording.date}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviewed Status Button */}
                <div className="sticky bottom-0 left-0 right-0 pt-6 pb-4 bg-background border-t mt-auto z-10">
                  <Button
                    size="lg"
                    className={`w-full gap-2 text-base font-semibold ${reviewedStatus[recording.id]
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-primary hover:bg-primary/90"
                      }`}
                    onClick={() => {
                      setReviewedStatus({
                        ...reviewedStatus,
                        [recording.id]: !reviewedStatus[recording.id]
                      });
                    }}
                  >
                    {reviewedStatus[recording.id]
                      ? t("patientDetail.recording.reviewedButton.reviewed")
                      : t("patientDetail.recording.reviewedButton.markAsReviewed")}
                  </Button>
                </div>
              </>;
            })()}
          </SheetContent>
        </Sheet>
      </TabsContent>

    </Tabs>
  </div>;
};
export default PatientDetail;