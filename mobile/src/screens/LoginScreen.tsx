import { memo, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordStrength(password: string) {
  if (password.length >= 10) return { label: "Segura", color: colors.success };
  if (password.length >= 6) return { label: "Media", color: colors.accent };
  if (password.length > 0) return { label: "Corta", color: colors.primary };
  return null;
}

const AuthHero = memo(function AuthHero({ mode }: { mode: "login" | "register" }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <Image source={require("../../assets/rubidium-mark.png")} style={styles.heroIcon} />
      <Text style={styles.brand}>Rubidium</Text>
      <Text style={styles.eyebrow}>Matematicas dinamicas con calma y claridad</Text>
      <Text style={styles.title}>
        {mode === "login"
          ? "Entra para resolver sistemas de mezcla y guardar tu proceso paso a paso"
          : "Crea tu cuenta para guardar historial, soluciones y futuras explicaciones por voz"}
      </Text>
    </View>
  );
});

const AuthModeSwitch = memo(function AuthModeSwitch({
  mode,
  onChange
}: {
  mode: "login" | "register";
  onChange: (mode: "login" | "register") => void;
}) {
  const [switchWidth, setSwitchWidth] = useState(0);
  const indicatorPosition = useRef(new Animated.Value(mode === "login" ? 0 : 1)).current;
  const textFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(indicatorPosition, {
        damping: 16,
        mass: 0.8,
        stiffness: 180,
        toValue: mode === "login" ? 0 : 1,
        useNativeDriver: true
      }),
      Animated.sequence([
        Animated.timing(textFade, {
          duration: 90,
          toValue: 0.82,
          useNativeDriver: true
        }),
        Animated.timing(textFade, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, [indicatorPosition, mode, textFade]);

  const chipWidth = switchWidth > 0 ? (switchWidth - 12 - spacing.xs) / 2 : 0;
  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, chipWidth + spacing.xs]
  });

  return (
    <View onLayout={(event) => setSwitchWidth(event.nativeEvent.layout.width)} style={styles.modeSwitch}>
      <Animated.View
        style={[
          styles.modeIndicator,
          {
            width: chipWidth,
            transform: [{ translateX }]
          }
        ]}
      />
      <Pressable onPress={() => onChange("login")} style={styles.modeChip}>
        <Animated.Text
          style={[
            styles.modeChipText,
            mode === "login" && styles.modeChipTextActive,
            { opacity: textFade }
          ]}
        >
          Iniciar sesion
        </Animated.Text>
      </Pressable>
      <Pressable onPress={() => onChange("register")} style={styles.modeChip}>
        <Animated.Text
          style={[
            styles.modeChipText,
            mode === "register" && styles.modeChipTextActive,
            { opacity: textFade }
          ]}
        >
          Registrate
        </Animated.Text>
      </Pressable>
    </View>
  );
});

