import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  Dumbbell, Calendar, TrendingUp, CreditCard, ArrowLeft, Clock,
  Play, ChevronDown, Flame, Target, Zap, CalendarDays,
} from "lucide-react";
import {
  format, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, subDays, isAfter, isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ───
interface Student {
  id: string;
  name: string;
  phone: string;
  status: string;
  enrollment_date: string;
  plan_id: string | null;
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
      video_url: string | null;
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
  right_thigh_cm: number | null;
  left_thigh_cm: number | null;
  right_calf_cm: number | null;
  left_calf_cm: number | null;
  notes: string | null;
}

interface CheckinRecord {
  id: string;
  checked_in_at: string;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  reference_month: string | null;
  payment_method: string | null;
}

const WEEKDAYS_PT = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const WEEKDAY_LABELS: Record<string, string> = {
  domingo: "Dom", segunda: "Seg", terca: "Ter", quarta: "Qua",
  quinta: "Qui", sexta: "Sex", sabado: "Sáb",
};

type TabType = "treino" | "frequencia" | "avaliacoes" | "pagamentos";

const StudentArea = () => {
  const { phone } = useParams<{ phone: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutWithTemplate[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("treino");
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [chartMetrics, setChartMetrics] = useState<Set<string>>(new Set(["weight_kg", "body_fat_pct"]));
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    const load = async () => {
      const { data: st } = await supabase
        .from("students")
        .select("id, name, phone, status, enrollment_date, plan_id, plans(name, duration_days)")
        .eq("phone", phone)
        .maybeSingle();

      if (!st) { setLoading(false); return; }
      setStudent(st as unknown as Student);

      const [wRes, aRes, cRes, pRes] = await Promise.all([
        supabase
          .from("student_workouts")
          .select("id, active, weekdays, notes, workout_templates(id, name, category, target_muscles, workout_exercises(id, exercise_name, sets, reps, rest_seconds, notes, sort_order, video_url))")
          .eq("student_id", st.id)
          .eq("active", true),
        supabase
          .from("assessments")
          .select("*")
          .eq("student_id", st.id)
          .order("assessment_date", { ascending: false }),
        supabase
          .from("checkins")
          .select("id, checked_in_at")
          .eq("student_id", st.id)
          .order("checked_in_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id, amount, due_date, paid_date, status, reference_month, payment_method")
          .eq("student_id", st.id)
          .order("due_date", { ascending: false }),
      ]);

      const wData = (wRes.data || []) as unknown as WorkoutWithTemplate[];
      setWorkouts(wData);
      if (aRes.data) setAssessments(aRes.data as Assessment[]);
      if (cRes.data) setCheckins(cRes.data as CheckinRecord[]);
      if (pRes.data) setPayments(pRes.data as Payment[]);

      // Auto-select today's workout or first
      const todayWeekday = WEEKDAYS_PT[new Date().getDay()];
      const todayW = wData.find(w => w.weekdays?.includes(todayWeekday));
      setSelectedWorkout(todayW?.id || wData[0]?.id || null);

      setLoading(false);
    };
    load();
  }, [phone]);

  // ─── Computed stats ───
  const memberDays = student?.enrollment_date
    ? differenceInDays(new Date(), new Date(student.enrollment_date))
    : 0;

  const lastCheckin = checkins[0]
    ? (() => {
        const d = differenceInDays(new Date(), new Date(checkins[0].checked_in_at));
        if (d === 0) return "Hoje";
        if (d === 1) return "Ontem";
        return `Há ${d} dias`;
      })()
    : "Nunca";

  // Frequency stats
  const frequencyStats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthCheckins = checkins.filter(
      c => !isBefore(new Date(c.checked_in_at), thisMonthStart)
    ).length;

    // Weekly average (last 4 weeks)
    const fourWeeksAgo = subDays(now, 28);
    const last4w = checkins.filter(c => !isBefore(new Date(c.checked_in_at), fourWeeksAgo)).length;
    const weeklyAvg = (last4w / 4).toFixed(1);

    // Current streak
    let streak = 0;
    let checkDay = new Date();
    checkDay.setHours(0, 0, 0, 0);
    const checkinDates = new Set(
      checkins.map(c => format(new Date(c.checked_in_at), "yyyy-MM-dd"))
    );

    // If didn't check in today, start from yesterday
    if (!checkinDates.has(format(checkDay, "yyyy-MM-dd"))) {
      checkDay = subDays(checkDay, 1);
    }
    while (checkinDates.has(format(checkDay, "yyyy-MM-dd"))) {
      streak++;
      checkDay = subDays(checkDay, 1);
    }

    // Best streak
    let bestStreak = 0;
    let currentRun = 0;
    const sortedDates = [...checkinDates].sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { currentRun = 1; }
      else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        if (differenceInDays(curr, prev) === 1) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }
      bestStreak = Math.max(bestStreak, currentRun);
    }

    return { thisMonth: thisMonthCheckins, weeklyAvg, streak, bestStreak };
  }, [checkins]);

  // Calendar days
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const checkinDates = new Set(
      checkins.map(c => format(new Date(c.checked_in_at), "yyyy-MM-dd"))
    );
    const startPad = getDay(monthStart);
    return { days, checkinDates, startPad };
  }, [calMonth, checkins]);

  // Chart data
  const chartData = useMemo(() => {
    return [...assessments].reverse().map(a => ({
      date: format(new Date(a.assessment_date), "dd/MM"),
      weight_kg: a.weight_kg,
      body_fat_pct: a.body_fat_pct,
      muscle_mass_kg: a.muscle_mass_kg,
    }));
  }, [assessments]);

  const toggleMetric = (metric: string) => {
    setChartMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  };

  const todayWeekday = WEEKDAYS_PT[new Date().getDay()];
  const currentWorkout = workouts.find(w => w.id === selectedWorkout);

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
        <h2 className="font-display text-2xl font-bold mb-2">Aluno não encontrado</h2>
        <p className="text-muted-foreground mb-6 text-sm">Verifique o número de telefone ou procure a recepção.</p>
        <Link to="/checkin">
          <Button variant="outline">Voltar ao check-in</Button>
        </Link>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; classes: string }> = {
    active: { label: "Ativo", classes: "bg-primary/15 text-primary border-primary/30" },
    trial: { label: "Trial", classes: "bg-blue-500/15 text-blue-400 border-blue-400/30" },
    frozen: { label: "Congelado", classes: "bg-amber-500/15 text-amber-400 border-amber-400/30" },
    inactive: { label: "Inativo", classes: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  const st = statusConfig[student.status] || statusConfig.inactive;

  const tabs: { id: TabType; label: string; icon: typeof Dumbbell }[] = [
    { id: "treino", label: "Treino", icon: Dumbbell },
    { id: "frequencia", label: "Frequência", icon: Calendar },
    { id: "avaliacoes", label: "Avaliações", icon: TrendingUp },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10">
      {/* ─── Header ─── */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container max-w-2xl py-4 px-4">
          <Link to="/checkin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-extrabold truncate">{student.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {student.plans?.name || "Sem plano"}
              </p>
            </div>
            <Badge variant="outline" className={`shrink-0 text-xs font-semibold ${st.classes}`}>
              {st.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-primary/60" />
              Membro há {memberDays} dias
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary/60" />
              Último treino: {lastCheckin}
            </span>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="container max-w-2xl px-4 hidden md:block">
          <div className="flex gap-1 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container max-w-2xl px-4 mt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ═══ TREINO ═══ */}
            {activeTab === "treino" && (
              <div className="space-y-4">
                {workouts.length === 0 ? (
                  <Card className="bg-card border-border/40">
                    <CardContent className="py-16 text-center">
                      <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-display text-lg font-bold mb-1">Nenhum treino atribuído</p>
                      <p className="text-sm text-muted-foreground">Peça ao professor para montar seu treino.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Workout selector */}
                    {workouts.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {workouts.map(w => {
                          const isToday = w.weekdays?.includes(todayWeekday);
                          const isSelected = w.id === selectedWorkout;
                          return (
                            <button
                              key={w.id}
                              onClick={() => setSelectedWorkout(w.id)}
                              className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border/40 text-muted-foreground hover:border-primary/30"
                              }`}
                            >
                              <span className="font-display">{w.workout_templates.category}</span>
                              {isToday && !isSelected && (
                                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                              )}
                              {isToday && isSelected && (
                                <span className="ml-1.5 text-[10px] font-bold">HOJE</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Workout detail */}
                    {currentWorkout && (
                      <Card className={`bg-card border-border/40 ${
                        currentWorkout.weekdays?.includes(todayWeekday) ? "border-primary/30 glow-sm" : ""
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="font-display text-lg">
                                {currentWorkout.workout_templates.name}
                              </CardTitle>
                              {currentWorkout.weekdays && currentWorkout.weekdays.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {currentWorkout.weekdays.map(d => (
                                    <Badge
                                      key={d}
                                      variant={d === todayWeekday ? "default" : "secondary"}
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      {WEEKDAY_LABELS[d] || d}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="border-primary/30 text-primary text-xs font-bold">
                              {currentWorkout.workout_templates.category}
                            </Badge>
                          </div>
                          {currentWorkout.workout_templates.target_muscles?.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mt-2">
                              {currentWorkout.workout_templates.target_muscles.map(m => (
                                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                              ))}
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {currentWorkout.workout_templates.workout_exercises
                            ?.sort((a, b) => a.sort_order - b.sort_order)
                            .map((ex, idx) => (
                              <div
                                key={ex.id}
                                className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/30"
                              >
                                <span className="font-display text-sm font-bold text-primary w-5 text-right shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{ex.exercise_name}</p>
                                    {ex.video_url && (
                                      <a href={ex.video_url} target="_blank" rel="noopener noreferrer">
                                        <Play className="h-3.5 w-3.5 text-primary hover:text-primary/80 transition-colors" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="font-display font-semibold text-foreground/80">
                                      {ex.sets} × {ex.reps}
                                    </span>
                                    {ex.rest_seconds > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="h-3 w-3" /> {ex.rest_seconds}s
                                      </span>
                                    )}
                                  </div>
                                  {ex.notes && (
                                    <p className="text-xs text-muted-foreground mt-1.5 italic leading-relaxed">
                                      💡 {ex.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          {currentWorkout.notes && (
                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-sm text-muted-foreground">
                              📝 {currentWorkout.notes}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══ FREQUÊNCIA ═══ */}
            {activeTab === "frequencia" && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Este mês", value: frequencyStats.thisMonth, icon: Calendar, suffix: "" },
                    { label: "Média semanal", value: frequencyStats.weeklyAvg, icon: Target, suffix: "" },
                    { label: "Sequência atual", value: frequencyStats.streak, icon: Flame, suffix: " dias" },
                    { label: "Melhor sequência", value: frequencyStats.bestStreak, icon: Zap, suffix: " dias" },
                  ].map(s => (
                    <Card key={s.label} className="bg-card border-border/40">
                      <CardContent className="p-4">
                        <s.icon className="h-4 w-4 text-primary mb-1.5" />
                        <p className="font-display text-2xl font-bold">{s.value}<span className="text-xs text-muted-foreground font-normal">{s.suffix}</span></p>
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Calendar */}
                <Card className="bg-card border-border/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setCalMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        ‹
                      </button>
                      <CardTitle className="font-display text-base capitalize">
                        {format(calMonth, "MMMM yyyy", { locale: ptBR })}
                      </CardTitle>
                      <button
                        onClick={() => {
                          const next = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1);
                          if (!isAfter(next, new Date())) setCalMonth(next);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        ›
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 mb-2">
                      {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                        <div key={i} className="text-center text-[11px] text-muted-foreground font-medium py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Days */}
                    <div className="grid grid-cols-7 gap-y-1">
                      {Array.from({ length: calendarData.startPad }).map((_, i) => (
                        <div key={`pad-${i}`} />
                      ))}
                      {calendarData.days.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const hasCheckin = calendarData.checkinDates.has(dateStr);
                        const isToday = isSameDay(day, new Date());
                        return (
                          <div key={dateStr} className="flex flex-col items-center py-1">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                                hasCheckin
                                  ? "bg-primary/20 text-primary font-bold"
                                  : isToday
                                    ? "bg-secondary text-foreground"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {format(day, "d")}
                            </div>
                            {hasCheckin && (
                              <div className="h-1 w-1 rounded-full bg-primary mt-0.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══ AVALIAÇÕES ═══ */}
            {activeTab === "avaliacoes" && (
              <div className="space-y-4">
                {assessments.length === 0 ? (
                  <Card className="bg-card border-border/40">
                    <CardContent className="py-16 text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-display text-lg font-bold mb-1">Nenhuma avaliação</p>
                      <p className="text-sm text-muted-foreground">Agende sua avaliação física com o professor.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Chart */}
                    {chartData.length >= 2 && (
                      <Card className="bg-card border-border/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-display text-base">Evolução</CardTitle>
                          <div className="flex gap-2 flex-wrap mt-2">
                            {[
                              { key: "weight_kg", label: "Peso (kg)", color: "hsl(82, 85%, 55%)" },
                              { key: "body_fat_pct", label: "% Gordura", color: "hsl(0, 84%, 60%)" },
                              { key: "muscle_mass_kg", label: "Massa (kg)", color: "hsl(210, 85%, 60%)" },
                            ].map(m => (
                              <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key)}
                                className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                                  chartMetrics.has(m.key)
                                    ? "border-current opacity-100"
                                    : "border-border/40 opacity-40"
                                }`}
                                style={{ color: m.color }}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 4%, 14%)" />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(240, 4%, 48%)" }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: "hsl(240, 4%, 48%)" }} tickLine={false} axisLine={false} width={35} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(240, 5%, 7.5%)",
                                  border: "1px solid hsl(240, 4%, 16%)",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                }}
                              />
                              {chartMetrics.has("weight_kg") && (
                                <Line type="monotone" dataKey="weight_kg" stroke="hsl(82, 85%, 55%)" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
                              )}
                              {chartMetrics.has("body_fat_pct") && (
                                <Line type="monotone" dataKey="body_fat_pct" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 3 }} name="% Gordura" />
                              )}
                              {chartMetrics.has("muscle_mass_kg") && (
                                <Line type="monotone" dataKey="muscle_mass_kg" stroke="hsl(210, 85%, 60%)" strokeWidth={2} dot={{ r: 3 }} name="Massa (kg)" />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Assessment cards */}
                    {assessments.map(a => {
                      const isOpen = expandedAssessment === a.id;
                      const measures = [
                        { label: "Peso", value: a.weight_kg, unit: "kg" },
                        { label: "Altura", value: a.height_cm, unit: "cm" },
                        { label: "% Gordura", value: a.body_fat_pct, unit: "%" },
                        { label: "Massa muscular", value: a.muscle_mass_kg, unit: "kg" },
                        { label: "Peitoral", value: a.chest_cm, unit: "cm" },
                        { label: "Cintura", value: a.waist_cm, unit: "cm" },
                        { label: "Quadril", value: a.hip_cm, unit: "cm" },
                        { label: "Braço D", value: a.right_arm_cm, unit: "cm" },
                        { label: "Braço E", value: a.left_arm_cm, unit: "cm" },
                        { label: "Coxa D", value: a.right_thigh_cm, unit: "cm" },
                        { label: "Coxa E", value: a.left_thigh_cm, unit: "cm" },
                        { label: "Panturrilha D", value: a.right_calf_cm, unit: "cm" },
                        { label: "Panturrilha E", value: a.left_calf_cm, unit: "cm" },
                      ].filter(m => m.value != null);

                      const summary = measures.slice(0, 3);
                      const rest = measures.slice(3);

                      return (
                        <Collapsible key={a.id} open={isOpen} onOpenChange={() => setExpandedAssessment(isOpen ? null : a.id)}>
                          <Card className="bg-card border-border/40">
                            <CollapsibleTrigger asChild>
                              <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-lg">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="font-display text-base">
                                    {format(new Date(a.assessment_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                  </CardTitle>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                </div>
                                {/* Summary always visible */}
                                <div className="flex gap-4 mt-2">
                                  {summary.map(m => (
                                    <div key={m.label}>
                                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                      <p className="font-display text-sm font-bold">
                                        {m.value}<span className="text-[10px] text-muted-foreground ml-0.5">{m.unit}</span>
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="pt-0">
                                <div className="grid grid-cols-3 gap-2">
                                  {rest.map(m => (
                                    <div key={m.label} className="p-2 rounded-lg bg-secondary/40">
                                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                      <p className="font-display text-sm font-bold">
                                        {m.value}<span className="text-[10px] text-muted-foreground ml-0.5">{m.unit}</span>
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                {a.notes && (
                                  <p className="text-sm text-muted-foreground mt-3 italic">📝 {a.notes}</p>
                                )}
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ═══ PAGAMENTOS ═══ */}
            {activeTab === "pagamentos" && (
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <Card className="bg-card border-border/40">
                    <CardContent className="py-16 text-center">
                      <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-display text-lg font-bold mb-1">Nenhum pagamento</p>
                      <p className="text-sm text-muted-foreground">Seus pagamentos aparecerão aqui.</p>
                    </CardContent>
                  </Card>
                ) : (
                  payments.map(p => {
                    const statusMap: Record<string, { label: string; classes: string }> = {
                      paid: { label: "Pago", classes: "bg-primary/15 text-primary border-primary/30" },
                      pending: { label: "Pendente", classes: "bg-amber-500/15 text-amber-400 border-amber-400/30" },
                      overdue: { label: "Atrasado", classes: "bg-destructive/15 text-destructive border-destructive/30" },
                      cancelled: { label: "Cancelado", classes: "bg-muted text-muted-foreground border-border/30" },
                    };
                    const ps = statusMap[p.status] || statusMap.pending;

                    return (
                      <Card key={p.id} className="bg-card border-border/40">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-display text-sm font-bold">
                              {p.reference_month || format(new Date(p.due_date), "MMM yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Vencimento: {format(new Date(p.due_date), "dd/MM/yyyy")}
                            </p>
                            {p.paid_date && (
                              <p className="text-xs text-muted-foreground">
                                Pago em: {format(new Date(p.paid_date), "dd/MM/yyyy")}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-display text-lg font-bold">R${Number(p.amount).toFixed(2)}</p>
                            <Badge variant="outline" className={`text-[10px] mt-1 ${ps.classes}`}>
                              {ps.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Pagamentos são realizados presencialmente na recepção.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Mobile Bottom Tabs ─── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/90 backdrop-blur-xl md:hidden z-50">
        <div className="flex">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                activeTab === t.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentArea;
