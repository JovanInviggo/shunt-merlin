import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronUp, Flag, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { useCreateStudy, useStudies } from "@/hooks/use-studies";
import { useRecordings } from "@/hooks/use-recordings";
type SortColumn = "studyId" | "vascularAccess" | "lastRecording" | "recordingCount" | "status" | "flaggedForReview";
type SortDirection = "asc" | "desc";
const Patients = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("studyId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: studies, isLoading: studiesLoading, error: studiesError } = useStudies();
  const { data: recordingsPage } = useRecordings(1, 100);
  const recordings = recordingsPage?.data;
  const createStudy = useCreateStudy();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    studyId: "",
    phone: "",
    vascularAccess: ""
  });
  const [studyIdError, setStudyIdError] = useState("");
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleAddPatient = async () => {
    if (!newPatient.studyId.trim()) {
      setStudyIdError(t("patients.add.studyId.required"));
      return;
    }

    const isDuplicate = patients.some(p => p.studyId.toLowerCase() === newPatient.studyId.toLowerCase());
    if (isDuplicate) {
      setStudyIdError(t("patients.add.studyId.duplicate"));
      return;
    }

    try {
      await createStudy.mutateAsync(newPatient.studyId.trim());
      setIsAddDialogOpen(false);
      setNewPatient({ studyId: "", phone: "", vascularAccess: "" });
      setStudyIdError("");
    } catch (err) {
      setStudyIdError((err as Error).message);
    }
  };
  const patients = useMemo(() => {
    if (!studies) return [];

    const recordingsByStudyId =
      recordings?.reduce<Record<string, Date[]>>((acc, rec) => {
        const created = new Date(rec.createdAt);
        (acc[rec.studyId] ||= []).push(created);
        return acc;
      }, {}) || {};

    return studies.map((study, index) => {
      const history = recordingsByStudyId[study.studyId] || [];
      const lastRecording =
        history.length > 0
          ? history
            .slice()
            .sort((a, b) => b.getTime() - a.getTime())[0]
            .toLocaleDateString("de-DE")
          : "";

      return {
        id: study.id ?? index,
        studyId: study.studyId,
        phone: "",
        vascularAccess: "",
        lastRecording,
        recordingCount: history.length,
        status: study.isActive ? "Active" : "Inactive",
        flaggedForReview: false,
      };
    });
  }, [studies, recordings]);

  const filteredPatients = patients.filter(patient =>
    patient.studyId.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    switch (sortColumn) {
      case "studyId":
        aValue = a.studyId;
        bValue = b.studyId;
        break;
      case "vascularAccess":
        aValue = a.vascularAccess;
        bValue = b.vascularAccess;
        break;
      case "lastRecording":
        aValue = new Date(a.lastRecording).getTime();
        bValue = new Date(b.lastRecording).getTime();
        break;
      case "recordingCount":
        aValue = a.recordingCount;
        bValue = b.recordingCount;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "flaggedForReview":
        aValue = a.flaggedForReview ? 1 : 0;
        bValue = b.flaggedForReview ? 1 : 0;
        break;
    }
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  if (studiesLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading patients...
      </div>
    );
  }

  if (studiesError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Failed to load patients.</p>
        <p className="text-xs mt-2">
          {(studiesError as Error).message}
        </p>
      </div>
    );
  }

  return <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        {t("patients.title")}
      </h2>

    </div>

    <div className="flex items-center justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("patients.search.placeholder")}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setStudyIdError("");
        }
      }}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("patients.add.button")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("patients.add.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("patients.add.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="studyId">
                {t("patients.add.studyId.label")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="studyId"
                value={newPatient.studyId}
                onChange={(e) => {
                  setNewPatient({ ...newPatient, studyId: e.target.value });
                  setStudyIdError("");
                }}
                placeholder="P001"
                className={studyIdError ? "border-destructive" : ""}
              />
              {studyIdError && (
                <p className="text-sm text-destructive">{studyIdError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("patients.add.phone.label")}</Label>
              <Input
                id="phone"
                type="tel"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                placeholder="0160 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vascularAccess">{t("patients.add.vascularAccess.label")}</Label>
              <Input
                id="vascularAccess"
                value={newPatient.vascularAccess}
                onChange={(e) => setNewPatient({ ...newPatient, vascularAccess: e.target.value })}
                placeholder="Unterarm links"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setStudyIdError("");
            }}>
              {t("patients.add.cancel")}
            </Button>
            <Button onClick={handleAddPatient} disabled={createStudy.isPending}>
              {t("patients.add.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <div className="rounded-lg border bg-card">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("studyId")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.studyId")}
                  {sortColumn === "studyId" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("lastRecording")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.lastRecording")}
                  {sortColumn === "lastRecording" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("recordingCount")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.totalRecordings")}
                  {sortColumn === "recordingCount" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("vascularAccess")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.vascularAccess")}
                  {sortColumn === "vascularAccess" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.status")}
                  {sortColumn === "status" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-accent/50 transition-colors bg-muted/50" onClick={() => handleSort("flaggedForReview")}>
                <div className="flex items-center gap-2">
                  {t("patients.table.review")}
                  {sortColumn === "flaggedForReview" ? sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 opacity-0" />}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPatients.map(patient => <TableRow key={patient.id} className="hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate(`/patients/${patient.id}`)}>
              <TableCell className="font-bold">
                {patient.studyId}
              </TableCell>
              <TableCell>{patient.lastRecording}</TableCell>
              <TableCell>
                {patient.recordingCount}
              </TableCell>
              <TableCell>{patient.vascularAccess}</TableCell>
              <TableCell>
                <Badge className="bg-success/10 text-success hover:bg-success/20">
                  {t("patients.table.status.active")}
                </Badge>
              </TableCell>
              <TableCell>
                {patient.flaggedForReview && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Flag className="h-4 w-4 text-warning fill-warning" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("patients.table.flagged.tooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  </div>;
};
export default Patients;