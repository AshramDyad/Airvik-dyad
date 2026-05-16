export const metadata = {
  title: "Donation Cancelled | Sahajanand Wellness",
};

export default function DonateCancelPage() {
  return (
    <div className="bg-muted/30 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white/90 p-10 text-center shadow">
        <h1 className="text-3xl font-serif font-bold text-foreground">Donation cancelled</h1>
        <p className="mt-4 text-muted-foreground">
          No worries—your session was closed before payment. You can restart anytime or write to seva@sahajanand.org if
          you need alternative giving options such as NEFT or material donations.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/donate"
            className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </a>
          <a
            href="/"
            className="inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            Back home
          </a>
        </div>
      </div>
    </div>
  );
}
