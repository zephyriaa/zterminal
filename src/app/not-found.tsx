import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BackgroundField, CTAButton, TechnicalEyebrow } from "@/components/public/public-primitives";
import "@/components/public/public-theme.css";
import styles from "./not-found.module.css";
export default function NotFound(){return <main className={`${styles.page} publicScope`}><BackgroundField/><PublicHeader/><section><TechnicalEyebrow>404 / SIGNAL LOST</TechnicalEyebrow><h1>Nothing to<br/><em>interrogate here.</em></h1><p>The route is unavailable. Return to the market workspace or the public research overview.</p><div><CTAButton href="/">Back to overview</CTAButton><CTAButton href="/terminal" secondary>Open ZTerminal</CTAButton></div></section><PublicFooter/></main>}
