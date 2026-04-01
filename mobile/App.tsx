import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ConversationProvider } from "@elevenlabs/react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ProblemDetailScreen } from "./src/screens/ProblemDetailScreen";
import { colors } from "./src/theme/colors";
import type { RootStackParamList } from "./src/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();
const elevenLabsAgentId = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID;

function IntroScreen() {
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.timing(textOpacity, {
        delay: 220,
        duration: 480,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(logoScale, {
        damping: 14,
        mass: 0.9,
        stiffness: 120,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();
  }, [logoOpacity, logoScale, textOpacity]);

  return (
    <View style={styles.introScreen}>
      <Animated.Image
        source={require("./assets/rubidium-mark.png")}
        style={[
          styles.introLogo,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }]
          }
        ]}
      />
      <Animated.View style={{ opacity: textOpacity }}>
        <Text style={styles.introBrand}>Rubidium</Text>
        <Text style={styles.introTagline}>Matematicas dinamicas con paz, claridad y naturaleza</Text>
      </Animated.View>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 1650);

    return () => clearTimeout(timer);
  }, []);

  if (showIntro) {
    return (
      <>
        <StatusBar style="dark" />
        <IntroScreen />
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const appTree = (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
        {session ? (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false, title: "Rubidium" }}
              initialParams={{ session }}
            />
            <Stack.Screen
              name="ProblemDetail"
              component={ProblemDetailScreen}
              options={{ title: "Detalle de solucion" }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false, title: "Acceso" }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: "Recuperar acceso" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );

  if (elevenLabsAgentId) {
    return <ConversationProvider agentId={elevenLabsAgentId}>{appTree}</ConversationProvider>;
  }

  return appTree;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  introScreen: {
    alignItems: "center",
    backgroundColor: colors.white,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32
  },
  introLogo: {
    height: 120,
    marginBottom: 18,
    resizeMode: "contain",
    width: 120
  },
  introBrand: {
    color: colors.primaryDark,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "center"
  },
  introTagline: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center"
  }
});
