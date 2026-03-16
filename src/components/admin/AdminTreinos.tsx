import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dumbbell, Plus, Trash2, ArrowUp, ArrowDown, Search, UserPlus,
  GripVertical, Play, ExternalLink, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ───
const MUSCLE_GROUPS = [
  "Peito", "Costas", "Ombro", "Bíceps", "Tríceps",
  "Quadríceps", "Posterior", "Glúteos", "Panturrilha", "Abdômen",
];

const CATEGORIES = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
  { value: "custom", label: "Personalizado" },
];

const WEEKDAYS = [
  { key: "segunda", label: "Seg" },
  { key: "terca", label: "Ter" },
  { key: "quarta", label: "Qua" },
  { key: "quinta", label: "Qui" },
  { key: "sexta", label: "Sex" },
  { key: "sabado", label: "Sáb" },
  { key: "domingo", label: "Dom" },
];

const COMMON_EXERCISES = [
  // Peito
  "Supino Reto com Barra", "Supino Inclinado com Halteres", "Supino Declinado",
  "Crucifixo na Máquina", "Crucifixo com Halteres", "Crossover", "Flexão de Braço",
  // Costas
  "Puxada Frontal", "Puxada Supinada", "Remada Curvada", "Remada Unilateral",
  "Pulldown", "Barra Fixa", "Remada Baixa", "Remada Cavalinho",
  // Ombro
  "Desenvolvimento com Halteres", "Desenvolvimento Militar", "Elevação Lateral",
  "Elevação Frontal", "Face Pull", "Encolhimento",
  // Bíceps
  "Rosca Direta com Barra", "Rosca Alternada", "Rosca Martelo",
  "Rosca Scott", "Rosca Concentrada", "Rosca no Cabo",
  // Tríceps
  "Tríceps Pulley", "Tríceps Testa", "Tríceps Francês",
  "Mergulho no Banco", "Mergulho em Paralelas", "Tríceps Corda",
  // Pernas
  "Agachamento Livre", "Agachamento Smith", "Leg Press 45°",
  "Cadeira Extensora", "Mesa Flexora", "Stiff", "Búlgaro",
  "Elevação Pélvica", "Abdução", "Adução",
  "Panturrilha no Smith", "Panturrilha Sentado",
  // Abdômen
  "Abdominal Crunch", "Prancha Isométrica", "Elevação de Pernas",
  "Crunch na Polia", "Abdominal Infra", "Prancha Lateral",
];

// ─── Types ───
interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  target_muscles: string[];
  is_global: boolean;
  created_at: string;
}

interface Exercise {
  id: string;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number | null;
  video_url: string | null;
}

interface StudentBasic {
  id: string;
  name: string;
  phone: string;
}

// ─── New exercise form defaults ───
const emptyExercise = (): Omit<Exercise, "id"> & { id?: string } => ({
  exercise_name: "",
  sets: 3,
  reps: "12",
  rest_seconds: 60,
  notes: "",
  sort_order: 0,
  video_url: "",
});

