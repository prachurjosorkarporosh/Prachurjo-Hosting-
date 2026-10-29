import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Eye,
  FileCode,
  FilePlus,
  FolderOpen,
  Globe,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { StorageObject, UserProfile, Website } from '../types';
import { compileSandboxedPreviewHtml, validateSafeFilePath } from '../lib/templates';
import {
  createOrReplaceDraftFile,
  deleteDraftFile,
  renameDraftFile,
  saveDraftFileContent,
} from '../services/platformService';

interface OnlineEditorViewProps {
  profile: UserProfile;
  websites: Website[];
  selectedWebsite: Website | null;
  onSelectWebsite: (website: Website) => void;
  draftFiles: StorageObject[];
  onRefreshDraftFiles: () => Promise<void>;
  onOpenPublishModal: (website: Website) => void;
  onCreateNewWebsiteTrigger: () => void;
}

export const OnlineEditorView: React.FC<OnlineEditorViewProps> = ({
  profile,
  websites,
  selectedWebsite,
  onSelectWebsite,
  draftFiles,
  onRefreshDraftFiles,
  onOpenPublishModal,
  onCreateNewWebsiteTrigger,
}) => {
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [editorText, setEditorText] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [creatingFile, setCreatingFile] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [recoveredDraftBanner, setRecoveredDraftBanner] = useState<string | null>(null);

  const activeFile = useMemo(
    () => draftFiles.find((f) => f.id === activeFileId) || draftFiles[0] || null,
    [draftFiles, activeFileId]
  );

  // Sync active file when project or files change
  useEffect(() => {
    if (activeFile) {
      setActiveFileId(activeFile.id);
      const recoveryKey = `ph_autosave_${activeFile.id}`;
      const savedLocal = localStorage.getItem(recoveryKey);
      if (savedLocal && savedLocal !== activeFile.content) {
        setEditorText(savedLocal);
        setIsDirty(true);
        setRecoveredDraftBanner(`Recovered unsaved local draft for ${activeFile.fileName}`);
      } else {
        setEditorText(activeFile.content);
        setIsDirty(false);
        setRecoveredDraftBanner(null);
      }
    } else {
      setEditorText('');
      setIsDirty(false);
    }
  }, [activeFile?.id]);

  // Autosave to localStorage for crash recovery
  useEffect(() => {
    if (!activeFile || !isDirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`ph_autosave_${activeFile.id}`, editorText);
      } catch {
        // Ignore storage quota errors
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [editorText, isDirty, activeFile]);

  const handleSaveCurrentFile = async () => {
    if (!selectedWebsite || !activeFile) return;
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await saveDraftFileContent(profile, selectedWebsite, activeFile, editorText);
      localStorage.removeItem(`ph_autosave_${activeFile.id}`);
      setIsDirty(false);
      setRecoveredDraftBanner(null);
      await onRefreshDraftFiles();
      setStatusMessage(`Saved ${activeFile.fileName}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save draft file.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWebsite || !newFileName.trim()) return;
    setErrorMessage(null);
    const check = validateSafeFilePath(newFileName.trim());
    if (!check.valid) {
      setErrorMessage(check.error || 'Invalid file name.');
      return;
    }
    setSaving(true);
    try {
      const defaultContent = check.normalizedPath.endsWith('.html')
        ? '<!DOCTYPE html>\n<html>\n<body>\n  <h1>New Page</h1>\n</body>\n</html>'
        : check.normalizedPath.endsWith('.css')
        ? '/* Stylesheet */\nbody {\n  margin: 0;\n}\n'
        : check.normalizedPath.endsWith('.js')
        ? '// Client Script\nconsole.log("Ready");\n'
        : '';
      const created = await createOrReplaceDraftFile(
        profile,
        selectedWebsite,
        draftFiles,
        check.normalizedPath,
        defaultContent
      );
      setNewFileName('');
      setCreatingFile(false);
      await onRefreshDraftFiles();
      setActiveFileId(created.id);
      setStatusMessage(`Created ${created.fileName}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not create file.');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameSubmit = async (fileObj: StorageObject) => {
    if (!renameValue.trim() || renameValue.trim() === fileObj.fileName) {
      setRenamingFileId(null);
      return;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      await renameDraftFile(fileObj, renameValue.trim(), draftFiles);
      setRenamingFileId(null);
      await onRefreshDraftFiles();
      setStatusMessage(`Renamed to ${renameValue.trim()}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not rename file.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (fileObj: StorageObject) => {
    if (!selectedWebsite) return;
    setErrorMessage(null);
    setSaving(true);
    try {
      await deleteDraftFile(profile, selectedWebsite, fileObj);
      localStorage.removeItem(`ph_autosave_${fileObj.id}`);
      await onRefreshDraftFiles();
      setStatusMessage(`Deleted ${fileObj.fileName}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not delete file.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAssetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWebsite) return;
    setErrorMessage(null);
    const check = validateSafeFilePath(file.name);
    if (!check.valid) {
      setErrorMessage(check.error || 'Unsupported asset file.');
      e.target.value = '';
      return;
    }
    setSaving(true);
    try {
      const textContent = await file.text();
      const uploaded = await createOrReplaceDraftFile(
        profile,
        selectedWebsite,
        draftFiles,
        check.normalizedPath,
        textContent
      );
      await onRefreshDraftFiles();
      setActiveFileId(uploaded.id);
      setStatusMessage(`Uploaded ${uploaded.fileName}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Asset upload failed.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  // Build live preview combining current unsaved editorText with other draftFiles
  const previewSrcDoc = useMemo(() => {
    if (!selectedWebsite) return '';
    const mergedFiles = draftFiles.map((f) =>
      activeFile && f.id === activeFile.id ? { ...f, content: editorText } : f
    );
    return compileSandboxedPreviewHtml(mergedFiles, selectedWebsite.entryFile || 'index.html');
  }, [draftFiles, activeFile, editorText, selectedWebsite]);

  const lineCount = useMemo(() => Math.max(1, editorText.split('\n').length), [editorText]);

  if (websites.length === 0 || !selectedWebsite) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center">
        <Code2 className="w-10 h-10 text-[#4169F5] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#172033] dark:text-white mb-2">
          No Website Selected for Editing
        </h3>
        <p className="text-sm text-[#64748B] dark:text-slate-400 max-w-md mx-auto mb-6">
          Create a new website from a starter template or upload an existing HTML/ZIP project to launch the browser IDE.
        </p>
        <button
          onClick={onCreateNewWebsiteTrigger}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
        >
          Create First Website
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top IDE Toolbar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#4169F5]" />
            <select
              value={selectedWebsite.id}
              onChange={(e) => {
                const found = websites.find((w) => w.id === e.target.value);
                if (found) onSelectWebsite(found);
              }}
              className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-white"
            >
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.slug})
                </option>
              ))}
            </select>
          </div>

          {activeFile && (
            <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2">
              <span className="font-mono font-semibold text-[#172033] dark:text-slate-200">
                {activeFile.fileName}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">{activeFile.sizeBytes} B</span>
              {isDirty && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Unsaved Changes
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Controls: View Mode Switcher + Save + Publish */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                viewMode === 'code'
                  ? 'bg-white dark:bg-slate-900 text-[#172033] dark:text-white shadow-2xs'
                  : 'text-[#64748B]'
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-[#172033] dark:text-white shadow-2xs'
                  : 'text-[#64748B]'
              }`}
            >
              Split IDE
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-[#172033] dark:text-white shadow-2xs'
                  : 'text-[#64748B]'
              }`}
            >
              Live Preview
            </button>
          </div>

          <button
            onClick={handleSaveCurrentFile}
            disabled={saving || !activeFile}
            className="px-3.5 py-2 text-xs font-semibold text-[#172033] dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#4169F5] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#4169F5]" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={() => onOpenPublishModal(selectedWebsite)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            Choose Domain & Publish
          </button>
        </div>
      </div>

      {/* Feedback / Recovery Banners */}
      {(errorMessage || statusMessage || recoveredDraftBanner) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl glass-subtle text-xs">
          <div className="flex items-center gap-3">
            {errorMessage && <span className="text-[#DC2626] font-semibold">{errorMessage}</span>}
            {statusMessage && (
              <span className="text-[#16A34A] font-semibold inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {statusMessage}
              </span>
            )}
            {recoveredDraftBanner && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {recoveredDraftBanner}
              </span>
            )}
          </div>
          {recoveredDraftBanner && activeFile && (
            <button
              onClick={() => {
                localStorage.removeItem(`ph_autosave_${activeFile.id}`);
                setEditorText(activeFile.content);
                setIsDirty(false);
                setRecoveredDraftBanner(null);
              }}
              className="text-xs text-[#64748B] hover:underline cursor-pointer"
            >
              Discard local recovery
            </button>
          )}
        </div>
      )}

      {/* Main IDE Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[560px]">
        {/* Left File Explorer */}
        <div className="lg:col-span-3 glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800">
              <span className="text-xs font-bold text-[#172033] dark:text-white">
                PROJECT FILES ({draftFiles.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCreatingFile(!creatingFile)}
                  title="Create New File"
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[#4169F5] cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                </button>
                <label
                  title="Upload Static Asset"
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[#4169F5] cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <input type="file" onChange={handleUploadAssetFile} className="hidden" />
                </label>
              </div>
            </div>

            {creatingFile && (
              <form onSubmit={handleCreateNewFile} className="mb-3 space-y-2">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="about.html or utils.js"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-[#4169F5] rounded-lg cursor-pointer"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingFile(false)}
                    className="px-2.5 py-1 text-xs text-[#64748B] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {draftFiles.map((file) => {
                const isSelected = activeFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#4169F5]/12 text-[#4169F5] font-semibold'
                        : 'text-[#172033] dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {renamingFileId === file.id ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="w-full px-2 py-1 text-xs font-mono rounded bg-white dark:bg-slate-900 border border-slate-300"
                        />
                        <button
                          onClick={() => handleRenameSubmit(file)}
                          className="text-[#16A34A] font-semibold px-1 cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            if (isDirty && activeFile) {
                              handleSaveCurrentFile();
                            }
                            setActiveFileId(file.id);
                          }}
                          className="flex items-center gap-2 truncate text-left flex-1 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono truncate">{file.fileName}</span>
                        </button>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setRenamingFileId(file.id);
                              setRenameValue(file.fileName);
                            }}
                            title="Rename file"
                            className="p-1 hover:text-[#4169F5] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {file.fileName !== selectedWebsite.entryFile && (
                            <button
                              onClick={() => handleDeleteFile(file)}
                              title="Delete file"
                              className="p-1 hover:text-[#DC2626] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-[#64748B] space-y-1">
            <div>Entry File: <code className="font-mono text-[#172033] dark:text-slate-200">{selectedWebsite.entryFile}</code></div>
            <div className="tabular-nums">Total Project Size: {(selectedWebsite.storageBytes / 1024).toFixed(1)} KB</div>
          </div>
        </div>

        {/* Code Editor & Sandboxed Preview Panes */}
        <div
          className={`lg:col-span-9 grid gap-4 ${
            viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {(viewMode === 'code' || viewMode === 'split') && (
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-4 py-2.5 bg-slate-900 text-slate-300 text-xs font-mono flex items-center justify-between">
                <span>{activeFile?.fileName || 'editor'}</span>
                <span className="text-slate-400">{lineCount} lines · UTF-8</span>
              </div>
              <div className="flex flex-1 bg-[#0B0F19] text-slate-100 font-mono text-xs overflow-hidden">
                {/* Line Numbers Gutter */}
                <div
                  aria-hidden="true"
                  className="py-4 px-3 text-right select-none bg-slate-950/60 text-slate-500 border-r border-slate-800/80 font-mono leading-6"
                >
                  {Array.from({ length: lineCount }).map((_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>
                {/* Code Textarea */}
                <textarea
                  value={editorText}
                  onChange={(e) => {
                    setEditorText(e.target.value);
                    setIsDirty(true);
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                      e.preventDefault();
                      handleSaveCurrentFile();
                    }
                  }}
                  spellCheck={false}
                  className="w-full flex-1 p-4 bg-transparent text-slate-100 font-mono text-xs leading-6 focus:outline-none resize-none overflow-y-auto"
                />
              </div>
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Eye className="w-3.5 h-3.5 text-[#4169F5]" />
                  <span className="font-mono">{selectedWebsite.primaryHostname} (Live Preview)</span>
                </div>
                <button
                  onClick={() => onRefreshDraftFiles()}
                  title="Refresh Preview"
                  className="p-1 text-[#64748B] hover:text-[#172033] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <iframe
                title="Live Sandboxed Website Preview"
                srcDoc={previewSrcDoc}
                sandbox="allow-scripts"
                className="w-full flex-1 bg-white border-0 min-h-[450px]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
