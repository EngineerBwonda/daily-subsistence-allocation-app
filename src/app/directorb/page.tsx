"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Inbox,
  Landmark,
  LogOut,
  Mail,
  Phone,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

type DirectorDetails = {
  name: string;
  email: string;
  phone: string;
  initials: string;
};

type DirectorClaim = {
  id: string;
  claimant_name: string;
  claim_month: string;
  claim_year: number;
  nights_chamber: number;
  nights_committee: number;
  status: string;
  created_at: string;
  secretary_reviewed_at: string | null;
  reviewed_at: string | null;
};

const REVIEW_HREF = "/director/claims";

const claimStatusLabels: Record<string, string> = {
  director_review: "Awaiting director review",
  approved: "Approved",
  rejected: "Rejected",
};

/* How far a claim has travelled: submitted > secretary > director */
const claimProgress: Record<string, number> = {
  director_review: 2,
  approved: 3,
  rejected: 3,
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

export default function DirectorDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [director, setDirector] = useState<DirectorDetails | null>(null);
  const [claims, setClaims] = useState<DirectorClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [claimsError, setClaimsError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadDirector() {
      const { data, error } = await supabase.auth.getUser();

      if (!isActive) return;

      if (error) {
        console.error("Could not load the signed-in user:", error);
        setMessage(
          "We could not load your account. Please try signing in again.",
        );
        setIsLoading(false);
        setClaimsLoading(false);
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
        setClaimsLoading(false);
        return;
      }

      if (!profile) {
        setMessage("This account does not have a staff profile.");
        setIsLoading(false);
        setClaimsLoading(false);
        return;
      }

      if (profile.role !== "director") {
        router.replace("/staff/profile");
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      const name = getMetadataText(metadata, "full_name") || "Director";

      setDirector({
        name,
        email: data.user.email ?? "",
        phone: getMetadataText(metadata, "phone"),
        initials: getInitials(name) || "D",
      });

      const { data: claimData, error: claimError } = await supabase
        .from("claims")
        .select(
          "id, claimant_name, claim_month, claim_year, nights_chamber, nights_committee, status, created_at, secretary_reviewed_at, reviewed_at",
        )
        .in("status", ["director_review", "approved", "rejected"])
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (claimError) {
        console.error("Could not load claims for the director:", claimError);
        setClaimsError("We could not load claims. Please try again.");
      } else {
        setClaims(claimData ?? []);
      }
      setClaimsLoading(false);
      setIsLoading(false);
    }

    void loadDirector();

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

  /* ---------- Derived (display only) ---------- */
  const awaiting = claims.filter((c) => c.status === "director_review");
  const reviewed = claims.filter((c) => c.status !== "director_review");
  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const rejectedCount = claims.filter((c) => c.status === "rejected").length;
  const stat = (n: number) => (claimsLoading || claimsError ? "–" : n);

  function renderRow(claim: DirectorClaim, isAwaiting: boolean) {
    const when = isAwaiting
      ? claim.secretary_reviewed_at
        ? `Forwarded ${shortDate(claim.secretary_reviewed_at)}`
        : `Submitted ${shortDate(claim.created_at)}`
      : `Decided ${shortDate(
          claim.reviewed_at ?? claim.secretary_reviewed_at ?? claim.created_at,
        )}`;

    return (
      <li className={styles.claimItem} key={claim.id}>
        <div className={styles.period} aria-hidden="true">
          <span>{claim.claim_month.slice(0, 3)}</span>
          <strong>{claim.claim_year}</strong>
        </div>

        <div className={styles.claimSummary}>
          <h3>{claim.claimant_name}</h3>
          <p>
            {claim.claim_month} {claim.claim_year}, {when.toLowerCase()}
          </p>
        </div>

        <div className={styles.claimNights}>
          <strong>{claim.nights_chamber + claim.nights_committee}</strong>
          <span>
            nights: {claim.nights_chamber} chamber, {claim.nights_committee}{" "}
            committee
          </span>
        </div>

        <div className={styles.claimState}>
          <span className={styles.claimStatus} data-status={claim.status}>
            {claimStatusLabels[claim.status] ?? claim.status}
          </span>
          <span
            className={styles.track}
            data-status={claim.status}
            aria-hidden="true"
          >
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                data-on={step <= (claimProgress[claim.status] ?? 1)}
              />
            ))}
          </span>
        </div>

        <Link
          href={REVIEW_HREF}
          className={`${styles.rowAction} ${
            isAwaiting ? styles.rowActionPrimary : ""
          }`}
          aria-label={`${isAwaiting ? "Review" : "View"} claim from ${
            claim.claimant_name
          }, ${claim.claim_month} ${claim.claim_year}`}
        >
          {isAwaiting ? "Review" : "View"}
          <ArrowUpRight size={15} />
        </Link>
      </li>
    );
  }

  function renderList(list: DirectorClaim[], isAwaiting: boolean) {
    if (claimsLoading) {
      return (
        <div
          className={styles.skeletonList}
          aria-live="polite"
          aria-busy="true"
        >
          <span className={styles.srOnly}>Loading claims...</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <span className={`${styles.skel} ${styles.skelSquare}`} />
              <span className={styles.skelLines}>
                <span className={`${styles.skel} ${styles.skelLineA}`} />
                <span className={`${styles.skel} ${styles.skelLineB}`} />
              </span>
              <span className={`${styles.skel} ${styles.skelPill}`} />
            </div>
          ))}
        </div>
      );
    }

    if (claimsError) return null;

    if (list.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Inbox size={20} />
          </span>
          <strong>
            {isAwaiting ? "You're all caught up" : "Nothing reviewed yet"}
          </strong>
          <span>
            {isAwaiting
              ? "There are no claims awaiting your review."
              : "Claims you and the Secretary have decided will appear here."}
          </span>
        </div>
      );
    }

    return (
      <ul className={styles.claimList}>
        {list.map((claim) => renderRow(claim, isAwaiting))}
      </ul>
    );
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
        {/* ===== Page heading ===== */}
        <div className={styles.pageHead}>
          <div>
            <h1>Director dashboard</h1>
            <p>
              Claims forwarded by the Secretary and the decisions already
              recorded, all in one place.
            </p>
          </div>
          <Link href={REVIEW_HREF} className={styles.primaryLink}>
            <ClipboardCheck size={16} />
            Review claims
          </Link>
        </div>

        {message && (
          <p className={styles.alert} role="alert">
            <TriangleAlert size={16} />
            {message}
          </p>
        )}

        {isLoading ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className={styles.loadingWrap}
          >
            <span className={styles.srOnly}>Loading your dashboard...</span>
            <div className={styles.kpis}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`${styles.skel} ${styles.skelKpi}`} />
              ))}
            </div>
            <div className={styles.layout}>
              <span className={`${styles.skel} ${styles.skelBlockLg}`} />
              <span className={`${styles.skel} ${styles.skelBlockSm}`} />
            </div>
          </div>
        ) : (
          director && (
            <>
              {/* ===== KPI tiles ===== */}
              <section className={styles.kpis} aria-label="Claims overview">
                <div className={`${styles.kpi} ${styles.kpiFocus}`}>
                  <div className={styles.kpiTop}>
                    <span>Awaiting review</span>
                    <span className={styles.kpiIcon}>
                      <Clock size={16} />
                    </span>
                  </div>
                  <span className={styles.kpiValue}>
                    {stat(awaiting.length)}
                  </span>
                </div>

                <div className={`${styles.kpi} ${styles.kpiGreen}`}>
                  <div className={styles.kpiTop}>
                    <span>Approved</span>
                    <span className={styles.kpiIcon}>
                      <CheckCircle2 size={16} />
                    </span>
                  </div>
                  <span className={styles.kpiValue}>{stat(approvedCount)}</span>
                </div>

                <div className={`${styles.kpi} ${styles.kpiRed}`}>
                  <div className={styles.kpiTop}>
                    <span>Rejected</span>
                    <span className={styles.kpiIcon}>
                      <XCircle size={16} />
                    </span>
                  </div>
                  <span className={styles.kpiValue}>{stat(rejectedCount)}</span>
                </div>

                <div className={styles.kpi}>
                  <div className={styles.kpiTop}>
                    <span>Total claims</span>
                    <span className={styles.kpiIcon}>
                      <FileText size={16} />
                    </span>
                  </div>
                  <span className={styles.kpiValue}>{stat(claims.length)}</span>
                </div>
              </section>

              <div className={styles.layout}>
                {/* ===== Claims ===== */}
                <div className={styles.mainCol}>
                  <section
                    className={styles.panel}
                    aria-labelledby="awaiting-title"
                  >
                    <div className={styles.panelHead}>
                      <div className={styles.panelTitle}>
                        <h2 id="awaiting-title">Awaiting review</h2>
                        {!claimsLoading && !claimsError && (
                          <span className={styles.count}>
                            {awaiting.length}
                          </span>
                        )}
                      </div>
                      <Link href={REVIEW_HREF} className={styles.softLink}>
                        Open review page
                        <ArrowUpRight size={16} />
                      </Link>
                    </div>

                    {claimsError && (
                      <p className={styles.alert} role="alert">
                        <TriangleAlert size={16} />
                        {claimsError}
                      </p>
                    )}

                    {renderList(awaiting, true)}
                  </section>

                  <section
                    className={styles.panel}
                    aria-labelledby="reviewed-title"
                  >
                    <div className={styles.panelHead}>
                      <div className={styles.panelTitle}>
                        <h2 id="reviewed-title">Reviewed claims</h2>
                        {!claimsLoading && !claimsError && (
                          <span className={styles.count}>
                            {reviewed.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {renderList(reviewed, false)}
                  </section>
                </div>

                {/* ===== Side: identity + CTA ===== */}
                <aside className={styles.side} aria-label="Director profile">
                  <div className={styles.panel}>
                    <div className={styles.profileHero}>
                      <div className={styles.avatar} aria-hidden="true">
                        {director.initials}
                      </div>
                      <div className={styles.profileId}>
                        <h2>{director.name}</h2>
                        <span className={styles.accountStatus}>
                          <span />
                          Account active
                        </span>
                      </div>
                    </div>

                    <dl className={styles.detailsList}>
                      <div className={styles.detail}>
                        <dt>
                          <UserRound size={16} />
                          Role
                        </dt>
                        <dd>Director</dd>
                      </div>
                      <div className={styles.detail}>
                        <dt>
                          <Mail size={16} />
                          Email address
                        </dt>
                        <dd>{director.email || "Not provided"}</dd>
                      </div>
                      <div className={styles.detail}>
                        <dt>
                          <Phone size={16} />
                          Phone number
                        </dt>
                        <dd>{director.phone || "Not provided"}</dd>
                      </div>
                    </dl>

                    <p className={styles.detailsFootnote}>
                      Need to update your account information? Contact your
                      administrator for assistance.
                    </p>
                  </div>

                  <div className={styles.callout}>
                    <span className={styles.calloutIcon}>
                      <ClipboardCheck size={20} />
                    </span>
                    <div>
                      <h2>Ready to decide?</h2>
                      <p>
                        Open the review page to read each attendance schedule
                        and approve or reject forwarded claims.
                      </p>
                    </div>
                    <Link href={REVIEW_HREF} className={styles.calloutLink}>
                      Review forwarded claims
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </aside>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
