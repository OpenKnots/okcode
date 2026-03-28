# Voice Mode — Live Conversation Plan

> Status: **Draft**
> Last updated: 2026-03-27

## 1. Vision

OK Code gains a **Voice mode** — a distinct interaction mode alongside Chat, Code, and Plan — that provides a real-time, interruptible voice conversation with the coding agent. The experience should feel like a professional-grade voice assistant: low-latency, naturally interruptible, with smooth visual feedback and seamless transitions to and from text-based modes.

### Design Pillars

| Pillar | Description |
|---|---|
| **Interrupt-first** | The user can speak at any time to interrupt the assistant, just like a real conversation. Barge-in cancels in-flight TTS and restarts the turn. |
| **Distinct mode** | Voice mode is not a microphone bolted onto the chat composer. It has its own full-screen (or near-full-screen) UI with ambient visuals, minimal chrome, and a focus on the audio loop. |
| **Professional-grade audio** | Echo cancellation, noise suppression, automatic gain control, and VAD-based endpointing so the user never has to press a button to speak. |
| **Graceful degradation** | If the browser denies mic access, or the network drops, the UI falls back to text with clear messaging. Voice transcripts always appear in the thread so context is never lost. |
| **Latency budget** | Target < 500 ms mouth-to-ear for the first audio chunk of the assistant response. |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Browser — Voice Mode UI                     │
│                                              │
│  ┌──────────┐   ┌───────────┐   ┌────────┐  │
│  │ Mic      │──▶│ VAD /     │──▶│ STT    │  │
│  │ Capture  │   │ Endpointer│   │ Client │  │
│  └──────────┘   └───────────┘   └───┬────┘  │
│                                     │        │
│                              transcript      │
│                                     │        │
│  ┌──────────┐   ┌───────────┐   ┌──▼─────┐  │
│  │ Speaker  │◀──│ TTS       │◀──│ Voice  │  │
│  │ Playback │   │ Streaming │   │ Orch.  │  │
│  └──────────┘   └───────────┘   └───┬────┘  │
│                                     │        │
└─────────────────────────────────────┼────────┘
                                      │ WS (existing)
┌─────────────────────────────────────▼────────┐
│  apps/server                                  │
│                                               │
│  ┌────────────┐  ┌──────────────────────────┐ │
│  │ VoiceRelay │  │ OrchestrationEngine      │ │
│  │ (new)      │  │ (existing — receives     │ │
│  │            │──│  voice turns as text)     │ │
│  └────────────┘  └──────────────────────────┘ │
│        │                                      │
│        │ API calls                            │
│  ┌─────▼──────────────────┐                   │
│  │ External Voice Services│                   │
│  │ (STT / TTS providers)  │                   │
│  └────────────────────────┘                   │
└───────────────────────────────────────────────┘
```

### Two viable audio pipeline strategies

| Strategy | Description | Pros | Cons |
|---|---|---|---|
| **A — Client-side STT/TTS** | Browser runs STT (Web Speech API or a streaming STT WebSocket) and TTS (Web Speech Synthesis or streaming TTS). Server only sees text. | Simpler server; existing orchestration unchanged; lower server cost. | Browser API quality varies; harder to get < 500 ms latency; less control over voice quality. |
| **B — Server-relayed streaming** | Server opens persistent connections to STT & TTS services. Browser streams raw PCM up, server streams audio chunks down. | Best latency; consistent quality; server controls voice/model; enables future Realtime API integration. | More server complexity; bandwidth for raw audio; requires audio codec negotiation. |

**Recommendation**: Start with **Strategy B (server-relayed)** for the core path, with a **Strategy A fallback** for environments where the server cannot reach external voice services. This mirrors how ChatGPT's voice mode works — the server mediates the audio pipeline.

---

## 3. Component Breakdown

### 3.1 Browser — Audio Capture & Playback

**New files:**

| File | Purpose |
|---|---|
| `apps/web/src/audio/MicCapture.ts` | `getUserMedia` wrapper — requests mic with `echoCancellation`, `noiseSuppression`, `autoGainControl`. Produces PCM frames via `AudioWorklet`. |
| `apps/web/src/audio/VAD.ts` | Voice Activity Detection — runs a lightweight model (e.g., Silero VAD via ONNX) in an AudioWorklet to detect speech start/end. Emits `speechStart`, `speechEnd`, `interim` events. |
| `apps/web/src/audio/Speaker.ts` | Manages an `AudioContext` output pipeline. Accepts streaming PCM/opus chunks and queues them for gapless playback. Exposes `interrupt()` to flush the queue instantly. |
| `apps/web/src/audio/AudioPipeline.ts` | Orchestrates MicCapture → VAD → upstream send, and downstream receive → Speaker. Owns the barge-in logic: when VAD fires `speechStart` during playback, calls `Speaker.interrupt()` and signals the server to cancel TTS. |

**Key decisions:**

- **AudioWorklet over ScriptProcessorNode**: ScriptProcessorNode is deprecated and runs on the main thread. AudioWorklet runs on a dedicated audio thread with consistent buffer sizes.
- **Opus encoding in the browser**: Use `opus-recorder` or a WASM Opus encoder to compress PCM before sending over WebSocket, reducing bandwidth ~10x.
- **Silero VAD**: ~1 MB ONNX model, runs in-browser, well-tested. Gives us precise speech boundaries without relying on server round-trips.

### 3.2 Browser — Voice Mode UI

**New files:**

| File | Purpose |
|---|---|
| `apps/web/src/components/voice/VoiceModeView.tsx` | Top-level voice mode container. Replaces the standard chat view when voice mode is active. Full-viewport ambient UI. |
| `apps/web/src/components/voice/VoiceOrb.tsx` | Central animated orb/waveform visualization. States: `idle`, `listening`, `thinking`, `speaking`. Responds to audio levels and VAD state. |
| `apps/web/src/components/voice/VoiceTranscript.tsx` | Live transcript overlay — shows the current user utterance (interim STT) and the assistant's response text. Fades after a delay. |
| `apps/web/src/components/voice/VoiceControls.tsx` | Minimal control bar: Mute, End Voice Mode, Settings. Always accessible. |
| `apps/web/src/stores/voiceModeStore.ts` | Zustand store for voice-specific state: `phase` (idle/listening/processing/speaking), `micPermission`, `isMuted`, `currentTranscript`, `audioLevels`, `error`. |

**UI states and transitions:**

```
               ┌──────────┐
               │          │
      ┌────────│   IDLE   │◀──────────────┐
      │        │          │               │
      │        └──────────┘               │
      │ VAD: speechStart                  │ TTS complete
      ▼                                   │ or silence timeout
