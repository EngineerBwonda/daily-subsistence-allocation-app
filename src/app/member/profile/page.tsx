"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Landmark,
  LogOut,
  Mail,
  Phone,
  Plus,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./stylesb.module.css";

type MemberDetails = {
  name: string;
  email: string;
  phone: string;
  position: string;
  initials: string;
};

type MemberClaim = {
  id: string;
  claim_month: string;
  claim_year: number;
  nights_chamber: number;
  nights_committee: number;
  status: string;
  created_at: string;
};

const claimStatusLabels: Record<string, string> = {
  secretary_review: "Awaiting secretary review",
  director_review: "Awaiting director review",
  approved: "Approved",
  rejected: "Rejected",
};

/* How far a claim has travelled: submitted > secretary > director */
const claimProgress: Record<string, number> = {
  secretary_review: 1,
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

export default function MemberProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [claims, setClaims] = useState<MemberClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [claimsError, setClaimsError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadMember() {
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
        router.replace("/member/login");
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      const name = getMetadataText(metadata, "full_name") || "Member";

      setMember({
        name,
        email: data.user.email ?? "",
        phone: getMetadataText(metadata, "phone"),
        position: getMetadataText(metadata, "position"),
        initials: getInitials(name) || "M",
      });

      const { data: claimData, error: claimError } = await supabase
        .from("claims")
        .select(
          "id, claim_month, claim_year, nights_chamber, nights_committee, status, created_at",
        )
        .eq("member_id", data.user.id)
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (claimError) {
        console.error("Could not load the member's claim history:", claimError);
        setClaimsError(
          "We could not load your claim history. Please try again.",
        );
      } else {
        setClaims(claimData ?? []);
      }
      setClaimsLoading(false);
      setIsLoading(false);
    }

    void loadMember();

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

    router.replace("/member/login");
  }

  /* ---------- Derived (display only) ---------- */
  const inReviewCount = claims.filter(
    (c) => c.status === "secretary_review" || c.status === "director_review",
  ).length;
  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const rejectedCount = claims.filter((c) => c.status === "rejected").length;
  const stat = (n: number) => (claimsLoading || claimsError ? "–" : n);

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
            <h1>Your profile</h1>
            <p>
              Welcome to your DSA account. Review your details and continue to
              your claims whenever you are ready.
            </p>
          </div>
          <Link href="/page/claimc" className={styles.primaryLink}>
            <Plus size={16} />
            New claim
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
            <span className={styles.srOnly}>Loading your profile...</span>
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
          member && (
            <>
              {/* ===== KPI tiles ===== */}
              <section className={styles.kpis} aria-label="Claims overview">
                <div className={`${styles.kpi} ${styles.kpiFocus}`}>
                  <div className={styles.kpiTop}>
                    <span>In review</span>
                    <span className={styles.kpiIcon}>
                      <Clock size={16} />
                    </span>
                  </div>
                  <span className={styles.kpiValue}>{stat(inReviewCount)}</span>
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
                {/* ===== Claims history ===== */}
                <section
                  className={styles.panel}
                  aria-labelledby="claim-history-title"
                >
                  <div className={styles.panelHead}>
                    <div>
                      <h2 id="claim-history-title">Claims history</h2>
                      <p>Track submitted claims and their review status.</p>
                    </div>
                    <Link href="/page/claimc" className={styles.softLink}>
                      Submit a claim
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>

                  {claimsError && (
                    <p className={styles.alert} role="alert">
                      <TriangleAlert size={16} />
                      {claimsError}
                    </p>
                  )}

                  {claimsLoading ? (
                    <div
                      className={styles.skeletonList}
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <span className={styles.srOnly}>
                        Loading claims history...
                      </span>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={styles.skeletonRow}>
                          <span
                            className={`${styles.skel} ${styles.skelSquare}`}
                          />
                          <span className={styles.skelLines}>
                            <span
                              className={`${styles.skel} ${styles.skelLineA}`}
                            />
                            <span
                              className={`${styles.skel} ${styles.skelLineB}`}
                            />
                          </span>
                          <span
                            className={`${styles.skel} ${styles.skelPill}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : claimsError ? null : claims.length === 0 ? (
                    <div className={styles.empty}>
                      <span className={styles.emptyIcon}>
                        <Inbox size={20} />
                      </span>
                      <strong>No claims yet</strong>
                      <span>You have not submitted any claims yet.</span>
                      <Link href="/page/claimc" className={styles.primaryLink}>
                        <Plus size={16} />
                        Start your first claim
                      </Link>
                    </div>
                  ) : (
                    <ul className={styles.claimList}>
                      {claims.map((claim) => (
                        <li className={styles.claimItem} key={claim.id}>
                          <div className={styles.period} aria-hidden="true">
                            <span>{claim.claim_month.slice(0, 3)}</span>
                            <strong>{claim.claim_year}</strong>
                          </div>

                          <div className={styles.claimSummary}>
                            <h3>
                              {claim.claim_month} {claim.claim_year}
                            </h3>
                            <p>
                              Submitted{" "}
                              {new Date(claim.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className={styles.claimNights}>
                            <strong>
                              {claim.nights_chamber + claim.nights_committee}
                            </strong>
                            <span>
                              nights: {claim.nights_chamber} chamber,{" "}
                              {claim.nights_committee} committee
                            </span>
                          </div>

                          <div className={styles.claimState}>
                            <span
                              className={styles.claimStatus}
                              data-status={claim.status}
                            >
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
                                  data-on={
                                    step <= (claimProgress[claim.status] ?? 1)
                                  }
                                />
                              ))}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* ===== Side: identity + CTA ===== */}
                <aside className={styles.side} aria-label="Member profile">
                  <div className={styles.panel}>
                    <div className={styles.profileHero}>
                      <div className={styles.avatar} aria-hidden="true">
                        {member.initials}
                      </div>
                      <div className={styles.profileId}>
                        <h2>{member.name}</h2>
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
                          Full name
                        </dt>
                        <dd>{member.name}</dd>
                      </div>
                      <div className={styles.detail}>
                        <dt>
                          <Mail size={16} />
                          Email address
                        </dt>
                        <dd>{member.email || "Not provided"}</dd>
                      </div>
                      <div className={styles.detail}>
                        <dt>
                          <Phone size={16} />
                          Phone number
                        </dt>
                        <dd>{member.phone || "Not provided"}</dd>
                      </div>
                      <div className={styles.detail}>
                        <dt>
                          <Landmark size={16} />
                          Position
                        </dt>
                        <dd>{member.position || "Not provided"}</dd>
                      </div>
                    </dl>

                    <p className={styles.detailsFootnote}>
                      Your member account gives you access to DSA claim
                      submission and status tracking. Need to update your
                      account information? Contact your administrator for
                      assistance.
                    </p>
                  </div>

                  <div className={styles.callout}>
                    <span className={styles.calloutIcon}>
                      <FileText size={20} />
                    </span>
                    <div>
                      <h2>Ready to prepare a claim?</h2>
                      <p>
                        Start a new domestic subsistence claim or return to your
                        claim form.
                      </p>
                    </div>
                    <Link href="/page/claimc" className={styles.calloutLink}>
                      Open claim form
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

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import {
//   ArrowUpRight,
//   BadgeCheck,
//   FileText,
//   Landmark,
//   LogOut,
//   Mail,
//   Phone,
//   UserRound,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "./styles.module.css";

// type MemberDetails = {
//   name: string;
//   email: string;
//   phone: string;
//   position: string;
//   initials: string;
// };

// type MemberClaim = {
//   id: string;
//   claim_month: string;
//   claim_year: number;
//   nights_chamber: number;
//   nights_committee: number;
//   status: string;
//   created_at: string;
// };

// const claimStatusLabels: Record<string, string> = {
//   secretary_review: "Awaiting secretary review",
//   director_review: "Awaiting director review",
//   approved: "Approved",
//   rejected: "Rejected",
// };

// function getInitials(name: string) {
//   return name
//     .trim()
//     .split(/\s+/)
//     .slice(0, 2)
//     .map((part) => part[0]?.toUpperCase() ?? "")
//     .join("");
// }

// function getMetadataText(metadata: Record<string, unknown>, key: string) {
//   const value = metadata[key];
//   return typeof value === "string" ? value.trim() : "";
// }

// export default function MemberProfilePage() {
//   const router = useRouter();
//   const supabase = useMemo(() => createClient(), []);
//   const [member, setMember] = useState<MemberDetails | null>(null);
//   const [claims, setClaims] = useState<MemberClaim[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [claimsLoading, setClaimsLoading] = useState(true);
//   const [isSigningOut, setIsSigningOut] = useState(false);
//   const [message, setMessage] = useState("");
//   const [claimsError, setClaimsError] = useState("");

//   useEffect(() => {
//     let isActive = true;

//     async function loadMember() {
//       const { data, error } = await supabase.auth.getUser();

//       if (!isActive) return;

//       if (error) {
//         console.error("Could not load the signed-in user:", error);
//         setMessage("We could not load your account. Please try signing in again.");
//         setIsLoading(false);
//         setClaimsLoading(false);
//         return;
//       }

//       if (!data.user) {
//         router.replace("/member/login");
//         return;
//       }

//       const metadata = data.user.user_metadata ?? {};
//       const name = getMetadataText(metadata, "full_name") || "Member";

//       setMember({
//         name,
//         email: data.user.email ?? "",
//         phone: getMetadataText(metadata, "phone"),
//         position: getMetadataText(metadata, "position"),
//         initials: getInitials(name) || "M",
//       });

//       const { data: claimData, error: claimError } = await supabase
//         .from("claims")
//         .select(
//           "id, claim_month, claim_year, nights_chamber, nights_committee, status, created_at",
//         )
//         .eq("member_id", data.user.id)
//         .order("created_at", { ascending: false });

//       if (!isActive) return;

//       if (claimError) {
//         console.error("Could not load the member's claim history:", claimError);
//         setClaimsError("We could not load your claim history. Please try again.");
//       } else {
//         setClaims(claimData ?? []);
//       }
//       setClaimsLoading(false);
//       setIsLoading(false);
//     }

//     void loadMember();

//     return () => {
//       isActive = false;
//     };
//   }, [router, supabase]);

//   async function handleSignOut() {
//     setIsSigningOut(true);
//     setMessage("");

//     const { error } = await supabase.auth.signOut();

//     if (error) {
//       console.error("Could not sign out:", error);
//       setMessage("We could not sign you out. Please try again.");
//       setIsSigningOut(false);
//       return;
//     }

//     router.replace("/member/login");
//   }

//   return (
//     <main className={styles.page}>
//       <header className={styles.header}>
//         <Link href="/" className={styles.brand} aria-label="Senate Liaison home">
//           <span className={styles.brandMark}>
//             <Landmark size={20} strokeWidth={1.8} />
//           </span>
//           <span className={styles.brandText}>
//             <strong>SENATE LIAISON</strong>
//             <span>DSA MANAGEMENT SYSTEM</span>
//           </span>
//         </Link>

//         <button
//           className={styles.signOutButton}
//           type="button"
//           onClick={handleSignOut}
//           disabled={isSigningOut}
//         >
//           <LogOut size={16} />
//           {isSigningOut ? "Signing out..." : "Sign out"}
//         </button>
//       </header>

//       <div className={styles.content}>
//         <div className={styles.intro}>
//           <span className={styles.eyebrow}>
//             <BadgeCheck size={15} />
//             Member workspace
//           </span>
//           <h1>Your profile</h1>
//           <p>
//             Welcome to your DSA account. Review your details and continue to
//             your claims whenever you are ready.
//           </p>
//         </div>

//         {message && (
//           <p className={styles.message} role="alert">
//             {message}
//           </p>
//         )}

//         {isLoading ? (
//           <section className={styles.loadingCard} aria-live="polite">
//             <span className={styles.spinner} aria-hidden="true" />
//             <p>Loading your profile...</p>
//           </section>
//         ) : (
//           member && (
//             <>
//               <section className={styles.profileGrid} aria-label="Member profile">
//                 <div className={styles.identityCard}>
//                   <div className={styles.avatar} aria-hidden="true">
//                     {member.initials}
//                   </div>
//                   <span className={styles.accountStatus}>
//                     <span />
//                     Account active
//                   </span>
//                   <h2>{member.name}</h2>
//                   <p className={styles.memberRole}>Member</p>
//                   <div className={styles.identityDivider} />
//                   <p className={styles.identityNote}>
//                     Your member account gives you access to DSA claim
//                     submission and status tracking.
//                   </p>
//                 </div>

//                 <div className={styles.detailsCard}>
//                   <div className={styles.cardHeading}>
//                     <div className={styles.headingIcon}>
//                       <UserRound size={18} />
//                     </div>
//                     <div>
//                       <h2>Account details</h2>
//                       <p>Information associated with your member account</p>
//                     </div>
//                   </div>

//                   <dl className={styles.detailsList}>
//                     <div className={styles.detail}>
//                       <dt>
//                         <UserRound size={16} />
//                         Full name
//                       </dt>
//                       <dd>{member.name}</dd>
//                     </div>
//                     <div className={styles.detail}>
//                       <dt>
//                         <Mail size={16} />
//                         Email address
//                       </dt>
//                       <dd>{member.email || "Not provided"}</dd>
//                     </div>
//                     <div className={styles.detail}>
//                       <dt>
//                         <Phone size={16} />
//                         Phone number
//                       </dt>
//                       <dd>{member.phone || "Not provided"}</dd>
//                     </div>
//                     <div className={styles.detail}>
//                       <dt>
//                         <Landmark size={16} />
//                         Position
//                       </dt>
//                       <dd>{member.position || "Not provided"}</dd>
//                     </div>
//                   </dl>

//                   <p className={styles.detailsFootnote}>
//                     Need to update your account information? Contact your
//                     administrator for assistance.
//                   </p>
//                 </div>
//               </section>

//               <section className={styles.claimCallout}>
//                 <div className={styles.calloutIcon}>
//                   <FileText size={21} />
//                 </div>
//                 <div className={styles.calloutCopy}>
//                   <h2>Ready to prepare a claim?</h2>
//                   <p>
//                     Start a new domestic subsistence claim or return to your
//                     claim form.
//                   </p>
//                 </div>
//                 <Link href="/page/claimc" className={styles.claimLink}>
//                   Open claim form
//                   <ArrowUpRight size={17} />
//                 </Link>
//               </section>

//               <section className={styles.claimsSection} aria-labelledby="claim-history-title">
//                 <div className={styles.claimsHeading}>
//                   <div>
//                     <h2 id="claim-history-title">Claims history</h2>
//                     <p>Track submitted claims and their review status.</p>
//                   </div>
//                   <Link href="/page/claimc" className={styles.claimLink}>
//                     Submit a claim
//                     <ArrowUpRight size={17} />
//                   </Link>
//                 </div>

//                 {claimsError && (
//                   <p className={styles.historyError} role="alert">
//                     {claimsError}
//                   </p>
//                 )}

//                 {claimsLoading ? (
//                   <section className={styles.loadingCard} aria-live="polite">
//                     <span className={styles.spinner} aria-hidden="true" />
//                     <p>Loading claims history...</p>
//                   </section>
//                 ) : claimsError ? null : claims.length === 0 ? (
//                   <p className={styles.emptyClaims}>
//                     You have not submitted any claims yet.
//                   </p>
//                 ) : (
//                   <ul className={styles.claimList}>
//                     {claims.map((claim) => (
//                       <li className={styles.claimItem} key={claim.id}>
//                         <div className={styles.claimSummary}>
//                           <h3>
//                             {claim.claim_month} {claim.claim_year}
//                           </h3>
//                           <p>
//                             Submitted{" "}
//                             {new Date(claim.created_at).toLocaleDateString()}
//                           </p>
//                         </div>
//                         <p className={styles.claimNights}>
//                           Chamber: {claim.nights_chamber} nights · Committee:{" "}
//                           {claim.nights_committee} nights
//                         </p>
//                         <span
//                           className={styles.claimStatus}
//                           data-status={claim.status}
//                         >
//                           {claimStatusLabels[claim.status] ?? claim.status}
//                         </span>
//                       </li>
//                     ))}
//                   </ul>
//                 )}
//               </section>
//             </>
//           )
//         )}
//       </div>
//     </main>
//   );
// }
