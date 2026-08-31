import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignUpPage() {
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">●</div><p className="eyebrow">CAPTURE / PRIVATE RECORDING</p><h1>Make space for the work.</h1><p className="lede">Set up a private workspace for bug reproductions, demos, and async updates.</p><p className="billing-note">Cancel anytime. Test charges stay under $0.05.</p><AuthForm mode="signup" /><p className="switch-copy">Already have an account? <Link href="/sign-in">Sign in</Link></p></section></main>;
}
