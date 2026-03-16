import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Checkin = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleCheckin = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Informe um telefone válido.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    const { data: student } = await supabase
      .from("students")
      .select("id, name, status")
      .eq("phone", digits)
      .maybeSingle();

    if (!student) {
      setError("Telefone não encontrado. Verifique com a recepção.");
      setLoading(false);
      return;
    }

    if (student.status !== "active" && student.status !== "trial") {
      setError("Seu plano está inativo. Procure a recepção.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("checkins")
      .insert({ student_id: student.id, method: "link" });

    if (insertError) {
      toast({ title: "Erro ao fazer check-in", description: insertError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setStudentName(student.name);
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <Dumbbell className="h-8 w-8 text-primary" />
        <span className="font-display text-2xl font-bold">FitForge</span>
      </Link>

      <Card className="w-full max-w-md bg-card border-border/50 animate-scale-in">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Check-in</CardTitle>
          <p className="text-sm text-muted-foreground">Registre sua presença na academia</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="text-center py-6 animate-fade-in">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold mb-1">Bem-vindo(a), {studentName}!</h3>
              <p className="text-muted-foreground text-sm mb-6">Check-in realizado com sucesso.</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => { setSuccess(false); setPhone(""); }}>
                  Novo check-in
                </Button>
                <Link to={`/aluno/${phone.replace(/\D/g, "")}`}>
                  <Button>Ver meu treino</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Seu telefone</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={15}
                  className="text-center text-lg font-display tracking-wider"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm animate-fade-in">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <Button onClick={handleCheckin} disabled={loading} className="w-full font-semibold" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fazer Check-in"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Checkin;
