import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  format, subMonths, subDays, startOfMonth, endOfMonth,
  differenceInWeeks, parseISO, eachMonthOfInterval, startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Activity, TrendingUp, TrendingDown, DollarSign,
  FileSpreadsheet, Trophy, Clock, BarChart3, UserPlus, UserMinus
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

type PeriodFilter = "1m" | "3m" | "6m" | "12m" | "custom";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  "1m": "Mês Atual",
  "3m": "3 Meses",
  "6m": "6 Meses",
  "12m": "Ano",
  custom: "Personalizado",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_RANGES = [
  "06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"
];

const AdminAnalytics = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("3m");
  const [customStart, setCustomStart] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  // Raw data
  const [students, setStudents] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "1m": return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "3m": return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "6m": return { start: format(subMonths(now, 6), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "12m": return { start: format(subMonths(now, 12), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "custom": return { start: customStart, end: customEnd };
    }
  }, [period, customStart, customEnd]);

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const s = parseISO(dateRange.start);
    const e = parseISO(dateRange.end);
    const durationMs = e.getTime() - s.getTime();
    const prevEnd = new Date(s.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start: format(prevStart, "yyyy-MM-dd"), end: format(prevEnd, "yyyy-MM-dd") };
  }, [dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sRes, cRes, pRes, plRes] = await Promise.all([
      supabase.from("students").select("id, name, phone, status, plan_id, enrollment_date, created_at, plans(name, price)").order("name"),
      supabase.from("checkins").select("id, checked_in_at, student_id").gte("checked_in_at", prevRange.start + "T00:00:00").order("checked_in_at", { ascending: false }),
      supabase.from("payments").select("id, amount, due_date, paid_date, status, student_id, reference_month").gte("due_date", format(subMonths(new Date(), 12), "yyyy-MM-dd")).order("due_date", { ascending: false }),
      supabase.from("plans").select("id, name, price").eq("active", true),
    ]);
    setStudents(sRes.data || []);
    setCheckins(cRes.data || []);
    setPayments(pRes.data || []);
    setPlans(plRes.data || []);
    setLoading(false);
  }, [prevRange.start]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── KPIs ──
  const activeStudents = students.filter(s => s.status === "active").length;
  const inactiveStudents = students.filter(s => s.status === "inactive").length;

  const periodCheckins = useMemo(() =>
    checkins.filter(c => c.checked_in_at >= dateRange.start + "T00:00:00" && c.checked_in_at <= dateRange.end + "T23:59:59"),
    [checkins, dateRange]
  );
  const prevPeriodCheckins = useMemo(() =>
    checkins.filter(c => c.checked_in_at >= prevRange.start + "T00:00:00" && c.checked_in_at <= prevRange.end + "T23:59:59"),
    [checkins, prevRange]
  );

  const newEnrollments = useMemo(() =>
    students.filter(s => s.enrollment_date && s.enrollment_date >= dateRange.start && s.enrollment_date <= dateRange.end).length,
    [students, dateRange]
  );

  const cancellations = useMemo(() =>
    students.filter(s => s.status === "inactive").length, // simplified
    [students]
  );

  const periodPaidPayments = useMemo(() =>
    payments.filter(p => p.status === "paid" && p.paid_date && p.paid_date >= dateRange.start && p.paid_date <= dateRange.end),
    [payments, dateRange]
  );
  const mrr = useMemo(() => periodPaidPayments.reduce((s, p) => s + Number(p.amount), 0), [periodPaidPayments]);

  const prevPaidPayments = useMemo(() =>
    payments.filter(p => p.status === "paid" && p.paid_date && p.paid_date >= prevRange.start && p.paid_date <= prevRange.end),
    [payments, prevRange]
  );
  const prevMrr = useMemo(() => prevPaidPayments.reduce((s, p) => s + Number(p.amount), 0), [prevPaidPayments]);

  const retentionRate = activeStudents > 0 ? ((activeStudents / (activeStudents + inactiveStudents)) * 100) : 0;

  // ── Alunos ao Longo do Tempo (Area Chart) ──
  const studentsOverTime = useMemo(() => {
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    const months = eachMonthOfInterval({ start, end });
    return months.map(m => {
      const monthEnd = endOfMonth(m);
      const count = students.filter(s => {
        const enrolled = s.enrollment_date ? parseISO(s.enrollment_date) : parseISO(s.created_at);
        return enrolled <= monthEnd && (s.status === "active" || enrolled <= monthEnd);
      }).length;
      return { month: format(m, "MMM/yy", { locale: ptBR }), alunos: count };
    });
  }, [students, dateRange]);

  // ── Check-ins por Dia da Semana (Bar Chart) ──
  const checkinsByWeekday = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    periodCheckins.forEach(c => {
      const day = new Date(c.checked_in_at).getDay();
      counts[day]++;
    });
    return WEEKDAY_LABELS.map((label, i) => ({ day: label, checkins: counts[i] }));
  }, [periodCheckins]);

  // ── Horários de Pico (Bar Chart) ──
  const checkinsByHour = useMemo(() => {
    const counts: Record<string, number> = {};
    HOUR_RANGES.forEach(r => { counts[r] = 0; });
    periodCheckins.forEach(c => {
      const h = new Date(c.checked_in_at).getHours();
      if (h >= 6 && h < 8) counts["06-08"]++;
      else if (h >= 8 && h < 10) counts["08-10"]++;
      else if (h >= 10 && h < 12) counts["10-12"]++;
      else if (h >= 12 && h < 14) counts["12-14"]++;
      else if (h >= 14 && h < 16) counts["14-16"]++;
      else if (h >= 16 && h < 18) counts["16-18"]++;
      else if (h >= 18 && h < 20) counts["18-20"]++;
      else if (h >= 20 && h < 22) counts["20-22"]++;
    });
    const max = Math.max(...Object.values(counts));
    return HOUR_RANGES.map(r => ({ hora: r.replace("-", "-"), checkins: counts[r], isPeak: counts[r] === max && max > 0 }));
  }, [periodCheckins]);

  // ── Receita por Mês (Stacked Bar) ──
  const revenueByMonth = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date() });
    return months.map(m => {
      const mStr = format(m, "yyyy-MM");
      const paid = payments.filter(p => p.status === "paid" && p.paid_date && p.paid_date.startsWith(mStr)).reduce((s, p) => s + Number(p.amount), 0);
      const overdue = payments.filter(p => (p.status === "overdue" || (p.status === "pending" && p.due_date < format(new Date(), "yyyy-MM-dd"))) && p.due_date.startsWith(mStr)).reduce((s, p) => s + Number(p.amount), 0);
      return { month: format(m, "MMM/yy", { locale: ptBR }), recebido: paid, inadimplente: overdue };
    });
  }, [payments]);

  // ── Distribuição de Planos (Donut) ──
  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    students.filter(s => s.status === "active" && s.plan_id).forEach(s => {
      const planName = s.plans?.name || "Sem plano";
      counts[planName] = (counts[planName] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [students]);

  // ── Ranking de Frequência ──
  const frequencyRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    periodCheckins.forEach(c => {
      counts[c.student_id] = (counts[c.student_id] || 0) + 1;
    });
    const weeks = Math.max(1, differenceInWeeks(parseISO(dateRange.end), parseISO(dateRange.start)) || 1);
    return Object.entries(counts)
      .map(([id, total]) => {
        const student = students.find(s => s.id === id);
        return { id, name: student?.name || "—", total, avg: (total / weeks).toFixed(1) };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [periodCheckins, students, dateRange]);

  // ── Export CSV ──
  const exportCSV = () => {
    let csv = "Métrica,Valor\n";
    csv += `Alunos Ativos,${activeStudents}\n`;
    csv += `Novas Matrículas,${newEnrollments}\n`;
    csv += `Check-ins Período,${periodCheckins.length}\n`;
    csv += `Receita (MRR),R$${mrr.toFixed(2)}\n`;
    csv += `Taxa Retenção,${retentionRate.toFixed(1)}%\n\n`;
    csv += "Ranking Frequência\nPosição,Aluno,Check-ins,Média Semanal\n";
    frequencyRanking.forEach((r, i) => {
      csv += `${i + 1},${r.name},${r.total},${r.avg}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${dateRange.start}_${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ComparisonBadge = ({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) => {
    if (previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    const isGood = invert ? pct < 0 : pct > 0;
    return (
      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isGood ? "text-primary" : "text-destructive"}`}>
        {pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tooltipStyle = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
    },
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-auto" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-auto" />
          </div>
        )}
        <Button variant="outline" size="sm" className="text-xs ml-auto" onClick={exportCSV}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Alunos Ativos", value: activeStudents.toString(), sub: `${inactiveStudents} inativos`, icon: Users },
          { label: "Novas Matrículas", value: newEnrollments.toString(), icon: UserPlus },
          { label: "Cancelamentos", value: cancellations.toString(), icon: UserMinus },
          { label: "Taxa Retenção", value: `${retentionRate.toFixed(1)}%`, icon: TrendingUp },
          { label: "MRR", value: `R$${mrr.toFixed(0)}`, icon: DollarSign, comparison: <ComparisonBadge current={mrr} previous={prevMrr} /> },
          { label: "Check-ins", value: periodCheckins.length.toString(), icon: Activity, comparison: <ComparisonBadge current={periodCheckins.length} previous={prevPeriodCheckins.length} /> },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <s.icon className="h-4 w-4 text-primary" />
                {"comparison" in s && s.comparison}
              </div>
              <p className="font-display text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              {"sub" in s && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alunos ao Longo do Tempo */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Alunos ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studentsOverTime}>
                  <defs>
                    <linearGradient id="colorAlunos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="alunos" stroke="hsl(var(--primary))" fill="url(#colorAlunos)" strokeWidth={2} name="Alunos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Check-ins por Dia da Semana */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Check-ins por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checkinsByWeekday}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="checkins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Check-ins" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horários de Pico */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Horários de Pico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checkinsByHour}>
                  <XAxis dataKey="hora" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="checkins" name="Check-ins" radius={[4, 4, 0, 0]}>
                    {checkinsByHour.map((entry, index) => (
                      <Cell key={index} fill={entry.isPeak ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de Planos */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Distribuição de Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              {planDistribution.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center pt-16">Nenhum dado de plano.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {planDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receita por Mês */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Receita por Mês (últimos 12 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `R$${v}`} />
                <Tooltip {...tooltipStyle} formatter={(value: number) => `R$${value.toFixed(2)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recebido" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} name="Recebido" />
                <Bar dataKey="inadimplente" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Inadimplente" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Ranking de Frequência */}
      <Card className="bg-card border-border/40 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Ranking de Frequência
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-right">Check-ins</TableHead>
                <TableHead className="text-right">Média/Sem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {frequencyRanking.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum check-in no período.
                  </TableCell>
                </TableRow>
              ) : (
                frequencyRanking.map((r, i) => (
                  <TableRow key={r.id} className="border-border/30">
                    <TableCell className="font-display font-bold text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.name}</span>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[9px] bg-amber-400/15 text-amber-400 border-amber-400/30">
                            Mais Dedicado 🏆
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-display font-semibold">{r.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{r.avg}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
