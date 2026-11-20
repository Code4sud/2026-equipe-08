"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  clearDemoUser,
  DEMO_SESSION,
  DEMO_USER,
  loadDemoUser,
  saveDemoUser,
} from "../../lib/dossier/demo";
import { extractExperience } from "../../lib/dossier/experience";
import type { DemoUser, StudiesLevel } from "../../lib/dossier/types";
import { StartAutoDemoButton } from "../../components/AutoDemo";
import { useSession } from "../../lib/store";
import { useMounted } from "../../lib/useMounted";

const STUDIES: { value: StudiesLevel; label: string }[] = [
  { value: "sans-diplome", label: "Sans diplôme" },
  { value: "cap-bep", label: "CAP / BEP" },
  { value: "bac", label: "Bac" },
  { value: "bac+2", label: "Bac +2" },
  { value: "bac+3", label: "Bac +3" },
  { value: "bac+5", label: "Bac +5" },
  { value: "autre", label: "Autre" },
];

const STATUS: { value: DemoUser["currentStatus"]; label: string }[] = [
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "etudes", label: "Études" },
  { value: "alternance", label: "Alternance" },
  { value: "recherche", label: "Recherche d'emploi / formation" },
  { value: "emploi", label: "En emploi" },
  { value: "inactif", label: "Ni en emploi ni en études" },
];

type Backend = "mock" | "cli" | "api";

type Config = {
  backend: Backend;
  model: string;
  claudeBin: string;
  claudeFound: boolean;
};

