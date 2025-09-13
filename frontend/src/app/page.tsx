"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type DetailedHTMLProps,
  type HTMLAttributes,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
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
  Download,
  Lightbulb,
  Moon,
  Clipboard,
  Check,
  Sun,
  Monitor,
  ArrowUp,
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";

/* -------------------------- Config -------------------------- */
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
function getApiBase() {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  return localStorage.getItem("api_base") || DEFAULT_API_BASE;
}

/* -------------------------- Types -------------------------- */
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
  timestamp?: number; // إضافة التوقيت
};
type Story = {
  id?: number;
  title: string;
  description?: string;
  acceptance_criteria?: string;
};
type Insights = { gaps: string[]; risks: string[]; metrics: string[] };
type Status = {
  hasBrd: boolean;
  storyCount: number;
  lastUploadedAt: string | null;
};

/* -------------------------- Utils -------------------------- */

function statusBorderClass(s: "ok" | "fail" | "loading") {
  // كلاس لتلوين حدود أي عنصر (أفاتار/صورة...) حسب حالة الاتصال
  return clsx(
    "ring-2",
    s === "ok" && "ring-emerald-500",
    s === "fail" && "ring-red-500 animate-pulse",
    s === "loading" && "ring-yellow-400"
  );
}

function extractError(obj: unknown): string | undefined {
  if (obj && typeof obj === "object" && "error" in obj) {
    const val = (obj as Record<string, unknown>).error;
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "حدث خطأ غير متوقع";
  }
}
function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-blue-600", className)} />;
}
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
  messages: "brd_messages",
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