┌──────────┐                         ┌────┴─────┐
│          │  VAD: speechEnd         │          │
│ LISTENING│────────────────────────▶│ SPEAKING │
│          │         ┌──────────┐   │          │
└──────────┘         │          │   └──────────┘
      ▲              │PROCESSING│        │
      │              │(thinking)│        │
      │              │          │        │
      │              └────┬─────┘        │
      │                   │              │
      │     first audio   │              │
      │     chunk arrives │              │
      │                   ▼              │
      │              ┌──────────┐        │
      └──────────────│ BARGE-IN │────────┘
                     │(interrupt)│
                     └──────────┘
```

**Visual design direction:**

- **Dark ambient background** with a subtle radial gradient that pulses with audio energy.
- **Central orb** — a morphing sphere (CSS/Canvas/WebGL) that breathes when idle, ripples when listening, swirls when thinking, and pulses outward when speaking.
- **Minimal text** — only the live transcript, softly rendered in the lower third.
- **No message list** — this is not a chat view. The transcript is ephemeral. When voice mode exits, the full conversation is visible in the thread's message timeline.
- **Glassmorphic control bar** at the bottom with icon-only buttons.

### 3.3 Server — Voice Relay

**New files:**

| File | Purpose |
|---|---|
| `apps/server/src/voice/VoiceRelay.ts` | Manages per-session voice pipelines. Opens upstream connections to STT/TTS providers. Routes audio frames from the client WebSocket to STT, and TTS audio back to the client. Handles cancellation on barge-in. |
| `apps/server/src/voice/STTBridge.ts` | Abstraction over STT providers (OpenAI Whisper streaming, Deepgram, AssemblyAI). Consumes audio chunks, emits interim/final transcripts. |
| `apps/server/src/voice/TTSBridge.ts` | Abstraction over TTS providers (OpenAI TTS, ElevenLabs, Cartesia). Accepts text (streaming or complete), emits audio chunks. Supports cancellation mid-stream. |
| `apps/server/src/voice/VoiceSessionState.ts` | State machine for a single voice session: `idle` → `capturing` → `transcribing` → `llm-generating` → `synthesizing` → `idle`. Manages timeouts, cleanup. |

**Integration with existing orchestration:**

The voice pipeline does **not** bypass the orchestration engine. Once STT produces a final transcript:

1. `VoiceRelay` creates a standard `thread.turn.start` command with `interactionMode: "voice"`.
2. The existing `OrchestrationEngine` processes it identically to a text turn.
3. As the LLM streams response text, `VoiceRelay` concurrently pipes that text to the TTS bridge.
4. TTS audio chunks are forwarded to the client over a new WebSocket push channel.

This means voice turns are **first-class thread messages** — they appear in the timeline, support diffs, checkpoints, and all existing orchestration features.

### 3.4 WebSocket Protocol Extensions

**New push channels:**

```typescript
// packages/contracts/src/ws.ts — additions

