import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, useInView } from "framer-motion";
import {
  Dumbbell, ChevronRight, Check, ClipboardList, QrCode,
  BarChart3, MapPin, Clock, Phone, Instagram, ArrowRight, Heart,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  price: number;
  features: string[];
}

interface BusinessSettings {
  name: string | null;
  open_time: string | null;
  close_time: string | null;
}

const FadeUp = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const Landing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("plans").select("*").eq("active", true).order("price").then(({ data }) => {
      if (data) setPlans(data as unknown as Plan[]);
    });
    supabase.from("business_settings").select("name, open_time, close_time").limit(1).single().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, []);

  const popular = plans.find((p) => p.duration_days === 90);

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "");
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    return t.slice(0, 5);
  };

  const whatsappMsg = (planName: string) =>
    encodeURIComponent(`Olá! Tenho interesse no plano ${planName} da FitForge. Gostaria de mais informações!`);

  const goToStudent = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) navigate(`/aluno/${digits}`);
  };

  const features = [
    { icon: ClipboardList, title: "Treinos Personalizados", desc: "Planilhas montadas por profissionais, adaptadas ao seu objetivo e nível." },
    { icon: QrCode, title: "Check-in Digital", desc: "Registre sua presença em segundos pelo celular. Sem filas, sem carteirinha." },
    { icon: BarChart3, title: "Acompanhamento Completo", desc: "Avaliações físicas periódicas com evolução detalhada de medidas e composição." },
    { icon: Dumbbell, title: "Ambiente Moderno", desc: "Equipamentos de última geração em um espaço projetado para performance." },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Dumbbell className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold tracking-tight">FitForge</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/checkin">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Check-in</Button>
            </Link>
            <Link to="/admin/login">
              <Button variant="outline" size="sm" className="border-border/60">Admin</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 px-4">
        {/* Geometric background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(82_85%_55%/0.08),transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23a3e635' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="container max-w-4xl text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary font-medium text-xs tracking-wide px-3 py-1">
              ⚡ PRIMEIRA SEMANA GRÁTIS
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.08]"
          >
            Transforme seu corpo.{" "}
            <br className="hidden sm:block" />
            <span className="text-gradient">Transforme sua vida.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            A academia mais completa da sua cidade. Equipamentos de ponta, treinos personalizados e acompanhamento real do seu progresso.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <a href="#planos">
              <Button size="lg" className="text-base font-bold px-8 h-13 glow group">
                Quero Conhecer
                <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <Link to="/checkin">
              <Button size="lg" variant="outline" className="text-base font-semibold px-8 h-13 border-border/60">
                Fazer Check-in
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="py-12 border-y border-border/40 bg-card/30">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center px-4">
          {[
            { value: "500+", label: "Alunos ativos" },
            { value: "16h", label: "Aberto por dia" },
            { value: "200+", label: "Equipamentos" },
            { value: "98%", label: "Satisfação" },
          ].map((s, i) => (
            <FadeUp key={s.label} delay={i * 0.08}>
              <p className="font-display text-2xl md:text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ─── POR QUE A FITFORGE ─── */}
      <section className="py-20 md:py-28 px-4">
        <div className="container max-w-5xl">
          <FadeUp>
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 border-border/60 text-muted-foreground text-xs tracking-wide">
                DIFERENCIAIS
              </Badge>
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Por que a <span className="text-primary">FitForge</span>?
              </h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            {features.map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.08}>
                <Card className="bg-card border-border/40 hover:border-primary/25 transition-colors duration-200 h-full">
                  <CardContent className="p-6">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLANOS ─── */}
      <section id="planos" className="py-20 md:py-28 px-4 scroll-mt-20 border-t border-border/40">
        <div className="container max-w-5xl">
          <FadeUp>
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 border-border/60 text-muted-foreground text-xs tracking-wide">
                PLANOS
              </Badge>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Escolha seu plano</h2>
              <p className="text-muted-foreground">Sem taxa de matrícula. Cancele quando quiser.</p>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            {plans.map((plan, i) => {
              const isPopular = plan.id === popular?.id;
              return (
                <FadeUp key={plan.id} delay={i * 0.08}>
                  <Card
                    className={`relative bg-card border transition-all duration-200 hover:scale-[1.015] h-full ${
                      isPopular ? "border-primary/60 glow" : "border-border/40 hover:border-primary/25"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-6">
                        <Badge className="bg-primary text-primary-foreground font-bold text-xs px-3 shadow-lg shadow-primary/20">
                          Mais Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-6 pt-8 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{plan.duration_days} dias de acesso</p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-3xl font-extrabold text-primary">
                            R${plan.price.toFixed(0)}
                          </span>
                          {plan.duration_days > 30 && (
                            <p className="text-[11px] text-muted-foreground">
                              R${(plan.price / (plan.duration_days / 30)).toFixed(0)}/mês
                            </p>
                          )}
                        </div>
                      </div>

                      {plan.description && (
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      )}

                      {plan.features && (
                        <ul className="space-y-2.5 mb-6 flex-1">
                          {(plan.features as string[]).map((f, fi) => (
                            <li key={fi} className="flex items-start gap-2.5 text-sm">
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <a
                        href={`https://wa.me/5511999999999?text=${whatsappMsg(plan.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button
                          className={`w-full font-bold ${
                            isPopular ? "glow-sm" : ""
                          }`}
                          variant={isPopular ? "default" : "secondary"}
                        >
                          Matricule-se
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── ACESSO RÁPIDO ─── */}
      <section className="py-20 md:py-28 px-4 border-t border-border/40">
        <div className="container max-w-2xl">
          <FadeUp>
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-4 border-border/60 text-muted-foreground text-xs tracking-wide">
                ACESSO RÁPIDO
              </Badge>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Já é aluno?</h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-4">
            <FadeUp delay={0}>
              <Link to="/checkin" className="block">
                <Card className="bg-card border-border/40 hover:border-primary/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer group">
                  <CardContent className="p-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                      <QrCode className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-display text-lg font-bold mb-1">Fazer Check-in</h3>
                    <p className="text-sm text-muted-foreground">Registre sua presença na academia</p>
                  </CardContent>
                </Card>
              </Link>
            </FadeUp>

            <FadeUp delay={0.08}>
              <Card className="bg-card border-border/40 h-full">
                <CardContent className="p-6 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Dumbbell className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-bold mb-3">Ver Meu Treino</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      maxLength={15}
                      className="text-center text-sm"
                      onKeyDown={(e) => e.key === "Enter" && goToStudent()}
                    />
                    <Button onClick={goToStudent} size="icon" className="shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-12 border-t border-border/40 bg-card/30">
        <div className="container px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="h-6 w-6 text-primary" />
                <span className="font-display text-lg font-bold">FitForge</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Transformando vidas através do treino e da disciplina desde 2020.
              </p>
            </div>

            {/* Endereço */}
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Endereço</h4>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
                <span>Rua Exemplo, 123<br />Centro — Sua Cidade/SP</span>
              </div>
            </div>

            {/* Horário */}
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Horário</h4>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
                <div>
                  <p>Seg a Sex: {formatTime(settings?.open_time ?? null)} – {formatTime(settings?.close_time ?? null)}</p>
                  <p>Sáb: {formatTime(settings?.open_time ?? null)} – 14:00</p>
                  <p>Dom e Feriados: Fechado</p>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Contato</h4>
              <div className="space-y-2">
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Phone className="h-4 w-4 text-primary/60" />
                  (11) 99999-9999
                </a>
                <a href="https://instagram.com/fitforge" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="h-4 w-4 text-primary/60" />
                  @fitforge
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© 2026 FitForge. Todos os direitos reservados.</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Desenvolvido com <Heart className="h-3 w-3 text-primary fill-primary" /> 
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
