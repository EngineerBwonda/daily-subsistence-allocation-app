// app/(auth)/member/login/page.tsx
"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  FileText,
  Users,
  MessageSquare,
  AlertCircle,
  LogIn,
  BadgeCheck,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

interface FormState {
  email: string;
  password: string;
  remember: boolean;
}

type FormErrors = Partial<Record<"email" | "password", string>>;

export default function MemberLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "email" || name === "password") {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError("");
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.email.trim()) next.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Please enter a valid email address";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate() || isLoading) return;

    setIsLoading(true);
    setServerError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (error) {
        setServerError(
          error.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : error.message,
        );
        return;
      }

      if (!data.user) {
        setServerError("Unable to sign in. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("member_profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile lookup failed:", profileError);
        setServerError("Could not verify your account. Please try again.");
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setServerError(
          "Your account has no profile record. Please contact an administrator.",
        );
        return;
      }

      router.replace("/member/profile");
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      {/* LEFT INFORMATION PANEL */}
      <section className={styles.visualSection}>
        <div className={styles.visualOverlay} />

        <div className={styles.visualContent}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>S</div>
            <div>
              <strong>SENATE DIGAC</strong>
              <span>DSA MANAGEMENT SYSTEM</span>
            </div>
          </Link>

          <motion.div
            className={styles.heroContent}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.badge}>
              <BadgeCheck size={15} />
              Member Portal
            </div>

            <h1>
              Welcome back,
              <span> Honourable Member.</span>
            </h1>

            <p>
              Sign in to submit Daily Subsistence Allowance claims for chamber
              sittings, committee meetings, and nights attended. Track your
              claims through review and approval in real time.
            </p>

            <div className={styles.benefits}>
              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <FileText size={18} />
                </div>
                <div>
                  <strong>Submit Claims Digitally</strong>
                  <span>
                    Chamber, committee, and sitting claims in one place.
                  </span>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <Users size={18} />
                </div>
                <div>
                  <strong>Track Every Claim</strong>
                  <span>See real-time status from review to approval.</span>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <strong>Instant Notifications</strong>
                  <span>Get notified at each stage of the workflow.</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className={styles.bottomMessage}>
            <span />
            <p>Claim. Track. Get Paid.</p>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className={styles.formSection}>
        <div className={styles.formContainer}>
          <Link href="/" className={styles.mobileLogo}>
            <div className={styles.logoMark}>S</div>
            <div>
              <strong>SENATE DIGAC</strong>
              <span>DSA MANAGEMENT</span>
            </div>
          </Link>

          <div className={styles.brandLogoWrap}>
            <img
              src="/senatelogo-removebg-preview.png"
              alt="Senate Liaison logo"
              className={styles.brandLogo}
            />
          </div>

          <motion.div
            className={styles.formHeader}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className={styles.formEyebrow}>Member Login</span>
            <h2>Sign in to your member account</h2>
            <p>Access your DSA claims dashboard.</p>
          </motion.div>

          {serverError && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <motion.form
            onSubmit={handleSubmit}
            className={styles.form}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            noValidate
          >
            {/* EMAIL */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address</label>
              <div
                className={`${styles.inputWrapper} ${
                  errors.email ? styles.inputError : ""
                }`}
              >
                <Mail size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@senate.go.ke"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <p className={styles.errorMessage}>{errors.email}</p>
              )}
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <div
                className={`${styles.inputWrapper} ${
                  errors.password ? styles.inputError : ""
                }`}
              >
                <Lock size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className={styles.errorMessage}>{errors.password}</p>
              )}
            </div>

            {/* REMEMBER + FORGOT */}
            <div className={styles.formOptions}>
              <label className={styles.rememberCheck}>
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </motion.form>

          <div className={styles.loginPrompt}>
            <span>Don&apos;t have a member account?</span>
            <Link href="/member/register">Register as a Member</Link>
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={15} />
            <span>All member activity is monitored for security purposes.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