// Server → Client: streamed audio chunks during TTS
"voice.audioChunk": {
  sessionId: string;
  data: Uint8Array;      // Opus-encoded audio frame
  sequence: number;       // Monotonic sequence for ordering
  isFinal: boolean;       // True on the last chunk
}

// Server → Client: interim STT transcript
"voice.transcript": {
  sessionId: string;
  text: string;
  isFinal: boolean;
  confidence: number;
}

// Server → Client: voice session state change
"voice.stateChange": {
  sessionId: string;
  phase: "idle" | "listening" | "processing" | "speaking";
}
```

**New RPC methods:**

```typescript
// Client → Server: start a voice session
"voice.startSession": {
  threadId: string;
  config: {
    sttProvider?: string;
    ttsProvider?: string;
    ttsVoice?: string;
    language?: string;
  }
} → { sessionId: string }

// Client → Server: end a voice session
"voice.endSession": {
  sessionId: string;
} → {}

// Client → Server: audio data from mic
"voice.audioData": {
  sessionId: string;
  data: Uint8Array;       // Opus-encoded audio from browser
  sequence: number;
}

// Client → Server: barge-in / interrupt signal
"voice.interrupt": {
  sessionId: string;
} → {}
```

**Binary WebSocket frames:** For audio data, we use a binary frame protocol alongside the existing JSON text frames. A 1-byte type header distinguishes audio upstream (0x01) and audio downstream (0x02), followed by a 4-byte session ID hash and the audio payload. This avoids base64 overhead.

### 3.5 Contracts — Mode Addition

```typescript
// packages/contracts/src/orchestration.ts — modification

// Before:
ProviderInteractionMode: ["chat", "code", "plan"]

// After:
ProviderInteractionMode: ["chat", "code", "plan", "voice"]
```

The `"voice"` interaction mode tells the provider to optimize for conversational, concise responses rather than long-form code or plans. The system prompt for voice mode should instruct the LLM to:

- Keep responses concise and conversational (spoken, not written).
- Avoid code blocks unless explicitly asked — prefer describing what it will do.
- Use natural sentence structure, not bullet points.
- Confirm actions before executing them (since the user can't easily review diffs by ear).

---

## 4. Barge-In / Interruption Protocol

This is the critical differentiator for a professional-grade experience. The sequence:

```
Timeline ──────────────────────────────────────────────▶

User speaks:    |███████████|
                             STT final
                                  │
LLM generates:                    |████████████████████|
                                  │
TTS plays:                        |██████▒▒▒▒▒▒▒▒▒▒▒▒| ← interrupted
                                         │
User speaks again:                       |███████████|
                                         │
                                    VAD speechStart
                                    fires barge-in
