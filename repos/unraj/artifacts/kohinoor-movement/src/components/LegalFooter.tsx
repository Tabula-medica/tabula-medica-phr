export default function LegalFooter() {
  return (
    <footer className="bg-black py-6 px-6 text-center text-[14px] text-white/40">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a
          href="https://tabula-legal.pages.dev/unraj/privacy.html"
          target="_blank"
          rel="noopener"
          className="hover:text-white/70 transition-colors"
        >
          Privacy Policy
        </a>
        <a
          href="https://tabula-legal.pages.dev/unraj/terms.html"
          target="_blank"
          rel="noopener"
          className="hover:text-white/70 transition-colors"
        >
          Terms of Service
        </a>
        <span>&copy; 2026 UnRaj. All rights reserved.</span>
      </div>
    </footer>
  );
}
