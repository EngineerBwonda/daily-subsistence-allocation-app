// app/(auth)/member/register/page.tsx
"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  FileText,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

export default function MemberRegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validate = (): boolean => {
    if (!formData.fullName.trim()) {
      setError("Full name is required.");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email address is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    if (!formData.terms) {
      setError("Please accept the terms and conditions.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) return;

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/member/login`,
          data: {
            profile_type: "member",
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            position: formData.position.trim(),
            role: "member",
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError(
            "An account with this email already exists. Please sign in.",
          );
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError("Unable to create account. Please try again.");
        return;
      }

      setSuccess(
        "Your member account has been created successfully. Redirecting you to sign in...",
      );

      setTimeout(() => {
        router.replace("/member/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
              <strong>SENATE LIAISON</strong>
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
              Member Registration
            </div>

            <h1>
              Submit your DSA claims,
              <span> from anywhere.</span>
            </h1>

            <p>
              Register as a Member or MP to submit Daily Subsistence Allowance
              claims for chamber sittings, committee meetings, and nights
              attended. Track every claim from submission to approval.
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

          <motion.div
            className={styles.formHeader}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className={styles.formEyebrow}>Member Registration</span>
            <h2>Create your member account</h2>
            <p>
              Register to submit and track your Daily Subsistence Allowance
              claims. All registrations are reviewed before access is granted.
            </p>
          </motion.div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successAlert} role="alert">
              <CheckCircle2 size={16} />
              <div>
                <strong>Registration submitted!</strong>
                <p>{success}</p>
              </div>
            </div>
          )}

          <motion.form
            onSubmit={handleSubmit}
            className={styles.form}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* FULL NAME */}
            <div className={styles.inputGroup}>
              <label htmlFor="fullName">Full name *</label>
              <div className={styles.inputWrapper}>
                <User size={18} />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Hon. Jane Kamau"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* EMAIL */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address *</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@senate.go.ke"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* PHONE */}
            <div className={styles.inputGroup}>
              <label htmlFor="phone">Phone number</label>
              <div className={styles.inputWrapper}>
                <Phone size={18} />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* POSITION */}
            <div className={styles.inputGroup}>
              <label htmlFor="position">Position </label>
              <div className={styles.inputWrapper}>
                <Briefcase size={18} />
                <input
                  id="position"
                  name="position"
                  type="text"
                  placeholder="Senator, Nairobi County"
                  value={formData.position}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirm password *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* TERMS */}
            <label className={styles.termsCheck}>
              <input
                type="checkbox"
                name="terms"
                checked={formData.terms}
                onChange={handleChange}
              />
              <span>
                I agree to the Senate Liaison Office&apos;s terms and privacy
                policy.
              </span>
            </label>

            {/* BUTTON */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Creating account...
                </>
              ) : (
                <>
                  Request member access
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </motion.form>

          <div className={styles.loginPrompt}>
            <span>Already have an account?</span>
            <Link href="/member/login">Sign in</Link>
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={15} />
            <span>
              Member accounts are verified before claim submission is enabled.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
