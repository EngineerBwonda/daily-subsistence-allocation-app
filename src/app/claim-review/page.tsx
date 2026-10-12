"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Inbox,
  Landmark,
  LogOut,
  Mail,
  Phone,
  Printer,
  RefreshCw,
  Search,
  TriangleAlert,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

/* ============================================================
   TYPES
   ============================================================ */
type CommitteeEntry = {
  name: string;
  attendance_date: string;
  mode: "physical" | "virtual" | string;
  sittings: number;
};

type ClaimWeek = {
  id: string;
  week_number: number;
  week_starting: string;
  week_ending: string;
  attended_chamber: boolean;
  attended_committee: boolean;
  committees: CommitteeEntry[];
};

type ClaimStatus =
  | "secretary_review"
  | "director_review"
  | "approved"
  | "rejected";

type Claim = {
  id: string;
  member_id: string;
  claimant_name: string;
  claimant_email: string;
  claim_month: string;
  claim_year: number;
  nights_chamber: number;
  nights_committee: number;
  declaration_signed_name: string;
  status: ClaimStatus;
  created_at: string;
  secretary_reviewed_at: string | null;
  secretary_reviewed_by: string | null;
  reviewed_at: string | null;
  claim_weeks: ClaimWeek[];
};

type StaffProfile = {
  name: string;
  email: string;
  phone: string;
  role: string;
  initials: string;
  canReviewClaims: boolean;
  workflowHref: string | null;
  workflowLabel: string | null;
};

type PageProps = {
  reviewerRole: "secretary" | "director";
};

type FilterKey = "all" | "pending" | "approved" | "rejected";

/* ============================================================
   HELPERS
   ============================================================ */
const statusLabels: Record<ClaimStatus, string> = {
  secretary_review: "Awaiting review",
  director_review: "Awaiting director",
  approved: "Approved",
  rejected: "Rejected",
};

const statusClass: Record<ClaimStatus, string> = {
  secretary_review: styles.statusAwaiting,
  director_review: styles.statusForwarded,
  approved: styles.statusApproved,
  rejected: styles.statusRejected,
};

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const roleLabels: Record<string, string> = {
  member: "Member",
  secretary: "Secretary",
  director: "Director",
};

const pageCopy = {
  secretary: {
    title: "Member claims",
    subtitle:
      "Check each attendance schedule, then forward it to the director or reject it.",
  },
  director: {
    title: "Forwarded claims",
    subtitle:
      "Review claims the secretary has checked, then approve or reject them.",
  },
} as const;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatWeekRange(start: string, end: string): string {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;

  const sLabel = `${ordinal(s.getUTCDate())} ${MONTHS_SHORT[s.getUTCMonth()]}`;
  const eLabel = `${ordinal(e.getUTCDate())} ${MONTHS_SHORT[e.getUTCMonth()]}`;
  const yearLabel =
    s.getUTCFullYear() === e.getUTCFullYear()
      ? s.getUTCFullYear()
      : `${s.getUTCFullYear()}/${e.getUTCFullYear()}`;

  return `${sLabel} – ${eLabel} ${yearLabel}`;
}

function formatShortDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

function explodeWeek(week: ClaimWeek) {
  const committees = week.committees ?? [];

  if (week.attended_committee && committees.length > 0) {
    return committees.map((c, idx) => ({
      isFirst: idx === 0,
      spanRows: committees.length,
      committeeName: c.name,
      sittingLine: formatShortDate(c.attendance_date),
      mode: c.mode.charAt(0).toUpperCase() + c.mode.slice(1),
      sittings: c.sittings,
    }));
  }

  if (week.attended_chamber && !week.attended_committee) {
    return [
      {
        isFirst: true,
        spanRows: 1,
        committeeName: "Chamber",
        sittingLine: "",
        mode: "",
        sittings: 0,
      },
    ];
  }

  return [
    {
      isFirst: true,
      spanRows: 1,
      committeeName: "—",
      sittingLine: "",
      mode: "",
      sittings: 0,
    },
  ];
}

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

/* ============================================================
   PAGE
   ============================================================ */
