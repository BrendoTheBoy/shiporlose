import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"

export function TermsPage() {
  const canonicalUrl =
    typeof window !== "undefined" ? window.location.href : ""

  return (
    <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-6 md:px-8 md:pt-8">
      <Helmet>
        <title>Terms of Service — Ship Or Lose</title>
        <meta
          name="description"
          content="Terms of Service for Ship Or Lose — commitment contracts, stakes, and community verification."
        />
        <meta property="og:title" content="Terms of Service — Ship Or Lose" />
        <meta
          property="og:description"
          content="Terms of Service for Ship Or Lose — commitment contracts, stakes, and community verification."
        />
        {canonicalUrl ? (
          <meta property="og:url" content={canonicalUrl} />
        ) : null}
      </Helmet>

      <Link
        to="/"
        className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14] hover:text-[#FF6B00]"
      >
        ← BACK TO FEED
      </Link>

      <article className="mt-10 border-2 border-[#1a3d1a] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#888]">
          Last updated: April 2026
        </p>
        <h1 className="font-display mt-4 text-[clamp(0.65rem,2.2vw,0.95rem)] leading-relaxed text-[#39FF14] [text-shadow:0_0_24px_rgba(57,255,20,0.35)]">
          TERMS OF SERVICE
        </h1>
        <p className="font-mono mt-4 text-sm leading-relaxed text-[#9fdf9d]">
          Plain language. Read this before you put money on the line.
        </p>

        <div className="mt-10 space-y-10 font-mono text-sm leading-[1.75] text-[#b8e8c8]">
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              1. Acceptance of terms
            </h2>
            <p>
              By creating an account or making a payment on Ship Or Lose, you
              agree to these terms. If you don&apos;t agree, don&apos;t use the
              platform.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              2. What Ship Or Lose is
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Ship Or Lose is a commitment contract platform. It is{" "}
                <strong className="font-semibold text-[#39FF14]">not</strong>{" "}
                gambling, a lottery, or a game of chance.
              </li>
              <li>
                You are entering a binding commitment contract with yourself.
                You define what &quot;shipped&quot; means. You set the terms of
                your own success or failure.
              </li>
              <li>
                The financial stake exists solely as a self-imposed
                accountability mechanism, based on the behavioral economics idea
                of loss aversion.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              3. How it works
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                You pay <strong className="text-[#39FF14]">$30 USD</strong> to
                declare a project.{" "}
                <strong className="text-[#39FF14]">$20</strong> is your
                commitment stake.{" "}
                <strong className="text-[#39FF14]">$10</strong> is a pool entry
                fee.
              </li>
              <li>
                You have <strong className="text-[#39FF14]">30 days</strong>{" "}
                from the date of payment to ship your project as defined by your
                own &quot;shipped means&quot; statement.
              </li>
              <li>
                Your &quot;shipped means&quot; statement is your public contract.
                It cannot be changed after payment.
              </li>
              <li>
                To claim you shipped, you must submit a proof URL during your
                30-day window. The community then has{" "}
                <strong className="text-[#39FF14]">48 hours</strong> to review
                your claim.
              </li>
              <li>
                If your claim is not disputed (fewer than 3 flags), your project
                is marked as shipped.
              </li>
              <li>
                If your claim receives 3 or more flags, it is reviewed by the Ship
                Or Lose team, whose decision is final.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              4. Stake forfeiture and returns
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                If you ship successfully: your{" "}
                <strong className="text-[#39FF14]">$20</strong> commitment stake
                is returned, and you receive a share of the monthly pool (80% of
                the pool divided equally among all winners that month). The
                remaining 20% is retained by Ship Or Lose as a platform fee.
              </li>
              <li>
                If you do not ship within 30 days: your{" "}
                <strong className="text-[#39FF14]">$20</strong> commitment stake
                is forfeited. You will not receive a refund.
              </li>
              <li>
                If your submission is rejected after review: your stake is
                forfeited.
              </li>
              <li>
                The <strong className="text-[#39FF14]">$10</strong> pool entry
                fee is non-refundable in all cases.
              </li>
              <li>
                You acknowledge and accept that stake forfeiture is a
                fundamental part of this service — not a penalty, but an
                agreed-upon consequence of your commitment contract.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              5. Payments and refunds
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>All payments are processed through Stripe in USD.</li>
              <li>
                No refunds are issued for change of mind, failure to complete
                your project, or dissatisfaction with the platform.
              </li>
              <li>
                Refunds may be issued at Ship Or Lose&apos;s sole discretion in
                cases of technical error or platform malfunction.
              </li>
              <li>
                Payouts to winners are processed manually within{" "}
                <strong className="text-[#39FF14]">7 business days</strong> of
                the monthly pool calculation.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              6. Community verification
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Project verification relies on community review. Other users may
                flag submissions they believe do not meet the stated
                &quot;shipped means&quot; criteria.
              </li>
              <li>
                Ship Or Lose reserves the right to make final determinations on
                disputed submissions.
              </li>
              <li>
                Ship Or Lose reserves the right to ban users who submit
                fraudulent proof, game the system, or act in bad faith. Banned
                users forfeit their stake with no refund.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              7. User conduct
            </h2>
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>create fake projects or submit fraudulent proof of shipping;</li>
              <li>manipulate the flagging system;</li>
              <li>create multiple accounts to game the pool; or</li>
              <li>
                engage in any activity intended to defraud the platform or
                other users.
              </li>
            </ul>
            <p className="mt-3">
              Violation of these rules may result in permanent ban and stake
              forfeiture.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              8. Limitation of liability
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Ship Or Lose is provided &quot;as is&quot; without warranties of
                any kind.
              </li>
              <li>
                Ship Or Lose&apos;s total liability to you is limited to the
                amount you paid (<strong className="text-[#39FF14]">$30</strong>
                ).
              </li>
              <li>
                Ship Or Lose is not responsible for: GitHub API outages affecting
                commit tracking, Stripe payment processing issues outside our
                control, or losses resulting from your failure to ship your
                project.
              </li>
              <li>You use Ship Or Lose at your own risk.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              9. Intellectual property
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Your project and code remain yours. Ship Or Lose claims no
                ownership over anything you build.
              </li>
              <li>
                By using Ship Or Lose, you grant the platform permission to
                display your project name, description, GitHub username, avatar,
                and proof URL publicly on the site.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              10. Changes to terms
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Ship Or Lose may update these terms at any time. Continued use of
                the platform after changes constitutes acceptance.
              </li>
              <li>
                Material changes affecting active projects will not apply
                retroactively to commitments already in progress.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              11. Governing law
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                These terms are governed by the laws of the Province of Alberta,
                Canada.
              </li>
              <li>
                Any disputes will be resolved in the courts of Alberta, Canada.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#39FF14]">
              12. Contact
            </h2>
            <p>
              For questions about these terms, contact:{" "}
              <a
                href="mailto:support@shiporlose.com"
                className="text-[#39FF14] underline decoration-[#39FF14]/35 underline-offset-4 hover:text-[#5cff4a]"
              >
                support@shiporlose.com
              </a>
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
