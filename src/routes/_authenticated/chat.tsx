import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, Send, Sparkles, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatWithClaude } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quanti clienti Champion abbiamo e qual è il loro LTV medio?",
  "Crea un report sintetico dell'ultimo mese",
  "Quali sono i top 3 prodotti venduti di recente?",
  "Quali segmenti hanno il maggior potenziale di riattivazione?",
  "Riassumi lo stato dei ticket Zendesk",
  "Suggerisci 3 campagne per la community Circle",
];

function ChatPage() {
  const ask = useServerFn(chatWithClaude);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (history: Msg[]) => ask({ data: { messages: history } }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    },
    onError: (err: Error) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Errore: ${err.message}` },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    mutation.mutate(next);
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    mutation.reset();
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-6 gap-4">
      <header className="flex items-center justify-between shrink-0">
        <div>
          <p className="font-mono text-xs text-primary tracking-widest">CHAT AI</p>
          <h1 className="text-3xl font-semibold mt-1 flex items-center gap-2">
            <Brain className="size-7 text-primary" /> Chiedi a Claude
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fai domande sui dati, genera report, analizza segmenti e clienti.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RefreshCw className="size-3.5 mr-1.5" /> Nuova chat
          </Button>
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto glow-card p-5 space-y-4 border-primary/20"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-8">
            <Sparkles className="size-10 text-primary" />
            <div>
              <p className="text-lg font-semibold">Come posso aiutarti oggi?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ho accesso a tutti i dati di clienti, ordini, segmenti, community e ticket.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs p-3 rounded-md border border-border bg-surface-2/40 hover:border-primary/40 hover:bg-primary/5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="size-8 shrink-0 rounded-full bg-primary/15 grid place-items-center border border-primary/30">
                <Brain className="size-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2/60 border border-border"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-primary prose-table:text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="size-8 shrink-0 rounded-full bg-primary/15 grid place-items-center border border-primary/30">
              <Brain className="size-4 text-primary animate-pulse" />
            </div>
            <div className="bg-surface-2/60 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary animate-pulse" /> Claude sta analizzando i dati…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 shrink-0"
      >
        <div className="flex-1 flex items-center gap-2 bg-surface-2 border border-border rounded-md px-3 py-2 focus-within:border-primary/50 transition">
          <MessageSquare className="size-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fai una domanda sui tuoi dati…"
            disabled={mutation.isPending}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
          />
        </div>
        <Button type="submit" disabled={mutation.isPending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