const PasswordField = memo(function PasswordField({
  label,
  placeholder,
  value,
  onChangeText,
  visible,
  onToggleVisibility,
  autoComplete,
  inputRef,
  onSubmitEditing
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete?: "off" | "password" | "new-password";
  inputRef?: React.RefObject<TextInput | null>;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        importantForAutofill={Platform.OS === "android" ? "noExcludeDescendants" : "auto"}
        onTouchStart={() => inputRef?.current?.focus()}
        style={styles.passwordField}
      >
        <TextInput
          autoComplete={Platform.OS === "android" ? "off" : autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          cursorColor={colors.primaryDark}
          disableFullscreenUI
          importantForAutofill={Platform.OS === "android" ? "no" : "auto"}
          keyboardAppearance="light"
          multiline={false}
          onSubmitEditing={onSubmitEditing}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          ref={inputRef}
          returnKeyType="done"
          secureTextEntry={!visible}
          showSoftInputOnFocus
          selectionColor={colors.primary}
          spellCheck={false}
          style={styles.passwordInput}
          textContentType={Platform.OS === "ios" ? "password" : "none"}
          underlineColorAndroid="transparent"
          value={value}
        />
        <Pressable onPress={onToggleVisibility} style={styles.visibilityButton}>
          <Text style={styles.visibilityText}>{visible ? "Ocultar" : "Ver"}</Text>
        </Pressable>
      </View>
    </View>
  );
});

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [feedbackCard, setFeedbackCard] = useState<null | { title: string; message: string }>(null);
  const { playButtonSound, playConfirmationSound } = useSoundEffects();
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(18)).current;
  const emailInputRef = useRef<TextInput | null>(null);
  const passwordInputRef = useRef<TextInput | null>(null);
  const confirmPasswordInputRef = useRef<TextInput | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const emailTouched = email.length > 0;
  const emailValid = isValidEmail(normalizedEmail);
  const passwordStrength = getPasswordStrength(password);
  const confirmMatches = confirmPassword.length > 0 && confirmPassword === password;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, {
        duration: 360,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.timing(formTranslateY, {
        duration: 420,
        toValue: 0,
        useNativeDriver: true
      })
    ]).start();
  }, [formOpacity, formTranslateY]);

  function getFriendlyAuthMessage(error: unknown, currentMode: "login" | "register") {
    if (!(error instanceof Error)) {
      return "Algo salio mal. Intenta de nuevo en un momento.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials")) {
      return "El correo o la contraseña no coinciden.";
    }

    if (message.includes("email rate limit exceeded")) {
      return "Se enviaron demasiados correos en poco tiempo. Espera un poco e intenta de nuevo.";
    }

    if (message.includes("user already registered")) {
      return "Ese correo ya esta registrado. Prueba iniciando sesion.";
    }

    if (message.includes("network request failed")) {
      return "No pudimos conectarnos. Revisa tu internet o intenta de nuevo.";
    }

    if (message.includes("password should be at least")) {
      return "La contraseña es demasiado corta. Usa al menos 6 caracteres.";
    }

    return currentMode === "login"
      ? "No pudimos iniciar sesion. Intenta de nuevo."
      : "No pudimos crear tu cuenta. Intenta de nuevo.";
  }

  async function handleDemoAccess() {
    const demoEmail = process.env.EXPO_PUBLIC_DEMO_EMAIL;
    const demoPassword = process.env.EXPO_PUBLIC_DEMO_PASSWORD;

    if (!demoEmail || !demoPassword) {
      Alert.alert("Demo no disponible", "El acceso demo no esta configurado en esta version.");
      return;
    }

    try {
      setLoading(true);
      setFeedbackCard({
        title: "Entrando al demo",
        message: "Estamos preparando una sesion de demostracion para que explores Rubidium."
      });
      playButtonSound();

      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      Alert.alert("No pudimos abrir el demo", getFriendlyAuthMessage(error, "login"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!normalizedEmail || !password) {
      Alert.alert("Faltan datos", "Completa tu correo y contraseña.");
      return;
    }

    if (!emailValid) {
      Alert.alert("Correo invalido", "Escribe un correo con formato valido.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      Alert.alert("Contraseñas distintas", "La confirmacion de contraseña no coincide.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      Alert.alert("Contraseña corta", "Usa una contraseña de al menos 6 caracteres.");
      return;
    }

    try {
      setLoading(true);
      setFeedbackCard(null);
      playButtonSound();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password
        });

        if (error) {
          throw error;
        }

        playConfirmationSound();
        setFeedbackCard({
          title: "Cuenta creada",
          message: "Te enviamos un correo para confirmar tu cuenta. Despues podras iniciar sesion con normalidad."
        });
        setMode("login");
        setConfirmPassword("");
        setPassword("");
      }
    } catch (error) {
      Alert.alert(
        mode === "login" ? "No se pudo iniciar sesion" : "No se pudo crear la cuenta",
        getFriendlyAuthMessage(error, mode)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      importantForAutofill={Platform.OS === "android" ? "noExcludeDescendants" : "auto"}
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <AuthHero mode={mode} />
            <Animated.View
              style={[
                styles.formCard,
                {
                  opacity: formOpacity,
                  transform: [{ translateY: formTranslateY }]
                }
              ]}
            >
              <AuthModeSwitch
                mode={mode}
                onChange={(nextMode) => {
                  playButtonSound();
                  setFeedbackCard(null);
                  setMode(nextMode);
                  setConfirmPassword("");
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
              />
              {feedbackCard ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackTitle}>{feedbackCard.title}</Text>
                  <Text style={styles.feedbackMessage}>{feedbackCard.message}</Text>
                </View>
              ) : null}
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, emailFocused && styles.fieldLabelFocused]}>Correo</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={Platform.OS === "android" ? "off" : "email"}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  cursorColor={colors.primaryDark}
                  disableFullscreenUI
                  importantForAutofill={Platform.OS === "android" ? "no" : "auto"}
                  keyboardAppearance="light"
                  keyboardType="email-address"
                  onBlur={() => setEmailFocused(false)}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  placeholder="nombre@correo.com"
                  placeholderTextColor={colors.textMuted}
                  ref={emailInputRef}
                  returnKeyType="next"
                  selectionColor={colors.primary}
                  showSoftInputOnFocus
                  spellCheck={false}
                  style={[
                    styles.input,
                    emailFocused ? styles.fieldFocused : null,
                    emailTouched && !emailValid ? styles.inputError : null,
                    emailTouched && emailValid ? styles.inputSuccess : null
                  ]}
                  textContentType={Platform.OS === "ios" ? "emailAddress" : "none"}
                  underlineColorAndroid="transparent"
                  value={email}
                />
                {emailTouched ? (
                  <Text style={[styles.validationText, emailValid ? styles.validationSuccess : styles.validationError]}>
                    {emailValid ? "Correo valido" : "Escribe un correo con formato valido"}
                  </Text>
                ) : null}
              </View>
              <PasswordField
                autoComplete="off"
                inputRef={passwordInputRef}
                label="Contraseña"
                onChangeText={setPassword}
                onToggleVisibility={() => {
                  playButtonSound();
                  setShowPassword((current) => !current);
                }}
                onSubmitEditing={() =>
                  mode === "register"
                    ? confirmPasswordInputRef.current?.focus()
                    : passwordInputRef.current?.blur()
                }
                placeholder="Escribe tu contraseña"
                value={password}
                visible={showPassword}
              />
              {passwordStrength ? (
                <View style={styles.validationRow}>
                  <View style={[styles.strengthDot, { backgroundColor: passwordStrength.color }]} />
                  <Text style={[styles.validationText, { color: passwordStrength.color }]}>
                    Seguridad de contraseña: {passwordStrength.label}
                  </Text>
                </View>
              ) : null}
              {mode === "register" ? (
                <>
                  <PasswordField
                    autoComplete="off"
                    inputRef={confirmPasswordInputRef}
                    label="Confirmar contraseña"
                    onChangeText={setConfirmPassword}
                    onToggleVisibility={() => {
                      playButtonSound();
                      setShowConfirmPassword((current) => !current);
                    }}
                    onSubmitEditing={() => confirmPasswordInputRef.current?.blur()}
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    visible={showConfirmPassword}
                  />
                  {confirmPassword.length > 0 ? (
                    <Text style={[styles.validationText, confirmMatches ? styles.validationSuccess : styles.validationError]}>
                      {confirmMatches ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Text style={styles.helperText}>
                {mode === "login"
                  ? "Accede a tu historial, tus soluciones y tus futuras sesiones de voz."
                  : "Te enviaremos un correo para confirmar tu cuenta antes de entrar."}
              </Text>
              <Pressable disabled={loading} onPress={handleSubmit} style={styles.button}>
                <Text style={styles.buttonText}>
                  {loading
                    ? mode === "login"
                      ? "Entrando..."
                      : "Creando cuenta..."
                    : mode === "login"
                      ? "Entrar a Rubidium"
                      : "Crear mi cuenta"}
                </Text>
              </Pressable>
              {mode === "login" ? (
                <Pressable disabled={loading} onPress={handleDemoAccess} style={styles.demoButton}>
                  <Text style={styles.demoButtonText}>Entrar como demo</Text>
                </Pressable>
              ) : null}
              {mode === "login" ? (
                <Pressable
                  disabled={loading}
                  onPress={() => {
                    playButtonSound();
                    navigation.navigate("ForgotPassword");
                  }}
                  style={styles.ghostButton}
                >
                  <Text style={styles.ghostButtonText}>Olvide mi contraseña</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={loading}
                onPress={() => {
                  playButtonSound();
                  setFeedbackCard(null);
                  setMode((current) => (current === "login" ? "register" : "login"));
                  setConfirmPassword("");
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                style={styles.switchButton}
              >
                <Text style={styles.switchText}>
                  {mode === "login"
                    ? "No tienes cuenta? Registrate"
                    : "Ya tienes cuenta? Inicia sesion"}
                </Text>
              </Pressable>
              <View style={styles.privacyBlock}>
                <Text style={styles.privacyText}>
                  Al continuar aceptas el uso educativo de Rubidium y el manejo seguro de tu cuenta mediante Supabase
                  Auth.
                </Text>
                <View style={styles.privacyLinks}>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "Privacidad",
                        "Rubidium usa Supabase Auth para gestionar el acceso. La app no guarda contraseñas en texto plano dentro de sus propias tablas."
                      )
                    }
                  >
                    <Text style={styles.privacyLinkText}>Privacidad</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "Uso",
                        "Esta aplicacion esta pensada para fines educativos y de demostracion del modelo de mezcla dinamica."
                      )
                    }
                  >
                    <Text style={styles.privacyLinkText}>Uso educativo</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
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
    marginBottom: spacing.sm,
    overflow: "hidden",
    padding: spacing.xl
  },
  heroGlow: {
    backgroundColor: colors.primarySoft,
    borderRadius: 120,
    height: 140,
    opacity: 0.3,
    position: "absolute",
    right: -20,
    top: -30,
    width: 140
  },
  brand: {
    color: colors.primaryDark,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  heroIcon: {
    height: 74,
    marginBottom: spacing.xs,
    resizeMode: "contain",
    width: 74
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
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 34
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  modeSwitch: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 18,
    flexDirection: "row",
    gap: spacing.xs,
    overflow: "hidden",
    padding: 6,
    position: "relative"
  },
  modeIndicator: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    bottom: 6,
    left: 6,
    position: "absolute",
    top: 6
  },
  modeChip: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    zIndex: 1,
    paddingVertical: 12
  },
  modeChipText: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "700"
  },
  modeChipTextActive: {
    color: colors.primaryDark
  },
  fieldBlock: {
    gap: spacing.xs
  },
  fieldLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  fieldLabelFocused: {
    color: colors.primaryDark
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
  fieldFocused: {
    borderColor: colors.primaryDark,
    shadowColor: "#6f442d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  inputError: {
    borderColor: colors.primary
  },
  inputSuccess: {
    borderColor: colors.success
  },
  passwordField: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    paddingLeft: spacing.md
  },
  passwordInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingVertical: 14
  },
  visibilityButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14
  },
  visibilityText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "700"
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  validationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: -4
  },
  validationText: {
    fontSize: 12,
    fontWeight: "600"
  },
  validationSuccess: {
    color: colors.success
  },
  validationError: {
    color: colors.primary
  },
  strengthDot: {
    borderRadius: 99,
    height: 8,
    width: 8
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
  feedbackMessage: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700"
  },
  ghostButton: {
    alignItems: "center",
    paddingTop: 4
  },
  ghostButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "700"
  },
  demoButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primarySoft,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14
  },
  demoButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  switchText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "600"
  },
  privacyBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.md
  },
  privacyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  privacyLinks: {
    flexDirection: "row",
    gap: spacing.md
  },
  privacyLinkText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700"
  }
});
