import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, CheckCircle2, Zap, BookMarked, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ActionPlan {
  actions: any[];
  summary: string;
}

interface PlanningChatPanelProps {
  date: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/planning-chat`;
const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-plan`;

function extractActionPlan(content: string): ActionPlan | null {
  const match = content.match(/```json:actieplan\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const plan = JSON.parse(match[1]);
    if (plan.actions && Array.isArray(plan.actions)) return plan;
  } catch { /* invalid JSON */ }
  return null;
}

function contentWithoutPlan(content: string): string {
  return content.replace(/```json:actieplan\s*\n[\s\S]*?\n```/, '').trim();
}

export function PlanningChatPanel({ date }: PlanningChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executingPlanIdx, setExecutingPlanIdx] = useState<number | null>(null);
  const [executedPlans, setExecutedPlans] = useState<Set<number>>(new Set());
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [newTip, setNewTip] = useState('');
  const [savingTip, setSavingTip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch planning memory tips
  const { data: memoryItems = [] } = useQuery({
    queryKey: ['planning-memory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_memory')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addTip = async () => {
    const text = newTip.trim();
    if (!text || savingTip) return;
    setSavingTip(true);
    try {
      const { error } = await supabase
        .from('planning_memory')
        .insert({ content: text, category: 'algemeen' });
      if (error) throw error;
      setNewTip('');
      queryClient.invalidateQueries({ queryKey: ['planning-memory'] });
      toast({ title: 'Tip opgeslagen' });
    } catch {
      toast({ title: 'Fout bij opslaan', variant: 'destructive' });
    } finally {
      setSavingTip(false);
    }
  };

  const removeTip = async (id: string) => {
    await supabase.from('planning_memory').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['planning-memory'] });
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setExecutedPlans(new Set());
  }, [date]);

  const executePlan = useCallback(async (plan: ActionPlan, messageIdx: number) => {
    setExecutingPlanIdx(messageIdx);
    try {
      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ actions: plan.actions }),
      });

      const result = await resp.json();

      if (result.success) {
        toast({ title: '✅ Plan doorgevoerd', description: result.message });
        setExecutedPlans(prev => new Set(prev).add(messageIdx));
        queryClient.invalidateQueries({ queryKey: ['daily-planning'] });
        queryClient.invalidateQueries({ queryKey: ['driver-day-overview'] });
        queryClient.invalidateQueries({ queryKey: ['daily-transport'] });
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `✅ **Plan doorgevoerd!** ${result.message}` },
        ]);
      } else {
        toast({ title: 'Gedeeltelijk doorgevoerd', description: result.message, variant: 'destructive' });
        const failedActions = result.results?.filter((r: any) => !r.success) || [];
        const errorDetails = failedActions.map((r: any) => `- ${r.action}: ${r.error}`).join('\n');
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `⚠️ **Gedeeltelijk doorgevoerd.** ${result.message}\n\nFouten:\n${errorDetails}` },
        ]);
      }
    } catch (e) {
      console.error('Execute plan error:', e);
      toast({ title: 'Fout bij doorvoeren', description: 'Probeer het opnieuw', variant: 'destructive' });
    } finally {
      setExecutingPlanIdx(null);
    }
  }, [toast, queryClient]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, date }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fout bij verbinden met assistent');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: 'assistant', content }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ ${e instanceof Error ? e.message : 'Er ging iets mis. Probeer het opnieuw.'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, date, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/10">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-sm flex-1">Planningsassistent</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setMemoryOpen(!memoryOpen)}
        >
          <BookMarked className="h-3.5 w-3.5" />
          Tips ({memoryItems.length})
          {memoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Memory/Tips panel */}
      {memoryOpen && (
        <div className="border-b border-border bg-background px-4 py-3 space-y-2 max-h-[200px] overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Opgeslagen tips — de assistent houdt hier altijd rekening mee:</p>
          {memoryItems.length === 0 && (
            <p className="text-xs text-muted-foreground/60 italic">Nog geen tips opgeslagen.</p>
          )}
          {memoryItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-xs bg-card rounded px-2 py-1.5 border border-border">
              <span className="flex-1">{item.content}</span>
              <button onClick={() => removeTip(item.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newTip}
              onChange={(e) => setNewTip(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTip()}
              placeholder="Nieuwe tip toevoegen..."
              className="h-7 text-xs"
            />
            <Button size="sm" className="h-7 shrink-0" onClick={addTip} disabled={!newTip.trim() || savingTip}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <Bot className="h-10 w-10 mx-auto text-muted/60" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium">Hoi! Ik help je met de planning.</p>
                <p className="text-xs">Stel een vraag over de orders van vandaag, of vraag advies.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {[
                  'Geef een overzicht van vandaag',
                  'Hoe kan ik de ritten combineren?',
                  'Welke chauffeurs zijn beschikbaar?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const plan = msg.role === 'assistant' ? extractActionPlan(msg.content) : null;
            const displayContent = plan ? contentWithoutPlan(msg.content) : msg.content;
            const isExecuted = executedPlans.has(i);
            const isExecuting = executingPlanIdx === i;

            return (
              <div key={i} className="space-y-2">
                <div
                  className={cn(
                    'flex gap-2.5',
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div className={cn(
                    'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  )}>
                    {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm max-w-[85%] leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground border border-border'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:leading-relaxed [&_li]:leading-relaxed">
                        <ReactMarkdown>{displayContent}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>

                {/* Action plan card */}
                {plan && (
                  <div className="ml-9 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      Actieplan ({plan.actions.length} {plan.actions.length === 1 ? 'actie' : 'acties'})
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.summary}</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {plan.actions.slice(0, 5).map((action: any, j: number) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span>
                            {action.type === 'assign_transport' && `Transport toewijzen: ${action.segment}`}
                            {action.type === 'assign_driver' && `Chauffeur koppelen`}
                            {action.type === 'update_order' && `Order bijwerken: ${Object.keys(action.changes || {}).join(', ')}`}
                            {action.type === 'remove_assignment' && `Toewijzing verwijderen`}
                            {action.type === 'split_delivery' && `Levering splitsen in ${action.splits?.length || '?'} delen`}
                          </span>
                        </li>
                      ))}
                      {plan.actions.length > 5 && (
                        <li className="text-muted-foreground/60">... en {plan.actions.length - 5} meer</li>
                      )}
                    </ul>
                    <div className="flex gap-2 pt-1">
                      {isExecuted ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Doorgevoerd
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => executePlan(plan, i)}
                            disabled={isExecuting}
                          >
                            {isExecuting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {isExecuting ? 'Bezig...' : 'Doorvoeren'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => {
                              setInput('Pas het plan aan: ');
                              textareaRef.current?.focus();
                            }}
                          >
                            Aanpassen
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-lg px-3 py-2 bg-background border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag over de planning..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm bg-background"
            rows={1}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 shrink-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
