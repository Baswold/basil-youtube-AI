export interface GuestPersona {
    id: string;
    name: string;
    provider: "groq" | "grok" | "together" | "openai" | "local";
    model?: string;
    systemInstructions: string;
    voice: VoiceConfig;
    colors: [string, string];
    createdAt: number;
    lastUsed?: number;
}
export interface VoiceConfig {
    provider: "google" | "piper";
    googleVoice?: string;
    piperModel?: string;
    speakingRate?: number;
    pitch?: number;
}
export interface ApiKeysPayload {
    anthropicApiKey?: string;
    assemblyaiApiKey?: string;
    groqApiKey?: string;
    grokApiKey?: string;
    togetherApiKey?: string;
    openaiApiKey?: string;
}
export interface RuntimeConfig {
    guestProvider: "groq" | "grok" | "together" | "openai" | "local";
    guestModel?: string;
    guestSystemInstructions?: string;
    ttsProvider: "google" | "piper";
    guestVoice?: VoiceConfig;
}
