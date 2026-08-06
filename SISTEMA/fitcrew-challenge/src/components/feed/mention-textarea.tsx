import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchUsernames } from "@/lib/mentions.functions";

type User = { id: string; username: string; display_name: string; avatar_url: string | null };

/**
 * Textarea with lightweight @username autocomplete.
 * Detects the token under the caret; queries usernames; inserts selection.
 */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength = 2000,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [tokenStart, setTokenStart] = useState<number>(0);
  const [items, setItems] = useState<User[]>([]);
  const [active, setActive] = useState(0);
  const search = useServerFn(searchUsernames);

  useEffect(() => {
    if (query === null) return;
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { q: query } });
        if (!cancel) {
          setItems(r.items);
          setActive(0);
        }
      } catch {
        /* ignore */
      }
    }, 120);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [query, search]);

  const detectToken = (text: string, caret: number) => {
    // Find "@word" ending at caret
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([a-z0-9_]{0,20})$/i.exec(before);
    if (!m) {
      setQuery(null);
      setItems([]);
      return;
    }
    setTokenStart(caret - m[1].length - 1); // position of '@'
    setQuery(m[1].toLowerCase());
  };

  const insertMention = (u: User) => {
    if (!ref.current) return;
    const el = ref.current;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, tokenStart);
    const after = value.slice(caret);
    const insertion = `@${u.username} `;
    const next = before + insertion + after;
    onChange(next);
    setQuery(null);
    setItems([]);
    requestAnimationFrame(() => {
      const pos = (before + insertion).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        autoFocus={autoFocus}
        rows={rows}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          detectToken(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (!items.length || query === null) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % items.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insertMention(items[active]);
          } else if (e.key === "Escape") {
            setQuery(null);
            setItems([]);
          }
        }}
        onKeyUp={(e) => {
          const el = e.currentTarget;
          detectToken(el.value, el.selectionStart ?? el.value.length);
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          detectToken(el.value, el.selectionStart ?? el.value.length);
        }}
      />
      {query !== null && items.length > 0 && (
        <div className="absolute left-0 right-0 bottom-full z-50 mb-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-lg">
          {items.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${
                i === active ? "bg-secondary" : "hover:bg-secondary/60"
              }`}
            >
              <Avatar className="size-7 border border-border">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback>{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">@{u.username}</p>
                <p className="truncate text-xs text-muted-foreground">{u.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