export default function Home() {
  const idRef = useRef(1);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: idRef.current++,
      role: "assistant",
      content: "أهلًا! ارفع الـBRD أو ابعتلي نص، وأنا هساعدك.",
      timestamp: Date.now(), // أضف التوقيت للرسالة الأولى
    },
  ]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [dark, setDark] = useState(false);
  const [input, setInput] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [patchLoading, setPatchLoading] = useState(false);
  const [appendLoading, setAppendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [mermaidCode, setMermaidCode] = useState("");
  const [flowLoading, setFlowLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [serverStatus, setServerStatus] = useState<"ok" | "fail" | "loading">(
    "loading"
  );
  // حالة اتصال OpenAI
  const [openAIStatus, setOpenAIStatus] = useState<"ok" | "fail" | "loading">("loading");
  const [openAIError, setOpenAIError] = useState<string | null>(null);


  const [opProgress, setOpProgress] = useState<number | null>(null);
  const [opBubble, setOpBubble] = useState<null | {
    type: "summarize" | "stories";
    msgId: number;
  }>(null);
  const [persistEnabled] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  type UploadTask = {
    name: string;
    progress: number;
    status: "uploading" | "done" | "error";
  };
  // =============== Story Tags (local only) ===============
  type Tag = "None" | "Critical" | "Enhancement" | "Blocked";
  const [storyTags, setStoryTags] = useState<Record<string | number, Tag>>({});
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
            const msg = (d?.error?.message) || d?.message;
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
  const onChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    // لو نزل أكتر من 200px نعرض الزر
    setShowScrollTop(el.scrollTop > 200);
  }, []);

  const scrollToTop = useCallback(() => {
    chatRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
  const isUploading = uploads.some((u) => u.status === "uploading");
  const [backlogQuery, setBacklogQuery] = useState("");
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
  const [mermaidSvg, setMermaidSvg] = useState("");
  // Quick command bubbles
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
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sKey = localStorage.getItem("brd_api_key") || "";
      setApiKey(sKey);
      setApiBaseInput(getApiBase());
    }
  }, []);

  const filteredStories = useMemo(() => {
    const q = backlogQuery.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((s) =>
      [s.title, s.description, s.acceptance_criteria]
        .filter(Boolean)
        .some((t) => (t || "").toLowerCase().includes(q))
    );
  }, [stories, backlogQuery]);

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
    const savedMsgs = safeParse<ChatMessage[]>(
      localStorage.getItem(LS_KEYS.messages),
      []
    );
    if (savedMsgs.length) setMessages(savedMsgs);

    const savedStories = safeParse<Story[]>(
      localStorage.getItem(LS_KEYS.stories),
      []
    );
    if (savedStories.length) setStories(savedStories);

    const savedInsights = safeParse<Insights>(
      localStorage.getItem(LS_KEYS.insights),
      { gaps: [], risks: [], metrics: [] }
    );
    if (
      savedInsights.gaps.length ||
      savedInsights.risks.length ||
      savedInsights.metrics.length
    ) {
      setInsights(savedInsights);
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

      setMessages((p) => [
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
  const persistMessages = useMemo(
    () =>
      debounce((data: ChatMessage[]) => {
        const trimmed = data.slice(-300);
        localStorage.setItem(LS_KEYS.messages, JSON.stringify(trimmed));
      }, 500),
    []
  );
  useEffect(() => {
    if (!mermaidCode) return;
    mermaid.initialize({ startOnLoad: false, theme: "default" });
    const code = cleanMermaidCode(mermaidCode);
    mermaid.render("ai-flowchart-svg", code).then(({ svg }) => {
      setMermaidSvg(svg);
    });
  }, [mermaidCode]);
  useEffect(() => {
    if (!persistEnabled) return;
    persistMessages(messages);
  }, [messages, persistEnabled, persistMessages]);

  // Persist stories
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

  // Persist insights
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
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads((prev) =>
            prev.map((t) =>
              t.name === file.name ? { ...t, status: "done", progress: 100 } : t
            )
          );
          setMessages((p) => [
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
  setMermaidSvg("");
  try {
    const res = await fetch(getApiBase() + "/generate-flowchart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey, // أضف هذا السطر
      },
      body: JSON.stringify({ stories }),
    });
    const data = await res.json();
    setMermaidCode(data.code || "");
  } catch (e) {
    toast.error("تعذر توليد الرسم بالذكاء الاصطناعي");
  } finally {
    setFlowLoading(false);
  }
};
  const doSummarize = useCallback(async (): Promise<void> => {
    setOpLoading(true);
    setError(null);

    const msgId = idRef.current++;
    setMessages((p) => [
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

      setMessages((p) =>
        p.map((m) => (m.id === msgId ? { ...m, content: data.summary } : m))
      );
      toast.success("تم توليد ملخص");
    } catch (e) {
      stop();
      const msg = errorMessage(e) || "تعذّر التلخيص";
      setMessages((p) =>
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
    setMessages((p) => [
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
      const data = await fetchJSON<{ stories: Story[] }>(
        `${getApiBase()}/stories/generate`,
        { method: "POST" }
      );
      stop();
      setOpProgress(100);

      setStories(data.stories || []);
      setMessages((p) =>
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
      setMessages((p) =>
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
  }, [status.hasBrd, refreshStatus]);

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

  const [exportTypes, setExportTypes] = useState<("pdf" | "docx" | "json")[]>([]);
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

        setMessages((p) => [
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
      if (!raw.trim() || sendLoading) return;

      if (await handleCommand(raw)) {
        if (!overrideText) setInput("");
        return;
      }

      setSendLoading(true);
      setError(null);

      const userMsg: ChatMessage = {
        id: idRef.current++,
        role: "user",
        content: raw,
        timestamp: Date.now(),
      };
      setMessages((p) => [...p, userMsg]);
      if (!overrideText) setInput("");

      const botId = idRef.current++;
      setMessages((p) => [
        ...p,
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
          setMessages((p) =>
            p.map((m) =>
              m.id === botId ? { ...m, content: acc, typing: true } : m
            )
          );
        });
        setMessages((p) =>
          p.map((m) => (m.id === botId ? { ...m, typing: false } : m))
        );
      } catch (e: unknown) {
        let msg = errorMessage(e);
        if (e instanceof DOMException && e.name === "AbortError")
          msg = "انتهت المهلة، جرّب تاني.";
        setError(msg);
        toast.error(msg);
        setMessages((p) =>
          p.map((m) =>
            m.id === botId ? { ...m, content: msg, typing: false } : m
          )
        );
      } finally {
        setSendLoading(false);
      }
    },
    [input, sendLoading, handleCommand]
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

      setMessages((p) => [
        ...p,
        {
          id: idRef.current++,
          role: "assistant",
          content: `تمت إضافة ${
            appendType === "story" ? "Story" : "Feature"
          } بنجاح.`,
        },
      ])

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
      className="min-h-screen grid grid-cols-12 gap-4 bg-background p-4 relative"
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
                  ? (openAIError || "تعذّر الاتصال بـ OpenAI")
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

      {/* Insights */}
      <aside className="col-span-3 bg-surface rounded-xl shadow p-4 text-foreground">
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
        <ul className="text-sm space-y-3 mt-3 pe-1 overflow-y-auto max-h-[70vh]">
          {insights.gaps.map((g, i) => (
            <li key={`g${i}`} className="flex items-start gap-2 text-amber-700">
              ⚠️ <span>{g}</span>
            </li>
          ))}
          {insights.risks.map((r, i) => (
            <li key={`r${i}`} className="flex items-start gap-2 text-red-600">
              ⚠️ <span>{r}</span>
            </li>
          ))}
          {insights.metrics.map((m, i) => (
            <li key={`m${i}`} className="flex items-start gap-2 text-blue-700">
              📊 <span>{m}</span>
            </li>
          ))}
          {!insights.gaps.length &&
            !insights.risks.length &&
            !insights.metrics.length && (
              <li className="text-slate-400 text-sm">لا توجد إنسايتس بعد.</li>
            )}
        </ul>
      </aside>

      {/* ===== Chat column ===== */}
      <main className="col-span-6 bg-surface rounded-xl shadow flex flex-col relative text-foreground">
        {/* Messages */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-8 space-y-3 max-h-[calc(100vh-200px)]"
          onScroll={onChatScroll}
        >
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                key="scrollTopBtn"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToTop}
                className="absolute bottom-20 right-4 p-2 rounded-full shadow-lg border bg-white hover:bg-slate-50"
                title="العودة لأعلى"
              >
                <ArrowUp className="w-5 h-5 text-slate-700" />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className={clsx(
                  "w-full flex items-start gap-2",
                  m.role === "assistant" ? "justify-start" : "justify-end"
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                      🤖
                    </div>

                    <div
                      dir="auto"
                      className={clsx(
                        "p-3 leading-7 group relative max-w-[75%] break-words whitespace-normal",
                        "bg-muted text-foreground",
                        "rounded-2xl rounded-tr-sm"
                      )}
                    >
                      {/* زر النسخ */}
                      {!m.typing && (
                        <button
                          onClick={() => copyMessage(m.id, m.content)}
                          className="absolute -top-2 -end-2 p-1.5 rounded-full border bg-white/90 shadow
                           opacity-0 group-hover:opacity-100 transition"
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
                      <div className="text-[10px] text-slate-400 mt-1">
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleTimeString()
                          : ""}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      dir="auto"
                      className={clsx(
                        "p-3 leading-7 group relative max-w-[75%] break-words whitespace-normal",
                        "bg-muted text-foreground",
                        "rounded-2xl rounded-tl-sm"
                      )}
                    >
                      {/* زر النسخ */}
                      {!m.typing && (
                        <button
                          onClick={() => copyMessage(m.id, m.content)}
                          className="absolute -top-2 -end-2 p-1.5 rounded-full border bg-white/90 shadow
                           opacity-0 group-hover:opacity-100 transition"
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
                      <div className="text-[10px] text-slate-400 mt-1">
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleTimeString()
                          : ""}
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
                      👤
                    </div>
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
            {helpCmds.map((c) => (
              <button
                key={c.insert}
                onClick={() => setInput(c.insert)}
                className="text-xs px-3 h-8 rounded-full border bg-white hover:bg-blue-50 text-slate-700"
                title={c.insert}
              >
                {c.label}
              </button>
            ))}
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
            className="flex-1 border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 disabled:bg-gray-100 text-slate-900 placeholder-slate-500 resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالتك هنا... (جرّب /help)"
            disabled={sendLoading}
            rows={1}
            style={{
              minHeight: "40px",
              maxHeight: "140px", // تقريبًا 5 أسطر
              overflowY: "auto",
            }}
            onInput={(e) => {
              const ta = e.currentTarget;
              ta.style.height = "40px";
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
            onClick={() => setMessages([])}
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
              {exportLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                "تصدير"
              )}
            </button>
            {/* قائمة الصيغ تظهر فقط عند فتح الدروب داون */}
            {showExportMenu && !exportLoading && (
              <div
                className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg"
                style={{ width: "100%" }} // نفس عرض الزر
              >
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("pdf")}
                    onChange={e => {
                      setExportTypes(types =>
                        e.target.checked
                          ? [...types, "pdf"]
                          : types.filter(t => t !== "pdf")
                      );
                    }}
                  />
                  <span className="ms-2">PDF</span>
                </label>
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("docx")}
                    onChange={e => {
                      setExportTypes(types =>
                        e.target.checked
                          ? [...types, "docx"]
                          : types.filter(t => t !== "docx")
                      );
                    }}
                  />
                  <span className="ms-2">DOCX</span>
                </label>
                <label className="flex items-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={exportTypes.includes("json")}
                    onChange={e => {
                      setExportTypes(types =>
                        e.target.checked
                          ? [...types, "json"]
                          : types.filter(t => t !== "json")
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

        {/* Status */}
        <div className="text-xs text-slate-500">
          <div>BRD: {status.hasBrd ? "✓ موجود" : "— غير موجود"}</div>
          <div>Stories: {status.storyCount}</div>
          {status.lastUploadedAt && (
            <div>
              آخر رفع: {new Date(status.lastUploadedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Backlog */}
        <div className="h-px bg-slate-200" />
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-semibold text-slate-700">Backlog</h3>
            <div className="flex items-center gap-2">
              <input
                value={backlogQuery}
                onChange={(e) => {
                  setPage(1);
                  setBacklogQuery(e.target.value);
                }}
                placeholder="بحث في الـStories..."
                className="h-8 px-2 rounded border border-line focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm"
              />
              <button
                onClick={() => {
                  void refreshStories();
                  toast.message("تم تحديث الـStories");
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                تحديث
              </button>
            </div>
          </div>

          <ul className="text-sm space-y-2 max-h-56 overflow-auto pe-1">
            {pagedStories.length ? (
              pagedStories.map((s) => (
                <li
                  key={s.id ?? s.title}
                  className="p-2 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* يسار: تفاصيل الستوري */}
                    <div>
                      <div className="font-medium">{s.title}</div>

                      {s.description && (
                        <div className="text-slate-500 text-xs mt-1">
                          {s.description}
                        </div>
                      )}

                      {s.acceptance_criteria && (
                        <div className="text-slate-500 text-xs mt-1">
                          AC: {s.acceptance_criteria}
                        </div>
                      )}

                      {/* سطر التاج */}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={clsx(
                            "text-[11px] border rounded-full px-2 py-0.5",
                            tagColor(storyTags[s.id ?? s.title] ?? "None")
                          )}
                        >
                          {storyTags[s.id ?? s.title] ?? "None"}
                        </span>

                        <select
                          className="text-[11px] border rounded px-1.5 py-0.5 bg-white"
                          value={storyTags[s.id ?? s.title] ?? "None"}
                          onChange={(e) =>
                            setTag(s.id ?? s.title, e.target.value as Tag)
                          }
                          title="Set tag"
                        >
                          <option>None</option>
                          <option>Critical</option>
                          <option>Enhancement</option>
                          <option>Blocked</option>
                        </select>
                      </div>
                    </div>

                    {/* يمين: أزرار الإجراء */}
                    <div className="flex items-center gap-1 opacity-70">
                      <button
                        className="p-1 hover:bg-slate-100 rounded"
                        title="Edit"
                        onClick={async () => {
                          const nt =
                            prompt("Edit title", s.title ?? "") ?? s.title;
                          const nd =
                            prompt("Edit description", s.description ?? "") ??
                            s.description;
                          const nac =
                            prompt(
                              "Edit acceptance criteria",
                              s.acceptance_criteria ?? ""
                            ) ?? s.acceptance_criteria;

                          setStories((list) =>
                            list.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    title: nt!,
                                    description: nd!,
                                    acceptance_criteria: nac!,
                                  }
                                : x
                            )
                          );

                          try {
                            await fetch(`${getApiBase()}/stories/${s.id}`, {
                              method: "PUT",
                              headers: getHeaders({
                                "Content-Type": "application/json",
                              }),
                              body: JSON.stringify({
                                title: nt,
                                description: nd,
                                acceptance_criteria: nac,
                              }),
                            });
                          } catch {}
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        className="p-1 hover:bg-slate-100 rounded"
                        title="Delete"
                        onClick={async () => {
                          setStories((list) =>
                            list.filter((x) => x.id !== s.id)
                          );
                          try {
                            await fetch(`${getApiBase()}/stories/${s.id}`, {
                              method: "DELETE",
                              headers: getHeaders(),
                            });
                          } catch {}
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
                  localStorage.removeItem(LS_KEYS.messages);
                  localStorage.removeItem(LS_KEYS.stories);
                  localStorage.removeItem(LS_KEYS.insights);
                  setMessages([]);
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

      {/* Flowchart Modal */}
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
              <button className="btn btn-primary" onClick={handleAIGenerate} disabled={flowLoading || stories.length === 0}>
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
              <button className="btn btn-ghost" onClick={() => setZoomed(z => !z)}>
                {zoomed ? "تصغير" : "تكبير"}
              </button>
            </div>
            {flowLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <Spinner className="h-10 w-10 text-blue-600 animate-spin" />
                <span className="ms-3 text-blue-700 font-semibold">جاري توليد الرسم...</span>
              </div>
            ) : (
              mermaidSvg && (
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
              )
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

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

function cleanMermaidCode(code: string): string {
  // احذف أي ```mermaid أو ``` أو نص خارج الرسم
  let cleaned = code.trim();
  // احذف بداية ونهاية البلوك
  cleaned = cleaned.replace(/^```mermaid\s*/i, "");
  cleaned = cleaned.replace(/^```/, "");
  cleaned = cleaned.replace(/```$/i, "");
  // احذف أي نص قبل graph أو بعد نهاية الرسم
  const graphIdx = cleaned.indexOf("graph");
  if (graphIdx !== -1) {
    cleaned = cleaned.slice(graphIdx);
  }
  return cleaned.trim();
}

