"use client";

import { useState, useEffect } from "react";
import type { GuestPersona, VoiceConfig } from "@basil/shared";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GOOGLE_VOICES = [
  { value: "en-US-Neural2-A", label: "Male - Clear & Engaging (A)" },
  { value: "en-US-Neural2-D", label: "Male - Warm & Professional (D)" },
  { value: "en-US-Neural2-F", label: "Female - Warm & Confident (F)" },
  { value: "en-US-Neural2-G", label: "Female - Clear & Natural (G)" },
  { value: "en-US-Neural2-H", label: "Female - Energetic (H)" },
  { value: "en-US-Neural2-I", label: "Male - Deep & Authoritative (I)" },
  { value: "en-US-Neural2-J", label: "Male - Friendly (J)" },
];

const PIPER_MODELS = [
  { value: "./models/en_US-lessac-medium.onnx", label: "Lessac - Medium Quality" },
  { value: "./models/en_US-libritts-high.onnx", label: "LibriTTS - High Quality" },
  { value: "./models/en_US-amy-medium.onnx", label: "Amy - Medium Quality" },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"api-keys" | "personas">("api-keys");

  // API Keys
  const [claudeKey, setClaudeKey] = useState("");
  const [assemblyKey, setAssemblyKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [togetherKey, setTogetherKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  // Persona Management
  const [personas, setPersonas] = useState<GuestPersona[]>([]);
  const [editingPersona, setEditingPersona] = useState<Partial<GuestPersona> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Load saved data from localStorage
  useEffect(() => {
    const savedKeys = localStorage.getItem("apiKeys");
    if (savedKeys) {
      try {
        const keys = JSON.parse(savedKeys);
        setClaudeKey(keys.anthropicApiKey || "");
        setAssemblyKey(keys.assemblyaiApiKey || "");
        setGroqKey(keys.groqApiKey || "");
        setGrokKey(keys.grokApiKey || "");
        setTogetherKey(keys.togetherApiKey || "");
        setOpenaiKey(keys.openaiApiKey || "");
      } catch (e) {
        console.error("Failed to load API keys:", e);
      }
    }

    const savedPersonas = localStorage.getItem("guestPersonas");
    if (savedPersonas) {
      try {
        setPersonas(JSON.parse(savedPersonas));
      } catch (e) {
        console.error("Failed to load personas:", e);
      }
    }
  }, []);

  const saveApiKeys = () => {
    const keys = {
      anthropicApiKey: claudeKey,
      assemblyaiApiKey: assemblyKey,
      groqApiKey: groqKey,
      grokApiKey: grokKey,
      togetherApiKey: togetherKey,
      openaiApiKey: openaiKey,
    };
    localStorage.setItem("apiKeys", JSON.stringify(keys));
    
    // Send to backend
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/config/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keys),
    }).catch(err => console.error("Failed to update backend keys:", err));

    alert("API keys saved!");
  };

  const savePersona = () => {
    if (!editingPersona?.name || !editingPersona?.systemInstructions) {
      alert("Please fill in name and system instructions");
      return;
    }

    const persona: GuestPersona = {
      id: editingPersona.id || Date.now().toString(),
      name: editingPersona.name,
      provider: editingPersona.provider || "groq",
      model: editingPersona.model,
      systemInstructions: editingPersona.systemInstructions,
      voice: editingPersona.voice || {
        provider: "google",
        googleVoice: "en-US-Neural2-A",
        speakingRate: 1.0,
        pitch: 0,
      },
      colors: editingPersona.colors || ["#F59E0B", "#F97316"],
      createdAt: editingPersona.createdAt || Date.now(),
    };

    const updated = isCreatingNew
      ? [...personas, persona]
      : personas.map((p) => (p.id === persona.id ? persona : p));

    setPersonas(updated);
    localStorage.setItem("guestPersonas", JSON.stringify(updated));
    setEditingPersona(null);
    setIsCreatingNew(false);
  };

  const deletePersona = (id: string) => {
    if (!confirm("Delete this persona?")) return;
    const updated = personas.filter((p) => p.id !== id);
    setPersonas(updated);
    localStorage.setItem("guestPersonas", JSON.stringify(updated));
  };

  const inviteGuest = (persona: GuestPersona) => {
    // Send to backend to update runtime config
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/config/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestProvider: persona.provider,
        guestModel: persona.model,
        guestSystemInstructions: persona.systemInstructions,
        guestVoice: persona.voice,
      }),
    })
      .then(() => {
        // Update last used
        const updated = personas.map((p) =>
          p.id === persona.id ? { ...p, lastUsed: Date.now() } : p
        );
        setPersonas(updated);
        localStorage.setItem("guestPersonas", JSON.stringify(updated));
        alert(`${persona.name} has been invited to the show!`);
      })
      .catch((err) => {
        console.error("Failed to invite guest:", err);
        alert("Failed to update backend configuration");
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-2xl font-bold text-white">Studio Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50">
          <button
            onClick={() => setActiveTab("api-keys")}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === "api-keys"
                ? "text-white bg-slate-800/50 border-b-2 border-cyan-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔑 API Keys
          </button>
          <button
            onClick={() => setActiveTab("personas")}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === "personas"
                ? "text-white bg-slate-800/50 border-b-2 border-cyan-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            👥 Guest Personas
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === "api-keys" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Claude API Key <span className="text-red-400">(Required)</span>
                </label>
                <input
                  type="password"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Used for Claude Haiku 4.5 (always enabled)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  AssemblyAI API Key
                </label>
                <input
                  type="password"
                  value={assemblyKey}
                  onChange={(e) => setAssemblyKey(e.target.value)}
                  placeholder="..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  For real-time speech-to-text transcription
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Groq API Key
                </label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  For fast guest AI inference (Llama 3.3 70B)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Grok API Key (xAI)
                </label>
                <input
                  type="password"
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="xai-..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  For xAI's Grok model guest AI
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Together.ai API Key
                </label>
                <input
                  type="password"
                  value={togetherKey}
                  onChange={(e) => setTogetherKey(e.target.value)}
                  placeholder="..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Alternative guest AI provider
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Alternative guest AI provider (GPT-4, etc.)
                </p>
              </div>

              <button
                onClick={saveApiKeys}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50"
              >
                💾 Save API Keys
              </button>
            </div>
          )}

          {activeTab === "personas" && (
            <div className="space-y-6">
              {!editingPersona && !isCreatingNew && (
                <>
                  <button
                    onClick={() => {
                      setIsCreatingNew(true);
                      setEditingPersona({
                        name: "",
                        provider: "groq",
                        systemInstructions: "",
                        voice: {
                          provider: "google",
                          googleVoice: "en-US-Neural2-A",
                          speakingRate: 1.0,
                          pitch: 0,
                        },
                        colors: ["#F59E0B", "#F97316"],
                      });
                    }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium rounded-lg transition-all shadow-lg"
                  >
                    ✨ Create New Persona
                  </button>

                  <div className="space-y-4">
                    {personas.length === 0 && (
                      <p className="text-center text-slate-400 py-8">
                        No personas yet. Create one to get started!
                      </p>
                    )}
                    {personas.map((persona) => (
                      <div
                        key={persona.id}
                        className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white">{persona.name}</h3>
                            <p className="text-sm text-slate-400 mt-1">
                              {persona.provider} {persona.model && `· ${persona.model}`}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              Voice: {persona.voice.provider === "google"
                                ? GOOGLE_VOICES.find((v) => v.value === persona.voice.googleVoice)?.label
                                : "Piper TTS"}
                            </p>
                            {persona.lastUsed && (
                              <p className="text-xs text-slate-500 mt-2">
                                Last used: {new Date(persona.lastUsed).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => inviteGuest(persona)}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              📺 Invite
                            </button>
                            <button
                              onClick={() => setEditingPersona(persona)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => deletePersona(persona.id)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(editingPersona || isCreatingNew) && editingPersona && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">
                    {isCreatingNew ? "Create New Persona" : "Edit Persona"}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Persona Name
                    </label>
                    <input
                      type="text"
                      value={editingPersona.name || ""}
                      onChange={(e) =>
                        setEditingPersona({ ...editingPersona, name: e.target.value })
                      }
                      placeholder="e.g., Technical Expert, Devil's Advocate"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      AI Provider
                    </label>
                    <select
                      value={editingPersona.provider || "groq"}
                      onChange={(e) =>
                        setEditingPersona({
                          ...editingPersona,
                          provider: e.target.value as any,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="groq">Groq (Fast)</option>
                      <option value="grok">Grok (xAI)</option>
                      <option value="together">Together.ai</option>
                      <option value="openai">OpenAI</option>
                      <option value="local">Local LLM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Model (Optional)
                    </label>
                    <input
                      type="text"
                      value={editingPersona.model || ""}
                      onChange={(e) =>
                        setEditingPersona({ ...editingPersona, model: e.target.value })
                      }
                      placeholder="e.g., llama-3.3-70b-versatile, gpt-4"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      System Instructions
                    </label>
                    <textarea
                      value={editingPersona.systemInstructions || ""}
                      onChange={(e) =>
                        setEditingPersona({
                          ...editingPersona,
                          systemInstructions: e.target.value,
                        })
                      }
                      placeholder="Define the persona's role, tone, and behavior..."
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Voice Provider
                    </label>
                    <select
                      value={editingPersona.voice?.provider || "google"}
                      onChange={(e) =>
                        setEditingPersona({
                          ...editingPersona,
                          voice: {
                            ...editingPersona.voice!,
                            provider: e.target.value as "google" | "piper",
                          },
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="google">Google TTS (Cloud)</option>
                      <option value="piper">Piper TTS (Local)</option>
                    </select>
                  </div>

                  {editingPersona.voice?.provider === "google" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Google Voice
                      </label>
                      <select
                        value={editingPersona.voice?.googleVoice || "en-US-Neural2-A"}
                        onChange={(e) =>
                          setEditingPersona({
                            ...editingPersona,
                            voice: {
                              ...editingPersona.voice!,
                              googleVoice: e.target.value,
                            },
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {GOOGLE_VOICES.map((voice) => (
                          <option key={voice.value} value={voice.value}>
                            {voice.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingPersona.voice?.provider === "piper" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Piper Model
                      </label>
                      <select
                        value={editingPersona.voice?.piperModel || PIPER_MODELS[0].value}
                        onChange={(e) =>
                          setEditingPersona({
                            ...editingPersona,
                            voice: {
                              ...editingPersona.voice!,
                              piperModel: e.target.value,
                            },
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {PIPER_MODELS.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={savePersona}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all shadow-lg"
                    >
                      💾 Save Persona
                    </button>
                    <button
                      onClick={() => {
                        setEditingPersona(null);
                        setIsCreatingNew(false);
                      }}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
