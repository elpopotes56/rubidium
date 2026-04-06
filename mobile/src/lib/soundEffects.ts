import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";

const buttonSource = require("../../assets/button-tap.mp3");
const confirmationSource = require("../../assets/confirmation.mp3");

const BUTTON_CLIP_MS = 180;
const CONFIRMATION_CLIP_MS = 520;

export function useSoundEffects() {
  const buttonPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const confirmationPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const buttonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      interruptionMode: "mixWithOthers",
      playsInSilentMode: true,
      shouldPlayInBackground: false
    }).catch(() => undefined);

    const buttonPlayer = createAudioPlayer(buttonSource);
    const confirmationPlayer = createAudioPlayer(confirmationSource);

    buttonPlayer.volume = 0.55;
    confirmationPlayer.volume = 0.75;

    buttonPlayerRef.current = buttonPlayer;
    confirmationPlayerRef.current = confirmationPlayer;

    return () => {
      if (buttonTimerRef.current) {
        clearTimeout(buttonTimerRef.current);
      }

      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }

      buttonPlayer.pause();
      confirmationPlayer.pause();
      buttonPlayer.remove();
      confirmationPlayer.remove();
    };
  }, []);

  const playButtonSound = useCallback(() => {
    const player = buttonPlayerRef.current;

    if (!player) {
      return;
    }

    if (buttonTimerRef.current) {
      clearTimeout(buttonTimerRef.current);
    }

    player.pause();
    player.seekTo(0).catch(() => undefined);
    player.play();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    buttonTimerRef.current = setTimeout(() => {
      player.pause();
      player.seekTo(0).catch(() => undefined);
    }, BUTTON_CLIP_MS);
  }, []);

  const playConfirmationSound = useCallback(() => {
    const player = confirmationPlayerRef.current;

    if (!player) {
      return;
    }

    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
    }

    player.pause();
    player.seekTo(0).catch(() => undefined);
    player.play();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    confirmationTimerRef.current = setTimeout(() => {
      player.pause();
      player.seekTo(0).catch(() => undefined);
    }, CONFIRMATION_CLIP_MS);
  }, []);

  return {
    playButtonSound,
    playConfirmationSound
  };
}