function ClaimReviewPage({ reviewerRole }: PageProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  /* UI-only state (does not touch the data flow) */
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  /* ============================================================
     LOAD CLAIMS
     ============================================================ */
  const loadClaims = useCallback(async () => {
    const { data, error } = await supabase
      .from("claims")
      .select(
        "id, member_id, claimant_name, claimant_email, claim_month, claim_year, nights_chamber, nights_committee, declaration_signed_name, status, created_at, secretary_reviewed_at, secretary_reviewed_by, reviewed_at, claim_weeks(id, week_number, week_starting, week_ending, attended_chamber, attended_committee, committees)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load submitted claims:", error);
      setMessage("We could not load submitted claims. Please try again.");
      return;
    }

    setClaims((data as Claim[]) ?? []);
    setClaimsLoaded(true);
    setMessage("");
  }, [supabase]);

  /* ============================================================
     INIT: auth + profile + claims
     ============================================================ */
  useEffect(() => {
    let isActive = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!isActive) return;

      if (error) {
        console.error("Could not load the signed-in user:", error);
        setMessage("We could not verify your account. Please sign in again.");
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        router.replace("/staff/login");
        return;
      }

      /* ---- Load staff profile from `staff_profiles` ---- */
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

      const role = profile.role as string;

      /* ---- Role guard ---- */
      if (role !== reviewerRole) {
        router.replace("/staff/profile");
        return;
      }

      /* ---- Build staff object for the right-hand panel ---- */
      const metadata = data.user.user_metadata ?? {};
      const fullName = getMetadataText(metadata, "full_name") || "Staff member";
      const phone = getMetadataText(metadata, "phone");

      setStaff({
        name: fullName,
        email: data.user.email ?? "",
        phone,
        role,
        initials: getInitials(fullName) || "S",
        canReviewClaims: role === "secretary",
        workflowHref:
          role === "secretary"
            ? "/secretary/claims"
            : role === "director"
              ? "/director/claims"
              : null,
        workflowLabel:
          role === "secretary"
            ? "Review member claims"
            : role === "director"
              ? "Review forwarded claims"
              : null,
      });

      await loadClaims();
      if (isActive) setIsLoading(false);
    }

    void initialize();

    return () => {
      isActive = false;
    };
  }, [loadClaims, reviewerRole, router, supabase]);

  /* ============================================================
     REVIEW ACTION
     ============================================================ */
  async function reviewClaim(
    claimId: string,
    decision: "approved" | "rejected",
  ) {
    setUpdatingClaimId(claimId);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      if (userError) console.error("Could not verify the reviewer:", userError);
      setMessage("Your session could not be verified. Please sign in again.");
      setUpdatingClaimId(null);
      return;
    }

    const reviewedAt = new Date().toISOString();

    const nextStatus: ClaimStatus =
      reviewerRole === "secretary" && decision === "approved"
        ? "director_review"
        : decision;

    const update =
      reviewerRole === "secretary"
        ? {
            status: nextStatus,
            secretary_reviewed_by: userData.user.id,
            secretary_reviewed_at: reviewedAt,
          }
        : {
            status: nextStatus,
            reviewed_by: userData.user.id,
            reviewed_at: reviewedAt,
          };

    const expectedStatus =
      reviewerRole === "secretary" ? "secretary_review" : "director_review";

    const { data, error } = await supabase
      .from("claims")
      .update(update)
      .eq("id", claimId)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Could not update claim review status:", error);
      setMessage("The claim could not be updated. Please try again.");
      setUpdatingClaimId(null);
      return;
    }

    if (!data) {
      setMessage("This claim has already been reviewed. Refreshing the list.");
      await loadClaims();
      setUpdatingClaimId(null);
      return;
    }

    /* Optimistic local update */
    setClaims((current) =>
      current.map((claim) =>
        claim.id === claimId
          ? reviewerRole === "secretary"
            ? {
                ...claim,
                status: nextStatus,
                secretary_reviewed_at: reviewedAt,
                secretary_reviewed_by: userData.user.id,
              }
            : {
                ...claim,
                status: nextStatus,
                reviewed_at: reviewedAt,
              }
          : claim,
      ),
    );

    setUpdatingClaimId(null);
  }

  /* ============================================================
     SIGN OUT / REFRESH
     ============================================================ */
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out:", error);
      setMessage("We could not sign you out. Please try again.");
      return;
    }
    router.replace("/staff/login");
  }

  async function refreshClaims() {
    setIsRefreshing(true);
    await loadClaims();
    setIsRefreshing(false);
  }

  /* ============================================================
     DERIVED
     ============================================================ */
  const pendingStatus =
    reviewerRole === "secretary" ? "secretary_review" : "director_review";
  const pendingCount = claims.filter((c) => c.status === pendingStatus).length;
  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const rejectedCount = claims.filter((c) => c.status === "rejected").length;

  const visibleClaims = useMemo(() => {
    const q = query.trim().toLowerCase();

    return claims.filter((claim) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && claim.status === pendingStatus) ||
        (filter === "approved" && claim.status === "approved") ||
        (filter === "rejected" && claim.status === "rejected");

      if (!matchesFilter) return false;
      if (!q) return true;

      return (
        claim.claimant_name.toLowerCase().includes(q) ||
        `${claim.claim_month} ${claim.claim_year}`.toLowerCase().includes(q)
      );
    });
  }, [claims, filter, pendingStatus, query]);

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: claims.length },
    { key: "pending", label: "Needs review", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
  ];

  const copy = pageCopy[reviewerRole];

  /* ============================================================
     RENDER
     ============================================================ */
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

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => void refreshClaims()}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? styles.spin : undefined}
            />
            <span className={styles.btnLabel}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </span>
          </button>
          <button
            className={`${styles.ghostBtn} ${styles.dangerHover}`}
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={15} />
            <span className={styles.btnLabel}>Sign out</span>
          </button>
        </div>
      </header>

      <main className={styles.shell}>
        {/* ===== Page heading ===== */}
        <div className={styles.pageHead}>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        {/* ===== KPI tiles ===== */}
        <section className={styles.kpis} aria-label="Claims overview">
          <div className={`${styles.kpi} ${styles.kpiFocus}`}>
            <div className={styles.kpiTop}>
              <span>Awaiting your review</span>
              <span className={styles.kpiIcon}>
                <Clock size={16} />
              </span>
            </div>
            <span className={styles.kpiValue}>{pendingCount}</span>
          </div>

          <div className={`${styles.kpi} ${styles.kpiGreen}`}>
            <div className={styles.kpiTop}>
              <span>Approved</span>
              <span className={styles.kpiIcon}>
                <CheckCircle2 size={16} />
              </span>
            </div>
            <span className={styles.kpiValue}>{approvedCount}</span>
          </div>

          <div className={`${styles.kpi} ${styles.kpiRed}`}>
            <div className={styles.kpiTop}>
              <span>Rejected</span>
              <span className={styles.kpiIcon}>
                <XCircle size={16} />
              </span>
            </div>
            <span className={styles.kpiValue}>{rejectedCount}</span>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiTop}>
              <span>Total claims</span>
              <span className={styles.kpiIcon}>
                <FileText size={16} />
              </span>
            </div>
            <span className={styles.kpiValue}>{claims.length}</span>
          </div>
        </section>

        {/* ===== Main grid ===== */}
        <div className={styles.layout}>
          {/* ----- Claims queue ----- */}
          <section className={styles.panel} aria-label="Member claims">
            <div className={styles.toolbar}>
              <div
                className={styles.tabs}
                role="group"
                aria-label="Filter claims"
              >
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`${styles.tab} ${
                      filter === tab.key ? styles.tabActive : ""
                    }`}
                    aria-pressed={filter === tab.key}
                    onClick={() => setFilter(tab.key)}
                  >
                    {tab.label}
                    <span className={styles.tabCount}>{tab.count}</span>
                  </button>
                ))}
              </div>

              <label className={styles.search}>
                <Search size={15} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or month"
                  aria-label="Search claims by name or month"
                />
              </label>
            </div>

            {message && (
              <p className={styles.alert} role="alert">
                <TriangleAlert size={16} />
                {message}
              </p>
            )}

            {isLoading ? (
              <div
                className={styles.skeletonList}
                aria-live="polite"
                aria-busy="true"
              >
                <span
                  className="sr-only"
                  style={{ position: "absolute", left: "-9999px" }}
                >
                  Loading claims...
                </span>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={styles.skeletonRow}>
                    <span className={`${styles.skel} ${styles.skelAvatar}`} />
                    <span className={styles.skelLines}>
                      <span className={`${styles.skel} ${styles.skelLineA}`} />
                      <span className={`${styles.skel} ${styles.skelLineB}`} />
                    </span>
                    <span className={`${styles.skel} ${styles.skelPill}`} />
                  </div>
                ))}
              </div>
            ) : !claimsLoaded ? null : claims.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <Inbox size={20} />
                </span>
                <strong>No claims yet</strong>
                <span>Claims appear here as soon as members submit them.</span>
              </div>
            ) : visibleClaims.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <Search size={20} />
                </span>
                <strong>No matching claims</strong>
                <span>Try a different filter or clear your search.</span>
              </div>
            ) : (
              <ul className={styles.claimList}>
                {visibleClaims.map((claim) => {
                  const isOpen = activeClaimId === claim.id;
                  const isPending = claim.status === pendingStatus;

                  return (
                    <li
                      key={claim.id}
                      className={styles.claimRow}
                      data-open={isOpen}
                    >
                      {/* ----- Collapsed header (clickable) ----- */}
                      <button
                        type="button"
                        className={styles.claimToggle}
                        onClick={() =>
                          setActiveClaimId(isOpen ? null : claim.id)
                        }
                        aria-expanded={isOpen}
                        aria-controls={`claim-${claim.id}`}
                      >
                        <span className={styles.avatar} aria-hidden="true">
                          {getInitials(claim.claimant_name) || "M"}
                        </span>

                        <span className={styles.claimInfo}>
                          <span className={styles.claimName}>
                            {claim.claimant_name}
                          </span>
                          <span className={styles.claimPeriod}>
                            {claim.claim_month} {claim.claim_year}
                          </span>
                        </span>

                        <span className={styles.claimNights}>
                          <strong>
                            {claim.nights_chamber + claim.nights_committee}
                          </strong>
                          <span>nights</span>
                        </span>

                        <span
                          className={`${styles.statusPill} ${
                            statusClass[claim.status]
                          }`}
                        >
                          {statusLabels[claim.status]}
                        </span>

                        <ChevronDown
                          size={18}
                          className={`${styles.chevron} ${
                            isOpen ? styles.chevronOpen : ""
                          }`}
                        />
                      </button>

                      {/* ----- Expanded details ----- */}
                      {isOpen && (
                        <div
                          className={styles.claimBody}
                          id={`claim-${claim.id}`}
                        >
                          {/* Schedule header */}
                          <div className={styles.scheduleHeader}>
                            <div className={styles.scheduleTitle}>
                              <span>
                                <Landmark size={16} />
                              </span>
                              <h3>Chamber and committee attendance schedule</h3>
                            </div>
                            <div className={styles.scheduleMeta}>
                              <span className={styles.scheduleMetaLabel}>
                                Name of senator
                              </span>
                              <strong>{claim.claimant_name}</strong>
                            </div>
                          </div>

                          {/* Contact + audit trail */}
                          <div className={styles.metaStrip}>
                            <span className={styles.metaChip}>
                              <Mail size={13} />
                              <a href={`mailto:${claim.claimant_email}`}>
                                {claim.claimant_email}
                              </a>
                            </span>
                            <span className={styles.metaChip}>
                              <strong>Submitted</strong>
                              {new Date(claim.created_at).toLocaleString()}
                            </span>
                            {claim.secretary_reviewed_at && (
                              <span className={styles.metaChip}>
                                <strong>Secretary</strong>
                                {new Date(
                                  claim.secretary_reviewed_at,
                                ).toLocaleString()}
                              </span>
                            )}
                            {claim.reviewed_at && (
                              <span className={styles.metaChip}>
                                <strong>Director</strong>
                                {new Date(claim.reviewed_at).toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Attendance table */}
                          <div className={styles.tableWrap}>
                            <table className={styles.scheduleTable}>
                              <thead>
                                <tr>
                                  <th>Week claimed</th>
                                  <th>Committee(s)</th>
                                  <th>Sitting dates</th>
                                  <th>Nature of sitting</th>
                                  <th>Number of sittings</th>
                                </tr>
                              </thead>
                              <tbody>
                                {claim.claim_weeks.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className={styles.emptyCell}
                                    >
                                      No weeks submitted
                                    </td>
                                  </tr>
                                ) : (
                                  claim.claim_weeks.flatMap((week) => {
                                    const rows = explodeWeek(week);
                                    return rows.map((row, idx) => (
                                      <tr
                                        key={`${week.id}-${idx}`}
                                        className={
                                          row.isFirst ? styles.weekFirstRow : ""
                                        }
                                      >
                                        {row.isFirst && (
                                          <td
                                            rowSpan={row.spanRows}
                                            className={styles.weekCell}
                                          >
                                            {formatWeekRange(
                                              week.week_starting,
                                              week.week_ending,
                                            )}
                                            {week.attended_chamber && (
                                              <span
                                                className={styles.chamberTag}
                                              >
                                                Chamber
                                              </span>
                                            )}
                                          </td>
                                        )}

                                        <td className={styles.committeeCell}>
                                          {row.committeeName}
                                        </td>
                                        <td className={styles.dateCell}>
                                          {row.sittingLine || "—"}
                                        </td>
                                        <td className={styles.modeCell}>
                                          {row.mode ? (
                                            <span
                                              className={styles.modePill}
                                              data-mode={row.mode.toLowerCase()}
                                            >
                                              {row.mode}
                                            </span>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td className={styles.sittingCountCell}>
                                          {row.sittings > 0
                                            ? row.sittings
                                            : "—"}
                                        </td>
                                      </tr>
                                    ));
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Summary + declaration */}
                          <div className={styles.summaryBlock}>
                            <div className={styles.summaryCard}>
                              <span className={styles.summaryLabel}>
                                Nights claimed
                              </span>
                              <div className={styles.summaryRows}>
                                <div>
                                  <span>Chamber attendance</span>
                                  <strong>{claim.nights_chamber}</strong>
                                </div>
                                <div>
                                  <span>Committee attendance</span>
                                  <strong>{claim.nights_committee}</strong>
                                </div>
                                <div className={styles.summaryTotal}>
                                  <span>Total</span>
                                  <strong>
                                    {claim.nights_chamber +
                                      claim.nights_committee}
                                  </strong>
                                </div>
                              </div>
                            </div>

                            <div className={styles.declarationCard}>
                              <span className={styles.summaryLabel}>
                                Declaration
                              </span>
                              <p className={styles.declarationText}>
                                I certify that I did not travel out of the
                                country, nor benefit from government
                                accommodation on any of the dates stated above.
                              </p>
                              <p className={styles.signedBy}>
                                Signed:{" "}
                                <strong>{claim.declaration_signed_name}</strong>
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          {isPending ? (
                            <div className={styles.reviewActions}>
                              <button
                                type="button"
                                className={styles.approveButton}
                                onClick={() =>
                                  void reviewClaim(claim.id, "approved")
                                }
                                disabled={updatingClaimId !== null}
                              >
                                <Check size={16} />
                                {updatingClaimId === claim.id
                                  ? "Saving..."
                                  : reviewerRole === "secretary"
                                    ? "Forward to director"
                                    : "Approve"}
                              </button>
                              <button
                                type="button"
                                className={styles.rejectButton}
                                onClick={() =>
                                  void reviewClaim(claim.id, "rejected")
                                }
                                disabled={updatingClaimId !== null}
                              >
                                <X size={16} />
                                Reject
                              </button>
                              <button
                                type="button"
                                className={styles.printButton}
                                onClick={() => window.print()}
                              >
                                <Printer size={16} />
                                Print
                              </button>
                            </div>
                          ) : (
                            <div className={styles.finalizedNote}>
                              <BadgeCheck size={16} />
                              <span>
                                This claim has been{" "}
                                {statusLabels[claim.status].toLowerCase()}.
                              </span>
                              <button
                                type="button"
                                className={styles.printButton}
                                onClick={() => window.print()}
                              >
                                <Printer size={16} />
                                Print
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ----- Staff profile ----- */}
          <aside className={styles.side} aria-label="Staff profile">
            <div className={styles.panel}>
              {staff ? (
                <div className={styles.profile}>
                  <div className={styles.profileHero}>
                    <div className={styles.avatarLg}>{staff.initials}</div>
                    <div>
                      <div className={styles.profileName}>{staff.name}</div>
                      <span className={styles.profileRole}>
                        {roleLabels[staff.role] ?? "Staff"}, DSA review
                      </span>
                    </div>
                  </div>

                  <div className={styles.profileDetails}>
                    <div className={styles.detailRow}>
                      <Mail size={16} />
                      <span className={styles.detailText}>
                        <span>Email</span>
                        <strong>{staff.email || "Not provided"}</strong>
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <Phone size={16} />
                      <span className={styles.detailText}>
                        <span>Phone</span>
                        <strong>{staff.phone || "Not provided"}</strong>
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <UserRound size={16} />
                      <span className={styles.detailText}>
                        <span>Role</span>
                        <strong>{roleLabels[staff.role] ?? "Staff"}</strong>
                      </span>
                    </div>
                  </div>

                  {staff.workflowHref && staff.workflowLabel && (
                    <Link
                      href={staff.workflowHref}
                      className={styles.workflowLink}
                    >
                      {staff.workflowLabel}
                      <ArrowUpRight size={16} />
                    </Link>
                  )}
                </div>
              ) : (
                <div
                  className={styles.skelProfile}
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span className={`${styles.skel} ${styles.skelAvatar}`} />
                  <span className={`${styles.skel} ${styles.skelLineA}`} />
                  <span className={`${styles.skel} ${styles.skelLineB}`} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function SecretaryClaimReviewPage() {
  return <ClaimReviewPage reviewerRole="secretary" />;
}
