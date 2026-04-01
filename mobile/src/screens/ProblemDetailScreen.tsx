import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { VoiceExperienceCard } from "../components/VoiceExperienceCard";
import { fetchWithAuth } from "../lib/api";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Problem } from "../types/history";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ProblemDetail">;

type MixingInput = {
  initialVolumeLiters: number;
  initialSoluteKg: number;
  inflowRateLitersPerMin: number;
  outflowRateLitersPerMin: number;
  inflowConcentrationKgPerLiter: number;
};

type ChartPoint = {
  x: number;
  y: number;
};

type LearningSummary = {
  kind: "mixing" | "generic";
  eyebrow: string;
  focusLabel: string;
  focusValue: string;
  keyIdea: string;
  summary: string;
  remember: string;
};

function parseMixingInput(problem: Problem): MixingInput | null {
  if (!problem.normalizedText) {
    return null;
  }

  try {
    const parsed = JSON.parse(problem.normalizedText) as Partial<MixingInput>;
    if (
      typeof parsed.initialVolumeLiters === "number" &&
      typeof parsed.initialSoluteKg === "number" &&
      typeof parsed.inflowRateLitersPerMin === "number" &&
      typeof parsed.outflowRateLitersPerMin === "number" &&
      typeof parsed.inflowConcentrationKgPerLiter === "number"
    ) {
      return parsed as MixingInput;
    }
  } catch {
    return null;
  }

  return null;
}

function buildMixingCurves(input: MixingInput | null) {
  if (!input) {
    return null;
  }

  const {
    initialVolumeLiters,
    initialSoluteKg,
    inflowRateLitersPerMin,
    outflowRateLitersPerMin,
    inflowConcentrationKgPerLiter
  } = input;

  if (
    initialVolumeLiters <= 0 ||
    inflowRateLitersPerMin <= 0 ||
    outflowRateLitersPerMin <= 0 ||
    inflowRateLitersPerMin !== outflowRateLitersPerMin
  ) {
    return null;
  }

  const inputSaltRate = inflowConcentrationKgPerLiter * inflowRateLitersPerMin;
  const coefficient = outflowRateLitersPerMin / initialVolumeLiters;
  const equilibriumMass = inputSaltRate / coefficient;
  const timeHorizon = Math.max(40, Math.min(180, Math.round((1 / coefficient) * 4)));
  const samples = 8;

  const qValues = Array.from({ length: samples }, (_, index) => {
    const time = (timeHorizon / (samples - 1)) * index;
    const value = equilibriumMass + (initialSoluteKg - equilibriumMass) * Math.exp(-coefficient * time);
    return { time, value };
  });

  const cValues = qValues.map((point) => ({
    time: point.time,
    value: point.value / initialVolumeLiters
  }));

  const qMax = Math.max(...qValues.map((point) => point.value), equilibriumMass, 1);
  const cMax = Math.max(...cValues.map((point) => point.value), inflowConcentrationKgPerLiter, 0.1);

  const mapPoints = (values: Array<{ time: number; value: number }>, maxY: number): ChartPoint[] =>
    values.map((point) => ({
      x: point.time / timeHorizon,
      y: maxY === 0 ? 0 : point.value / maxY
    }));

  return {
    qPoints: mapPoints(qValues, qMax),
    cPoints: mapPoints(cValues, cMax),
    qLabel: `${qMax.toFixed(1)} kg`,
    cLabel: `${cMax.toFixed(2)} kg/L`,
    timeLabel: `${timeHorizon} min`
  };
}

