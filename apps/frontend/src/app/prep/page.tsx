"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

interface BriefingData {
  title: string;
  topic: string;
  tone: string;
  mustCover: string[];
  avoidTopics: string[];
  content: string;
}

interface AIBriefing {
  name?: string;
  role: string;
  perspective: string;
  expertise: string[];
  content: string;
}

export default function PrepPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"general" | "claude" | "guest">("general");

  const [briefing, setBriefing] = useState<BriefingData>({
    title: "",
    topic: "",
    tone: "Engaging, informative, conversational",
    mustCover: [""],
    avoidTopics: [""],
    content: "",
  });

  const [claudeBriefing, setClaudeBriefing] = useState<AIBriefing>({
    role: "Host and moderator",
    perspective: "Balanced, thoughtful, asks probing questions",
    expertise: [""],
    content: "",
  });

  const [guestBriefing, setGuestBriefing] = useState<AIBriefing>({
    name: "Guest",
    role: "Guest expert",
    perspective: "Knowledgeable, opinionated, engaging",
    expertise: [""],
    content: "",
  });

  const addMustCoverPoint = () => {
    setBriefing({ ...briefing, mustCover: [...briefing.mustCover, ""] });
  };

  const removeMustCoverPoint = (index: number) => {
    setBriefing({
      ...briefing,
      mustCover: briefing.mustCover.filter((_, i) => i !== index),
    });
  };

  const updateMustCoverPoint = (index: number, value: string) => {
    const updated = [...briefing.mustCover];
    updated[index] = value;
    setBriefing({ ...briefing, mustCover: updated });
  };

  const addAvoidTopic = () => {
    setBriefing({ ...briefing, avoidTopics: [...briefing.avoidTopics, ""] });
  };

  const removeAvoidTopic = (index: number) => {
    setBriefing({
      ...briefing,
      avoidTopics: briefing.avoidTopics.filter((_, i) => i !== index),
    });
  };

  const updateAvoidTopic = (index: number, value: string) => {
    const updated = [...briefing.avoidTopics];
    updated[index] = value;
    setBriefing({ ...briefing, avoidTopics: updated });
  };

  const addClaudeExpertise = () => {
    setClaudeBriefing({ ...claudeBriefing, expertise: [...claudeBriefing.expertise, ""] });
  };

  const removeClaudeExpertise = (index: number) => {
    setClaudeBriefing({
      ...claudeBriefing,
      expertise: claudeBriefing.expertise.filter((_, i) => i !== index),
    });
  };

  const updateClaudeExpertise = (index: number, value: string) => {
    const updated = [...claudeBriefing.expertise];
    updated[index] = value;
    setClaudeBriefing({ ...claudeBriefing, expertise: updated });
  };

  const addGuestExpertise = () => {
    setGuestBriefing({ ...guestBriefing, expertise: [...guestBriefing.expertise, ""] });
  };

  const removeGuestExpertise = (index: number) => {
    setGuestBriefing({
      ...guestBriefing,
      expertise: guestBriefing.expertise.filter((_, i) => i !== index),
    });
  };

  const updateGuestExpertise = (index: number, value: string) => {
    const updated = [...guestBriefing.expertise];
    updated[index] = value;
    setGuestBriefing({ ...guestBriefing, expertise: updated });
  };

  const saveBriefing = () => {
    // Save to localStorage
    localStorage.setItem("currentBriefing", JSON.stringify(briefing));
    localStorage.setItem("claudeBriefing", JSON.stringify(claudeBriefing));
    localStorage.setItem("guestBriefing", JSON.stringify(guestBriefing));
    alert("Briefing saved! Both AIs will be prepped with this information.");
  };

  const startConversation = () => {
    saveBriefing();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#050717] text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              Prep Conversation
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Brief both AIs on the episode and configure their individual roles
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition-all border border-white/10"
          >
            Back to Studio
          </a>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab("general")}
            className={clsx(
              "px-6 py-3 text-sm font-semibold transition-all border-b-2",
              activeTab === "general"
                ? "border-blue-500 text-blue-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            General Briefing
          </button>
          <button
            onClick={() => setActiveTab("claude")}
            className={clsx(
              "px-6 py-3 text-sm font-semibold transition-all border-b-2",
              activeTab === "claude"
                ? "border-orange-500 text-orange-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            Claude's Role
          </button>
          <button
            onClick={() => setActiveTab("guest")}
            className={clsx(
              "px-6 py-3 text-sm font-semibold transition-all border-b-2",
              activeTab === "guest"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            Guest's Role
          </button>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {activeTab === "general" && (
            <>
              {/* Title */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Episode Title
                </label>
                <input
                  type="text"
                  value={briefing.title}
                  onChange={(e) => setBriefing({ ...briefing, title: e.target.value })}
                  placeholder="e.g., The Future of AI Coding Assistants"
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
                />
              </div>

              {/* Topic */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Main Topic
                </label>
                <input
                  type="text"
                  value={briefing.topic}
                  onChange={(e) => setBriefing({ ...briefing, topic: e.target.value })}
                  placeholder="e.g., AI pair programming tools and developer workflows"
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
                />
              </div>

              {/* Tone */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Conversation Tone
                </label>
                <input
                  type="text"
                  value={briefing.tone}
                  onChange={(e) => setBriefing({ ...briefing, tone: e.target.value })}
                  placeholder="e.g., Engaging, technical but accessible, slightly provocative"
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
                />
              </div>

              {/* Must Cover Points */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-200">
                    Key Points to Cover
                  </label>
                  <button
                    type="button"
                    onClick={addMustCoverPoint}
                    className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all border border-emerald-500/30"
                  >
                    + Add Point
                  </button>
                </div>
                <div className="space-y-2">
                  {briefing.mustCover.map((point, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => updateMustCoverPoint(idx, e.target.value)}
                        placeholder="e.g., Code completion accuracy, privacy concerns"
                        className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeMustCoverPoint(idx)}
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all border border-red-500/30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avoid Topics */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-200">
                    Topics to Avoid
                  </label>
                  <button
                    type="button"
                    onClick={addAvoidTopic}
                    className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all border border-amber-500/30"
                  >
                    + Add Topic
                  </button>
                </div>
                <div className="space-y-2">
                  {briefing.avoidTopics.map((topic, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => updateAvoidTopic(idx, e.target.value)}
                        placeholder="e.g., Overly promotional content, unsubstantiated claims"
                        className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeAvoidTopic(idx)}
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all border border-red-500/30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Context */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Additional Context & Notes
                </label>
                <textarea
                  value={briefing.content}
                  onChange={(e) => setBriefing({ ...briefing, content: e.target.value })}
                  placeholder="Add any additional context, background information, or specific angles you want the AIs to explore..."
                  rows={8}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-white/40 focus:outline-none resize-none"
                />
              </div>
            </>
          )}

          {activeTab === "claude" && (
            <>
              {/* Claude's Role */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-orange-200 mb-2">
                  Claude's Role in the Conversation
                </label>
                <input
                  type="text"
                  value={claudeBriefing.role}
                  onChange={(e) => setClaudeBriefing({ ...claudeBriefing, role: e.target.value })}
                  placeholder="e.g., Host and moderator, Interviewer, Co-host"
                  className="w-full rounded-lg border border-orange-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              {/* Claude's Perspective */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-orange-200 mb-2">
                  Claude's Perspective & Approach
                </label>
                <input
                  type="text"
                  value={claudeBriefing.perspective}
                  onChange={(e) => setClaudeBriefing({ ...claudeBriefing, perspective: e.target.value })}
                  placeholder="e.g., Balanced, thoughtful, asks probing questions"
                  className="w-full rounded-lg border border-orange-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              {/* Claude's Areas of Expertise */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-orange-200">
                    Claude's Areas of Expertise
                  </label>
                  <button
                    type="button"
                    onClick={addClaudeExpertise}
                    className="rounded-lg bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition-all border border-orange-500/30"
                  >
                    + Add Area
                  </button>
                </div>
                <div className="space-y-2">
                  {claudeBriefing.expertise.map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={exp}
                        onChange={(e) => updateClaudeExpertise(idx, e.target.value)}
                        placeholder="e.g., Machine learning, software engineering"
                        className="flex-1 rounded-lg border border-orange-500/30 bg-white/5 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeClaudeExpertise(idx)}
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all border border-red-500/30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Claude's Additional Context */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-orange-200 mb-2">
                  Additional Instructions for Claude
                </label>
                <textarea
                  value={claudeBriefing.content}
                  onChange={(e) => setClaudeBriefing({ ...claudeBriefing, content: e.target.value })}
                  placeholder="Any specific behaviors, topics to emphasize, questions to ask, or conversation flow guidance..."
                  rows={8}
                  className="w-full rounded-lg border border-orange-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none resize-none"
                />
              </div>
            </>
          )}

          {activeTab === "guest" && (
            <>
              {/* Guest Name */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-purple-200 mb-2">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={guestBriefing.name || ""}
                  onChange={(e) => setGuestBriefing({ ...guestBriefing, name: e.target.value })}
                  placeholder="e.g., Dr. Sarah Chen, Alex Thompson"
                  className="w-full rounded-lg border border-purple-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              {/* Guest's Role */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-purple-200 mb-2">
                  Guest's Role in the Conversation
                </label>
                <input
                  type="text"
                  value={guestBriefing.role}
                  onChange={(e) => setGuestBriefing({ ...guestBriefing, role: e.target.value })}
                  placeholder="e.g., Guest expert, Industry insider, Researcher"
                  className="w-full rounded-lg border border-purple-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              {/* Guest's Perspective */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-purple-200 mb-2">
                  Guest's Perspective & Approach
                </label>
                <input
                  type="text"
                  value={guestBriefing.perspective}
                  onChange={(e) => setGuestBriefing({ ...guestBriefing, perspective: e.target.value })}
                  placeholder="e.g., Knowledgeable, opinionated, engaging"
                  className="w-full rounded-lg border border-purple-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              {/* Guest's Areas of Expertise */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-purple-200">
                    Guest's Areas of Expertise
                  </label>
                  <button
                    type="button"
                    onClick={addGuestExpertise}
                    className="rounded-lg bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-all border border-purple-500/30"
                  >
                    + Add Area
                  </button>
                </div>
                <div className="space-y-2">
                  {guestBriefing.expertise.map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={exp}
                        onChange={(e) => updateGuestExpertise(idx, e.target.value)}
                        placeholder="e.g., DevOps, Cloud architecture"
                        className="flex-1 rounded-lg border border-purple-500/30 bg-white/5 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeGuestExpertise(idx)}
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all border border-red-500/30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest's Additional Context */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
                <label className="block text-sm font-semibold text-purple-200 mb-2">
                  Additional Instructions for Guest
                </label>
                <textarea
                  value={guestBriefing.content}
                  onChange={(e) => setGuestBriefing({ ...guestBriefing, content: e.target.value })}
                  placeholder="Any specific behaviors, viewpoints to express, anecdotes to share, or conversation style guidance..."
                  rows={8}
                  className="w-full rounded-lg border border-purple-500/30 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none resize-none"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={saveBriefing}
              className="flex-1 rounded-lg bg-blue-500/10 px-6 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 transition-all border border-blue-500/30"
            >
              Save Briefing
            </button>
            <button
              type="button"
              onClick={startConversation}
              className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/50"
            >
              Start Conversation →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
