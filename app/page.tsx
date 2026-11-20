import Link from "next/link";
import { StartAutoDemoButton } from "../components/AutoDemo";

const steps = [
  {
    n: "01",
    title: "Tu swipes",
    body: "Des trucs concrets : réparer un vélo, gérer une caisse, animer un groupe. Droite si ça te parle, gauche sinon.",
  },
  {
    n: "02",
    title: "On te rend tes compétences",
    body: "Pas un score. Des domaines, des mots que tu reconnais, et la preuve : les cartes qui t'ont mené là.",
  },
  {
    n: "03",
    title: "Tu valides",
    body: "Rien n'entre dans ton profil sans ton accord. Tu confirmes, tu reformules, tu supprimes.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-10 pt-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-lg text-paper">
              ✳
            </span>
            <span className="text-xl font-black tracking-tight">ORIENTIS</span>
          </div>
          <span className="rounded-full border border-ink/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-ink/60">
            Démo · 2026
          </span>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" />
              Le détecteur de potentiel caché
            </p>

            <h1 className="max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              T&apos;as plus de skills{" "}
              <span className="relative inline-block">
                <span className="relative z-10">que tu crois.</span>
                <span className="absolute bottom-1 left-0 z-0 h-4 w-full -rotate-1 bg-accent/70 sm:h-5" />
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/70">
              Un jeu de cartes pour révéler ce que tu sais faire sans le dire.
              Pas un test de personnalité. Pas un CV. Une boussole, avec tes
              mots et des preuves.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/deck"
                className="hard-shadow inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
              >
                Commencer
                <span aria-hidden>→</span>
              </Link>
              <StartAutoDemoButton className="rounded-full border-2 border-accent/30 bg-accent/10 px-5 py-4 text-sm font-bold text-accent transition-colors hover:border-accent hover:bg-accent/15">
                ▶ Démo automatique
              </StartAutoDemoButton>
              <Link
                href="/result"
                className="rounded-full border border-ink/25 px-5 py-4 text-sm font-semibold text-ink/70 transition-colors hover:border-ink hover:text-ink"
              >
                Voir mon profil
              </Link>
            </div>

            <p className="mt-6 max-w-md text-xs leading-relaxed text-ink/45">
              30 domaines ROME 4.0 · 1 923 métiers importés · 158 pistes
              accessibles · tes données restent sur ton appareil.
            </p>
          </div>

          <div className="relative mx-auto h-[430px] w-full max-w-[390px]">
            <div className="absolute inset-x-8 top-10 h-[340px] rotate-6 rounded-[32px] border-2 border-ink bg-sand" />
            <div className="absolute inset-x-4 top-5 h-[350px] -rotate-3 rounded-[32px] border-2 border-ink bg-[#CFE0FF]" />

            <div className="hard-shadow absolute inset-x-0 top-0 overflow-hidden rounded-[32px] border-2 border-ink bg-paper">
              <div className="flex items-center justify-between border-b-2 border-ink bg-[#DFF3A9] px-6 py-4">
                <span className="text-xs font-black uppercase tracking-widest">
                  Ça te tente ?
                </span>
                <span className="text-2xl">🚲</span>
              </div>
              <div className="flex h-[330px] flex-col items-center justify-center gap-5 px-8 text-center">
                <div className="text-7xl">🔧</div>
                <p className="text-3xl font-black leading-tight tracking-tight">
                  Réparer un vélo crevé
                </p>
                <p className="text-sm text-ink/50">
                  Même si tu galères au début
                </p>
              </div>
              <div className="flex items-center justify-between border-t-2 border-ink px-6 py-4">
                <span className="text-2xl">←</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-ink/40">
                  glisse la carte
                </span>
                <span className="text-2xl">→</span>
              </div>
            </div>

            <div className="absolute -bottom-3 left-1/3 -rotate-6 rounded-2xl border-2 border-ink bg-mint px-4 py-2 text-sm font-black">
              + travail manuel
            </div>
            <div className="absolute -right-2 top-1/2 rotate-6 rounded-2xl border-2 border-ink bg-accent px-4 py-2 text-sm font-black text-paper">
              confirmé ✓
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-ink/15 pt-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="rounded-2xl border border-ink/15 p-5">
              <span className="text-xs font-black tracking-widest text-accent">
                {step.n}
              </span>
              <h2 className="mt-2 text-lg font-black">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                {step.body}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink/40">
          <span>
            Orientis n&apos;est pas un test psychologique. Aucune déduction sur la
            santé, l&apos;origine, la famille ou la religion.
          </span>
          <span>Données ROME 4.0 v62 · France Travail · Licence Ouverte</span>
        </footer>
      </div>
    </main>
  );
}