export default function DemoPage() {
  const router = useRouter();
  const mounted = useMounted();
  const loadSession = useSession((s) => s.loadSession);
  const reset = useSession((s) => s.reset);

  const [user, setUser] = useState<DemoUser>(() => loadDemoUser());
  const [saved, setSaved] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string | null;
  } | null>(null);

  const autoExperience = useMemo(
    () => extractExperience(DEMO_SESSION),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then((response) => response.json())
      .then((data: Config) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        // pas d'info : on laisse le mode démo par défaut.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof DemoUser>(key: K, value: DemoUser[K]) {
    setUser((current) => ({ ...current, [key]: value }));
  }

  function save(show = false) {
    saveDemoUser(user);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
    if (show) router.push("/dossier");
  }

  function loadPersona() {
    loadSession(DEMO_SESSION);
    saveDemoUser(DEMO_USER);
    router.push("/dossier");
  }

  function resetSwipe() {
    reset();
    router.push("/deck");
  }

  function deleteEverything() {
    if (
      !window.confirm(
        "Tout supprimer ? Le swipe, le profil de démo et les réglages seront effacés.",
      )
    ) {
      return;
    }
    reset();
    clearDemoUser();
    try {
      localStorage.removeItem("declic-session-v1");
    } catch {
      // mode privé strict.
    }
    router.push("/");
  }

  function allowLocation() {
    setUser((current) => ({
      ...current,
      city: "Nice",
      postalCode: "06000",
      locationSimulated: true,
    }));
    setLocationOpen(false);
  }

  function addManualExperience() {
    const title = manualTitle.trim();
    if (!title) return;
    setUser((current) => ({
      ...current,
      experience: [
        ...current.experience,
        {
          id: `manual-${Date.now()}`,
          title,
          detail: "Ajouté à la main",
          source: "manuel",
          evidence: [title],
        },
      ],
    }));
    setManualTitle("");
  }

  async function testClaude() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string | null;
      };
      setTestResult({ ok: Boolean(data.ok), error: data.error });
    } catch (error) {
      setTestResult({
        ok: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setTesting(false);
    }
  }

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Accueil"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </Link>
          <Link
            href="/dossier"
            className="rounded-full border border-ink/20 px-3 py-2 text-[11px] font-bold text-ink/55"
          >
            Dossier
          </Link>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.2em]">
          Mode démo
        </span>
        <span className="w-9" />
      </header>

      <section className="hard-shadow mt-5 rounded-[30px] border-2 border-ink bg-ink p-6 text-paper">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-paper/45">
          Panneau de démonstration
        </p>
        <h1 className="mt-2 text-3xl font-black leading-none tracking-tight">
          Prépare la démo
          <br />
          en 20 secondes.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/60">
          Ce panneau n&apos;est pas la page du jeune : il charge le persona,
          simule Nice, règle le profil et vérifie Claude local. La page{" "}
          <Link href="/dossier" className="underline">
            /dossier
          </Link>{" "}
          est ce qu&apos;on montre.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <StartAutoDemoButton className="rounded-full bg-accent px-4 py-2.5 text-xs font-black text-paper">
            ▶ Lancer la démo automatique
          </StartAutoDemoButton>
          <button
            onClick={loadPersona}
            className="rounded-full bg-mint px-4 py-2.5 text-xs font-black text-ink"
          >
            Charger le persona + dossier
          </button>
          <button
            onClick={() => save(true)}
            className="rounded-full border border-paper/25 px-4 py-2.5 text-xs font-bold text-paper/80"
          >
            Enregistrer et voir le dossier
          </button>
          <button
            onClick={resetSwipe}
            className="rounded-full border border-paper/20 px-4 py-2.5 text-xs font-bold text-paper/50"
          >
            Réinitialiser le swipe
          </button>
          <button
            onClick={deleteEverything}
            className="rounded-full border border-accent/40 px-4 py-2.5 text-xs font-bold text-accent"
          >
            Tout supprimer
          </button>
        </div>
        {saved && (
          <p className="mt-3 text-xs font-semibold text-mint">
            Profil enregistré.
          </p>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker="01"
          title="Profil de démo"
          subtitle="Les champs absents du JSON swipe. Ils alimentent le CV, les emails et la recherche locale."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Prénom">
            <input
              value={user.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Nom">
            <input
              value={user.lastName ?? ""}
              onChange={(event) => update("lastName", event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Email">
            <input
              value={user.email ?? ""}
              onChange={(event) => update("email", event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Téléphone">
            <input
              value={user.phone ?? ""}
              onChange={(event) => update("phone", event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Âge">
            <input
              type="number"
              min={16}
              max={30}
              value={user.age}
              onChange={(event) => update("age", Number(event.target.value))}
              className="input"
            />
          </Field>
          <Field label="Niveau d'études">
            <select
              value={user.studiesLevel}
              onChange={(event) =>
                update("studiesLevel", event.target.value as StudiesLevel)
              }
              className="input"
            >
              {STUDIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut actuel">
            <select
              value={user.currentStatus}
              onChange={(event) =>
                update(
                  "currentStatus",
                  event.target.value as DemoUser["currentStatus"],
                )
              }
              className="input"
            >
              {STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Code postal">
            <input
              value={user.postalCode}
              onChange={(event) =>
                setUser((current) => ({
                  ...current,
                  postalCode: event.target.value,
                  locationSimulated: false,
                }))
              }
              className="input"
            />
          </Field>
          <Field label="Ville">
            <input
              value={user.city}
              onChange={(event) =>
                setUser((current) => ({
                  ...current,
                  city: event.target.value,
                  locationSimulated: false,
                }))
              }
              className="input"
            />
          </Field>
          <Field label="Mobilité (km)">
            <input
              type="number"
              min={1}
              max={100}
              value={user.mobilityKm}
              onChange={(event) =>
                update("mobilityKm", Number(event.target.value))
              }
              className="input"
            />
          </Field>
          <Field label="Disponible à partir de">
            <input
              value={user.availableFrom}
              onChange={(event) => update("availableFrom", event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Durée max de formation (mois)">
            <input
              type="number"
              min={1}
              max={60}
              value={user.maxTrainingMonths}
              onChange={(event) =>
                update("maxTrainingMonths", Number(event.target.value))
              }
              className="input"
            />
          </Field>
          <Field label="Salaire min (€)">
            <input
              type="number"
              min={0}
              step={50}
              value={user.minSalary}
              onChange={(event) => update("minSalary", Number(event.target.value))}
              className="input"
            />
          </Field>
          <Field label="Contrats acceptés">
            <input
              value={user.contractTypes.join(", ")}
              onChange={(event) =>
                update(
                  "contractTypes",
                  event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
              className="input"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 rounded-2xl border border-ink/15 bg-paper p-4 text-sm">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={user.driverLicense}
              onChange={(event) =>
                update("driverLicense", event.target.checked)
              }
            />
            Permis de conduire
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={user.alternance}
              onChange={(event) => update("alternance", event.target.checked)}
            />
            Ouvert·e à l&apos;alternance
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={user.aiEnabled}
              onChange={(event) => update("aiEnabled", event.target.checked)}
            />
            Utiliser Claude pour le dossier, le CV et les emails
          </label>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker="02"
          title="Localisation simulée"
          subtitle="Pour la démo, on simule une demande de géolocalisation et on affiche Nice. Aucune position réelle n'est demandée."
        />
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/15 bg-paper p-4">
          <button
            onClick={() => setLocationOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper"
          >
            Demander ma position
          </button>
          <span className="text-xs text-ink/50">
            {user.locationSimulated
              ? `Position simulée : ${user.city} (${user.postalCode})`
              : `Saisie manuelle : ${user.city} (${user.postalCode})`}
          </span>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker="03"
          title="Expérience"
          subtitle="Le vécu est extrait de la session swipe. Tu peux ajouter ce qui n'a pas été couvert."
        />
        <div className="mt-4 rounded-2xl border border-ink/15 bg-paper p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Importé du swipe et des entretiens ({autoExperience.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink/65">
            {autoExperience.map((item) => (
              <li key={item.id}>
                · <strong>{item.title}</strong>
                {item.detail ? ` — ${item.detail}` : ""}
              </li>
            ))}
          </ul>

          <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-ink/35">
            Expériences du profil ({user.experience.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink/65">
            {user.experience.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>{item.title}</span>
                <button
                  onClick={() =>
                    setUser((current) => ({
                      ...current,
                      experience: current.experience.filter(
                        (experience) => experience.id !== item.id,
                      ),
                    }))
                  }
                  className="text-[10px] font-bold text-accent"
                >
                  retirer
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Ex. Bénévolat au club de foot"
              className="input flex-1"
            />
            <button
              onClick={addManualExperience}
              className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold text-ink/60"
            >
              Ajouter
            </button>
          </div>
        </div>
        <button
          onClick={() => save()}
          className="mt-4 rounded-full bg-ink px-5 py-3 text-xs font-bold text-paper"
        >
          Enregistrer le profil
        </button>
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker="04"
          title="Claude local"
          subtitle="La démo tourne sur l'autre machine : le binaire est détecté automatiquement, ou via CLAUDE_BIN. Vercel reste en mock."
        />
        <div className="mt-4 rounded-2xl border border-ink/15 bg-paper p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-sand px-2.5 py-1 font-bold text-ink/60">
              backend : {config?.backend ?? "…"}
            </span>
            <span className="rounded-full bg-sand px-2.5 py-1 font-bold text-ink/60">
              modèle : {config?.model ?? "…"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-bold ${
                config?.claudeFound
                  ? "bg-mint text-ink"
                  : "bg-accent/15 text-accent"
              }`}
            >
              {config?.claudeFound ? "binaire trouvé" : "binaire introuvable"}
            </span>
          </div>
          {config?.claudeBin && (
            <p className="mt-2 break-all text-[10px] text-ink/35">
              {config.claudeBin}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={testClaude}
              disabled={testing}
              className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper disabled:opacity-50"
            >
              {testing ? "Test en cours…" : "Tester Claude"}
            </button>
            <Link
              href="/dossier"
              className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold text-ink/60"
            >
              Voir le dossier
            </Link>
          </div>

          {testResult && (
            <div
              className={`mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                testResult.ok
                  ? "bg-mint/40 text-ink/70"
                  : "bg-accent/10 text-ink/60"
              }`}
            >
              {testResult.ok ? (
                <p className="font-bold text-ink">Claude répond.</p>
              ) : (
                <>
                  <p className="font-bold text-accent">
                    Claude n&apos;a pas répondu.
                  </p>
                  <p className="mt-1 break-words">
                    {testResult.error ?? "Erreur inconnue"}
                  </p>
                  <p className="mt-1 text-ink/45">
                    Sur la machine de démo : lance{" "}
                    <code className="rounded bg-ink/10 px-1">claude</code>,
                    connecte-toi, puis relance le test. Le dossier reste
                    complet sans IA.
                  </p>
                </>
              )}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            Pour la démo locale : <code className="rounded bg-ink/10 px-1">LLM_BACKEND=cli</code>{" "}
            dans <code className="rounded bg-ink/10 px-1">.env.local</code>, puis{" "}
            <code className="rounded bg-ink/10 px-1">npm run dev</code>. Le
            binaire est cherché dans le PATH, les emplacements usuels et
            l&apos;extension VS Code.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker="05"
          title="Données de la démo"
          subtitle="Tant que les APIs ne sont pas branchées, tout est clairement étiqueté."
        />
        <div className="mt-4 grid gap-2 text-xs text-ink/60">
          <p>· Offres : 10 offres fictives à Nice (domaine `.example`).</p>
          <p>· Formations : 11 parcours de démonstration, établissements à vérifier sur ONISEP.</p>
          <p>· ROME 4.0 v62 : vraie base, déjà importée.</p>
          <p>· Aucune donnée santé, origine, famille ou religion.</p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          onClick={loadPersona}
          className="hard-shadow-sm rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper"
        >
          Charger le persona + dossier
        </button>
        <Link
          href="/dossier"
          className="rounded-full border border-ink/25 px-5 py-3 text-sm font-bold text-ink/60"
        >
          Dossier
        </Link>
      </div>

      {locationOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-ink/20 bg-paper shadow-2xl">
            <div className="bg-ink px-5 py-4 text-paper">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-paper/50">
                Simulation
              </p>
              <h3 className="mt-1 text-xl font-black">
                Autoriser la géolocalisation ?
              </h3>
            </div>
            <div className="px-5 py-4 text-sm leading-relaxed text-ink/65">
              Pour la démo, la position simulée est <strong>Nice (06000)</strong>.
              Aucune position réelle n&apos;est demandée.
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={allowLocation}
                className="flex-1 rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-paper"
              >
                Autoriser (Nice)
              </button>
              <button
                onClick={() => setLocationOpen(false)}
                className="flex-1 rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold text-ink/60"
              >
                Pas maintenant
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SectionTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-black leading-none tracking-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/50">
        {subtitle}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-ink/55">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