const AdminTreinos = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise[]>>({});
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editExercises, setEditExercises] = useState<(Exercise & { _isNew?: boolean })[]>([]);
  const [showEditor, setShowEditor] = useState(false);

  // New template state
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "", description: "", category: "A",
    target_muscles: [] as string[], is_global: true,
  });

  // Assign state
  const [showAssign, setShowAssign] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignWeekdays, setAssignWeekdays] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentBasic[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Delete confirmation
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null);

  // Exercise autocomplete
  const [exerciseSearchIdx, setExerciseSearchIdx] = useState<number | null>(null);
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("workout_templates")
      .select("*")
      .order("category")
      .order("name");

    const tpls = (data || []) as Template[];
    setTemplates(tpls);

    // Load exercises for all templates
    if (tpls.length > 0) {
      const { data: exData } = await supabase
        .from("workout_exercises")
        .select("*")
        .in("template_id", tpls.map(t => t.id))
        .order("sort_order");

      const map: Record<string, Exercise[]> = {};
      tpls.forEach(t => { map[t.id] = []; });
      (exData || []).forEach((e: any) => {
        if (map[e.template_id]) map[e.template_id].push(e);
        else map[e.template_id] = [e];
      });
      setExercises(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // ─── Create Template ───
  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      toast({ title: "Informe o nome do treino", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("workout_templates").insert({
      name: newTemplate.name.trim(),
      description: newTemplate.description.trim() || null,
      category: newTemplate.category,
      target_muscles: newTemplate.target_muscles,
      is_global: newTemplate.is_global,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Template criado!" });
    setShowNewTemplate(false);
    setNewTemplate({ name: "", description: "", category: "A", target_muscles: [], is_global: true });
    loadTemplates();

    // Open editor for the new template
    if (data) {
      setEditingTemplate(data as Template);
      setEditExercises([]);
      setShowEditor(true);
    }
  };

  // ─── Open Editor ───
  const openEditor = (template: Template) => {
    setEditingTemplate(template);
    setEditExercises([...(exercises[template.id] || [])]);
    setShowEditor(true);
  };

  // ─── Exercise Management ───
  const addExercise = () => {
    const newEx = {
      ...emptyExercise(),
      id: `new-${Date.now()}`,
      sort_order: editExercises.length + 1,
      _isNew: true,
    } as Exercise & { _isNew?: boolean };
    setEditExercises([...editExercises, newEx]);
  };

  const updateExercise = (idx: number, field: string, value: any) => {
    const updated = [...editExercises];
    (updated[idx] as any)[field] = value;
    setEditExercises(updated);

    // Autocomplete
    if (field === "exercise_name" && value.length >= 2) {
      setExerciseSearchIdx(idx);
      const lower = value.toLowerCase();
      setExerciseSuggestions(
        COMMON_EXERCISES.filter(e => e.toLowerCase().includes(lower)).slice(0, 6)
      );
    } else if (field === "exercise_name") {
      setExerciseSuggestions([]);
      setExerciseSearchIdx(null);
    }
  };

  const selectSuggestion = (idx: number, name: string) => {
    const updated = [...editExercises];
    updated[idx].exercise_name = name;
    setEditExercises(updated);
    setExerciseSuggestions([]);
    setExerciseSearchIdx(null);
  };

  const moveExercise = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= editExercises.length) return;
    const updated = [...editExercises];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((e, i) => { e.sort_order = i + 1; });
    setEditExercises(updated);
  };

  const removeExercise = async () => {
    if (!deleteExerciseId) return;
    const ex = editExercises.find(e => e.id === deleteExerciseId);
    if (ex && !(ex as any)._isNew) {
      await supabase.from("workout_exercises").delete().eq("id", ex.id);
    }
    setEditExercises(editExercises.filter(e => e.id !== deleteExerciseId));
    setDeleteExerciseId(null);
    toast({ title: "Exercício removido" });
  };

  // ─── Save All Exercises ───
  const saveExercises = async () => {
    if (!editingTemplate) return;

    for (let i = 0; i < editExercises.length; i++) {
      const ex = editExercises[i];
      if (!ex.exercise_name.trim()) {
        toast({ title: `Exercício ${i + 1}: informe o nome`, variant: "destructive" });
        return;
      }
    }

    // Delete removed exercises
    const existingIds = (exercises[editingTemplate.id] || []).map(e => e.id);
    const currentIds = editExercises.filter(e => !(e as any)._isNew).map(e => e.id);
    const toDelete = existingIds.filter(id => !currentIds.includes(id));
    if (toDelete.length > 0) {
      await supabase.from("workout_exercises").delete().in("id", toDelete);
    }

    // Upsert exercises
    for (let i = 0; i < editExercises.length; i++) {
      const ex = editExercises[i];
      const payload = {
        template_id: editingTemplate.id,
        exercise_name: ex.exercise_name.trim(),
        sets: ex.sets || null,
        reps: ex.reps?.trim() || null,
        rest_seconds: ex.rest_seconds || null,
        notes: ex.notes?.trim() || null,
        sort_order: i + 1,
        video_url: ex.video_url?.trim() || null,
      };

      if ((ex as any)._isNew) {
        await supabase.from("workout_exercises").insert(payload);
      } else {
        await supabase.from("workout_exercises").update(payload).eq("id", ex.id);
      }
    }

    toast({ title: "Exercícios salvos!" });
    setShowEditor(false);
    loadTemplates();
  };

  // ─── Delete Template ───
  const deleteTemplate = async (id: string) => {
    await supabase.from("workout_exercises").delete().eq("template_id", id);
    await supabase.from("student_workouts").delete().eq("template_id", id);
    await supabase.from("workout_templates").delete().eq("id", id);
    toast({ title: "Template excluído" });
    if (editingTemplate?.id === id) setShowEditor(false);
    loadTemplates();
  };

  // ─── Assign to Student ───
  const openAssign = async (templateId: string) => {
    setAssignTemplateId(templateId);
    setAssignWeekdays([]);
    setAssignStudentId("");
    setStudentSearch("");
    const { data } = await supabase
      .from("students")
      .select("id, name, phone")
      .eq("status", "active")
      .order("name");
    setStudents((data || []) as StudentBasic[]);
    setShowAssign(true);
  };

  const handleAssign = async () => {
    if (!assignStudentId || !assignTemplateId) {
      toast({ title: "Selecione um aluno", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("student_workouts").insert({
      student_id: assignStudentId,
      template_id: assignTemplateId,
      weekdays: assignWeekdays.length > 0 ? assignWeekdays : null,
      active: true,
    });

    if (error) {
      toast({ title: "Erro ao atribuir treino", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Treino atribuído com sucesso!" });
    setShowAssign(false);
  };

  const toggleMuscle = (muscle: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(muscle)) setter(current.filter(m => m !== muscle));
    else setter([...current, muscle]);
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.phone.includes(studentSearch.replace(/\D/g, ""))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Editor View ───
  if (showEditor && editingTemplate) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Editor header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>← Voltar</Button>
            <div>
              <h2 className="font-display text-xl font-bold">{editingTemplate.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="border-primary/30 text-primary text-xs">{editingTemplate.category}</Badge>
                {editingTemplate.target_muscles?.map(m => (
                  <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openAssign(editingTemplate.id)}>
              <UserPlus className="h-4 w-4 mr-1" /> Atribuir
            </Button>
            <Button size="sm" onClick={saveExercises} className="font-semibold">Salvar Exercícios</Button>
          </div>
        </div>

        {/* Exercise list */}
        <div className="space-y-3">
          {editExercises.length === 0 && (
            <Card className="bg-card border-border/40">
              <CardContent className="py-12 text-center">
                <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum exercício. Adicione o primeiro!</p>
              </CardContent>
            </Card>
          )}

          {editExercises.map((ex, idx) => (
            <Card key={ex.id} className="bg-card border-border/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <span className="font-display text-xs font-bold text-primary mb-1">{idx + 1}</span>
                    <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveExercise(idx, 1)} disabled={idx === editExercises.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="flex-1 space-y-3">
                    {/* Exercise name with autocomplete */}
                    <div className="relative">
                      <Input
                        placeholder="Nome do exercício"
                        value={ex.exercise_name}
                        onChange={(e) => updateExercise(idx, "exercise_name", e.target.value)}
                        className="font-medium"
                        onFocus={() => {
                          if (ex.exercise_name.length >= 2) {
                            setExerciseSearchIdx(idx);
                            setExerciseSuggestions(
                              COMMON_EXERCISES.filter(e => e.toLowerCase().includes(ex.exercise_name.toLowerCase())).slice(0, 6)
                            );
                          }
                        }}
                        onBlur={() => setTimeout(() => { setExerciseSuggestions([]); setExerciseSearchIdx(null); }, 150)}
                      />
                      {exerciseSearchIdx === idx && exerciseSuggestions.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {exerciseSuggestions.map(s => (
                            <button
                              key={s}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(idx, s); }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Séries</label>
                        <Input
                          type="number"
                          value={ex.sets || ""}
                          onChange={(e) => updateExercise(idx, "sets", parseInt(e.target.value) || null)}
                          className="h-9 text-sm"
                          min={1}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Repetições</label>
                        <Input
                          value={ex.reps || ""}
                          onChange={(e) => updateExercise(idx, "reps", e.target.value)}
                          placeholder="12 ou 8-12"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Descanso (s)</label>
                        <Input
                          type="number"
                          value={ex.rest_seconds || ""}
                          onChange={(e) => updateExercise(idx, "rest_seconds", parseInt(e.target.value) || null)}
                          className="h-9 text-sm"
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Notas / Dicas</label>
                        <Input
                          value={ex.notes || ""}
                          onChange={(e) => updateExercise(idx, "notes", e.target.value)}
                          placeholder="Ex: Manter escápulas retraídas"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Vídeo (URL)</label>
                        <div className="flex gap-1.5">
                          <Input
                            value={ex.video_url || ""}
                            onChange={(e) => updateExercise(idx, "video_url", e.target.value)}
                            placeholder="https://youtube.com/..."
                            className="h-9 text-sm"
                          />
                          {ex.video_url && (
                            <a href={ex.video_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
                    onClick={() => setDeleteExerciseId(ex.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addExercise} className="w-full border-dashed border-border/60 h-12">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Exercício
          </Button>
        </div>

        {/* Save footer */}
        {editExercises.length > 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button onClick={saveExercises} className="font-semibold">Salvar Todos</Button>
          </div>
        )}

        {/* Delete exercise confirmation */}
        <AlertDialog open={!!deleteExerciseId} onOpenChange={(open) => { if (!open) setDeleteExerciseId(null); }}>
          <AlertDialogContent className="bg-card border-border/40">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Excluir exercício?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={removeExercise} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Templates List View ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Templates de Treino</h2>
          <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
        </div>
        <Button onClick={() => setShowNewTemplate(true)} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="bg-card border-border/40">
          <CardContent className="py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-lg font-bold mb-1">Nenhum template</p>
            <p className="text-sm text-muted-foreground">Crie seu primeiro template de treino.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => {
            const exCount = exercises[t.id]?.length || 0;
            return (
              <Card
                key={t.id}
                className="bg-card border-border/40 hover:border-primary/25 transition-colors cursor-pointer group"
                onClick={() => openEditor(t)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="border-primary/30 text-primary font-bold text-xs">
                      {t.category}
                    </Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); openAssign(t.id); }}
                        title="Atribuir a aluno"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                        title="Excluir template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-display text-base font-bold mb-1">{t.name}</h3>
                  {t.target_muscles?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {t.target_muscles.map(m => (
                        <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{exCount} exercício(s)</span>
                    <span className="flex items-center gap-0.5 text-primary group-hover:translate-x-0.5 transition-transform">
                      Editar <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                  {t.is_global && (
                    <Badge variant="outline" className="text-[9px] border-border/40 text-muted-foreground mt-2">Global</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── New Template Dialog ─── */}
      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent className="bg-card border-border/40 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Novo Template de Treino</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome do Treino *</label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="Ex: Treino A — Peito e Tríceps"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Descrição breve do treino"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={newTemplate.is_global}
                    onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, is_global: !!checked })}
                  />
                  <span className="text-xs">Template global</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Músculos Alvo</label>
              <div className="flex gap-1.5 flex-wrap">
                {MUSCLE_GROUPS.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMuscle(m, newTemplate.target_muscles, (v) => setNewTemplate({ ...newTemplate, target_muscles: v }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      newTemplate.target_muscles.includes(m)
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-secondary/50 text-muted-foreground border-border/40 hover:border-primary/20"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateTemplate} className="w-full font-semibold h-11">
              Criar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Assign Dialog ─── */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="bg-card border-border/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Atribuir Treino a Aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Buscar aluno</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Nome ou telefone"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Aluno *</label>
              <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                <SelectTrigger><SelectValue placeholder="Selecionar aluno" /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Dias da semana</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => {
                      if (assignWeekdays.includes(d.key)) setAssignWeekdays(assignWeekdays.filter(w => w !== d.key));
                      else setAssignWeekdays([...assignWeekdays, d.key]);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      assignWeekdays.includes(d.key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 text-muted-foreground border-border/40 hover:border-primary/30"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAssign} className="w-full font-semibold h-11">
              Atribuir Treino
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTreinos;
