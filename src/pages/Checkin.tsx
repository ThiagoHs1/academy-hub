import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, CheckCircle2, AlertCircle, Loader2, Clock,
  ArrowRight, CalendarCheck, XCircle, ChevronRight,
} from "lucide-react";

interface StudentWorkout {
  id: string;
  workout_templates: {
    name: string;
    category: string;
    target_muscles: string[];
    workout_exercises: {
      id: string;
      exercise_name: string;
      sets: number;
      reps: string;
      sort_order: number;
    }[];
  };
}

const WEEKDAYS_PT = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

const Checkin = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<
    | { type: "idle" }
    | { type: "error"; message: string }
    | { type: "already"; name: string; time: string }
    | {
        type: "success";
        name: string;
        time: string;
        workout: StudentWorkout | null;
        phoneDigits: string;
      }
  >({ type: "idle" });
  const navigate = useNavigate();

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "");
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const handleCheckin = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      setState({ type: "error", message: "Informe um telefone válido com DDD." });
      return;
    }

    setLoading(true);
    setState({ type: "idle" });

    // 1. Find student
    const { data: student } = await supabase
      .from("students")
      .select("id, name, status")
      .eq("phone", digits)
      .maybeSingle();

    if (!student) {
      setState({ type: "error", message: "Telefone não cadastrado. Fale com a recepção." });
      setLoading(false);
      return;
    }

    if (student.status === "inactive") {
      setState({ type: "error", message: "Sua matrícula está inativa. Regularize na recepção." });
      setLoading(false);
      return;
    }
    if (student.status === "frozen") {
      setState({ type: "error", message: "Sua matrícula está congelada. Regularize na recepção." });
      setLoading(false);
      return;
    }
    if (student.status !== "active" && student.status !== "trial") {
      setState({ type: "error", message: `Sua matrícula está com status "${student.status}". Fale com a recepção.` });
      setLoading(false);
      return;
    }

    // 2. Check for existing checkin today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: existingCheckin } = await supabase
      .from("checkins")
      .select("id, checked_in_at")
      .eq("student_id", student.id)
      .gte("checked_in_at", todayStart.toISOString())
      .lte("checked_in_at", todayEnd.toISOString())
      .limit(1)
      .maybeSingle();

    if (existingCheckin) {
      const t = new Date(existingCheckin.checked_in_at);
      setState({
        type: "already",
        name: student.name,
        time: t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
      setLoading(false);
      return;
    }

    // 3. Insert checkin
    const { error: insertError } = await supabase
      .from("checkins")
      .insert({ student_id: student.id, method: "link" });

    if (insertError) {
      setState({ type: "error", message: "Erro ao registrar check-in. Tente novamente." });
      setLoading(false);
      return;
    }

    // 4. Fetch today's workout
    const todayWeekday = WEEKDAYS_PT[new Date().getDay()];

    const { data: workouts } = await supabase
      .from("student_workouts")
      .select(
        "id, weekdays, workout_templates(name, category, target_muscles, workout_exercises(id, exercise_name, sets, reps, sort_order))"
      )
      .eq("student_id", student.id)
      .eq("active", true);

    // Find workout for today's weekday or fallback to any active
    let todayWorkout: StudentWorkout | null = null;
    if (workouts && workouts.length > 0) {
      const forToday = workouts.find(
        (w) => w.weekdays && w.weekdays.includes(todayWeekday)
      );
      todayWorkout = (forToday || workouts[0]) as unknown as StudentWorkout;
    }

    const now = new Date();
    setState({
      type: "success",
      name: student.name,
      time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      workout: todayWorkout,
      phoneDigits: digits,
    });
    setLoading(false);
  };

  const reset = () => {
    setState({ type: "idle" });
    setPhone("");
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(82_85%_55%/0.06),transparent)]" />
      </div>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 mb-10 relative">
        <Dumbbell className="h-9 w-9 text-primary" />
        <span className="font-display text-2xl font-bold tracking-tight">FitForge</span>
      </Link>

      <div className="w-full max-w-md relative">
        <AnimatePresence mode="wait">
          {/* ─── IDLE / ERROR STATE ─── */}
          {(state.type === "idle" || state.type === "error") && (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-card border-border/40">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <CalendarCheck className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="font-display text-3xl font-extrabold mb-1">Check-in</h1>
                    <p className="text-sm text-muted-foreground">Registre sua presença na academia</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Seu telefone
                      </label>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => {
                          setPhone(formatPhone(e.target.value));
                          if (state.type === "error") setState({ type: "idle" });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && !loading && handleCheckin()}
                        maxLength={15}
                        className="text-center text-xl font-display tracking-widest h-14 bg-secondary/50 border-border/50 focus:border-primary/50"
                        autoFocus
                        inputMode="tel"
                      />
                    </div>

                    <AnimatePresence>
                      {state.type === "error" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive font-medium">{state.message}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleCheckin}
                      disabled={loading || phone.replace(/\D/g, "").length < 10}
                      className="w-full h-14 text-lg font-bold glow"
                      size="lg"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Fazer Check-in
                          <ChevronRight className="h-5 w-5 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── ALREADY CHECKED IN ─── */}
          {state.type === "already" && (
            <motion.div
              key="already"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-card border-border/40">
                <CardContent className="p-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-5">
                    <Clock className="h-8 w-8 text-yellow-400" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold mb-2">
                    Já fez check-in hoje!
                  </h2>
                  <p className="text-muted-foreground mb-1">
                    <span className="text-foreground font-semibold">{state.name}</span>, você já registrou presença hoje às{" "}
                    <span className="text-primary font-semibold">{state.time}</span>.
                  </p>
                  <p className="text-2xl mt-3 mb-6">Bom treino! 💪</p>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={reset} className="flex-1 border-border/50">
                      Novo check-in
                    </Button>
                    <Link to={`/aluno/${phone.replace(/\D/g, "")}`} className="flex-1">
                      <Button className="w-full">Ver Treino</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── SUCCESS ─── */}
          {state.type === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-card border-primary/30 glow">
                <CardContent className="p-8">
                  {/* Success animation */}
                  <div className="text-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                      className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.25 }}
                      >
                        <CheckCircle2 className="h-12 w-12 text-primary" />
                      </motion.div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      <h2 className="font-display text-2xl font-extrabold mb-1">Check-in realizado!</h2>
                      <p className="text-lg text-foreground font-semibold">{state.name}</p>
                      <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{state.time} — {dateStr}</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Today's workout */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {state.workout ? (
                      <div className="rounded-xl bg-secondary/50 border border-border/40 p-5 mb-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                              Treino de hoje
                            </p>
                            <h3 className="font-display text-lg font-bold">
                              {state.workout.workout_templates.name}
                            </h3>
                          </div>
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs font-bold">
                            {state.workout.workout_templates.category}
                          </Badge>
                        </div>

                        {state.workout.workout_templates.target_muscles?.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mb-3">
                            {state.workout.workout_templates.target_muscles.map((m) => (
                              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          {state.workout.workout_templates.workout_exercises
                            ?.sort((a, b) => a.sort_order - b.sort_order)
                            .slice(0, 6)
                            .map((ex, idx) => (
                              <div
                                key={ex.id}
                                className="flex items-center gap-3 text-sm py-1.5"
                              >
                                <span className="font-display text-xs font-bold text-primary w-4 text-right">
                                  {idx + 1}
                                </span>
                                <span className="flex-1 text-muted-foreground">{ex.exercise_name}</span>
                                <span className="text-xs text-muted-foreground/60">
                                  {ex.sets}x{ex.reps}
                                </span>
                              </div>
                            ))}
                          {(state.workout.workout_templates.workout_exercises?.length ?? 0) > 6 && (
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              +{(state.workout.workout_templates.workout_exercises?.length ?? 0) - 6} exercícios
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-secondary/50 border border-border/40 p-5 mb-5 text-center">
                        <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                          Nenhum treino atribuído para hoje.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fale com seu personal!
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={reset} className="flex-1 border-border/50">
                        Novo check-in
                      </Button>
                      <Link to={`/aluno/${state.phoneDigits}`} className="flex-1">
                        <Button className="w-full font-bold">
                          {state.workout ? "Ver Treino Completo" : "Minha Área"}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Checkin;
