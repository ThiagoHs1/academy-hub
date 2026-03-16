import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dumbbell, Users, CreditCard, ClipboardCheck, Plus, LogOut, Search,
  TrendingUp, UserPlus, DollarSign, Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface Student {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  enrollment_date: string;
  plan_id: string | null;
  notes: string | null;
  plans?: { name: string } | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  reference_month: string | null;
  students?: { name: string; phone: string } | null;
}

interface CheckinRecord {
  id: string;
  checked_in_at: string;
  method: string;
  students?: { name: string } | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [todayCheckins, setTodayCheckins] = useState<CheckinRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // New student dialog
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", phone: "", email: "", plan_id: "", notes: "" });

  // New payment dialog
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ student_id: "", plan_id: "", amount: "", due_date: "", payment_method: "", reference_month: "" });

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/admin/login"); return; }
    loadData();
  }, [navigate]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [sRes, pRes, payRes, cRes] = await Promise.all([
      supabase.from("students").select("*, plans(name)").order("name"),
      supabase.from("plans").select("*").eq("active", true).order("price"),
      supabase.from("payments").select("*, students(name, phone)").order("due_date", { ascending: false }).limit(50),
      supabase.from("checkins").select("*, students(name)").gte("checked_in_at", today + "T00:00:00").order("checked_in_at", { ascending: false }),
    ]);

    if (sRes.data) setStudents(sRes.data as unknown as Student[]);
    if (pRes.data) setPlans(pRes.data as Plan[]);
    if (payRes.data) setPayments(payRes.data as unknown as Payment[]);
    if (cRes.data) setTodayCheckins(cRes.data as unknown as CheckinRecord[]);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const handleAddStudent = async () => {
    const digits = newStudent.phone.replace(/\D/g, "");
    if (!newStudent.name || !digits) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("students").insert({
      name: newStudent.name,
      phone: digits,
      email: newStudent.email || null,
      plan_id: newStudent.plan_id || null,
      notes: newStudent.notes || null,
    });

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Aluno cadastrado com sucesso!" });
    setShowNewStudent(false);
    setNewStudent({ name: "", phone: "", email: "", plan_id: "", notes: "" });
    loadData();
  };

  const handleAddPayment = async () => {
    if (!newPayment.student_id || !newPayment.amount || !newPayment.due_date) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("payments").insert({
      student_id: newPayment.student_id,
      plan_id: newPayment.plan_id || null,
      amount: parseFloat(newPayment.amount),
      due_date: newPayment.due_date,
      payment_method: newPayment.payment_method || null,
      reference_month: newPayment.reference_month || null,
    });

    if (error) {
      toast({ title: "Erro ao registrar pagamento", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Pagamento registrado!" });
    setShowNewPayment(false);
    setNewPayment({ student_id: "", plan_id: "", amount: "", due_date: "", payment_method: "", reference_month: "" });
    loadData();
  };

  const markPaymentPaid = async (id: string) => {
    await supabase.from("payments").update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    loadData();
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm.replace(/\D/g, ""))
  );

  const activeStudents = students.filter(s => s.status === "active").length;
  const pendingPayments = payments.filter(p => p.status === "pending").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">FitForge Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <div className="container px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border/50 mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="h-4 w-4 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4 mr-1" /> Alunos
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-1" /> Pagamentos
            </TabsTrigger>
            <TabsTrigger value="checkins" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardCheck className="h-4 w-4 mr-1" /> Check-ins
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Alunos Ativos", value: activeStudents, icon: Users, color: "text-primary" },
                { label: "Check-ins Hoje", value: todayCheckins.length, icon: ClipboardCheck, color: "text-primary" },
                { label: "Pagamentos Pendentes", value: pendingPayments, icon: DollarSign, color: "text-yellow-400" },
                { label: "Total Alunos", value: students.length, icon: TrendingUp, color: "text-primary" },
              ].map((stat) => (
                <Card key={stat.label} className="bg-card border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <p className="font-display text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent checkins */}
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-lg">Check-ins de Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                {todayCheckins.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhum check-in hoje.</p>
                ) : (
                  <div className="space-y-2">
                    {todayCheckins.slice(0, 10).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
                        <span className="font-medium">{c.students?.name || "—"}</span>
                        <span className="text-muted-foreground">
                          {new Date(c.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Students */}
          <TabsContent value="students" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar aluno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={showNewStudent} onOpenChange={setShowNewStudent}>
                <DialogTrigger asChild>
                  <Button className="font-semibold">
                    <UserPlus className="h-4 w-4 mr-1" /> Novo Aluno
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border/50">
                  <DialogHeader>
                    <DialogTitle className="font-display">Cadastrar Aluno</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Nome completo *" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} />
                    <Input placeholder="Telefone *" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} />
                    <Input placeholder="Email" type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} />
                    <Select value={newStudent.plan_id} onValueChange={(v) => setNewStudent({ ...newStudent, plan_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} - R${p.price}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Observações" value={newStudent.notes} onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })} />
                    <Button onClick={handleAddStudent} className="w-full font-semibold">Cadastrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-card border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => (
                    <TableRow key={s.id} className="border-border/50">
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{s.plans?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          s.status === "active" ? "border-primary/30 text-primary" :
                          s.status === "trial" ? "border-blue-400/30 text-blue-400" :
                          "border-destructive/30 text-destructive"
                        }>
                          {s.status === "active" ? "Ativo" : s.status === "trial" ? "Trial" : s.status === "frozen" ? "Congelado" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showNewPayment} onOpenChange={setShowNewPayment}>
                <DialogTrigger asChild>
                  <Button className="font-semibold">
                    <Plus className="h-4 w-4 mr-1" /> Novo Pagamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border/50">
                  <DialogHeader>
                    <DialogTitle className="font-display">Registrar Pagamento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Select value={newPayment.student_id} onValueChange={(v) => setNewPayment({ ...newPayment, student_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Aluno *" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newPayment.plan_id} onValueChange={(v) => {
                      const plan = plans.find(p => p.id === v);
                      setNewPayment({ ...newPayment, plan_id: v, amount: plan ? plan.price.toString() : "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} - R${p.price}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Valor *" type="number" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} />
                    <Input placeholder="Vencimento *" type="date" value={newPayment.due_date} onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })} />
                    <Select value={newPayment.payment_method} onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v })}>
                      <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="credit">Cartão Crédito</SelectItem>
                        <SelectItem value="debit">Cartão Débito</SelectItem>
                        <SelectItem value="transfer">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Mês referência (ex: 2026-03)" value={newPayment.reference_month} onChange={(e) => setNewPayment({ ...newPayment, reference_month: e.target.value })} />
                    <Button onClick={handleAddPayment} className="w-full font-semibold">Registrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-card border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Aluno</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="border-border/50">
                      <TableCell className="font-medium">{p.students?.name || "—"}</TableCell>
                      <TableCell className="font-display">R${Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.due_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          p.status === "paid" ? "border-primary/30 text-primary" :
                          p.status === "overdue" ? "border-destructive/30 text-destructive" :
                          "border-yellow-400/30 text-yellow-400"
                        }>
                          {p.status === "paid" ? "Pago" : p.status === "overdue" ? "Atrasado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.status === "pending" && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => markPaymentPaid(p.id)}>
                            Marcar Pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Checkins */}
          <TabsContent value="checkins">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-lg">Check-ins de Hoje ({todayCheckins.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {todayCheckins.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhum check-in registrado hoje.</p>
                ) : (
                  <div className="space-y-2">
                    {todayCheckins.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
                        <div>
                          <span className="font-medium">{c.students?.name || "—"}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">{c.method}</Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(c.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
