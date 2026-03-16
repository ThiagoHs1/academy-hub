import { useEffect, useState, useCallback } from "react";
import AdminTreinos from "@/components/admin/AdminTreinos";
import AdminAssessments from "@/components/admin/AdminAssessments";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminFinanceiro from "@/components/admin/AdminFinanceiro";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminConfig from "@/components/admin/AdminConfig";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dumbbell, Users, CreditCard, Plus, LogOut, Search,
  TrendingUp, UserPlus, DollarSign, Activity, Settings, BarChart3,
  Phone, MessageCircle, ChevronDown, CalendarIcon, X,
  Snowflake, UserX, UserCheck, Clock, ExternalLink, Edit2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───
interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

interface Student {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  gender: string | null;
  status: string;
  enrollment_date: string;
  plan_id: string | null;
  emergency_contact: string | null;
  notes: string | null;
  created_at: string;
  plans?: { name: string; price: number; duration_days: number } | null;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  reference_month: string | null;
}

interface CheckinRecord {
  id: string;
  checked_in_at: string;
  method: string;
}

interface WorkoutAssignment {
  id: string;
  active: boolean;
  workout_templates: { name: string; category: string } | null;
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

type AdminTab = "dashboard" | "alunos" | "treinos" | "financeiro" | "analytics" | "config";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  active: { label: "Ativo", classes: "bg-primary/15 text-primary border-primary/30" },
  trial: { label: "Trial", classes: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  frozen: { label: "Congelado", classes: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  inactive: { label: "Inativo", classes: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
};

const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};

const formatPhoneDisplay = (p: string) => {
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
  return p;
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Students tab state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [studentPayments, setStudentPayments] = useState<Record<string, Payment | null>>({});
  const [lastCheckins, setLastCheckins] = useState<Record<string, string | null>>({});

  // Student detail sheet
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailPayments, setDetailPayments] = useState<Payment[]>([]);
  const [detailCheckins, setDetailCheckins] = useState<CheckinRecord[]>([]);
  const [detailWorkouts, setDetailWorkouts] = useState<WorkoutAssignment[]>([]);
  const [detailAssessments, setDetailAssessments] = useState<Assessment[]>([]);
  const [editingStudent, setEditingStudent] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});

  // New student form
  const [newStudent, setNewStudent] = useState({
    name: "", phone: "", email: "", birth_date: null as Date | null,
    gender: "", plan_id: "", emergency_contact: "", notes: "",
  });

  // Dashboard stats
  const [todayCheckins, setTodayCheckins] = useState<{ id: string; checked_in_at: string; students: { name: string } | null }[]>([]);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/admin/login"); return; }
    loadData();
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/admin/login");
    });
    checkAuth();
    return () => subscription.unsubscribe();
  }, [checkAuth, navigate]);

  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [sRes, pRes, cRes] = await Promise.all([
      supabase.from("students").select("*, plans(name, price, duration_days)").order("name"),
      supabase.from("plans").select("*").eq("active", true).order("price"),
      supabase.from("checkins").select("*, students(name)").gte("checked_in_at", today + "T00:00:00").order("checked_in_at", { ascending: false }),
    ]);

    const studentsData = (sRes.data || []) as unknown as Student[];
    setStudents(studentsData);
    setPlans((pRes.data || []) as Plan[]);
    setTodayCheckins((cRes.data || []) as unknown as typeof todayCheckins);

    // Load latest payment per student and last checkin
    if (studentsData.length > 0) {
      const ids = studentsData.map(s => s.id);

      const [payRes, ckRes] = await Promise.all([
        supabase.from("payments").select("*").in("student_id", ids).order("due_date", { ascending: false }),
        supabase.from("checkins").select("student_id, checked_in_at").in("student_id", ids).order("checked_in_at", { ascending: false }),
      ]);

      const payMap: Record<string, Payment | null> = {};
      const ckMap: Record<string, string | null> = {};
      ids.forEach(id => { payMap[id] = null; ckMap[id] = null; });

      (payRes.data || []).forEach((p: any) => {
        if (!payMap[p.student_id]) payMap[p.student_id] = p;
      });

      (ckRes.data || []).forEach((c: any) => {
        if (!ckMap[c.student_id]) ckMap[c.student_id] = c.checked_in_at;
      });

      setStudentPayments(payMap);
      setLastCheckins(ckMap);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  // ─── New Student ───
  const handleAddStudent = async () => {
    const digits = newStudent.phone.replace(/\D/g, "");
    if (!newStudent.name.trim() || digits.length < 10) {
      toast({ title: "Preencha nome e telefone corretamente", variant: "destructive" });
      return;
    }

    const { data: student, error } = await supabase.from("students").insert({
      name: newStudent.name.trim(),
      phone: digits,
      email: newStudent.email.trim() || null,
      birth_date: newStudent.birth_date ? format(newStudent.birth_date, "yyyy-MM-dd") : null,
      gender: newStudent.gender || null,
      plan_id: newStudent.plan_id || null,
      emergency_contact: newStudent.emergency_contact.trim() || null,
      notes: newStudent.notes.trim() || null,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message.includes("unique") ? "Telefone já cadastrado." : error.message, variant: "destructive" });
      return;
    }

    // Create first payment
    if (student && newStudent.plan_id) {
      const plan = plans.find(p => p.id === newStudent.plan_id);
      if (plan) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await supabase.from("payments").insert({
          student_id: student.id,
          plan_id: plan.id,
          amount: plan.price,
          due_date: format(dueDate, "yyyy-MM-dd"),
          reference_month: format(new Date(), "yyyy-MM"),
        });
      }
    }

    toast({ title: "Aluno cadastrado com sucesso!" });
    setShowNewStudent(false);
    setNewStudent({ name: "", phone: "", email: "", birth_date: null, gender: "", plan_id: "", emergency_contact: "", notes: "" });
    loadData();
  };

  // ─── Student Detail ───
  const openStudentDetail = async (student: Student) => {
    setDetailStudent(student);
    setEditingStudent(false);
    setEditForm({});

    const [payRes, ckRes, wRes, aRes] = await Promise.all([
      supabase.from("payments").select("*").eq("student_id", student.id).order("due_date", { ascending: false }),
      supabase.from("checkins").select("id, checked_in_at, method").eq("student_id", student.id).order("checked_in_at", { ascending: false }).limit(30),
      supabase.from("student_workouts").select("id, active, workout_templates(name, category)").eq("student_id", student.id),
      supabase.from("assessments").select("*").eq("student_id", student.id).order("assessment_date", { ascending: false }),
    ]);

    setDetailPayments((payRes.data || []) as Payment[]);
    setDetailCheckins((ckRes.data || []) as CheckinRecord[]);
    setDetailWorkouts((wRes.data || []) as unknown as WorkoutAssignment[]);
    setDetailAssessments((aRes.data || []) as Assessment[]);
  };

  const updateStudentStatus = async (status: string) => {
    if (!detailStudent) return;
    await supabase.from("students").update({ status }).eq("id", detailStudent.id);
    toast({ title: `Status alterado para ${STATUS_CONFIG[status]?.label || status}` });
    setDetailStudent({ ...detailStudent, status });
    loadData();
  };

  const saveStudentEdit = async () => {
    if (!detailStudent) return;
    const { error } = await supabase.from("students").update(editForm).eq("id", detailStudent.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dados atualizados!" });
    setEditingStudent(false);
    setDetailStudent({ ...detailStudent, ...editForm } as Student);
    loadData();
  };

  const changePlan = async (planId: string) => {
    if (!detailStudent) return;
    await supabase.from("students").update({ plan_id: planId }).eq("id", detailStudent.id);
    const plan = plans.find(p => p.id === planId);
    toast({ title: `Plano alterado para ${plan?.name}` });
    loadData();
    // Refresh detail
    const { data } = await supabase.from("students").select("*, plans(name, price, duration_days)").eq("id", detailStudent.id).single();
    if (data) setDetailStudent(data as unknown as Student);
  };

  // ─── Filters ───
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm.replace(/\D/g, ""));
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;

    let matchesPayment = true;
    if (paymentFilter === "overdue") {
      const latestPay = studentPayments[s.id];
      matchesPayment = !!latestPay && latestPay.status !== "paid" && new Date(latestPay.due_date) < new Date();
    }

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Bulk actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const bulkWhatsapp = () => {
    const selected = students.filter(s => selectedIds.has(s.id));
    selected.forEach(s => {
      const msg = encodeURIComponent(
        `Olá ${s.name}! Lembramos que sua mensalidade na FitForge está pendente. Regularize na recepção ou entre em contato conosco. 💪`
      );
      window.open(`https://wa.me/55${s.phone}?text=${msg}`, "_blank");
    });
  };

  // Payment status helper
  const getPaymentStatus = (studentId: string) => {
    const p = studentPayments[studentId];
    if (!p) return null;
    if (p.status === "paid") return { label: "Em dia", classes: "bg-primary/15 text-primary border-primary/30" };
    const overdueDays = differenceInDays(new Date(), new Date(p.due_date));
    if (overdueDays > 0) return { label: `Atrasada ${overdueDays}d`, classes: "bg-destructive/15 text-destructive border-destructive/30" };
    return { label: "Pendente", classes: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
  };

  const getLastCheckinLabel = (studentId: string) => {
    const ck = lastCheckins[studentId];
    if (!ck) return "Nunca";
    const d = differenceInDays(new Date(), new Date(ck));
    if (d === 0) return "Hoje";
    if (d === 1) return "Ontem";
    return `${d}d atrás`;
  };

  // Stats
  const activeStudents = students.filter(s => s.status === "active").length;
  const overdueCount = students.filter(s => {
    const p = studentPayments[s.id];
    return p && p.status !== "paid" && new Date(p.due_date) < new Date();
  }).length;

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "alunos", label: "Alunos", icon: Users },
    { id: "treinos", label: "Treinos", icon: Dumbbell },
    { id: "financeiro", label: "Financeiro", icon: CreditCard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "config", label: "Configurações", icon: Settings },
  ];

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
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">FitForge</span>
            <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground ml-1 hidden sm:inline-flex">Admin</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
        {/* Tabs */}
        <div className="max-w-[1400px] mx-auto px-4 overflow-x-auto">
          <div className="flex gap-0.5 -mb-px min-w-max">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* ═══ DASHBOARD ═══ */}
        {activeTab === "dashboard" && <AdminDashboard />}

        {/* ═══ ALUNOS ═══ */}
        {activeTab === "alunos" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                    <SelectItem value="frozen">Congelados</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mensalidade: Todos</SelectItem>
                    <SelectItem value="overdue">Atrasadas</SelectItem>
                  </SelectContent>
                </Select>
                <Dialog open={showNewStudent} onOpenChange={setShowNewStudent}>
                  <DialogTrigger asChild>
                    <Button className="font-semibold shrink-0">
                      <UserPlus className="h-4 w-4 mr-1" /> Novo Aluno
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border/40 max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display text-xl">Cadastrar Aluno</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Nome completo *</label>
                          <Input value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="João Silva" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Telefone *</label>
                          <Input value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" maxLength={15} inputMode="tel" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Email</label>
                          <Input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="joao@email.com" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Data de Nascimento</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newStudent.birth_date && "text-muted-foreground")}>
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                {newStudent.birth_date ? format(newStudent.birth_date, "dd/MM/yyyy") : "Selecionar"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={newStudent.birth_date || undefined}
                                onSelect={(d) => setNewStudent({ ...newStudent, birth_date: d || null })}
                                disabled={(d) => d > new Date()}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Gênero</label>
                          <Select value={newStudent.gender} onValueChange={(v) => setNewStudent({ ...newStudent, gender: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Masculino</SelectItem>
                              <SelectItem value="F">Feminino</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Plano</label>
                          <Select value={newStudent.plan_id} onValueChange={(v) => setNewStudent({ ...newStudent, plan_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                            <SelectContent>
                              {plans.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name} — R${p.price}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Contato de emergência</label>
                          <Input value={newStudent.emergency_contact} onChange={(e) => setNewStudent({ ...newStudent, emergency_contact: e.target.value })} placeholder="Nome — Telefone" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Observações</label>
                          <Textarea value={newStudent.notes} onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })} placeholder="Lesões, restrições, objetivos..." rows={3} />
                        </div>
                      </div>
                      <Button onClick={handleAddStudent} className="w-full font-semibold h-11">Cadastrar Aluno</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
                <span className="text-sm font-medium">{selectedIds.size} aluno(s) selecionado(s)</span>
                <Button size="sm" variant="outline" className="text-xs" onClick={bulkWhatsapp}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> Lembrete de Mensalidade
                </Button>
                <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Students table */}
            <Card className="bg-card border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size > 0 && selectedIds.size === filteredStudents.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                      <TableHead className="hidden md:table-cell">Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Último Check-in</TableHead>
                      <TableHead className="hidden md:table-cell">Mensalidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          Nenhum aluno encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map(s => {
                        const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.inactive;
                        const ps = getPaymentStatus(s.id);
                        return (
                          <TableRow
                            key={s.id}
                            className="border-border/30 cursor-pointer hover:bg-secondary/30"
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                              openStudentDetail(s);
                            }}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(s.id)}
                                onCheckedChange={() => toggleSelect(s.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{s.name}</span>
                                <span className="text-xs text-muted-foreground sm:hidden block">{formatPhoneDisplay(s.phone)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden sm:table-cell text-sm">{formatPhoneDisplay(s.phone)}</TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell text-sm">{s.plans?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${st.classes}`}>{st.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">{getLastCheckinLabel(s.id)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {ps ? (
                                <Badge variant="outline" className={`text-[10px] ${ps.classes}`}>{ps.label}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground">
                {filteredStudents.length} aluno(s)
              </div>
            </Card>
          </div>
        )}

        {/* ═══ TREINOS ═══ */}
        {activeTab === "treinos" && <AdminTreinos />}

        {/* ═══ FINANCEIRO ═══ */}
        {activeTab === "financeiro" && <AdminFinanceiro />}

        {/* ═══ ANALYTICS ═══ */}
        {activeTab === "analytics" && <AdminAnalytics />}

        {/* ═══ CONFIGURAÇÕES (Placeholder) ═══ */}
        {activeTab === "config" && (
          <Card className="bg-card border-border/40">
            <CardContent className="py-20 text-center">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-display text-xl font-bold mb-1">Configurações</p>
              <p className="text-sm text-muted-foreground">Em construção — dados da academia, planos, horários.</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ═══ STUDENT DETAIL SHEET ═══ */}
      <Sheet open={!!detailStudent} onOpenChange={(open) => { if (!open) setDetailStudent(null); }}>
        <SheetContent className="bg-card border-border/40 w-full sm:max-w-lg overflow-y-auto p-0">
          {detailStudent && (
            <div>
              {/* Sheet Header */}
              <SheetHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="font-display text-xl">{detailStudent.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatPhoneDisplay(detailStudent.phone)}</p>
                  </div>
                  <Badge variant="outline" className={`${STATUS_CONFIG[detailStudent.status]?.classes}`}>
                    {STATUS_CONFIG[detailStudent.status]?.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <p className="text-xs text-muted-foreground flex-1">
                    {detailStudent.plans?.name || "Sem plano"} · Membro desde {format(new Date(detailStudent.enrollment_date), "dd/MM/yyyy")}
                  </p>
                </div>
              </SheetHeader>

              {/* Actions */}
              <div className="p-4 border-b border-border/40 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {detailStudent.status === "active" && (
                    <>
                      <Button size="sm" variant="outline" className="text-xs border-blue-400/30 text-blue-400 hover:bg-blue-400/10" onClick={() => updateStudentStatus("frozen")}>
                        <Snowflake className="h-3.5 w-3.5 mr-1" /> Congelar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground hover:bg-muted/20" onClick={() => updateStudentStatus("inactive")}>
                        <UserX className="h-3.5 w-3.5 mr-1" /> Inativar
                      </Button>
                    </>
                  )}
                  {(detailStudent.status === "inactive" || detailStudent.status === "frozen") && (
                    <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => updateStudentStatus("active")}>
                      <UserCheck className="h-3.5 w-3.5 mr-1" /> Reativar
                    </Button>
                  )}
                  <a href={`https://wa.me/55${detailStudent.phone}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs">
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                    setEditingStudent(true);
                    setEditForm({
                      name: detailStudent.name,
                      email: detailStudent.email,
                      emergency_contact: detailStudent.emergency_contact,
                      notes: detailStudent.notes,
                    });
                  }}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>

                {/* Plan changer */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Plano:</span>
                  <Select value={detailStudent.plan_id || ""} onValueChange={changePlan}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — R${p.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Edit form */}
              {editingStudent && (
                <div className="p-4 border-b border-border/40 space-y-3 bg-secondary/20 animate-fade-in">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Editar Dados</p>
                  <Input placeholder="Nome" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Input placeholder="Email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  <Input placeholder="Contato de emergência" value={editForm.emergency_contact || ""} onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} />
                  <Textarea placeholder="Observações" value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveStudentEdit} className="text-xs">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStudent(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Detail info */}
              {detailStudent.email && (
                <div className="px-4 py-3 border-b border-border/40 text-sm text-muted-foreground">
                  📧 {detailStudent.email}
                </div>
              )}
              {detailStudent.emergency_contact && (
                <div className="px-4 py-3 border-b border-border/40 text-sm text-muted-foreground">
                  🚨 {detailStudent.emergency_contact}
                </div>
              )}
              {detailStudent.notes && (
                <div className="px-4 py-3 border-b border-border/40 text-sm text-muted-foreground italic">
                  📝 {detailStudent.notes}
                </div>
              )}

              {/* Workouts */}
              <div className="p-4 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Treinos Atribuídos</p>
                {detailWorkouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum treino atribuído.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailWorkouts.map(w => (
                      <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-sm">
                        <span>{w.workout_templates?.name || "—"}</span>
                        <Badge variant={w.active ? "default" : "secondary"} className="text-[10px]">
                          {w.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Checkins */}
              <div className="p-4 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Check-ins (últimos 30)
                </p>
                {detailCheckins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum check-in.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detailCheckins.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm py-1.5">
                        <span className="text-muted-foreground">
                          {format(new Date(c.checked_in_at), "EEE, dd/MM", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.checked_in_at), "HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assessments */}
              <AdminAssessments
                studentId={detailStudent.id}
                assessments={detailAssessments}
                onRefresh={() => openStudentDetail(detailStudent)}
              />

              {/* Payments */}
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pagamentos</p>
                {detailPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailPayments.map(p => {
                      const payStatus: Record<string, { label: string; classes: string }> = {
                        paid: { label: "Pago", classes: "bg-primary/15 text-primary border-primary/30" },
                        pending: { label: "Pendente", classes: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
                        overdue: { label: "Atrasado", classes: "bg-destructive/15 text-destructive border-destructive/30" },
                        cancelled: { label: "Cancelado", classes: "bg-muted text-muted-foreground border-border" },
                      };
                      const ps = payStatus[p.status] || payStatus.pending;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-sm">
                          <div>
                            <span className="font-display font-semibold">R${Number(p.amount).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              Venc. {format(new Date(p.due_date), "dd/MM/yy")}
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${ps.classes}`}>{ps.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Admin;
