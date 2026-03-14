import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRecordings } from "@/hooks/use-recordings";
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
import { fetchStudy, RecordingClassification } from "@/lib/api";
import { useUpdateRecording } from "@/hooks/use-recordings";

const patientData = {
  phone: "",
  vascularAccess: "",
  avatarColor: "hsl(220, 90%, 56%)",
  nephrologist: {
    primaryContact: "",
    phone: "",
    email: "",
    street: "",
    postalCode: "",
    city: "",
    country: ""
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


const PatientDetail = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const initialTab = searchParams.get('tab') || 'recordings';

  const { data: study, isLoading: studyLoading, error: studyError } = useQuery({
    queryKey: ["study", id],
    queryFn: () => fetchStudy(id!),
    enabled: !!id,
  });

  const [recordingsPage, setRecordingsPage] = useState(1);
  const recordingsLimit = 20;

  const { data: recordingsData, isLoading: recordingsLoading } = useRecordings(recordingsPage, recordingsLimit);

  const recordings = recordingsData?.data.filter(r => r.studyId === study?.studyId) ?? [];
  const totalPages = recordingsData?.totalPages ?? 1;

  const updateRecording = useUpdateRecording();

  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [recordingNotes, setRecordingNotes] = useState<{ [key: string]: string }>({});
  const [classifications, setClassifications] = useState<{ [key: string]: RecordingClassification | null }>({});
  const [recordingTags, setRecordingTags] = useState<{ [key: string]: string[] }>({});
  const [availableTags] = useState<string[]>(["stenosis", "turbulent flow", "clear", "normal flow", "irregular", "requires monitoring", "thrill present", "bruit detected", "weak signal", "excellent flow"]);
  const [newTag, setNewTag] = useState("");
  const [reviewedStatus, setReviewedStatus] = useState<{ [key: string]: boolean }>({});
  const [flaggedStatus, setFlaggedStatus] = useState<{ [key: string]: boolean }>({});

  const handleToggleFlag = (recordingId: string, e: React.MouseEvent) => {
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
  const displayStudyId = study?.studyId ?? "";
  const [tempValue, setTempValue] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [previousField, setPreviousField] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Audio playback state
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<{
    [key: string]: number;
  }>({});
  const playbackIntervalRef = useRef<{
    [key: string]: NodeJS.Timeout;
  }>({});

  const handleAddTag = (recordingId: string) => {
    if (newTag.trim()) {
      setRecordingTags({
        ...recordingTags,
        [recordingId]: [...(recordingTags[recordingId] || []), newTag.trim()]
      });
      setNewTag("");
    }
  };
  const handleRemoveTag = (recordingId: string, tagToRemove: string) => {
    setRecordingTags({
      ...recordingTags,
      [recordingId]: (recordingTags[recordingId] || []).filter(tag => tag !== tagToRemove)
    });
  };
  const handlePlayPause = (recordingId: string) => {
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
        clearInterval(playbackIntervalRef.current[key]);
        delete playbackIntervalRef.current[key];
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
  const handleRestart = (recordingId: string) => {
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
  const handleSeek = (recordingId: string, progress: number) => {
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
  if (studyLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (studyError || !study) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Failed to load patient.</p>
        <p className="text-xs mt-2">{(studyError as Error)?.message}</p>
      </div>
    );
  }

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
          {getInitials(displayStudyId)}
        </AvatarFallback>
      </Avatar>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        {displayStudyId}
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
                    <div className="flex items-center">
                      <span className="text-foreground font-medium">{displayStudyId}</span>
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
        {recordingsLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">Loading recordings...</div>
        )}
        {!recordingsLoading && recordings.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">No recordings yet.</div>
        )}
        <div className="space-y-4">
          {recordings.map(recording => {
            const recordedAt = new Date(recording.createdAt);
            const dateStr = recordedAt.toLocaleDateString("de-DE");
            const timeStr = recordedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
            return <Card key={recording.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={e => {
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
                          {dateStr} at {timeStr}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono text-xs">
                          {recording.s3Key}
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

                  {(() => {
                    const cls = classifications[recording.id] ?? recording.classification;
                    if (!cls || cls === "not_classified") return null;
                    return (
                      <div className="flex items-center gap-2">
                        <Badge className={
                          cls === "normal"
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
                            : cls === "abnormal"
                            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20"
                        }>
                          {cls}
                        </Badge>
                      </div>
                    );
                  })()}

                  {recordingNotes[recording.id] && <div className="pt-2">
                    <p className="text-sm text-muted-foreground">
                      {recordingNotes[recording.id]}
                    </p>
                  </div>}
                </div>
              </CardContent>
            </Card>;
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecordingsPage(p => Math.max(1, p - 1))}
              disabled={recordingsPage === 1 || recordingsLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {recordingsPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecordingsPage(p => Math.min(totalPages, p + 1))}
              disabled={recordingsPage === totalPages || recordingsLoading}
            >
              Next
            </Button>
          </div>
        )}

        {/* Recording Detail Side Panel */}
        <Sheet open={selectedRecording !== null} onOpenChange={open => !open && setSelectedRecording(null)}>
          <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none overflow-y-auto">
            {selectedRecording && (() => {
              const recording = recordings.find(r => r.id === selectedRecording);
              if (!recording) return null;
              const recordedAt = new Date(recording.createdAt);
              const dateStr = recordedAt.toLocaleDateString("de-DE");
              const timeStr = recordedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
              return <>
                <SheetHeader>
                  <SheetTitle>{t("patientDetail.recording.detailsTitle")}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 pt-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback style={{
                        backgroundColor: editedPatientData.avatarColor
                      }} className="text-white font-semibold text-xs">
                        {getInitials(displayStudyId)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{displayStudyId}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{dateStr} {timeStr}</span>
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
                        {Math.round((playbackProgress[recording.id] || 0) * 45)}s
                      </span>
                    </div>
                  </div>

                  {/* Classification */}
                  <div className="space-y-2">
                    <Label>{t("patientDetail.recording.classification")}</Label>
                    <Select
                      value={(recording.id in classifications ? classifications[recording.id] : recording.classification) ?? ""}
                      onValueChange={value => {
                        const cls = value as RecordingClassification;
                        setClassifications({ ...classifications, [recording.id]: cls });
                        updateRecording.mutate({ id: recording.id, dto: { classification: cls } });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
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
                        <SelectItem value="unclear">
                          <Badge className="bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20">
                            Unclear
                          </Badge>
                        </SelectItem>
                        <SelectItem value="not_classified">
                          <span className="text-muted-foreground">Not classified</span>
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
                      value={recording.id in recordingNotes ? recordingNotes[recording.id] : (recording.note ?? "")}
                      onChange={e =>
                        setRecordingNotes({
                          ...recordingNotes,
                          [recording.id]: e.target.value
                        })
                      }
                      onBlur={() => {
                        const note = recording.id in recordingNotes ? recordingNotes[recording.id] : (recording.note ?? "");
                        updateRecording.mutate({
                          id: recording.id,
                          dto: { note: note || null },
                        });
                      }}
                      placeholder={t("patientDetail.recording.notesPlaceholder")}
                      rows={4}
                      className="bg-background"
                    />
                  </div>

                  {/* Recording Data Section */}
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="font-semibold text-foreground mb-3">Recording Data</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Device Model:</span>
                        <span className="font-mono text-xs break-all text-right">{recording.metadata.deviceModel}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">S3 Key:</span>
                        <span className="font-mono text-xs break-all text-right">{recording.s3Key}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uploaded:</span>
                        <span className="font-medium">{new Date(recording.createdAt).toLocaleString("de-DE")}</span>
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
                        <span className="font-medium">{dateStr}</span>
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