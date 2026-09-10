'use client';

import { useState } from 'react';
import { MarkdownEditor } from '@/components/MarkdownEditor';

const DEFAULT_SERVER = 'ws://localhost:1234';

export default function Home() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [roomInput, setRoomInput] = useState('');
  const [joined, setJoined] = useState(false);
  const [activeRoom, setActiveRoom] = useState('');

  const handleEnter = () => {
    setActiveRoom(roomInput.trim());
    setJoined(true);
  };

  const handleLeave = () => {
    setJoined(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">CollaFlow</h1>
        <p className="mt-2 text-muted-foreground">
          高性能协同脑图 / 文档工作台 · 基于 CollaMarkdown 编辑器
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">协同服务地址</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="ws://localhost:1234"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">房间 / 文档 ID</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEnter();
            }}
            placeholder="留空则单机编辑"
          />
        </label>
        <button
          type="button"
          onClick={handleEnter}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {joined ? '重新进入' : '进入房间'}
        </button>
        {joined && (
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-md border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            退出
          </button>
        )}
        {joined && (
          <p className="text-xs text-muted-foreground">
            {activeRoom ? `已接入协同房间「${activeRoom}」` : '本地编辑模式（未启用协同）'}
          </p>
        )}
      </section>

      {joined ? (
        <MarkdownEditor roomId={activeRoom || undefined} serverUrl={serverUrl} />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          输入房间 ID（可选）后点击「进入房间」开始编辑
        </div>
      )}
    </main>
  );
}