function buildLearningSummary(problem: Problem, input: MixingInput | null): LearningSummary {
  if (!input) {
    return {
      kind: "generic",
      eyebrow: "Lectura guiada",
      focusLabel: "Enfoque",
      focusValue: "Razonamiento matematico",
      keyIdea: "Todo el procedimiento nace de comparar lo que entra con lo que sale del sistema.",
      summary:
        "El modelo permite describir como cambia la cantidad de soluto en el tiempo hasta llegar a un comportamiento estable.",
      remember:
        "Cuando un sistema de mezcla tiene volumen constante, la concentracion suele estudiarse a partir de un balance de entrada y salida."
    };
  }

  const inputSaltRate = input.inflowConcentrationKgPerLiter * input.inflowRateLitersPerMin;
  const outputCoefficient = input.outflowRateLitersPerMin / input.initialVolumeLiters;
  const equilibriumMass = inputSaltRate / outputCoefficient;
  const equilibriumConcentration = equilibriumMass / input.initialVolumeLiters;

  return {
    kind: "mixing",
    eyebrow: "Mapa de aprendizaje",
    focusLabel: "Tipo de problema",
    focusValue: "Sistema de mezcla",
    keyIdea:
      "La idea clave es que la sal dentro del tanque cambia segun la diferencia entre la sal que entra y la sal que sale.",
    summary:
      `En este caso, el sistema se va ajustando hasta acercarse a ${equilibriumMass.toFixed(2)} kg de sal, ` +
      `lo que equivale a una concentracion aproximada de ${equilibriumConcentration.toFixed(2)} kg/L.`,
    remember:
      `Si la entrada y la salida son iguales, el volumen no cambia y la ecuacion se vuelve mas facil de interpretar. ` +
      `Por eso el problema termina mostrando una estabilizacion progresiva en lugar de un crecimiento sin limite.`
  };
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MixingVisualizer({ input }: { input: MixingInput }) {
  const liquidRatio = Math.max(0.2, Math.min(0.92, input.initialVolumeLiters / 140));
  const concentrationRatio = Math.max(0.08, Math.min(1, input.inflowConcentrationKgPerLiter / 1));
  const previewConcentration = input.initialVolumeLiters > 0 ? input.initialSoluteKg / input.initialVolumeLiters : 0;
  const tankFillHeight = 132 * liquidRatio;

  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}>
        <Text style={styles.visualTitle}>Modelo visual</Text>
        <Text style={styles.visualSubtitle}>Caso guardado</Text>
      </View>
      <View style={styles.visualBadgeRow}>
        <MetricChip label="Entrada" value={`${input.inflowRateLitersPerMin} L/min`} />
        <MetricChip label="Salida" value={`${input.outflowRateLitersPerMin} L/min`} />
        <MetricChip label="Sal inicial" value={`${input.initialSoluteKg} kg`} />
      </View>
      <LinearGradient
        colors={["#fffdf8", "#f3e8da"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.visualStagePanel}
      >
        <View style={styles.visualStage}>
          <View style={styles.flowCopy}>
            <Text style={styles.flowLabel}>Entrada</Text>
            <Text style={styles.flowValue}>{`${input.inflowConcentrationKgPerLiter} kg/L`}</Text>
          </View>
          <View style={styles.pipeIn}>
            <View style={styles.pipeArrow} />
          </View>
          <View style={styles.tankShell}>
            <LinearGradient
              colors={[
                `rgba(255, 243, 231, ${0.55 + concentrationRatio * 0.12})`,
                `rgba(198, 150, 107, ${0.58 + concentrationRatio * 0.18})`,
                `rgba(140, 90, 60, ${0.72 + concentrationRatio * 0.12})`
              ]}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0 }}
              style={[styles.tankLiquid, { height: tankFillHeight }]}
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
          <View style={styles.flowCopy}>
            <Text style={styles.flowLabel}>Volumen</Text>
            <Text style={styles.flowValue}>{`${input.initialVolumeLiters} L`}</Text>
          </View>
        </View>
      </LinearGradient>
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
    top: chartHeight - point.y * chartHeight
  }));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chartMaxLabel}>{maxLabel}</Text>
      <View style={styles.chartPlot}>
        <View style={styles.chartGridHorizontalTop} />
        <View style={styles.chartGridHorizontalMiddle} />
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
  );
}

