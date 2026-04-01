import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { VoiceExperienceCard } from "../components/VoiceExperienceCard";
import { fetchWithAuth } from "../lib/api";
import { useSoundEffects } from "../lib/soundEffects";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Problem } from "../types/history";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

type ChartPoint = {
  x: number;
  y: number;
  valueLabel: string;
};

type HomeSection = "resolver" | "historial" | "perfil";
type HistoryFilter = "all" | "solved" | "pending" | "failed";
type ProblemKind = "mixing" | "generic";
type ResolverTemplate = {
  id: string;
  label: string;
  description: string;
  values: {
    initialVolume: string;
    initialSolute: string;
    inflowRate: string;
    outflowRate: string;
    inflowConcentration: string;
  };
};

function detectProblemKind(problem: Problem): ProblemKind {
  if (problem.normalizedText) {
    try {
      const parsed = JSON.parse(problem.normalizedText) as Record<string, unknown>;
      if (
        typeof parsed.initialVolumeLiters === "number" &&
        typeof parsed.initialSoluteKg === "number" &&
        typeof parsed.inflowRateLitersPerMin === "number" &&
        typeof parsed.outflowRateLitersPerMin === "number" &&
        typeof parsed.inflowConcentrationKgPerLiter === "number"
      ) {
        return "mixing";
      }
    } catch {
      return "generic";
    }
  }

  if ((problem.title ?? "").toLowerCase().includes("mezcla")) {
    return "mixing";
  }

  return "generic";
}

function getProblemKindMeta(problem: Problem) {
  const kind = detectProblemKind(problem);

  if (kind === "mixing") {
    return {
      accentStyle: styles.kindBadgeMixing,
      accentTextStyle: styles.kindBadgeTextMixing,
      helper: "Balance de entrada y salida",
      label: "Sistema de mezcla"
    };
  }

  return {
    accentStyle: styles.kindBadgeGeneric,
    accentTextStyle: styles.kindBadgeTextGeneric,
    helper: "Lectura matematica guiada",
    label: "Problema matematico"
  };
}

function buildMixingCurves({
  initialVolume,
  initialSolute,
  inflowRate,
  outflowRate,
  inflowConcentration
}: {
  initialVolume: number;
  initialSolute: number;
  inflowRate: number;
  outflowRate: number;
  inflowConcentration: number;
}) {
  if (initialVolume <= 0 || inflowRate <= 0 || outflowRate <= 0 || inflowRate !== outflowRate) {
    return null;
  }

  const inputSaltRate = inflowConcentration * inflowRate;
  const coefficient = outflowRate / initialVolume;

  if (coefficient <= 0) {
    return null;
  }

  const equilibriumMass = inputSaltRate / coefficient;
  const timeHorizon = Math.max(40, Math.min(180, Math.round((1 / coefficient) * 4)));
  const samples = 8;

  const qValues = Array.from({ length: samples }, (_, index) => {
    const time = (timeHorizon / (samples - 1)) * index;
    const value = equilibriumMass + (initialSolute - equilibriumMass) * Math.exp(-coefficient * time);
    return { time, value };
  });

  const cValues = qValues.map((point) => ({
    time: point.time,
    value: point.value / initialVolume
  }));

  const qMax = Math.max(...qValues.map((point) => point.value), equilibriumMass, 1);
  const cMax = Math.max(...cValues.map((point) => point.value), inflowConcentration, 0.1);

  const mapPoints = (
    values: Array<{ time: number; value: number }>,
    maxY: number,
    formatter: (value: number) => string
  ): ChartPoint[] =>
    values.map((point) => ({
      x: point.time / timeHorizon,
      y: maxY === 0 ? 0 : point.value / maxY,
      valueLabel: formatter(point.value)
    }));

  return {
    qPoints: mapPoints(qValues, qMax, (value) => `${value.toFixed(1)} kg`),
    cPoints: mapPoints(cValues, cMax, (value) => `${value.toFixed(2)} kg/L`),
    qMaxLabel: `${qMax.toFixed(1)} kg`,
    cMaxLabel: `${cMax.toFixed(2)} kg/L`,
    timeHorizonLabel: `${timeHorizon} min`
  };
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InputCard({
  label,
  value,
  onChangeText,
  placeholder,
  errorText
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  errorText?: string;
}) {
  return (
    <View style={styles.inputCard}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        keyboardType="numeric"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, errorText ? styles.inputError : undefined]}
        value={value}
      />
      {errorText ? <Text style={styles.inputErrorText}>{errorText}</Text> : null}
    </View>
  );
}

function TemplateChip({
  label,
  description,
  onPress
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.templateChip}>
      <Text style={styles.templateChipLabel}>{label}</Text>
      <Text style={styles.templateChipText}>{description}</Text>
    </Pressable>
  );
}

