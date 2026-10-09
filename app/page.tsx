"use client";

import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CloudUpload,
  Download, FileText, Heart, HeartPulse, LayoutDashboard, LoaderCircle, MapPin,
  LogOut, Menu, MessageCircle, MoreHorizontal, Plus, Printer, Send, ShieldCheck, ShieldPlus,
  Siren, Sparkles, Stethoscope, Thermometer, Upload, UserRound, X, Droplets,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEMO_SESSION_KEY = "carecopilot_demo_session";
const DEMO_NAME_KEY = "carecopilot_demo_name";
type Profile = { name: string; age: number; gender: string; blood_group: string; allergies: string[]; medical_history: string[] };
type HealthRecord = { id: string; type: string; value: number; unit: string; recorded_at: string };
type Symptom = { id: string; description: string; severity: number; started_at: string };
type Medication = { id: string; name: string; dosage: string; frequency: string };
type Report = { id: string; file_name: string; report_type: string; ai_summary: string; created_at: string };
type EmergencyEvent = { id: string; latitude: number; longitude: number; trigger_type: string; created_at: string };
type ChatItem = { role: "user" | "assistant"; message: string; emergency?: boolean; mode?: "ai" | "demo" | "safety" };
type Page = "overview" | "copilot" | "records" | "reports" | "summary";

const navigation: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "copilot", label: "AI Copilot", icon: Sparkles },
  { id: "records", label: "Health tracking", icon: HeartPulse },
  { id: "reports", label: "My reports", icon: FileText },
  { id: "summary", label: "Doctor summary", icon: Stethoscope },
];

