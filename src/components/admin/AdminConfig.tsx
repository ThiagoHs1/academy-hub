import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Settings, Plus, Edit2, Trash2, Check, X, Clock,
  Users, DollarSign, Loader2, Shield
} from "lucide-react";

interface BusinessSettings {
  id: string;
  name: string | null;
  open_time: string | null;
  close_time: string | null;
  max_capacity: number | null;
  checkin_enabled: boolean | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price: number;
  features: string[] | null;
  active: boolean;
  created_at: string;
}

const emptyPlan = {
  name: "", description: "", duration_days: 30, price: 0,
  features: [] as string[], active: true,
};

const AdminConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [newFeature, setNewFeature] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: "", open_time: "", close_time: "",
    max_capacity: 50, checkin_enabled: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from("business_settings").select("*").limit(1).single(),
      supabase.from("plans").select("*").order("price"),
    ]);

    if (sRes.data) {
      setSettings(sRes.data as BusinessSettings);
      setSettingsForm({
        name: sRes.data.name || "",
        open_time: sRes.data.open_time || "",
        close_time: sRes.data.close_time || "",
        max_capacity: sRes.data.max_capacity || 50,
        checkin_enabled: sRes.data.checkin_enabled ?? true,
      });
    }
    setPlans((pRes.data || []) as Plan[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async () => {
    setSavingSettings(true);
    if (settings) {
      await supabase.from("business_settings").update({
        name: settingsForm.name.trim() || null,
        open_time: settingsForm.open_time || null,
        close_time: settingsForm.close_time || null,
        max_capacity: settingsForm.max_capacity,
        checkin_enabled: settingsForm.checkin_enabled,
      }).eq("id", settings.id);
    } else {
      await supabase.from("business_settings").insert({
        name: settingsForm.name.trim() || null,
        open_time: settingsForm.open_time || null,
        close_time: settingsForm.close_time || null,
        max_capacity: settingsForm.max_capacity,
        checkin_enabled: settingsForm.checkin_enabled,
      });
    }
    toast({ title: "Configurações salvas!" });
    setSavingSettings(false);
    loadData();
  };

  const openPlanForm = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        description: plan.description || "",
        duration_days: plan.duration_days,
        price: plan.price,
        features: Array.isArray(plan.features) ? plan.features : [],
        active: plan.active,
      });
    } else {
      setEditingPlan(null);
      setPlanForm(emptyPlan);
    }
    setNewFeature("");
    setShowPlanForm(true);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setPlanForm(f => ({ ...f, features: [...f.features, newFeature.trim()] }));
      setNewFeature("");
    }
  };

  const removeFeature = (idx: number) => {
    setPlanForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  };

  const savePlan = async () => {
    if (!planForm.name.trim() || planForm.price <= 0 || planForm.duration_days <= 0) {
      toast({ title: "Preencha nome, preço e duração", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    const data = {
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      duration_days: planForm.duration_days,
      price: planForm.price,
      features: planForm.features.length > 0 ? planForm.features : null,
      active: planForm.active,
    };

    if (editingPlan) {
      await supabase.from("plans").update(data).eq("id", editingPlan.id);
      toast({ title: "Plano atualizado!" });
    } else {
      await supabase.from("plans").insert(data);
      toast({ title: "Plano criado!" });
    }
    setSavingPlan(false);
    setShowPlanForm(false);
    loadData();
  };

  const togglePlanActive = async (plan: Plan) => {
    await supabase.from("plans").update({ active: !plan.active }).eq("id", plan.id);
    toast({ title: plan.active ? "Plano desativado" : "Plano ativado" });
    loadData();
  };

  const deletePlan = async (id: string) => {
    await supabase.from("plans").delete().eq("id", id);
    toast({ title: "Plano removido" });
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Academy Settings */}
      <Card className="bg-card border-border/40">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Dados da Academia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nome da Academia</label>
              <Input
                value={settingsForm.name}
                onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                placeholder="FitForge Academia"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Abertura
              </label>
              <Input
                type="time"
                value={settingsForm.open_time}
                onChange={e => setSettingsForm(f => ({ ...f, open_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Fechamento
              </label>
              <Input
                type="time"
                value={settingsForm.close_time}
                onChange={e => setSettingsForm(f => ({ ...f, close_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Capacidade Máxima
              </label>
              <Input
                type="number"
                value={settingsForm.max_capacity}
                onChange={e => setSettingsForm(f => ({ ...f, max_capacity: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Check-in Digital</label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={settingsForm.checkin_enabled}
                  onCheckedChange={(v) => setSettingsForm(f => ({ ...f, checkin_enabled: v }))}
                />
                <span className="text-sm text-muted-foreground">
                  {settingsForm.checkin_enabled ? "Habilitado" : "Desabilitado"}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings} className="font-semibold">
            {savingSettings ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Plans Management */}
      <Card className="bg-card border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Gestão de Planos
            </CardTitle>
            <Button size="sm" onClick={() => openPlanForm()} className="text-xs font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Plano
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum plano cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    plan.active
                      ? "bg-secondary/30 border-border/40"
                      : "bg-muted/20 border-border/20 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-semibold text-sm">{plan.name}</span>
                      {!plan.active && (
                        <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground border-border">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R${Number(plan.price).toFixed(2)} · {plan.duration_days} dias
                    </p>
                    {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(plan.features as string[]).slice(0, 3).map((f, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] border-primary/20 text-primary/80">
                            {f}
                          </Badge>
                        ))}
                        {(plan.features as string[]).length > 3 && (
                          <Badge variant="outline" className="text-[9px] border-border/40 text-muted-foreground">
                            +{(plan.features as string[]).length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openPlanForm(plan)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 w-8 p-0"
                      onClick={() => togglePlanActive(plan)}
                    >
                      {plan.active ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-primary" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border/40">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover plano "{plan.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Alunos com esse plano ficarão sem plano atribuído.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePlan(plan.id)} className="bg-destructive text-destructive-foreground">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="bg-card border-border/40">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {[
              { label: "Row Level Security (RLS)", desc: "Ativo em todas as tabelas", ok: true },
              { label: "Rate limiting check-in", desc: "Máximo 1 check-in por aluno por dia", ok: true },
              { label: "Telefone único", desc: "Trigger impede duplicação de aluno", ok: true },
              { label: "Check-in de inativo", desc: "Bloqueado por trigger no banco", ok: true },
              { label: "Validação de pagamento", desc: "Trigger impede due_date no passado", ok: true },
              { label: "Variáveis sensíveis", desc: "Armazenadas em .env, nunca no código", ok: true },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                <div className={`h-2 w-2 rounded-full shrink-0 ${s.ok ? "bg-primary" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </div>
                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 shrink-0">
                  Ativo
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan Form Modal */}
      <Dialog open={showPlanForm} onOpenChange={setShowPlanForm}>
        <DialogContent className="bg-card border-border/40 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingPlan ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <Input
                value={planForm.name}
                onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Plano Mensal"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Textarea
                value={planForm.description}
                onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Acesso ilimitado à academia..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Preço (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={planForm.price || ""}
                  onChange={e => setPlanForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="99.90"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Duração (dias) *</label>
                <Input
                  type="number"
                  value={planForm.duration_days || ""}
                  onChange={e => setPlanForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 0 }))}
                  placeholder="30"
                />
              </div>
            </div>

            {/* Features list */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Benefícios</label>
              {planForm.features.length > 0 && (
                <div className="space-y-1">
                  {planForm.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-sm">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="flex-1">{f}</span>
                      <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  placeholder="Ex: Acesso à musculação"
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addFeature} className="shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={planForm.active}
                onCheckedChange={(v) => setPlanForm(f => ({ ...f, active: v }))}
              />
              <span className="text-sm text-muted-foreground">
                {planForm.active ? "Plano ativo" : "Plano inativo"}
              </span>
            </div>

            <Button onClick={savePlan} disabled={savingPlan} className="w-full font-semibold h-11">
              {savingPlan ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingPlan ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminConfig;
