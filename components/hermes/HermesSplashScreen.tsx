"use client";

import Image from "next/image";
import iconImage from "@/assets/icon.jpg";
import { useAppVersion } from "@/lib/use-app-version";

interface HermesSplashScreenProps {
  leaving?: boolean;
}

export function HermesSplashScreen({ leaving = false }: HermesSplashScreenProps) {
  const version = useAppVersion();

  return (
    <div
      className={`fixed inset-0 z-[1300] grid place-items-center bg-bg transition-opacity duration-500 ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center text-center px-6">
        <Image
          src={iconImage}
          alt="Hermes Forge"
          className="w-28 h-28 rounded-3xl object-cover shadow-lg mb-8"
          width={112}
          height={112}
          priority
        />
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-[0.22em] uppercase text-text-strong">
          Hermes Forge
        </h1>
        <p className="mt-4 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.35em] text-text-muted tabular-nums">
          v{version}
        </p>
      </div>
    </div>
  );
}