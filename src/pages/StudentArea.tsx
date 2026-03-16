import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Calendar, TrendingUp, Clock, ArrowLeft } from "lucide-react";

interface Student {
  id: string;
  name: string;
  phone: string;
  status: string;
  enrollment_date: string;
  plans?: { name: string; duration_days: number } | null;
}

interface WorkoutWithTemplate {
  id: string;
  active: boolean;
  weekdays: string[] | null;
  notes: string | null;
  workout_templates: {
    id: string;
    name: string;
    category: string;
    target_muscles: string[];
    workout_exercises: {
      id: string;
      exercise_name: string;
      sets: number;
      reps: string;
      rest_seconds: number;
      notes: string | null;
      sort_order: number;
    }[];
  };
}

interface Assessment {
  id: string;
  assessment_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  right_arm_cm: number | null;
  left_arm_cm: number | null;
}

interface CheckinRecord {
  id: string;
  checked_in_at: string;
}

const StudentArea = () => {
  const { phone } = useParams<{ phone: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutWithTemplate[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) return;
    const load = async () => {
      const { data: st } = await supabase
        .from("students")
        .select("id, name, phone, status, enrollment_date, plans(name, duration_days)")
        .eq("phone", phone)
        .maybeSingle();

      if (!st) { setLoading(false); return; }
      setStudent(st as unknown as Student);

      const [wRes, aRes, cRes] = await Promise.all([
        supabase
          .from("student_workouts")
          .select("id, active, weekdays, notes, workout_templates(id, name, category, target_muscles, workout_exercises(id, exercise_name, sets, reps, rest_seconds, notes, sort_order))")
          .eq("student_id", st.id)
          .eq("active", true),
        supabase
          .from("assessments")
          .select("*")
          .eq("student_id", st.id)
          .order("assessment_date", { ascending: false })
          .limit(5),
        supabase
          .from("checkins")
          .select("id, checked_in_at")
          .eq("student_id", st.id)
          .order("checked_in_at", { ascending: false })
          .limit(30),
      ]);

      if (wRes.data) setWorkouts(wRes.data as unknown as WorkoutWithTemplate[]);
      if (aRes.data) setAssessments(aRes.data as Assessment[]);
      if (cRes.data) setCheckins(cRes.data as CheckinRecord[]);
      setLoading(false);
    };
    load();
  }, [phone]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Aluno não encontrado</h2>
        <p className="text-muted-foreground mb-6">Verifique o número de telefone ou procure a recepção.</p>
        <Link to="/checkin" className="text-primary hover:underline text-sm">Voltar ao check-in</Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-primary/20 text-primary",
    trial: "bg-blue-500/20 text-blue-400",
    frozen: "bg-yellow-500/20 text-yellow-400",
    inactive: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <div className="container py-6 px-4">
          <Link to="/checkin" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">{student.name}</h1>
              <p className="text-sm text-muted-foreground">{student.plans?.name || "Sem plano"}</p>
            </div>
            <Badge className={statusColors[student.status] || ""}>
              {student.status === "active" ? "Ativo" : student.status === "trial" ? "Trial" : student.status === "frozen" ? "Congelado" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container px-4 mt-6">
        <Tabs defaultValue="treino" className="space-y-6">
          <TabsList className="bg-card border border-border/50 w-full justify-start">
            <TabsTrigger value="treino" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Dumbbell className="h-4 w-4 mr-1" /> Treino
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="h-4 w-4 mr-1" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="h-4 w-4 mr-1" /> Avaliações
            </TabsTrigger>
          </TabsList>

          {/* Treino */}
          <TabsContent value="treino" className="space-y-4">
            {workouts.length === 0 ? (
              <Card className="bg-card border-border/50">
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum treino atribuído ainda.</p>
                  <p className="text-xs text-muted-foreground mt-1">Peça ao professor para montar seu treino.</p>
                </CardContent>
              </Card>
            ) : (
              workouts.map((w) => (
                <Card key={w.id} className="bg-card border-border/50 animate-fade-in">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-lg">
                        {w.workout_templates.name}
                      </CardTitle>
                      <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                        {w.workout_templates.category}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {w.workout_templates.target_muscles?.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {w.workout_templates.workout_exercises
                        ?.sort((a, b) => a.sort_order - b.sort_order)
                        .map((ex, idx) => (
                          <div key={ex.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                            <span className="font-display text-sm font-bold text-primary w-6 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{ex.exercise_name}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{ex.sets}x{ex.reps}</span>
                                {ex.rest_seconds && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {ex.rest_seconds}s
                                  </span>
                                )}
                              </div>
                              {ex.notes && <p className="text-xs text-muted-foreground mt-1 italic">{ex.notes}</p>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Histórico de check-ins */}
          <TabsContent value="historico">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-lg">Últimos check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                {checkins.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhum check-in registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {checkins.map((c) => {
                      const d = new Date(c.checked_in_at);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
                          <span>{d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
                          <span className="text-muted-foreground">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avaliações */}
          <TabsContent value="avaliacoes">
            {assessments.length === 0 ? (
              <Card className="bg-card border-border/50">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma avaliação registrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {assessments.map((a) => (
                  <Card key={a.id} className="bg-card border-border/50 animate-fade-in">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-base">
                        {new Date(a.assessment_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Peso", value: a.weight_kg, unit: "kg" },
                          { label: "Altura", value: a.height_cm, unit: "cm" },
                          { label: "% Gordura", value: a.body_fat_pct, unit: "%" },
                          { label: "Massa muscular", value: a.muscle_mass_kg, unit: "kg" },
                          { label: "Peitoral", value: a.chest_cm, unit: "cm" },
                          { label: "Cintura", value: a.waist_cm, unit: "cm" },
                          { label: "Quadril", value: a.hip_cm, unit: "cm" },
                          { label: "Braço D", value: a.right_arm_cm, unit: "cm" },
                          { label: "Braço E", value: a.left_arm_cm, unit: "cm" },
                        ].filter(m => m.value != null).map((m) => (
                          <div key={m.label} className="p-2 rounded-lg bg-secondary/50">
                            <p className="text-xs text-muted-foreground">{m.label}</p>
                            <p className="font-display text-lg font-bold">
                              {m.value}<span className="text-xs text-muted-foreground ml-0.5">{m.unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentArea;
