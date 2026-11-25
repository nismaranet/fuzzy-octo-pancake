"use client";

import React, { useState, useEffect, useCallback } from "react";
import WinterGarland from "./WinterGarland";
import WinterCornerSprigs from "./WinterCornerSprigs";
import WinterSnowCanvas from "./WinterSnowCanvas";
import NewYearFireworksCanvas from "./NewYearFireworksCanvas";
import WinterDispatchWidget from "./WinterDispatchWidget";
import FlyingSantaSleigh, { type SantaStatus } from "./FlyingSantaSleigh";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { unlockHolidayAudio } from "@/lib/holidaySound";

const SNOW_STORAGE_KEY = "nismara_holiday_snow_v1";
const SOUND_STORAGE_KEY = "nismara_holiday_sound_v1";

export default function ChristmasNewYearDecorations({
  enabled = false,
}: {
  enabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fireworksSignal, setFireworksSignal] = useState(0);
  const [fireworksRunning, setFireworksRunning] = useState(false);
  const [summonSantaSignal, setSummonSantaSignal] = useState(0);
  const [santaStatus, setSantaStatus] = useState<SantaStatus>({
    loaded: false,
    active: false,
    inClaimWindow: false,
    isLoggedIn: false,
    isDriver: false,
    eligible: false,
    claimedToday: false,
  });

  useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem(SNOW_STORAGE_KEY) === "0") setSnowEnabled(false);
      if (window.localStorage.getItem(SOUND_STORAGE_KEY) === "0") setSoundEnabled(false);
    } catch {
      // Abaikan jika storage tidak tersedia
    }
  }, []);

  useEffect(() => {
    if (!mounted || !enabled) return;
    let cancelled = false;
    fetch("/api/holiday/santa-claim", { ...NO_CACHE_FETCH_OPTIONS })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setSantaStatus({
            loaded: true,
            active: Boolean(data.active),
            inClaimWindow: Boolean(data.inClaimWindow),
            isLoggedIn: Boolean(data.isLoggedIn),
            isDriver: Boolean(data.isDriver),
            eligible: Boolean(data.eligible),
            claimedToday: Boolean(data.claimedToday),
            todayWib: data.todayWib,
            lastRewardLabel: data.lastRewardLabel || null,
          });
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [mounted, enabled]);

  const handleToggleSnow = useCallback(() => {
    setSnowEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SNOW_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Abaikan
      }
      return next;
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    unlockHolidayAudio();
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Abaikan
      }
      return next;
    });
  }, []);

  const handleTriggerFireworks = useCallback(() => {
    unlockHolidayAudio();
    setFireworksRunning(true);
    setFireworksSignal((prev) => prev + 1);
  }, []);

  const handleFireworksComplete = useCallback(() => {
    setFireworksRunning(false);
  }, []);

  const handleSantaStatusChange = useCallback((patch: Partial<SantaStatus>) => {
    setSantaStatus((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSummonSanta = useCallback(() => {
    unlockHolidayAudio();
    setSummonSantaSignal((prev) => prev + 1);
  }, []);

  if (!mounted || !enabled) {
    return null;
  }

  return (
    <>
      <WinterGarland />
      <WinterCornerSprigs onTriggerFireworks={handleTriggerFireworks} />
      <WinterSnowCanvas active={snowEnabled} />
      {santaStatus.loaded && santaStatus.inClaimWindow && (
        <FlyingSantaSleigh
          status={santaStatus}
          summonSignal={summonSantaSignal}
          soundEnabled={soundEnabled}
          onStatusChange={handleSantaStatusChange}
          onTriggerFireworks={handleTriggerFireworks}
        />
      )}
      <NewYearFireworksCanvas
        burstSignal={fireworksSignal}
        soundEnabled={soundEnabled}
        onComplete={handleFireworksComplete}
      />
      <WinterDispatchWidget
        snowEnabled={snowEnabled}
        onToggleSnow={handleToggleSnow}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        fireworksRunning={fireworksRunning}
        onTriggerFireworks={handleTriggerFireworks}
        santaStatus={santaStatus}
        onSummonSanta={handleSummonSanta}
      />
    </>
  );
}
