import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, ChevronDown, ChevronUp, TrendingDown, TrendingUp, ArrowDown, ArrowUp,
  Ruler, Scale, Activity
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface FullAssessment {
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

interface Props {
  studentId: string;
  assessments: FullAssessment[];
  onRefresh: () => void;
}

const IMI_CLASSES: { max: number; label: string; classes: string }[] = [
  { max: 18.5, label: "Abaixo do peso", classes: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  { max: 25, label: "Normal", classes: "bg-primary/15 text-primary border-primary/30" },
  { max: 30, label: "Sobrepeso", classes: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  { max: Infinity, label: "Obesidade", classes: "bg-destructive/15 text-destructive border-destructive/30" },
];

const getBmiInfo = (bmi: number) => IMI_CLASSES.find(c => bmi < c.max) || IMI_CLASSES[3];

const METRICS = [
  { key: "weight_kg" as const, label: "Peso", color: "hsl(var(--foreground))", unit: "kg" },
  { key: "body_fat_pct" as const, label: "% Gordura", color: "#ef4444", unit: "%" },
  { key: "muscle_mass_kg" as const, label: "Massa Muscular", color: "hsl(var(--primary))", unit: "kg" },
  { key: "waist_cm" as const, label: "Cintura", color: "#eab308", unit: "cm" },
];

const emptyForm = {
  assessment_date: format(new Date(), "yyyy-MM-dd"),
  weight_kg: "", height_cm: "", body_fat_pct: "", muscle_mass_kg: "",
  chest_cm: "", waist_cm: "", hip_cm: "",
  right_arm_cm: "", left_arm_cm: "",
  right_thigh_cm: "", left_thigh_cm: "",
  right_calf_cm: "", left_calf_cm: "",
  notes: "",
};

const AdminAssessments = ({ studentId, assessments, onRefresh }: Props) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(new Set(["weight_kg", "body_fat_pct", "muscle_mass_kg"]));
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const bmi = useMemo(() => {
    const w = parseFloat(form.weight_kg);
    const h = parseFloat(form.height_cm);
    if (!w || !h || h <= 0) return null;
    return w / Math.pow(h / 100, 2);
  }, [form.weight_kg, form.height_cm]);

  const handleSave = async () => {
    if (!form.weight_kg && !form.height_cm) {
      toast({ title: "Preencha pelo menos peso ou altura", variant: "destructive" });
      return;
    }
    setSaving(true);

    const numOrNull = (v: string) => v ? parseFloat(v) : null;

    const { error } = await supabase.from("assessments").insert({
      student_id: studentId,
      assessment_date: form.assessment_date,
      weight_kg: numOrNull(form.weight_kg),
      height_cm: numOrNull(form.height_cm),
      body_fat_pct: numOrNull(form.body_fat_pct),
      muscle_mass_kg: numOrNull(form.muscle_mass_kg),
      chest_cm: numOrNull(form.chest_cm),
      waist_cm: numOrNull(form.waist_cm),
      hip_cm: numOrNull(form.hip_cm),
      right_arm_cm: numOrNull(form.right_arm_cm),
      left_arm_cm: numOrNull(form.left_arm_cm),
      right_thigh_cm: numOrNull(form.right_thigh_cm),
      left_thigh_cm: numOrNull(form.left_thigh_cm),
      right_calf_cm: numOrNull(form.right_calf_cm),
      left_calf_cm: numOrNull(form.left_calf_cm),
      notes: form.notes.trim() || null,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avaliação registrada!" });
    setForm(emptyForm);
    setShowForm(false);
    onRefresh();
  };

  // Variation indicators
  const getVariation = (current: number | null, previous: number | null, invertGood = false) => {
    if (current == null || previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return null;
    const isDown = diff < 0;
    const isGood = invertGood ? !isDown : isDown;
    return { diff, isDown, isGood };
  };

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...assessments].reverse();
    const data = showAll ? sorted : sorted.slice(-5);
    return data.map(a => ({
      date: format(new Date(a.assessment_date), "dd/MM"),
      weight_kg: a.weight_kg,
      body_fat_pct: a.body_fat_pct,
      muscle_mass_kg: a.muscle_mass_kg,
      waist_cm: a.waist_cm,
    }));
  }, [assessments, showAll]);

  const toggleMetric = (key: string) => {
    const next = new Set(visibleMetrics);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisibleMetrics(next);
  };

  // Before/After comparison
  const first = assessments.length > 1 ? assessments[assessments.length - 1] : null;
  const last = assessments.length > 1 ? assessments[0] : null;

  const comparisonMetrics = first && last ? [
    { label: "Peso", first: first.weight_kg, last: last.weight_kg, unit: "kg", lowerIsBetter: true },
    { label: "Gordura", first: first.body_fat_pct, last: last.body_fat_pct, unit: "%", lowerIsBetter: true },
    { label: "Massa Muscular", first: first.muscle_mass_kg, last: last.muscle_mass_kg, unit: "kg", lowerIsBetter: false },
    { label: "Cintura", first: first.waist_cm, last: last.waist_cm, unit: "cm", lowerIsBetter: true },
  ].filter(m => m.first != null && m.last != null) : [];

  return (
    <div className="p-4 border-b border-border/40 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avaliação Física</p>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova Avaliação
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/40 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Nova Avaliação Física</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data</label>
                <Input type="date" value={form.assessment_date} onChange={e => setField("assessment_date", e.target.value)} />
              </div>

              {/* Weight + Height + BMI */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
                  <Input type="number" step="0.1" value={form.weight_kg} onChange={e => setField("weight_kg", e.target.value)} placeholder="80.5" inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Altura (cm)</label>
                  <Input type="number" value={form.height_cm} onChange={e => setField("height_cm", e.target.value)} placeholder="175" inputMode="numeric" />
                </div>
              </div>

              {/* IMC auto-calculated */}
              {bmi && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/40 animate-fade-in">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">IMC: {bmi.toFixed(1)}</span>
                  <Badge variant="outline" className={`text-[10px] ml-auto ${getBmiInfo(bmi).classes}`}>
                    {getBmiInfo(bmi).label}
                  </Badge>
                </div>
              )}

              {/* Body composition */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">% Gordura</label>
                  <Input type="number" step="0.1" value={form.body_fat_pct} onChange={e => setField("body_fat_pct", e.target.value)} placeholder="18.5" inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Massa Muscular (kg)</label>
                  <Input type="number" step="0.1" value={form.muscle_mass_kg} onChange={e => setField("muscle_mass_kg", e.target.value)} placeholder="35.0" inputMode="decimal" />
                </div>
              </div>

              {/* Measurements section */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" /> Medidas (cm)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "chest_cm", label: "Peitoral" },
                    { key: "waist_cm", label: "Cintura" },
                    { key: "hip_cm", label: "Quadril" },
                    { key: "right_arm_cm", label: "Braço D" },
                    { key: "left_arm_cm", label: "Braço E" },
                    { key: "right_thigh_cm", label: "Coxa D" },
                    { key: "left_thigh_cm", label: "Coxa E" },
                    { key: "right_calf_cm", label: "Panturrilha D" },
                    { key: "left_calf_cm", label: "Panturrilha E" },
                  ].map(m => (
                    <div key={m.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{m.label}</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={(form as any)[m.key]}
                        onChange={e => setField(m.key, e.target.value)}
                        placeholder="0.0"
                        inputMode="decimal"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Observações do avaliador</label>
                <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Observações, recomendações..." rows={3} />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full font-semibold h-11">
                {saving ? "Salvando..." : "Registrar Avaliação"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>
      ) : (
        <>
          {/* ── Chart ── */}
          {chartData.length >= 2 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {METRICS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => toggleMetric(m.key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                      visibleMetrics.has(m.key)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-border/40 text-muted-foreground hover:border-border ml-auto"
                >
                  {showAll ? "Últimas 5" : "Todas"}
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {METRICS.filter(m => visibleMetrics.has(m.key)).map(m => (
                      <Line
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        stroke={m.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: m.color }}
                        name={m.label}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Before & After ── */}
          {comparisonMetrics.length > 0 && first && last && (
            <Card className="bg-secondary/30 border-border/30">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Antes e Agora
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                  <span>{format(new Date(first.assessment_date), "dd/MM/yy")}</span>
                  <span className="flex-1 border-t border-border/30" />
                  <span>{format(new Date(last.assessment_date), "dd/MM/yy")}</span>
                </div>
                <div className="space-y-1.5">
                  {comparisonMetrics.map(m => {
                    const diff = m.last! - m.first!;
                    const improved = m.lowerIsBetter ? diff < 0 : diff > 0;
                    return (
                      <div key={m.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{m.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{m.first}{m.unit}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-xs font-medium">{m.last}{m.unit}</span>
                          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${improved ? "text-primary" : "text-destructive"}`}>
                            ({diff > 0 ? "+" : ""}{diff.toFixed(1)}{m.unit})
                            {improved ? "✓" : "⚠"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── History table ── */}
          <div className="space-y-1.5">
            {assessments.map((a, idx) => {
              const prev = idx < assessments.length - 1 ? assessments[idx + 1] : null;
              const expanded = expandedId === a.id;
              const bmiVal = a.weight_kg && a.height_cm ? a.weight_kg / Math.pow(a.height_cm / 100, 2) : null;

              const weightVar = getVariation(a.weight_kg, prev?.weight_kg ?? null, false);
              const fatVar = getVariation(a.body_fat_pct, prev?.body_fat_pct ?? null, false);
              const muscleVar = getVariation(a.muscle_mass_kg, prev?.muscle_mass_kg ?? null, true);

              return (
                <div key={a.id}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 text-sm hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(a.assessment_date), "dd/MM/yy")}
                      </span>
                      {a.weight_kg && (
                        <span className="flex items-center gap-1">
                          {a.weight_kg}kg
                          {weightVar && (
                            <span className={`text-[10px] ${weightVar.isGood ? "text-primary" : "text-destructive"}`}>
                              {weightVar.isDown ? "↓" : "↑"}
                            </span>
                          )}
                        </span>
                      )}
                      {bmiVal && (
                        <Badge variant="outline" className={`text-[9px] ${getBmiInfo(bmiVal).classes}`}>
                          IMC {bmiVal.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {a.body_fat_pct != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {a.body_fat_pct}%
                          {fatVar && (
                            <span className={`text-[10px] ${fatVar.isGood ? "text-primary" : "text-destructive"}`}>
                              {fatVar.isDown ? "↓" : "↑"}
                            </span>
                          )}
                        </span>
                      )}
                      {a.muscle_mass_kg != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {a.muscle_mass_kg}kg
                          {muscleVar && (
                            <span className={`text-[10px] ${muscleVar.isGood ? "text-primary" : "text-destructive"}`}>
                              {muscleVar.isDown ? "↓" : "↑"}
                            </span>
                          )}
                        </span>
                      )}
                      {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-3 py-2 bg-secondary/20 rounded-b-lg text-xs space-y-1.5 animate-fade-in -mt-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {a.height_cm && <div className="flex justify-between"><span className="text-muted-foreground">Altura</span><span>{a.height_cm} cm</span></div>}
                        {a.chest_cm && <div className="flex justify-between"><span className="text-muted-foreground">Peitoral</span><span>{a.chest_cm} cm</span></div>}
                        {a.waist_cm && <div className="flex justify-between"><span className="text-muted-foreground">Cintura</span><span>{a.waist_cm} cm</span></div>}
                        {a.hip_cm && <div className="flex justify-between"><span className="text-muted-foreground">Quadril</span><span>{a.hip_cm} cm</span></div>}
                        {a.right_arm_cm && <div className="flex justify-between"><span className="text-muted-foreground">Braço D</span><span>{a.right_arm_cm} cm</span></div>}
                        {a.left_arm_cm && <div className="flex justify-between"><span className="text-muted-foreground">Braço E</span><span>{a.left_arm_cm} cm</span></div>}
                        {a.right_thigh_cm && <div className="flex justify-between"><span className="text-muted-foreground">Coxa D</span><span>{a.right_thigh_cm} cm</span></div>}
                        {a.left_thigh_cm && <div className="flex justify-between"><span className="text-muted-foreground">Coxa E</span><span>{a.left_thigh_cm} cm</span></div>}
                        {a.right_calf_cm && <div className="flex justify-between"><span className="text-muted-foreground">Panturrilha D</span><span>{a.right_calf_cm} cm</span></div>}
                        {a.left_calf_cm && <div className="flex justify-between"><span className="text-muted-foreground">Panturrilha E</span><span>{a.left_calf_cm} cm</span></div>}
                      </div>
                      {a.notes && (
                        <p className="text-muted-foreground italic pt-1 border-t border-border/30">📝 {a.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAssessments;
