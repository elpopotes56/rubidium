import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { supabase } from "../lib/supabase";
import { useSoundEffects } from "../lib/soundEffects";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<null | string>(null);
  const { playButtonSound, playConfirmationSound } = useSoundEffects();

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert("Correo invalido", "Escribe un correo valido para recuperar tu contraseña.");
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      playButtonSound();

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

      if (error) {
        throw error;
      }

      playConfirmationSound();
      setFeedback("Te enviamos un enlace de recuperacion. Revisa tu correo y sigue los pasos indicados.");
    } catch (error) {
      Alert.alert(
        "No pudimos enviar el correo",
        error instanceof Error ? error.message : "Intenta de nuevo en un momento."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Recuperacion segura</Text>
              <Text style={styles.title}>Recupera tu acceso a Rubidium</Text>
              <Text style={styles.subtitle}>
                Escribe el correo con el que te registraste y te enviaremos un enlace para restablecer tu contraseña.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Correo</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={colors.primaryDark}
                keyboardAppearance="light"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="nombre@correo.com"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
              {feedback ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackTitle}>Correo enviado</Text>
                  <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
              ) : null}
              <Pressable disabled={loading} onPress={handleResetPassword} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{loading ? "Enviando..." : "Enviar enlace"}</Text>
              </Pressable>
              <Pressable
                disabled={loading}
                onPress={() => {
                  playButtonSound();
                  navigation.goBack();
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Volver a iniciar sesion</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  keyboardArea: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  label: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  input: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14
  },
  feedbackCard: {
    backgroundColor: "#f1f6ec",
    borderColor: "#c7d8b6",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md
  },
  feedbackTitle: {
    color: colors.success,
    fontSize: 15,
    fontWeight: "800"
  },
  feedbackText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "700"
  }
});