```

**Step-by-step barge-in flow:**

1. `VAD.speechStart` fires while `Speaker` is actively playing.
2. `AudioPipeline` immediately calls `Speaker.interrupt()` — playback stops within one audio frame (~20 ms).
3. `AudioPipeline` sends `voice.interrupt` to the server via WebSocket.
4. Server's `VoiceRelay` receives the interrupt:
   a. Cancels the in-flight TTS stream (closes the provider connection).
   b. Signals the `OrchestrationEngine` that the current assistant turn was interrupted (records partial response).
   c. Prepares for the next STT stream.
5. The new user utterance is captured, transcribed, and dispatched as a new turn — the LLM sees the partial assistant response in context, ensuring conversational continuity.

**Edge cases:**

| Case | Handling |
|---|---|
| User coughs during TTS | VAD has a configurable `speechMinDuration` (default 300 ms). Short noise bursts are ignored. |
| Network drop during voice session | Client detects WebSocket close, pauses mic, shows reconnection UI. On reconnect, voice session resumes or the user must re-enter voice mode. |
| LLM response is very short (< 1 s) | No special handling needed — TTS finishes before barge-in is likely. |
| Simultaneous speech and TTS echo | Echo cancellation in `getUserMedia` handles this. Additionally, the `AudioPipeline` feeds the TTS output signal as a reference to an optional software AEC if the browser's built-in AEC is insufficient. |
| User mutes mic | `VoiceControls` sets `isMuted` in store. `MicCapture` stops sending frames. UI shows muted state on the orb. The user can still hear TTS. |

---

## 5. STT / TTS Provider Strategy

### STT Options

| Provider | Latency | Quality | Streaming | Cost |
|---|---|---|---|---|
| **Deepgram Nova-2** | ~300 ms | Excellent | Yes (WebSocket) | $0.0043/min |
| **OpenAI Whisper** (realtime API) | ~500 ms | Excellent | Yes | Per token |
| **AssemblyAI** | ~400 ms | Excellent | Yes (WebSocket) | $0.0065/min |
| **Browser Web Speech API** | ~200 ms | Good (Chrome) | Yes | Free |

**Recommendation**: Deepgram Nova-2 as primary, Web Speech API as zero-cost fallback.

### TTS Options

| Provider | Latency to first byte | Quality | Streaming | Cost |
|---|---|---|---|---|
| **Cartesia Sonic** | ~130 ms | Excellent | Yes (WebSocket) | $0.040/1K chars |
| **ElevenLabs** | ~300 ms | Excellent | Yes (WebSocket) | $0.18/1K chars |
| **OpenAI TTS** | ~400 ms | Very good | Yes (chunked) | $0.015/1K chars |
| **Browser Speech Synthesis** | ~50 ms | Mediocre | Yes | Free |

**Recommendation**: OpenAI TTS as default (good balance), Cartesia Sonic as premium option, Browser Speech Synthesis as fallback.

### Future: OpenAI Realtime API

OpenAI's Realtime API provides a single WebSocket that handles STT + LLM + TTS in one pipeline, with native barge-in support. This would replace the three-stage pipeline with a single connection:

```
Browser → Audio frames → Realtime API → Audio frames → Browser
```

This should be a **Phase 3** goal. The modular STT/TTS bridge design allows us to swap in the Realtime API as a single provider without changing the client or UI.

---

## 6. Implementation Phases

### Phase 1 — Foundation (2-3 weeks)

**Goal:** End-to-end voice loop working with basic UI.

- [ ] Add `"voice"` to `ProviderInteractionMode` in contracts
- [ ] Build `MicCapture` with AudioWorklet + Opus encoding
- [ ] Build `Speaker` with streaming playback + `interrupt()`
- [ ] Build `VAD` with Silero ONNX model
- [ ] Build `AudioPipeline` orchestrator with barge-in logic
- [ ] Build `VoiceModeView` with basic orb (CSS animation), transcript, and controls
- [ ] Build `voiceModeStore` (Zustand)
- [ ] Server: `VoiceRelay`, `STTBridge` (Deepgram), `TTSBridge` (OpenAI TTS)
- [ ] WebSocket binary frame protocol for audio
- [ ] New WS push channels and RPC methods
- [ ] Voice turns flow through existing `OrchestrationEngine` as text
- [ ] Voice transcripts appear in thread message timeline

### Phase 2 — Polish & Production (2 weeks)

**Goal:** Professional-grade feel, reliability, settings.

- [ ] Advanced orb visualization (WebGL or Canvas 2D with audio-reactive animation)
- [ ] Voice settings panel: provider selection, voice selection, language, VAD sensitivity
- [ ] Keyboard shortcut to toggle voice mode (e.g., `Ctrl+Shift+V`)
- [ ] Smooth transitions between voice mode and chat/code/plan modes
- [ ] Error recovery: mic permission denied, provider failure, network drop
- [ ] Audio level metering in UI (input + output)
- [ ] "Thinking" indicator with elapsed time
- [ ] Conversation memory — voice mode system prompt that maintains concise, conversational style
- [ ] Electron: native mic permission handling in desktop app
- [ ] Latency telemetry: measure and log mouth-to-ear latency per turn
- [ ] Rate limiting and cost guardrails for STT/TTS API usage

### Phase 3 — Advanced (2-3 weeks)

**Goal:** Best-in-class, feature parity with ChatGPT voice.

- [ ] OpenAI Realtime API integration as a unified provider option
- [ ] Multi-language support with automatic language detection
- [ ] Voice cloning / custom voice support (ElevenLabs)
- [ ] Proactive agent speech — the agent can initiate voice when a long task completes
- [ ] Ambient mode — voice session stays open while the user works in other modes; agent speaks notifications
- [ ] Local Whisper model option for privacy-sensitive users (WASM or server-side)
- [ ] Spatial audio effects for multi-agent scenarios
- [ ] Wake word detection ("Hey OK" or configurable) for hands-free activation

---

## 7. File Manifest

### New files

```
packages/contracts/src/voice.ts              # Voice-specific schemas & types
apps/web/src/audio/MicCapture.ts             # Mic capture with AudioWorklet
apps/web/src/audio/MicWorklet.ts             # AudioWorkletProcessor for mic
apps/web/src/audio/VAD.ts                    # Voice Activity Detection
apps/web/src/audio/Speaker.ts                # Streaming audio playback
apps/web/src/audio/AudioPipeline.ts          # Orchestrates capture→VAD→send, recv→play
apps/web/src/audio/OpusEncoder.ts            # WASM Opus encoding
apps/web/src/audio/OpusDecoder.ts            # WASM Opus decoding
apps/web/src/components/voice/VoiceModeView.tsx
apps/web/src/components/voice/VoiceOrb.tsx
apps/web/src/components/voice/VoiceTranscript.tsx
apps/web/src/components/voice/VoiceControls.tsx
apps/web/src/stores/voiceModeStore.ts
apps/server/src/voice/VoiceRelay.ts
apps/server/src/voice/STTBridge.ts
apps/server/src/voice/TTSBridge.ts
apps/server/src/voice/VoiceSessionState.ts
apps/server/src/voice/providers/deepgram.ts
apps/server/src/voice/providers/openaiTTS.ts
apps/server/src/voice/providers/webSpeech.ts  # Fallback
```

### Modified files

```
packages/contracts/src/orchestration.ts      # Add "voice" to ProviderInteractionMode
packages/contracts/src/ws.ts                 # Add voice.* push channels and RPC methods
apps/server/src/wsServer.ts                  # Handle binary frames, route voice RPCs
apps/server/src/serverLayers.ts              # Add VoiceRelay to service graph
apps/web/src/components/chat/ChatView.tsx     # Add voice mode entry point
apps/web/src/components/chat/CompactComposerControlsMenu.tsx  # Add voice option to mode selector
apps/web/src/composerDraftStore.ts           # Support "voice" interaction mode
apps/web/src/wsTransport.ts                  # Handle binary frames for audio
apps/web/src/wsNativeApi.ts                  # Register voice push listeners
```

---

## 8. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Browser echo cancellation is poor on some devices | Users hear feedback loops | Medium | Implement software AEC using the TTS output as a reference signal; document supported browsers. |
| STT latency > 500 ms degrades experience | Conversation feels laggy | Medium | Use Deepgram (fastest); implement speculative LLM prefill while STT is still finalizing. |
| TTS cost spirals for verbose LLM responses | Unexpected API bills | High | Enforce max response length for voice mode; add per-session cost tracking; warn at thresholds. |
| AudioWorklet not supported in older browsers | Feature unavailable | Low | Fallback to ScriptProcessorNode with a console warning about degraded performance. |
| Opus WASM module is large (~300 KB) | Slower initial load | Low | Lazy-load the module only when voice mode is activated; cache in service worker. |
| VAD triggers on background noise | Phantom speech detection | Medium | Tunable sensitivity; add a manual push-to-talk fallback mode. |
| Electron mic permissions differ per OS | Desktop users can't use voice | Medium | Handle permission flow in Electron main process; show OS-specific guidance. |

---

## 9. Latency Budget Breakdown

Target: **< 500 ms** from user stops speaking to first audio chunk playing.

| Stage | Budget | Notes |
|---|---|---|
| VAD endpointing | ~100 ms | Silero VAD with 100 ms look-ahead |
| STT finalization | ~150 ms | Deepgram streaming final transcript |
| LLM first token | ~150 ms | Provider-dependent; speculative prefill helps |
| TTS first audio byte | ~80 ms | Cartesia Sonic; OpenAI TTS ~200 ms |
| Network round-trips | ~20 ms | Local server, so minimal |
| **Total** | **~500 ms** | Tight but achievable with Deepgram + Cartesia |

For OpenAI TTS (cheaper), expect ~650 ms. For the Realtime API (Phase 3), expect ~300 ms.

---

## 10. Open Questions

1. **Should voice mode support tool use / code execution?** If the LLM invokes tools during a voice turn, should it narrate what it's doing, or pause and switch to a visual mode?
2. **Multi-turn context window:** How many voice turns should we keep in context? Voice turns are typically shorter than text, so the context window may fill slower.
3. **Cost model:** Should voice mode be gated behind a setting or flag, since STT/TTS have per-minute costs? Or should it be freely available with usage warnings?
4. **Recording consent:** Some jurisdictions require consent for audio processing. Should we show a consent dialog on first voice mode activation?
5. **Thread continuity:** If a user starts a thread in chat mode and switches to voice, should voice mode continue the same thread (recommended) or start a new one?
