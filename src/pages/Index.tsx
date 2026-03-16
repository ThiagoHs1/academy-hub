import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Zap, Users, Clock, ChevronRight, Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  price: number;
  features: string[];
}

const Landing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    supabase.from("plans").select("*").eq("active", true).order("price").then(({ data }) => {
      if (data) setPlans(data as unknown as Plan[]);
    });
  }, []);

  const popular = plans.find(p => p.duration_days === 90);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Dumbbell className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold tracking-tight">FitForge</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/checkin">
              <Button variant="ghost" size="sm">Check-in</Button>
            </Link>
            <Link to="/admin/login">
              <Button variant="outline" size="sm">Admin</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary font-medium">
            <Zap className="h-3 w-3 mr-1" /> Transforme seu corpo
          </Badge>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            Seu próximo nível{" "}
            <span className="text-gradient">começa aqui</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            A FitForge é mais que uma academia — é onde disciplina vira resultado. 
            Equipamentos de ponta, treinos personalizados e acompanhamento real.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/checkin">
              <Button size="lg" className="text-base font-semibold px-8 glow">
                Fazer Check-in <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <a href="#planos">
              <Button size="lg" variant="outline" className="text-base font-semibold px-8">
                Ver Planos
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-border/50">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "500+", label: "Alunos ativos" },
            { value: "16h", label: "Aberto por dia" },
            { value: "200+", label: "Equipamentos" },
            { value: "98%", label: "Satisfação" },
          ].map((s) => (
            <div key={s.label} className="animate-fade-in">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
            Por que a <span className="text-primary">FitForge</span>?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Dumbbell, title: "Equipamentos Premium", desc: "Máquinas de última geração e área de peso livre completa." },
              { icon: Users, title: "Treino Personalizado", desc: "Planilhas montadas por profissionais para seu objetivo." },
              { icon: Clock, title: "Horário Estendido", desc: "Aberto das 6h às 22h, incluindo feriados." },
            ].map((f) => (
              <Card key={f.title} className="bg-card border-border/50 hover:border-primary/30 transition-colors duration-200">
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20 px-4 border-t border-border/50">
        <div className="container max-w-5xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            Escolha seu plano
          </h2>
          <p className="text-center text-muted-foreground mb-12">Sem taxa de matrícula. Cancele quando quiser.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => {
              const isPopular = plan.id === popular?.id;
              return (
                <Card
                  key={plan.id}
                  className={`relative bg-card border transition-all duration-200 hover:scale-[1.02] ${
                    isPopular ? "border-primary glow" : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground font-semibold">Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6 pt-8">
                    <h3 className="font-display text-lg font-semibold mb-1">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{plan.duration_days} dias</p>
                    <div className="mb-5">
                      <span className="font-display text-3xl font-bold">R${plan.price.toFixed(0)}</span>
                      <span className="text-muted-foreground text-sm">
                        {plan.duration_days > 30 ? `/${plan.duration_days}d` : "/mês"}
                      </span>
                    </div>
                    {plan.features && (
                      <ul className="space-y-2 mb-6">
                        {(plan.features as string[]).map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      className={`w-full font-semibold ${isPopular ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                      variant={isPopular ? "default" : "secondary"}
                    >
                      Começar agora
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border/50">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">FitForge</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 FitForge. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
