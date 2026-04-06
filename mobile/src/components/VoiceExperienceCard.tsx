import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useConversation } from "@elevenlabs/react-native";

import { fetchWithAuth } from "../lib/api";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Props = {
  title: string;
  subtitle: string;
  contextSummary: string;
  problemId?: string | null;
  demoMode?: boolean;
};

type TranscriptMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type SessionLinkState = "idle" | "syncing" | "linked" | "failed" | "demo";

const elevenLabsAgentId = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

function VoiceAction({
  active,
  disabled,
  label,
  onPress
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        active ? styles.actionButtonActive : undefined,
        disabled ? styles.actionButtonDisabled : undefined
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          active ? styles.actionButtonTextActive : undefined,
          disabled ? styles.actionButtonTextDisabled : undefined
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FallbackVoiceCard({ contextSummary, subtitle, title }: Omit<Props, "demoMode" | "problemId">) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Sin agente</Text>
        </View>
      </View>

      <LinearGradient
        colors={["#f8efe5", "#fffdf8"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.voiceStage}
      >
        <View style={styles.pulseWrap}>
          <View style={styles.pulseOuter}>
            <View style={styles.pulseInnerBlocked} />
          </View>
        </View>
        <View style={styles.stageCopy}>
          <Text style={styles.helperTitle}>Asistente de voz Rubidium</Text>
          <Text style={styles.helperText}>
            Falta configurar `EXPO_PUBLIC_ELEVENLABS_AGENT_ID` para activar el agente real en la app.
          </Text>
          <View style={styles.contextBox}>
            <Text style={styles.contextLabel}>Contexto actual</Text>
            <Text style={styles.contextText}>{contextSummary}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export function VoiceExperienceCard(props: Props) {
  if (!elevenLabsAgentId) {
    return (
      <FallbackVoiceCard
        contextSummary={props.contextSummary}
        subtitle={props.subtitle}
        title={props.title}
      />
    );
  }

  return <ConnectedVoiceExperienceCard {...props} />;
}

function ConnectedVoiceExperienceCard({
  contextSummary,
  demoMode = false,
  problemId,
  subtitle,
  title
}: Props) {
  const [sessionLinkState, setSessionLinkState] = useState<SessionLinkState>(demoMode ? "demo" : "idle");
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      text: "Cuando inicies la sesion, Rubidium se conectara con tu agente real de ElevenLabs."
    },
    {
      id: "user-intro",
      role: "user",
      text: "Quiero preguntar por voz sobre este problema y recibir una explicacion guiada."
    }
  ]);

  const voiceSessionIdRef = useRef<string | null>(null);
  const contextSentRef = useRef(false);
  const messageSyncKeysRef = useRef<Set<string>>(new Set());

  const appendMessage = (role: "assistant" | "user", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setMessages((current) => {
      const lastMessage = current[current.length - 1];
      if (lastMessage && lastMessage.role === role && lastMessage.text === trimmed) {
        return current;
      }

      return [
        ...current.slice(-5),
        {
          id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          text: trimmed
        }
      ];
    });
  };

  const syncVoiceMessage = async (content: string, role: "assistant" | "user") => {
    if (demoMode) {
      return;
    }

    const sessionId = voiceSessionIdRef.current;
    const trimmed = content.trim();

    if (!sessionId || !trimmed) {
      return;
    }

    const syncKey = `${role}:${trimmed}`;
    if (messageSyncKeysRef.current.has(syncKey)) {
      return;
    }

    messageSyncKeysRef.current.add(syncKey);

    try {
      await fetchWithAuth(`/voice/sessions/${sessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          role
        })
      });
      setSessionLinkState("linked");
    } catch {
      setSessionLinkState("failed");
    }
  };

  const ensureVoiceSession = async (conversationId?: string) => {
    if (demoMode) {
      setSessionLinkState("demo");
      return null;
    }

    if (voiceSessionIdRef.current) {
      return voiceSessionIdRef.current;
    }

    try {
      setSessionLinkState("syncing");

      const response = await fetchWithAuth("/voice/sessions", {
        method: "POST",
        body: JSON.stringify({
          problemId: problemId ?? null,
          provider: "elevenlabs",
          externalCallId: conversationId ?? null,
          summary: "Sesion conversacional iniciada desde Rubidium con ElevenLabs.",
          transcript: `Contexto inicial: ${contextSummary}`
        })
      });

      const nextSessionId = response?.data?.id as string | undefined;
      if (!nextSessionId) {
        setSessionLinkState("failed");
        return null;
      }

      voiceSessionIdRef.current = nextSessionId;
      setVoiceSessionId(nextSessionId);
      setSessionLinkState("linked");
      return nextSessionId;
    } catch {
      setSessionLinkState("failed");
      return null;
    }
  };

  const closeVoiceSession = async (summary: string) => {
    if (demoMode) {
      return;
    }

    const sessionId = voiceSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    try {
      await fetchWithAuth(`/voice/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          endedAt: new Date().toISOString(),
          summary
        })
      });
    } catch {
      setSessionLinkState("failed");
    }
  };

  const {
    endSession,
    isListening,
    isMuted,
    isSpeaking,
    message,
    mode,
    sendContextualUpdate,
    startSession,
    status,
    setMuted
  } = useConversation({
    onConnect: ({ conversationId }) => {
      setVoiceError(null);
      contextSentRef.current = false;
      messageSyncKeysRef.current.clear();
      appendMessage("assistant", "Sesion de voz conectada. Ya puedes hablar con Rubidium.");
      void ensureVoiceSession(conversationId);
    },
    onDisconnect: (details) => {
      appendMessage("assistant", "La sesion de voz se cerro.");
      void closeVoiceSession(`Sesion finalizada. Motivo: ${details.reason}.`);
    },
    onError: (nextMessage) => {
      setVoiceError(nextMessage);
      setSessionLinkState(demoMode ? "demo" : "failed");
    },
    onMessage: ({ message: text, role }) => {
      if (role === "user") {
        appendMessage("user", text);
        void syncVoiceMessage(text, "user");
        return;
      }

      appendMessage("assistant", text);
      void syncVoiceMessage(text, "assistant");
    }
  });

  useEffect(() => {
    if (status !== "connected" || contextSentRef.current) {
      return;
    }

    // Delay sending the contextual update to avoid the LiveKit
    // "cannot send signal request before connected" race condition.
    // The SDK emits 'connected' slightly before the signaling channel is ready.
    const timer = setTimeout(() => {
      if (contextSentRef.current) {
        return;
      }

      const update =
        `Problema actual en Rubidium: ${contextSummary}. ` +
        `Explica siempre en espanol, de forma didactica y conectada al sistema de mezcla.`;

      sendContextualUpdate(update);
      contextSentRef.current = true;
    }, 600);

    return () => clearTimeout(timer);
  }, [contextSummary, sendContextualUpdate, status]);

  useEffect(() => {
    return () => {
      void closeVoiceSession("Sesion cerrada al salir de la pantalla.");
    };
  }, []);

  const statusCopy = useMemo(() => {
    if (status === "connecting") {
      return {
        badge: "Conectando",
        helper: "Rubidium esta enlazando tu sesion con ElevenLabs."
      };
    }

    if (status === "error") {
      return {
        badge: "Con error",
        helper: message || voiceError || "No pudimos conectar el agente de voz."
      };
    }

    if (status === "connected" && isSpeaking) {
      return {
        badge: "Hablando",
        helper: "El agente esta respondiendo por voz en tiempo real."
      };
    }

    if (status === "connected" && isListening) {
      return {
        badge: "Escuchando",
        helper: "El agente esta atento a tu voz y al contexto del problema actual."
      };
    }

    if (status === "connected") {
      return {
        badge: "Conectado",
        helper: "La sesion esta activa. Puedes hablar o reenviar el contexto del problema."
      };
    }

    return {
      badge: "Lista",
      helper: "La tarjeta ya esta conectada al agente real. Inicia la sesion para hablar con Rubidium."
    };
  }, [isListening, isSpeaking, message, status, voiceError]);

  const sessionStatusLabel =
    demoMode
      ? "Demo local"
      : sessionLinkState === "linked"
        ? "Sesion enlazada"
        : sessionLinkState === "syncing"
          ? "Sincronizando"
          : sessionLinkState === "failed"
            ? "Con error de enlace"
            : "Pendiente";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{statusCopy.badge}</Text>
        </View>
      </View>

      <LinearGradient
        colors={["#f8efe5", "#fffdf8"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.voiceStage}
      >
        <View style={styles.pulseWrap}>
          <View
            style={[
              styles.pulseOuter,
              status === "connected" ? styles.pulseOuterListening : undefined,
              status === "error" ? styles.pulseOuterBlocked : undefined
            ]}
          >
            <View
              style={[
                styles.pulseInner,
                isSpeaking ? styles.pulseInnerExplaining : undefined,
                status === "connected" && !isSpeaking ? styles.pulseInnerReady : undefined,
                status === "error" ? styles.pulseInnerBlocked : undefined
              ]}
            />
          </View>
        </View>
        <View style={styles.stageCopy}>
          <View style={styles.helperRow}>
            <Text style={styles.helperTitle}>Asistente de voz Rubidium</Text>
            {status === "connecting" ? <ActivityIndicator color={colors.primaryDark} size="small" /> : null}
          </View>
          <Text style={styles.helperText}>{statusCopy.helper}</Text>
          <View style={styles.contextBox}>
            <Text style={styles.contextLabel}>Contexto actual</Text>
            <Text style={styles.contextText}>{contextSummary}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statusRow}>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipLabel}>Conexion</Text>
          <Text style={styles.statusChipValue}>{status}</Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipLabel}>Microfono</Text>
          <Text style={styles.statusChipValue}>{isMuted ? "Silenciado" : "Activo"}</Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipLabel}>Modo</Text>
          <Text style={styles.statusChipValue}>{status === "connected" ? mode : "reposo"}</Text>
        </View>
      </View>

      <View style={styles.sessionBanner}>
        <Text style={styles.sessionBannerLabel}>Estado de sesion</Text>
        <Text style={styles.sessionBannerText}>
          {sessionStatusLabel}
          {!demoMode && voiceSessionId ? `  |  ID ${voiceSessionId.slice(0, 8)}` : ""}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <VoiceAction
          active={status === "connected"}
          disabled={status === "connecting"}
          label={status === "connected" ? "Finalizar" : "Hablar"}
          onPress={() => {
            setVoiceError(null);

            if (status === "connected") {
              endSession();
              return;
            }

            startSession({
              agentId: elevenLabsAgentId,
              dynamicVariables: {
                problem_context: contextSummary,
                problem_id: problemId ?? "sin_problema",
                problem_title: title
              }
            });
          }}
        />
        <VoiceAction
          active={status === "connected" && !isMuted}
          disabled={status !== "connected"}
          label={isMuted ? "Activar mic" : "Silenciar"}
          onPress={() => {
            setMuted(!isMuted);
          }}
        />
        <VoiceAction
          active={false}
          disabled={status !== "connected"}
          label="Contexto"
          onPress={() => {
            sendContextualUpdate(
              `Recordatorio de contexto desde Rubidium: ${contextSummary}. ` +
                `Responde en espanol, paso a paso y con foco en comprension.`
            );
            appendMessage("assistant", "Contexto del problema reenviado al agente.");
          }}
        />
      </View>

      <View style={styles.transcriptBlock}>
        <Text style={styles.transcriptTitle}>Conversacion en vivo</Text>
        {(voiceError
          ? [
              {
                id: "voice-error",
                role: "assistant" as const,
                text: voiceError
              }
            ]
          : messages
        )
          .slice(-4)
          .map((messageItem) => (
            <View
              key={messageItem.id}
              style={[
                styles.transcriptBubble,
                messageItem.role === "assistant" ? styles.assistantBubble : styles.userBubble
              ]}
            >
              <Text
                style={[
                  styles.transcriptRole,
                  messageItem.role === "assistant" ? styles.assistantRole : styles.userRole
                ]}
              >
                {messageItem.role === "assistant" ? "Rubidium" : "Usuario"}
              </Text>
              <Text style={styles.transcriptText}>{messageItem.text}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    marginRight: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800"
  },
  voiceStage: {
    alignItems: "center",
    borderRadius: 24,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  pulseWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  pulseOuter: {
    alignItems: "center",
    backgroundColor: "rgba(140, 90, 60, 0.12)",
    borderRadius: 999,
    height: 78,
    justifyContent: "center",
    width: 78
  },
  pulseOuterListening: {
    backgroundColor: "rgba(140, 90, 60, 0.22)"
  },
  pulseOuterBlocked: {
    backgroundColor: "rgba(191, 124, 92, 0.16)"
  },
  pulseInner: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 42,
    width: 42
  },
  pulseInnerExplaining: {
    backgroundColor: colors.primary
  },
  pulseInnerReady: {
    backgroundColor: colors.accent
  },
  pulseInnerBlocked: {
    backgroundColor: "#c9876e",
    borderRadius: 999,
    height: 42,
    width: 42
  },
  stageCopy: {
    flex: 1,
    gap: 6
  },
  helperRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  helperTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  helperText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19
  },
  contextBox: {
    backgroundColor: "rgba(255, 253, 248, 0.78)",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 4,
    padding: spacing.sm
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  contextText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  statusChip: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  statusChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  statusChipValue: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "capitalize"
  },
  sessionBanner: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  sessionBannerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  sessionBannerText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  actionButtonActive: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  actionButtonTextActive: {
    color: colors.primaryDark
  },
  actionButtonTextDisabled: {
    color: colors.textMuted
  },
  transcriptBlock: {
    gap: spacing.sm
  },
  transcriptTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  transcriptBubble: {
    borderRadius: 20,
    gap: 4,
    padding: spacing.sm
  },
  assistantBubble: {
    backgroundColor: colors.backgroundSoft,
    borderTopLeftRadius: 8
  },
  userBubble: {
    backgroundColor: colors.surfaceAlt,
    borderTopRightRadius: 8
  },
  transcriptRole: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  assistantRole: {
    color: colors.primaryDark
  },
  userRole: {
    color: colors.textSoft
  },
  transcriptText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19
  }
});