function dateLabel(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatReportMarkdown(content: string) {
  return content
    .replace(/[ \t]+(?=#{1,3}\s)/g, "\n\n")
    .replace(/[ \t]+(?=(?:[-*]|\d+\.)\s+)/g, "\n")
    .trim();
}

function callEmergencyServices() {
  const number = window.prompt("Enter your local emergency number to place the call:");
  if (!number || !/^[+0-9\s().-]{2,20}$/.test(number)) return;
  window.location.href = `tel:${number.replace(/[^\d+]/g, "")}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("carecopilot_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [profile, setProfile] = useState<Profile>({ name: "", age: 0, gender: "", blood_group: "", allergies: [], medical_history: [] });
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [modal, setModal] = useState<"symptom" | "record" | "medication" | "emergency" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [emergency, setEmergency] = useState<{ latitude: number; longitude: number } | null>(null);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState("");

  useEffect(() => {
    const demoSession = window.localStorage.getItem(DEMO_SESSION_KEY) === "true";
    const savedDemoName = window.localStorage.getItem(DEMO_NAME_KEY);
    if (demoSession && savedDemoName) {
      setProfile((current) => ({ ...current, name: savedDemoName }));
    }
    setIsDemo(demoSession);
    setSignedIn(demoSession || Boolean(window.localStorage.getItem("carecopilot_token")));
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    if (isDemo) {
      setBackendOnline(false);
      return;
    }
    api<{ profile: Profile; records: HealthRecord[]; symptoms: Symptom[]; medications: Medication[]; reports: Report[]; emergency_events: EmergencyEvent[] }>("/api/dashboard")
      .then((data) => {
        setBackendOnline(true);
        setProfile(data.profile);
        setRecords(data.records);
        setSymptoms(data.symptoms);
        setMedications(data.medications);
        setReports(data.reports);
        setEmergencyEvents(data.emergency_events);
      })
      .catch((error) => {
        setBackendOnline(false);
        window.localStorage.removeItem("carecopilot_token");
        setSignedIn(false);
        setAuthMode("login");
        setAuthError(error instanceof Error ? error.message : "Please sign in again.");
      });
  }, [signedIn, isDemo]);

  function enterDemo() {
    const demoName = authName.trim() || authEmail.trim().split("@")[0] || "Demo User";
    window.localStorage.removeItem("carecopilot_token");
    window.localStorage.setItem(DEMO_SESSION_KEY, "true");
    window.localStorage.setItem(DEMO_NAME_KEY, demoName);
    setProfile({ name: demoName, age: 0, gender: "", blood_group: "", allergies: [], medical_history: [] });
    setRecords([]);
    setSymptoms([]);
    setMedications([]);
    setReports([]);
    setEmergencyEvents([]);
    setChat([]);
    setIsDemo(true);
    setBackendOnline(false);
    setSignedIn(true);
    setAuthPassword("");
    setAuthError("");
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    if (authMode === "login" && authEmail.trim().toLowerCase() === "admin" && authPassword === "admin") {
      enterDemo();
      return;
    }
    setAuthBusy(true);
    try {
      const response = await api<{ access_token: string }>(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ ...(authMode === "signup" ? { name: authName.trim() } : {}), email: authEmail.trim(), password: authPassword }),
      });
      window.localStorage.setItem("carecopilot_token", response.access_token);
      setSignedIn(true);
      setAuthPassword("");
    } catch (error) {
      if (error instanceof TypeError) {
        setAuthError(`Cannot connect to the CareCopilot API at ${API_URL}. Start the backend locally, or set NEXT_PUBLIC_API_URL to your deployed backend URL and redeploy the frontend.`);
      } else {
        setAuthError(error instanceof Error ? error.message : "We couldn’t complete that request. Please try again.");
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      if (!isDemo) await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.localStorage.removeItem("carecopilot_token");
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      window.localStorage.removeItem(DEMO_NAME_KEY);
      setSignedIn(false);
      setIsDemo(false);
      setBackendOnline(false);
      setPage("overview");
      setChat([]);
      setEmergency(null);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  const chartData = useMemo(() => records.filter((r) => r.type.toLowerCase() === "heart rate").slice(0, 8).reverse().map((r) => ({ date: dateLabel(r.recorded_at), bpm: r.value })), [records]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setQuestion("");
    setChat((items) => [...items, { role: "user", message: text }]);
    setBusy(true);
    if (isDemo) {
      try {
        const answer = await api<{ response: string; emergency: boolean; mode: "ai" | "demo" | "safety" }>("/api/demo/chat", { method: "POST", body: JSON.stringify({ message: text }) });
        setChat((items) => [...items, { role: "assistant", message: answer.response, emergency: answer.emergency, mode: answer.mode }]);
      } catch (error) {
        setChat((items) => [...items, { role: "assistant", message: error instanceof Error ? `Demo AI unavailable: ${error.message}` : "Demo AI is unavailable. Check the backend configuration and try again." }]);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const answer = await api<{ response: string; emergency: boolean; mode: "ai" | "demo" | "safety" }>("/api/copilot/chat", { method: "POST", body: JSON.stringify({ message: text }) });
      setChat((items) => [...items, { role: "assistant", message: answer.response, emergency: answer.emergency, mode: answer.mode }]);
    } catch (error) {
      setChat((items) => [...items, { role: "assistant", message: error instanceof Error ? error.message : "The copilot is unavailable right now. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  async function uploadReport(file: File) {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const report = await api<Report>(isDemo ? "/api/demo/reports/upload" : "/api/reports/upload", { method: "POST", body: form });
      setReports((items) => [report, ...items]);
      setToast(isDemo ? "Report analyzed with AI for this demo. It was not saved." : "Report analyzed and added to your records.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not upload report.");
    } finally {
      setBusy(false);
    }
  }

  async function activateEmergency() {
    if (!navigator.geolocation) {
      setEmergencyMessage("Location services are not supported by this browser. You can still call your local emergency number.");
      return;
    }
    setEmergencyBusy(true);
    setEmergencyMessage("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude, trigger_type: "user_activated_sos" };
      if (isDemo) {
        setEmergencyEvents((events) => [{
          id: `demo-${Date.now()}`,
          ...location,
          created_at: new Date().toISOString(),
        }, ...events]);
        setEmergency(location);
        setEmergencyBusy(false);
        setModal(null);
        setToast("Demo only: this event was not saved and no services or contacts were notified.");
        return;
      }
      try {
        const result = await api<{ event: EmergencyEvent }>("/api/emergency/activate", { method: "POST", body: JSON.stringify(location) });
        setEmergencyEvents((events) => [result.event, ...events]);
      } catch {
        setToast("Demo mode: emergency event could not be saved to the API.");
      }
      setEmergency(location);
      setEmergencyBusy(false);
      setModal(null);
      setToast("Emergency assistance view is active. No services or contacts have been notified.");
    }, () => {
      setEmergencyBusy(false);
      setEmergencyMessage("Location permission was not granted. Nothing has been shared. You can still call your local emergency number.");
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function clearChat() {
    setChat([]);
  }

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-forest"><LoaderCircle size={26} className="animate-spin" /></div>;
  }

  if (!signedIn) {
    return <AuthPage
      mode={authMode}
      setMode={(mode) => { setAuthMode(mode); setAuthError(""); }}
      name={authName}
      setName={setAuthName}
      email={authEmail}
      setEmail={setAuthEmail}
      password={authPassword}
      setPassword={setAuthPassword}
      error={authError}
      busy={authBusy}
      onSubmit={submitAuth}
      onDemo={enterDemo}
    />;
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-[#e8ede8] bg-white px-5 py-6 transition-transform lg:static lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-forest text-white"><HeartPulse size={22} /></div>
            <div><div className="text-[17px] font-bold tracking-[-0.5px]">CareCopilot<span className="text-forest"> AI</span></div><div className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#92a49a]">Your health, in context</div></div>
          </div>
          <div className="mt-9 px-2 text-[10px] font-bold uppercase tracking-[1.6px] text-[#9baaa1]">Workspace</div>
          <nav className="mt-3 space-y-1">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setPage(id); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${page === id ? "bg-mint text-forest" : "text-[#73847a] hover:bg-[#f6f8f5] hover:text-ink"}`}>
                <Icon size={18} strokeWidth={1.8} />{label}{id === "copilot" && <span className="ml-auto rounded-full bg-lime px-2 py-0.5 text-[9px] font-bold text-forest">AI</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto">
            <div className="rounded-2xl border border-[#e8eee8] bg-[#f8faf7] p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold"><ShieldCheck size={16} className="text-forest" />Your data, your choice</div>
              <p className="mt-2 text-[11px] leading-5 text-[#77867d]">Your health information stays private. Emergency actions always need your confirmation.</p>
            </div>
            <button onClick={() => setModal("emergency")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#fff2ee] py-3 text-[12px] font-bold text-[#bb503d] hover:bg-[#ffe7e0]"><Siren size={17} /> Emergency SOS</button>
            <div className="mt-6 flex items-center gap-3 border-t border-[#edf0ed] pt-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f1ea] text-xs font-bold text-forest">{profile.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold">{profile.name}</div><div className="text-[10px] text-[#91a097]">Personal health space</div></div>
              <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-[#9aa79f] hover:bg-white hover:text-ink"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>
        {mobileNav && <button className="fixed inset-0 z-30 bg-ink/30 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e9eeea] bg-paper/95 px-5 backdrop-blur md:px-9">
            <div className="flex items-center gap-3">
              <button aria-label="Open menu" className="rounded-lg p-2 hover:bg-white lg:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
              <div><div className="text-[12px] font-semibold text-[#8a9990]">Thursday, October 8, 2026</div><div className="text-[14px] font-bold">{page === "overview" ? "Good morning, " + profile.name.split(" ")[0] : navigation.find((item) => item.id === page)?.label}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold sm:flex ${backendOnline ? "bg-[#eaf4ee] text-forest" : "bg-[#f0f2ef] text-[#718078]"}`}><span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-[#58a77b]" : "bg-[#a6b0a8]"}`} />{backendOnline ? "Synced" : "Demo mode"}</div>
              <button className="relative rounded-full border border-[#e6ebe7] bg-white p-2.5 text-[#6f7f76]"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#df815d]" /></button>
              <button onClick={() => setModal("emergency")} className="flex items-center gap-2 rounded-xl bg-[#c95140] px-3.5 py-2.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#b94736]"><Siren size={15} /><span className="hidden sm:inline">SOS</span></button>
            </div>
          </header>
          {isDemo && <div role="status" className="border-b border-[#ead9a9] bg-[#fff8e7] px-5 py-2.5 text-center text-[10px] font-medium leading-5 text-[#765c24] md:px-9">Demo session: AI chat and report scanning use the connected server and AI provider. Uploaded content may be sent to the configured AI provider for processing; it is not saved to your account. Other demo changes stay in this browser.</div>}
          <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-9 md:py-9">
            {emergency ? <EmergencyPanel location={emergency} onClose={() => setEmergency(null)} /> : (
              <>
                {page === "overview" && <Dashboard profile={profile} records={records} symptoms={symptoms} medications={medications} reports={reports} chartData={chartData} onNavigate={setPage} onEmergency={() => setModal("emergency")} />}
                {page === "copilot" && <Copilot chat={chat} question={question} busy={busy} setQuestion={setQuestion} onSubmit={sendMessage} onClear={clearChat} />}
                {page === "records" && <Records records={records} symptoms={symptoms} medications={medications} onAdd={(type) => setModal(type)} />}
                {page === "reports" && <Reports reports={reports} busy={busy} onUpload={uploadReport} />}
                {page === "summary" && <DoctorSummary profile={profile} symptoms={symptoms} medications={medications} records={records} reports={reports} emergencyEvents={emergencyEvents} />}
              </>
            )}
            <footer className="mt-10 flex flex-col gap-2 border-t border-[#e9eeea] pt-5 text-[10px] leading-5 text-[#91a097] sm:flex-row sm:items-center sm:justify-between">
              <span>CareCopilot AI is an information tool, not a substitute for professional medical advice.</span><span className="flex items-center gap-1"><ShieldCheck size={12} /> Your health. Your data. Your AI copilot.</span>
            </footer>
          </div>
        </section>
      </div>
      {modal && <Modal type={modal} onClose={() => setModal(null)} onEmergency={activateEmergency} emergencyBusy={emergencyBusy} emergencyMessage={emergencyMessage} onSaved={async (kind, value) => {
        if (isDemo) {
          const id = `demo-${Date.now()}`;
          if (kind === "symptom") {
            setSymptoms((items) => [{ id, description: String(value.description), severity: Number(value.severity), started_at: String(value.started_at) }, ...items]);
          } else if (kind === "record") {
            setRecords((items) => [{ id, type: String(value.type), value: Number(value.value), unit: String(value.unit), recorded_at: String(value.recorded_at) }, ...items]);
          } else {
            setMedications((items) => [{ id, name: String(value.name), dosage: String(value.dosage), frequency: String(value.frequency) }, ...items]);
          }
          setModal(null);
          setToast("Demo only: this item was not saved to a backend.");
          return;
        }
        try {
          if (kind === "symptom") {
            const saved = await api<Symptom>("/api/health/symptoms", { method: "POST", body: JSON.stringify(value) });
            setSymptoms((items) => [saved, ...items]);
          } else if (kind === "record") {
            const saved = await api<HealthRecord>("/api/health/records", { method: "POST", body: JSON.stringify(value) });
            setRecords((items) => [saved, ...items]);
          } else {
            const saved = await api<Medication>("/api/health/medications", { method: "POST", body: JSON.stringify(value) });
            setMedications((items) => [saved, ...items]);
          }
          setModal(null);
          setToast("Saved to your health timeline.");
        } catch (error) {
          setToast(error instanceof Error ? error.message : "Could not save this item.");
        }
      }} />}
      {toast && <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-medium text-white shadow-lg"><Check size={16} className="text-lime" />{toast}<button onClick={() => setToast("")} aria-label="Dismiss" className="ml-2 text-white/60"><X size={14} /></button></div>}
    </main>
  );
}

function AuthPage({
  mode, setMode, name, setName, email, setEmail, password, setPassword, error, busy, onSubmit, onDemo,
}: {
  mode: "signup" | "login";
  setMode: (mode: "signup" | "login") => void;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onDemo: () => void;
}) {
  return <main className="min-h-screen bg-paper text-ink">
    <div className="mx-auto grid min-h-screen max-w-[1200px] lg:grid-cols-[1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-[#1e5746] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-white/10"><HeartPulse size={23} /></div>
          <div><div className="text-[18px] font-bold tracking-[-.5px]">CareCopilot AI</div><div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[1.8px] text-white/55">Your health, in context</div></div>
        </div>
        <div className="max-w-[470px]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lime"><HeartPulse size={24} /></div>
          <h1 className="text-[42px] font-bold leading-[1.15] tracking-[-1.8px]">A calmer way to keep up with your health.</h1>
          <p className="mt-5 max-w-[390px] text-[14px] leading-7 text-white/70">Bring your health notes, readings, and questions into one thoughtful space — and share them with your care team when you choose.</p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
            <ShieldCheck size={19} className="shrink-0 text-lime" />
            <p className="text-[11px] leading-5 text-white/75">You’re in control. Your information stays in your account, and emergency actions always need your confirmation.</p>
          </div>
        </div>
        <div className="text-[10px] text-white/45">CareCopilot is a health information tool, not a substitute for professional medical advice.</div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-forest text-white"><HeartPulse size={21} /></div>
            <div><div className="text-[16px] font-bold">CareCopilot AI</div><div className="text-[9px] font-semibold uppercase tracking-[1.4px] text-[#92a49a]">Your health, in context</div></div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-forest">{mode === "signup" ? "A healthier overview starts here" : "Welcome back"}</div>
          <h2 className="mt-2 text-[29px] font-bold tracking-[-1px]">{mode === "signup" ? "Create your account" : "Sign in to CareCopilot"}</h2>
          <p className="mt-2 text-[12px] leading-5 text-[#849188]">{mode === "signup" ? "Set up your private health space. You can add health details after signing in." : "Your health space is ready when you are."}</p>
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {mode === "signup" && <label className="block text-[11px] font-semibold text-[#5c6e63]">Full name
              <input autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-[#e1e8e1] bg-white px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#a7b1a9] focus:border-[#83ad90]" />
            </label>}
            <label className="block text-[11px] font-semibold text-[#5c6e63]">{mode === "login" ? "Email or demo username" : "Email address"}
              <input type={mode === "login" ? "text" : "email"} autoComplete={mode === "login" ? "username" : "email"} required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={mode === "login" ? "you@example.com or admin" : "you@example.com"} className="mt-1.5 w-full rounded-xl border border-[#e1e8e1] bg-white px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#a7b1a9] focus:border-[#83ad90]" />
            </label>
            <label className="block text-[11px] font-semibold text-[#5c6e63]">Password
              <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password (demo: admin)"} className="mt-1.5 w-full rounded-xl border border-[#e1e8e1] bg-white px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#a7b1a9] focus:border-[#83ad90]" />
              {mode === "signup" && <span className="mt-1.5 block text-[9px] font-normal text-[#9ba69e]">Use at least 8 characters.</span>}
            </label>
            {error && <div role="alert" className="rounded-xl border border-[#f0d2ca] bg-[#fff5f1] px-3.5 py-3 text-[10px] leading-5 text-[#a54b3b]">{error}</div>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-[11px] font-bold text-white transition hover:bg-[#184c3b] disabled:cursor-wait disabled:opacity-60">
              {busy && <LoaderCircle size={15} className="animate-spin" />}
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              {!busy && <ArrowRight size={14} />}
            </button>
          </form>
          <div className="mt-5 rounded-2xl border border-[#e8ede8] bg-[#f7f9f6] p-4">
            <div className="text-[11px] font-bold text-ink">Just looking around?</div>
            <p className="mt-1 text-[10px] leading-5 text-[#849188]">Enter the demo workspace without creating an account. Or choose Sign in and use username <strong>admin</strong> and password <strong>admin</strong>. Demo changes stay in this browser and are not saved to an account.</p>
            <button type="button" onClick={onDemo} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#cbd9cc] bg-white py-3 text-[11px] font-bold text-forest transition hover:bg-[#eef5ef]">
              Continue as demo <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-5 text-center text-[11px] text-[#87948b]">
            {mode === "signup" ? "Already have an account?" : "New to CareCopilot?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-bold text-forest hover:underline">{mode === "signup" ? "Sign in" : "Create an account"}</button>
          </div>
          <div className="mt-8 flex items-start gap-2 border-t border-[#e8ede8] pt-4 text-[9px] leading-4 text-[#9aa59d]"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-forest" />Your password is protected by the CareCopilot backend and is never sent to an AI provider.</div>
        </div>
      </section>
    </div>
  </main>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[1.7px] text-forest">{eyebrow}</div><h1 className="text-[26px] font-bold tracking-[-1px] md:text-[30px]">{title}</h1><p className="mt-1.5 text-[12px] text-[#89978f]">{description}</p></div>{action}</div>;
}

function Dashboard({ profile, records, symptoms, medications, reports, chartData, onNavigate, onEmergency }: { profile: Profile; records: HealthRecord[]; symptoms: Symptom[]; medications: Medication[]; reports: Report[]; chartData: { date: string; bpm: number }[]; onNavigate: (page: Page) => void; onEmergency: () => void }) {
  const latest = (type: string) => records.find((record) => record.type.toLowerCase() === type.toLowerCase());
  return <div>
    <PageHeading eyebrow="Your personal health space" title="Your health, at a glance" description="A calm place to understand your health and keep everything in one view." action={<button onClick={() => onNavigate("summary")} className="flex items-center gap-2 self-start rounded-xl border border-[#dfe7e0] bg-white px-4 py-2.5 text-[11px] font-bold hover:bg-[#fafcf9] sm:self-auto"><FileText size={15} /> Doctor summary <ArrowRight size={14} /></button>} />
    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <section className="overflow-hidden rounded-[22px] bg-[#1e5746] p-5 text-white shadow-soft md:p-7">
        <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.6px] text-white/65"><span className="h-1.5 w-1.5 rounded-full bg-[#c8e8a6]" />Personal health overview</div><h2 className="mt-3 text-[21px] font-bold tracking-[-.6px]">A little more in tune,<br className="hidden sm:block" /> every day.</h2></div><div className="rounded-2xl bg-white/10 p-3"><HeartPulse size={21} /></div></div>
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Blood group" value={profile.blood_group || "Not set"} icon={Droplets} />
          <MiniStat label="Latest heart rate" value={latest("Heart rate") ? `${latest("Heart rate")?.value} bpm` : "—"} icon={Heart} />
          <MiniStat label="Latest blood pressure" value={latest("Blood pressure") ? `${latest("Blood pressure")?.value} ${latest("Blood pressure")?.unit}` : "—"} icon={Activity} />
          <MiniStat label="Allergies" value={`${profile.allergies.length} noted`} icon={ShieldPlus} />
        </div>
      </section>
      <button onClick={onEmergency} className="group flex min-h-[210px] flex-col justify-between rounded-[22px] border border-[#f2ded7] bg-[#fff9f6] p-5 text-left shadow-soft transition hover:border-[#e6b9ad] md:p-6">
        <div className="flex w-full items-start justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.4px] text-[#bc6651]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ce7059]" />Here if you need it</div><h2 className="mt-3 text-[19px] font-bold">Emergency assistance</h2><p className="mt-2 max-w-[250px] text-[11px] leading-5 text-[#9b827b]">Nothing is shared until you choose to activate assistance.</p></div><span className="rounded-xl bg-[#f8e9e4] p-3 text-[#bf5d48]"><Siren size={21} /></span></div>
        <span className="flex items-center gap-2 text-[11px] font-bold text-[#b84e3b]">Open SOS options <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
      </button>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6">
        <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">Heart rate trend</h3><p className="mt-1 text-[10px] text-[#96a29a]">Your recent readings · bpm</p></div><button onClick={() => onNavigate("records")} className="text-[10px] font-bold text-forest">View all <ArrowRight className="ml-1 inline" size={12} /></button></div>
        <div className="mt-4 h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 7, right: 8, left: -26, bottom: 0 }}><defs><linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#83b69a" stopOpacity={0.25} /><stop offset="100%" stopColor="#83b69a" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eff3ef" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#9aa69e", fontSize: 9 }} dy={8} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tick={{ fill: "#9aa69e", fontSize: 9 }} /><Tooltip contentStyle={{ border: "1px solid #e8ede8", borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="bpm" stroke="#438265" strokeWidth={2.5} fill="url(#hrFill)" activeDot={{ r: 4, fill: "#438265" }} /></AreaChart></ResponsiveContainer>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#86958c]"><span className="h-1.5 w-1.5 rounded-full bg-[#6aab80]" />Readings you logged — not a medical interpretation</div>
      </section>
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6">
        <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">Your health snapshot</h3><p className="mt-1 text-[10px] text-[#96a29a]">A few details worth keeping close</p></div><UserRound size={19} className="text-[#94a69a]" /></div>
        <div className="mt-4 space-y-3">
          <SnapshotRow title="Allergies" value={profile.allergies.join(", ") || "None added"} icon={AlertCircle} />
          <SnapshotRow title="Medical history" value={profile.medical_history.join(", ") || "None added"} icon={HeartPulse} />
          <SnapshotRow title="Current medications" value={`${medications.length} saved`} icon={Activity} />
        </div>
        <div className="mt-4 rounded-xl bg-[#f6f8f5] px-3.5 py-3"><div className="flex items-center gap-2 text-[10px] font-bold"><Clock3 size={13} className="text-forest" />Recent symptoms</div><div className="mt-2 text-[11px] text-[#728078]">{symptoms[0]?.description ?? "No symptoms logged recently"}{symptoms[0] && <span className="ml-2 text-[9px] text-[#a0aaa3]">· {dateLabel(symptoms[0].started_at)}</span>}</div></div>
      </section>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6">
        <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">Recent reports</h3><p className="mt-1 text-[10px] text-[#96a29a]">Your reports, explained in plain language</p></div><button onClick={() => onNavigate("reports")} className="text-[10px] font-bold text-forest">All reports <ArrowRight className="ml-1 inline" size={12} /></button></div>
        <div className="mt-3 divide-y divide-[#f0f3f0]">{reports.slice(0, 2).map((report) => <div key={report.id} className="flex items-center gap-3 py-3"><div className="rounded-xl bg-[#eef5ee] p-2.5 text-forest"><FileText size={16} /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{report.file_name}</div><div className="mt-1 text-[9px] text-[#95a198]">{report.report_type} · {dateLabel(report.created_at)}</div></div><ChevronRight size={16} className="text-[#a7b1aa]" /></div>)}</div>
      </section>
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6">
        <div><h3 className="text-[14px] font-bold">A copilot for your questions</h3><p className="mt-1 text-[10px] text-[#96a29a]">Understand your health info, one question at a time.</p></div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f3f7f2] p-3.5"><div className="rounded-xl bg-white p-2.5 text-forest shadow-sm"><Sparkles size={17} /></div><div className="flex-1 text-[10px] leading-5 text-[#7c8b82]">Ask about a health record, medication, or symptom.</div><button onClick={() => onNavigate("copilot")} className="rounded-xl bg-forest px-3.5 py-2.5 text-[10px] font-bold text-white hover:bg-[#184c3b]">Ask AI</button></div>
        <p className="mt-3 text-[9px] leading-4 text-[#9aa59e]">Health information only — not diagnosis or a replacement for your care team.</p>
      </section>
    </div>
  </div>;
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Heart }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-3"><div className="flex items-center justify-between gap-1 text-[9px] text-white/60">{label}<Icon size={13} className="shrink-0 text-white/70" /></div><div className="mt-2 text-[16px] font-bold tracking-[-.3px]">{value}</div></div>;
}
function SnapshotRow({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Heart }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#f0f3f0] p-3"><div className="rounded-lg bg-[#f1f6f1] p-2 text-forest"><Icon size={14} /></div><div className="min-w-0"><div className="text-[9px] text-[#97a49b]">{title}</div><div className="truncate text-[10px] font-semibold text-[#52645a]">{value}</div></div></div>;
}

function Copilot({ chat, question, busy, setQuestion, onSubmit, onClear }: { chat: ChatItem[]; question: string; busy: boolean; setQuestion: (value: string) => void; onSubmit: (event: FormEvent) => void; onClear: () => void }) {
  const [emergencyPending, setEmergencyPending] = useState(false);
  return <div className="mx-auto max-w-[900px]">
    <PageHeading eyebrow="CareCopilot" title="A thoughtful space for your questions" description="Get health information in plain language, grounded in the details you choose to share." action={chat.length ? <button onClick={onClear} className="flex items-center gap-2 self-start rounded-xl border border-[#dfe7e0] bg-white px-3.5 py-2.5 text-[10px] font-bold sm:self-auto"><X size={14} /> Clear chat</button> : undefined} />
    <div className="overflow-hidden rounded-[22px] border border-[#e8ede8] bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-[#eff2ef] px-5 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-forest"><Sparkles size={18} /></div><div className="flex-1"><div className="text-[12px] font-bold">CareCopilot</div><div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#8e9b93]"><span className="h-1.5 w-1.5 rounded-full bg-[#70ac7d]" />Here to help you understand</div></div><span className="rounded-full bg-[#f3f6f2] px-2.5 py-1 text-[9px] font-semibold text-[#819087]">Health information</span></div>
      <div className="min-h-[410px] space-y-4 p-5 md:p-7">
        {chat.length === 0 && <div className="mx-auto mt-7 max-w-[550px] text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#edf5ed] text-forest"><MessageCircle size={24} /></div><h2 className="mt-4 text-[17px] font-bold">What&apos;s on your mind?</h2><p className="mx-auto mt-2 max-w-[390px] text-[11px] leading-5 text-[#8c9a91]">I can help explain your health information and organize questions to discuss with your care team.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["What do my recent readings mean?", "Help me prepare for my next visit", "How can I track a new symptom?"].map((text) => <button key={text} onClick={() => setQuestion(text)} className="rounded-full border border-[#e8eee8] bg-white px-3 py-2 text-[9px] font-medium text-[#728078] hover:border-[#bad4c1] hover:text-forest">{text}</button>)}</div></div>}
        {chat.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[11px] leading-6 ${item.role === "user" ? "rounded-br-md bg-forest text-white" : "rounded-bl-md bg-[#f4f7f3] text-[#53655a]"}`}>
          {item.emergency && <div className="mb-3 rounded-xl border border-[#efc2b5] bg-[#fff2ee] p-3 text-[#9f3d2c]"><div className="flex items-center gap-2 text-[11px] font-bold"><Siren size={15} /> POTENTIAL EMERGENCY DETECTED</div><p className="mt-1 text-[10px] leading-5">Your symptoms may require urgent medical attention. Please seek help now.</p><button onClick={() => setEmergencyPending(true)} className="mt-2 rounded-lg bg-[#be4f3b] px-3 py-2 text-[9px] font-bold text-white">ACTIVATE EMERGENCY ASSISTANCE</button>{emergencyPending && <div className="mt-3 border-t border-[#efc2b5] pt-3 text-[10px] leading-5">Use the Emergency SOS button to review options and choose whether to share your location. If you may be in immediate danger, contact your local emergency number now.</div>}</div>}
          <p className="whitespace-pre-wrap">{item.message}</p><div className={`mt-1 text-[8px] ${item.role === "user" ? "text-white/60" : "text-[#a1aca4]"}`}>{item.role === "user" ? "You" : item.mode === "ai" ? "CareCopilot · AI response" : item.mode === "demo" ? "CareCopilot · Demo response" : item.mode === "safety" ? "CareCopilot · Safety guidance" : "CareCopilot"}</div></div></div>)}
        {busy && <div className="flex items-center gap-2 text-[10px] text-[#84928a]"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint text-forest"><Sparkles size={15} /></div><LoaderCircle size={14} className="animate-spin" />Thinking through your question…</div>}
      </div>
      <form onSubmit={onSubmit} className="border-t border-[#eff2ef] p-4 md:p-5"><div className="flex items-end gap-2 rounded-2xl border border-[#e4ebe4] bg-[#fbfcfb] p-2 focus-within:border-[#99bca2]"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(event); } }} rows={2} placeholder="Ask a question about your health information…" className="max-h-32 min-h-[45px] flex-1 resize-y bg-transparent px-2 py-2 text-[11px] outline-none placeholder:text-[#a5afa8]" /><button disabled={!question.trim() || busy} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-white transition hover:bg-[#184c3b] disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} /></button></div><div className="mt-2 flex items-start gap-1.5 px-1 text-[9px] leading-4 text-[#99a59d]"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-forest" />This is not a diagnosis. For urgent symptoms, contact local emergency services.</div></form>
    </div>
  </div>;
}

function Records({ records, symptoms, medications, onAdd }: { records: HealthRecord[]; symptoms: Symptom[]; medications: Medication[]; onAdd: (kind: "symptom" | "record" | "medication") => void }) {
  return <div><PageHeading eyebrow="Health tracking" title="Your health timeline" description="Keep the details that matter together, at your pace." action={<div className="flex flex-wrap gap-2"><button onClick={() => onAdd("symptom")} className="flex items-center gap-1.5 rounded-xl border border-[#dfe7e0] bg-white px-3 py-2.5 text-[10px] font-bold"><Plus size={14} /> Symptom</button><button onClick={() => onAdd("record")} className="flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-bold text-white"><Plus size={14} /> Add reading</button></div>} />
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6"><div className="mb-5"><h3 className="text-[14px] font-bold">Measurements & readings</h3><p className="mt-1 text-[10px] text-[#96a29a]">Personal records you have added</p></div><div className="overflow-x-auto"><table className="w-full min-w-[430px] text-left"><thead><tr className="border-b border-[#edf1ed] text-[9px] text-[#99a59d]"><th className="pb-3 font-semibold">MEASUREMENT</th><th className="pb-3 font-semibold">VALUE</th><th className="pb-3 font-semibold">DATE</th><th className="pb-3 font-semibold">NOTE</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-[#f1f3f1] last:border-0"><td className="py-3 text-[10px] font-semibold">{record.type}</td><td className="py-3 text-[10px]">{record.value} <span className="text-[#8f9c94]">{record.unit}</span></td><td className="py-3 text-[10px] text-[#819087]">{dateLabel(record.recorded_at)}</td><td className="py-3 text-[9px] text-[#9ba69f]">Self-recorded</td></tr>)}</tbody></table></div></section>
      <section className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6"><div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">Symptoms</h3><p className="mt-1 text-[10px] text-[#96a29a]">A record of what you&apos;ve noticed</p></div><button aria-label="Add symptom" onClick={() => onAdd("symptom")} className="rounded-lg bg-[#f0f5ef] p-2 text-forest"><Plus size={15} /></button></div><div className="mt-4 space-y-3">{symptoms.map((symptom) => <div key={symptom.id} className="rounded-xl border border-[#edf1ed] p-3"><div className="flex items-start justify-between"><div className="text-[11px] font-bold">{symptom.description}</div><span className="rounded-full bg-[#f3f5f2] px-2 py-1 text-[9px] text-[#819087]">Severity {symptom.severity}/5</span></div><div className="mt-2 text-[9px] text-[#97a39a]">Started {dateLabel(symptom.started_at)}</div></div>)}</div></section>
    </div>
    <section className="mt-4 rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-6"><div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">Medications</h3><p className="mt-1 text-[10px] text-[#96a29a]">Keep an up-to-date list to share with your care team.</p></div><button onClick={() => onAdd("medication")} className="flex items-center gap-1 rounded-xl border border-[#dfe7e0] px-3 py-2 text-[10px] font-bold"><Plus size={13} /> Add medication</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{medications.map((med) => <div key={med.id} className="flex items-center gap-3 rounded-xl bg-[#f7f9f6] p-3.5"><div className="rounded-lg bg-white p-2 text-forest"><Activity size={15} /></div><div><div className="text-[11px] font-bold">{med.name}</div><div className="mt-1 text-[9px] text-[#8b9990]">{med.dosage} · {med.frequency}</div></div></div>)}</div></section>
  </div>;
}

function Reports({ reports, busy, onUpload }: { reports: Report[]; busy: boolean; onUpload: (file: File) => void }) {
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  }
  return <div><PageHeading eyebrow="Your documents" title="Medical reports, made clearer" description="Keep your documents together and explore a plain-language overview." action={<label className="flex cursor-pointer items-center gap-2 self-start rounded-xl bg-forest px-4 py-2.5 text-[10px] font-bold text-white hover:bg-[#184c3b] sm:self-auto"><Upload size={14} /> Upload report<input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={chooseFile} /></label>} />
    <div className="mb-5 rounded-2xl border border-[#e8ede8] bg-[#f0f5ef] p-4 text-[10px] leading-5 text-[#64776b]"><div className="flex items-center gap-2 font-bold text-ink"><ShieldCheck size={15} className="text-forest" /> Your reports are personal</div><p className="mt-1">AI report scanning sends uploaded documents and extracted text to the configured provider. Demo scans are not saved to an account. Without an AI key, AI report scanning is unavailable. AI can miss context; always review results with a qualified clinician.</p></div>
    {busy && <div className="mb-4 flex items-center gap-2 text-[10px] text-[#829087]"><LoaderCircle className="animate-spin" size={15} />Analyzing your report…</div>}
    <div className="grid gap-4 md:grid-cols-2">{reports.map((report) => <article key={report.id} className="rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#edf5ed] p-3 text-forest"><FileText size={19} /></div><div className="min-w-0 flex-1"><div className="break-words text-[12px] font-bold">{report.file_name}</div><div className="mt-1 text-[9px] text-[#96a29a]">{report.report_type} · {dateLabel(report.created_at)}</div></div><MoreHorizontal size={17} className="text-[#9aa79f]" /></div><div className="mt-4 border-t border-[#eff2ef] pt-4"><div className="text-[9px] font-bold uppercase tracking-[1.1px] text-forest">Plain-language overview</div><div className="mt-2 space-y-2 text-[11px] leading-6 text-[#52645a] [&_h1]:mt-4 [&_h1]:text-[14px] [&_h1]:font-bold [&_h1]:text-forest [&_h2]:mt-4 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-forest [&_h3]:mt-4 [&_h3]:text-[12px] [&_h3]:font-bold [&_h3]:text-forest [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:pl-1"><ReactMarkdown>{formatReportMarkdown(report.ai_summary)}</ReactMarkdown></div><div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f7f8f6] p-3 text-[9px] leading-4 text-[#929e96]"><CircleHelp size={13} className="mt-0.5 shrink-0" />Consider discussing this report with your healthcare professional.</div></div></article>)}</div>
  </div>;
}

function DoctorSummary({ profile, symptoms, medications, records, reports, emergencyEvents }: { profile: Profile; symptoms: Symptom[]; medications: Medication[]; records: HealthRecord[]; reports: Report[]; emergencyEvents: EmergencyEvent[] }) {
  const [ready, setReady] = useState(false);
  return <div><PageHeading eyebrow="For your next visit" title="A clearer conversation starts here" description="A factual snapshot of the information in your health space." action={<div className="flex gap-2"><button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl border border-[#dfe7e0] bg-white px-3 py-2.5 text-[10px] font-bold"><Printer size={14} /> Print</button><button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-bold text-white"><Download size={14} /> Save as PDF</button></div>} />
    <div className="mx-auto max-w-[850px] rounded-[22px] border border-[#e8ede8] bg-white p-5 shadow-soft md:p-9 print:border-0 print:shadow-none"><div className="flex items-start justify-between border-b border-[#edf1ed] pb-5"><div><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[1.5px] text-forest"><Stethoscope size={13} /> Care visit companion</div><h2 className="mt-3 text-[20px] font-bold">Patient summary</h2><p className="mt-1 text-[10px] text-[#96a29a]">Prepared from information in this CareCopilot profile</p></div><div className="rounded-2xl bg-[#f2f6f1] px-4 py-3 text-right"><div className="text-[9px] text-[#93a097]">Prepared on</div><div className="mt-1 text-[10px] font-bold">{new Date().toLocaleDateString()}</div></div></div>
      <div className="grid gap-3 py-5 sm:grid-cols-2"><SummaryField label="Patient" value={profile.name} /><SummaryField label="Age" value={profile.age ? `${profile.age} years` : "Not provided"} /><SummaryField label="Blood group" value={profile.blood_group || "Not provided"} /><SummaryField label="Allergies" value={profile.allergies.join(", ") || "None recorded"} /><SummaryField label="Medical history" value={profile.medical_history.join(", ") || "None recorded"} /></div>
      <SummarySection title="Current medications">{medications.map((med) => <SummaryBullet key={med.id}>{med.name} — {med.dosage}, {med.frequency}</SummaryBullet>)}</SummarySection>
      <SummarySection title="Recent symptoms">{symptoms.slice(0, 5).map((symptom) => <SummaryBullet key={symptom.id}>{symptom.description} · severity {symptom.severity}/5 · started {dateLabel(symptom.started_at)}</SummaryBullet>)}</SummarySection>
      <SummarySection title="Recent health records">{records.slice(0, 8).map((record) => <SummaryBullet key={record.id}>{record.type}: {record.value} {record.unit} · {dateLabel(record.recorded_at)}</SummaryBullet>)}</SummarySection>
      <SummarySection title="Recent reports">{reports.slice(0, 5).map((report) => <SummaryBullet key={report.id}>{report.file_name} — {report.ai_summary}</SummaryBullet>)}</SummarySection>
      <SummarySection title="Recent emergency events">{emergencyEvents.slice(0, 5).map((event) => <SummaryBullet key={event.id}>User-activated assistance · {dateLabel(event.created_at)} · location {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)} · no services notified</SummaryBullet>)}{emergencyEvents.length === 0 && <SummaryBullet>None recorded</SummaryBullet>}</SummarySection>
      <div className="mt-5 rounded-2xl bg-[#f3f7f2] p-4"><div className="flex items-center gap-2 text-[11px] font-bold"><MessageCircle size={15} className="text-forest" />Questions to discuss</div><ul className="mt-2 list-disc space-y-1 pl-5 text-[10px] leading-5 text-[#738178]"><li>Review any changes or concerns since your last visit.</li><li>Confirm that your medication and allergy list is current.</li></ul></div>
      <div className="mt-5 border-t border-[#edf1ed] pt-4 text-[9px] leading-4 text-[#99a59d]">This summary contains patient-provided and demo information. It is not a diagnosis or a medical record verified by a clinician. Please review for accuracy before sharing.</div>
    </div>
    {!ready && <button onClick={() => setReady(true)} className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-[#dfe7e0] bg-white px-4 py-2.5 text-[10px] font-bold"><Check size={14} className="text-forest" /> Mark ready to share with my doctor</button>}
  </div>;
}
function SummaryField({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f7f9f6] p-3"><div className="text-[9px] text-[#96a29a]">{label}</div><div className="mt-1 text-[10px] font-semibold">{value}</div></div>; }
function SummarySection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-4"><h3 className="mb-2 text-[11px] font-bold">{title}</h3><div className="space-y-1.5">{children}</div></section>; }
function SummaryBullet({ children }: { children: React.ReactNode }) { return <div className="flex gap-2 text-[10px] leading-5 text-[#708077]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#79a88a]" />{children}</div>; }

function EmergencyPanel({ location, onClose }: { location: { latitude: number; longitude: number }; onClose: () => void }) {
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
  return <section className="mx-auto max-w-[900px] rounded-[22px] border border-[#efc4b8] bg-white p-5 shadow-soft md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#bd4f3d]"><Siren size={15} /> Emergency mode active</div><h1 className="mt-3 text-[24px] font-bold">Your location is ready</h1><p className="mt-2 max-w-[520px] text-[11px] leading-5 text-[#7f8c83]">You chose to share your location with this app. No emergency services or contacts have been notified.</p></div><button onClick={onClose} className="rounded-xl border border-[#e8ede8] p-2 text-[#7d8b82]" aria-label="Close emergency mode"><X size={17} /></button></div>
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#e8ede8]"><iframe title="Map showing your shared location" src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.012}%2C${location.latitude - 0.008}%2C${location.longitude + 0.012}%2C${location.latitude + 0.008}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`} className="h-[270px] w-full border-0" loading="lazy" /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ed] p-3"><div className="flex items-center gap-2 text-[10px] font-semibold"><MapPin size={14} className="text-[#c2513e]" />{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</div><a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-forest">Open map <ArrowRight size={12} className="ml-1 inline" /></a></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={callEmergencyServices} className="flex items-center justify-center gap-2 rounded-xl bg-[#c95140] px-4 py-3 text-[10px] font-bold text-white"><Siren size={15} />Call emergency services</button><button onClick={() => window.alert("Demo only: no emergency contact was sent. Please call your contact directly.")} className="flex items-center justify-center gap-2 rounded-xl border border-[#e5ebe5] px-4 py-3 text-[10px] font-bold"><MessageCircle size={15} />Alert emergency contact</button><a href={`https://www.openstreetmap.org/search?query=hospital%20near%20${location.latitude}%2C${location.longitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-[#e5ebe5] px-4 py-3 text-[10px] font-bold"><MapPin size={15} />Find nearby hospital</a></div>
    <p className="mt-4 text-center text-[9px] text-[#a0aaa3]">Calling and contact alert are user-initiated. CareCopilot does not dispatch emergency services.</p>
  </section>;
}

function Modal({ type, onClose, onEmergency, emergencyBusy, emergencyMessage, onSaved }: { type: "symptom" | "record" | "medication" | "emergency"; onClose: () => void; onEmergency: () => void; emergencyBusy: boolean; emergencyMessage: string; onSaved: (kind: string, value: Record<string, string | number>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    if (type === "symptom") {
      if (!form.description?.trim()) { setError("Add a short description."); return; }
      onSaved(type, { description: form.description, severity: Number(form.severity ?? 2), started_at: form.started_at || new Date().toISOString().slice(0, 10) });
    } else if (type === "record") {
      if (!form.type?.trim() || !form.value || !form.unit?.trim()) { setError("Complete the measurement, value, and unit."); return; }
      onSaved(type, { type: form.type, value: Number(form.value), unit: form.unit, recorded_at: new Date().toISOString().slice(0, 10) });
    } else {
      if (!form.name?.trim()) { setError("Add the medication name."); return; }
      onSaved(type, { name: form.name, dosage: form.dosage || "Not specified", frequency: form.frequency || "Not specified" });
    }
  }
  const title = type === "emergency" ? "Emergency assistance" : type === "symptom" ? "Log a symptom" : type === "record" ? "Add a health reading" : "Add a medication";
  const field = (key: string, label: string, placeholder: string, required = false, extra?: React.ReactNode) => <label className="block text-[10px] font-semibold text-[#62736a]">{label}{required && " *"}{extra ?? <input required={required} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-[#e5ebe5] bg-white px-3 py-2.5 text-[11px] text-ink outline-none focus:border-[#91b49b]" />}</label>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[440px] rounded-[22px] bg-white p-5 shadow-xl md:p-6"><div className="flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[1.4px] text-forest">{type === "emergency" ? "Your safety, your choice" : "Health timeline"}</div><h2 className="mt-2 text-[18px] font-bold">{title}</h2></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#91a097] hover:bg-[#f3f6f2]"><X size={17} /></button></div>
    {type === "emergency" ? <div><p className="mt-3 text-[11px] leading-5 text-[#7b8980]">If you may be in immediate danger, call your local emergency number. CareCopilot will not call anyone or share location unless you choose to.</p><div className="mt-4 rounded-xl bg-[#fff7f3] p-3.5 text-[10px] leading-5 text-[#946c62]"><div className="font-bold text-[#a24735]">🚨 Potential emergency</div><p className="mt-1">Your symptoms may require urgent medical attention. This is not a diagnosis.</p></div>{emergencyMessage && <p className="mt-3 rounded-xl bg-[#fff2ee] p-3 text-[10px] leading-5 text-[#a24735]">{emergencyMessage}</p>}<div className="mt-5 grid gap-2"><button onClick={onEmergency} disabled={emergencyBusy} className="flex items-center justify-center gap-2 rounded-xl bg-[#c95140] px-4 py-3 text-[11px] font-bold text-white disabled:opacity-60">{emergencyBusy ? <LoaderCircle className="animate-spin" size={15} /> : <MapPin size={15} />}ACTIVATE EMERGENCY ASSISTANCE</button><button onClick={callEmergencyServices} className="flex items-center justify-center gap-2 rounded-xl border border-[#e5ebe5] px-4 py-3 text-[11px] font-bold"><Siren size={15} />Call emergency services</button><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-[10px] font-semibold text-[#849188]">Cancel</button></div><p className="mt-1 text-center text-[9px] leading-4 text-[#a1aaa4]">Calling starts only after you enter and confirm your local emergency number.</p></div> :
      <form onSubmit={save} className="mt-4 space-y-3">
        {type === "symptom" && <>{field("description", "What have you noticed?", "e.g. Mild headache", true)}{field("started_at", "Start date", "", false, <input type="date" value={form.started_at ?? ""} onChange={(event) => setForm({ ...form, started_at: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e5ebe5] bg-white px-3 py-2.5 text-[11px]" />)}{field("severity", "Severity (1–5)", "", true, <select value={form.severity ?? "2"} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e5ebe5] bg-white px-3 py-2.5 text-[11px]">{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} · {["Very mild","Mild","Moderate","Strong","Severe"][value - 1]}</option>)}</select>)}</>}
        {type === "record" && <>{field("type", "Measurement", "Blood pressure, heart rate, weight…", true)}<div className="grid grid-cols-2 gap-3">{field("value", "Value", "e.g. 72", true)}{field("unit", "Unit", "e.g. bpm", true)}</div></>}
        {type === "medication" && <>{field("name", "Name", "e.g. Vitamin D3", true)}{field("dosage", "Dosage", "e.g. 1000 IU")}{field("frequency", "Frequency", "e.g. Once daily")}</>}
        {error && <p className="text-[10px] text-[#b94d3b]">{error}</p>}<div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#e5ebe5] px-4 py-3 text-[10px] font-bold">Cancel</button><button className="flex-1 rounded-xl bg-forest px-4 py-3 text-[10px] font-bold text-white">Save to timeline</button></div>
      </form>}
  </div></div>;
}
