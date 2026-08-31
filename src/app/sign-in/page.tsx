import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">●</div><p className="eyebrow">CAPTURE / PRIVATE RECORDING</p><h1>Record with confidence.</h1><p className="lede">Your video goes straight to a folder you choose. Capture keeps only the lightweight details that help you find it again.</p><AuthForm mode="signin" /><p className="switch-copy">New to Capture? <Link href="/sign-up">Create an account</Link></p></section></main>;
}
