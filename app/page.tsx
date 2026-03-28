"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { SchemaPanel } from "@/components/SchemaPanel";
import { ProviderSettingsModal } from "@/components/ProviderSettingsModal";
import { LoginModal } from "@/components/LoginModal";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { useSchemaChat } from "@/hooks/useSchemaChat";
import { useProviderSettings } from "@/hooks/useProviderSettings";
import { getProvider, getModel } from "@/lib/providers";
import { Project } from "@/lib/db";

const LS_USERNAME_KEY = "db-designer:username";

export default function Home() {
  const { settings, updateSettings, hydrated: settingsHydrated } = useProviderSettings();

  const [username,          setUsername]          = useState<string | null>(null);
  const [projects,          setProjects]          = useState<Project[]>([]);
  const [currentProjectId,  setCurrentProjectId]  = useState<string | null>(null);
  const [authHydrated,      setAuthHydrated]      = useState(false);
  const [settingsOpen,      setSettingsOpen]      = useState(false);

  const {
    messages, schema, lastDiff, canUndo, undoCount,
    isLoading, error, hydrated,
    sendMessage, uploadDocument, parseDDL, undoSchema, resetAll,
  } = useSchemaChat(currentProjectId, settings);

  // ── 초기화: localStorage에서 username 복원 ──────────────
  useEffect(() => {
    const saved = localStorage.getItem(LS_USERNAME_KEY);
    if (saved) setUsername(saved);
    setAuthHydrated(true);
  }, []);

  // ── username 설정 시 프로젝트 목록 로드 ──────────────────
  useEffect(() => {
    if (!username) return;
    loadProjects(username);
  }, [username]);

  const loadProjects = useCallback(async (user: string) => {
    try {
      const res = await fetch(`/api/projects?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      const list: Project[] = data.projects ?? [];
      setProjects(list);

      // 프로젝트 없으면 자동 생성
      if (list.length === 0) {
        const created = await createProject(user, "새 프로젝트");
        if (created) setCurrentProjectId(created.id);
      } else {
        setCurrentProjectId(list[0].id);
      }
    } catch {
      // 네트워크 오류 등 무시
    }
  }, []);

  async function createProject(user: string, name: string): Promise<Project | null> {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, name }),
      });
      const data = await res.json();
      const project: Project = data.project;
      setProjects((prev) => [project, ...prev]);
      return project;
    } catch {
      return null;
    }
  }

  // ── 로그인 완료 ──────────────────────────────────────────
  function handleLogin(user: string) {
    setUsername(user);
  }

  // ── 로그아웃 ─────────────────────────────────────────────
  function handleLogout() {
    localStorage.removeItem(LS_USERNAME_KEY);
    setUsername(null);
    setProjects([]);
    setCurrentProjectId(null);
  }

  // ── 새 프로젝트 ──────────────────────────────────────────
  async function handleCreateProject() {
    if (!username) return;
    const project = await createProject(username, "새 프로젝트");
    if (project) setCurrentProjectId(project.id);
  }

  // ── 프로젝트 삭제 ────────────────────────────────────────
  async function handleDeleteProject(id: string) {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const newList = projects.filter((p) => p.id !== id);
      setProjects(newList);
      if (currentProjectId === id) {
        if (newList.length > 0) {
          setCurrentProjectId(newList[0].id);
        } else if (username) {
          const project = await createProject(username, "새 프로젝트");
          if (project) setCurrentProjectId(project.id);
        }
      }
    } catch {
      // 무시
    }
  }

  // ── 프로젝트 이름 변경 ───────────────────────────────────
  async function handleRenameProject(id: string, name: string) {
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name } : p))
      );
    } catch {
      // 무시
    }
  }

  // ── 로딩 상태 ────────────────────────────────────────────
  if (!authHydrated || !settingsHydrated) {
    return (
      <div className="flex items-center justify-center bg-gray-50 text-gray-400 text-sm" style={{ height: "calc(100vh - 48px)" }}>
        불러오는 중...
      </div>
    );
  }

  const providerInfo = getProvider(settings.provider);
  const modelInfo    = getModel(settings.provider, settings.model);

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 48px)" }}>
      {/* 로그인 모달 */}
      {!username && <LoginModal onLogin={handleLogin} />}

      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗄️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900">AI DB 설계 툴</h1>
            <p className="text-xs text-gray-400">자연어로 DB 스키마를 설계하세요</p>
          </div>
        </div>

        {/* AI 설정 버튼 */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
        >
          <span className="text-[11px] font-medium text-gray-500 group-hover:text-indigo-600">
            {providerInfo.shortName} · {modelInfo.name}
          </span>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-400 group-hover:text-indigo-500"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* 메인 */}
      <main className="flex flex-1 min-h-0">
        {/* 프로젝트 사이드바 */}
        {username && (
          <ProjectSidebar
            username={username}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onLogout={handleLogout}
          />
        )}

        {/* 채팅 */}
        <div className="flex-1 border-r border-gray-200 bg-white flex flex-col min-h-0 min-w-0">
          {currentProjectId && hydrated ? (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              error={error}
              onSend={sendMessage}
              onUpload={uploadDocument}
              onReset={resetAll}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              {username ? "프로젝트를 선택하세요" : ""}
            </div>
          )}
        </div>

        {/* 스키마 */}
        <div className="flex-1 bg-white flex flex-col min-h-0 min-w-0">
          <SchemaPanel
            schema={schema}
            lastDiff={lastDiff}
            canUndo={canUndo}
            undoCount={undoCount}
            onUndo={undoSchema}
            onParseDDL={parseDDL}
            isLoading={isLoading}
          />
        </div>
      </main>

      {/* AI 설정 모달 */}
      <ProviderSettingsModal
        open={settingsOpen}
        initialSettings={settings}
        onSave={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
