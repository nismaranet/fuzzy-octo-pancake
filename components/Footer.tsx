export default function Footer() {
  return (
    <footer className="w-full py-12 text-center border-t border-border/50 bg-card/10 text-sm text-gray-500">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-primary/40"></span>
          <span className="w-2 h-2 rounded-full bg-accent-sky/40"></span>
          <span className="w-2 h-2 rounded-full bg-accent-lilac/40"></span>
        </div>
        <p className="mb-2 font-medium text-gray-400">
          Nismara Logistics Ecosystem
        </p>
        <p>
          &copy; {new Date().getFullYear()} Nismara Group. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