function SectionTab({
  active,
  label,
  caption,
  onPress
}: {
  active: boolean;
  label: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sectionTabPressable}>
      <LinearGradient
        colors={active ? ["#f4e6d6", "#ead3bb"] : ["#fffdf8", "#f6efe5"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.sectionTab, active && styles.sectionTabActive]}
      >
        <View style={styles.sectionTabTopRow}>
          <View style={[styles.sectionTabIndicator, active && styles.sectionTabIndicatorActive]} />
          <Text style={[styles.sectionTabCaption, active && styles.sectionTabCaptionActive]}>{caption}</Text>
        </View>
        <Text style={[styles.sectionTabLabel, active && styles.sectionTabLabelActive]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function ProfileStatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileStatCard}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function HistoryFilterChip({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function MixingVisualizer({
  initialVolume,
  initialSolute,
  inflowRate,
  outflowRate,
  inflowConcentration
}: {
  initialVolume: number;
  initialSolute: number;
  inflowRate: number;
  outflowRate: number;
  inflowConcentration: number;
}) {
  const safeVolume = initialVolume > 0 ? initialVolume : 100;
  const liquidRatio = Math.max(0.2, Math.min(0.92, safeVolume / 140));
  const concentrationRatio = Math.max(0.08, Math.min(1, inflowConcentration / 1));
  const previewConcentration = safeVolume > 0 ? initialSolute / safeVolume : 0;
  const tankFillHeight = 132 * liquidRatio;
  const saltInputRate = inflowRate * inflowConcentration;
  const levelLabel = `${Math.round(liquidRatio * 100)}%`;
  const balanceLabel = inflowRate === outflowRate ? "Balance estable" : "Balance variable";

  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}>
        <Text style={styles.visualTitle}>Vista del sistema</Text>
        <Text style={styles.visualSubtitle}>Volumen constante</Text>
      </View>
      <View style={styles.visualBadgeRow}>
        <View style={styles.visualBadge}>
          <Text style={styles.visualBadgeLabel}>Entrada salina</Text>
          <Text style={styles.visualBadgeValue}>{saltInputRate.toFixed(2)} kg/min</Text>
        </View>
        <View style={styles.visualBadge}>
          <Text style={styles.visualBadgeLabel}>Nivel estimado</Text>
          <Text style={styles.visualBadgeValue}>{levelLabel}</Text>
        </View>
        <View style={styles.visualBadge}>
          <Text style={styles.visualBadgeLabel}>Estado</Text>
          <Text style={styles.visualBadgeValue}>{balanceLabel}</Text>
        </View>
      </View>
      <LinearGradient
        colors={["#fffdf8", "#f3e8da"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.visualStagePanel}
      >
        <View style={styles.scaleColumn}>
          <Text style={styles.scaleLabel}>100%</Text>
          <Text style={styles.scaleLabel}>75%</Text>
          <Text style={styles.scaleLabel}>50%</Text>
          <Text style={styles.scaleLabel}>25%</Text>
        </View>
        <View style={styles.visualStage}>
          <View style={styles.flowBadgeWrapLeft}>
            <Text style={styles.flowBadgeLabel}>Entrada</Text>
            <Text style={styles.flowBadgeValue}>{`${inflowRate || 0} L/min`}</Text>
          </View>
          <View style={styles.pipeIn}>
            <View style={styles.pipeArrow} />
          </View>
          <View style={styles.tankShell}>
            <View style={styles.tankScaleMarkTop} />
            <View style={styles.tankScaleMarkMiddle} />
            <View style={styles.tankScaleMarkBottom} />
            <LinearGradient
              colors={[
                `rgba(255, 243, 231, ${0.55 + concentrationRatio * 0.12})`,
                `rgba(198, 150, 107, ${0.58 + concentrationRatio * 0.18})`,
                `rgba(140, 90, 60, ${0.72 + concentrationRatio * 0.12})`
              ]}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0 }}
              style={[
                styles.tankLiquid,
                {
                  height: tankFillHeight
                }
              ]}
            >
              <View style={styles.tankSurface} />
              <View style={[styles.bubble, styles.bubbleOne]} />
              <View style={[styles.bubble, styles.bubbleTwo]} />
              <View style={[styles.bubble, styles.bubbleThree]} />
            </LinearGradient>
            <View style={styles.tankLevelBadge}>
              <Text style={styles.tankLevelBadgeText}>{`${previewConcentration.toFixed(2)} kg/L`}</Text>
            </View>
          </View>
          <View style={styles.pipeOut}>
            <View style={[styles.pipeArrow, styles.pipeArrowOut]} />
          </View>
          <View style={styles.flowBadgeWrapRight}>
            <Text style={styles.flowBadgeLabel}>Salida</Text>
            <Text style={styles.flowBadgeValue}>{`${outflowRate || 0} L/min`}</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.metricRow}>
        <MetricChip label="Entrada" value={`${inflowRate || 0} L/min`} />
        <MetricChip label="Salida" value={`${outflowRate || 0} L/min`} />
      </View>
      <View style={styles.metricRow}>
        <MetricChip label="C. entrada" value={`${inflowConcentration || 0} kg/L`} />
        <MetricChip label="C. inicial" value={`${previewConcentration.toFixed(2)} kg/L`} />
      </View>
    </View>
  );
}

