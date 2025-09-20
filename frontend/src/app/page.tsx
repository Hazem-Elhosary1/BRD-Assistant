/* ==========================================================================
   File: Frontend.txt
   Note: Auto-organized comments & light formatting only — no logic changes.
   Generated: 2025-09-14 07:28:09
   ========================================================================== */

"use client";
// === Mermaid helpers (top-level) ===
function extractMermaidCode(input?: string | null): string | null {
  if (!input) return null;
  const str = String(input);
  const fenced = str.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = str.search(
    /\b(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram(?:-v2)?|erDiagram|pie)\b/i
  );
  if (start >= 0) {
    const rest = str.slice(start);
    const stop = rest.search(/```/);
    return (stop >= 0 ? rest.slice(0, stop) : rest).trim();
  }
  return null;
}

function cleanMermaidCode(input?: string | null): string {
  if (!input) return "";
  let code = String(input);

  // 1) اقتطع محتوى ```mermaid
  const block = code.match(/```mermaid\s*([\s\S]*?)```/i);
  if (block) code = block[1];

  // 2) إزالة الفينس/HTML
  code = code
    .replace(/```(?:mermaid)?/gi, "")
    .replace(/```/g, "")
    .replace(/<\/?[^>]+>/g, "");

  // 3) تطبيع newlines وعلامات الاتجاه الخفية
  code = code
    .replace(/\r\n/g, "\n")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .trim();

  // 4) قص من أول كلمة mermaid معروفة
  const firstKw = code.search(
    /\b(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram(?:-v2)?|erDiagram|pie)\b/i
  );
  if (firstKw > 0) code = code.slice(firstKw);

  // 5) حوّل الـ en/em-dash إلى hyphen **بدون** تغيير عدد الشرط
  code = code.replace(/[–—]/g, "-"); // فقط استبدال الحرف نفسه

  // 6) id(label...) -> id["label..."]
  const lines = code.split("\n").map((line) => {
    let l = line.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    l = l.replace(
      /([A-Za-z\u0600-\u06FF_][\w\u0600-\u06FF-]*?)\s*\(([^()]*)\)(?=(?:\s*(?:-->|---|===|-\.-|-\->|--o|--x|\)|\s|$)))/g,
      (_m, id, label) => {
        const safe = String(label)
          .replace(/\\?"/g, '\\"') // اهرب "
          .replace(/\]/g, "\\]") // اهرب ] لو ظهرت داخل اللابل
          .trim();
        return `${id}["${safe}"]`;
      }
    );
    return l;
  });
  code = lines.join("\n");

  // 7) لو مفيش header زوّد واحد
  if (!/^(graph|flowchart)\s+/i.test(code)) code = `graph LR\n${code}`;

  return code.trim();
}

// -------------------- Imports --------------------
import React, {
  // ------------------ End Imports ------------------
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type DetailedHTMLProps,
  type HTMLAttributes,
} from "react";
// -------------------- Imports --------------------
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  // ------------------ End Imports ------------------
  Loader2,
  Upload,
  Wand2,
  ListChecks,
  Wrench,
  Plus,
  FileText,
  FileDown,
  Send,
  Settings,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  Activity,
  Download,
  Lightbulb,
  Moon,
  Clipboard,
  Check,
  Sun,
  Monitor,
  ArrowUp,
  ArrowDown ,
  Clock3,
} from "lucide-react";
// -------------------- Imports --------------------
import clsx from "clsx";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
// ------------------ End Imports ------------------
type Priority = "P1" | "P2" | "P3" | "P4";

/* -------------------------- Config -------------------------- */
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
// Component
function getApiBase() {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  return localStorage.getItem("api_base") || DEFAULT_API_BASE;
}

/* -------------------------- Types -------------------------- */
type Thread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  draft?: string;
  updatedAt: number;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
  timestamp?: number; // إضافة التوقيت
};
type Story = {
  id?: number | string;
  title: string;
  description?: string;
  acceptance_criteria?: string[];
};

type Insights = { gaps: string[]; risks: string[]; metrics: string[] };
type Status = {
  hasBrd: boolean;
  storyCount: number;
  lastUploadedAt: string | null;
};

/* -------------------------- Utils -------------------------- */

// Component
function statusBorderClass(s: "ok" | "fail" | "loading") {
  // كلاس لتلوين حدود أي عنصر (أفاتار/صورة...) حسب حالة الاتصال
  return clsx(
    "ring-2",
    s === "ok" && "ring-emerald-500",
    s === "fail" && "ring-red-500 animate-pulse",
    s === "loading" && "ring-yellow-400"
  );
}

// Component
function extractError(obj: unknown): string | undefined {
  if (obj && typeof obj === "object" && "error" in obj) {
    const val = (obj as Record<string, unknown>).error;
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}
// Component
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "حدث خطأ غير متوقع";
  }
}
// Component
function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-blue-600", className)} />;
}
// Component
function getHeaders(extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...(extra || {}) };
  if (typeof window !== "undefined") {
    const key = localStorage.getItem("brd_api_key");
    if (key) h["x-api-key"] = key;
  }
  return h;
}
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: getHeaders(init?.headers as Record<string, string> | undefined),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d: unknown = await res.json();
      const apiErr = extractError(d);
      msg = apiErr ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
// Component
function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 45000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  const merged: RequestInit = {
    ...init,
    signal: ctrl.signal,
    headers: getHeaders(init.headers as Record<string, string> | undefined),
  };
  return fetch(url, merged).finally(() => clearTimeout(id));
}
async function readSSEStream(
  res: Response,
  onChunk: (text: string) => void
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === '"[DONE]"') return;
      try {
        onChunk(JSON.parse(payload));
      } catch {
        /* ignore non-json heartbeats */
      }
    }
  }
}

/* -------------------------- Page -------------------------- */
const LS_KEYS = {
  threads: "brd_threads",
  activeThreadId: "brd_active_thread",
  stories: "brd_stories",
  insights: "brd_insights",
};

