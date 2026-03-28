"use client";

import { useState, useRef, useEffect } from "react";
import { Project } from "@/lib/db";

interface ProjectSidebarProps {
  username: string;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onLogout: () => void;
}

export function ProjectSidebar({
  username,
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onLogout,
}: ProjectSidebarProps) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [renamingId,   setRenamingId]   = useState<string | null>(null);
  const [renameValue,  setRenameValue]  = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  function startRename(project: Project) {
    setRenamingId(project.id);
    setRenameValue(project.name);
  }

  function commitRename(id: string) {
    const name = renameValue.trim();
    if (name && name !== projects.find((p) => p.id === id)?.name) {
      onRenameProject(id, name);
    }
    setRenamingId(null);
  }

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col items-center py-3 bg-gray-50 border-r border-gray-200 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          title="사이드바 펼치기"
          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            title={p.name}
            className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors ${
              p.id === currentProjectId
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {p.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-52 flex-shrink-0 flex flex-col bg-gray-50 border-r border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 truncate">프로젝트</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
          title="사이드바 접기"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 새 프로젝트 버튼 */}
      <div className="px-2 pt-2">
        <button
          onClick={onCreateProject}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          새 프로젝트
        </button>
      </div>

      {/* 프로젝트 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {projects.length === 0 && (
          <p className="text-[11px] text-gray-400 px-2 py-3 text-center">프로젝트가 없습니다</p>
        )}
        {projects.map((project) => {
          const isActive  = project.id === currentProjectId;
          const isRenaming = renamingId === project.id;
          const isDeleting = deleteConfirm === project.id;

          return (
            <div
              key={project.id}
              className={`group relative rounded-lg transition-colors ${
                isActive ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-100 border border-transparent"
              }`}
            >
              {isDeleting ? (
                /* 삭제 확인 */
                <div className="px-2.5 py-2">
                  <p className="text-[11px] text-red-600 mb-1.5">삭제할까요?</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { onDeleteProject(project.id); setDeleteConfirm(null); }}
                      className="flex-1 px-2 py-1 text-[11px] bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-2 py-1 text-[11px] bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : isRenaming ? (
                /* 이름 변경 */
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(project.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-indigo-400 rounded-lg outline-none text-gray-900"
                />
              ) : (
                /* 일반 표시 */
                <button
                  onClick={() => onSelectProject(project.id)}
                  className="w-full text-left px-2.5 py-2 pr-14"
                >
                  <span className={`text-xs truncate block ${isActive ? "text-indigo-700 font-medium" : "text-gray-700"}`}>
                    {project.name}
                  </span>
                </button>
              )}

              {/* 액션 버튼 (hover or active) */}
              {!isRenaming && !isDeleting && (
                <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(project); }}
                    title="이름 변경"
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                    title="삭제"
                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단: 사용자 + 로그아웃 */}
      <div className="px-3 py-3 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-indigo-600">
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-gray-600 truncate">{username}</span>
        </div>
        <button
          onClick={onLogout}
          title="로그아웃"
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