function MiniLineChart({
  title,
  subtitle,
  color,
  points,
  maxLabel,
  timeLabel
}: {
  title: string;
  subtitle: string;
  color: string;
  points: ChartPoint[];
  maxLabel: string;
  timeLabel: string;
}) {
  const chartWidth = 248;
  const chartHeight = 128;

  const scaledPoints = points.map((point) => ({
    left: point.x * chartWidth,
    top: chartHeight - point.y * chartHeight,
    valueLabel: point.valueLabel
  }));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.chartFrame}>
        <Text style={styles.chartMaxLabel}>{maxLabel}</Text>
        <View style={styles.chartPlot}>
          <View style={styles.chartGridHorizontalTop} />
          <View style={styles.chartGridHorizontalMiddle} />
          <View style={styles.chartGridVerticalLeft} />
          <View style={styles.chartGridVerticalRight} />
          {scaledPoints.slice(0, -1).map((point, index) => {
            const nextPoint = scaledPoints[index + 1];
            const dx = nextPoint.left - point.left;
            const dy = nextPoint.top - point.top;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const centerLeft = (point.left + nextPoint.left) / 2 - length / 2;
            const centerTop = (point.top + nextPoint.top) / 2 - 1.5;

            return (
              <View
                key={`segment-${index}`}
                style={[
                  styles.chartSegment,
                  {
                    backgroundColor: color,
                    left: centerLeft,
                    top: centerTop,
                    transform: [{ rotate: `${angle}deg` }],
                    width: length
                  }
                ]}
              />
            );
          })}
          {scaledPoints.map((point, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.chartDot,
                {
                  backgroundColor: color,
                  left: point.left - 4,
                  top: point.top - 4
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.chartAxisFooter}>
          <Text style={styles.chartAxisLabel}>t = 0</Text>
          <Text style={styles.chartAxisLabel}>{timeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

export function HomeScreen({ navigation, route }: Props) {
  const resolverTemplates: ResolverTemplate[] = [
    {
      id: "base",
      label: "Caso base",
      description: "100 L, agua pura, entrada y salida de 4 L/min",
      values: {
        initialVolume: "100",
        initialSolute: "0",
        inflowRate: "4",
        outflowRate: "4",
        inflowConcentration: "0.5"
      }
    },
    {
      id: "higher-salt",
      label: "Mas concentrado",
      description: "Tanque limpio con entrada salina mas intensa",
      values: {
        initialVolume: "120",
        initialSolute: "0",
        inflowRate: "5",
        outflowRate: "5",
        inflowConcentration: "0.8"
      }
    },
    {
      id: "initial-salt",
      label: "Con sal inicial",
      description: "El sistema ya arranca con sal en el tanque",
      values: {
        initialVolume: "90",
        initialSolute: "12",
        inflowRate: "3",
        outflowRate: "3",
        inflowConcentration: "0.35"
      }
    }
  ];

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<HomeSection>("resolver");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [resolverFeedback, setResolverFeedback] = useState<string | null>(null);
  const [initialVolume, setInitialVolume] = useState("100");
  const [initialSolute, setInitialSolute] = useState("0");
  const [inflowRate, setInflowRate] = useState("4");
  const [outflowRate, setOutflowRate] = useState("4");
  const [inflowConcentration, setInflowConcentration] = useState("0.5");
  const { playButtonSound, playConfirmationSound } = useSoundEffects();

  const userEmail = route.params.session.user.email ?? "usuario";
  const isDemoProfile =
    userEmail.toLowerCase() === (process.env.EXPO_PUBLIC_DEMO_EMAIL ?? "").trim().toLowerCase();
  const displayName = userEmail.includes("@") ? userEmail.split("@")[0].replace(/[._-]+/g, " ") : userEmail;
  const latestProblem = problems[0] ?? null;
  const latestProblemMeta = latestProblem ? getProblemKindMeta(latestProblem) : null;
  const solvedCount = problems.filter((problem) => problem.status === "solved").length;
  const totalSteps = problems.reduce((total, problem) => total + (problem.steps?.length ?? 0), 0);
  const pendingCount = problems.filter((problem) => problem.status === "pending").length;
  const failedCount = problems.filter((problem) => problem.status === "failed").length;
  const sectionCopy: Record<HomeSection, { title: string; subtitle: string }> = {
    resolver: {
      title: "Resolver sistema",
      subtitle: "Configura el modelo y obten una solucion explicada con apoyo visual."
    },
    historial: {
      title: "Historial de consultas",
      subtitle: "Revisa lo que ya resolviste y vuelve sobre cada desarrollo paso a paso."
    },
    perfil: {
      title: "Perfil y sesion",
      subtitle: "Consulta el estado de tu cuenta y el tipo de experiencia que estas usando."
    }
  };

  const previewValues = {
    initialVolume: Number(initialVolume) || 0,
    initialSolute: Number(initialSolute) || 0,
    inflowRate: Number(inflowRate) || 0,
    outflowRate: Number(outflowRate) || 0,
    inflowConcentration: Number(inflowConcentration) || 0
  };
  const previewCurves = buildMixingCurves(previewValues);
  const resolverFieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!initialVolume.trim()) {
      errors.initialVolume = "Ingresa un volumen inicial.";
    } else if (previewValues.initialVolume <= 0) {
      errors.initialVolume = "Debe ser mayor que cero.";
    }

    if (!initialSolute.trim()) {
      errors.initialSolute = "Ingresa la sal inicial.";
    } else if (previewValues.initialSolute < 0) {
      errors.initialSolute = "No puede ser negativa.";
    }

    if (!inflowRate.trim()) {
      errors.inflowRate = "Ingresa el flujo de entrada.";
    } else if (previewValues.inflowRate <= 0) {
      errors.inflowRate = "Debe ser mayor que cero.";
    }

    if (!outflowRate.trim()) {
      errors.outflowRate = "Ingresa el flujo de salida.";
    } else if (previewValues.outflowRate <= 0) {
      errors.outflowRate = "Debe ser mayor que cero.";
    }

    if (
      previewValues.inflowRate > 0 &&
      previewValues.outflowRate > 0 &&
      previewValues.inflowRate !== previewValues.outflowRate
    ) {
      errors.outflowRate = "Por ahora entrada y salida deben coincidir.";
    }

    if (!inflowConcentration.trim()) {
      errors.inflowConcentration = "Ingresa la concentracion de entrada.";
    } else if (previewValues.inflowConcentration < 0) {
      errors.inflowConcentration = "No puede ser negativa.";
    }

    return errors;
  }, [
    inflowConcentration,
    inflowRate,
    initialSolute,
    initialVolume,
    outflowRate,
    previewValues.inflowConcentration,
    previewValues.inflowRate,
    previewValues.initialSolute,
    previewValues.initialVolume,
    previewValues.outflowRate
  ]);
  const resolverHasErrors = Object.keys(resolverFieldErrors).length > 0;
  const filteredProblems = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();

    return problems.filter((problem) => {
      if (historyFilter !== "all" && problem.status !== historyFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [problem.title, problem.prompt, problem.finalAnswer, problem.explanation]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [historyFilter, historyQuery, problems]);
  const hasHistorySearch = historyQuery.trim().length > 0 || historyFilter !== "all";

  const ensureProfile = useCallback(async () => {
    try {
      await fetchWithAuth("/history/me");
    } catch (error) {
      Alert.alert(
        "No se pudo sincronizar tu perfil",
        error instanceof Error ? error.message : "Error inesperado."
      );
    }
  }, []);

  const loadProblems = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetchWithAuth("/history/problems");
      setProblems(response.data ?? []);
    } catch (error) {
      Alert.alert("No se pudo cargar el historial", error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      await ensureProfile();
      await loadProblems();
    }

    bootstrap().catch(() => undefined);
  }, [ensureProfile, loadProblems]);

  async function handleLogout() {
    playButtonSound();
    await supabase.auth.signOut();
  }

  function applyTemplate(template: ResolverTemplate) {
    playButtonSound();
    setInitialVolume(template.values.initialVolume);
    setInitialSolute(template.values.initialSolute);
    setInflowRate(template.values.inflowRate);
    setOutflowRate(template.values.outflowRate);
    setInflowConcentration(template.values.inflowConcentration);
    setResolverFeedback(`Plantilla aplicada: ${template.label}.`);
  }

  async function handleCreateProblem() {
    const payload = {
      initialVolumeLiters: Number(initialVolume),
      initialSoluteKg: Number(initialSolute),
      inflowRateLitersPerMin: Number(inflowRate),
      outflowRateLitersPerMin: Number(outflowRate),
      inflowConcentrationKgPerLiter: Number(inflowConcentration)
    };

    if (resolverHasErrors || Object.values(payload).some((value) => Number.isNaN(value))) {
      const firstError = Object.values(resolverFieldErrors)[0] ?? "Revisa los datos del sistema antes de resolver.";
      setResolverFeedback(firstError);
      Alert.alert("Revisa tus datos", firstError);
      return;
    }

    try {
      setSaving(true);
      setResolverFeedback("Rubidium esta resolviendo el sistema y preparando la explicacion.");
      playButtonSound();
      const response = await fetchWithAuth("/mixing/solve", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      playConfirmationSound();

      if (response?.data) {
        setProblems((current) => [response.data, ...current.filter((problem) => problem.id !== response.data.id)]);
      } else if (!isDemoProfile) {
        await loadProblems();
      }

      setResolverFeedback("Listo. La solucion ya esta disponible en tu historial.");
      setActiveSection("historial");
    } catch (error) {
      setResolverFeedback("No pudimos resolver el sistema. Revisa tus datos o intenta de nuevo.");
      Alert.alert("No se pudo resolver", error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function handleSectionChange(nextSection: HomeSection) {
    if (nextSection === activeSection) {
      return;
    }

    playButtonSound();
    setActiveSection(nextSection);
  }

  function openProblemDetail(problem: Problem) {
    playButtonSound();
    navigation.navigate("ProblemDetail", {
      demoMode: isDemoProfile,
      initialProblem: problem,
      problemId: problem.id
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={activeSection === "historial" ? filteredProblems : []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.shellCard}>
              <View style={styles.shellHeader}>
                <Image source={require("../../assets/rubidium-mark.png")} style={styles.brandIcon} />
                <View style={styles.shellCopy}>
                  <Text style={styles.eyebrow}>Rubidium</Text>
                  <Text style={styles.brand}>{sectionCopy[activeSection].title}</Text>
                  <Text style={styles.subtitle}>{sectionCopy[activeSection].subtitle}</Text>
                </View>
              </View>
              <View style={styles.sectionTabsRow}>
                <SectionTab
                  active={activeSection === "resolver"}
                  caption="modelo"
                  label="Resolver"
                  onPress={() => handleSectionChange("resolver")}
                />
                <SectionTab
                  active={activeSection === "historial"}
                  caption="memoria"
                  label="Historial"
                  onPress={() => handleSectionChange("historial")}
                />
                <SectionTab
                  active={activeSection === "perfil"}
                  caption="cuenta"
                  label="Perfil"
                  onPress={() => handleSectionChange("perfil")}
                />
              </View>
            </View>

            {activeSection === "resolver" ? (
              <>
                <View style={styles.heroBlock}>
                  <View style={styles.heroCopy}>
                    <Text style={styles.eyebrow}>Laboratorio personal</Text>
                    <Text style={styles.title}>Hola, {displayName}</Text>
                    <Text style={styles.subtitle}>
                      Convierte un sistema de mezcla en una solucion clara, visual y paso a paso.
                    </Text>
                    <View style={styles.metricRow}>
                      <MetricChip label="Consultas" value={`${problems.length}`} />
                      <MetricChip label="Modo" value={isDemoProfile ? "Demo" : "Personal"} />
                    </View>
                  </View>
                  <MixingVisualizer
                    inflowConcentration={previewValues.inflowConcentration}
                    inflowRate={previewValues.inflowRate}
                    initialSolute={previewValues.initialSolute}
                    initialVolume={previewValues.initialVolume}
                    outflowRate={previewValues.outflowRate}
                  />
                </View>

                <View style={styles.composeCard}>
                  <View style={styles.composeHeader}>
                    <Text style={styles.composeTitle}>Configura el tanque de mezcla</Text>
                    <Text style={styles.composeHint}>Ajusta los parametros y genera una solucion explicada.</Text>
                  </View>

                  <View style={styles.templateSection}>
                    <Text style={styles.templateSectionTitle}>Plantillas rapidas</Text>
                    <View style={styles.templateRow}>
                      {resolverTemplates.map((template) => (
                        <TemplateChip
                          description={template.description}
                          key={template.id}
                          label={template.label}
                          onPress={() => applyTemplate(template)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGrid}>
                    <InputCard
                      errorText={resolverFieldErrors.initialVolume}
                      label="Volumen inicial"
                      onChangeText={setInitialVolume}
                      placeholder="100 L"
                      value={initialVolume}
                    />
                    <InputCard
                      errorText={resolverFieldErrors.initialSolute}
                      label="Sal inicial"
                      onChangeText={setInitialSolute}
                      placeholder="0 kg"
                      value={initialSolute}
                    />
                    <InputCard
                      errorText={resolverFieldErrors.inflowRate}
                      label="Flujo de entrada"
                      onChangeText={setInflowRate}
                      placeholder="4 L/min"
                      value={inflowRate}
                    />
                    <InputCard
                      errorText={resolverFieldErrors.outflowRate}
                      label="Flujo de salida"
                      onChangeText={setOutflowRate}
                      placeholder="4 L/min"
                      value={outflowRate}
                    />
                    <View style={styles.inputGridFull}>
                      <InputCard
                        errorText={resolverFieldErrors.inflowConcentration}
                        label="Concentracion de entrada"
                        onChangeText={setInflowConcentration}
                        placeholder="0.5 kg/L"
                        value={inflowConcentration}
                      />
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <MetricChip label="Volumen" value={`${previewValues.initialVolume || 0} L`} />
                    <MetricChip
                      label="Balance"
                      value={previewValues.inflowRate === previewValues.outflowRate ? "Constante" : "Variable"}
                    />
                  </View>

                  {resolverFeedback ? (
                    <View style={[styles.feedbackCard, saving ? styles.feedbackCardSaving : undefined]}>
                      {saving ? <ActivityIndicator color={colors.primaryDark} size="small" /> : null}
                      <Text style={styles.feedbackText}>{resolverFeedback}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    disabled={saving}
                    onPress={handleCreateProblem}
                    style={[styles.primaryButton, saving ? styles.primaryButtonDisabled : undefined]}
                  >
                    <Text style={styles.primaryButtonText}>{saving ? "Resolviendo..." : "Resolver sistema"}</Text>
                  </Pressable>
                </View>

                {isDemoProfile ? (
                  <View style={styles.demoBanner}>
                    <Text style={styles.demoBannerTitle}>Modo demo activo</Text>
                    <Text style={styles.demoBannerText}>
                      Tus resultados se muestran solo durante esta sesion y no se guardan en el historial permanente.
                    </Text>
                  </View>
                ) : null}

                {previewCurves ? (
                  <View style={styles.chartSection}>
                    <View style={styles.chartSectionHeader}>
                      <Text style={styles.sectionTitle}>Comportamiento del sistema</Text>
                      <Text style={styles.sectionSubtitle}>
                        Curvas aproximadas generadas con tus parametros actuales.
                      </Text>
                    </View>
                    <MiniLineChart
                      color={colors.primary}
                      maxLabel={previewCurves.qMaxLabel}
                      points={previewCurves.qPoints}
                      subtitle="Cantidad de sal"
                      timeLabel={previewCurves.timeHorizonLabel}
                      title="Q(t)"
                    />
                    <MiniLineChart
                      color={colors.accent}
                      maxLabel={previewCurves.cMaxLabel}
                      points={previewCurves.cPoints}
                      subtitle="Concentracion"
                      timeLabel={previewCurves.timeHorizonLabel}
                      title="C(t)"
                    />
                  </View>
                ) : null}

                <VoiceExperienceCard
                  contextSummary={`Caso actual: volumen ${previewValues.initialVolume || 0} L, entrada ${
                    previewValues.inflowRate || 0
                  } L/min, salida ${previewValues.outflowRate || 0} L/min y concentracion ${
                    previewValues.inflowConcentration || 0
                  } kg/L.`}
                  demoMode={isDemoProfile}
                  problemId={latestProblem?.id}
                  subtitle="Base visual para futuras explicaciones, preguntas y lectura guiada."
                  title="Experiencia por voz"
                />

                {latestProblem ? (
                  <Pressable onPress={() => openProblemDetail(latestProblem)} style={styles.highlightCard}>
                    <View style={styles.highlightHeader}>
                      <Text style={styles.highlightEyebrow}>Ultimo resultado</Text>
                      <Text style={styles.badge}>{latestProblem.status}</Text>
                    </View>
                    {latestProblemMeta ? (
                      <View style={styles.kindRow}>
                        <View style={[styles.kindBadge, latestProblemMeta.accentStyle]}>
                          <Text style={[styles.kindBadgeText, latestProblemMeta.accentTextStyle]}>
                            {latestProblemMeta.label}
                          </Text>
                        </View>
                        <Text style={styles.kindHelperText}>{latestProblemMeta.helper}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.highlightTitle}>{latestProblem.title || "Sistema de mezcla"}</Text>
                    {latestProblem.finalAnswer ? (
                      <Text style={styles.highlightAnswer}>{latestProblem.finalAnswer}</Text>
                    ) : null}
                    {latestProblem.explanation ? (
                      <Text style={styles.highlightText}>{latestProblem.explanation}</Text>
                    ) : null}
                    <Text style={styles.detailHint}>Toca para ver el desarrollo completo</Text>
                  </Pressable>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Tu solucion aparecera aqui</Text>
                    <Text style={styles.emptyText}>
                      Configura el modelo y resuelvelo para ver la respuesta destacada en esta misma seccion.
                    </Text>
                  </View>
                )}
              </>
            ) : null}

            {activeSection === "historial" ? (
              <>
                <View style={styles.historyHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Historial de consultas</Text>
                    <Text style={styles.sectionSubtitle}>
                      {isDemoProfile
                        ? "En demo solo veras los ejercicios de esta sesion temporal."
                        : "Cada intento guarda su planteamiento, resultado y desarrollo."}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      playButtonSound();
                      loadProblems(true).catch(() => undefined);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Sincronizar</Text>
                  </Pressable>
                </View>

                <View style={styles.historySummaryCard}>
                  <View style={styles.metricRow}>
                    <MetricChip label="Mostrando" value={`${filteredProblems.length}`} />
                    <MetricChip label="Resueltos" value={`${solvedCount}`} />
                  </View>
                  <View style={styles.metricRow}>
                    <MetricChip label="Pendientes" value={`${pendingCount}`} />
                    <MetricChip label="Fallidos" value={`${failedCount}`} />
                  </View>

                  <View style={styles.searchBlock}>
                    <Text style={styles.searchLabel}>Buscar en historial</Text>
                    <TextInput
                      onChangeText={setHistoryQuery}
                      placeholder="Busca por titulo, planteamiento o respuesta"
                      placeholderTextColor={colors.textMuted}
                      style={styles.searchInput}
                      value={historyQuery}
                    />
                  </View>

                  <View style={styles.filterRow}>
                    <HistoryFilterChip
                      active={historyFilter === "all"}
                      label="Todos"
                      onPress={() => {
                        playButtonSound();
                        setHistoryFilter("all");
                      }}
                    />
                    <HistoryFilterChip
                      active={historyFilter === "solved"}
                      label="Resueltos"
                      onPress={() => {
                        playButtonSound();
                        setHistoryFilter("solved");
                      }}
                    />
                    <HistoryFilterChip
                      active={historyFilter === "pending"}
                      label="Pendientes"
                      onPress={() => {
                        playButtonSound();
                        setHistoryFilter("pending");
                      }}
                    />
                    <HistoryFilterChip
                      active={historyFilter === "failed"}
                      label="Fallidos"
                      onPress={() => {
                        playButtonSound();
                        setHistoryFilter("failed");
                      }}
                    />
                  </View>
                </View>
              </>
            ) : null}

            {activeSection === "perfil" ? (
              <>
                <View style={styles.profileCard}>
                  <Image source={require("../../assets/rubidium-mark.png")} style={styles.profileIcon} />
                  <Text style={styles.profileTitle}>{displayName}</Text>
                  <Text style={styles.profileEmail}>{userEmail}</Text>
                  <Text style={styles.profileMode}>
                    {isDemoProfile ? "Perfil de demostracion" : "Cuenta personal"}
                  </Text>
                </View>

                <View style={styles.profileStatsRow}>
                  <ProfileStatCard label="Consultas" value={`${problems.length}`} />
                  <ProfileStatCard label="Resueltos" value={`${solvedCount}`} />
                  <ProfileStatCard label="Pasos" value={`${totalSteps}`} />
                </View>

                <View style={styles.profileInfoCard}>
                  <Text style={styles.sectionTitle}>Estado de tu espacio</Text>
                  <Text style={styles.profileInfoText}>
                    {isDemoProfile
                      ? "Estas usando Rubidium en modo demo. Puedes probar la experiencia y resolver ejemplos, pero el historial no se almacena en la base de datos."
                      : "Tu cuenta personal conserva tu historial, tus soluciones paso a paso y las consultas que realices en la app."}
                  </Text>
                </View>

                <Pressable onPress={handleLogout} style={styles.logoutButton}>
                  <Text style={styles.logoutButtonText}>Cerrar sesion</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          activeSection === "historial" ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {hasHistorySearch ? "No se encontraron coincidencias" : "Aun no hay ejercicios guardados"}
              </Text>
              <Text style={styles.emptyText}>
                {hasHistorySearch
                  ? "Prueba con otro texto o cambia el filtro para ver mas ejercicios."
                  : isDemoProfile
                    ? "Resuelve un sistema para verlo temporalmente aqui mientras mantengas abierta la sesion demo."
                    : "Cuando resuelvas tu primer sistema de mezcla, aqui veras su desarrollo completo."}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              playButtonSound();
              loadProblems(true).catch(() => undefined);
            }}
          />
        }
        renderItem={({ item, index }) => (
          (() => {
            const problemMeta = getProblemKindMeta(item);

            return (
              <Pressable onPress={() => openProblemDetail(item)} style={[styles.card, index === 0 && styles.firstCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title || "Sistema de mezcla"}</Text>
                  <Text style={styles.badge}>{item.status}</Text>
                </View>
                <View style={styles.kindRow}>
                  <View style={[styles.kindBadge, problemMeta.accentStyle]}>
                    <Text style={[styles.kindBadgeText, problemMeta.accentTextStyle]}>{problemMeta.label}</Text>
                  </View>
                  <Text style={styles.kindHelperText}>{problemMeta.helper}</Text>
                </View>
                <Text style={styles.prompt}>{item.prompt}</Text>
                {item.finalAnswer ? <Text style={styles.answer}>Respuesta: {item.finalAnswer}</Text> : null}
                {item.explanation ? <Text style={styles.explanation}>{item.explanation}</Text> : null}
                {item.steps?.length ? (
                  <View style={styles.stepsBlock}>
                    {item.steps.slice(0, 2).map((step) => (
                      <View key={step.id} style={styles.stepItem}>
                        <Text style={styles.stepTitle}>
                          Paso {step.stepNumber}: {step.title || "Desarrollo"}
                        </Text>
                        <Text style={styles.stepText}>{step.explanation}</Text>
                      </View>
                    ))}
                    {item.steps.length > 2 ? (
                      <Text style={styles.moreStepsText}>+ {item.steps.length - 2} pasos mas en el detalle</Text>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
                <Text style={styles.detailHint}>Abrir detalle</Text>
              </Pressable>
            );
          })()
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  shellCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  shellHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  shellCopy: {
    flex: 1
  },
  sectionTabsRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  sectionTabPressable: {
    flex: 1
  },
  sectionTab: {
    borderColor: "rgba(220, 205, 191, 0.95)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: "center",
    minHeight: 84,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12
  },
  sectionTabActive: {
    borderColor: "#d5b08a",
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.14,
    shadowRadius: 18
  },
  sectionTabTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  sectionTabCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  sectionTabCaptionActive: {
    color: colors.primaryDark
  },
  sectionTabLabel: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "800"
  },
  sectionTabLabelActive: {
    color: colors.primaryDark
  },
  sectionTabIndicator: {
    backgroundColor: "#d8c6b3",
    borderRadius: 999,
    height: 10,
    width: 10
  },
  sectionTabIndicatorActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 0
    },
    shadowOpacity: 0.22,
    shadowRadius: 8
  },
  heroBlock: {
    gap: spacing.md
  },
  heroCopy: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    padding: spacing.xl
  },
  brandIcon: {
    height: 58,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    resizeMode: "contain",
    width: 58
  },
  brand: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs
  },
  visualCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  visualHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  visualTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  visualSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  visualBadgeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  visualBadge: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  visualBadgeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  visualBadgeValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  visualStagePanel: {
    borderRadius: 26,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  scaleColumn: {
    alignItems: "flex-start",
    left: 0,
    position: "absolute",
    top: 18
  },
  scaleLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 17
  },
  visualStage: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 170
  },
  flowBadgeWrapLeft: {
    alignItems: "flex-end",
    gap: 4,
    marginRight: 10
  },
  flowBadgeWrapRight: {
    alignItems: "flex-start",
    gap: 4,
    marginLeft: 10
  },
  flowBadgeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  flowBadgeValue: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800"
  },
  pipeIn: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 10,
    marginRight: 8,
    width: 58
  },
  pipeOut: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 10,
    marginLeft: 8,
    width: 58
  },
  pipeArrow: {
    alignSelf: "flex-end",
    borderBottomColor: "transparent",
    borderBottomWidth: 7,
    borderLeftColor: colors.primary,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderTopWidth: 7,
    marginTop: -2
  },
  pipeArrowOut: {
    alignSelf: "flex-start",
    borderLeftWidth: 0,
    borderRightColor: colors.primary,
    borderRightWidth: 10
  },
  tankShell: {
    backgroundColor: "#fbf8f3",
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 3,
    height: 146,
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "relative",
    width: 124
  },
  tankScaleMarkTop: {
    backgroundColor: "rgba(140, 90, 60, 0.12)",
    height: 1,
    left: 10,
    position: "absolute",
    right: 10,
    top: 34
  },
  tankScaleMarkMiddle: {
    backgroundColor: "rgba(140, 90, 60, 0.12)",
    height: 1,
    left: 10,
    position: "absolute",
    right: 10,
    top: 72
  },
  tankScaleMarkBottom: {
    backgroundColor: "rgba(140, 90, 60, 0.12)",
    height: 1,
    left: 10,
    position: "absolute",
    right: 10,
    top: 110
  },
  tankLiquid: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    justifyContent: "flex-start",
    paddingTop: 6
  },
  tankSurface: {
    backgroundColor: "rgba(255,255,255,0.38)",
    borderRadius: 999,
    height: 6,
    marginHorizontal: 12
  },
  bubble: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 99,
    position: "absolute"
  },
  bubbleOne: {
    height: 8,
    left: 24,
    top: 32,
    width: 8
  },
  bubbleTwo: {
    height: 10,
    right: 28,
    top: 48,
    width: 10
  },
  bubbleThree: {
    height: 6,
    left: 56,
    top: 66,
    width: 6
  },
  tankLevelBadge: {
    backgroundColor: "rgba(255, 253, 248, 0.92)",
    borderColor: "rgba(220, 205, 191, 0.92)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: "absolute",
    right: 10,
    top: 12
  },
  tankLevelBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800"
  },
  composeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  composeHeader: {
    gap: 4
  },
  composeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  composeHint: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20
  },
  templateSection: {
    gap: spacing.sm
  },
  templateSectionTitle: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  templateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  templateChip: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: "47%",
    padding: spacing.sm
  },
  templateChipLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4
  },
  templateChipText: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18
  },
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  inputGridFull: {
    width: "100%"
  },
  inputCard: {
    flexGrow: 1,
    minWidth: "47%"
  },
  inputLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6
  },
  input: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputError: {
    borderColor: "#cf8d78",
    backgroundColor: "#fff7f4"
  },
  inputErrorText: {
    color: "#b76047",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 6
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricChip: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  metricValue: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 15
  },
  primaryButtonDisabled: {
    opacity: 0.82
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800"
  },
  feedbackCard: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  feedbackCardSaving: {
    backgroundColor: "#f2e8dc",
    borderColor: colors.primarySoft
  },
  feedbackText: {
    color: colors.textSoft,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  demoBanner: {
    backgroundColor: "#fff5e9",
    borderColor: "#e7cfae",
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md
  },
  demoBannerTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  demoBannerText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19
  },
  highlightCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  highlightHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  highlightEyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1
  },
  highlightTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  highlightAnswer: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22
  },
  highlightText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21
  },
  kindRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  kindBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  kindBadgeMixing: {
    backgroundColor: "#fff4e6",
    borderColor: "#dfc19d"
  },
  kindBadgeGeneric: {
    backgroundColor: "#f7f2eb",
    borderColor: "#d7c8b8"
  },
  kindBadgeText: {
    fontSize: 12,
    fontWeight: "800"
  },
  kindBadgeTextMixing: {
    color: colors.primaryDark
  },
  kindBadgeTextGeneric: {
    color: colors.textSoft
  },
  kindHelperText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chartSection: {
    gap: spacing.md
  },
  chartSectionHeader: {
    gap: 4
  },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  historySummaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  searchBlock: {
    gap: 6
  },
  searchLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  searchInput: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  filterChipActive: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft
  },
  filterChipLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  filterChipLabelActive: {
    color: colors.primaryDark
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  sectionSubtitle: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 230
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chartTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800"
  },
  chartSubtitle: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  chartFrame: {
    gap: spacing.xs
  },
  chartMaxLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chartPlot: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 22,
    height: 128,
    marginTop: 2,
    overflow: "hidden",
    position: "relative",
    width: "100%"
  },
  chartGridHorizontalTop: {
    backgroundColor: colors.border,
    height: 1,
    left: 0,
    opacity: 0.55,
    position: "absolute",
    right: 0,
    top: 32
  },
  chartGridHorizontalMiddle: {
    backgroundColor: colors.border,
    height: 1,
    left: 0,
    opacity: 0.55,
    position: "absolute",
    right: 0,
    top: 76
  },
  chartGridVerticalLeft: {
    backgroundColor: colors.border,
    bottom: 0,
    opacity: 0.45,
    position: "absolute",
    top: 0,
    width: 1
  },
  chartGridVerticalRight: {
    backgroundColor: colors.border,
    bottom: 0,
    opacity: 0.45,
    position: "absolute",
    right: 56,
    top: 0,
    width: 1
  },
  chartSegment: {
    borderRadius: 999,
    height: 3,
    position: "absolute"
  },
  chartDot: {
    borderRadius: 99,
    height: 8,
    position: "absolute",
    width: 8
  },
  chartAxisFooter: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chartAxisLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontWeight: "700"
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: 6,
    padding: spacing.xl
  },
  profileIcon: {
    height: 72,
    marginBottom: spacing.xs,
    resizeMode: "contain",
    width: 72
  },
  profileTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    textTransform: "capitalize"
  },
  profileEmail: {
    color: colors.textSoft,
    fontSize: 14
  },
  profileMode: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    color: colors.primaryDark,
    marginTop: spacing.xs,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  profileStatsRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  profileStatCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md
  },
  profileStatValue: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "800"
  },
  profileStatLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  profileInfoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  profileInfoText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 22,
    paddingVertical: 16
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800"
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  firstCard: {
    marginTop: 0
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    marginRight: 12
  },
  badge: {
    backgroundColor: colors.surface,
    borderColor: colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primaryDark,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "capitalize"
  },
  prompt: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22
  },
  answer: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22
  },
  explanation: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21
  },
  stepsBlock: {
    gap: spacing.sm
  },
  stepItem: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 18,
    padding: spacing.sm
  },
  stepTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4
  },
  stepText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  moreStepsText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  detailHint: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs
  }
});