function safeParse<T>(v: string | null, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 400) {
  let t: number | undefined;
  return (...args: A) => {
    if (t !== undefined) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

// ---------------- Root Component ----------------
export default function Home() {
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const saveThreadTitle = () => {
    if (!activeThreadId) return;
    const v = titleDraft.trim();
    if (!v) return setTitleEditing(false);
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId ? { ...t, title: v, updatedAt: Date.now() } : t
      )
    );
    setTitleEditing(false);
  };

  const idRef = useRef(1);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // ===== Threads state =====
  const greeting: ChatMessage = {
    id: idRef.current++,
    role: "assistant",
    content: "أهلًا! ارفع الـBRD أو ابعتلي نص، وأنا هساعدك.",
    timestamp: Date.now(),
  };
  const [modalTag, setModalTag] = useState<Tag>("None");
  // أعلى الكومبوننت مع باقي الstates
  const [formTag, setFormTag] = useState<Tag>("None"); // ⬅️ جديد
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [epicId, setEpicId] = useState<string>("");

  // ===== ADO Settings =====
  const [adoOrg, setAdoOrg] = useState<string>("");
  const [adoPat, setAdoPat] = useState<string>(""); // سري
  const [adoProject, setAdoProject] = useState<string>(""); // اسم أو ID
  const [adoProjects, setAdoProjects] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const isAdoConnected = !!adoOrg && !!adoPat; // مشروع اختياري لحد ما تختاره
  // helper لقراءة الثريد الحالي
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  useEffect(() => {
    setTitleDraft(activeThread?.title ?? "");
  }, [activeThreadId, activeThread?.title]);
  // رسالة ترحيب لكل ثريد جديد
  const makeGreeting = useCallback(
    (): ChatMessage => ({
      id: idRef.current++,
      role: "assistant",
      content: "أهلًا! ارفع الـBRD أو ابعتلي نص، وأنا هساعدك.",
      timestamp: Date.now(),
    }),
    []
  );

  const createThread = useCallback(() => {
    const t: Thread = {
      id: crypto?.randomUUID?.() ?? String(Date.now()),
      title: `محادثة ${threads.length + 1}`,
      messages: [makeGreeting()],
      draft: "",
      updatedAt: Date.now(),
    };
    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.id);
  }, [threads.length, makeGreeting, setThreads, setActiveThreadId]);

  const renameThread = useCallback((id: string) => {
    const name = prompt("اسم المحادثة؟");
    if (!name) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: name } : t))
    );
  }, []);

  const deleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        // لو بتحذف الثريد النشط، انقل لأول واحد متبقّي
        if (activeThreadId === id) {
          setActiveThreadId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeThreadId, setActiveThreadId]
  );

  // اختياري: لو اتصفّر كل شيء، أنشئ ثريد جديد تلقائيًا
  useEffect(() => {
    if (threads.length === 0) createThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.length]);

  // ⚠️ ترحيل قديم: لو عندك LS للمessages القديمة هنحوّله لأول ثريد
  useEffect(() => {
    const savedThreads = safeParse<Thread[]>(
      localStorage.getItem(LS_KEYS.threads),
      []
    );
    const savedActive = localStorage.getItem(LS_KEYS.activeThreadId);

    if (savedThreads.length) {
      setThreads(savedThreads);
      setActiveThreadId(savedActive || savedThreads[0]?.id || null);
      return;
    }

    // ترحيل من المفتاح القديم brd_messages إن وجد
    const legacyMsgs = safeParse<ChatMessage[]>(
      localStorage.getItem("brd_messages"),
      []
    );
    const messages = activeThread?.messages ?? [];

    const initialThread: Thread = {
      id: crypto?.randomUUID?.() ?? String(Date.now()),
      title: "محادثة جديدة",
      messages: legacyMsgs.length ? legacyMsgs : [greeting],
      updatedAt: Date.now(),
    };
    setThreads([initialThread]);
    setActiveThreadId(initialThread.id);

    // تنظيف القديم اختيارياً
    localStorage.removeItem("brd_messages");
  }, []);

  function updateActiveThreadMessages(
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return { ...t, messages: updater(t.messages), updatedAt: Date.now() };
      })
    );
  }

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [dark, setDark] = useState(false);
  const [input, setInput] = useState("");
  useEffect(() => {
    setInput(activeThread?.draft ?? "");
    requestAnimationFrame(resetComposerHeight);
  }, [activeThreadId]);
  // حفظ الدرافت تلقائيًا كل 700ms
  const persistDraft = useMemo(
    () =>
      debounce((val: string) => {
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== activeThreadId) return t;
            return { ...t, draft: val };
          })
        );
      }, 700),
    [activeThreadId]
  );

  useEffect(() => {
    persistDraft(input);
  }, [input, persistDraft]);
  // ===== Azure DevOps Settings =====
  const [adoBase, setAdoBase] = useState(""); // مثال: https://azure.2p.com.sa
  const [adoCollection, setAdoCollection] = useState(""); // اختياري: DefaultCollection/Projects أو فاضي
  const [sendLoading, setSendLoading] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [patchLoading, setPatchLoading] = useState(false);
  const [appendLoading, setAppendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showFlowchart, setShowFlowchart] = useState(false);
  // === ADO Console state ===
  const [showAdoConsole, setShowAdoConsole] = useState(false);
  const [adoEpics, setAdoEpics] = useState<
    Array<{ id: number; title: string }>
  >([]);
  const [adoFeatures, setAdoFeatures] = useState<
    Array<{ id: number; title: string; parentUrl?: string | null }>
  >([]);
  const [pickEpicId, setPickEpicId] = useState<number | null>(null);
  const [pickFeatureId, setPickFeatureId] = useState<number | null>(null);
  const [newEpic, setNewEpic] = useState("");
  const [newFeature, setNewFeature] = useState("");
  const [adoBusy, setAdoBusy] = useState(false);

  // Priority للستوري أثناء البوش
  const [storyPriority, setStoryPriority] = useState<number | "">("");

  const [mermaidCode, setMermaidCode] = useState("");
  const [mermaidSvg, setMermaidSvg] = useState("");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [brdId, setBrdId] = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [open, setOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAC, setFormAC] = useState("");
  const [adoModalOpen, setAdoModalOpen] = useState(false);
  const isBrowser = typeof window !== "undefined";
  const getLS = (k: string) => (isBrowser ? localStorage.getItem(k) ?? "" : "");
  const [serverStatus, setServerStatus] = useState<"ok" | "fail" | "loading">(
    "loading"
  );
  // حالة اتصال OpenAI
  const [openAIStatus, setOpenAIStatus] = useState<"ok" | "fail" | "loading">(
    "loading"
  );
  const [openAIError, setOpenAIError] = useState<string | null>(null);

  const [opProgress, setOpProgress] = useState<number | null>(null);
  const [opBubble, setOpBubble] = useState<null | {
    type: "summarize" | "stories";
    msgId: number;
  }>(null);
  const [persistEnabled] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  type UploadTask = {
    name: string;
    progress: number;
    status: "uploading" | "done" | "error";
  };
  // =============== Story Tags (local only) ===============
  type SortMode = "recent" | "oldest" | "az" | "za" | "with-ac";

  type Tag = "None" | "Critical" | "Enhancement" | "Blocked";
  const [storyTags, setStoryTags] = useState<Record<string | number, Tag>>({});
  const [filterTag, setFilterTag] = useState<Tag | "All">("All");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const resetComposerHeight = () => {
    const ta = composerRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  };
  useEffect(() => {
    const saved =
      (localStorage.getItem("theme") as "system" | "light" | "dark") ||
      "system";
    setTheme(saved);
  }, []);
  useEffect(() => {
    async function checkServer() {
      setServerStatus("loading");
      try {
        const res = await fetch(getApiBase());
        if (res.ok) setServerStatus("ok");
        else setServerStatus("fail");
      } catch {
        setServerStatus("fail");
      }
    }
    checkServer();
    const interval = setInterval(checkServer, 15000); // كل 15 ثانية
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mermaidCode) return;

    let aborted = false; // لو اتغيرت الحالة قبل ما نكمّل

    try {
      const cleaned = cleanMermaidCode(mermaidCode);
      if (!cleaned) {
        setFlowError("الكود بعد التنظيف أصبح فارغًا.");
        setMermaidSvg("");
        return;
      }

      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
      });

      // جرّب parse قبل render — مع محاولة إنقاذ

      let finalCode = cleaned;
      try {
        mermaid.parse?.(finalCode);
      } catch (e) {
        const retry = cleaned.replace(/^[\s\S]*?\b(graph|flowchart)\b/i, "$1");
        mermaid.parse?.(retry); // لو فشلت هترمي نفس الاستثناء
        finalCode = retry; // ✅ استخدم النسخة المصحّحة
      }

      const renderId = `mmd-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      mermaid
        .render(renderId, finalCode) // ✅ رندر بالـ finalCode
        .then(({ svg }) => {
          if (aborted) return;
          setMermaidSvg(svg);
          setFlowError(null);
        })
        .catch((err) => {
          if (aborted) return;
          setFlowError(
            typeof err?.message === "string" ? err.message : "فشل رندر الرسم."
          );
          setMermaidSvg("");
        });
    } catch (err: unknown) {
      if (!aborted) {
        setFlowError((err as Error)?.message || "فشل في معالجة كود الرسم.");
        setMermaidSvg("");
      }
    }

    return () => {
      aborted = true;
    };
  }, [mermaidCode]);

  // فحص اتصال OpenAI عبر مسار /openai/health وإرسال الـ API Key من الإعدادات
  useEffect(() => {
    async function checkOpenAI() {
      setOpenAIStatus("loading");
      setOpenAIError(null);
      try {
        const res = await fetch(`${getApiBase()}/openai/health`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          try {
            const d = await res.json();
            if (d && (d.status === "ok" || d.ok === true)) {
              setOpenAIStatus("ok");
            } else {
              setOpenAIStatus("ok");
            }
          } catch {
            setOpenAIStatus("ok");
          }
        } else {
          let reason = `HTTP ${res.status}`;
          try {
            const d = await res.json();
            const msg = d?.error?.message || d?.message;
            if (msg) reason = msg;
          } catch {}
          setOpenAIStatus("fail");
          setOpenAIError(reason);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
        setOpenAIStatus("fail");
        setOpenAIError(msg);
      }
    }
    checkOpenAI();
    const id = setInterval(checkOpenAI, 15000);
    return () => clearInterval(id);
  }, []);
  function openModal(story: Story) {
    setSelectedStory(story);
    setEditMode(false); // ← يبدأ كعرض فقط
    setOpen(true);
  }
  function openStoryModal(story: Story) {
    setSelectedStory(story);
    setFormTitle(story.title ?? "");
    setFormDesc(story.description ?? "");
    setFormAC(
      Array.isArray(story.acceptance_criteria)
        ? story.acceptance_criteria.join("\n")
        : (story.acceptance_criteria as unknown as string) ?? ""
    );
    const current = storyTags[story.id ?? story.title] ?? "None";
    setFormTag(current as Tag);
    setEditMode(false);
    setOpen(true);
  }

  function closeModal() {
    setSelectedStory(null);
    setOpen(false);
  }
  // لما تفتح المودال حبّيذ تملَى الفورم من الستوري المختارة
  useEffect(() => {
    if (!selectedStory) {
      setFormTitle("");
      setFormDesc("");
      setFormAC("");
      return;
    }
    setFormTitle(selectedStory.title ?? "");

    setFormDesc(selectedStory.description ?? "");
    setFormAC(
      Array.isArray(selectedStory.acceptance_criteria)
        ? selectedStory.acceptance_criteria.join("\n")
        : selectedStory.acceptance_criteria ?? ""
    );
  }, [selectedStory]);

  async function saveStory() {
    if (!selectedStory) return;
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        acceptance_criteria: formAC
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter(Boolean),
        // لو الباك إند بيدعم التاج فعّله
        // tag: formTag,
      };

      const res = await fetch(`${getApiBase()}/stories/${selectedStory.id}`, {
        method: "PUT",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);

      // حدِّث اللستة (يا إمّا re-fetch يا إمّا local)
      await refreshStories?.();
      // أو بديلًا:
      // setStories(list => list.map(x => x.id===selectedStory.id ? {...x, ...payload} : x));

      // ✅ حدِّث التاج المحلي بعد نجاح الحفظ
      const key = selectedStory.id ?? selectedStory.title;
      setTag(key, formTag);

      setEditMode(false);
      toast.success("تم حفظ التعديل بنجاح");
      // لو تحب تقفل المودال بعد الحفظ:
      // setOpen(false);
    } catch (e) {
      toast.error("فشل حفظ التعديل");
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteStory() {
    if (!selectedStory?.id) return;
    try {
      const res = await fetch(`${getApiBase()}/stories/${selectedStory.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Delete failed: ${res.status} ${msg}`);
      }

      setStories((list) => list.filter((x) => x.id !== selectedStory.id));
      await refreshStories?.();
      toast.success("تم الحذف");
      closeModal();
    } catch {
      toast.error("فشل الحذف");
    }
  }
  async function loadEpicsAndFeatures(epicId?: number | null) {
    setAdoBusy(true);
    try {
      const ep = await fetch(`${getApiBase()}/ado/epics`, {
        headers: adoHeaders(),
      }).then((r) => r.json());
      setAdoEpics(ep);

      const featuresUrl =
        typeof epicId === "number"
          ? `${getApiBase()}/ado/features?epicId=${epicId}`
          : `${getApiBase()}/ado/features`;

      const ft = await fetch(featuresUrl, { headers: adoHeaders() }).then((r) =>
        r.json()
      );
      setAdoFeatures(ft);

      if (typeof epicId === "number") setPickEpicId(epicId);
    } finally {
      setAdoBusy(false);
    }
  }

  async function createEpic() {
    if (!newEpic.trim()) return;
    setAdoBusy(true);
    try {
      await fetch(`${getApiBase()}/ado/epics`, {
        method: "POST",
        headers: adoHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title: newEpic.trim() }),
      }).then((r) => r.json());
      setNewEpic("");
      await loadEpicsAndFeatures();
    } finally {
      setAdoBusy(false);
    }
  }

  async function createFeature() {
    if (!newFeature.trim()) return;
    setAdoBusy(true);
    try {
      await fetch(`${getApiBase()}/ado/features`, {
        method: "POST",
        headers: adoHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: newFeature.trim(),
          epicId: pickEpicId ?? undefined,
        }),
      }).then((r) => r.json());
      setNewFeature("");
      await loadEpicsAndFeatures(pickEpicId ?? undefined);
    } finally {
      setAdoBusy(false);
    }
  }

  async function pushCurrentStoryToADO() {
    if (!selectedStory || !pickFeatureId) {
      toast.error("اختر Feature أولاً");
      return;
    }
    setAdoBusy(true);
    try {
      const body = {
        featureId: Number(pickFeatureId),
        stories: [
          {
            title: selectedStory.title,
            description: selectedStory.description,
            acceptance_criteria: selectedStory.acceptance_criteria || [],
            priority: storyPriority || undefined,
            // لو حابب تبعت Tags من التاج المحلي:
            // tags: (storyTags[selectedStory.id ?? selectedStory.title] ? [storyTags[selectedStory.id ?? selectedStory.title]] : [])
          },
        ],
      };
      const res = await fetch(`${getApiBase()}/ado/stories/bulk`, {
        method: "POST",
        headers: adoHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("تم دفع الستوري إلى ADO");
      setShowAdoConsole(false);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return "";
              }
            })();

      toast.error(`فشل الدفع: ${msg || "خطأ غير معروف"}`);
    } finally {
      setAdoBusy(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme"); // يتبع prefers-color-scheme
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);
  useEffect(() => {
    const saved = safeParse<Record<string | number, Tag>>(
      localStorage.getItem("brd_story_tags"),
      {}
    );
    setStoryTags(saved);
  }, []);
  const copyMessage = async (id: number, text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // سياق غير آمن أو المتصفح لا يدعم Clipboard API: استخدم fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand(copy) failed");
      }
      setCopiedId(id);
      toast.success("تم نسخ الرسالة");
      setTimeout(() => setCopiedId(null), 1200);
    } catch (e) {
      toast.error("تعذّر النسخ" + (e instanceof Error ? `: ${e.message}` : ""));
    }
  };

  useEffect(() => {
    localStorage.setItem("brd_story_tags", JSON.stringify(storyTags));
  }, [storyTags]);

  const setTag = (id: string | number | undefined, tag: Tag) => {
    if (id == null) return;
    setStoryTags((m) => ({ ...m, [id]: tag }));
  };
// ⬇️ برا أي دالة/هوك، جوّه نفس الـComponent
const scrollToTop = useCallback(() => {
  const el = chatRef.current;
  if (!el) return;
  el.scrollTo({ top: 0, behavior: "smooth" });
}, []);

const scrollToBottom = useCallback(() => {
  const el = chatRef.current;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}, []);

const onChatScroll = useCallback(() => {
  const el = chatRef.current;
  if (!el) return;

  const nearTop = el.scrollTop <= 16;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  const hasOverflow = el.scrollHeight > el.clientHeight + 40;

  if (nearTop) {
    // أنا فوق → خلّي الزر "ينزل لتحت"
    setJumpDir("down");
    setShowScrollTop(hasOverflow);
  } else if (nearBottom) {
    // أنا تحت → خلّي الزر "يطلع لفوق"
    setJumpDir("up");
    setShowScrollTop(hasOverflow);
  } else {
    // في النص: نفس سلوكك القديم
    setJumpDir("up");
    setShowScrollTop(el.scrollTop > 200);
  }
}, []);

  const tagColor = (t: Tag) =>
    t === "Critical"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-[#2a1212] dark:text-[#ffb4b4] dark:border-[#4c1f1f]"
      : t === "Enhancement"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : t === "Blocked"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-50 text-slate-700 border-line";

  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [backlogQuery, setBacklogQuery] = useState("");
  const [uploadId, setUploadId] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [insights, setInsights] = useState<Insights>({
    gaps: [],
    risks: [],
    metrics: [],
  });
  const [status, setStatus] = useState<Status>({
    hasBrd: false,
    storyCount: 0,
    lastUploadedAt: null,
  });

  // Pagination (Backlog)

  // Modals & settings
  const [patchOpen, setPatchOpen] = useState(false);
  const [appendOpen, setAppendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [patchSection, setPatchSection] = useState("");
  const [patchInstruction, setPatchInstruction] = useState("");
  const [appendType, setAppendType] = useState<"story" | "feature">("story");
  const [appendText, setAppendText] = useState("");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiBaseInput, setApiBaseInput] = useState<string>("");
  // Quick command bubbles
  const [jumpDir, setJumpDir] = useState<'up' | 'down'>('up');

  const helpCmds = [
    {
      label: "تلخيص",
      insert: "/summarize",
      icon: <Wand2 className="w-3.5 h-3.5" />,
    },
    {
      label: "Stories",
      insert: "/stories",
      icon: <ListChecks className="w-3.5 h-3.5" />,
    },
    {
      label: "Insights",
      insert: "/insights",
      icon: <Lightbulb className="w-3.5 h-3.5" />,
    },
    {
      label: "Export PDF",
      insert: "/export pdf",
      icon: <FileDown className="w-3.5 h-3.5" />,
    },
    {
      label: "Export Docx",
      insert: "/export docx",
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      label: "Export JSON",
      insert: "/export json",
      icon: <Download className="w-3.5 h-3.5" />,
    },
  ];
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const t = input.trim();
    setShowHelp(t.startsWith("/"));
  }, [input]);

  const overlayBusy = isUploading || patchLoading || appendLoading;
  const showOverlay = overlayBusy && !patchOpen && !appendOpen && !settingsOpen;
  const [zoomed, setZoomed] = useState(false);
  // Drag & Drop
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!patchOpen && !appendOpen && !settingsOpen) {
      composerRef.current?.focus();
    }
  }, [patchOpen, appendOpen, settingsOpen]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeThread?.messages]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdoBase(localStorage.getItem("ado_base") || "");
    setAdoCollection(localStorage.getItem("ado_collection") || "");
    setAdoOrg(localStorage.getItem("ado_org") || "");
    setAdoProject(localStorage.getItem("ado_project") || "");
    setAdoPat(sessionStorage.getItem("ado_pat") || "");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sKey = localStorage.getItem("brd_api_key") || "";
      setApiKey(sKey);
      setApiBaseInput(getApiBase());
    }
  }, []);
  // ===== Backlog toolbar state =====
  type SortBy = "latest" | "oldest" | "title-asc" | "title-desc" | "tag";
  const [sortBy, setSortBy] = useState<SortBy>("latest");

  const filteredStories = useMemo(() => {
    const q = backlogQuery.trim().toLowerCase();

    const norm = (v: unknown): string => {
      if (Array.isArray(v)) return v.map(norm).join(" ");
      if (v == null) return "";
      return String(v);
    };

    // 1) فلترة بالنص + التاج
    const arr = stories.filter((s) => {
      const matchesText =
        !q ||
        [s.title, s.description, s.acceptance_criteria]
          .filter((x) => x != null)
          .some((t) => norm(t).toLowerCase().includes(q));

      const matchesTag =
        filterTag === "All" ||
        (storyTags[s.id ?? s.title] ?? "None") === filterTag;

      return matchesText && matchesTag;
    });

    // 2) ترتيب
    const tagRank: Record<Tag, number> = {
      Critical: 0,
      Enhancement: 1,
      Blocked: 2,
      None: 3,
    };

    arr.sort((a, b) => {
      if (sortBy === "title-asc")
        return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "title-desc")
        return (b.title || "").localeCompare(a.title || "");
      if (sortBy === "tag") {
        const ta = (storyTags[a.id ?? a.title] ?? "None") as Tag;
        const tb = (storyTags[b.id ?? b.title] ?? "None") as Tag;
        const r = tagRank[ta] - tagRank[tb];
        if (r !== 0) return r;
        return (a.title || "").localeCompare(b.title || "");
      }
      // latest / oldest: استخدم id كبديل للوقت (لو عندك createdAt استعمله بدلًا منه)
      const ida = Number(a.id) || 0;
      const idb = Number(b.id) || 0;
      return sortBy === "latest" ? idb - ida : ida - idb;
    });

    return arr;
  }, [stories, backlogQuery, filterTag, sortBy, storyTags]);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredStories.length / pageSize));
  const pagedStories = useMemo(
    () => filteredStories.slice((page - 1) * pageSize, page * pageSize),
    [filteredStories, page]
  );

  useEffect(() => {
    const pc = Math.max(1, Math.ceil(filteredStories.length / pageSize));
    if (page > pc) setPage(pc);
  }, [filteredStories, page, pageSize]);

  // Load persisted
  useEffect(() => {
    if (!persistEnabled) return;

    // اقرأ الثريدات
    const savedThreads = safeParse<Thread[]>(
      localStorage.getItem(LS_KEYS.threads),
      []
    );
    const savedActive = localStorage.getItem(LS_KEYS.activeThreadId);

    if (savedThreads.length) {
      setThreads(savedThreads);
      setActiveThreadId(savedActive || savedThreads[0]?.id || null);
      return;
    }

    // --- Migration من المفتاح القديم brd_messages ---
    const legacyMsgs = safeParse<ChatMessage[]>(
      localStorage.getItem("brd_messages"),
      []
    );
    if (legacyMsgs.length) {
      const initialThread: Thread = {
        id: crypto?.randomUUID?.() ?? String(Date.now()),
        title: "محادثة قديمة",
        messages: legacyMsgs,
        draft: "",
        updatedAt: Date.now(),
      };
      setThreads([initialThread]);
      setActiveThreadId(initialThread.id);

      // ممكن تنظف المفتاح القديم بعد ما تهاجر
      localStorage.removeItem("brd_messages");
    }
  }, [persistEnabled]);

  // ========== Dark Mode ==============
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved
      ? saved === "dark"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  /* ---------------- Data loaders ---------------- */
  const refreshInsights = useCallback(async () => {
    try {
      setInsights(await fetchJSON<Insights>(`${getApiBase()}/insights`));
    } catch {}
  }, []);
  const refreshStories = useCallback(async () => {
    try {
      const data = await fetchJSON<{ stories: Story[] }>(
        `${getApiBase()}/stories`
      );
      setStories(data.stories || []);
    } catch {}
  }, []);
  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchJSON<Status>(`${getApiBase()}/status`);
      setStatus(data);
    } catch {
      setStatus({ hasBrd: false, storyCount: 0, lastUploadedAt: null });
    }
  }, []);
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshInsights(), refreshStories()]);
  }, [refreshStatus, refreshInsights, refreshStories]);

  const submitPatch = useCallback(async (): Promise<void> => {
    if (!status.hasBrd) {
      toast.info("ارفع BRD الأول.");
      return;
    }
    if (!patchSection.trim() || !patchInstruction.trim()) return;

    setPatchLoading(true);
    setError(null);
    try {
      await fetchJSON(`${getApiBase()}/brd/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: patchSection,
          instruction: patchInstruction,
        }),
      });

      updateActiveThreadMessages((p) => [
        ...p,
        {
          id: idRef.current++,
          role: "assistant",
          content: "تم تعديل الجزء المطلوب.",
        },
      ]);

      setPatchOpen(false);
      setPatchSection("");
      setPatchInstruction("");

      await refreshAll();
      toast.success("تم الحفظ");
    } catch (e: unknown) {
      const msg = errorMessage(e) || "فشل التعديل";
      toast.error(msg);
      setError(msg);
    } finally {
      setPatchLoading(false);
    }
  }, [status.hasBrd, patchSection, patchInstruction, refreshAll]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Persist messages
  // Persist threads
  const persistThreads = useMemo(
    () =>
      debounce((data: Thread[]) => {
        localStorage.setItem(LS_KEYS.threads, JSON.stringify(data));
      }, 500),
    []
  );

  // حفظ الثريدز و الـ activeThreadId
  useEffect(() => {
    persistThreads(threads);
    if (activeThreadId) {
      localStorage.setItem(LS_KEYS.activeThreadId, activeThreadId);
    }
  }, [threads, activeThreadId, persistThreads]);

  // لو مش عندك بالفعل:
  function extractMermaidCode(content: string): string | null {
    const m = content.match(/```mermaid([\s\S]*?)```/i);
    return m ? m[1].trim() : null;
  }

  // التقاط آخر كود mermaid من ردود المساعد ورسمه
  useEffect(() => {
    const lastMermaid = activeThread?.messages
      .filter((m) => m.role === "assistant")
      .map((m) => extractMermaidCode(m.content))
      .filter(Boolean)
      .at(-1);

    if (!lastMermaid) return;

    setMermaidCode(lastMermaid); // خزّن الكود الخام

    try {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      const code = cleanMermaidCode(lastMermaid);
      mermaid
        .render(`ai-flowchart-svg-${Date.now()}`, code)
        .then(({ svg }) => setMermaidSvg(svg));
    } catch (err) {
      console.error(err);
      toast?.error?.("Mermaid syntax error");
      setMermaidSvg("");
    }
  }, [activeThread?.messages]);

  // ===== Persist stories =====
  const persistStories = useMemo(
    () =>
      debounce((data: Story[]) => {
        localStorage.setItem(LS_KEYS.stories, JSON.stringify(data));
      }, 500),
    []
  );

  useEffect(() => {
    if (!persistEnabled) return;
    persistStories(stories);
  }, [stories, persistEnabled, persistStories]);

  // ===== Persist insights =====
  const persistInsights = useMemo(
    () =>
      debounce((data: Insights) => {
        localStorage.setItem(LS_KEYS.insights, JSON.stringify(data));
      }, 500),
    []
  );

  useEffect(() => {
    if (!persistEnabled) return;
    persistInsights(insights);
  }, [insights, persistEnabled, persistInsights]);

  /* ---------------- Upload ---------------- */
  async function handleUpload(file: File) {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${getApiBase()}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الرفع");
      }

      if (!data.brdId) {
        throw new Error("السيرفر لم يرجّع brdId");
      }
      setBrdId(Number(data.brdId));

      setBrdId(Number(data.brdId)); // خزّن الـ brdId في state
      toast.success(`تم رفع ${file.name}`);
    } catch (e: unknown) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setIsUploading(false);
    }
  }

  const onPickFile = useCallback(() => {
    fileRef.current?.click();
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      await doUpload(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  // === Thread auto-naming (from BRD filename) ===
  const basename = (n: string) => n.replace(/\.[^./\\]+$/i, "").trim();

  const isDefaultThreadTitle = (t?: string) => {
    const s = (t || "").trim();
    return (
      s === "" ||
      /^محادثة/.test(s) || // "محادثة جديدة/قديمة/..."
      /^Untitled/i.test(s) ||
      /^New chat/i.test(s)
    );
  };

  const renameActiveThreadIfDefault = useCallback(
    (newTitle: string) => {
      if (!activeThreadId) return;
      const title = basename(newTitle);
      if (!title) return;

      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? isDefaultThreadTitle(t.title)
              ? { ...t, title, updatedAt: Date.now() }
              : t
            : t
        )
      );
    },
    [activeThreadId, setThreads]
  );

  async function doUpload(file: File) {
    const task: UploadTask = {
      name: file.name,
      progress: 0,
      status: "uploading",
    };
    setUploads((prev) => [...prev, task]);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${getApiBase()}/upload`);

      const apiKey = localStorage.getItem("brd_api_key");
      if (apiKey) xhr.setRequestHeader("x-api-key", apiKey);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploads((prev) =>
            prev.map((t) =>
              t.name === file.name ? { ...t, progress: percent } : t
            )
          );
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          const suggested =
            data.title || data.filename || data.fileName || file.name;
          renameActiveThreadIfDefault(suggested);

          if (xhr.status >= 200 && xhr.status < 300) {
            setUploads((prev) =>
              prev.map((t) =>
                t.name === file.name
                  ? { ...t, status: "done", progress: 100 }
                  : t
              )
            );

            if (data.brdId) {
              setBrdId(Number(data.brdId));
            } else {
              console.warn("No brdId in /upload response");
            }

            // ✅ سمّي الثريد باسم الملف/العنوان الراجع من السيرفر لو العنوان لسه افتراضي
            const suggested =
              data.title ||
              data.filename ||
              data.fileName ||
              data.name ||
              file.name;
            renameActiveThreadIfDefault(suggested);

            updateActiveThreadMessages((p) => [
              ...p,
              {
                id: idRef.current++,
                role: "assistant",
                content: `تم رفع BRD (${file.name}).`,
              },
            ]);
            toast.success(`تم رفع ${file.name}`);
            void refreshAll();
          } else {
            setUploads((prev) =>
              prev.map((t) =>
                t.name === file.name ? { ...t, status: "error" } : t
              )
            );
            toast.error(`فشل رفع ${file.name} (HTTP ${xhr.status})`);
          }
        } catch (e) {
          setUploads((prev) =>
            prev.map((t) =>
              t.name === file.name ? { ...t, status: "error" } : t
            )
          );
          toast.error(`فشل قراءة رد الرفع`);
        }
      };

      xhr.onerror = () => {
        setUploads((prev) =>
          prev.map((t) =>
            t.name === file.name ? { ...t, status: "error" } : t
          )
        );
        toast.error(`فشل رفع ${file.name}`);
      };

      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    } catch {
      setUploads((prev) =>
        prev.map((t) => (t.name === file.name ? { ...t, status: "error" } : t))
      );
      toast.error(`فشل رفع ${file.name}`);
    }
  }

  /* ---------------- Commands ---------------- */
  function startFakeProgress(setter: (n: number) => void) {
    let p = 0;
    setter(0);
    const id = window.setInterval(() => {
      p = Math.min(90, p + Math.random() * 8 + 3);
      setter(Math.floor(p));
    }, 300);
    return () => window.clearInterval(id);
  }

  const handleAIGenerate = async () => {
    setFlowLoading(true);
    setFlowError(null);
    setMermaidSvg("");

    try {
      const res = await fetch(getApiBase() + "/generate-flowchart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ stories }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${msg}`);
      }

      const data = await res.json().catch(() => ({} as unknown));
      const raw = typeof data?.code === "string" ? data.code : "";
      if (!raw.trim()) {
        setFlowError("الخادم لم يُرجِع كود mermaid صالح.");
        toast.error("فشل توليد الرسم: لا يوجد code");
        return;
      }

      setMermaidCode(raw); // ← هننضّفه ونرندر في useEffect
    } catch (e) {
      setFlowError((e as Error)?.message || "تعذر توليد الرسم.");
      toast.error("تعذر توليد الرسم");
    } finally {
      setFlowLoading(false);
    }
  };

  const doSummarize = useCallback(async (): Promise<void> => {
    setOpLoading(true);
    setError(null);

    const msgId = idRef.current++;
    updateActiveThreadMessages((p) => [
      ...p,
      {
        id: msgId,
        role: "assistant",
        content: "جاري التلخيص…",
        typing: false,
        timestamp: Date.now(),
      },
    ]);
    setOpBubble({ type: "summarize", msgId });

    const stop = startFakeProgress((n) => setOpProgress(n));

    try {
      const data = await fetchJSON<{ summary: string }>(
        `${getApiBase()}/summarize`,
        { method: "POST" }
      );

      stop();
      setOpProgress(100);

      updateActiveThreadMessages((p) =>
        p.map((m) => (m.id === msgId ? { ...m, content: data.summary } : m))
      );
      toast.success("تم توليد ملخص");
    } catch (e) {
      stop();
      const msg = errorMessage(e) || "تعذّر التلخيص";
      updateActiveThreadMessages((p) =>
        p.map((m) => (m.id === msgId ? { ...m, content: `⚠️ ${msg}` } : m))
      );
      toast.error(msg);
      setError(msg);
    } finally {
      setTimeout(() => {
        setOpProgress(null);
        setOpBubble(null);
      }, 400);
      setOpLoading(false);
    }
  }, []);

  const doGenerateStories = useCallback(async (): Promise<void> => {
    if (!status.hasBrd) {
      toast.info("ارفع BRD الأول.");
      return;
    }
    setOpLoading(true);
    setError(null);

    const msgId = idRef.current++;
    updateActiveThreadMessages((p) => [
      ...p,
      {
        id: msgId,
        role: "assistant",
        content: "جارٍ توليد الـUser Stories…",
        typing: false,
        timestamp: Date.now(),
      },
    ]);
    setOpBubble({ type: "stories", msgId });

    const stop = startFakeProgress((n) => setOpProgress(n));

    try {
      // ✅ استخدم brdId بدل uploadId
      if (!brdId) {
        toast.info("ارفع BRD أولاً.");
        stop();
        setOpLoading(false);
        return;
      }

      const data = await fetchJSON<{ count: number; stories: Story[] }>(
        `${getApiBase()}/stories/generate?save=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brdId }),
        }
      );

      stop();
      setOpProgress(100);

      setStories(data.stories || []);
      updateActiveThreadMessages((p) =>
        p.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: `تم توليد ${data.stories?.length ?? 0} User Stories.`,
              }
            : m
        )
      );
      toast.success("تم توليد الـStories");
      await refreshStatus();
    } catch (e: unknown) {
      stop();
      const msg = errorMessage(e) || "تعذّر التوليد";
      updateActiveThreadMessages((p) =>
        p.map((m) => (m.id === msgId ? { ...m, content: `⚠️ ${msg}` } : m))
      );
      toast.error(msg);
      setError(msg);
    } finally {
      setTimeout(() => {
        setOpProgress(null);
        setOpBubble(null);
      }, 400);
      setOpLoading(false);
    }
  }, [status.hasBrd, brdId, refreshStatus]);

  const exportPDF = useCallback(async (): Promise<void> => {
    if (!status.hasBrd) {
      toast.info("ارفع BRD الأول.");
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/export/pdf`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brd.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تحميل PDF");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "فشل تصدير PDF");
    }
  }, [status.hasBrd]);

  const exportDocx = useCallback(async (): Promise<void> => {
    if (!status.hasBrd) {
      toast.info("ارفع BRD الأول.");
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/export/docx`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brd.docx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تحميل Docx");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "فشل تصدير Docx");
    }
  }, [status.hasBrd]);

  const exportJSON = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([
        fetch(`${getApiBase()}/stories`, { headers: getHeaders() }).then((r) =>
          r.json()
        ),
        fetch(`${getApiBase()}/insights`, { headers: getHeaders() }).then((r) =>
          r.json()
        ),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            { stories: s?.stories ?? [], insights: i ?? {} },
            null,
            2
          ),
        ],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brd.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير JSON");
    } catch {
      toast.error("تعذّر التصدير");
    }
  }, []);

  const [exportTypes, setExportTypes] = useState<("pdf" | "docx" | "json")[]>(
    []
  );
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      for (const type of exportTypes) {
        if (type === "pdf") await exportPDF();
        if (type === "docx") await exportDocx();
        if (type === "json") await exportJSON();
      }
      toast.success("تم التصدير");
    } catch {
      toast.error("تعذر التصدير");
    } finally {
      setExportLoading(false);
      setExportTypes([]);
    }
  }, [exportTypes, exportPDF, exportDocx, exportJSON]);

  /* ---------------- Commands ---------------- */
  const handleCommand = useCallback(
    async (cmdLine: string): Promise<boolean> => {
      const cmd = cmdLine.trim().toLowerCase();
      if (!cmd.startsWith("/")) return false;
      const go = (fn: () => Promise<void>) => {
        void fn();
        return true;
      };

      if (cmd === "/help") {
        setShowHelp(true);

        const helpMd = [
          "### الأوامر المتاحة",
          "- `/summarize` — تلخيص الـBRD",
          "- `/stories` — توليد User Stories",
          "- `/insights` — تحديث الـInsights",
          "- `/export pdf` — تصدير PDF",
          "- `/export docx` — تصدير Docx",
          "- `/export json` — تصدير JSON",
          "",
          "تقدر كمان تختار من البابلز فوق الإنبت 👇",
        ].join("\n");

        updateActiveThreadMessages((p) => [
          ...p,
          { id: idRef.current++, role: "assistant", content: helpMd },
        ]);

        return true;
      }

      if (cmd === "/summarize") return go(doSummarize);
      if (cmd === "/stories") return go(doGenerateStories);
      if (cmd === "/insights") return go(refreshInsights);
      if (cmd === "/export pdf") return go(exportPDF);
      if (cmd === "/export docx") return go(exportDocx);
      if (cmd === "/export json") return go(exportJSON);
      return false;
    },
    [
      refreshInsights,
      doSummarize,
      doGenerateStories,
      exportPDF,
      exportDocx,
      exportJSON,
    ]
  );

  /* ---------------- Chat ---------------- */
  const sendMessage = useCallback(
    async (overrideText?: string): Promise<void> => {
      const raw = overrideText ?? input;
      if (!raw.trim() || sendLoading || !activeThreadId) return;

      // امسح الإنپوت فورًا
      if (!overrideText) {
        setInput("");
        requestAnimationFrame(resetComposerHeight);
      }

      setSendLoading(true);
      setError(null);

      const userMsg: ChatMessage = {
        id: idRef.current++,
        role: "user",
        content: raw,
        timestamp: Date.now(),
      };

      // اضف رسالة المستخدم
      updateActiveThreadMessages((prev) => [...prev, userMsg]);

      const botId = idRef.current++;
      // ضع مكان للرد
      updateActiveThreadMessages((prev) => [
        ...prev,
        {
          id: botId,
          role: "assistant",
          content: "",
          typing: true,
          timestamp: Date.now(),
        },
      ]);

      try {
        const res = await fetchWithTimeout(
          `${getApiBase()}/chat-stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMsg.content }),
          },
          60000
        );

        let acc = "";
        await readSSEStream(res, (chunk) => {
          acc += chunk;
          // عدّل رسالة البوت الأخيرة
          updateActiveThreadMessages((prev) =>
            prev.map((m) =>
              m.id === botId ? { ...m, content: acc, typing: true } : m
            )
          );
        });
        updateActiveThreadMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, typing: false } : m))
        );

        // بعد الإرسال الناجح امسح الدرافت
        setThreads((prev) =>
          prev.map((t) => (t.id === activeThreadId ? { ...t, draft: "" } : t))
        );
      } catch (e: unknown) {
        const msg =
          e instanceof DOMException && e.name === "AbortError"
            ? "انتهت المهلة، جرّب تاني."
            : errorMessage(e);

        setError(msg);
        updateActiveThreadMessages((prev) =>
          prev.map((m) =>
            m.id === botId ? { ...m, content: msg, typing: false } : m
          )
        );
        toast.error(msg);
      } finally {
        setSendLoading(false);
      }
    },
    [input, sendLoading, activeThreadId]
  );

  const runQuick = useCallback(
    async (cmd: string) => {
      const handled = await handleCommand(cmd);
      if (!handled) await sendMessage(cmd);
    },
    [handleCommand, sendMessage]
  );

  /* ---------------- Keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        (
          document.getElementById("composer") as HTMLInputElement | null
        )?.focus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        onPickFile();
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (!sendLoading) void sendMessage();
      }
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.key === "Escape") {
        setPatchOpen(false);
        setAppendOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sendLoading, onPickFile, sendMessage]);

  const submitAppend = useCallback(async (): Promise<void> => {
    if (!appendText.trim()) return;

    setAppendLoading(true);
    setError(null);
    try {
      await fetchJSON(`${getApiBase()}/brd/append`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: appendType, content: appendText }),
      });

      updateActiveThreadMessages((p) => [
        ...p,
        {
          id: idRef.current++,
          role: "assistant",
          content: `تمت إضافة ${
            appendType === "story" ? "Story" : "Feature"
          } بنجاح.`,
        },
      ]);

      setAppendOpen(false);
      setAppendText("");
      await refreshAll();
      toast.success("تمت الإضافة");
    } catch (e: unknown) {
      const msg = errorMessage(e) || "فشل الإضافة";
      toast.error(msg);
      setError(msg);
    } finally {
      setAppendLoading(false);
    }
  }, [appendText, appendType, refreshAll]);

  /* ---------------- Markdown components ---------------- */
  type CodeRendererProps = DetailedHTMLProps<
    HTMLAttributes<HTMLElement>,
    HTMLElement
  > & {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  };
  const CodeRenderer: NonNullable<Components["code"]> = (props) => {
    const { children, ...rest } = props as CodeRendererProps;
    const inline = (props as CodeRendererProps).inline;
    if (inline)
      return (
        <code
          className="px-1 py-0.5 rounded bg-slate-200 text-slate-800"
          {...rest}
        >
          {children}
        </code>
      );
    return (
      <pre className="p-3 rounded bg-slate-900 overflow-auto text-slate-100 text-sm">
        <code {...rest}>{children}</code>
      </pre>
    );
  };
  const mdComponents: Components = {
    a: (props) => (
      <a
        {...props}
        target="_blank"
        rel="noreferrer"
        className="underline text-blue-600"
      />
    ),
    code: CodeRenderer,
    ul: (props) => <ul className="list-disc ms-6 my-2" {...props} />,
    ol: (props) => <ol className="list-decimal ms-6 my-2" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="border-s-4 border-slate-300 ps-3 italic my-2 text-slate-700"
        {...props}
      />
    ),
  };

  /* ---------------- UI helpers ---------------- */
  function ProgressBar({ value }: { value: number }) {
    return (
      <div className="mt-2 h-1.5 w-40 bg-slate-200 rounded">
        <div
          className="h-1.5 bg-blue-600 rounded"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    );
  }
  // --- ADO UI state ---

  const [selectedEpic, setSelectedEpic] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = localStorage.getItem("ado_selected_epic");
    if (e) setSelectedEpic(Number(e));
    const f = localStorage.getItem("ado_selected_feature");
    if (f) setSelectedFeature(Number(f));
  }, []);

  function persistSel(key: string, val: number | null) {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(val));
  }

  // ---- API calls (Frontend -> Backend) ----
  async function fetchProjects() {
    setAdoBusy(true);
    try {
      const r = await fetch(`${getApiBase()}/ado/projects`, {
        headers: adoHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "projects failed");
      setAdoProjects(data);
    } finally {
      setAdoBusy(false);
    }
  }

  async function refreshEpics() {
    if (!adoProject) return;
    setAdoBusy(true);
    try {
      const r = await fetch(`${getApiBase()}/ado/epics`, {
        headers: adoHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "epics failed");
      setAdoEpics(data);
    } finally {
      setAdoBusy(false);
    }
  }

  async function refreshFeatures(epicId?: number | null) {
    if (!adoProject) return;
    setAdoBusy(true);
    try {
      const q = epicId ? `?epicId=${epicId}` : "";
      const r = await fetch(`${getApiBase()}/ado/features${q}`, {
        headers: adoHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "features failed");
      setAdoFeatures(data);
    } finally {
      setAdoBusy(false);
    }
  }

  async function createEpicInline() {
    const title = prompt("عنوان الـEpic؟");
    if (!title) return;
    const description = prompt("وصف مختصر (اختياري)؟") || "";
    const r = await fetch(`${getApiBase()}/ado/epics`, {
      method: "POST",
      headers: adoHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title, description }),
    });
    const data = await r.json();
    if (!r.ok) {
      alert(data?.error || "create epic failed");
      return;
    }
    await refreshEpics();
    setSelectedEpic(data.id);
    persistSel("ado_selected_epic", data.id);
    await refreshFeatures(data.id);
  }

  async function createFeatureInline() {
    const title = prompt("عنوان الـFeature؟");
    if (!title) return;
    const description = prompt("وصف مختصر (اختياري)؟") || "";
    const r = await fetch(`${getApiBase()}/ado/features`, {
      method: "POST",
      headers: adoHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title, description, epicId: selectedEpic }),
    });
    const data = await r.json();
    if (!r.ok) {
      alert(data?.error || "create feature failed");
      return;
    }
    await refreshFeatures(selectedEpic);
    setSelectedFeature(data.id);
    persistSel("ado_selected_feature", data.id);
  }

  // Push كل الـStories المعروضة حاليًا (الـfilteredStories) على الـFeature المختار
  async function pushStoriesToADO() {
    if (!selectedFeature) {
      alert("اختر Feature أولًا");
      return;
    }
    if (!filteredStories.length) {
      alert("لا توجد Stories ظاهرة للدفع");
      return;
    }

    const payload = filteredStories.map((s) => ({
      title: s.title,
      description: s.description || "",
      acceptance_criteria: Array.isArray(s.acceptance_criteria)
        ? s.acceptance_criteria
        : [],
      tags: [String(storyTags[s.id ?? s.title] ?? "None")],
    }));

    setAdoBusy(true);
    try {
      const r = await fetch(`${getApiBase()}/ado/stories/bulk`, {
        method: "POST",
        headers: adoHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ featureId: selectedFeature, stories: payload }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "push failed");
      toast.success(
        `تم إنشاء ${data.created?.length ?? 0} Story على Azure DevOps`
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : "push failed";
      toast.error(msg);
    } finally {
      setAdoBusy(false);
    }
  }

  // أربط تغيّر الـEpic بتحميل الـFeatures
  useEffect(() => {
    if (selectedEpic != null) {
      persistSel("ado_selected_epic", selectedEpic);
      void refreshFeatures(selectedEpic);
    } else {
      persistSel("ado_selected_epic", null);
    }
  }, [selectedEpic]);

  useEffect(() => {
    persistSel("ado_selected_feature", selectedFeature ?? null);
  }, [selectedFeature]);

  // في أول مرة (لو متصل) هات المشاريع و الإبيكس/الفيتشرز
  useEffect(() => {
    if (adoBase || adoOrg) {
      void fetchProjects();
    }
  }, [adoBase, adoOrg]);

  function saveAdoSettings() {
    localStorage.setItem("ado_base", adoBase.trim());
    localStorage.setItem("ado_collection", adoCollection.trim());
    localStorage.setItem("ado_org", adoOrg.trim());
    localStorage.setItem("ado_project", adoProject.trim());
    if (adoPat) sessionStorage.setItem("ado_pat", adoPat); // PAT في sessionStorage
    toast.success("تم حفظ إعدادات Azure DevOps");
  }

  function disconnectAdo() {
    localStorage.removeItem("ado_base");
    localStorage.removeItem("ado_collection");
    localStorage.removeItem("ado_org");
    localStorage.removeItem("ado_project");
    sessionStorage.removeItem("ado_pat");
    setAdoBase("");
    setAdoCollection("");
    setAdoOrg("");
    setAdoProject("");
    setAdoPat("");
    setAdoProjects([]);
    toast.info("تم فصل Azure DevOps");
  }

  function adoHeaders(extra: Record<string, string> = {}): HeadersInit {
    return getHeaders({
      "Content-Type": "application/json",
      ...extra,
      "x-ado-base": String(adoBase || adoOrg || ""),
      "x-ado-collection": String(adoCollection || ""),
      "x-ado-project": String(adoProject || ""),
      "x-ado-pat": String(adoPat || ""),
    });
  }

  const ActionButton = ({
    icon,
    children,
    onClick,
    disabled,
  }: {
    icon: ReactNode;
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "p-2 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {icon} <span className="text-sm">{children}</span>
    </button>
  );

  function TypingBubble() {
    return (
      <div className="bg-slate-100 text-slate-800 px-3 py-2 rounded-2xl rounded-tr-sm w-fit max-w-[80%] flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <div
      id="app-root"
      className="min-h-screen grid grid-cols-12 auto-rows-min gap-3 bg-background p-3 md:p-4 relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length) {
          for (const f of Array.from(files)) {
            await doUpload(f);
          }
        }
      }}
    >
      <Toaster richColors position="top-center" />

      <div className="col-span-12 -mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* مؤشر حالة السيرفر */}
          <span
            title={
              serverStatus === "ok"
                ? "الخادم يعمل بشكل طبيعي"
                : serverStatus === "fail"
                ? "تعذر الاتصال بالخادم"
                : "جارِ الفحص..."
            }
            className={clsx(
              "flex items-center gap-1 text-xs font-semibold cursor-help",
              serverStatus === "ok" && "text-emerald-700",
              serverStatus === "fail" && "text-red-700",
              serverStatus === "loading" && "text-yellow-700"
            )}
          >
            {serverStatus === "loading" && (
              <>
                <span className="animate-spin inline-block w-3 h-3 rounded-full bg-yellow-400 me-1"></span>
                {/* مؤشر اتصال OpenAI */}
                <span
                  title={
                    openAIStatus === "ok"
                      ? "تم الاتصال بـ OpenAI بنجاح"
                      : openAIStatus === "fail"
                      ? openAIError || "تعذّر الاتصال بـ OpenAI"
                      : "جارِ فحص اتصال OpenAI..."
                  }
                  className={clsx(
                    "flex items-center gap-1 text-xs font-semibold cursor-help",
                    openAIStatus === "ok" && "text-emerald-700",
                    openAIStatus === "fail" && "text-red-700",
                    openAIStatus === "loading" && "text-yellow-700"
                  )}
                >
                  {openAIStatus === "loading" && (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 rounded-full bg-yellow-400 me-1 border border-yellow-700"></span>
                      <span>OpenAI</span>
                    </>
                  )}
                  {openAIStatus === "ok" && (
                    <>
                      <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 me-1 border border-emerald-700"></span>
                      <span>OpenAI</span>
                    </>
                  )}
                  {openAIStatus === "fail" && (
                    <>
                      <span className="inline-block w-3 h-3 rounded-full bg-red-500 me-1 border border-red-700 animate-pulse"></span>
                      <span>OpenAI</span>
                    </>
                  )}
                </span>
                جاري الفحص...
              </>
            )}
            {serverStatus === "ok" && (
              <>
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 me-1 border border-emerald-700"></span>
                <span className="text-emerald-700">متصل</span>
              </>
            )}
            {serverStatus === "fail" && (
              <>
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 me-1 border border-red-700 animate-pulse"></span>
                <span className="text-red-700">غير متصل</span>
              </>
            )}
          </span>
          <button
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800"
            onClick={() => void refreshAll()}
          >
            <RefreshCw className="h-4 w-4" /> تحديث الكل
          </button>

          {/* Theme toggle */}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">API: {getApiBase()}</div>
          <div className="relative">
            <button
              onClick={() =>
                setTheme((t) =>
                  t === "system" ? "light" : t === "light" ? "dark" : "system"
                )
              }
              className="p-2 rounded-lg border border-line bg-surface hover:bg-muted"
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Loader Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow">
              <Spinner />
              <span className="text-slate-700">جاري المعالجة…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {dragOver && !isUploading && (
          <motion.div
            className="fixed inset-0 z-30 bg-muted/80 border-4 border-dashed border-primary/40 flex items-center justify-center text-blue-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            افلت الملف هنا لرفعه
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left sidebar: Threads + Insights */}
      <aside className="col-span-3 text-foreground">
        <div className="space-y-4">
          {/* Threads card */}
          <section className="bg-surface rounded-xl shadow p-3 border border-line">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-700">Threads</h3>
              <button
                onClick={createThread}
                className="text-xs px-2 h-7 rounded border bg-white hover:bg-slate-50"
                title="ثريد جديد"
              >
                جديد
              </button>
            </div>

            <ul className="space-y-1 max-h-[32vh] overflow-y-auto pe-1">
              {threads.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <li
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    title={t.title}
                    className={clsx(
                      "group grid grid-cols-[1fr_auto] items-center gap-2 px-2 py-2 rounded border cursor-pointer",
                      isActive
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white hover:bg-slate-50 border-line text-slate-700"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        {t.title || "محادثة"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.messages.length} رسالة •{" "}
                        {new Date(t.updatedAt).toLocaleTimeString("ar", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 opacity-70 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          renameThread(t.id);
                        }}
                        className="p-1 rounded border hover:bg-slate-50"
                        title="إعادة تسمية"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("حذف هذه المحادثة؟")) deleteThread(t.id);
                        }}
                        className="p-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
              {threads.length === 0 && (
                <li className="text-slate-400 text-sm">لا توجد محادثات بعد.</li>
              )}
            </ul>
          </section>

          {/* Insights card */}

          <section className="bg-surface rounded-xl shadow p-4 border border-line">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Insights</h3>
              <button
                onClick={() => {
                  void refreshInsights();
                  toast.info("تم تحديث Insights");
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                تحديث
              </button>
            </div>

            {/* Sections */}
            <div className="mt-3 space-y-3">
              {/* helper: row */}
              {(
                [
                  {
                    key: "gaps",
                    title: "Gaps",
                    color: "text-amber-600",
                    bullet: "•",
                    items: insights.gaps as string[],
                  },
                  {
                    key: "risks",
                    title: "Risks",
                    color: "text-red-600",
                    bullet: "⚠️",
                    items: insights.risks as string[],
                  },
                  {
                    key: "metrics",
                    title: "Metrics",
                    color: "text-sky-700",
                    bullet: "📊",
                    items: insights.metrics as string[],
                  },
                ] as const
              ).map((sec) => (
                <details
                  key={sec.key}
                  className="rounded-lg border border-line overflow-hidden group"
                >
                  <summary className="cursor-pointer list-none px-3 py-2 bg-muted/50 hover:bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={sec.color}>{sec.title}</span>
                      <span className="text-xs rounded-full px-2 py-0.5 border bg-white/70">
                        {sec.items?.length ?? 0}
                      </span>
                    </div>
                    <span className="text-slate-500 text-xs group-open:rotate-180 transition-transform">
                      ⌄
                    </span>
                  </summary>

                  {sec.items?.length ? (
                    <ul className="text-sm space-y-2 pe-2 py-2 max-h-[26vh] overflow-y-auto">
                      {sec.items.map((t, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2 leading-6 ${sec.color}`}
                        >
                          <span className="mt-0.5">{sec.bullet}</span>
                          <span className="text-slate-800">{t}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-3 py-3 text-sm text-slate-400">
                      لا يوجد عناصر.
                    </div>
                  )}
                </details>
              ))}

              {/* Empty state الكل فاضي */}
              {!insights.gaps.length &&
                !insights.risks.length &&
                !insights.metrics.length && (
                  <div className="text-slate-400 text-sm px-2 py-4 text-center">
                    لا توجد إنسايتس بعد.
                  </div>
                )}
            </div>
          </section>
        </div>
      </aside>

      {/* ===== Chat column ===== */}
      <main className="col-span-6 bg-surface rounded-xl shadow flex flex-col relative text-foreground">
        <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-2">
          {titleEditing ? (
            <>
              <input
                className="flex-1 h-9 px-3 rounded-lg border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveThreadTitle();
                  if (e.key === "Escape") setTitleEditing(false);
                }}
                autoFocus
                placeholder="اسم الثريد"
              />
              <button
                onClick={saveThreadTitle}
                className="px-3 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                حفظ
              </button>
              <button
                onClick={() => setTitleEditing(false)}
                className="px-3 h-9 rounded-lg border"
              >
                إلغاء
              </button>
            </>
          ) : (
            <>
              <h1 className="flex-1 font-semibold text-slate-800 text-lg truncate">
                {activeThread?.title || "محادثة غير مسماة"}
              </h1>
              <div className="text-xs text-slate-500 me-2">
                {activeThread?.messages?.length ?? 0} رسالة
              </div>
              <button
                onClick={() => setTitleEditing(true)}
                className="p-2 rounded-lg border hover:bg-slate-50"
                title="إعادة تسمية الثريد"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </>
          )}
        </header>

        {/* Messages */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-8 space-y-3 max-h-[calc(100vh-200px)]"
          onScroll={onChatScroll}
        >
         <AnimatePresence>
  {showScrollTop && (
    <motion.button
      key="scrollJumpBtn"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={jumpDir === 'up' ? scrollToTop : scrollToBottom}
      className="absolute right-[50%] bottom-[20%] p-2 rounded-full shadow-lg border bg-white hover:bg-slate-50 z-50"
      title={jumpDir === 'up' ? 'العودة لأعلى' : 'الذهاب لأسفل'}
    >
      {jumpDir === 'up'
        ? <ArrowUp className="w-5 h-5 text-slate-700" />
        : <ArrowDown className="w-5 h-5 text-slate-700" />}
    </motion.button>
  )}
</AnimatePresence>


          <AnimatePresence initial={false}>
            {activeThread?.messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className={clsx(
                  "msg-row",
                  m.role === "assistant"
                    ? "msg-row--assistant"
                    : "msg-row--user"
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    <div className="avatar avatar--assistant">🤖</div>

                    <div dir="auto" className="bubble bubble--assistant group">
                      {/* زر النسخ */}
                      {!m.typing && (
                        <button
                          onClick={() => copyMessage(m.id, m.content)}
                          className="copy-btn"
                          title="Copy"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Clipboard className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      )}

                      {m.typing ? (
                        <TypingBubble />
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={mdComponents}
                        >
                          {m.content}
                        </ReactMarkdown>
                      )}

                      <div className="bubble__time">
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleTimeString("ar", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : ""}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div dir="auto" className="bubble bubble--user group">
                      {!m.typing && (
                        <button
                          onClick={() => copyMessage(m.id, m.content)}
                          className="copy-btn"
                          title="Copy"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Clipboard className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      )}

                      {m.typing ? <TypingBubble /> : m.content}

                      <div className="bubble__time">
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleTimeString("ar", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : ""}
                      </div>
                    </div>

                    <div className="avatar avatar--user">👤</div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Quick bubbles */}
        <div className="px-3 pb-2 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500">اختصار سريع:</span>
          {helpCmds.map((c) => (
            <button
              key={c.insert}
              onClick={() => void runQuick(c.insert)}
              className={clsx(
                "text-xs px-3 h-8 rounded-full border flex items-center gap-1",
                c.insert.includes("summarize") &&
                  "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
                c.insert.includes("stories") &&
                  "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                c.insert.includes("insights") &&
                  "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
                c.insert.includes("pdf") &&
                  "bg-slate-50 border-line text-slate-700 hover:bg-slate-100",
                c.insert.includes("docx") &&
                  "bg-slate-50 border-line text-slate-700 hover:bg-slate-100",
                c.insert.includes("json") &&
                  "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
              )}
              title={c.insert}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {showHelp && (
          <div className="px-3 pb-2 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500">اختصار سريع:</span>

            <button
              onClick={() => setShowHelp(false)}
              className="ms-auto text-xs px-2 h-8 rounded border text-slate-500 hover:bg-slate-50"
              title="إخفاء الأوامر"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Composer */}

        <div className="border-t p-3 flex gap-2">
          <button
            onClick={() => void sendMessage()}
            disabled={sendLoading}
            className={clsx(
              "bg-blue-600 text-white px-4 h-10 rounded-lg flex items-center gap-2",
              !sendLoading && "hover:bg-blue-700",
              sendLoading && "opacity-70 cursor-not-allowed"
            )}
            title="إرسال (Ctrl+Enter)"
          >
            {sendLoading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>

          {/* استبدال input بـ textarea مرنة */}
          <textarea
            id="composer"
            ref={composerRef as React.RefObject<HTMLTextAreaElement>}
            className="chat-input flex-1 border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 disabled:bg-gray-100 text-slate-900 placeholder-slate-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالتك هنا... (جرّب /help)"
            disabled={sendLoading}
            rows={1}
            onInput={(e) => {
              const ta = e.currentTarget;
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sendLoading) void sendMessage();
              }
            }}
          />

          <button
            className="px-3 h-10 rounded-lg border"
            onClick={() => {
              updateActiveThreadMessages(() => []); // امسح رسائل الثريد الحالي
              setThreads((prev) =>
                prev.map(
                  (
                    t // امسح الدرافت كمان
                  ) => (t.id === activeThreadId ? { ...t, draft: "" } : t)
                )
              );
            }}
            title="مسح الرسائل"
          >
            Clear
          </button>
        </div>
      </main>

      {/* Sidebar (Actions + Upload + Backlog + Settings) */}
      <aside className="col-span-3 bg-surface rounded-xl shadow p-4 space-y-4 text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            BRD Assistant <span>📑</span>
          </h2>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg border hover:bg-slate-50"
            title="Settings (Ctrl+,)"
          >
            <Settings className="h-4 w-4 text-slate-700" />
          </button>
        </div>

        {/* Upload */}
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt"
          onChange={onFileChange}
          multiple
        />
        <button
          onClick={onPickFile}
          disabled={isUploading}
          className={clsx(
            "w-full p-3 rounded-xl border bg-white transition shadow-sm flex items-center justify-center gap-2",
            isUploading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-50"
          )}
          title="رفع ملف (Ctrl+U)"
        >
          {isUploading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4 text-blue-600" />
          )}
          <span className="text-slate-700">رفع BRD</span>
        </button>

        {/* Upload Progress List */}
        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div key={u.name} className="text-xs">
                <div className="flex justify-between">
                  <span className="truncate">{u.name}</span>
                  <span>
                    {u.status === "uploading" && `${u.progress}%`}
                    {u.status === "done" && "✓"}
                    {u.status === "error" && "⚠️"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded">
                  <div
                    className={clsx(
                      "h-1 rounded",
                      u.status === "error" ? "bg-red-500" : "bg-blue-600"
                    )}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={<Wand2 className="h-4 w-4 text-purple-600" />}
            onClick={doSummarize}
            disabled={opLoading || !status.hasBrd}
          >
            تلخيص BRD
          </ActionButton>
          <ActionButton
            icon={<ListChecks className="h-4 w-4 text-emerald-600" />}
            onClick={doGenerateStories}
            disabled={opLoading || !status.hasBrd}
          >
            توليد Stories
          </ActionButton>
          <ActionButton
            icon={<Wrench className="h-4 w-4 text-amber-600" />}
            onClick={() => setPatchOpen(true)}
            disabled={!status.hasBrd}
          >
            تعديل جزء
          </ActionButton>
          <ActionButton
            icon={<Plus className="h-4 w-4 text-blue-600" />}
            onClick={() => setAppendOpen(true)}
          >
            إضافة Feature/Story
          </ActionButton>
          <ActionButton
            icon={<ListChecks className="h-4 w-4 text-cyan-600" />}
            onClick={() => setShowFlowchart(true)}
            disabled={stories.length === 0}
          >
            رسم Flowchart
          </ActionButton>
          <div className="relative col-span-2" style={{ minWidth: 0 }}>
            <button
              className={clsx(
                "w-full p-2 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2",
                exportLoading && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={exportLoading}
              title="تصدير"
              style={{ minWidth: "160px" }} // عرض ثابت أو حسب الحاجة
            >
              <Download className="h-4 w-4 text-slate-700" />
              {exportLoading ? <Spinner className="h-4 w-4" /> : "تصدير"}
            </button>
            {/* قائمة الصيغ تظهر فقط عند فتح الدروب داون */}
            {/* Azure DevOps Panel */}
            {/* داخل عمود اليسار */}

            <section className="bg-surface rounded-xl shadow p-3 border border-line">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-700 text-sm">
                    Azure DevOps
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {(adoBase || adoOrg || "").replace(/^https?:\/\//, "") ||
                      "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {adoProject || "—"}
                  </div>
                </div>
                <button
                  onClick={() => setAdoModalOpen(true)}
                  className="px-3 h-9 rounded-lg border bg-white hover:bg-slate-50"
                >
                  فتح
                </button>
              </div>
            </section>

            {adoModalOpen && (
              <AdoPushModal
                onClose={() => setAdoModalOpen(false)}
                stories={filteredStories} // أو أي قائمة Stories تريد دفعها
                adoHeaders={adoHeaders} // الدالة اللي صلحناها
                baseForLinks={(adoBase || adoOrg) as string}
                project={adoProject || ""}
              />
            )}

            {showExportMenu && !exportLoading && (
              <div
                className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg"
                style={{ width: "100%" }} // نفس عرض الزر
              >
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("pdf")}
                    onChange={(e) => {
                      setExportTypes((types) =>
                        e.target.checked
                          ? [...types, "pdf"]
                          : types.filter((t) => t !== "pdf")
                      );
                    }}
                  />
                  <span className="ms-2">PDF</span>
                </label>
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("docx")}
                    onChange={(e) => {
                      setExportTypes((types) =>
                        e.target.checked
                          ? [...types, "docx"]
                          : types.filter((t) => t !== "docx")
                      );
                    }}
                  />
                  <span className="ms-2">DOCX</span>
                </label>
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("json")}
                    onChange={(e) => {
                      setExportTypes((types) =>
                        e.target.checked
                          ? [...types, "json"]
                          : types.filter((t) => t !== "json")
                      );
                    }}
                  />
                  <span className="ms-2">JSON</span>
                </label>
                <button
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-b-lg hover:bg-blue-700"
                  disabled={exportTypes.length === 0}
                  onClick={async () => {
                    setExportLoading(true);
                    try {
                      for (const type of exportTypes) {
                        if (type === "pdf") await exportPDF();
                        if (type === "docx") await exportDocx();
                        if (type === "json") await exportJSON();
                      }
                      toast.success("تم التصدير");
                    } catch {
                      toast.error("تعذر التصدير");
                    } finally {
                      setExportLoading(false);
                      setExportTypes([]);
                      setShowExportMenu(false); // إغلاق الدروب داون بعد التحميل
                    }
                  }}
                >
                  تحميل
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status (pretty) */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div
            className={clsx(
              "flex items-center gap-2 p-2 rounded-xl border",
              status.hasBrd
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-slate-50 border-line text-slate-700"
            )}
          >
            <FileText className="w-4 h-4" />
            <div className="leading-tight">
              <div className="text-[11px] opacity-80">BRD</div>
              <div className="font-semibold">
                {status.hasBrd ? "موجود" : "غير موجود"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl border bg-sky-50 border-sky-200 text-sky-800">
            <ListChecks className="w-4 h-4" />
            <div className="leading-tight">
              <div className="text-[11px] opacity-80">Stories</div>
              <div className="font-semibold">{status.storyCount}</div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 p-2 rounded-xl border bg-violet-50 border-violet-200 text-violet-800"
            title={
              status.lastUploadedAt
                ? new Date(status.lastUploadedAt).toLocaleString()
                : "لا يوجد"
            }
          >
            <Clock3 className="w-4 h-4" />
            <div className="leading-tight">
              <div className="text-[11px] opacity-80">آخر رفع</div>
              <div className="font-semibold">
                {status.lastUploadedAt
                  ? new Date(status.lastUploadedAt).toLocaleTimeString("ar", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Backlog */}
        <div className="h-px bg-slate-200" />
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="ms-auto flex items-center gap-2">
                {/* تحديث */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <button
                    onClick={() => {
                      void refreshStories();
                      toast.message("تم تحديث الـStories");
                    }}
                    className="h-9 px-3 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                    title="تحديث"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث
                  </button>

                  {/* فلتر التاج */}
                  <div className="relative">
                    <select
                      className="h-9 ps-8 pe-2 rounded-lg border bg-white text-sm"
                      value={filterTag}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setPage(1);
                        setFilterTag(e.target.value as Tag);
                      }}
                      title="فلتر بالتاج"
                    >
                      <option value="All">كل التاجات</option>
                      <option value="Critical">Critical</option>
                      <option value="Enhancement">Enhancement</option>
                      <option value="Blocked">Blocked</option>
                      <option value="None">None</option>
                    </select>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs opacity-60">
                      🏷️
                    </span>
                  </div>

                  {/* الترتيب */}
                  <div className="relative">
                    <select
                      className="h-9 ps-8 pe-2 rounded-lg border bg-white text-sm"
                      value={sortBy}
                      onChange={(e) => {
                        setPage(1);
                        setSortBy(e.target.value as SortBy);
                      }}
                      title="ترتيب"
                    >
                      <option value="latest">الأحدث أولًا</option>
                      <option value="oldest">الأقدم أولًا</option>
                      <option value="title-asc">عنوان A → Z</option>
                      <option value="title-desc">عنوان Z → A</option>
                      <option value="tag">حسب التاج (Critical أولًا)</option>
                    </select>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs opacity-60">
                      ⇅
                    </span>
                  </div>

                  {/* بحث */}
                  <div className="ms-auto flex items-center gap-2">
                    <div className="relative">
                      <input
                        value={backlogQuery}
                        onChange={(e) => {
                          setPage(1);
                          setBacklogQuery(e.target.value);
                        }}
                        placeholder="بحث في الـStories..."
                        className="h-9 w-[220px] max-w-[40vw] ps-8 pe-2 rounded-lg border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                        🔎
                      </span>
                    </div>

                    {/* العدّاد */}
                    <span className="text-[12px] px-2 py-1 rounded-full border bg-white text-slate-600">
                      {filteredStories.length}/{stories.length}
                    </span>
                    <h3 className="font-semibold text-slate-700 ms-1">
                      Backlog
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ul className="text-sm space-y-2 max-h-56 overflow-auto pe-1">
            {pagedStories.length ? (
              pagedStories.map((s) => (
                <li
                  key={s.id ?? s.title}
                  className="group p-3 border rounded-xl bg-white hover:shadow-sm hover:bg-slate-50 cursor-pointer transition"
                  onClick={() => openModal(s)}
                  title="اضغط للتفاصيل"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {s.title}
                      </div>
                      {s.description && (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
                          AC:{" "}
                          {Array.isArray(s.acceptance_criteria)
                            ? s.acceptance_criteria.length
                            : 0}
                        </span>
                        <span
                          className={clsx(
                            "text-[11px] px-2 py-0.5 rounded-full border",
                            tagColor(storyTags[s.id ?? s.title] ?? "None")
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {storyTags[s.id ?? s.title] ?? "None"}
                        </span>
                      </div>
                    </div>

                    <button
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 h-7 rounded border"
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(s);
                      }}
                    >
                      تفاصيل
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-slate-400">لا توجد Stories بعد.</li>
            )}
          </ul>

          <div className="flex items-center justify-between text-xs mt-2">
            <button
              className="px-2 h-7 rounded border"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <div>
              Page {page} / {pageCount}
            </div>
            <button
              className="px-2 h-7 rounded border"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </div>
        </div>

        {/* Inline Error (sidebar) */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <span>⚠️</span>
            <div className="flex-1">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-red-600/70 hover:text-red-800"
              title="إخفاء"
            >
              ✕
            </button>
          </div>
        )}
      </aside>

      {/* Inline Error (global under layout) */}
      {error && (
        <div className="mx-8 -mt-2 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
          <span>⚠️</span>
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-red-600/70 hover:text-red-800"
            title="إخفاء"
          >
            ✕
          </button>
        </div>
      )}

      {/* Patch Modal */}
      {patchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(560px,92vw)] p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">تعديل جزء من الـBRD</h4>
              <button
                onClick={() => setPatchOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <label className="block text-sm mb-1">
              اسم أو وصف الجزء المراد تعديله
            </label>
            <input
              className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg h-10 px-3 mb-3 text-slate-900 placeholder-slate-500"
              value={patchSection}
              onChange={(e) => setPatchSection(e.target.value)}
              placeholder="مثال: Scope / Payment Flow / KYC"
            />
            <label className="block text-sm mb-1">التعديل المطلوب</label>
            <textarea
              className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg p-2 min-h-[120px] text-slate-900 placeholder-slate-500"
              value={patchInstruction}
              onChange={(e) => setPatchInstruction(e.target.value)}
              placeholder="اشرح بدقة التعديل المطلوب…"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setPatchOpen(false)}
                className="px-3 h-10 rounded-lg border"
              >
                إلغاء
              </button>
              <button
                onClick={submitPatch}
                disabled={patchLoading}
                className={clsx(
                  "px-4 h-10 rounded-lg text-white bg-blue-600",
                  !patchLoading && "hover:bg-blue-700",
                  patchLoading && "opacity-70"
                )}
              >
                {patchLoading ? "..." : "حفظ التعديل"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Append Modal */}
      {appendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(560px,92vw)] p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">
                إضافة Feature أو User Story
              </h4>
              <button
                onClick={() => setAppendOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm mb-2">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="append-type"
                  checked={appendType === "story"}
                  onChange={() => setAppendType("story")}
                />{" "}
                Story
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="append-type"
                  checked={appendType === "feature"}
                  onChange={() => setAppendType("feature")}
                />{" "}
                Feature
              </label>
            </div>
            <textarea
              className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg p-2 min-h-[120px] text-slate-900 placeholder-slate-500"
              value={appendText}
              onChange={(e) => setAppendText(e.target.value)}
              placeholder="عنوان + وصف + Acceptance Criteria إن أمكن…"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setAppendOpen(false)}
                className="px-3 h-10 rounded-lg border"
              >
                إلغاء
              </button>
              <button
                onClick={submitAppend}
                disabled={appendLoading}
                className={clsx(
                  "px-4 h-10 rounded-lg text-white bg-blue-600",
                  !appendLoading && "hover:bg-blue-700",
                  appendLoading && "opacity-70"
                )}
              >
                {appendLoading ? "..." : "إضافة"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(520px,92vw)] p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">الإعدادات</h4>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <label className="block text-sm mb-1">OpenAI API Key</label>
            <input
              className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg h-10 px-3 mb-3 text-slate-900 placeholder-slate-500"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />

            {/* اعدادات Azure ui */}
            <section className="mt-4 p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Azure DevOps</h4>
                {adoBase && adoPat ? (
                  <span className="badge badge--ok">Connected?</span>
                ) : (
                  <span className="badge badge--warn">Not connected</span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm mb-1">Base URL</label>
                  <input
                    className="w-full border border-line rounded-lg h-10 px-3"
                    placeholder="https://azure.2p.com.sa"
                    value={adoBase}
                    onChange={(e) => setAdoBase(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    مثال: https://azure.2p.com.sa
                  </p>
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Collection (اختياري)
                  </label>
                  <input
                    className="w-full border border-line rounded-lg h-10 px-3"
                    placeholder="Projects / DefaultCollection"
                    value={adoCollection}
                    onChange={(e) => setAdoCollection(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Organization (لو dev.azure.com)
                  </label>
                  <input
                    className="w-full border border-line rounded-lg h-10 px-3"
                    placeholder="example-org"
                    value={adoOrg}
                    onChange={(e) => setAdoOrg(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    className="w-full border border-line rounded-lg h-10 px-3"
                    placeholder="••••••••••••"
                    value={adoPat}
                    onChange={(e) => setAdoPat(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    يُحفظ في <b>sessionStorage</b> فقط.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-ghost"
                      disabled={adoBusy || !adoBase || !adoPat}
                      onClick={async () => {
                        try {
                          setAdoBusy(true);
                          const r = await fetch(
                            getApiBase() + "/ado/projects",
                            { headers: adoHeaders() }
                          );
                          if (!r.ok) throw new Error(`HTTP ${r.status}`);
                          const data = await r.json();
                          setAdoProjects(data);
                          toast.success("تم الاتصال وجلب المشاريع");
                        } catch (e) {
                          toast.error(
                            "فشل الاتصال — جرّب تعبئة Collection أيضًا"
                          );
                        } finally {
                          setAdoBusy(false);
                        }
                      }}
                    >
                      اختبار الاتصال وجلب المشاريع
                    </button>

                    <button
                      className="btn btn-primary ms-auto"
                      onClick={saveAdoSettings}
                    >
                      حفظ
                    </button>
                    <button className="btn" onClick={disconnectAdo}>
                      فصل
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1">المشروع</label>
                  <select
                    className="w-full border border-line rounded-lg h-10 px-3 bg-white"
                    value={adoProject}
                    onChange={(e) => setAdoProject(e.target.value)}
                  >
                    <option value="">— اختر مشروع —</option>
                    {adoProjects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    اختر MOHU لو ظهر في القائمة.
                  </p>
                </div>
              </div>
            </section>

            <label className="block text-sm mb-1">API Base</label>
            <input
              className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg h-10 px-3 mb-1 text-slate-900 placeholder-slate-500"
              value={apiBaseInput}
              onChange={(e) => setApiBaseInput(e.target.value)}
              placeholder={DEFAULT_API_BASE}
            />
            <p className="text-xs text-slate-500 mb-3">
              سيُستخدم بدل <code>NEXT_PUBLIC_API_BASE</code> عند ضبطه.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-3 h-10 rounded-lg border"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("brd_api_key", apiKey.trim());
                  localStorage.setItem("api_base", apiBaseInput.trim());
                  toast.success("تم حفظ الإعدادات");
                  setSettingsOpen(false);
                }}
                className="px-4 h-10 rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                حفظ
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="text-xs text-slate-500">التخزين المحلي</div>
              <button
                onClick={() => {
                  localStorage.removeItem(LS_KEYS.threads);
                  localStorage.removeItem(LS_KEYS.activeThreadId);

                  localStorage.removeItem(LS_KEYS.stories);
                  localStorage.removeItem(LS_KEYS.insights);
                  setThreads([]); // فضّي كل الثريدات
                  setActiveThreadId(null); // مفيش ثريد نشط
                  setStories([]);
                  setInsights({ gaps: [], risks: [], metrics: [] });

                  toast.success("تم مسح التخزين المحلي");
                }}
                className="px-3 h-9 rounded-lg border text-red-600 border-red-200 hover:bg-red-50"
              >
                مسح الرسائل والـBacklog المحلي
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* ===== Story Edit/Delete Modal ===== */}
      {/* ===== Story View/Edit Modal ===== */}
      {open && selectedStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-hidden={false}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeModal}
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-modal-title"
            aria-describedby="story-modal-desc"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(700px,94vw)] max-h-[90vh] grid grid-rows-[auto_minmax(0,1fr)_auto]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeModal();
              }
              // حفظ سريع في وضع التعديل
              if (
                editMode &&
                (e.ctrlKey || e.metaKey) &&
                (e.key.toLowerCase() === "s" || e.key === "Enter")
              ) {
                e.preventDefault();
                if (!saving) saveStory();
              }
            }}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-t-2xl border-b bg-surface/85 backdrop-blur">
              <div className="flex items-center gap-3">
                <h4 id="story-modal-title" className="text-lg font-semibold">
                  تفاصيل User Story
                </h4>
                <span
                  className={clsx(
                    "text-[11px] border rounded-full px-2 py-0.5",
                    formTag === "Critical"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : formTag === "Enhancement"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : formTag === "Blocked"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-slate-50 text-slate-700 border-line"
                  )}
                >
                  {formTag}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted text-slate-500"
                aria-label="إغلاق"
                autoFocus
              >
                ✕
              </button>
            </div>

            {/* Body (scroll area) */}
            <div id="story-modal-desc" className="px-6 py-4 overflow-y-auto">
              {/* عرض */}
              {!editMode && (
                <div className="space-y-5 max-w-prose">
                  <section>
                    <div className="text-xs text-slate-500 mb-1">العنوان</div>
                    <div className="font-medium text-slate-900 leading-7">
                      {selectedStory.title || "-"}
                    </div>
                  </section>

                  <section>
                    <div className="text-xs text-slate-500 mb-1">الوصف</div>
                    <div className="text-slate-800 leading-7 whitespace-pre-wrap">
                      {selectedStory.description || "-"}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500 mb-1">
                        معايير القبول
                      </div>
                      {!!selectedStory.acceptance_criteria?.length && (
                        <button
                          onClick={async () => {
                            const text = selectedStory
                              .acceptance_criteria!.map(
                                (x, i) => `${i + 1}. ${x}`
                              )
                              .join("\n");
                            await navigator.clipboard.writeText(text);
                          }}
                          className="text-xs underline text-slate-500 hover:text-slate-700"
                        >
                          نسخ
                        </button>
                      )}
                    </div>

                    {Array.isArray(selectedStory.acceptance_criteria) &&
                    selectedStory.acceptance_criteria.length ? (
                      <ol className="ms-5 list-decimal space-y-1 [text-indent:-.5rem] [padding-inline-start:.5rem] leading-7 text-slate-800">
                        {selectedStory.acceptance_criteria.map((ac, i) => (
                          <li key={i}>{ac}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-slate-400">لا يوجد</div>
                    )}
                  </section>
                </div>
              )}

              {/* تعديل */}
              {editMode && (
                <div className="space-y-4 max-w-prose">
                  <div>
                    <label className="block text-sm mb-1">العنوان</label>
                    <input
                      className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg h-10 px-3 text-slate-900"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="عنوان الستوري"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">الوصف</label>
                    <textarea
                      className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg p-2 min-h-[90px] text-slate-900"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="وصف مختصر للستوري…"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">
                      معايير القبول (كل سطر = معيار)
                    </label>
                    <textarea
                      className="w-full border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg p-2 min-h-[120px] text-slate-900"
                      value={formAC}
                      onChange={(e) => setFormAC(e.target.value)}
                      placeholder={"- يجب أن...\n- عند ... يحدث ..."}
                    />
                  </div>

                  {/* التاج في التعديل فقط */}
                  <div>
                    <label className="block text-sm mb-1">التاج</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 text-sm rounded border border-line bg-white px-2"
                        value={formTag}
                        onChange={(e) => setFormTag(e.target.value as Tag)}
                        title="Tag"
                      >
                        <option value="None">None</option>
                        <option value="Critical">Critical</option>
                        <option value="Enhancement">Enhancement</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                      <span
                        className={clsx(
                          "text-[11px] border rounded-full px-2 py-0.5",
                          formTag === "Critical"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : formTag === "Enhancement"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : formTag === "Blocked"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-50 text-slate-700 border-line"
                        )}
                      >
                        {formTag}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-3 border-t bg-surface/85 backdrop-blur rounded-b-2xl">
              <button
                onClick={async () => {
                  if (confirm("هل تريد حذف هذه الستوري نهائيًا؟"))
                    await hardDeleteStory();
                }}
                className="px-3 h-10 rounded-lg border text-red-600 border-red-200 hover:bg-red-50"
                title="حذف نهائي"
              >
                حذف
              </button>

              <div className="ms-auto flex items-center gap-2">
                {!editMode ? (
                  <>
                    {/* Priority اختياري قبل الدفع */}
                    <select
                      className="h-10 rounded-lg border border-line text-sm px-2"
                      value={storyPriority}
                      onChange={(e) =>
                        setStoryPriority(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                      title="Priority (1 أعلى)"
                    >
                      <option value="">Priority</option>
                      <option value="1">1 (Highest)</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4 (Lowest)</option>
                    </select>

                    {/* فتح كونسول ADO لاختيار Epic/Feature ثم Push */}
                    <button
                      onClick={async () => {
                        setShowAdoConsole(true);
                        await loadEpicsAndFeatures();
                      }}
                      className="px-3 h-10 rounded-lg border text-blue-600 hover:bg-blue-50"
                      title="Push to Azure DevOps"
                    >
                      ADO دفع
                    </button>

                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 h-10 rounded-lg border hover:bg-slate-50"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={closeModal}
                      className="px-3 h-10 rounded-lg border"
                    >
                      إغلاق
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setFormTitle(selectedStory?.title ?? "");
                        setFormDesc(selectedStory?.description ?? "");
                        setFormAC(
                          Array.isArray(selectedStory?.acceptance_criteria)
                            ? selectedStory!.acceptance_criteria!.join("\n")
                            : (selectedStory?.acceptance_criteria as unknown as string) ??
                                ""
                        );
                        setFormTag(
                          (storyTags[
                            selectedStory!.id ?? selectedStory!.title
                          ] ?? "None") as Tag
                        );
                      }}
                      className="px-3 h-10 rounded-lg border"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={saveStory}
                      disabled={saving}
                      className={clsx(
                        "px-4 h-10 rounded-lg text-white",
                        savedTick ? "bg-emerald-600" : "bg-blue-600",
                        !saving && "hover:bg-blue-700",
                        saving && "opacity-70 cursor-not-allowed"
                      )}
                    >
                      {saving ? "جارٍ الحفظ…" : savedTick ? "تم" : "حفظ"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Flowchart Modal */}
      {/* ADO Console Modal */}
      {showAdoConsole && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setShowAdoConsole(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(800px,95vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h4 className="text-lg font-semibold">Azure DevOps Console</h4>
              <button
                onClick={() => setShowAdoConsole(false)}
                className="h-9 w-9 rounded-lg border"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* اختيار Epic */}
              <div className="flex items-center gap-2">
                <label className="w-28 text-sm text-slate-600">Epic</label>
                <select
                  className="flex-1 h-10 rounded-lg border px-2"
                  value={pickEpicId ?? ""}
                  onChange={(e) =>
                    setPickEpicId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  <option value="">— اختر Epic —</option>
                  {adoEpics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-lg border px-2"
                  placeholder="Epic جديد…"
                  value={newEpic}
                  onChange={(e) => setNewEpic(e.target.value)}
                />
                <button
                  onClick={createEpic}
                  disabled={!newEpic || adoBusy}
                  className="h-10 px-3 rounded-lg border"
                >
                  إنشاء
                </button>
              </div>

              {/* اختيار Feature */}
              <div className="flex items-center gap-2">
                <label className="w-28 text-sm text-slate-600">Feature</label>
                <select
                  className="flex-1 h-10 rounded-lg border px-2"
                  value={pickFeatureId ?? ""}
                  onChange={(e) =>
                    setPickFeatureId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  <option value="">— اختر Feature —</option>
                  {adoFeatures
                    .filter((f) =>
                      !pickEpicId
                        ? true
                        : (f.parentUrl || "").match(
                            /\/workItems\/(\d+)/i
                          )?.[1] === String(pickEpicId)
                    )
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                </select>
                <input
                  className="h-10 rounded-lg border px-2"
                  placeholder="Feature جديدة…"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                />
                <button
                  onClick={createFeature}
                  disabled={!newFeature || adoBusy}
                  className="h-10 px-3 rounded-lg border"
                >
                  إنشاء
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
              <button
                onClick={() => setShowAdoConsole(false)}
                className="h-10 px-4 rounded-lg border"
              >
                إلغاء
              </button>
              <button
                onClick={pushCurrentStoryToADO}
                disabled={!pickFeatureId || adoBusy}
                className="h-10 px-4 rounded-lg bg-blue-600 text-white"
              >
                {adoBusy ? "جارٍ الدفع…" : "Push"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFlowchart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl shadow-xl ring-1 ring-line w-[min(700px,96vw)] p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Flowchart من الـStories</h4>
              <button
                onClick={() => setShowFlowchart(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <button
                className="btn btn-primary"
                onClick={handleAIGenerate}
                disabled={flowLoading || stories.length === 0}
              >
                رسم بالذكاء الاصطناعي
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const svg = document.querySelector("#ai-flowchart svg");
                  if (!svg) return;
                  const serializer = new XMLSerializer();
                  const svgStr = serializer.serializeToString(svg);
                  const blob = new Blob([svgStr], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "flowchart.svg";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                تحميل الصورة
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setZoomed((z) => !z)}
              >
                {zoomed ? "تصغير" : "تكبير"}
              </button>
            </div>
            {flowLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <Spinner className="h-10 w-10 text-blue-600 animate-spin" />
                <span className="ms-3 text-blue-700 font-semibold">
                  جاري توليد الرسم...
                </span>
              </div>
            ) : flowError ? (
              <div className="min-h-[120px] rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                ⚠️ {flowError}
                <div className="mt-2 text-xs text-red-600/80">
                  تحقّق من Network tab وتأكد أن الـ API يرجّع{" "}
                  {"{ code: string }"} بدون HTML.
                </div>
              </div>
            ) : mermaidSvg ? (
              <div
                id="ai-flowchart"
                style={{
                  minHeight: 300,
                  maxHeight: zoomed ? "90vh" : 500,
                  overflow: "auto",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                }}
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : (
              <div className="min-h-[120px] text-slate-500 text-sm">
                لا يوجد رسم بعد. اضغط “رسم بالذكاء الاصطناعي”.
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Component
function MermaidChart({ stories }: { stories: Story[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = [
      "graph TD",
      ...stories.map(
        (s, i) =>
          `S${i}["${s.title.replace(/"/g, "'")}"]${i > 0 ? ` --> S${i}` : ""}`
      ),
    ].join("\n");

    mermaid.initialize({ startOnLoad: false, theme: "default" });
    mermaid.render("flowchart", chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [stories]);

  return (
    <div
      ref={ref}
      className="overflow-auto bg-white rounded-lg border p-4"
      style={{ minHeight: 300, maxHeight: 500 }}
    />
  );
}

// ===== ADO Push Modal =====
type AdoPushModalProps = {
  onClose: () => void;
  stories: Story[];
  adoHeaders: (extra?: Record<string, string>) => HeadersInit;
  baseForLinks: string; // https://azure.2p.com.sa أو https://dev.azure.com/org
  project: string; // اسم المشروع المختار (مثلاً MOHU)
};

function AdoPushModal({
  onClose,
  stories,
  adoHeaders,
  baseForLinks,
  project,
}: AdoPushModalProps) {
  const apiBase = getApiBase();

  const [busy, setBusy] = React.useState(false);
  const [epics, setEpics] = React.useState<
    Array<{ id: number; title: string }>
  >([]);
  const [features, setFeatures] = React.useState<
    Array<{ id: number; title: string }>
  >([]);
  const [epicId, setEpicId] = React.useState<string>(""); // نخزن كـ string
  const [featureId, setFeatureId] = React.useState<string>(""); // نخزن كـ string
  const [newEpic, setNewEpic] = React.useState("");
  const [newFeature, setNewFeature] = React.useState("");
  const [priority, setPriority] = React.useState<"P1" | "P2" | "P3" | "P4">(
    "P3"
  );

  const h = adoHeaders(); // يقرأ الهيدرز من إعداداتك الحالية

  React.useEffect(() => {
    void loadEpics();
  }, []);

  async function loadEpics() {
    try {
      setBusy(true);
      const e = await fetchJSON<Array<{ id: number; title: string }>>(
        `${apiBase}/ado/epics`,
        { headers: h }
      );
      setEpics(e);
      if (e.length) {
        setEpicId(String(e[0].id));
        await loadFeatures(e[0].id);
      } else {
        setEpicId("");
        setFeatures([]);
        setFeatureId("");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadFeatures(epic?: number) {
    try {
      setBusy(true);
      const url = epic
        ? `${apiBase}/ado/features?epicId=${epic}`
        : `${apiBase}/ado/features`;
      const f = await fetchJSON<Array<{ id: number; title: string }>>(url, {
        headers: h,
      });
      setFeatures(f);
      if (f.length) setFeatureId(String(f[0].id));
      else setFeatureId("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createEpic() {
    if (!newEpic.trim()) return;
    try {
      setBusy(true);
      const w = await fetchJSON<{ id: number; title: string }>(
        `${apiBase}/ado/epics`,
        {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ title: newEpic }),
        }
      );
      setEpics([w, ...epics]);
      setEpicId(String(w.id)); // ✅ state = string
      await loadFeatures(Number(w.id)); // لو loadFeatures بتستقبل رقم
      toast.success("تم إنشاء Epic");
      await loadFeatures(w.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createFeature() {
    if (!newFeature.trim()) return;
    if (!epicId) return toast.error("اختر Epic أولًا");
    try {
      setBusy(true);
      const w = await fetchJSON<{ id: number; title: string }>(
        `${apiBase}/ado/features`,
        {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ title: newFeature, epicId }),
        }
      );
      setFeatures([w, ...features]); // ✅ صحّح الـtypo
      setFeatureId(String(w.id)); // ✅ خزّن كـ string عشان <select>

      setNewFeature("");
      toast.success("تم إنشاء Feature");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function pushStories() {
    if (!featureId) return toast.error("اختر Feature أولًا");
    try {
      setBusy(true);
      // هنضيف الأولوية كـ Tag بسيطة عشان السيرفر الحالي يحطها Tags
      type StoryWithTags = Story & { tags?: string[] };

      const payload = {
        featureId: Number(featureId), // مهم لو مخزّنها string في الواجهة
        stories: stories.map((s) => {
          const existing = (s as StoryWithTags).tags ?? [];
          // فلترة + إزالة تكرار (احتياطي)
          const nextTags = Array.from(
            new Set([
              ...existing.filter((t): t is string => typeof t === "string"),
              `Priority:${priority}`,
            ])
          );
          return { ...s, tags: nextTags };
        }),
      };

      const out = await fetchJSON<{
        ok: boolean;
        created: { id: number; title: string; url: string }[];
      }>(`${apiBase}/ado/stories/bulk`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success(`تم إنشاء ${out.created.length} عنصر`);
      onClose();
      // افتح صفحة Azure DevOps كمرجع سريع
      try {
        window.open(
          `${baseForLinks}/${encodeURIComponent(
            project
          )}/_workitems/recentlyupdated/`,
          "_blank"
        );
      } catch {}
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-[min(720px,95vw)] bg-surface rounded-2xl shadow-xl ring-1 ring-line p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">
            دفع Stories إلى Azure DevOps
          </h3>
          <button
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Epic */}
          <div>
            <div className="text-xs text-slate-500 mb-1">Epic</div>
            <div className="flex gap-2">
              <select
                className="flex-1 h-10 rounded border border-line px-2"
                value={epicId}
                onChange={(e) => {
                  const v = e.target.value; // string
                  setEpicId(v);
                  void loadFeatures(v ? Number(v) : undefined);
                }}
              >
                <option value="">— اختر Epic —</option>
                {epics.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.title}
                  </option>
                ))}
              </select>
              <button onClick={loadEpics} className="h-10 px-3 rounded border">
                تحديث
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newEpic}
                onChange={(e) => setNewEpic(e.target.value)}
                className="flex-1 h-10 rounded border border-line px-2"
                placeholder="Epic جديد…"
              />
              <button
                onClick={createEpic}
                className="h-10 px-3 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={busy}
              >
                + إنشاء
              </button>
            </div>
          </div>

          {/* Feature */}
          <div>
            <div className="text-xs text-slate-500 mb-1">Feature</div>
            <div className="flex gap-2">
              <select
                className="flex-1 h-10 rounded border border-line px-2"
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
              >
                <option value="">— اختر Feature —</option>
                {features.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                className="flex-1 h-10 rounded border border-line px-2"
                placeholder="Feature جديدة…"
              />
              <button
                onClick={createFeature}
                className="h-10 px-3 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={busy || !epicId}
              >
                + إنشاء
              </button>
            </div>
          </div>
        </div>

        {/* Priority + count */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">الأولوية:</span>
            <select
              className="h-9 rounded border border-line px-2"
              value={priority}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setPriority(e.target.value as Priority)
              }
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
            </select>
          </div>
          <div className="text-sm text-slate-600">
            سيتم دفع {stories.length} Story
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 h-10 rounded-lg border">
            إلغاء
          </button>
          <button
            onClick={pushStories}
            disabled={busy || !featureId}
            className="px-4 h-10 rounded-lg text-white bg-blue-600 disabled:opacity-60"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" /> جارٍ الدفع…
              </span>
            ) : (
              "دفع إلى Azure DevOps"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
