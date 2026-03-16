import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, TrendingUp, AlertTriangle, CreditCard,
  Search, Download, Check, X, Loader2, FileText, FileSpreadsheet
} from "lucide-react";

interface Payment {
  id: string;
  student_id: string;
  plan_id: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  reference_month: string | null;
  notes: string | null;
}

interface Student {
  id: string;
  name: string;
  phone: string;
  status: string;
  plan_id: string | null;
  plans?: { name: string; price: number; duration_days: number } | null;
}

type PeriodFilter = "current" | "previous" | "quarter" | "custom";

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  paid: { label: "Pago", classes: "bg-primary/15 text-primary border-primary/30" },
  pending: { label: "Pendente", classes: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  overdue: { label: "Atrasado", classes: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelado", classes: "bg-muted text-muted-foreground border-border" },
};

const METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  transferencia: "Transferência",
};

const AdminFinanceiro = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [period, setPeriod] = useState<PeriodFilter>("current");
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pay modal
  const [payingPayment, setPayingPayment] = useState<Payment | null>(null);
  const [payMethod, setPayMethod] = useState("dinheiro");
  const [payAmount, setPayAmount] = useState("");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "current": return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
      case "previous": { const pm = subMonths(now, 1); return { start: format(startOfMonth(pm), "yyyy-MM-dd"), end: format(endOfMonth(pm), "yyyy-MM-dd") }; }
      case "quarter": return { start: format(startOfQuarter(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
      case "custom": return { start: customStart, end: customEnd };
    }
  }, [period, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [pRes, sRes] = await Promise.all([
      supabase.from("payments").select("*").gte("due_date", dateRange.start).lte("due_date", dateRange.end).order("due_date", { ascending: false }),
      supabase.from("students").select("id, name, phone, status, plan_id, plans(name, price, duration_days)").order("name"),
    ]);

    const paymentsData = (pRes.data || []) as Payment[];

    // Auto-update overdue
    const today = new Date().toISOString().split("T")[0];
    const toUpdate = paymentsData.filter(p => p.status === "pending" && p.due_date < today);
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(p =>
        supabase.from("payments").update({ status: "overdue" }).eq("id", p.id)
      ));
      toUpdate.forEach(p => { p.status = "overdue"; });
    }

    setPayments(paymentsData);
    setStudents((sRes.data || []) as unknown as Student[]);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach(s => { m[s.id] = s; });
    return m;
  }, [students]);

  // Filter payments
  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (searchTerm) {
        const student = studentMap[p.student_id];
        if (!student) return false;
        const q = searchTerm.toLowerCase();
        if (!student.name.toLowerCase().includes(q) && !student.phone.includes(searchTerm.replace(/\D/g, ""))) return false;
      }
      return true;
    });
  }, [payments, statusFilter, searchTerm, studentMap]);

  // KPIs
  const totalRevenue = useMemo(() => payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const totalPending = useMemo(() => payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const totalOverdue = useMemo(() => payments.filter(p => p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const activeCount = students.filter(s => s.status === "active").length;
  const ticketMedio = activeCount > 0 ? totalRevenue / activeCount : 0;
  const totalPayments = payments.filter(p => p.status !== "cancelled").length;
  const overdueRate = totalPayments > 0 ? (payments.filter(p => p.status === "overdue").length / totalPayments) * 100 : 0;

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
      toast({ title: "Erro ao registrar", variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado!" });
    setPayingPayment(null);
    loadData();
  };

  const handleCancel = async (id: string) => {
    await supabase.from("payments").update({ status: "cancelled" }).eq("id", id);
    toast({ title: "Pagamento cancelado" });
    loadData();
  };

  // Generate monthly payments
  const generatePayments = async () => {
    setGenerating(true);
    const activeStudents = students.filter(s => s.status === "active" && s.plan_id);
    const currentMonth = format(new Date(), "yyyy-MM");

    // Check existing payments for this month
    const { data: existing } = await supabase.from("payments").select("student_id").eq("reference_month", currentMonth);
    const existingIds = new Set((existing || []).map((e: any) => e.student_id));

    const toCreate = activeStudents.filter(s => !existingIds.has(s.id));

    if (toCreate.length === 0) {
      toast({ title: "Todas as mensalidades do mês já foram geradas" });
      setGenerating(false);
      return;
    }

    const paymentsToInsert = toCreate.map(s => ({
      student_id: s.id,
      plan_id: s.plan_id,
      amount: s.plans?.price || 0,
      due_date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
      reference_month: currentMonth,
      status: "pending",
    }));

    const { error } = await supabase.from("payments").insert(paymentsToInsert);
    if (error) {
      toast({ title: "Erro ao gerar mensalidades", variant: "destructive" });
    } else {
      toast({ title: `${toCreate.length} mensalidade(s) gerada(s)!` });
    }
    setGenerating(false);
    loadData();
  };

  // Export
  const exportCSV = () => {
    const headers = "Aluno,Plano,Valor,Vencimento,Status,Data Pgto,Método,Ref.\n";
    const rows = filtered.map(p => {
      const s = studentMap[p.student_id];
      return [
        s?.name || "—",
        s?.plans?.name || "—",
        Number(p.amount).toFixed(2),
        format(new Date(p.due_date), "dd/MM/yyyy"),
        STATUS_MAP[p.status]?.label || p.status,
        p.paid_date ? format(new Date(p.paid_date), "dd/MM/yyyy") : "—",
        p.payment_method ? (METHOD_LABELS[p.payment_method] || p.payment_method) : "—",
        p.reference_month || "—",
      ].join(",");
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${dateRange.start}_${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Period Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês Atual</SelectItem>
            <SelectItem value="previous">Mês Anterior</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-auto" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-auto" />
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="text-xs" onClick={generatePayments} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <DollarSign className="h-3.5 w-3.5 mr-1" />}
            Gerar Mensalidades
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={exportCSV}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Receita Total", value: `R$${totalRevenue.toFixed(2)}`, icon: DollarSign },
          { label: "A Receber", value: `R$${totalPending.toFixed(2)}`, icon: TrendingUp },
          { label: "Inadimplência", value: `R$${totalOverdue.toFixed(2)}`, icon: AlertTriangle },
          { label: "Ticket Médio", value: `R$${ticketMedio.toFixed(2)}`, icon: CreditCard },
          { label: "Taxa Inadimplência", value: `${overdueRate.toFixed(1)}%`, icon: AlertTriangle },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border/40">
            <CardContent className="p-4">
              <s.icon className="h-4 w-4 text-primary mb-1.5" />
              <p className="font-display text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Table */}
      <Card className="bg-card border-border/40 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Aluno</TableHead>
                <TableHead className="hidden sm:table-cell">Plano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Pgto</TableHead>
                <TableHead className="hidden lg:table-cell">Método</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum pagamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(p => {
                  const student = studentMap[p.student_id];
                  const st = STATUS_MAP[p.status] || STATUS_MAP.pending;
                  return (
                    <TableRow key={p.id} className="border-border/30">
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{student?.name || "—"}</span>
                          <span className="text-xs text-muted-foreground md:hidden block">
                            Venc. {format(new Date(p.due_date), "dd/MM")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                        {student?.plans?.name || "—"}
                      </TableCell>
                      <TableCell className="font-display font-semibold text-sm">
                        R${Number(p.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                        {format(new Date(p.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${st.classes}`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                        {p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                        {p.payment_method ? (METHOD_LABELS[p.payment_method] || p.payment_method) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(p.status === "pending" || p.status === "overdue") && (
                            <>
                              <Button
                                size="sm" variant="ghost" className="text-xs text-primary h-7 px-2"
                                onClick={() => {
                                  setPayingPayment(p);
                                  setPayAmount(String(p.amount));
                                  setPayMethod("dinheiro");
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="text-xs text-destructive h-7 px-2"
                                onClick={() => handleCancel(p.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground">
          {filtered.length} pagamento(s) · Receita: R${totalRevenue.toFixed(2)}
        </div>
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

export default AdminFinanceiro;