export function ProblemDetailScreen({ navigation, route }: Props) {
  const { demoMode = false, initialProblem, problemId } = route.params;
  const [problem, setProblem] = useState<Problem>(initialProblem);
  const [loading, setLoading] = useState(!demoMode);
  const [refreshing, setRefreshing] = useState(false);

  const mixingInput = useMemo(() => parseMixingInput(problem), [problem]);
  const curves = useMemo(() => buildMixingCurves(mixingInput), [mixingInput]);
  const learningSummary = useMemo(() => buildLearningSummary(problem, mixingInput), [mixingInput, problem]);
  const summaryStyles =
    learningSummary.kind === "mixing"
      ? {
          card: styles.summaryCardMixing,
          pill: styles.summaryPillMixing,
          pillText: styles.summaryPillTextMixing
        }
      : {
          card: styles.summaryCardGeneric,
          pill: styles.summaryPillGeneric,
          pillText: styles.summaryPillTextGeneric
        };

  const loadProblem = useCallback(
    async (isRefresh = false) => {
      if (demoMode) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await fetchWithAuth(`/history/problems/${problemId}`);
        if (response?.data) {
          setProblem(response.data);
        }
      } catch (error) {
        Alert.alert(
          "No se pudo cargar el detalle",
          error instanceof Error ? error.message : "Error inesperado."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [demoMode, problemId]
  );

  useEffect(() => {
    navigation.setOptions({
      title: problem.title || "Detalle de solucion",
      headerStyle: {
        backgroundColor: colors.background
      },
      headerTintColor: colors.primaryDark
    });
  }, [navigation, problem.title]);

  useEffect(() => {
    loadProblem().catch(() => undefined);
  }, [loadProblem]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              loadProblem(true).catch(() => undefined);
            }}
            refreshing={refreshing}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.eyebrow}>Detalle del problema</Text>
            <Text style={styles.badge}>{problem.status}</Text>
          </View>
          <Text style={styles.title}>{problem.title || "Sistema de mezcla"}</Text>
          <Text style={styles.meta}>{new Date(problem.createdAt).toLocaleString()}</Text>
          {demoMode ? (
            <View style={styles.demoBanner}>
              <Text style={styles.demoTitle}>Modo demo</Text>
              <Text style={styles.demoText}>
                Este detalle se muestra desde la sesion actual y no se guarda en la base de datos.
              </Text>
            </View>
          ) : null}
        </View>

        {mixingInput ? (
          <>
            <MixingVisualizer input={mixingInput} />
            {curves ? (
              <DetailCard title="Comportamiento del sistema">
                <View style={styles.chartStack}>
                  <MiniLineChart
                    color={colors.primary}
                    maxLabel={curves.qLabel}
                    points={curves.qPoints}
                    subtitle="Cantidad de sal"
                    timeLabel={curves.timeLabel}
                    title="Q(t)"
                  />
                  <MiniLineChart
                    color={colors.accent}
                    maxLabel={curves.cLabel}
                    points={curves.cPoints}
                    subtitle="Concentracion"
                    timeLabel={curves.timeLabel}
                    title="C(t)"
                  />
                </View>
              </DetailCard>
            ) : null}
          </>
        ) : null}

        <DetailCard title="Planteamiento">
          <Text style={styles.bodyText}>{problem.prompt}</Text>
        </DetailCard>

        {problem.finalAnswer ? (
          <DetailCard title="Respuesta final">
            <Text style={styles.answerText}>{problem.finalAnswer}</Text>
          </DetailCard>
        ) : null}

        {problem.explanation ? (
          <DetailCard title="Interpretacion">
            <Text style={styles.bodyText}>{problem.explanation}</Text>
          </DetailCard>
        ) : null}

        <View style={[styles.summaryCard, summaryStyles.card]}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryEyebrow}>{learningSummary.eyebrow}</Text>
            <View style={[styles.summaryPill, summaryStyles.pill]}>
              <Text style={[styles.summaryPillText, summaryStyles.pillText]}>{learningSummary.focusValue}</Text>
            </View>
          </View>
          <Text style={styles.summaryTitle}>{learningSummary.keyIdea}</Text>
          <View style={styles.summaryDivider} />
          <Text style={styles.summarySectionTitle}>En resumen</Text>
          <Text style={styles.summaryText}>{learningSummary.summary}</Text>
          <Text style={styles.summarySectionTitle}>{learningSummary.focusLabel}</Text>
          <Text style={styles.summaryText}>
            {learningSummary.kind === "mixing"
              ? "Este problema se interpreta mejor pensando en balances: lo que entra, lo que sale y lo que queda dentro del tanque."
              : "Este tipo de problema se interpreta mejor identificando que cantidad cambia, que relacion la controla y que nos pide concluir."}
          </Text>
          <Text style={styles.summarySectionTitle}>Que debes recordar</Text>
          <Text style={styles.summaryText}>{learningSummary.remember}</Text>
        </View>

        <VoiceExperienceCard
          contextSummary={problem.finalAnswer || problem.prompt}
          demoMode={demoMode}
          problemId={problem.id}
          subtitle="Aqui vivira la futura explicacion hablada y la conversacion sobre este ejercicio."
          title="Asistente de voz para este problema"
        />

        <DetailCard title="Desarrollo paso a paso">
          {problem.steps?.length ? (
            <View style={styles.stepsBlock}>
              {problem.steps.map((step) => (
                <View key={step.id} style={styles.stepCard}>
                  <Text style={styles.stepTitle}>
                    Paso {step.stepNumber}: {step.title || "Desarrollo"}
                  </Text>
                  <Text style={styles.stepText}>{step.explanation}</Text>
                  {step.latex ? <Text style={styles.latexText}>{step.latex}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.bodyText}>Aun no hay pasos registrados para este ejercicio.</Text>
          )}
        </DetailCard>

        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver al historial</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  centered: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  heroHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primaryDark,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "capitalize"
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  demoBanner: {
    backgroundColor: "#fff5e9",
    borderColor: "#e7cfae",
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    marginTop: spacing.xs,
    padding: spacing.md
  },
  demoTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800"
  },
  demoText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
  },
  bodyText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 23
  },
  answerText: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24
  },
  summaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  summaryCardMixing: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft
  },
  summaryCardGeneric: {
    backgroundColor: "#f7f1e8",
    borderColor: "#d7c7b4"
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  summaryPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  summaryPillMixing: {
    backgroundColor: "#fff7ee",
    borderColor: "#dcc3a5"
  },
  summaryPillGeneric: {
    backgroundColor: "#fdf8f2",
    borderColor: "#d9cbbd"
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: "800"
  },
  summaryPillTextMixing: {
    color: colors.primaryDark
  },
  summaryPillTextGeneric: {
    color: colors.textSoft
  },
  summaryTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24
  },
  summaryDivider: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 1,
    marginVertical: 4
  },
  summarySectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  summaryText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21
  },
  visualCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  visualHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  visualTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
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
    fontSize: 14,
    fontWeight: "800"
  },
  visualStagePanel: {
    borderRadius: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  visualStage: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 170
  },
  flowCopy: {
    alignItems: "center",
    gap: 4,
    width: 62
  },
  flowLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  flowValue: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  pipeIn: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 10,
    marginRight: 8,
    width: 42
  },
  pipeOut: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 10,
    marginLeft: 8,
    width: 42
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
  chartStack: {
    gap: spacing.md
  },
  chartCard: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chartTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800"
  },
  chartSubtitle: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  chartMaxLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chartPlot: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 128,
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
  stepsBlock: {
    gap: spacing.sm
  },
  stepCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    gap: 6,
    padding: spacing.md
  },
  stepTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  stepText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21
  },
  latexText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    marginBottom: spacing.md,
    paddingVertical: 15
  },
  backButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800"
  }
});
