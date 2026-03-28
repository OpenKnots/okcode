import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.openknots.okcode.mobile",
  appName: "OK Code",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
