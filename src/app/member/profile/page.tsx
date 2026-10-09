"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  FileText,
  Landmark,
  LogOut,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

type MemberDetails = {
  name: string;
  email: string;
  phone: string;
  position: string;
  initials: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadMember() {
      const { data, error } = await supabase.auth.getUser();

      if (!isActive) return;

      if (error) {
        console.error("Could not load the signed-in user:", error);
        setMessage("We could not load your account. Please try signing in again.");
        setIsLoading(false);
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Senate Liaison home">
          <span className={styles.brandMark}>
            <Landmark size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.brandText}>
            <strong>SENATE LIAISON</strong>
            <span>DSA MANAGEMENT SYSTEM</span>
          </span>
        </Link>

        <button
          className={styles.signOutButton}
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut size={16} />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>
            <BadgeCheck size={15} />
            Member workspace
          </span>
          <h1>Your profile</h1>
          <p>
            Welcome to your DSA account. Review your details and continue to
            your claims whenever you are ready.
          </p>
        </div>

        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}

        {isLoading ? (
          <section className={styles.loadingCard} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Loading your profile...</p>
          </section>
        ) : (
          member && (
            <>
              <section className={styles.profileGrid} aria-label="Member profile">
                <div className={styles.identityCard}>
                  <div className={styles.avatar} aria-hidden="true">
                    {member.initials}
                  </div>
                  <span className={styles.accountStatus}>
                    <span />
                    Account active
                  </span>
                  <h2>{member.name}</h2>
                  <p className={styles.memberRole}>Member</p>
                  <div className={styles.identityDivider} />
                  <p className={styles.identityNote}>
                    Your member account gives you access to DSA claim
                    submission and status tracking.
                  </p>
                </div>

                <div className={styles.detailsCard}>
                  <div className={styles.cardHeading}>
                    <div className={styles.headingIcon}>
                      <UserRound size={18} />
                    </div>
                    <div>
                      <h2>Account details</h2>
                      <p>Information associated with your member account</p>
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
                    Need to update your account information? Contact your
                    administrator for assistance.
                  </p>
                </div>
              </section>

              <section className={styles.claimCallout}>
                <div className={styles.calloutIcon}>
                  <FileText size={21} />
                </div>
                <div className={styles.calloutCopy}>
                  <h2>Ready to prepare a claim?</h2>
                  <p>
                    Start a new domestic subsistence claim or return to your
                    claim form.
                  </p>
                </div>
                <Link href="/page/claimb" className={styles.claimLink}>
                  Open claim form
                  <ArrowUpRight size={17} />
                </Link>
              </section>
            </>
          )
        )}
      </div>
    </main>
  );
}
