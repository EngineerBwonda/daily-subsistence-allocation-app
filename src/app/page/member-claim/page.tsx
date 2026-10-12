"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardCheck,
  Landmark,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

type StaffDetails = {
  name: string;
  email: string;
  phone: string;
  role: string;
  canReviewClaims: boolean;
  initials: string;
};

const roleLabels: Record<string, string> = {
  member: "Member",
  secretary: "Secretary",
  director: "Director",
};

function getMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StaffProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [staff, setStaff] = useState<StaffDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadStaff() {
      const { data, error } = await supabase.auth.getUser();

      if (!isActive) return;

      if (error) {
        console.error("Could not load the signed-in user:", error);
        setMessage(
          "We could not load your account. Please try signing in again.",
        );
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        router.replace("/staff/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!isActive) return;

      if (profileError) {
        console.error("Staff profile lookup failed:", profileError);
        setMessage("We could not load your staff profile. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!profile) {
        setMessage("This account does not have a staff profile.");
        setIsLoading(false);
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      const name = getMetadataText(metadata, "full_name") || "Staff member";
      const role = profile.role;

      setStaff({
        name,
        email: data.user.email ?? "",
        phone: getMetadataText(metadata, "phone"),
        role,
        canReviewClaims: role === "secretary",
        initials: getInitials(name) || "S",
      });
      setIsLoading(false);
    }

    void loadStaff();

    return () => {
      isActive = false;
    };
  }, [router, supabase]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Could not sign out:", error);
      setMessage("We could not sign you out. Please try again.");
      setIsSigningOut(false);
      return;
    }

    router.replace("/staff/login");
  }

  return (
    <div className={styles.app}>
      {/* ===== Top bar ===== */}
      <header className={styles.topbar}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Senate Liaison home"
        >
          <span className={styles.brandMark}>
            <Landmark size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.brandText}>
            <strong>Senate Liaison</strong>
            <span>DSA management system</span>
          </span>
        </Link>

        <button
          className={`${styles.ghostBtn} ${styles.dangerHover}`}
          type="button"
          aria-label="Sign out"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut size={15} />
          <span className={styles.btnLabel}>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </span>
        </button>
      </header>

      <main className={styles.shell}>
        <div className={styles.pageHead}>
          <h1>Your profile</h1>
          <p>
            Welcome to your DSA account. Review the details associated with your
            staff profile.
          </p>
        </div>

        {message && (
          <p className={styles.alert} role="alert">
            <TriangleAlert size={16} />
            {message}
          </p>
        )}

        {isLoading ? (
          <div className={styles.layout} aria-live="polite" aria-busy="true">
            <span className={styles.srOnly}>Loading your profile...</span>
            <span className={`${styles.skel} ${styles.skelMain}`} />
            <span className={`${styles.skel} ${styles.skelSide}`} />
          </div>
        ) : (
          staff && (
            <div className={styles.layout} aria-label="Staff profile">
              <div className={styles.mainCol}>
                {/* ----- Workflow shortcuts ----- */}
                {(staff.canReviewClaims || staff.role === "director") && (
                  <section
                    className={styles.workflow}
                    aria-labelledby="workflow-title"
                  >
                    <h2 id="workflow-title">Your workflow</h2>
                    <div className={styles.workflowGrid}>
                      {staff.canReviewClaims && (
                        <Link
                          href="/claim-review"
                          className={`${styles.workflowCard} ${styles.workflowFocus}`}
                        >
                          <span className={styles.workflowIcon}>
                            <ClipboardCheck size={20} />
                          </span>
                          <span className={styles.workflowText}>
                            <strong>Review member claims</strong>
                            <span>
                              Check submitted claims and forward them to the
                              Director.
                            </span>
                          </span>
                          <ArrowUpRight size={18} />
                        </Link>
                      )}
                      {staff.role === "director" && (
                        <Link
                          href="/director/claims"
                          className={`${styles.workflowCard} ${styles.workflowFocus}`}
                        >
                          <span className={styles.workflowIcon}>
                            <ShieldCheck size={20} />
                          </span>
                          <span className={styles.workflowText}>
                            <strong>Review forwarded claims</strong>
                            <span>
                              Record the final decision on claims sent by the
                              Secretary.
                            </span>
                          </span>
                          <ArrowUpRight size={18} />
                        </Link>
                      )}
                    </div>
                  </section>
                )}

                {/* ----- Account details ----- */}
                <section className={styles.panel}>
                  <div className={styles.cardHeading}>
                    <span className={styles.headingIcon}>
                      <UserRound size={18} />
                    </span>
                    <div>
                      <h2>Account details</h2>
                      <p>Information associated with your staff account</p>
                    </div>
                  </div>

                  <dl className={styles.detailsList}>
                    <div className={styles.detail}>
                      <dt>
                        <UserRound size={16} />
                        Full name
                      </dt>
                      <dd>{staff.name}</dd>
                    </div>
                    <div className={styles.detail}>
                      <dt>
                        <Mail size={16} />
                        Email address
                      </dt>
                      <dd>{staff.email || "Not provided"}</dd>
                    </div>
                    <div className={styles.detail}>
                      <dt>
                        <Phone size={16} />
                        Phone number
                      </dt>
                      <dd>{staff.phone || "Not provided"}</dd>
                    </div>
                    <div className={styles.detail}>
                      <dt>
                        <BriefcaseBusiness size={16} />
                        Role
                      </dt>
                      <dd>{roleLabels[staff.role] ?? "Staff"}</dd>
                    </div>
                  </dl>

                  <p className={styles.detailsFootnote}>
                    Need to update your account information? Contact your
                    administrator for assistance.
                  </p>
                </section>
              </div>

              {/* ----- Identity ----- */}
              <aside className={styles.side}>
                <div className={styles.panel}>
                  <div className={styles.profileHero}>
                    <div className={styles.avatar} aria-hidden="true">
                      {staff.initials}
                    </div>
                    <h2>{staff.name}</h2>
                    <div className={styles.badges}>
                      <span className={styles.roleBadge}>
                        {roleLabels[staff.role] ?? "Staff"}
                      </span>
                      <span className={styles.accountStatus}>
                        <span />
                        Account active
                      </span>
                    </div>
                  </div>
                  <p className={styles.identityNote}>
                    Your staff account provides access to the DSA workflow for
                    your assigned role.
                  </p>
                </div>
              </aside>
            </div>
          )
        )}
      </main>
    </div>
  );
}
