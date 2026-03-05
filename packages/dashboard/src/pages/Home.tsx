import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Play, Pause, RotateCcw, Tag, Plus, X, Download } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WaveformChart } from "@/components/WaveformChart";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useStudies } from "@/hooks/use-studies";
import { useRecordings } from "@/hooks/use-recordings";

const COLORS = [
  "hsl(220, 90%, 56%)",
  "hsl(340, 82%, 52%)",
  "hsl(160, 84%, 39%)",
  "hsl(280, 65%, 60%)",
];

const getInitials = (studyId: string) => {
  return studyId.length >= 2 ? studyId.substring(0, 2).toUpperCase() : studyId.toUpperCase();
};
const Home = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const { t } = useI18n();
  const { data: studies } = useStudies();
  const { data: recordings, isLoading: recordingsLoading, error: recordingsError } = useRecordings();
  const [selectedRecording, setSelectedRecording] = useState<number | null>(null);
  const [classifications, setClassifications] = useState<{
    [key: number]: string;
  }>({
    1: "normal",
    2: "normal",
    3: "normal",
    4: "normal"
  });
  const [recordingNotes, setRecordingNotes] = useState<{
    [key: number]: string;
  }>({});
  const [recordingTags, setRecordingTags] = useState<{
    [key: number]: string[];
  }>({
    1: ["First Recording", "Baseline"],
    2: ["Follow-up"]
  });
  const [newTag, setNewTag] = useState("");
  const [reviewedStatus, setReviewedStatus] = useState<{
    [key: string]: boolean;
  }>({});

  const recentRecordings = useMemo(() => {
    if (!recordings) return [];
    const sorted = [...recordings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 4).map((rec, index) => {
      const created = new Date(rec.createdAt);
      return {
        id: rec.id,
        studyId: rec.studyId,
        recordingDate: created.toLocaleString("de-DE"),
        duration: "45s",
        status: "new",
        avatarColor: COLORS[index % COLORS.length],
      };
    });
  }, [recordings]);
  const exportAllData = () => {
    try {
      // Combine all data sources into a flat structure
      const exportData: any[] = [];

      // Create a map of recordings by study ID
      const recordingsByStudyId: {
        [key: string]: any[];
      } = {};
      recentRecordings.forEach(rec => {
        if (!recordingsByStudyId[rec.studyId]) {
          recordingsByStudyId[rec.studyId] = [];
        }
        recordingsByStudyId[rec.studyId].push({
          ...rec,
          classification: classifications[rec.id] || "unclassified",
          notes: recordingNotes[rec.id] || "",
          tags: (recordingTags[rec.id] || []).join("; "),
          reviewed: reviewedStatus[rec.id] ? "Yes" : "No"
        });
      });

      // Combine all data for each patient
      (studies || []).forEach(study => {
        const patientRecordings = recordingsByStudyId[study.studyId] || [];

        // If patient has recordings, create rows for each
        if (patientRecordings.length > 0) {
          for (let i = 0; i < patientRecordings.length; i++) {
            const recording = patientRecordings[i];
            exportData.push({
              "Study ID": study.studyId,
              "Phone": "",
              "Vascular Access": "",
              "Patient Status": study.isActive ? "Active" : "Inactive",
              "Total Recordings": patientRecordings.length,
              "Recording Date": recording?.recordingDate || "",
              "Recording Duration": recording?.duration || "",
              "Recording Classification": recording?.classification || "",
              "Recording Notes": recording?.notes || "",
              "Recording Tags": recording?.tags || "",
              "Recording Reviewed": recording?.reviewed || ""
            });
          }
        } else {
          // Patient with no recordings
          exportData.push({
            "Study ID": study.studyId,
            "Phone": "",
            "Vascular Access": "",
            "Patient Status": study.isActive ? "Active" : "Inactive",
            "Total Recordings": 0,
            "Recording Date": "",
            "Recording Duration": "",
            "Recording Classification": "",
            "Recording Notes": "",
            "Recording Tags": "",
            "Recording Reviewed": ""
          });
        }
      });

      // Generate CSV
      const headers = Object.keys(exportData[0]);
      const csvContent = [headers.join(","), ...exportData.map(row => headers.map(header => {
        const value = row[header]?.toString() || "";
        // Escape quotes and wrap in quotes if contains comma or quotes
        const escaped = value.replace(/"/g, '""');
        return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n") ? `"${escaped}"` : escaped;
      }).join(","))].join("\n");

      // Trigger download
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `research-portal-export-${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: t("home.export.successTitle"),
        description: t("home.export.successDescription")
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("home.export.errorTitle"),
        description: t("home.export.errorDescription"),
        variant: "destructive"
      });
    }
  };

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
    setPlaybackProgress({
      ...playbackProgress,
      [recordingId]: 0
    });
    if (playingRecording === recordingId) {
      if (playbackIntervalRef.current[recordingId]) {
        clearInterval(playbackIntervalRef.current[recordingId]);
        delete playbackIntervalRef.current[recordingId];
      }
      setPlayingRecording(null);
    }
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
  const totalPatients = studies?.length ?? 0;
  const recordingsLast30Days = useMemo(() => {
    if (!recordings) return 0;
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    return recordings.filter(
      (r) => now - new Date(r.createdAt).getTime() <= THIRTY_DAYS,
    ).length;
  }, [recordings]);

  if (recordingsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (recordingsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Failed to load dashboard data.</p>
        <p className="text-xs mt-2">
          {(recordingsError as Error).message}
        </p>
      </div>
    );
  }

  return <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        {t("home.title")}
      </h2>

    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("home.totalPatients.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{totalPatients}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("home.totalPatients.subtitle")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("home.last30Days.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{recordingsLast30Days}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("home.last30Days.subtitle")}
          </p>
        </CardContent>
      </Card>


    </div>

    <Card>
      <CardHeader>
        <CardTitle>{t("home.newRecordings.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentRecordings.map(recording => <div key={recording.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => setSelectedRecording(recording.id)}>
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarFallback style={{
                  backgroundColor: recording.avatarColor
                }} className="text-white font-semibold">
                  {getInitials(recording.studyId)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">
                  {recording.studyId}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {recording.recordingDate}
                  </p>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-sm text-muted-foreground">
                    {recording.duration}
                  </p>
                </div>
              </div>
            </div>
          </div>)}
        </div>
      </CardContent>
    </Card>


    {/* Export Button */}
    <div className="flex justify-center pt-6 pb-8">
      <Button onClick={exportAllData} className="gap-2" size="lg">
        <Download className="h-5 w-5" />
        {t("home.export.button")}
      </Button>
    </div>

    {/* Recording Detail Side Panel */}
    <Sheet open={selectedRecording !== null} onOpenChange={open => !open && setSelectedRecording(null)}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none overflow-y-auto">
        {selectedRecording && (() => {
          const recording = recentRecordings.find(r => r.id === selectedRecording);
          if (!recording) return null;
          return <>
            <SheetHeader>
              <SheetTitle>{t("home.recording.detailsTitle")}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 pt-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback style={{
                    backgroundColor: recording.avatarColor
                  }} className="text-white font-semibold text-xs">
                    {getInitials(recording.studyId)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{recording.studyId}</span>
                <span className="text-muted-foreground">•</span>
                <span>
                  {recording.recordingDate} • {t("home.recording.vascularAccess.lastReview")} {recording.duration}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Audio Player */}
              <div className="space-y-3">
                <Label>{t("home.recording.audioPlayback")}</Label>
                <div className="h-40 bg-white rounded-lg border border-border overflow-hidden">
                  <WaveformChart height={160} progress={playbackProgress[recording.id] || 0} interactive={true} onSeek={progress => handleSeek(recording.id, progress)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button className="gap-2" onClick={() => handlePlayPause(recording.id)}>
                    {playingRecording === recording.id ? (
                      <>
                        <Pause className="h-4 w-4" />
                        {t("home.recording.pause")}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        {t("home.recording.play")}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleRestart(recording.id)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    {Math.round((playbackProgress[recording.id] || 0) * 45)}s / 45s
                  </span>
                </div>
              </div>

              {/* Classification */}
              <div className="space-y-2">
                <Label>{t("home.recording.classification")}</Label>
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
                    <SelectItem value="needs-review">
                      <Badge className="bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/20">
                        {t("home.recording.classification.needsReview")}
                      </Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags/Labels */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t("home.recording.tagsLabel")}
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(recordingTags[recording.id] || []).map((tag, index) => <Badge key={index} variant="secondary" className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(recording.id, tag)} />
                  </Badge>)}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("home.recording.newTagPlaceholder")}
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && handleAddTag(recording.id)}
                  />
                  <Button size="icon" onClick={() => handleAddTag(recording.id)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t("home.recording.notesLabel")}</Label>
                <Textarea
                  value={recordingNotes[recording.id] || ""}
                  onChange={e =>
                    setRecordingNotes({
                      ...recordingNotes,
                      [recording.id]: e.target.value
                    })
                  }
                  placeholder={t("home.recording.notesPlaceholder")}
                  rows={4}
                  className="bg-background"
                />
              </div>

              {/* Vascular Access Information */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-foreground mb-3">
                  {t("home.recording.vascularAccessTitle")}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("home.recording.vascularAccess.type")}
                    </span>
                    <span className="font-medium">AVF - Linker Arm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("home.recording.vascularAccess.location")}
                    </span>
                    <span className="font-medium">Linker Unterarm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("home.recording.vascularAccess.createdAt")}
                    </span>
                    <span className="font-medium">2024-03-15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("home.recording.vascularAccess.lastReview")}
                    </span>
                    <span className="font-medium">{recording.recordingDate}</span>
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
                    ? t("home.recording.reviewedButton.reviewed")
                    : t("home.recording.reviewedButton.markAsReviewed")}
                </Button>
              </div>
            </div>
          </>;
        })()}
      </SheetContent>
    </Sheet>
  </div>;
};
export default Home;