import { Suspense } from "react";
import { GatewayConnectingOverlay } from "@/components/hermes/GatewayConnectingOverlay";
import { HermesStartupScreen } from "@/components/hermes/HermesStartupScreen";

/** App entry — connect to local Hermes Agent, then continue to the studio. */
export default function WelcomePage() {
  return (
    <Suspense fallback={<GatewayConnectingOverlay />}>
      <HermesStartupScreen />
    </Suspense>
  );
}
