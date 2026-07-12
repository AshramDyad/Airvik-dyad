import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Sahajanand Wellness (Swaminarayan Ashram) collects, uses, shares, and protects your data, including WhatsApp messaging data.",
  path: "/privacy-policy",
  noindex: true,
});

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-muted/20 py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Legal
          </p>
          <h1 className="text-4xl font-serif font-semibold text-foreground sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="text-lg text-muted-foreground">
            How we collect, use, share, and protect your information, including
            the data we process when you message us on WhatsApp.
          </p>
          <p className="text-sm text-muted-foreground">Last updated: 15 June 2026</p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-10 text-muted-foreground">
          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              1. Who we are
            </h2>
            <p>
              This website is operated by Sahajanand Wellness Trust (Swaminarayan
              Ashram), a registered religious trust in Uttarakhand, India,
              dedicated to religious, educational, and health-related activities.
              You can reach us at{" "}
              <a
                href="mailto:ashram@swaminarayan.yoga"
                className="text-primary hover:underline"
              >
                ashram@swaminarayan.yoga
              </a>{" "}
              or{" "}
              <a href="tel:+918511151708" className="text-primary hover:underline">
                +91 8511151708
              </a>
              . Our address is Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga
              Kinare, Rishikesh, Uttarakhand 249201, India.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              2. Information we collect
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-foreground">Booking information</span>{" "}
                — your name, email address, phone number, address, and your
                check-in and check-out dates.
              </li>
              <li>
                <span className="font-medium text-foreground">Donation information</span>{" "}
                — your name, email, phone number, and donation amount, processed
                through our payment partner.
              </li>
              <li>
                <span className="font-medium text-foreground">WhatsApp data</span>{" "}
                — your phone number, the messages you send us, and basic message
                details (such as message type and timestamp), which we store to
                handle your booking and support requests.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              3. How we use your information
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>To confirm and manage your bookings.</li>
              <li>
                To send you booking confirmations and receipts over WhatsApp.
              </li>
              <li>To respond to your messages and support requests.</li>
              <li>To process donations and issue receipts.</li>
              <li>To meet our legal, accounting, and tax obligations.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              4. WhatsApp messaging and your choices
            </h2>
            <p>
              When you provide your phone number during booking or message us on
              WhatsApp, you may receive booking-related WhatsApp messages from us,
              such as confirmations and receipts. To stop receiving these
              messages, simply reply to the chat asking us to stop, or contact us
              at{" "}
              <a
                href="mailto:ashram@swaminarayan.yoga"
                className="text-primary hover:underline"
              >
                ashram@swaminarayan.yoga
              </a>{" "}
              or{" "}
              <a href="tel:+918511151708" className="text-primary hover:underline">
                +91 8511151708
              </a>
              .
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              5. How we share information
            </h2>
            <p>
              We do not sell your personal information. We share it only with the
              trusted service providers that help us run our services:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-foreground">
                  Meta Platforms / WhatsApp
                </span>{" "}
                — to deliver and receive WhatsApp messages.
              </li>
              <li>
                <span className="font-medium text-foreground">Razorpay</span> — to
                process payments and donations.
              </li>
              <li>
                <span className="font-medium text-foreground">Supabase</span> — to
                store our data securely in a managed database.
              </li>
              <li>
                <span className="font-medium text-foreground">Vercel</span> — to
                host our website.
              </li>
            </ul>
            <p>
              These providers process your information on our behalf and under
              their own privacy and security terms. We may also disclose
              information where required by law.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              6. Data retention
            </h2>
            <p>
              We keep your information only for as long as we need it to provide
              our services, issue receipts, and meet our legal and tax
              obligations. After that, we delete or anonymise it.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              7. Your rights
            </h2>
            <p>
              You can ask us to access, correct, or delete the personal
              information we hold about you. To make a request, contact us at{" "}
              <a
                href="mailto:ashram@swaminarayan.yoga"
                className="text-primary hover:underline"
              >
                ashram@swaminarayan.yoga
              </a>{" "}
              and we will respond within a reasonable time.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              8. Security
            </h2>
            <p>
              We take reasonable steps to protect your information, and the
              service providers we work with use industry-standard security
              measures. No method of storage or transmission is completely
              secure, but we work to keep your data safe.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              9. Changes to this policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we
              will update the date shown at the top of this page.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              10. Contact us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or your data,
              please contact us:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Email:{" "}
                <a
                  href="mailto:ashram@swaminarayan.yoga"
                  className="text-primary hover:underline"
                >
                  ashram@swaminarayan.yoga
                </a>
              </li>
              <li>
                Phone:{" "}
                <a href="tel:+918511151708" className="text-primary hover:underline">
                  +91 8511151708
                </a>
              </li>
              <li>
                Address: Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga
                Kinare, Rishikesh, Uttarakhand 249201, India
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
