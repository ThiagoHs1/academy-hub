import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Activity, DollarSign, TrendingUp, MessageCircle,
  AlertTriangle, Clock, CreditCard, Check
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  phone: string;
  status: string;
  plan_id: string | null;
  plans?: { name: string; price: number } | null;
}

interface CheckinWithStudent {
  id: string;
  checked_in_at: string;
  students: { name: string } | null;
}

interface PaymentWithStudent {
  id: string;
  student_id: string;
  plan_id: string | null;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
  payment_method: string | null;
  reference_month: string | null;
}

const formatPhoneDisplay = (p: string) => {
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
  return p;
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [todayCheckins, setTodayCheckins] = useState<CheckinWithStudent[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentWithStudent[]>([]);
  const [lastCheckins, setLastCheckins] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  // Mark as paid modal
  const [payingPayment, setPayingPayment] = useState<PaymentWithStudent | null>(null);
  const [payMethod, setPayMethod] = useState("dinheiro");
  const [payAmount, setPayAmount] = useState("");

  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const monthStart = format(new Date(), "yyyy-MM-01");

    const [sRes, cRes, pRes] = await Promise.all([
      supabase.from("students").select("id, name, phone, status, plan_id, plans(name, price)").order("name"),
      supabase.from("checkins").select("id, checked_in_at, students(name)").gte("checked_in_at", today + "T00:00:00").order("checked_in_at", { ascending: false }),
      supabase.from("payments").select("*").order("due_date", { ascending: false }),
    ]);

    const studentsData = (sRes.data || []) as unknown as Student[];
    setStudents(studentsData);
    setTodayCheckins((cRes.data || []) as unknown as CheckinWithStudent[]);
    setAllPayments((pRes.data || []) as PaymentWithStudent[]);

    // last checkins per student
    if (studentsData.length > 0) {
      const ids = studentsData.map(s => s.id);
      const { data: ckData } = await supabase.from("checkins").select("student_id, checked_in_at").in("student_id", ids).order("checked_in_at", { ascending: false });
      const ckMap: Record<string, string | null> = {};
      ids.forEach(id => { ckMap[id] = null; });
      (ckData || []).forEach((c: any) => {
        if (!ckMap[c.student_id]) ckMap[c.student_id] = c.checked_in_at;
      });
      setLastCheckins(ckMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Realtime check-ins
    const channel = supabase
      .channel("dashboard-checkins")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, async (payload) => {
        const newCheckin = payload.new as any;
        const { data: student } = await supabase.from("students").select("name").eq("id", newCheckin.student_id).single();
        setTodayCheckins(prev => [{
          id: newCheckin.id,
          checked_in_at: newCheckin.checked_in_at,
          students: student ? { name: student.name } : null,
        }, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // KPIs
  const activeStudents = students.filter(s => s.status === "active").length;
  const monthStart = format(new Date(), "yyyy-MM-01");
  const monthRevenue = useMemo(() => {
    return allPayments
      .filter(p => p.status === "paid" && p.paid_date && p.paid_date >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [allPayments, monthStart]);
  const overdueCount = allPayments.filter(p => p.status === "overdue" || (p.status === "pending" && p.due_date < new Date().toISOString().split("T")[0])).length;

  // Absent students (active, no checkin in 7+ days)
  const absentStudents = useMemo(() => {
    const now = new Date();
    return students
      .filter(s => s.status === "active")
      .map(s => {
        const lastCk = lastCheckins[s.id];
        const daysSince = lastCk ? differenceInDays(now, new Date(lastCk)) : 999;
        return { ...s, lastCk, daysSince };
      })
      .filter(s => s.daysSince >= 7)
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [students, lastCheckins]);

  // Upcoming payments (next 7 days, pending)
  const today = new Date().toISOString().split("T")[0];
  const in7Days = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const upcomingPayments = useMemo(() => {
    return allPayments
      .filter(p => p.status === "pending" && p.due_date >= today && p.due_date <= in7Days)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [allPayments, today, in7Days]);

  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach(s => { m[s.id] = s; });
    return m;
  }, [students]);

  const handleMarkPaid = async () => {
    if (!payingPayment) return;
    const amount = payAmount ? parseFloat(payAmount) : payingPayment.amount;
    const { error } = await supabase.from("payments").update({
      status: "paid",
      paid_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: payMethod,
      amount,
    }).eq("id", payingPayment.id);

    if (error) {
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado!" });
    setPayingPayment(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Alunos Ativos", value: activeStudents, icon: Users, format: (v: number) => v.toString() },
          { label: "Check-ins Hoje", value: todayCheckins.length, icon: Activity, format: (v: number) => v.toString() },
          { label: "Mensalidades Atrasadas", value: overdueCount, icon: AlertTriangle, format: (v: number) => v.toString() },
          { label: "Receita do Mês", value: monthRevenue, icon: DollarSign, format: (v: number) => `R$${v.toFixed(2)}` },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border/40">
            <CardContent className="p-5">
              <s.icon className="h-5 w-5 text-primary mb-2" />
              <p className="font-display text-2xl font-bold">{s.format(s.value)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Absent Students */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Alunos Ausentes (7+ dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {absentStudents.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Todos os alunos estão frequentes! 🎉</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {absentStudents.slice(0, 20).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.lastCk
                          ? `Último treino: ${format(new Date(s.lastCk), "dd/MM", { locale: ptBR })} · ${s.daysSince}d sem vir`
                          : "Nunca fez check-in"
                        }
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/55${s.phone}?text=${encodeURIComponent("Sentimos sua falta na FitForge! Bora treinar? 💪")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost" className="text-xs shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Mensalidades Vencendo (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPayments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Nenhuma mensalidade vencendo esta semana.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {upcomingPayments.map(p => {
                  const student = studentMap[p.student_id];
                  const daysUntil = differenceInDays(new Date(p.due_date), new Date());
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          R${Number(p.amount).toFixed(2)} · {daysUntil === 0 ? "Vence hoje" : `Vence em ${daysUntil}d`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm" variant="ghost" className="text-xs text-primary"
                          onClick={() => {
                            setPayingPayment(p);
                            setPayAmount(String(p.amount));
                            setPayMethod("dinheiro");
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        {student && (
                          <a
                            href={`https://wa.me/55${student.phone}?text=${encodeURIComponent(`Olá ${student.name}! Sua mensalidade de R$${Number(p.amount).toFixed(2)} vence em ${daysUntil} dia(s). Regularize na recepção! 💪`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="text-xs">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Check-ins Feed */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Check-ins de Hoje
            </CardTitle>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 animate-pulse">
              Tempo real
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todayCheckins.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">Nenhum check-in hoje.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {todayCheckins.slice(0, 30).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 text-sm">
                  <span className="font-medium">{c.students?.name || "—"}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(c.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Paid Modal */}
      <Dialog open={!!payingPayment} onOpenChange={(open) => { if (!open) setPayingPayment(null); }}>
        <DialogContent className="bg-card border-border/40 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {payingPayment && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                {studentMap[payingPayment.student_id]?.name} — Venc. {format(new Date(payingPayment.due_date), "dd/MM/yyyy")}
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Método</label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleMarkPaid} className="w-full font-semibold">
                <CreditCard className="h-4 w-4 mr-1" /> Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
