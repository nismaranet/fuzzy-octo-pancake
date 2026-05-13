import DashboardSidebar from "@/components/DashboardSidebar";
import Script from "next/script";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full min-h-[calc(100vh-4rem)]">
        {/* Sidebar Navigation */}
        <DashboardSidebar />

        {/* Main Content Area */}
        <div className="flex-1 w-full overflow-x-hidden">{children}</div>
      </div>

      {/* Script Midtrans tetap di sini tidak apa-apa, tapi tanpa pembungkus body */}
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
      />
    </>
  );
}