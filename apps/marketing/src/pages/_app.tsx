import type { AppProps } from "next/app";
import { DM_Sans } from "next/font/google";
import "../styles/globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-dm-sans",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={dmSans.variable}>
      <Component {...pageProps} />
    </div>
  );
}
